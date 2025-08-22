# TableMoins Project - Claude Instructions

## 📋 Project Overview
**TableMoins** is a modern clone of TablePlus for database management, built with Electron + React + TypeScript.

### 🏗️ Architecture
- **Frontend**: React 18 + TypeScript + TailwindCSS
- **Backend**: Electron Main Process + Node.js
- **Database**: SQLite (local storage) + Multiple DB drivers (PostgreSQL, MySQL, SQLite)
- **UI Framework**: Custom components + Ant Design (legacy parts)
- **State Management**: Zustand stores

### 📁 Key File Structure
- `src/renderer/App.tsx` - **MAIN APP FILE** (current UI with connections list)
- `src/renderer/pages/ConnectionsPage.tsx` - Alternative Ant Design page (not used)
- `src/database/connection-service.ts` - Core connection management
- `src/database/storage-service.ts` - Local SQLite operations
- `assets/postgress.jpg` - PostgreSQL logo for UI

### 🎯 Current UI State
- **Active Component**: App.tsx (compact connections list design)
- **Design**: Small cards with logos, double-click to connect, right-click menu
- **Styling**: TailwindCSS, no "Connected" badges, PostgreSQL logo displays
- **Features**: Create/Edit/Delete connections, URL parsing, connection testing

### 🚀 Recent Features Implemented
- **Data Viewer with TablePlus-style Design**: Excel-like tables with borders, zebra striping
- **Structure View with Index Display**: Columns table + Index table (like TablePlus)
- **Cell Editing (Double-click)**: Edit cells in both Data and Structure views
- **TablePlus-style Pagination**: Limit selector, page navigation, first/last page buttons
- **Null Value Display**: "NULL" in gray italics for empty cells
- **Table Tab Management**: Horizontal scrolling tabs with close buttons
- **Database/Schema Selectors**: Integrated labels within borders
- **Search Filter**: Real-time table filtering in database explorer
- **JSON Viewer Modal**: Eye icon for JSONB data with @uiw/react-json-view and search functionality
- **Column Resizing**: Drag and drop column resizing in both Data and Structure views
- **ResizableTable Component**: Reusable table component with resizing and editing capabilities

## 🔧 Development Guidelines
- oublie pas de test a chaque fois ce que tu fais
- Auto-activate relevant personas (frontend, backend, security, etc.)
- Coordinate with MCP servers (Magic for UI, Context7 for patterns, Sequential for complex logic)
- Generate implementation code with best practices
- Apply security and quality validation
- Provide testing recommendations and next steps

### 📊 **IMPORTANT: Table Components**
**ALWAYS use ResizableTable component instead of creating HTML tables!**

- **File**: `src/renderer/components/ui/ResizableTable.tsx`
- **Features**: Column resizing, cell editing, custom rendering, consistent styling
- **Usage**: Used in Data view and Structure view - provides unified table experience
- **Props**: `columns`, `data`, `onCellEdit`, `onCellDoubleClick`, `editingCell`, `maxHeight`
- **Benefits**: DRY principle, consistent UX, easier maintenance, automatic resizing

## Claude Code Integration

- Uses Write/Edit/MultiEdit for code generation and modification
- Leverages Read and Glob for codebase analysis and context understanding
- Applies TodoWrite for implementation progress tracking
- Integrates Task tool for complex multi-step implementations
- Coordinates with MCP servers for specialized functionality
- Auto-activates appropriate personas based on implementation type

## Auto-Activation Patterns

- **Frontend**: UI components, React/Vue/Angular development
- **Backend**: APIs, services, database integration
- **Security**: Authentication, authorization, data protection
- **Architecture**: System design, module structure
- **Performance**: Optimization, scalability considerations

- ne fait pas pkill -f "table-moins|Electron" ca kill vscode sur peux faire un "./killall.sh" pour kill

- tous les textes doivent etre en anglais

- lance les npm run dev en background sinon tu bloque mon frere
- oublie pas de mettre a jour le fichier cahier des charges quand ta fait des trucs
- add some log if you need to debug