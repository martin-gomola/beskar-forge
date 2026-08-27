import os
from pathlib import Path
import subprocess
import sys
import unittest


BACKEND_ROOT = Path(__file__).resolve().parents[1]


class SettingsContractTests(unittest.TestCase):
    def run_settings_probe(self, **environment: str) -> subprocess.CompletedProcess[str]:
        probe_environment = os.environ.copy()
        probe_environment.update(environment)
        return subprocess.run(
            [
                sys.executable,
                "-c",
                "from config.settings import settings; print(settings.API_PREFIX, settings.LOG_LEVEL)",
            ],
            cwd=BACKEND_ROOT,
            env=probe_environment,
            check=False,
            capture_output=True,
            text=True,
        )

    def test_api_prefix_is_fixed_even_when_environment_attempts_override(self):
        result = self.run_settings_probe(API_PREFIX="/v1")

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip().split()[0], "/api")

    def test_log_level_is_normalized(self):
        result = self.run_settings_probe(LOG_LEVEL="warning")

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip().split()[1], "WARNING")

    def test_invalid_log_level_is_rejected(self):
        result = self.run_settings_probe(LOG_LEVEL="verbose")

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("LOG_LEVEL must be one of", result.stderr)


if __name__ == "__main__":
    unittest.main()
