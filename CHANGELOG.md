# Changelog

All notable changes to TableMoins will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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