import tempfile
import unittest
from pathlib import Path
import sys

from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from config import settings
from main import app


class FieldNotesSyncTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_db_path = settings.FIELD_NOTES_DB_PATH
        self.original_api_key = settings.API_KEY
        settings.FIELD_NOTES_DB_PATH = str(Path(self.temp_dir.name) / "field_notes.db")
        settings.API_KEY = None
        self.client = TestClient(app)

    def tearDown(self):
        settings.FIELD_NOTES_DB_PATH = self.original_db_path
        settings.API_KEY = self.original_api_key
        self.temp_dir.cleanup()

    def sync(self, payload):
        response = self.client.post(
            "/api/field-notes/sync",
            json=payload,
            headers={"host": "localhost"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_upsert_is_persisted_and_retry_is_idempotent(self):
        payload = {
            "device_id": "device-a",
            "cursor": 0,
            "mutations": [
                {
                    "mutation_id": "mutation-1",
                    "note_id": "note-1",
                    "operation": "upsert",
                    "title": "Gate inspection",
                    "details": "North hinge needs oil.",
                    "client_updated_at": "2026-08-28T09:00:00+00:00",
                }
            ],
        }

        first = self.sync(payload)
        retry = self.sync(payload)

        self.assertEqual(first["applied_mutation_ids"], ["mutation-1"])
        self.assertEqual(first["records"][0]["title"], "Gate inspection")
        self.assertGreater(first["next_cursor"], 0)
        self.assertEqual(retry["duplicate_mutation_ids"], ["mutation-1"])

    def test_stale_update_returns_a_conflict_with_server_copy(self):
        self.sync(
            {
                "device_id": "device-a",
                "mutations": [
                    {
                        "mutation_id": "mutation-1",
                        "note_id": "note-1",
                        "operation": "upsert",
                        "title": "Original",
                        "details": "First observation.",
                        "client_updated_at": "2026-08-28T09:00:00+00:00",
                    }
                ],
            }
        )
        self.sync(
            {
                "device_id": "device-b",
                "mutations": [
                    {
                        "mutation_id": "mutation-2",
                        "note_id": "note-1",
                        "operation": "upsert",
                        "title": "Updated by another device",
                        "details": "Second observation.",
                        "base_version": 1,
                        "client_updated_at": "2026-08-28T09:01:00+00:00",
                    }
                ],
            }
        )

        conflict = self.sync(
            {
                "device_id": "device-a",
                "mutations": [
                    {
                        "mutation_id": "mutation-3",
                        "note_id": "note-1",
                        "operation": "upsert",
                        "title": "Edited offline",
                        "details": "Offline edit.",
                        "base_version": 1,
                        "client_updated_at": "2026-08-28T09:02:00+00:00",
                    }
                ],
            }
        )

        self.assertEqual(conflict["conflicts"][0]["mutation_id"], "mutation-3")
        self.assertEqual(conflict["conflicts"][0]["note"]["version"], 2)
        self.assertEqual(
            conflict["conflicts"][0]["note"]["title"],
            "Updated by another device",
        )

    def test_pull_returns_tombstones_for_deleted_notes(self):
        created = self.sync(
            {
                "device_id": "device-a",
                "mutations": [
                    {
                        "mutation_id": "mutation-1",
                        "note_id": "note-1",
                        "operation": "upsert",
                        "title": "To remove",
                        "details": "Temporary note.",
                        "client_updated_at": "2026-08-28T09:00:00+00:00",
                    }
                ],
            }
        )
        deleted = self.sync(
            {
                "device_id": "device-a",
                "cursor": created["next_cursor"],
                "mutations": [
                    {
                        "mutation_id": "mutation-2",
                        "note_id": "note-1",
                        "operation": "delete",
                        "base_version": 1,
                        "client_updated_at": "2026-08-28T09:01:00+00:00",
                    }
                ],
            }
        )

        self.assertEqual(len(deleted["records"]), 1)
        self.assertIsNotNone(deleted["records"][0]["deleted_at"])


if __name__ == "__main__":
    unittest.main()
