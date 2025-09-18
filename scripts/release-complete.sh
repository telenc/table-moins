#!/bin/bash

# TableMoins Complete Release Script
# Builds locally with signing and uploads to GitHub Releases

set -e  # Exit on any error

echo "🚀 TableMoins Complete Release Script"
echo "====================================="

# Configuration
REPO_OWNER="telenc"
REPO_NAME="table-moins"
VERSION=$(node -p "require('./package.json').version")
TAG="v${VERSION}"

echo "📋 Release Information:"
echo "  Version: ${VERSION}"
echo "  Tag: ${TAG}"
echo "  Repository: ${REPO_OWNER}/${REPO_NAME}"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from project root directory"
    exit 1
fi

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
    echo "❌ Error: GitHub CLI (gh) is not installed"
    echo "Install with: brew install gh"
    exit 1
fi

# Check if user is authenticated with gh
if ! gh auth status &> /dev/null; then
    echo "🔐 Authenticating with GitHub..."
    gh auth login
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf release dist

# Build all platforms
echo "🔨 Building all platforms..."
echo ""

echo "📦 Building Renderer..."
npm run build:renderer

echo "📦 Building Main Process..."
npm run build:main

echo "📦 Building macOS ARM64 (with signing)..."
npm run build:mac

# echo "📦 Building Windows..."
# npm run build:win

# echo "📦 Building Linux..."
# npm run build:linux

echo ""
echo "✅ All builds completed successfully!"

# List generated files
echo "📁 Generated files:"
ls -lah release/

echo ""
echo "📊 File sizes:"
echo "macOS ARM64 App: $(du -sh release/mac-arm64/TableMoins.app 2>/dev/null | cut -f1 || echo 'N/A')"
# echo "macOS Intel DMG: $(du -h release/TableMoins-${VERSION}.dmg 2>/dev/null | cut -f1 || echo 'N/A')"
# echo "Windows EXE: $(du -h release/TableMoins*.exe 2>/dev/null | cut -f1 || echo 'N/A')"
# echo "Linux AppImage: $(du -h release/TableMoins*.AppImage 2>/dev/null | cut -f1 || echo 'N/A')"

# Use predefined changelog for this release
echo ""
echo "📝 Using changelog for version ${VERSION}:"

CHANGELOG="- 🚀 Redis Integration Foundation: Initial Redis driver implementation with connection support\n- 📊 Redis Data Models: Complete TypeScript interfaces for Redis connections, keys, and values\n- 🏗️ Dual Driver Architecture: Extended database driver system to support both SQL and NoSQL paradigms\n- 🎨 ResizablePanels Component: New UI component for flexible panel layouts\n- 📋 Redis Development Plan: Comprehensive 18-25 week roadmap for full Redis support\n- 🔧 Enhanced Type System: Extended DatabaseType to include Redis connections"

echo ""
echo "📋 Changelog:"
echo -e "$CHANGELOG"
echo ""

# Automatically proceed with release creation
echo "📋 Proceeding with GitHub Release ${TAG}..."
echo ""

# Check if tag already exists and delete automatically
if gh release view "${TAG}" &> /dev/null; then
    echo "⚠️ Release ${TAG} already exists! Deleting and recreating..."
    gh release delete "${TAG}" --yes
    git tag -d "${TAG}" 2>/dev/null || true
    git push origin :refs/tags/"${TAG}" 2>/dev/null || true
fi

# Create and push tag
echo "🏷️ Creating and pushing tag ${TAG}..."
git tag "${TAG}"
git push origin "${TAG}"

# Create GitHub Release
echo "🎉 Creating GitHub Release..."

# Generate release notes
RELEASE_NOTES=$(cat <<EOF
## 📦 TableMoins ${VERSION}

Modern desktop application for SQL database management - TablePlus clone

### 📥 Downloads

Choose the appropriate file for your operating system:

- **macOS Apple Silicon**: \`TableMoins-${VERSION}-arm64.dmg\`

### ✨ What's New

${CHANGELOG}

---

_See the [full changelog](https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/main/CHANGELOG.md) for all changes._

### 🛠️ Installation

**macOS**: 
- Download the appropriate .dmg file for your processor
- Open the .dmg and drag TableMoins to Applications
- **Signed with Apple Developer ID** - no more quarantine issues! 🎉

### 🔐 Security

- macOS builds are signed with Apple Developer ID certificate
- All builds include AES-256 encryption for stored passwords
- No telemetry or data collection

---

**Developed with ❤️ by the Rémi Telenczak team**
EOF
)

# Create the release
gh release create "${TAG}" \
    --title "📦 TableMoins ${VERSION}" \
    --notes "${RELEASE_NOTES}" \
    release/TableMoins-${VERSION}-arm64.dmg \
    release/TableMoins*-arm64-mac.zip \
    release/latest-mac.yml
    # release/TableMoins*.exe \
    # release/TableMoins*.AppImage \
    # release/TableMoins*.msi

echo ""
echo "🎉 Release created successfully!"
echo "🔗 View at: https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/tag/${TAG}"
echo ""


echo "✅ Complete release process finished!"