"""Offline tests for the post-Pages-deployment verification gate."""
import importlib.util
import io
import json
import pathlib
import unittest
from unittest.mock import patch

path = pathlib.Path(__file__).with_name("wait-pages-deployment.py")
spec = importlib.util.spec_from_file_location("tem_postdeploy_gate", path)
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)

SHA = "68135ed90f97b1cd8e27fac700481369d19e2210"

def payload(*runs):
    return io.BytesIO(json.dumps({"workflow_runs": list(runs)}).encode())

def pages(sha=SHA, status="completed", conclusion="success", id=7):
    return {
        "name": "pages build and deployment",
        "head_sha": sha,
        "status": status,
        "conclusion": conclusion,
        "created_at": "2026-11-06T20:52:38Z",
        "id": id,
    }

class PostDeploymentGateTests(unittest.TestCase):
    def test_selects_exact_commit_not_stale_deployment(self):
        result=gate.get_pages_run([
            pages(sha="e"*40, id=91),pages(status="in_progress",conclusion=None,id=8),
            {"name":"Museum 3D checks", "head_sha":SHA,"id":99}
        ], SHA)
        self.assertEqual(result["id"],8)
    def test_accepts_only_successfully_deployed_revision(self):
        with patch.object(gate.urllib.request, "urlopen",return_value=payload(pages())):
            self.assertTrue(gate.wait_for_pages("GboStudio/gbostudio",SHA,timeout=5,pause=0))
    def test_rejects_failed_pages_build(self):
        with patch.object(gate.urllib.request, "urlopen",return_value=payload(pages(conclusion="failure"))):
            with self.assertRaisesRegex(RuntimeError,"deployment failed"):
                gate.wait_for_pages("GboStudio/gbostudio",SHA,timeout=5,pause=0)
    def test_requires_full_commit_sha(self):
        with self.assertRaises(ValueError):
            gate.wait_for_pages("GboStudio/gbostudio","abc",timeout=1)

if __name__=="__main__":
    unittest.main()
