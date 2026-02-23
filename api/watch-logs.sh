#!/bin/bash

# Watch both Electron and Browser logs in real-time

LOGS_DIR="$(dirname "$0")/logs"

# Create logs directory if it doesn't exist
mkdir -p "$LOGS_DIR"

# Touch log files to ensure they exist
touch "$LOGS_DIR/electron.log"
touch "$LOGS_DIR/browser.log"

echo "📊 Watching logs from: $LOGS_DIR"
echo "=================================="
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Use tail to watch both files, with color coding
tail -f "$LOGS_DIR/electron.log" "$LOGS_DIR/browser.log" | while IFS= read -r line; do
  if [[ $line == ==>* ]]; then
    # File header from tail -f
    echo -e "\033[1;36m$line\033[0m"
  elif [[ $line == *"[ERROR]"* ]]; then
    # Error lines in red
    echo -e "\033[1;31m$line\033[0m"
  elif [[ $line == *"[WARN]"* ]]; then
    # Warning lines in yellow
    echo -e "\033[1;33m$line\033[0m"
  elif [[ $line == *"electron.log"* ]]; then
    # Electron logs in blue
    echo -e "\033[1;34m[ELECTRON]\033[0m"
  elif [[ $line == *"browser.log"* ]]; then
    # Browser logs in green
    echo -e "\033[1;32m[BROWSER]\033[0m"
  else
    echo "$line"
  fi
done
