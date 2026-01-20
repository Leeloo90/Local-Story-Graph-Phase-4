# Phase 6: Timeline View - COMPLETE

## Overview
Phase 6 connects the Timeline View to the actual story graph data, providing a linear representation of the canvas for temporal editing and playback preview.

## Implemented Features

### 1. Data Integration
- Timeline loads story nodes from canvas via IPC
- Converts graph positions to timeline positions
- Maps node types to timeline tracks (Spine → V1, Satellite → V2/V3)
- Asset names displayed on clips
- Clip duration calculated from clip_in/clip_out

### 2. Timeline Tracks
- V1 (Spine): Primary dialogue/narrative track
- V2, V3: Satellite tracks for B-roll and overlays
- A1: Audio track (reserved for future)
- Track visibility toggles
- Track mute controls

### 3. Clip Manipulation (UI Ready)
- Click to select clips
- Drag body to move clips
- Drag left edge to trim in point
- Drag right edge to trim out point
- Magnetic snap to cut points

### 4. Toolbar Features
- Refresh button to reload from canvas
- Magnetic snap toggle
- Razor tool (placeholder)
- Focus mode toggle
- Clip count display

## Technical Details

### Clip Calculation
```typescript
// Convert node X position to timeline position
start: (node.x - minX) // Normalized from leftmost node

// Duration from clip_in/clip_out
duration: (clip_out - clip_in) * PIXELS_PER_SECOND
```

### Track Assignment
- SPINE nodes → V1 track
- SATELLITE nodes → V2 or V3 based on drift_y

### Colors
- Spine clips: Purple (#A855F7)
- Satellite clips: Cyan (#06B6D4)

## Files Modified

### Modified Files
- `src/renderer/src/components/TimelineView.tsx` - Added data loading, integrated with story graph

### CanvasView Integration
- `src/renderer/src/components/CanvasView.tsx` - Passes projectId to Timeline

## Usage

### Viewing Timeline
1. Open a canvas
2. Timeline appears at bottom (toggle with Timeline button)
3. Clips reflect story nodes on canvas

### Refreshing Timeline
1. Click "Refresh" button in timeline toolbar
2. Timeline reloads from current canvas state

### Editing Clips
1. Click clip to select
2. Drag edges to trim
3. Drag body to move (with magnetic snap)

## Future Enhancements
- Playhead scrubbing with preview
- Two-way sync (timeline edits update canvas)
- Waveform display for audio
- Keyboard shortcuts (J/K/L, I/O)
- Timecode input
- Zoom controls
- Loop region

## Testing Checklist
- [ ] Timeline loads clips from canvas nodes
- [ ] Clips display correct asset names
- [ ] Clip colors match node types
- [ ] Refresh button reloads data
- [ ] Clip selection works
- [ ] Trim handles function
- [ ] Magnetic snap works

## Next Phase
Phase 7: Transcript Features - Speech-to-text integration and transcript-based editing.
