"""DSH 工作区原子归属、命名与路径选择单元测试。"""
import contextlib
import io
import os
import sys
import unittest
from unittest.mock import patch

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))

import dsh_rpc_task as target  # noqa: E402


class DshRpcTaskTests(unittest.TestCase):
    def test_reuses_workspace_from_gateway_and_keeps_custom_auto_name(self):
        result = {"created": False, "workspace": {
            "workspaceId": "workspace-existing", "title": "自定义标题"}}
        with patch.object(target, "create_workspace", return_value=(True, result)), \
                patch.object(target, "rename_workspace") as rename:
            actual = target.ensure_workspace(r"D:\Work\Project\Demo", "Demo")
        self.assertEqual(actual, ("workspace-existing", "自定义标题", False))
        rename.assert_not_called()

    def test_explicit_name_renames_existing_workspace(self):
        result = {"created": False, "workspace": {
            "workspaceId": "workspace-existing", "title": "旧名称"}}
        with patch.object(target, "create_workspace", return_value=(True, result)), \
                patch.object(target, "rename_workspace", return_value=(True, {})) as rename:
            actual = target.ensure_workspace(r"D:\Work\Project\Demo", "新名称", True)
        self.assertEqual(actual, ("workspace-existing", "新名称", False))
        rename.assert_called_once_with("workspace-existing", "新名称")

    def test_auto_name_conflict_gets_stable_path_digest(self):
        result = {"created": True, "workspace": {
            "workspaceId": "workspace-new", "title": "workspace-new"}}
        conflict = (False, {"code": "workspace/name-conflict"})
        with patch.object(target, "create_workspace", return_value=(True, result)), \
                patch.object(target, "rename_workspace", side_effect=[conflict, (True, {})]) as rename:
            actual = target.ensure_workspace(
                r"D:\Work\Project\Demo", "Demo", conflict_fallback=True)
        self.assertRegex(actual[1], r"^Demo · [0-9a-f]{8}$")
        self.assertEqual(rename.call_count, 2)

    def test_explicit_name_conflict_is_rejected(self):
        result = {"created": False, "workspace": {
            "workspaceId": "workspace-existing", "title": "旧名称"}}
        with patch.object(target, "create_workspace", return_value=(True, result)), \
                patch.object(target, "rename_workspace", return_value=(False, {
                    "code": "workspace/name-conflict"})):
            with self.assertRaisesRegex(RuntimeError, "重命名失败"):
                target.ensure_workspace(r"D:\Work\Project\Demo", "产品项目", True)

    def run_main(self, mode):
        logical = r"D:\Work\Project\Demo"
        worktree = r"D:\Runtime\worktrees\task-id"
        argv = [
            "dsh_rpc_task.py", "--workspace", logical, "--run-cwd", worktree,
            "--workspace-name", "Demo", "--task-name", "实现登录功能",
            "--mode", mode, "--timeout", "30", "--prompt", "测试任务"]
        output = io.StringIO()
        expected_path = worktree if mode == "write" else logical
        expected_name = "Demo · 实现登录功能" if mode == "write" else "Demo"
        with patch.object(sys, "argv", argv), \
                patch.object(target, "ensure_workspace", return_value=(
                    "workspace-id", expected_name, mode == "write")) as ensure, \
                patch.object(target, "create_session", return_value=(
                    True, {"sessionId": "session-id"})) as create, \
                patch.object(target, "verify_session_membership", return_value=(True, {
                    "workspace": {"sessionIds": ["session-id"]}})) as verify, \
                patch.object(target, "rename_session", return_value=(True, {})) as rename, \
                patch.object(target, "prompt_session", return_value=(True, {})), \
                patch.object(target, "wait_for_result"), \
                contextlib.redirect_stdout(output):
            target.main()
        ensure.assert_called_once_with(
            expected_path, expected_name, rename_existing=mode == "write",
            conflict_fallback=True)
        create.assert_called_once_with(workspace_id="workspace-id", preset="standard")
        verify.assert_called_once_with("workspace-id", "session-id")
        rename.assert_called_once_with("session-id", "实现登录功能")
        return output.getvalue()

    def test_analysis_session_is_atomically_created_in_logical_workspace(self):
        output = self.run_main("analysis")
        self.assertIn('"workspaceKind": "logical"', output)
        self.assertIn(r'"workspacePath": "D:\\Work\\Project\\Demo"', output)

    def test_write_session_is_atomically_created_in_worktree_workspace(self):
        output = self.run_main("write")
        self.assertIn('"workspaceName": "Demo · 实现登录功能"', output)
        self.assertIn('"workspaceKind": "worktree"', output)
        self.assertIn('"workspaceCreated": true', output)

    def test_projection_verification_failure_stops_before_prompt(self):
        argv = ["dsh_rpc_task.py", "--workspace", r"D:\Demo", "--run-cwd", r"D:\Demo",
                "--workspace-name", "Demo", "--task-name", "检查", "--mode", "analysis",
                "--timeout", "30", "--prompt", "测试任务"]
        with patch.object(sys, "argv", argv), \
                patch.object(target, "ensure_workspace", return_value=("workspace-id", "Demo", False)), \
                patch.object(target, "create_session", return_value=(True, {"sessionId": "session-id"})), \
                patch.object(target, "verify_session_membership", return_value=(True, {
                    "workspace": {"sessionIds": []}})), \
                patch.object(target, "rename_session") as rename, \
                patch.object(target, "prompt_session") as prompt:
            with self.assertRaisesRegex(RuntimeError, "投影未包含"):
                target.main()
        rename.assert_not_called()
        prompt.assert_not_called()


if __name__ == "__main__":
    unittest.main()
