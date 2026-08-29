"""按工作区整理、合并并同步 Claude Code、dsh 会话到 Codex。"""

from __future__ import annotations

import argparse
import difflib
import hashlib
import html
import json
import re
import shutil
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import zstandard
except ImportError as error:
    raise SystemExit("缺少依赖 zstandard，请先运行：python -m pip install zstandard") from error

HOME = Path.home()
CLAUDE_ROOT = HOME / ".claude" / "projects"
DSH_ROOT = HOME / ".dsh" / "sessions"
CODEX_IMPORT_HISTORY = HOME / ".codex" / "external_agent_session_imports.json"
CODEX_ARCHIVE_ROOT = HOME / ".codex" / "archived_sessions"
STAGING_ROOT = CLAUDE_ROOT / "Agent-Import"
STAGING_MARKER = STAGING_ROOT / ".anget-session-sync"
FALLBACK_TIMESTAMP = "2020-01-01T00:00:00Z"
ACTIVE_SESSION_WINDOW_SECONDS = 60


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="按工作区整理、合并并同步 Claude Code、dsh 会话到 Codex")
    parser.add_argument("--mode", choices=("detect", "import"), default="detect", help="检测或正式导入")
    parser.add_argument("--source", choices=("all", "claude", "dsh"), default="all", help="会话来源")
    parser.add_argument("--temp-dir", type=Path, required=True, help="下载目录中的任务临时目录")
    return parser.parse_args()


def normalize_path(value: str | Path) -> str:
    text = str(value)
    if text.startswith("\\\\?\\"):
        text = text[4:]
    return str(Path(text)).replace("/", "\\").rstrip("\\").casefold()


def stable_uuid(value: str) -> str:
    digest = hashlib.md5(value.encode("utf-8"), usedforsecurity=False).hexdigest()
    return str(uuid.UUID(digest))


def iso_time(value: Any) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    if isinstance(value, (int, float)) and value > 0:
        return datetime.fromtimestamp(value / 1000, timezone.utc).isoformat().replace("+00:00", "Z")
    return FALLBACK_TIMESTAMP


def extract_text(content: Any) -> str:
    if isinstance(content, str):
        return content.strip()
    if not isinstance(content, list):
        return ""
    parts: list[str] = []
    for block in content:
        if isinstance(block, dict) and block.get("type") == "text" and isinstance(block.get("text"), str):
            text = block["text"].strip()
            if text:
                parts.append(text)
    return "\n\n".join(parts)


def normalize_message_text(text: str) -> str:
    lines = [line.rstrip() for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    while lines and not lines[0]:
        lines.pop(0)
    while lines and not lines[-1]:
        lines.pop()
    return "\n".join(lines)


def comparison_text(text: str) -> str:
    normalized = normalize_message_text(text)
    patterns = (
        r"<environment_context>[\s\S]*?</environment_context>",
        r"<permissions instructions>[\s\S]*?</permissions instructions>",
        r"<collaboration_mode>[\s\S]*?</collaboration_mode>",
        r"<skills_instructions>[\s\S]*?</skills_instructions>",
        r"<apps_instructions>[\s\S]*?</apps_instructions>",
        r"<plugins_instructions>[\s\S]*?</plugins_instructions>",
        r"<recommended_plugins>[\s\S]*?</recommended_plugins>",
        r"<turn_aborted>[\s\S]*?</turn_aborted>",
        r"<turn_cancelled>[\s\S]*?</turn_cancelled>",
        r"<image\b[^>]*>[\s\S]*?</image>",
    )
    for pattern in patterns:
        normalized = re.sub(pattern, "", normalized, flags=re.IGNORECASE)
    if normalized.lstrip().startswith("# AGENTS.md instructions") and "<INSTRUCTIONS>" in normalized:
        normalized = re.sub(
            r"^\s*# AGENTS\.md instructions[\s\S]*?</INSTRUCTIONS>", "", normalized, count=1, flags=re.IGNORECASE
        )
    return normalize_message_text(html.unescape(normalized))


def canonical_workspace(cwd: str) -> str:
    candidate = Path(cwd or HOME).expanduser()
    try:
        resolved = candidate.resolve(strict=False)
    except OSError:
        resolved = candidate
    if resolved.exists():
        current = resolved if resolved.is_dir() else resolved.parent
        for directory in (current, *current.parents):
            if (directory / ".git").exists():
                return str(directory)
    return str(resolved)


def workspace_slug(workspace: str) -> str:
    name = Path(workspace).name.casefold()
    slug = re.sub(r"[^a-z0-9]+", "-", name).strip("-") or "workspace"
    digest = hashlib.sha256(normalize_path(workspace).encode("utf-8")).hexdigest()[:8]
    return f"{slug}-{digest}"


def transcript_fingerprint(messages: list[tuple[str, str, Any]]) -> str:
    payload = [{"role": role, "text": text} for role, text in normalized_transcript(messages)]
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def load_jsonl_records(path: Path) -> tuple[list[dict[str, Any]], int]:
    malformed = 0
    records: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8", errors="replace") as source:
        for line in source:
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                malformed += 1
                continue
            if isinstance(record, dict):
                records.append(record)
    return records, malformed


def load_zstd_records(path: Path) -> tuple[list[dict[str, Any]], int]:
    with path.open("rb") as source:
        reader = zstandard.ZstdDecompressor().stream_reader(source)
        text = reader.read().decode("utf-8", errors="replace")
    records: list[dict[str, Any]] = []
    malformed = 0
    for line in text.splitlines():
        if not line.strip():
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            malformed += 1
            continue
        if isinstance(record, dict):
            records.append(record)
    return records, malformed


def messages_from_claude(records: list[dict[str, Any]]) -> list[tuple[str, str, Any]]:
    messages: list[tuple[str, str, Any]] = []
    for record in records:
        role = record.get("type")
        if role not in {"user", "assistant"} or record.get("isSidechain") is True:
            continue
        text = extract_text((record.get("message") or {}).get("content"))
        if text:
            messages.append((role, text, record.get("timestamp")))
    return messages


def messages_from_dsh(records: list[dict[str, Any]]) -> list[tuple[str, str, Any]]:
    messages: list[tuple[str, str, Any]] = []
    for record in records:
        record_type = record.get("type")
        data = record.get("data") or {}
        if record_type == "user/message":
            if (data.get("source") or {}).get("kind") != "user":
                continue
            text = extract_text(data.get("content"))
            if text:
                messages.append(("user", text, record.get("time")))
        elif record_type == "assistant/message":
            text = extract_text((data.get("message") or {}).get("content"))
            if text:
                messages.append(("assistant", text, record.get("time")))
    return messages


def messages_from_codex(path: Path) -> tuple[list[tuple[str, str, Any]], str]:
    records, _ = load_jsonl_records(path)
    messages: list[tuple[str, str, Any]] = []
    cwd = str(HOME)
    for record in records:
        if record.get("type") == "session_meta":
            cwd = str((record.get("payload") or {}).get("cwd") or cwd)
            continue
        if record.get("type") != "response_item":
            continue
        payload = record.get("payload") or {}
        if payload.get("type") != "message" or payload.get("role") not in {"user", "assistant"}:
            continue
        parts: list[str] = []
        for block in payload.get("content") or []:
            if not isinstance(block, dict) or block.get("type") not in {"input_text", "output_text", "text"}:
                continue
            text = block.get("text")
            if isinstance(text, str) and text.strip():
                parts.append(text.strip())
        if parts:
            messages.append((payload["role"], "\n\n".join(parts), record.get("timestamp")))
    return messages, cwd


def resolve_codex_origin(source_path: str, source_id: Any) -> Path | None:
    direct = Path(source_path) if source_path else None
    if direct is not None and direct.exists():
        return direct
    identifier = str(source_id or "")
    if not identifier or not CODEX_ARCHIVE_ROOT.exists():
        return None
    matches = sorted(CODEX_ARCHIVE_ROOT.glob(f"*{identifier}*.jsonl"))
    return matches[0] if len(matches) == 1 else None


def normalized_transcript(messages: list[tuple[str, str, Any]]) -> list[tuple[str, str]]:
    transcript: list[tuple[str, str]] = []
    for role, text, _ in messages:
        normalized = comparison_text(text)
        if normalized:
            transcript.append((role, normalized))
    return transcript


def compare_transcripts(current: list[tuple[str, str, Any]], origin: list[tuple[str, str, Any]]) -> str:
    current_normalized = [item for item in normalized_transcript(current) if item[0] == "user"]
    origin_normalized = [item for item in normalized_transcript(origin) if item[0] == "user"]
    if current_normalized == origin_normalized:
        return "exact"

    def is_subsequence(shorter: list[tuple[str, str]], longer: list[tuple[str, str]]) -> bool:
        iterator = iter(longer)
        return all(any(candidate == item for candidate in iterator) for item in shorter)

    if is_subsequence(origin_normalized, current_normalized):
        return "extended"
    if is_subsequence(current_normalized, origin_normalized):
        return "subset"
    return "diverged"


def conversation_turns(messages: list[tuple[str, str, Any]]) -> list[tuple[str, list[tuple[str, str, Any]]]]:
    turns: list[tuple[str, list[tuple[str, str, Any]]]] = []
    current: list[tuple[str, str, Any]] = []
    current_key = ""
    for message in messages:
        role, text, _ = message
        key = comparison_text(text) if role == "user" else ""
        if role == "user" and key:
            if current:
                turns.append((current_key, current))
            current_key = key
            current = [message]
        elif current:
            current.append(message)
    if current:
        turns.append((current_key, current))
    return turns


def merge_conversations(
    origin: list[tuple[str, str, Any]], current: list[tuple[str, str, Any]]
) -> list[tuple[str, str, Any]]:
    origin_turns = conversation_turns(origin)
    current_turns = conversation_turns(current)
    matcher = difflib.SequenceMatcher(
        None,
        [key for key, _ in origin_turns],
        [key for key, _ in current_turns],
        autojunk=False,
    )
    merged: list[tuple[str, str, Any]] = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag in {"equal", "delete", "replace"}:
            for _, turn in origin_turns[i1:i2]:
                merged.extend(turn)
        if tag in {"insert", "replace"}:
            for _, turn in current_turns[j1:j2]:
                merged.extend(turn)
    return merged


def load_import_registry() -> dict[str, set[str]]:
    registry: dict[str, set[str]] = {}
    if not CODEX_IMPORT_HISTORY.exists():
        return registry
    try:
        payload = json.loads(CODEX_IMPORT_HISTORY.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return registry
    for record in payload.get("records") or []:
        path = normalize_path(record.get("source_path", ""))
        digest = str(record.get("content_sha256") or "")
        if path and digest:
            registry.setdefault(path, set()).add(digest)
    return registry


def load_import_records() -> dict[str, list[dict[str, Any]]]:
    records_by_path: dict[str, list[dict[str, Any]]] = {}
    if not CODEX_IMPORT_HISTORY.exists():
        return records_by_path
    try:
        payload = json.loads(CODEX_IMPORT_HISTORY.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return records_by_path
    for record in payload.get("records") or []:
        path = normalize_path(record.get("source_path", ""))
        if path:
            records_by_path.setdefault(path, []).append(record)
    return records_by_path


def thread_is_archived(thread_id: str) -> bool:
    return bool(thread_id) and CODEX_ARCHIVE_ROOT.exists() and any(CODEX_ARCHIVE_ROOT.glob(f"*{thread_id}*.jsonl"))


def legacy_dsh_identity(session: dict[str, Any]) -> tuple[str, set[str]]:
    original_id = str(session["original_id"])
    session_id = original_id.removeprefix("session-")
    try:
        uuid.UUID(session_id)
    except ValueError:
        session_id = stable_uuid(original_id)
    output: list[dict[str, Any]] = []
    parent_uuid: str | None = None
    for index, (role, text, timestamp) in enumerate(session["messages"]):
        message_uuid = stable_uuid(f"{session_id}:{index}:{role}:{timestamp}")
        record: dict[str, Any] = {
            "parentUuid": parent_uuid, "isSidechain": False, "type": role, "uuid": message_uuid,
            "timestamp": iso_time(timestamp), "userType": "external", "entrypoint": "cli",
            "cwd": session["cwd"], "sessionId": session_id, "version": "2.1.232", "gitBranch": "HEAD",
        }
        if role == "user":
            record["message"] = {"role": "user", "content": text}
            record["origin"] = {"kind": "human"}
        else:
            record["message"] = {
                "id": f"msg_{message_uuid.replace('-', '')[:24]}", "type": "message", "role": "assistant",
                "model": "deepseek-harness", "content": [{"type": "text", "text": text}],
                "usage": {"input_tokens": 0, "output_tokens": 0}, "stop_reason": "end_turn",
            }
        output.append(record)
        parent_uuid = message_uuid
    payload = "".join(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n" for record in output)
    legacy_path = CLAUDE_ROOT / "DSH-Import" / f"{session_id}.jsonl"
    digests = {
        hashlib.sha256(payload.encode("utf-8")).hexdigest(),
        hashlib.sha256(payload.replace("\n", "\r\n").encode("utf-8")).hexdigest(),
    }
    return normalize_path(legacy_path), digests


def session_is_imported(session: dict[str, Any], registry: dict[str, set[str]]) -> bool:
    if session["source"] == "dsh-reverse" and session.get("reverse_relation") in {"exact", "subset"}:
        return True
    if session["source"] == "claude":
        path = Path(session["source_path"])
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        return digest in registry.get(normalize_path(path), set())
    path, digests = legacy_dsh_identity(session)
    return bool(digests & registry.get(path, set()))


def superseded_threads(
    session: dict[str, Any], records_by_path: dict[str, list[dict[str, Any]]]
) -> list[dict[str, str]]:
    if session["source"] == "claude":
        identity_path = normalize_path(session["source_path"])
    elif session["source"] == "dsh":
        identity_path, _ = legacy_dsh_identity(session)
    else:
        return []
    results: list[dict[str, str]] = []
    for record in records_by_path.get(identity_path, []):
        thread_id = str(record.get("imported_thread_id") or "")
        if not thread_id or thread_is_archived(thread_id):
            continue
        results.append({"thread_id": thread_id, "source_path": str(record.get("source_path") or "")})
    return results


def session_lineage(session: dict[str, Any]) -> str:
    if session["source"] == "claude":
        return f"claude:{normalize_path(session['source_path'])}"
    if session["source"] == "dsh-reverse":
        return f"codex-reverse:{session.get('origin_codex_id') or session['original_id']}"
    return f"dsh:{session['original_id']}"


def collect_claude_sessions() -> tuple[list[dict[str, Any]], dict[str, int]]:
    sessions: list[dict[str, Any]] = []
    stats = {"source_files": 0, "empty": 0, "subagent": 0, "active": 0, "unreadable": 0}
    if not CLAUDE_ROOT.exists():
        return sessions, stats
    for path in CLAUDE_ROOT.rglob("*.jsonl"):
        if normalize_path(path).startswith(normalize_path(STAGING_ROOT)):
            continue
        if path.parent.name == "subagents":
            stats["subagent"] += 1
            continue
        stats["source_files"] += 1
        try:
            source_stat = path.stat()
            if time.time() - source_stat.st_mtime < ACTIVE_SESSION_WINDOW_SECONDS:
                stats["active"] += 1
                continue
            records, malformed = load_jsonl_records(path)
        except OSError:
            stats["unreadable"] += 1
            continue
        messages = messages_from_claude(records)
        if not any(role == "user" for role, _, _ in messages):
            stats["empty"] += 1
            continue
        cwd = next((str(record.get("cwd")) for record in records if record.get("cwd")), str(HOME))
        original_id = str(next((record.get("sessionId") for record in records if record.get("sessionId")), path.stem))
        sessions.append({
            "source": "claude", "source_path": str(path), "original_id": original_id,
            "cwd": cwd, "workspace": canonical_workspace(cwd), "messages": messages,
            "malformed_lines": malformed, "mtime": iso_time(int(source_stat.st_mtime * 1000)),
        })
    return sessions, stats


def collect_dsh_sessions() -> tuple[list[dict[str, Any]], dict[str, Any]]:
    sessions: list[dict[str, Any]] = []
    stats: dict[str, Any] = {
        "source_files": 0,
        "reverse_imported": {"total": 0, "exact": 0, "extended": 0, "subset": 0, "diverged": 0, "missing_origin": 0},
        "skipped": {"subagent": 0, "empty": 0, "active": 0, "unreadable": 0},
    }
    if not DSH_ROOT.exists():
        return sessions, stats
    source_paths = list(DSH_ROOT.rglob("session.jsonl.zstd"))
    stats["source_files"] = len(source_paths)
    for path in source_paths:
        is_reverse = path.parent.name.startswith("import-")
        try:
            source_stat = path.stat()
            if time.time() - source_stat.st_mtime < ACTIVE_SESSION_WINDOW_SECONDS:
                stats["skipped"]["active"] += 1
                continue
            records, malformed = load_zstd_records(path)
        except Exception:
            stats["skipped"]["unreadable"] += 1
            continue
        if any(record.get("type") == "subagent/descriptor" for record in records):
            stats["skipped"]["subagent"] += 1
            continue
        messages = messages_from_dsh(records)
        if not any(role == "user" for role, _, _ in messages):
            stats["skipped"]["empty"] += 1
            continue
        session_record = next((record for record in records if record.get("type") == "session"), {})
        imported_record = next((record for record in records if record.get("type") == "session/imported"), {})
        cwd = str(session_record.get("cwd") or HOME)
        session: dict[str, Any] = {
            "source": "dsh-reverse" if is_reverse else "dsh", "source_path": str(path),
            "original_id": str(session_record.get("id") or path.parent.name),
            "cwd": cwd, "workspace": canonical_workspace(cwd), "messages": messages,
            "malformed_lines": malformed, "mtime": iso_time(int(source_stat.st_mtime * 1000)),
        }
        if is_reverse:
            stats["reverse_imported"]["total"] += 1
            imported_data = imported_record.get("data") or {}
            origin_text = str(imported_data.get("sourcePath") or "")
            origin_path = resolve_codex_origin(origin_text, imported_data.get("sourceId"))
            session["origin_codex_id"] = imported_data.get("sourceId")
            session["origin_codex_path"] = str(origin_path) if origin_path is not None else (origin_text or None)
            if origin_path is not None and origin_path.exists():
                origin_messages, origin_cwd = messages_from_codex(origin_path)
                relation = compare_transcripts(messages, origin_messages)
                session["origin_messages"] = len(origin_messages)
                session["origin_workspace"] = canonical_workspace(origin_cwd)
                if relation in {"extended", "diverged"}:
                    session["reverse_messages"] = len(messages)
                    session["messages"] = merge_conversations(origin_messages, messages)
                    session["merged_messages"] = len(session["messages"])
            else:
                relation = "missing_origin"
                session["origin_messages"] = 0
                session["origin_workspace"] = None
            session["reverse_relation"] = relation
            stats["reverse_imported"][relation] += 1
        sessions.append(session)
    return sessions, stats


def prepare_staging() -> None:
    if STAGING_ROOT.exists():
        if not STAGING_MARKER.exists():
            raise RuntimeError(f"暂存目录已存在且不是本技能创建，拒绝覆盖：{STAGING_ROOT}")
        shutil.rmtree(STAGING_ROOT)
    STAGING_ROOT.mkdir(parents=True)
    STAGING_MARKER.write_text("anget-manager session sync\n", encoding="utf-8")


def cleanup_staging() -> None:
    if not STAGING_ROOT.exists():
        return
    if not STAGING_MARKER.exists():
        raise RuntimeError(f"暂存目录缺少安全标记，拒绝删除：{STAGING_ROOT}")
    resolved = STAGING_ROOT.resolve()
    expected = (CLAUDE_ROOT / "Agent-Import").resolve()
    if resolved != expected:
        raise RuntimeError(f"暂存目录路径校验失败：{resolved}")
    shutil.rmtree(resolved)


def write_canonical_session(session: dict[str, Any], target: Path, session_id: str) -> str:
    records: list[dict[str, Any]] = []
    parent_uuid: str | None = None
    for index, (role, text, timestamp) in enumerate(session["messages"]):
        message_uuid = stable_uuid(f"{session_id}:{index}:{role}")
        record: dict[str, Any] = {
            "parentUuid": parent_uuid, "isSidechain": False, "type": role, "uuid": message_uuid,
            "timestamp": iso_time(timestamp) if timestamp else session["mtime"],
            "userType": "external", "entrypoint": "cli", "cwd": session["workspace"],
            "sessionId": session_id, "version": "2.1.232", "gitBranch": "HEAD",
        }
        if role == "user":
            record["message"] = {"role": "user", "content": text}
            record["origin"] = {"kind": "human"}
        else:
            record["message"] = {
                "id": f"msg_{message_uuid.replace('-', '')[:24]}", "type": "message", "role": "assistant",
                "model": "external-agent-merged", "content": [{"type": "text", "text": text}],
                "usage": {"input_tokens": 0, "output_tokens": 0}, "stop_reason": "end_turn",
            }
        records.append(record)
        parent_uuid = message_uuid
    payload = "".join(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n" for record in records)
    target.write_text(payload, encoding="utf-8")
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def organize_and_stage(sessions: list[dict[str, Any]], temp_dir: Path) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    prepare_staging()
    registry = load_import_registry()
    records_by_path = load_import_records()
    groups: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for session in sessions:
        fingerprint = transcript_fingerprint(session["messages"])
        groups.setdefault((normalize_path(session["workspace"]), fingerprint), []).append(session)
    manifest: dict[str, Any] = {
        "input_sessions": len(sessions), "organized_sessions": len(groups), "output_sessions": 0,
        "already_imported": 0, "duplicates_merged": len(sessions) - len(groups),
        "workspaces": {}, "sessions": [],
    }
    staged_index: dict[str, dict[str, Any]] = {}
    for (workspace_key, fingerprint), duplicates in sorted(groups.items(), key=lambda item: item[0]):
        duplicates.sort(key=lambda item: (0 if item["source"] == "claude" else 1, item["source_path"]))
        canonical = duplicates[0]
        workspace = canonical["workspace"]
        stats = manifest["workspaces"].setdefault(workspace, {
            "input_sessions": 0, "organized_sessions": 0, "output_sessions": 0,
            "already_imported": 0, "duplicates_merged": 0,
        })
        stats["input_sessions"] += len(duplicates)
        stats["organized_sessions"] += 1
        stats["duplicates_merged"] += len(duplicates) - 1
        if any(session_is_imported(item, registry) for item in duplicates):
            manifest["already_imported"] += 1
            stats["already_imported"] += 1
            continue
        session_id = stable_uuid(f"{workspace_key}:{session_lineage(canonical)}")
        target = STAGING_ROOT / f"{workspace_slug(workspace)}--{session_id}.jsonl"
        payload_hash = write_canonical_session(canonical, target, session_id)
        first_user = next(text for role, text, _ in canonical["messages"] if role == "user")
        entry = {
            "session_id": session_id, "target": str(target), "workspace": workspace,
            "workspace_key": workspace_key, "title": first_user.replace("\n", " ")[:120],
            "messages": len(canonical["messages"]),
            "sources": sorted({item["source"] for item in duplicates}),
            "source_paths": sorted(item["source_path"] for item in duplicates),
            "duplicate_count": len(duplicates), "content_fingerprint": fingerprint, "sha256": payload_hash,
            "reverse_origins": [
                {
                    "thread_id": item.get("origin_codex_id"),
                    "source_path": item.get("origin_codex_path"),
                    "relation": item.get("reverse_relation"),
                }
                for item in duplicates
                if item.get("origin_codex_id") and item.get("reverse_relation") in {"extended", "diverged"}
                and not thread_is_archived(str(item.get("origin_codex_id")))
            ],
            "superseded_threads": [],
        }
        previous_threads = [
            thread
            for item in duplicates
            for thread in superseded_threads(item, records_by_path)
        ]
        previous_threads.extend(
            {
                "thread_id": str(record.get("imported_thread_id") or ""),
                "source_path": str(record.get("source_path") or ""),
            }
            for record in records_by_path.get(normalize_path(target), [])
            if record.get("imported_thread_id")
            and not thread_is_archived(str(record.get("imported_thread_id")))
        )
        entry["superseded_threads"] = list({
            thread["thread_id"]: thread for thread in previous_threads if thread.get("thread_id")
        }.values())
        manifest["sessions"].append(entry)
        manifest["output_sessions"] += 1
        stats["output_sessions"] += 1
        staged_index[normalize_path(target)] = entry
    (temp_dir / "session-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest, staged_index


def find_codex() -> str:
    command = shutil.which("codex")
    if command:
        return command
    fallback = HOME / "AppData" / "Local" / "Programs" / "OpenAI" / "Codex" / "bin" / "codex.exe"
    if fallback.exists():
        return str(fallback)
    raise RuntimeError("未找到 codex 可执行文件")


class AppServerClient:
    def __init__(self, executable: str) -> None:
        self.process = subprocess.Popen(
            [executable, "app-server", "--stdio"], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL, text=True, encoding="utf-8", bufsize=1,
        )
        self.request_id = 0
        self.notifications: list[dict[str, Any]] = []

    def send(self, message: dict[str, Any]) -> None:
        if self.process.stdin is None:
            raise RuntimeError("Codex App Server 标准输入不可用")
        self.process.stdin.write(json.dumps(message, ensure_ascii=False) + "\n")
        self.process.stdin.flush()

    def read(self) -> dict[str, Any]:
        if self.process.stdout is None:
            raise RuntimeError("Codex App Server 标准输出不可用")
        while True:
            line = self.process.stdout.readline()
            if not line:
                raise RuntimeError("Codex App Server 意外退出")
            message = json.loads(line)
            if isinstance(message, dict):
                return message

    def request(self, method: str, params: dict[str, Any]) -> dict[str, Any]:
        self.request_id += 1
        current_id = self.request_id
        self.send({"id": current_id, "method": method, "params": params})
        while True:
            message = self.read()
            if message.get("id") != current_id:
                self.notifications.append(message)
                continue
            if message.get("error"):
                raise RuntimeError(f"{method} 失败：{message['error']}")
            return message.get("result") or {}

    def initialize(self) -> None:
        self.request("initialize", {"clientInfo": {"name": "anget-manager", "title": "Agent 会话整理同步", "version": "3.0.0"}, "capabilities": {"experimentalApi": True}})
        self.send({"method": "initialized", "params": {}})

    def wait_for_import(self, import_id: str) -> dict[str, Any]:
        queued, self.notifications = self.notifications, []
        for message in queued:
            params = message.get("params") or {}
            if message.get("method") == "externalAgentConfig/import/completed" and params.get("importId") == import_id:
                return params
        while True:
            message = self.read()
            params = message.get("params") or {}
            if message.get("method") == "externalAgentConfig/import/completed" and params.get("importId") == import_id:
                return params

    def close(self) -> None:
        if self.process.stdin is not None:
            self.process.stdin.close()
        try:
            self.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.process.terminate()
            self.process.wait(timeout=5)


def filter_migration_items(items: list[dict[str, Any]], staged_index: dict[str, dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    selected_items: list[dict[str, Any]] = []
    candidates: list[dict[str, Any]] = []
    for item in items:
        if item.get("itemType") != "SESSIONS":
            continue
        details = item.get("details") or {}
        selected_sessions: list[dict[str, Any]] = []
        for session in details.get("sessions") or []:
            entry = staged_index.get(normalize_path(session.get("path", "")))
            if entry is None:
                continue
            selected_sessions.append(session)
            candidates.append({
                "path": session.get("path"), "workspace": entry["workspace"],
                "title": session.get("title") or entry["title"], "sources": entry["sources"],
                "duplicate_count": entry["duplicate_count"], "reverse_origins": entry["reverse_origins"],
                "superseded_threads": entry["superseded_threads"],
            })
        if selected_sessions:
            selected_item = dict(item)
            selected_details = dict(details)
            selected_details["sessions"] = selected_sessions
            selected_item["details"] = selected_details
            selected_items.append(selected_item)
    return selected_items, candidates


def archive_origin_ids(candidates: list[dict[str, Any]], results: list[dict[str, Any]]) -> list[str]:
    imported_target_ids = {
        str(success.get("target") or "")
        for result in results
        for success in (result.get("successes") or [])
        if success.get("target")
    }
    return sorted({
        str(previous["thread_id"])
        for candidate in candidates
        for previous in (
            list(candidate.get("reverse_origins") or [])
            + list(candidate.get("superseded_threads") or [])
        )
        if previous.get("thread_id")
        and str(previous["thread_id"]) not in imported_target_ids
    })


def count_source_files() -> dict[str, int]:
    claude = 0
    if CLAUDE_ROOT.exists():
        claude = sum(1 for path in CLAUDE_ROOT.rglob("*.jsonl") if not normalize_path(path).startswith(normalize_path(STAGING_ROOT)))
    dsh = len(list(DSH_ROOT.rglob("session.jsonl.zstd"))) if DSH_ROOT.exists() else 0
    return {"claude": claude, "dsh": dsh}


def main() -> int:
    args = parse_args()
    temp_dir = args.temp_dir.resolve()
    allowed_root = (HOME / "Downloads" / "anget-tmp").resolve()
    if allowed_root not in temp_dir.parents:
        raise RuntimeError(f"临时目录必须位于 {allowed_root} 下：{temp_dir}")
    temp_dir.mkdir(parents=True, exist_ok=True)
    source_counts_before = count_source_files()
    client: AppServerClient | None = None
    try:
        sessions: list[dict[str, Any]] = []
        source_scan: dict[str, Any] = {}
        if args.source in {"all", "claude"}:
            found, stats = collect_claude_sessions()
            sessions.extend(found)
            source_scan["claude"] = stats
        if args.source in {"all", "dsh"}:
            found, stats = collect_dsh_sessions()
            sessions.extend(found)
            source_scan["dsh"] = stats
        manifest, staged_index = organize_and_stage(sessions, temp_dir)
        client = AppServerClient(find_codex())
        client.initialize()
        detected = client.request("externalAgentConfig/detect", {
            "includeHome": True, "cwds": sorted(manifest["workspaces"]), "maxSessionAgeDays": 36500,
            "maxSessions": 10000, "migrationSource": "claude-code",
        })
        migration_items, candidates = filter_migration_items(detected.get("items") or [], staged_index)
        requested = len(candidates)
        summary: dict[str, Any] = {
            "mode": args.mode, "source": args.source, "source_scan": source_scan,
            "organization": {
                "workspaces": len(manifest["workspaces"]), "input_sessions": manifest["input_sessions"],
                "organized_sessions": manifest["organized_sessions"], "output_sessions": manifest["output_sessions"],
                "already_imported": manifest["already_imported"], "duplicates_merged": manifest["duplicates_merged"],
                "workspace_details": manifest["workspaces"],
            },
            "requested": requested, "candidates": candidates,
        }
        if args.mode == "detect" or requested == 0:
            summary["status"] = "detected" if requested else "nothing-to-import"
            print(json.dumps(summary, ensure_ascii=False, indent=2))
            return 0
        response = client.request("externalAgentConfig/import", {
            "migrationItems": migration_items, "migrationSource": "claude-code",
            "providerId": "anget-manager", "source": "anget-manager",
        })
        completed = client.wait_for_import(str(response["importId"]))
        results = completed.get("itemTypeResults") or []
        successes = sum(len(result.get("successes") or []) for result in results)
        failures = sum(len(result.get("failures") or []) for result in results)
        summary.update({"status": "completed", "successes": successes, "failures": failures, "result": completed})
        if successes + failures != requested:
            raise RuntimeError("导入结果数量与请求数量不一致")
        archived_origins: list[str] = []
        archive_failures: list[dict[str, str]] = []
        if failures == 0:
            origin_ids = archive_origin_ids(candidates, results)
            for thread_id in origin_ids:
                try:
                    client.request("thread/archive", {"threadId": thread_id})
                    archived_origins.append(thread_id)
                except RuntimeError as error:
                    archive_failures.append({"thread_id": thread_id, "error": str(error)})
        summary["archived_origins"] = archived_origins
        summary["archive_failures"] = archive_failures
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        if failures:
            return 2
        return 3 if archive_failures else 0
    finally:
        if client is not None:
            client.close()
        cleanup_staging()
        if count_source_files() != source_counts_before:
            raise RuntimeError("原始会话文件数量发生变化，停止交付")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("操作已中断，正在清理临时文件。", file=sys.stderr)
        raise SystemExit(130)
    except Exception as error:
        print(f"错误：{error}", file=sys.stderr)
        raise SystemExit(1)
