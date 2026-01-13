/**
 * Shared types used across Main and Renderer processes
 * Story Graph v4.0
 */

// ============================================================================
// DATABASE TYPES (matching schema v4.5)
// ============================================================================

export interface Project {
  id: string; // UUID
  name: string;
  description?: string;
  client?: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'COMPLETED';
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

export interface MediaAsset {
  id: string; // UUID
  project_id: string; // FK to projects
  file_name: string; // Original filename
  clean_name: string; // Sanitized/indexed name
  file_path: string; // Absolute path
  format: string; // e.g., "mov", "mp4"
  media_type: 'BROLL' | 'DIALOGUE' | 'MUSIC' | 'IMAGE' | 'MULTICAM';
  fps: number | null;
  resolution: string | null; // e.g., "1920x1080"
  start_tc: string | null; // SMPTE timecode
  end_tc: string | null; // SMPTE timecode
  total_frames: number | null;
  duration: number | null; // seconds
  size: number | null; // bytes
  metadata_raw: string | null; // JSON string from FFprobe
  created_at: string;
}

export interface Transcript {
  id: string;
  asset_id: string; // FK to media_library
  speaker?: string;
  time_in: number; // Frame number
  time_out: number; // Frame number
  content: string; // The spoken text
  word_map?: WordMapEntry[]; // JSON array
  sync_offset_frames?: number;
}

export interface WordMapEntry {
  word: string;
  frame_in: number;
  frame_out: number;
}

export interface FractalContainer {
  id: string;
  project_id: string;
  canvas_id: string;
  parent_id?: string; // For nested containers (nullable)
  type: 'ACT' | 'SCENE';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  // Anchor system
  ANCHOR_START_ID?: string; // FK to story_nodes
  ANCHOR_START_DRIFT?: number; // Offset in frames
  ANCHOR_END_ID?: string; // FK to story_nodes
  ANCHOR_END_DRIFT?: number; // Offset in frames
}

export interface StoryNode {
  id: string;
  asset_id?: string; // FK to media_library (nullable for text nodes)
  act_id?: string; // FK to fractal_containers
  scene_id?: string; // FK to fractal_containers
  type: 'SPINE' | 'SATELLITE';
  subtype: 'VIDEO' | 'MUSIC' | 'TEXT' | 'IMAGE';
  is_global: boolean; // True for nodes in "The Bucket"
  // Canvas position (x, y are visual positions on canvas)
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;

  // Single anchor system (Single Source of Truth)
  // A node can only have ONE parent anchor
  anchor_id?: string; // FK to story_nodes
  connection_mode?: ConnectionMode; // How this node connects to its parent
  drift_x?: number; // REAL: Temporal offset in seconds
  drift_y?: number; // INTEGER: Track offset (0 = same track, +1 = above, -1 = below)

  // Attic system (Magnetic Construction v2)
  // Nodes in the Attic are "parked" above a Spine, not yet committed to the edit
  attic_parent_id?: string; // FK to story_nodes (the Spine this node is parked under)

  // Clip trimming (in seconds)
  clip_in?: number; // Trim start (seconds from asset start)
  clip_out?: number; // Trim end (seconds from asset start), null = use full duration

  // Multicam internal state
  internal_state_map?: Record<string, any>; // JSON for angle choices

  // Computed fields (Frontend only - not in DB)
  // Calculated during rendering from anchor chain
  _computed?: {
    absoluteTime: number;   // Absolute time position (seconds)
    absoluteTrack: number;  // Absolute track position (integer)
    duration: number;       // clip_out - clip_in (seconds)
    generation: number;     // Depth in anchor chain (0 = root, 1 = child, etc.)
    hasAnchor: boolean;     // Quick check if node is anchored
  };
}

export interface Canvas {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  FPS: number; // Default: 24
  Resolution: string; // e.g., "1920x1080"
  Timecode_mode: 'NON_DROP' | 'DROP';
}

export interface ProjectSettings {
  project_id: string; // FK/PK
  render_preview_path?: string;
  proxy_mode_enabled: boolean;
  last_canvas_id?: string; // FK to canvases
}

export interface MulticamMember {
  id: string;
  parent_asset_id: string; // FK to media_library (the MULTICAM container)
  child_asset_id: string; // FK to media_library (the source file)
  track_index: number; // Angle number
  sync_offset?: number; // Frame offset
  is_primary_audio: boolean;
  audio_role?: string; // e.g., "Dialogue", "Music"
  is_sync_reference: boolean;
}

// ============================================================================
// ANCHOR SYSTEM TYPES
// ============================================================================

/**
 * Connection Mode defines HOW a child node attaches to its parent
 *
 * STACK - Top Port attachment (vertical layering/compositing overlay)
 *   absTime = parent.absTime + drift_x
 *   absTrack = parent.absTrack + 1 + drift_y
 *   Visual: Floats directly above parent
 *
 * PREPEND - Left Port attachment (lead-in/J-cut, plays before parent)
 *   absTime = parent.absTime - child.duration - drift_x
 *   absTrack = parent.absTrack + drift_y (usually 0)
 *   drift_x is the GAP: 0 = touching, positive = gap before parent
 *   Visual: Attached to left edge of parent
 *
 * APPEND - Right Port attachment (lead-out/L-cut, plays after parent)
 *   absTime = parent.absTime + parent.duration + drift_x
 *   absTrack = parent.absTrack + drift_y (usually 0)
 *   drift_x is the GAP: 0 = touching, positive = gap after parent
 *   Visual: Attached to right edge of parent
 */
export type ConnectionMode = 'STACK' | 'PREPEND' | 'APPEND';

/**
 * Handle IDs map to connection modes:
 * - 'anchor-top' → STACK
 * - 'anchor-left' → PREPEND
 * - 'anchor-right' → APPEND
 * - 'anchor-bottom' → (reserved for music, later phase)
 */
export type HandleId = 'anchor-top' | 'anchor-left' | 'anchor-right' | 'anchor-bottom';

// ============================================================================
// IPC CHANNEL DEFINITIONS
// ============================================================================

export interface IpcChannels {
  // File operations
  'select-files': () => Promise<string[]>;
  'select-folder': () => Promise<string | null>;

  // Database operations
  'db-query': (query: string, params?: any[]) => Promise<any>;
  'db-execute': (query: string, params?: any[]) => Promise<void>;

  // Project CRUD
  'project-create': (project: Omit<Project, 'id' | 'created_at' | 'updated_at'>) => Promise<Project>;
  'project-get': (id: string) => Promise<Project | null>;
  'project-list': () => Promise<Project[]>;
  'project-update': (id: string, updates: Partial<Project>) => Promise<void>;
  'project-delete': (id: string) => Promise<void>;

  // Media operations
  'media-import': (projectId: string, filePaths: string[]) => Promise<MediaAsset[]>;
  'media-get-metadata': (filePath: string) => Promise<any>;

  // Canvas operations
  'canvas-create': (projectId: string, canvas: Omit<Canvas, 'id' | 'created_at' | 'updated_at'>) => Promise<Canvas>;
  'canvas-list': (projectId: string) => Promise<Canvas[]>;

  // Node operations
  'node-create': (canvasId: string, node: Omit<StoryNode, 'id'>) => Promise<StoryNode>;
  'node-update': (id: string, updates: Partial<StoryNode>) => Promise<void>;
  'node-delete': (id: string) => Promise<void>;
  'node-list': (canvasId: string) => Promise<StoryNode[]>;
  'node-update-position': (id: string, x: number, y: number) => Promise<void>;
  'node-link': (childId: string, parentId: string, connectionMode: ConnectionMode) => Promise<{ success: boolean; error?: string }>;
  'node-unlink': (nodeId: string) => Promise<{ success: boolean }>;
  'node-validate-anchor': (childId: string, parentId: string, connectionMode: ConnectionMode) => Promise<{ valid: boolean; reason?: string }>;
  'node-change-type': (nodeId: string, newType: 'SPINE' | 'SATELLITE') => Promise<{ success: boolean; error?: string }>;

  // Backup operations
  'backup-create': () => Promise<void>;
  'backup-restore': (backupPath: string) => Promise<void>;
  'backup-list': () => Promise<string[]>;
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

export interface AppState {
  currentProject: Project | null;
  currentCanvas: Canvas | null;
  viewMode: 'HOME' | 'DASHBOARD' | 'CANVAS' | 'TIMELINE';
  linkToggleEnabled: boolean;
}

// ============================================================================
// STUB FUNCTION TYPES (for Phase 1+)
// ============================================================================

export interface FFprobeMetadata {
  format: string;
  duration: number;
  fps: number;
  width: number;
  height: number;
  resolution: string;
  has_video: boolean;
  has_audio: boolean;
  mime_type: string;
  file_size: number;
  timecode_start: string | null;
  total_frames: number | null;
}

export interface AnchorCalculation {
  x: number;
  y: number;
  isValid: boolean;
  hasParadox: boolean;
}

// ============================================================================
// REACT FLOW NODE TYPES (for Canvas rendering)
// ============================================================================

export interface ReactFlowNodeData {
  storyNode: StoryNode;
  asset?: MediaAsset; // Populated if asset_id exists
  label: string;
  isSelected?: boolean;
  onDelete?: (id: string) => void;
}

export interface ReactFlowNode {
  id: string;
  type: 'spineNode' | 'satelliteNode' | 'multicamNode';
  position: { x: number; y: number };
  data: ReactFlowNodeData;
}
