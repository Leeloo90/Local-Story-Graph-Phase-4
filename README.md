# Story Graph v4.0 - Fractal Narrative Editor

A desktop application for fractal narrative editing with spatial-temporal unified architecture.

## Phase 0: Foundation ✓ COMPLETE

### What's Implemented

- **Electron App Structure**
  - Main/Renderer process separation with secure IPC
  - TypeScript throughout with strict type checking
  - React + Vite for renderer UI
  - Context isolation for security

- **Complete Database Schema (v4.5)**
  - 8 tables: projects, media_library, transcripts, canvases, fractal_containers, story_nodes, multicam_members, project_settings
  - WAL (Write-Ahead Logging) mode for crash recovery
  - Foreign key constraints enforced
  - Indexed fields for 60fps performance
  - Automatic backups every 15 minutes (keeps last 10)
  - Integrity checks on startup

- **IPC Bridge**
  - Secure communication between Main and Renderer
  - All channels defined in `src/shared/types.ts`
  - Project CRUD operations
  - Media import operations (stubs)
  - Canvas management
  - Node operations
  - Backup/restore system

- **Stub Functions**
  - All future features defined in `src/main/stubs/index.ts`
  - FFprobe integration (Phase 2)
  - Anchor-Drift system (Phase 4)
  - Container logic (Phase 5)
  - Timeline operations (Phase 6)
  - Transcript/Word Highlighter (Phase 7)
  - Multicam support (Phase 8)
  - Export/Flattening (Phase 9)

### Project Structure

```
story-graph-app/
├── src/
│   ├── main/              # Electron main process
│   │   ├── database/      # SQLite schema & operations
│   │   ├── ipc/           # IPC handlers
│   │   ├── stubs/         # Stub functions for future phases
│   │   └── index.ts       # Main entry point
│   ├── preload/           # Preload script (IPC bridge)
│   │   └── preload.ts
│   ├── renderer/          # React UI
│   │   └── src/
│   │       ├── App.tsx    # Main app component
│   │       ├── main.tsx   # React entry point
│   │       └── styles/    # CSS files
│   └── shared/            # Shared types
│       └── types.ts       # TypeScript definitions
├── dist/                  # Build output
├── package.json
├── tsconfig.json          # TypeScript config for renderer
├── tsconfig.main.json     # TypeScript config for main
├── tsconfig.node.json     # TypeScript config for Vite
└── vite.config.ts         # Vite configuration
```

### Database Schema

All tables implemented with proper relationships:

1. **projects** - Root container for project metadata
2. **media_library** - Forensic metadata from FFprobe
3. **transcripts** - Word-accurate text with word_map
4. **canvases** - Versioning and narrative paths
5. **fractal_containers** - Acts & Scenes (hierarchical)
6. **story_nodes** - Atomic narrative units
7. **multicam_members** - Multicam source relationships
8. **project_settings** - Environment configurations

### Development

```bash
# Install dependencies
npm install

# Run development mode (builds main, starts Vite + Electron)
npm run dev

# Build for production
npm run build

# Package for distribution
npm run package:mac    # macOS
npm run package:win    # Windows
npm run package:linux  # Linux
```

### Database Location

Databases are stored in:
- **macOS**: `~/Library/Application Support/story-graph-app/databases/`
- **Windows**: `%APPDATA%/story-graph-app/databases/`
- **Linux**: `~/.config/story-graph-app/databases/`

Backups are in the `backups/` subdirectory.

### Tech Stack

- **Electron** v39 - Desktop app framework
- **React** v19 - UI library
- **TypeScript** v5 - Type safety
- **Vite** v7 - Build tool & dev server
- **better-sqlite3** - Native SQLite bindings
- **UUID** - Unique ID generation

### Next Steps: Phase 1 - UI Shell

Build complete visual structure with all components:
- Home screen with project library
- Three-panel dashboard
- Infinite canvas (React Flow)
- Temporal Floor (timeline)
- Floating preview box
- All panels and modals (non-functional)

All UI will be in place before implementing actual functionality.

### Design Language System

Based on "Void" theme:
- Deep blacks (#0A0A0B)
- Vibrant accents (Indigo #6366F1, Purple #A855F7, Cyan #06B6D4)
- Inter/Geist Sans for UI
- JetBrains Mono for timecodes

---

**Status**: Phase 0 Complete ✓
**Database**: Full schema implemented with WAL mode
**IPC**: Secure bridge with all channels defined
**Stubs**: All future features scaffolded
**Ready for**: Phase 1 UI development
