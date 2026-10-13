"""Integration tests for Question Paper Alignment Software.

Tests API endpoints and integrated static frontend serving.
"""

import json
import subprocess
import sys
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent


class IntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Start server in background on an isolated test port
        cls.port = 8123
        cls.base_url = f"http://127.0.0.1:{cls.port}"
        cls.proc = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "app.main:app", "--port", str(cls.port)],
            cwd=str(BASE),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        # Wait for server to become responsive
        max_retries = 20
        for _ in range(max_retries):
            try:
                with urllib.request.urlopen(f"{cls.base_url}/health", timeout=1) as resp:
                    if resp.status == 200:
                        break
            except Exception:
                time.sleep(0.3)
        else:
            cls.proc.terminate()
            raise RuntimeError("Test server failed to start within timeout.")

    @classmethod
    def tearDownClass(cls):
        if cls.proc:
            cls.proc.terminate()
            cls.proc.wait()

    def test_health_check(self):
        with urllib.request.urlopen(f"{self.base_url}/health") as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data.get("status"), "ok")

    def test_frontend_index_served(self):
        with urllib.request.urlopen(f"{self.base_url}/") as resp:
            self.assertEqual(resp.status, 200)
            html = resp.read().decode("utf-8")
            self.assertIn("Question Paper Alignment Software", html)
            self.assertIn("pane-editor", html)
            self.assertIn("pane-preview", html)

    def test_frontend_static_assets(self):
        with urllib.request.urlopen(f"{self.base_url}/css/tokens.css") as resp:
            self.assertEqual(resp.status, 200)
            css = resp.read().decode("utf-8")
            self.assertIn(":root", css)

        with urllib.request.urlopen(f"{self.base_url}/js/app.js") as resp:
            self.assertEqual(resp.status, 200)
            js = resp.read().decode("utf-8")
            self.assertIn("ToolbarComponent", js)

    def test_preview_endpoint(self):
        sample_path = BASE / "tests" / "sample_paper.json"
        payload = sample_path.read_bytes()
        req = urllib.request.Request(
            f"{self.base_url}/preview",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            html = resp.read().decode("utf-8")
            self.assertIn("ST JOHN THE BAPTIST", html)
            self.assertIn("Section A", html)

    def test_generate_pdf_endpoint(self):
        sample_path = BASE / "tests" / "sample_paper.json"
        payload = sample_path.read_bytes()
        req = urllib.request.Request(
            f"{self.base_url}/generate",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            self.assertEqual(resp.headers.get_content_type(), "application/pdf")
            pdf_data = resp.read()
            self.assertTrue(pdf_data.startswith(b"%PDF"))

    def test_dev_sample_endpoints(self):
        with urllib.request.urlopen(f"{self.base_url}/dev/sample") as resp:
            self.assertEqual(resp.status, 200)
            html = resp.read().decode("utf-8")
            self.assertIn("ST JOHN THE BAPTIST", html)

        with urllib.request.urlopen(f"{self.base_url}/dev/sample.pdf") as resp:
            self.assertEqual(resp.status, 200)
            pdf_data = resp.read()
            self.assertTrue(pdf_data.startswith(b"%PDF"))


if __name__ == "__main__":
    unittest.main()
