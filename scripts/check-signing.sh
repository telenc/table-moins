#!/bin/bash

echo "🔍 Checking code signing setup..."
echo "=================================="

# Check for Developer ID certificates
echo "📝 Available code signing identities:"
security find-identity -v -p codesigning | grep "Developer ID Application" || echo "❌ No Developer ID Application certificates found"

echo ""
echo "📝 All available identities:"
security find-identity -v

echo ""
echo "🧪 Testing electron-builder signing..."
echo "If certificates are available, run: npm run build:mac"