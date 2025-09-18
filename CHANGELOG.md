# Changelog

All notable changes to TableMoins will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2025-01-15

### Added
- **🚀 Redis Integration Foundation**: Initial Redis driver implementation with connection support
- **📊 Redis Data Models**: Complete TypeScript interfaces for Redis connections, keys, and values
- **🏗️ Dual Driver Architecture**: Extended database driver system to support both SQL and NoSQL paradigms
- **🎨 ResizablePanels Component**: New UI component for flexible panel layouts
- **📋 Redis Development Plan**: Comprehensive 18-25 week roadmap for full Redis support
- **🔧 Enhanced Type System**: Extended DatabaseType to include Redis connections
- **📦 Redis Dependencies**: Added redis package and types for Node.js Redis client

### Technical
- Implemented `RedisDriver` class with basic connection and command execution
- Created Redis-specific interfaces (`RedisConnection`, `RedisKeyInfo`, `RedisValueInfo`)
- Enhanced connection factory to handle Redis connections
- Added Redis branding assets (icons and logos)
- Extended IPC handlers for Redis-specific operations
- Updated connection form to support Redis connection parameters

### Infrastructure
- Added comprehensive unit test structure for Redis driver
- Created Redis integration plan with detailed technical specifications
- Enhanced project documentation for multi-database support

## [0.2.5] - 2025-09-03

### Added
- **Keyboard shortcuts**: Cmd+W now closes table tabs (not connection), Cmd+F opens filter panel
- **Enhanced filter operators**: Added TablePlus-style operators (BETWEEN, ILIKE, Contains, Has prefix/suffix, case-insensitive variants)
- **Improved filter UI**: Filter operators now display as symbols (=, !=, >, <, etc.) instead of text labels
- **Filter reliability**: Apply button now always reloads data, even without filter changes

### Fixed
- **macOS behavior**: Cmd+W properly closes table tabs instead of entire application
- **Filter panel**: Filters now consistently reload data when applied
- **Table tab management**: Better handling of active table tab closure

### Changed
- **Filter operators**: Simplified display with SQL symbols for better clarity
- **Keyboard navigation**: More intuitive shortcuts aligned with standard applications

## [0.2.4] - 2025-08-28

### Added
- Enter key support in filter panel for quick filter application
- Multiple tabs can now be opened for the same table
- Interactive changelog input in release script
- Tooltip component for better UX

### Fixed
- Filter sharing issue between tabs - each tab now maintains independent filters
- Tab management improved to allow multiple instances of same table

### Changed
- Enhanced tab management system with unique tab IDs
- Improved release automation with automatic GitHub release creation

## [0.2.3] - Previous Release

### Added
- Multi-platform CI/CD with GitHub Actions
- Professional GitHub Releases with downloadable assets
- French to English translation of all user-facing text
- Icon generation from logo for all platforms (.icns, .ico, .png)
- ESLint warning fixes for cleaner codebase

### Changed
- Improved CI reliability with retry mechanisms for npm install failures
- Simplified Linux build to AppImage only for faster CI

### Fixed
- better-sqlite3 ARM64 compatibility issues
- ESLint warnings in main components and services

## [0.1.0] - TBD

### Added
- Initial MVP release
- Modern Electron + React + TypeScript architecture
- Database connection management (PostgreSQL, MySQL, SQLite)
- TablePlus-style data viewer with pagination
- SQL editor with syntax highlighting
- Database structure explorer
- Cell editing with double-click
- JSON viewer for JSONB data
- Column resizing in data tables
- Connection testing and URL parsing
- AES-256 encryption for stored passwords
- Comprehensive logging system
- Theme support (light/dark)

### Technical
- Electron 28+ framework
- React 18 with TypeScript
- TailwindCSS for styling
- Zustand for state management
- Ant Design components (legacy parts)
- Better SQLite3 for local storage
- Jest + Playwright for testing
- ESLint + Prettier for code quality