/**
 * Mock Data for Phase 1 UI Development
 * Based on database schema - ready for Phase 2 integration
 */

export interface MockProject {
  id: string;
  name: string;
  description: string;
  client?: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'COMPLETED';
  updated_at: string;
  thumbnail?: string;
}

export interface MockAsset {
  id: string;
  file_name: string;
  clean_name: string;
  type: 'BROLL' | 'DIALOGUE' | 'MUSIC' | 'MULTICAM';
  fps: number;
  duration: number;
  has_transcript: boolean;
  is_proxy: boolean;
  resolution?: string;
}

export interface MockNode {
  id: string;
  type: 'SPINE' | 'SATELLITE';
  subtype: 'VIDEO' | 'AUDIO' | 'MULTICAM';
  label: string;
  x: number;
  y: number;
  duration_frames: number;
  selected?: boolean;
  is_multicam?: boolean;
  active_angle?: string;
  color?: string;
}

export interface MockCanvas {
  id: string;
  name: string;
  fps: number;
  resolution: string;
  node_count: number;
}

export interface MockWord {
  id: string;
  word: string;
  frame_in: number;
  frame_out: number;
  selected?: boolean;
}

// ============================================================================
// MOCK PROJECTS
// ============================================================================

export const mockProjects: MockProject[] = [
  {
    id: '1',
    name: 'Documentary: Climate Crisis',
    description: 'Feature-length documentary about climate change impact on coastal communities',
    client: 'National Geographic',
    status: 'ACTIVE',
    updated_at: '2026-01-10T14:30:00Z',
  },
  {
    id: '2',
    name: 'Commercial: Tesla Model X',
    description: '60-second commercial showcasing new features',
    client: 'Tesla Inc.',
    status: 'ACTIVE',
    updated_at: '2026-01-09T11:20:00Z',
  },
  {
    id: '3',
    name: 'Music Video: Electric Dreams',
    description: 'Narrative music video with multicam performance footage',
    client: 'Universal Music',
    status: 'COMPLETED',
    updated_at: '2025-12-15T09:45:00Z',
  },
  {
    id: '4',
    name: 'Corporate Training Video',
    description: 'Internal training series for new employees',
    status: 'ARCHIVED',
    updated_at: '2025-11-20T16:00:00Z',
  },
];

// ============================================================================
// MOCK CANVASES
// ============================================================================

export const mockCanvases: MockCanvas[] = [
  {
    id: 'c1',
    name: 'Director\'s Cut',
    fps: 24,
    resolution: '1920x1080',
    node_count: 47,
  },
  {
    id: 'c2',
    name: 'TV Broadcast Version',
    fps: 30,
    resolution: '1920x1080',
    node_count: 45,
  },
  {
    id: 'c3',
    name: '4K HDR Master',
    fps: 24,
    resolution: '3840x2160',
    node_count: 47,
  },
];

// ============================================================================
// MOCK MEDIA ASSETS
// ============================================================================

export const mockAssets: MockAsset[] = [
  {
    id: 'a1',
    file_name: 'INTERVIEW_SCIENTIST_01.mov',
    clean_name: 'interview_scientist_01',
    type: 'DIALOGUE',
    fps: 24,
    duration: 180.5,
    has_transcript: true,
    is_proxy: false,
    resolution: '1920x1080',
  },
  {
    id: 'a2',
    file_name: 'BROLL_OCEAN_WAVES_4K.mov',
    clean_name: 'broll_ocean_waves_4k',
    type: 'BROLL',
    fps: 24,
    duration: 45.2,
    has_transcript: false,
    is_proxy: false,
    resolution: '3840x2160',
  },
  {
    id: 'a3',
    file_name: 'MUSIC_AMBIENT_TRACK_01.wav',
    clean_name: 'music_ambient_track_01',
    type: 'MUSIC',
    fps: 24,
    duration: 240.0,
    has_transcript: false,
    is_proxy: false,
  },
  {
    id: 'a4',
    file_name: 'MULTICAM_PERFORMANCE_01.fcpxml',
    clean_name: 'multicam_performance_01',
    type: 'MULTICAM',
    fps: 30,
    duration: 120.5,
    has_transcript: false,
    is_proxy: false,
    resolution: '1920x1080',
  },
  {
    id: 'a5',
    file_name: 'INTERVIEW_ACTIVIST_02.mov',
    clean_name: 'interview_activist_02',
    type: 'DIALOGUE',
    fps: 24,
    duration: 210.8,
    has_transcript: true,
    is_proxy: false,
    resolution: '1920x1080',
  },
];

// ============================================================================
// MOCK NODES FOR CANVAS
// ============================================================================

export const mockNodes: MockNode[] = [
  {
    id: 'n1',
    type: 'SPINE',
    subtype: 'VIDEO',
    label: 'Opening Interview',
    x: 100,
    y: 200,
    duration_frames: 4332, // 180.5s @ 24fps
    color: '#A855F7', // Purple for Spine
  },
  {
    id: 'n2',
    type: 'SATELLITE',
    subtype: 'VIDEO',
    label: 'Ocean B-Roll',
    x: 150,
    y: 350,
    duration_frames: 1085, // 45.2s @ 24fps
    color: '#06B6D4', // Cyan for Satellite
  },
  {
    id: 'n3',
    type: 'SPINE',
    subtype: 'VIDEO',
    label: 'Activist Statement',
    x: 500,
    y: 200,
    duration_frames: 5059, // 210.8s @ 24fps
    color: '#A855F7',
  },
  {
    id: 'n4',
    type: 'SATELLITE',
    subtype: 'MULTICAM',
    label: 'Performance Multicam',
    x: 550,
    y: 350,
    duration_frames: 3615, // 120.5s @ 30fps (converted)
    is_multicam: true,
    active_angle: 'CAM A',
    color: '#F59E0B', // Amber for Multicam
  },
  {
    id: 'n5',
    type: 'SATELLITE',
    subtype: 'AUDIO',
    label: 'Ambient Music',
    x: 300,
    y: 450,
    duration_frames: 5760, // 240s @ 24fps
    color: '#06B6D4',
  },
];

// ============================================================================
// MOCK TRANSCRIPT WORDS
// ============================================================================

export const mockWords: MockWord[] = [
  { id: 'w1', word: 'Climate', frame_in: 0, frame_out: 12 },
  { id: 'w2', word: 'change', frame_in: 13, frame_out: 24 },
  { id: 'w3', word: 'is', frame_in: 25, frame_out: 30 },
  { id: 'w4', word: 'not', frame_in: 31, frame_out: 42 },
  { id: 'w5', word: 'a', frame_in: 43, frame_out: 46 },
  { id: 'w6', word: 'future', frame_in: 47, frame_out: 66 },
  { id: 'w7', word: 'threat', frame_in: 67, frame_out: 84 },
  { id: 'w8', word: 'anymore', frame_in: 85, frame_out: 108 },
  { id: 'w9', word: 'it\'s', frame_in: 110, frame_out: 120 },
  { id: 'w10', word: 'happening', frame_in: 121, frame_out: 156 },
  { id: 'w11', word: 'right', frame_in: 157, frame_out: 174 },
  { id: 'w12', word: 'now', frame_in: 175, frame_out: 192 },
];
