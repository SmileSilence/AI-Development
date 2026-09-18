# agent_link_server.py
# Blender <-> AI Agent link.
# Auto-started from scripts/startup on every Blender launch.
# Opens a JSON-over-TCP server on 127.0.0.1:9876 that executes Python code
# inside Blender (on the main thread) and returns stdout / result / error.
#
# Protocol (newline-delimited UTF-8 JSON, one request per connection):
#   -> {"type": "ping"}
#   <- {"status": "success", "result": {...}}
#   -> {"type": "execute_code", "params": {"code": "...", "timeout": 60}}
#   <- {"status": "success"|"error", "stdout": "...", "result": ..., "error": "..."}
#
# In execute_code, assign to the variable __result__ to return a value.
import bpy
import bmesh
import io
import json
import os
import queue
import socket
import sys
import threading
import time
import traceback
from mathutils import Euler, Matrix, Vector

PORT = 9876
RECV_LIMIT = 64 * 1024 * 1024

_state = {
    "running": False,
    "error": None,
    "stop": False,
    "jobs": {},
    "job_seq": 0,
}
_lock = threading.Lock()
_main_queue = queue.Queue()


def _run_code_on_main(code):
    buf = io.StringIO()
    real_stdout = sys.stdout
    result = None
    error = None
    try:
        ns = {
            "bpy": bpy,
            "bmesh": bmesh,
            "Vector": Vector,
            "Matrix": Matrix,
            "Euler": Euler,
            "__name__": "agent_link",
        }
        exec(compile(code, "<agent_link>", "exec"), ns)  # noqa: S102 - by design
        result = ns.get("__result__")
    except Exception:
        error = traceback.format_exc()
    finally:
        sys.stdout = real_stdout

    out = {"stdout": buf.getvalue(), "error": error}
    try:
        json.dumps(result)
        out["result"] = result
    except Exception:
        out["result"] = repr(result)
    return out


def _timer_process():
    """Runs on Blender's main thread: drains queued jobs from the socket thread."""
    try:
        while True:
            job_id, code = _main_queue.get_nowait()
            res = _run_code_on_main(code)
            with _lock:
                _state["jobs"][job_id] = res
    except queue.Empty:
        pass
    return 0.05


def _send(conn, obj):
    data = json.dumps(obj).encode("utf-8") + b"\n"
    conn.sendall(data)


def _recv_request(conn):
    data = bytearray()
    while b"\n" not in data:
        if len(data) > RECV_LIMIT:
            raise ValueError("request too large")
        chunk = conn.recv(65536)
        if not chunk:
            break
        data.extend(chunk)
    return data.rstrip(b"\n")


def _handle(conn):
    raw = _recv_request(conn)
    try:
        req = json.loads(raw.decode("utf-8"))
    except Exception as exc:
        _send(conn, {"status": "error", "error": "bad request: %s" % exc})
        return

    rtype = req.get("type")

    if rtype == "ping":
        _send(conn, {
            "status": "success",
            "result": {
                "blender": bpy.app.version_string,
                "python": "%d.%d.%d" % sys.version_info[:3],
                "pid": os.getpid(),
                "background": bool(bpy.app.background),
                "file": bpy.data.filepath or None,
            },
        })
        return

    if rtype == "execute_code":
        params = req.get("params") or {}
        code = str(params.get("code", ""))
        try:
            timeout = float(params.get("timeout", 60))
        except (TypeError, ValueError):
            timeout = 60.0
        timeout = max(5.0, min(timeout, 600.0))

        with _lock:
            _state["job_seq"] += 1
            job_id = _state["job_seq"]

        _main_queue.put((job_id, code))
        deadline = time.time() + timeout
        while time.time() < deadline:
            with _lock:
                res = _state["jobs"].pop(job_id, None)
            if res is not None:
                status = "error" if res.get("error") else "success"
                _send(conn, {"status": status, **res})
                return
            time.sleep(0.02)
        _send(conn, {"status": "error", "error": "timeout waiting for Blender main thread"})
        return

    _send(conn, {"status": "error", "error": "unknown request type: %r" % (rtype,)})


def _server_loop():
    srv = None
    try:
        srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        srv.bind(("127.0.0.1", PORT))
        srv.listen(8)
        srv.settimeout(0.5)
        with _lock:
            _state["running"] = True
            _state["error"] = None
        while not _state["stop"]:
            try:
                conn, _addr = srv.accept()
            except socket.timeout:
                continue
            except OSError:
                break
            try:
                conn.settimeout(120)
                _handle(conn)
            except Exception:
                try:
                    _send(conn, {"status": "error", "error": traceback.format_exc()})
                except Exception:
                    pass
            finally:
                try:
                    conn.close()
                except Exception:
                    pass
        srv.close()
        with _lock:
            _state["running"] = False
    except Exception as exc:
        with _lock:
            _state["running"] = False
            _state["error"] = "%s: %s" % (type(exc).__name__, exc)
        if srv is not None:
            try:
                srv.close()
            except Exception:
                pass


def start_server():
    with _lock:
        if _state["running"]:
            return False, "already running on port %d" % PORT
        _state["stop"] = False
    thread = threading.Thread(target=_server_loop, daemon=True, name="agent-link-server")
    thread.start()
    if not bpy.app.timers.is_registered(_timer_process):
        bpy.app.timers.register(_timer_process, first_interval=0.1, persistent=True)
    return True, "started on port %d" % PORT


def stop_server():
    with _lock:
        _state["stop"] = True
    if bpy.app.timers.is_registered(_timer_process):
        bpy.app.timers.unregister(_timer_process)
    return True, "stopped"


class AGENTLINK_OT_toggle(bpy.types.Operator):
    bl_idname = "agentlink.toggle"
    bl_label = "Start / Stop Agent Link"
    bl_description = "Toggle the local JSON-over-TCP server for AI agents (port %d)" % PORT

    def execute(self, context):
        with _lock:
            running = _state["running"]
        if running:
            ok, msg = stop_server()
        else:
            ok, msg = start_server()
        self.report({"INFO"}, "Agent Link: %s" % msg)
        return {"FINISHED"}


class AGENTLINK_PT_panel(bpy.types.Panel):
    bl_idname = "AGENTLINK_PT_panel"
    bl_label = "Agent Link"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Agent Link"

    def draw(self, context):
        with _lock:
            running = _state["running"]
            error = _state["error"]
        col = self.layout.column(align=True)
        col.operator("agentlink.toggle",
                     text="Stop server" if running else "Start server",
                     icon="PAUSE" if running else "PLAY")
        col.label(text="Port %d - %s" % (PORT, "running" if running else "stopped"),
                  icon="CHECKMARK" if running else "X")
        if error:
            col.label(text=error, icon="ERROR")


_CLASSES = (AGENTLINK_OT_toggle, AGENTLINK_PT_panel)


def _register_classes():
    for cls in _CLASSES:
        try:
            bpy.utils.register_class(cls)
        except ValueError:
            pass  # already registered (module re-import / reload)


def _unregister_classes():
    for cls in reversed(_CLASSES):
        try:
            bpy.utils.unregister_class(cls)
        except Exception:
            pass


def register():
    _register_classes()
    start_server()


def unregister():
    stop_server()
    _unregister_classes()


# Start the server right away at import so the link works even if Blender's
# automatic startup-module register() call does not fire. register() keeps
# this idempotent (start_server() is a no-op when already running).
start_server()
