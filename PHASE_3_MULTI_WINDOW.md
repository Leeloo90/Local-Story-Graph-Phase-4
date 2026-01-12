# Phase 3: Multi-Window Undocking System

**Status:** Planned for future implementation
**Estimated Effort:** 2-3 days
**Prerequisites:** Phase 0, Phase 1, Phase 2 complete

## Overview

Implement Adobe Premiere Pro-style panel undocking where panels, the Bucket, and Preview window can be detached into separate Electron windows, supporting multi-monitor workflows.

---

## Architecture Components

### 1. Main Process (Electron) - Window Management

#### `src/main/windows/WindowManager.ts`
Centralized window manager tracking all open windows:
- Main application window
- Undocked panel windows (Media Library, Inspector)
- Undocked Bucket window
- Undocked Preview window
- Window restoration on app restart
- Multi-monitor position tracking

**Key Methods:**
```typescript
class WindowManager {
  createUndockedPanel(panelType: 'media-library' | 'inspector'): BrowserWindow
  createUndockedBucket(): BrowserWindow
  createUndockedPreview(): BrowserWindow
  dockWindow(windowId: string): void
  saveLayoutState(): void
  restoreLayoutState(): void
  getWindowByType(type: string): BrowserWindow | null
}
```

#### `src/main/windows/UndockedPanelWindow.ts`
Panel-specific window configuration:
- Window dimensions: 320x800 (Media Library), 380x800 (Inspector)
- Frame: false (for custom title bar)
- Always on top: optional
- Parent: main window (for proper minimize/close behavior)

#### `src/main/windows/UndockedBucketWindow.ts`
Bucket-specific window:
- Dimensions: 300x600
- Transparent background support
- Canvas-like interaction area

#### `src/main/windows/UndockedPreviewWindow.ts`
Preview window configuration:
- Dimensions: Aspect ratio locked (16:9)
- Playback controls
- Timecode display

---

### 2. IPC Communication Layer

#### `src/main/ipc/window-handlers.ts`
IPC handlers for window operations:

**Events:**
- `window:undock-panel` - Create undocked panel window
- `window:dock-panel` - Close undocked window, restore to main
- `window:undock-bucket` - Create undocked bucket window
- `window:dock-bucket` - Restore bucket to canvas
- `window:undock-preview` - Create undocked preview window
- `window:dock-preview` - Restore preview to canvas
- `window:save-layout` - Persist current window arrangement
- `window:restore-layout` - Load saved layout on app start

**State Sync Events:**
- `state:panel-data` - Sync panel content across windows
- `state:bucket-items` - Sync bucket contents
- `state:playback` - Sync preview playback state

---

### 3. Renderer Process - Undocked Windows

#### `src/renderer/src/windows/UndockedPanel.tsx`
Standalone panel renderer:
```typescript
<UndockedPanel type={panelType}>
  {type === 'media-library' ? <MediaLibraryPanel /> : <InspectorPanel />}
</UndockedPanel>
```

Features:
- Custom title bar with dock button
- Close button triggers `window:dock-panel`
- Always-on-top toggle

#### `src/renderer/src/windows/UndockedBucket.tsx`
Standalone Bucket renderer:
- Full Bucket functionality
- Right-click menu: "Dock to Canvas", "Clear Bucket"
- Drag-and-drop support to/from main window

#### `src/renderer/src/windows/UndockedPreview.tsx`
Standalone Preview renderer:
- Video preview with playback controls
- Timecode scrubber
- Settings (proxy mode, aspect ratio)

---

### 4. State Management & Synchronization

#### `src/renderer/src/context/WindowContext.tsx`
Cross-window state synchronization:
```typescript
interface WindowState {
  undockedPanels: Set<'media-library' | 'inspector'>
  bucketUndocked: boolean
  previewUndocked: boolean
  bucketItems: string[]
  playbackState: {
    playing: boolean
    timecode: string
    frame: number
  }
}
```

**Sync Mechanism:**
- Main window = source of truth
- Undocked windows subscribe to state updates via IPC
- Broadcast state changes to all windows
- Debounced updates (60fps max for playback)

#### `src/renderer/src/hooks/useWindowSync.ts`
Custom hook for state synchronization:
```typescript
const { syncState, subscribeToState } = useWindowSync('panel-data')
```

---

### 5. UI Integration

#### Canvas View Changes
Add right-click context menu to Bucket node:
```typescript
<ContextMenu>
  <MenuItem onClick={handleUndock}>Undock to Window</MenuItem>
  <MenuItem onClick={handleClear}>Clear Bucket</MenuItem>
</ContextMenu>
```

#### Preview Window Changes
Add undock button to floating preview header:
```typescript
<button onClick={() => window.electronAPI.undockPreview()}>
  <ExternalLink size={14} /> Undock
</button>
```

#### Panel Header Changes
Add undock button next to collapse:
```typescript
<button onClick={() => window.electronAPI.undockPanel(panelType)}>
  <ExternalLink size={14} /> Undock
</button>
```

---

### 6. Persistent Layout System

#### `src/main/state/LayoutManager.ts`
Save/restore window positions:

**Storage:**
- SQLite `project_settings` table
- JSON field: `window_layout`

**Layout Data:**
```json
{
  "undockedPanels": {
    "media-library": {
      "x": 100,
      "y": 100,
      "width": 320,
      "height": 800,
      "display": 1
    }
  },
  "undockedBucket": {
    "x": 500,
    "y": 200,
    "width": 300,
    "height": 600,
    "display": 2
  },
  "panelPositions": {
    "left": "inspector",
    "right": "media-library"
  }
}
```

**Auto-save triggers:**
- Window move
- Window resize
- Panel dock/undock
- App close

---

### 7. Multi-Monitor Support

**Features:**
- Detect all connected displays
- Remember which display each window was on
- Gracefully handle display disconnect (move to primary)
- Snap to screen edges

**Implementation:**
```typescript
const displays = screen.getAllDisplays()
const windowDisplay = screen.getDisplayNearestPoint({ x, y })
```

---

## Implementation Checklist

### Phase 3.1: Window Management Foundation
- [ ] Create WindowManager class
- [ ] Implement basic undock/dock for Media Library
- [ ] Add IPC handlers for window operations
- [ ] Test single panel undock/dock cycle

### Phase 3.2: State Synchronization
- [ ] Build WindowContext for cross-window state
- [ ] Implement useWindowSync hook
- [ ] Test state sync between main and undocked panel
- [ ] Add debouncing for high-frequency updates

### Phase 3.3: All Windows Support
- [ ] Implement Inspector panel undock
- [ ] Implement Bucket undock with right-click menu
- [ ] Implement Preview undock
- [ ] Test all windows undocked simultaneously

### Phase 3.4: Persistent Layouts
- [ ] Build LayoutManager for save/restore
- [ ] Integrate with project_settings table
- [ ] Test layout restoration on app restart
- [ ] Handle edge cases (missing displays, invalid positions)

### Phase 3.5: Polish & Testing
- [ ] Multi-monitor testing
- [ ] Window minimize/maximize behavior
- [ ] Parent-child window relationships
- [ ] Memory leak testing
- [ ] Performance optimization

---

## Technical Challenges

1. **IPC Performance:** High-frequency state sync (playback) needs careful optimization
2. **Window Lifecycle:** Proper cleanup when windows close unexpectedly
3. **Multi-Monitor:** Handling display disconnect/reconnect scenarios
4. **State Consistency:** Ensuring all windows show same data
5. **Build Configuration:** Vite multi-entry setup for undocked windows

---

## Files to Create/Modify

**New Files:** ~14
**Modified Files:** ~6
**Estimated LOC:** ~2000

**Effort Breakdown:**
- Window management: 6-8 hours
- IPC layer: 3-4 hours
- State sync: 4-6 hours
- Persistent layouts: 3-4 hours
- Testing & polish: 4-6 hours

**Total:** 20-28 hours (2.5-3.5 days)

---

## Phase 3 Success Criteria

✅ User can right-click Bucket → "Undock to Window"
✅ Bucket opens in separate window, remains functional
✅ User can dock Bucket back to canvas
✅ User can undock Media Library and Inspector panels
✅ Panel content stays synchronized across windows
✅ Preview window can be undocked with working playback
✅ Window positions persist across app restarts
✅ Multi-monitor support works correctly
✅ No memory leaks with repeated undock/dock cycles
✅ Graceful degradation if saved layout is invalid

---

## Dependencies

**npm packages (already installed):**
- electron (multi-window support)
- better-sqlite3 (layout persistence)

**No additional dependencies needed.**

---

## Future Enhancements (Phase 4+)

- Custom window chrome (frameless with custom title bar)
- Tabbed undocked panels (multiple panels in one window)
- Workspace presets (save/load entire layouts)
- Touch Bar support (macOS)
- Picture-in-Picture mode for preview
