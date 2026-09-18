"""DSH worktree 工作区释放流程单元测试。"""
import os
import sys
import unittest
from unittest.mock import patch

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))

import dsh_rpc_release as target  # noqa: E402


class DshRpcReleaseTests(unittest.TestCase):
    def argv(self):
        return ["dsh_rpc_release.py", "--workspace-id", "workspace-id",
                "--session-id", "session-id"]

    def test_archives_session_then_deletes_workspace(self):
        order = []
        with patch.object(sys, "argv", self.argv()), \
                patch.object(target, "archive_session", side_effect=lambda value: (
                    order.append(("archive", value)) or (True, {}))), \
                patch.object(target, "delete_workspace", side_effect=lambda value: (
                    order.append(("delete", value)) or (True, {}))):
            target.main()
        self.assertEqual(order, [("archive", "session-id"), ("delete", "workspace-id")])

    def test_missing_workspace_is_idempotent(self):
        with patch.object(sys, "argv", self.argv()), \
                patch.object(target, "archive_session", return_value=(True, {})), \
                patch.object(target, "delete_workspace", return_value=(False, {
                    "code": "workspace/not-found"})):
            target.main()

    def test_archive_failure_preserves_workspace(self):
        with patch.object(sys, "argv", self.argv()), \
                patch.object(target, "archive_session", return_value=(False, {
                    "code": "gateway/offline"})), \
                patch.object(target, "delete_workspace") as delete:
            with self.assertRaisesRegex(RuntimeError, "会话归档失败"):
                target.main()
        delete.assert_not_called()


if __name__ == "__main__":
    unittest.main()
