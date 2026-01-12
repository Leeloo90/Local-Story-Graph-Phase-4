# Quick Start Guide - Story Graph v4.0

## Phase 0 Foundation

This is the Phase 0 foundation build - complete database schema with minimal UI.

## Running the App

### First Time Setup (Already Done)

```bash
cd "/Users/lelanie/Documents/App DEVS/Local Story Graph V2/story-graph-app"
npm install
```

### Development Mode

```bash
npm run dev
```

This will:
1. Build the main process (TypeScript → JavaScript)
2. Start Vite dev server (http://localhost:5173)
3. Launch Electron with hot reload

**Dev Tools:** Press `Cmd+Option+I` (Mac) or `Ctrl+Shift+I` (Windows/Linux)

### Production Build

```bash
npm run build
npm start
```

### Package for Distribution

```bash
npm run package:mac     # Creates .dmg for macOS
npm run package:win     # Creates installer for Windows
npm run package:linux   # Creates AppImage for Linux
```

## What You'll See

1. **Home Screen** with "Story Graph v4.0" header
2. **Project list** (empty initially)
3. **"+ New Project" button** - Click to create a test project
4. **Phase 0 checklist** showing what's complete

## Testing the Foundation

### Create a Project

1. Click "**+ New Project**"
2. New project appears in grid
3. Check console (DevTools) for database operations

### Verify Database

```bash
# macOS
open ~/Library/Application\ Support/story-graph-app/databases/

# You'll see: default.db, default.db-wal, default.db-shm
```

### Check Backups

```bash
# Backups auto-create every 15 minutes
ls ~/Library/Application\ Support/story-graph-app/databases/backups/
```

### Inspect Database

```bash
# Install SQLite CLI if needed: brew install sqlite

sqlite3 ~/Library/Application\ Support/story-graph-app/databases/default.db

# In SQLite shell:
.tables                    # List all tables
.schema projects           # See project table schema
SELECT * FROM projects;    # View created projects
.exit
```

## Project Structure Overview

```
src/
├── main/               ← Backend (Node.js)
│   ├── database/       ← SQLite schema & operations
│   ├── ipc/            ← Request handlers
│   ├── stubs/          ← Future features (placeholders)
│   └── index.ts        ← Electron entry point
│
├── preload/            ← Security bridge
│   └── preload.ts      ← Exposes window.electronAPI
│
├── renderer/           ← Frontend (React)
│   └── src/
│       ├── App.tsx     ← Main UI component
│       └── styles/     ← CSS (Void theme)
│
└── shared/             ← Shared code
    └── types.ts        ← TypeScript definitions
```

## Available NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development mode (Vite + Electron) |
| `npm run build` | Production build |
| `npm run build:main` | Build main process only |
| `npm run build:renderer` | Build renderer only |
| `npm start` | Run built app |
| `npm run package` | Package for current platform |

## Database Tables (All Implemented)

1. **projects** - Project metadata
2. **media_library** - Media files + forensic metadata
3. **transcripts** - Dialogue with word_map
4. **canvases** - Multiple narrative versions
5. **fractal_containers** - Acts & Scenes
6. **story_nodes** - Individual clips/elements
7. **multicam_members** - Multicam angle relationships
8. **project_settings** - User preferences

## IPC Channels Available

All accessible via `window.electronAPI` in renderer:

```typescript
// Projects
window.electronAPI.projectCreate({ name: 'My Project', status: 'ACTIVE' })
window.electronAPI.projectList()
window.electronAPI.projectGet(id)
window.electronAPI.projectUpdate(id, { name: 'New Name' })
window.electronAPI.projectDelete(id)

// Media (stubs for now)
window.electronAPI.mediaImport(projectId, filePaths)
window.electronAPI.mediaGetMetadata(filePath)

// Canvases
window.electronAPI.canvasCreate(projectId, canvasData)
window.electronAPI.canvasList(projectId)

// Nodes
window.electronAPI.nodeCreate(nodeData)
window.electronAPI.nodeUpdate(id, updates)
window.electronAPI.nodeDelete(id)
window.electronAPI.nodeList(canvasId)

// Backups
window.electronAPI.backupCreate()
window.electronAPI.backupList()
window.electronAPI.backupRestore(backupPath)
```

## Common Issues & Solutions

### "Cannot find module 'electron'"

```bash
npm install
```

### "Database locked"

Quit the app completely and restart. WAL mode should prevent this.

### Port 5173 already in use

```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

### Build errors

```bash
# Clean and rebuild
rm -rf node_modules dist
npm install
npm run build
```

## What's Next? (Phase 1)

Phase 1 will add the complete UI shell:
- React Flow infinite canvas
- Three-panel dashboard layout
- Timeline view skeleton
- Media library panel
- All navigation and modals

**No real functionality yet** - just visual structure with mock interactions.

## Getting Help

- Check `README.md` for detailed documentation
- See `PHASE_0_COMPLETE.md` for what's implemented
- Refer to `Phase Approach.txt` for the full development plan

---

**Happy Developing! 🚀**

Phase 0 is solid. Database is ready. Time to build the UI!
