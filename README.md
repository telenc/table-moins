# 🗃️ TableMoins

**Modern desktop application for SQL database management**

TableMoins is an open-source clone of TablePlus, developed with Electron, React and TypeScript. It offers an intuitive interface to manage your MySQL and PostgreSQL databases.

## ✨ Features

### 🚀 Current Version (MVP)
- ✅ Modern user interface with Ant Design
- ✅ Electron + React + TypeScript architecture
- ✅ Integrated logging system
- ✅ Theme management (light/dark)
- ✅ ESLint + Prettier configuration

### 🔄 In Development
- 🔌 Database connection management
- 🗂️ Database structure explorer
- 📊 Data viewer with pagination
- ✏️ SQL editor with syntax highlighting
- 🔍 Advanced search and filtering

### 🎯 Roadmap
- 📤 Import/Export (CSV, JSON, SQL)
- 🛡️ Security and connection encryption
- ⚡ Performance optimizations
- 🔌 Extensible plugin system
- 🏢 Enterprise features

## 🛠️ Technologies

- **Desktop Framework**: Electron 28+
- **Frontend**: React 18+ with TypeScript
- **UI Library**: Ant Design
- **State Management**: Zustand
- **Database Drivers**: mysql2, pg, better-sqlite3
- **Build Tool**: Vite
- **Testing**: Jest + Playwright

## 🚀 Installation & Development

### Prerequisites
- Node.js 18+ 
- npm 8+

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd TableMoins

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
```

### Development
```bash
# Start in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Linting and formatting
npm run lint
npm run format
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Development with hot reload |
| `npm run build` | Production build |
| `npm run build:all` | Build + Electron packaging |
| `npm test` | Unit tests |
| `npm test:e2e` | End-to-end tests |
| `npm run lint` | ESLint linting |
| `npm run format` | Prettier formatting |

## 📁 Project Structure

```
src/
├── main/                    # Electron main process
│   ├── main.ts             # Main entry point
│   ├── menu.ts             # Application menu
│   └── ipc-handlers.ts     # IPC handlers
├── renderer/               # Electron renderer process  
│   ├── components/         # React components
│   ├── pages/             # Application pages
│   ├── stores/            # State management (Zustand)
│   ├── styles/            # CSS styles
│   └── main.tsx           # React entry point
├── shared/                # Shared code
│   ├── types/             # TypeScript types
│   ├── constants/         # Constants
│   └── utils/             # Utilities
└── database/              # Database management
    ├── drivers/           # MySQL/PostgreSQL drivers
    └── models/            # Data models
```

## 🎨 User Interface

The interface is built with Ant Design and follows Material Design principles. It includes:

- **Sidebar**: Navigation and connection management
- **Main area**: Data visualization and SQL editor
- **Toolbar**: Quick actions and settings
- **Modular panels**: Resizable and customizable

## 🔒 Security

- AES-256 encryption for passwords
- SSL/TLS support for remote connections
- Strict user input validation
- Audit trail for sensitive actions

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the project
2. Create a branch for your feature
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript conventions
- Write tests for new features  
- Follow established patterns
- Maintain test coverage > 80%

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for more details.

## 🙏 Acknowledgments

Inspired by TablePlus and developed with passion for the open-source community.

---

**Developed with ❤️ by the TableMoins team**