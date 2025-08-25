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
echo "macOS ARM64 DMG: $(du -h release/TableMoins-${VERSION}-arm64.dmg 2>/dev/null | cut -f1 || echo 'N/A')"
# echo "macOS Intel DMG: $(du -h release/TableMoins-${VERSION}.dmg 2>/dev/null | cut -f1 || echo 'N/A')"
# echo "Windows EXE: $(du -h release/TableMoins*.exe 2>/dev/null | cut -f1 || echo 'N/A')"
# echo "Linux AppImage: $(du -h release/TableMoins*.AppImage 2>/dev/null | cut -f1 || echo 'N/A')"

# Ask for confirmation before creating release
echo ""
read -p "🤔 Create GitHub Release ${TAG}? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Release cancelled"
    exit 0
fi

# Check if tag already exists
if gh release view "${TAG}" &> /dev/null; then
    echo "⚠️ Release ${TAG} already exists!"
    read -p "🤔 Delete existing release and recreate? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️ Deleting existing release..."
        gh release delete "${TAG}" --yes
        git tag -d "${TAG}" 2>/dev/null || true
        git push origin :refs/tags/"${TAG}" 2>/dev/null || true
    else
        echo "❌ Release cancelled"
        exit 0
    fi
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
# - **macOS Intel**: \`TableMoins-${VERSION}.dmg\` 
# - **Windows**: \`TableMoins Setup ${VERSION}.exe\`
# - **Linux**: \`TableMoins-${VERSION}.AppImage\`

### ✨ What's New

See the [CHANGELOG](https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/main/CHANGELOG.md) for detailed changes.

### 🛠️ Installation

**macOS**: 
- Download the appropriate .dmg file for your processor
- Open the .dmg and drag TableMoins to Applications
- **Signed with Apple Developer ID** - no more quarantine issues! 🎉

# **Windows**: 
# - Download and run the .exe installer
# - Choose installation location and follow the wizard

# **Linux**: 
# - Download the .AppImage file
# - Make executable: \`chmod +x TableMoins-${VERSION}.AppImage\`
# - Run: \`./TableMoins-${VERSION}.AppImage\`

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
    release/TableMoins*-arm64-mac.zip
    # release/TableMoins*.exe \
    # release/TableMoins*.AppImage \
    # release/TableMoins*.msi

echo ""
echo "🎉 Release created successfully!"
echo "🔗 View at: https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/tag/${TAG}"
echo ""

# Test the signed macOS app
if [ -d "release/mac-arm64/TableMoins.app" ]; then
    read -p "🧪 Test the signed macOS app? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🚀 Opening TableMoins..."
        open release/mac-arm64/TableMoins.app
    fi
fi

echo "✅ Complete release process finished!"