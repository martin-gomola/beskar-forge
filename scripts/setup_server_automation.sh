#!/bin/bash
#
# Server Automation Setup Script
# Run ONCE on your production server to set up automated tasks.
#
# Usage:
#   cd /path/to/project
#   ./scripts/setup_server_automation.sh
#

set -e

echo "=========================================="
echo "Server Automation Setup"
echo "=========================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Project root: $PROJECT_ROOT"
echo ""

# Step 1: Create directories
echo "1. Setting up directories..."
mkdir -p "$PROJECT_ROOT/logs"
mkdir -p "$PROJECT_ROOT/backend/data"
echo "   Done"

# Step 2: Make scripts executable
echo ""
echo "2. Making scripts executable..."
chmod +x "$PROJECT_ROOT/scripts/"*.sh
echo "   Done"

# Step 3: Set up cron job
echo ""
echo "3. Cron job setup"
echo ""

CRON_CMD="30 8 * * * $PROJECT_ROOT/scripts/daily_update.sh >> $PROJECT_ROOT/logs/cron.log 2>&1"

if crontab -l 2>/dev/null | grep -q "daily_update.sh"; then
    echo "   Cron job already exists:"
    crontab -l | grep "daily_update.sh"
    echo ""
    read -p "   Replace it? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        (crontab -l 2>/dev/null | grep -v "daily_update.sh"; echo "$CRON_CMD") | crontab -
        echo "   Cron job updated"
    else
        echo "   Keeping existing cron job"
    fi
else
    (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
    echo "   Cron job added: daily at 8:30 AM"
fi

# Summary
echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  - Logs directory: $PROJECT_ROOT/logs"
echo "  - Scripts executable"
echo "  - Cron job: daily at 8:30 AM"
echo ""
echo "Verify with:"
echo "  crontab -l"
echo "  tail -f logs/cron.log"
echo ""
echo "Test manually:"
echo "  cd $PROJECT_ROOT"
echo "  ./scripts/daily_update.sh"
