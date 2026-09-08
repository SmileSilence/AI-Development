#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
给 DSH headless 会话补上 agentPreset（模式）字段，让其在 DSH 桌面窗口正常显示模式。
DSH 有 preset: standard(标准) / ptc / minimal(极简) / cordis(创造)。

用法：
  python patch_agent_preset.py <session-id> [preset]
  默认 preset=standard

改两处：
  1. ~/.dsh/sessions/<项目>/<session-id>/session.v2.jsonl.zstd 的 session 记录
  2. ~/.dsh/storages/session_projcache/sessions/<session-id>.json 的 identity
"""
import os, sys, json, zstandard, glob

PRESETS = ("standard", "ptc", "minimal", "cordis")
DSH_SESSIONS = os.path.join(os.path.expanduser("~"), ".dsh", "sessions")
DSH_PROJCACHE = os.path.join(os.path.expanduser("~"), ".dsh", "storages", "session_projcache", "sessions")

def find_session_path(sid):
    """在 ~/.dsh/sessions/**/ 下找 session-<sid> 目录里的 zstd 文件"""
    for root, dirs, files in os.walk(DSH_SESSIONS):
        for f in files:
            if f.endswith(".zstd") and sid in root:
                return os.path.join(root, f)
    return None

def read_zstd(p):
    dctx = zstandard.ZstdDecompressor()
    with open(p, "rb") as fh:
        return dctx.stream_reader(fh).read()

def write_zstd(p, data):
    cctx = zstandard.ZstdCompressor()
    with open(p, "wb") as fh:
        fh.write(cctx.compress(data))

def patch_zstd(p, preset):
    data = read_zstd(p)
    lines = data.decode("utf-8").splitlines()
    changed = False
    for i, line in enumerate(lines):
        if not line.strip():
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        if obj.get("type") == "session":
            if obj.get("agentPreset") == preset:
                print("  session 记录已有 agentPreset:", preset)
                return False
            obj["agentPreset"] = preset
            lines[i] = json.dumps(obj, ensure_ascii=False)
            changed = True
            break
    if changed:
        write_zstd(p, ("\n".join(lines)).encode("utf-8"))
        print("  ✅ zstd session 记录已加 agentPreset=" + preset)
        return True
    print("  ⚠️ 未找到 session 记录")
    return False

def patch_projcache(sid, preset):
    p = os.path.join(DSH_PROJCACHE, f"{sid}.json")
    if not os.path.exists(p):
        print(f"  ⚠️ 投影缓存不存在: {p}")
        return False
    with open(p, "r", encoding="utf-8") as f:
        d = json.load(f)
    ident = d.get("record", {}).get("identity", {})
    if ident.get("agentPreset") == preset:
        print("  投影缓存已有 agentPreset")
        return False
    ident["agentPreset"] = preset
    with open(p, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
    print("  ✅ 投影缓存 identity 已加 agentPreset=" + preset)
    return True

def main():
    if len(sys.argv) < 2:
        print("用法: python patch_agent_preset.py <session-id> [preset]")
        sys.exit(1)
    sid = sys.argv[1]
    if not sid.startswith("session-"):
        sid = "session-" + sid
    preset = sys.argv[2] if len(sys.argv) > 2 else "standard"
    if preset not in PRESETS:
        print(f"预设必须是 {PRESETS} 之一，got {preset}")
        sys.exit(1)

    zp = find_session_path(sid)
    if zp is None:
        print(f"❌ 未找到会话 {sid}")
        sys.exit(1)
    print(f"会话文件: {zp}")
    patch_zstd(zp, preset)
    patch_projcache(sid, preset)
    print("完成")

if __name__ == "__main__":
    main()
