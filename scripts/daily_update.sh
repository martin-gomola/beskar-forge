#!/bin/bash
#
# Daily Update Script (cron wrapper)
#
# Runs OUTSIDE Docker. Add your daily tasks here
# (e.g., data fetching, cache warming, cleanup).
#
# Setup cron:
#   crontab -e
#   30 8 * * * /path/to/project/scripts/daily_update.sh >> /path/to/project/logs/cron.log 2>&1
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "Daily Update - $(date)"
echo "=========================================="
echo ""
echo "Project root: $PROJECT_ROOT"
echo ""

cd "$PROJECT_ROOT"

# ── Add your daily tasks below ───────────────────────────
# Example: python3 scripts/update_data.py
# Example: curl -s http://localhost:8065/api/some-task

echo "No daily tasks configured yet."
echo "Edit scripts/daily_update.sh to add your tasks."

echo ""
echo "=========================================="
echo "Daily update complete - $(date)"
echo "=========================================="
