#!/bin/bash

# TableMoins Build and Test Script
# Quick build and test without uploading

set -e

echo "🔨 TableMoins Quick Build & Test"
echo "================================="

# Clean and build
echo "🧹 Cleaning previous builds..."
rm -rf release dist

echo "📦 Building..."
npm run build:mac

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

# Test signature
echo ""
echo "🔐 Checking signature..."
codesign -dv --verbose=4 release/mac-arm64/TableMoins.app 2>&1 | head -5

echo ""
read -p "🧪 Test the app? (Y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo "🚀 Opening TableMoins..."
    open release/mac-arm64/TableMoins.app
fi

echo "✅ Build and test completed!"