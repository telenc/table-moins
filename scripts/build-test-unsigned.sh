#!/bin/bash

# TableMoins Build and Test Script (Unsigned for testing)

set -e

echo "🔨 TableMoins Quick Build & Test (Unsigned)"
echo "==========================================="

# Clean and build
echo "🧹 Cleaning previous builds..."
rm -rf release dist

echo "📦 Building ARM64 unsigned..."
npm run build && electron-builder --mac --config.mac.identity=null

# Show results
echo ""
echo "✅ Build completed!"
echo "📁 Generated files:"
ls -lah release/

echo ""
echo "📊 App size:"
if [ -f "release/mac-arm64/TableMoins.app/Contents/Resources/app.asar" ]; then
    echo "app.asar: $(du -h release/mac-arm64/TableMoins.app/Contents/Resources/app.asar | cut -f1)"
fi
echo "Total app: $(du -h release/mac-arm64/TableMoins.app | tail -1 | cut -f1)"

echo ""
read -p "🧪 Test the app? (Y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo "🚀 Opening TableMoins..."
    open release/mac-arm64/TableMoins.app
fi

echo "✅ Build and test completed!"