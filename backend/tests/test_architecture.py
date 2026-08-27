import unittest
from pathlib import Path
import sys

from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from config import settings
from main import app


class BoilerplateArchitectureTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.original_api_key = settings.API_KEY
        self.original_cors_origins = settings.CORS_ORIGINS[:]

        settings.API_KEY = "secret-key"
        settings.CORS_ORIGINS = [
            "http://localhost:3020",
            "http://localhost:8082",
            "http://localhost:8062",
        ]

    def tearDown(self):
        settings.API_KEY = self.original_api_key
        settings.CORS_ORIGINS = self.original_cors_origins

    def test_public_routes_remain_available_without_api_key(self):
        response = self.client.get("/health", headers={"host": "localhost"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "healthy")

    def test_prefixed_api_health_route_is_available(self):
        response = self.client.get("/api/health", headers={"host": "localhost"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "healthy")

    def test_host_header_no_longer_bypasses_api_key(self):
        response = self.client.get("/api/version", headers={"host": "localhost"})

        self.assertEqual(response.status_code, 401)

    def test_trusted_browser_origin_bypasses_api_key(self):
        response = self.client.get(
            "/api/version",
            headers={
                "host": "localhost",
                "origin": "http://localhost:3020",
            },
        )

        self.assertEqual(response.status_code, 200)

    def test_external_request_can_use_api_key(self):
        response = self.client.get(
            "/api/version",
            headers={
                "host": "localhost",
                "x-api-key": "secret-key",
            },
        )

        self.assertEqual(response.status_code, 200)

if __name__ == "__main__":
    unittest.main()
