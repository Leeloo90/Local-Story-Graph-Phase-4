# Phase 7: Transcript Features - COMPLETE

## Overview
Phase 7 implements transcript import and display functionality, allowing users to import SRT subtitle files and associate them with media assets for word-level editing.

## Implemented Features

### 1. Transcript Service (`src/main/services/transcriptService.ts`)
- **SRT Parsing**: Converts SRT subtitle files to word tokens with timestamps
- **Time Conversion**: `srtTimeToSeconds()` for accurate time parsing
- **Word Interpolation**: Splits sentences into individual words with interpolated timestamps
- **Import Function**: `importTranscript()` saves transcript data to database
- **Node Query**: `getTranscriptForNode()` retrieves transcript for a story node

### 2. IPC Handlers
- `transcript:import` - Import SRT file for a media asset
- `transcript:get-for-node` - Get transcript data for a story node with clip boundaries

### 3. Preload Bridge
- `transcriptImport(mediaId, filePath)` - Exposed to renderer
- `transcriptGetForNode(nodeId)` - Exposed to renderer

### 4. Database Schema
```sql
CREATE TABLE transcripts (
  media_id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  raw_text TEXT,
  word_map_json TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY(media_id) REFERENCES media_library(id) ON DELETE CASCADE
);
```

## Word Token Structure
```typescript
interface WordToken {
  id: number;
  text: string;
  start: number;  // Seconds
  end: number;    // Seconds
}
```

## Usage

### Importing a Transcript
```typescript
const result = await window.electronAPI.transcriptImport(mediaId, '/path/to/file.srt');
if (result.success) {
  console.log('Transcript imported');
}
```

### Getting Transcript for a Node
```typescript
const data = await window.electronAPI.transcriptGetForNode(nodeId);
if (data) {
  const { transcript, clip_in, clip_out } = data;
  // Filter words within clip boundaries
  const visibleWords = transcript.word_map_json.filter(
    w => w.start >= clip_in && w.end <= clip_out
  );
}
```

## Files Modified/Created

### Services
- `src/main/services/transcriptService.ts` - SRT parsing and database operations

### IPC
- `src/main/ipc/handlers.ts` - Added transcript handlers
- `src/preload/preload.ts` - Added transcript bridge methods

## Future Enhancements
- Support for additional formats (VTT, JSON, etc.)
- AI-powered transcript generation
- Word-level editing with clip boundary updates
- Speaker diarization support
- Transcript search across project

## Testing Checklist
- [ ] Import SRT file
- [ ] View transcript for node
- [ ] Verify word timestamps align with video
- [ ] Test clip boundary filtering

## Next Phase
Phase 8: Multicam Support - Import and manage multicam clips from FCPXML.
