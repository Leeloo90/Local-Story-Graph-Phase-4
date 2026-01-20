# Phase 8: Multicam Support - COMPLETE

## Overview
Phase 8 implements multicam clip management, allowing users to import multicam clips from FCPXML files and switch between camera angles within story nodes.

## Implemented Features

### 1. Multicam Service (`src/main/services/multicamService.ts`)
- **XML Parsing**: `parseMulticamXml()` parses FCPXML v1.10 multicam definitions
- **Angle Management**: `getMulticamAngles()` retrieves all angles for a multicam clip
- **Angle Switching**: `setActiveAngle()` sets the active camera angle for a node
- **Manual Creation**: `createMulticamFromAssets()` creates multicam from selected media

### 2. IPC Handlers
- `multicam:import-xml` - Import multicam clips from FCPXML file
- `multicam:get-members` - Get all angle members for a multicam clip
- `node:set-angle` - Set the active angle for a multicam node

### 3. Preload Bridge
- `multicamImportXml(filePath)` - Import FCPXML
- `multicamGetMembers(multicamMediaId)` - Get angles
- `nodeSetAngle(nodeId, memberMediaId)` - Switch angle

### 4. Database Schema
```sql
CREATE TABLE multicam_members (
  multicam_media_id TEXT NOT NULL,
  member_media_id TEXT NOT NULL,
  angle_label TEXT NOT NULL,
  sync_offset REAL DEFAULT 0,
  audio_channel_map TEXT,
  PRIMARY KEY (multicam_media_id, member_media_id),
  FOREIGN KEY(multicam_media_id) REFERENCES media_library(id) ON DELETE CASCADE,
  FOREIGN KEY(member_media_id) REFERENCES media_library(id)
);
```

## FCPXML Structure Supported
```xml
<fcpxml version="1.10">
  <resources>
    <media id="r1" name="Interview Multicam">
      <multicam>
        <mc-angle name="Wide" ref="r2"/>
        <mc-angle name="Close Up" ref="r3"/>
      </multicam>
    </media>
    <asset id="r2" src="file:///path/to/wide.mov"/>
    <asset id="r3" src="file:///path/to/closeup.mov"/>
  </resources>
</fcpxml>
```

## Usage

### Importing Multicam from FCPXML
```typescript
const result = await window.electronAPI.multicamImportXml('/path/to/export.fcpxml');
// Creates virtual MULTICAM asset with angle members
```

### Getting Multicam Angles
```typescript
const angles = await window.electronAPI.multicamGetMembers(multicamMediaId);
// Returns: [{ member_media_id, angle_label, sync_offset, file_path, clean_name }]
```

### Switching Active Angle
```typescript
await window.electronAPI.nodeSetAngle(nodeId, selectedAngleMediaId);
// Updates node's internal_state.active_angle
```

### Creating Multicam Manually
```typescript
// From the service directly (not exposed via IPC yet)
const multicamId = createMulticamFromAssets(db, projectId, 'My Multicam', [
  { mediaId: 'asset1', label: 'Wide Shot' },
  { mediaId: 'asset2', label: 'Close Up' },
]);
```

## Files Modified/Created

### Services
- `src/main/services/multicamService.ts` - Full implementation (was stub)

### IPC
- `src/main/ipc/handlers.ts` - Multicam handlers existed
- `src/preload/preload.ts` - Added multicam bridge methods

### Components (Pre-existing)
- `src/renderer/src/components/nodes/MulticamNode.tsx` - Multicam node display
- `src/renderer/src/components/inspector/MulticamAnglesPanel.tsx` - Angle selection UI

## Node Internal State
```typescript
interface MulticamNodeState {
  active_angle: string;  // member_media_id of currently selected angle
}
```

## Future Enhancements
- Sync point adjustment UI
- Audio channel mapping interface
- Multicam creation wizard in UI
- FCP7 XML format support
- Sync by timecode/audio waveform

## Testing Checklist
- [ ] Import FCPXML with multicam clips
- [ ] View multicam angles in inspector
- [ ] Switch between angles
- [ ] Verify angle persists after reload
- [ ] Create multicam from selected media

## Next Phase
Phase 9: FCPXML Export & History - Export story graph to FCPXML and implement undo/redo.
