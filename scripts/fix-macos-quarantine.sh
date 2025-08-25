#!/bin/bash

# Fix macOS Gatekeeper quarantine for TableMoins
# Run this script to remove quarantine and allow the app to run

echo "🛡️ Fixing macOS quarantine for TableMoins..."

# Find the app in common locations
POSSIBLE_PATHS=(
    "/Applications/TableMoins.app"
    "~/Applications/TableMoins.app" 
    "~/Downloads/TableMoins.app"
    "./release/mac*/TableMoins.app"
)

APP_PATH=""
for path in "${POSSIBLE_PATHS[@]}"; do
    if [ -d "$path" ]; then
        APP_PATH="$path"
        break
    fi
done

if [ -z "$APP_PATH" ]; then
    echo "❌ TableMoins.app not found. Please specify the path:"
    echo "Usage: $0 /path/to/TableMoins.app"
    exit 1
fi

echo "📍 Found app at: $APP_PATH"

# Remove quarantine attribute
echo "🔓 Removing quarantine attribute..."
sudo xattr -dr com.apple.quarantine "$APP_PATH"

# Verify removal
if xattr -l "$APP_PATH" | grep -q "com.apple.quarantine"; then
    echo "❌ Failed to remove quarantine attribute"
    exit 1
else
    echo "✅ Quarantine attribute removed successfully!"
    echo "🚀 TableMoins should now open without issues"
fi