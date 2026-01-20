import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Eye, EyeOff, Volume2, VolumeX, Magnet, Maximize2, Minimize2, Scissors, RefreshCw } from 'lucide-react';
import { StoryNode, MediaAsset } from '../../../shared/types';
import { computeAbsolutePositions, PIXELS_PER_SECOND } from '../utils/topology';

interface TimelineViewProps {
  canvasId: string;
  projectId?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

interface Clip {
  id: string;
  trackId: string;
  name: string;
  start: number; // pixels
  duration: number; // pixels
  inPoint: number; // frames from original media start
  outPoint: number; // frames from original media end
  color: string;
  nodeId?: string; // Reference to story node
}

interface Track {
  id: string;
  name: string;
  type: 'spine' | 'satellite' | 'audio';
  visible: boolean;
  muted: boolean;
  trackIndex: number; // Vertical position in timeline
}

const TimelineView: React.FC<TimelineViewProps> = ({ canvasId, projectId, isFullscreen = false, onToggleFullscreen }) => {
  const [tracks, setTracks] = useState<Track[]>([
    { id: 'v1', name: 'V1 (Spine)', type: 'spine', visible: true, muted: false, trackIndex: 0 },
    { id: 'v2', name: 'V2', type: 'satellite', visible: true, muted: false, trackIndex: 1 },
    { id: 'v3', name: 'V3', type: 'satellite', visible: true, muted: false, trackIndex: 2 },
    { id: 'a1', name: 'A1', type: 'audio', visible: true, muted: false, trackIndex: 3 },
  ]);

  const [clips, setClips] = useState<Clip[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [playheadPosition, _setPlayheadPosition] = useState(0);
  const [magneticSnap, setMagneticSnap] = useState(true);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  // Load timeline data from story graph
  const loadTimelineData = useCallback(async () => {
    if (!canvasId) return;

    setIsLoading(true);
    try {
      // Load story nodes
      const storyNodes: StoryNode[] = await window.electronAPI.nodeList(canvasId);
      const computedNodes = computeAbsolutePositions(storyNodes);

      // Load media assets for names
      const mediaAssets: MediaAsset[] = projectId
        ? await window.electronAPI.mediaGetAll(projectId)
        : [];
      const assetMap = new Map(mediaAssets.map(a => [a.id, a]));

      // Convert story nodes to timeline clips
      // The timeline shows a linearized view of the story graph
      // X position in canvas = timeline position

      // Find the leftmost node position to use as timeline start
      const minX = Math.min(...computedNodes.map(n => n.x), 0);

      // Group nodes by vertical track (based on drift_y or y position)
      const nodesByTrack = new Map<number, StoryNode[]>();

      computedNodes.forEach(node => {
        // Calculate track based on node type and y position
        let trackIndex = 0;
        if (node.type === 'SPINE') {
          trackIndex = 0; // Spine nodes on V1
        } else {
          // Satellites based on their vertical position relative to spine
          const relativeY = node.drift_y || 0;
          trackIndex = 1 + Math.abs(relativeY);
        }

        if (!nodesByTrack.has(trackIndex)) {
          nodesByTrack.set(trackIndex, []);
        }
        nodesByTrack.get(trackIndex)!.push(node);
      });

      // Create clips from nodes
      const newClips: Clip[] = computedNodes.map(node => {
        const asset = node.asset_id ? assetMap.get(node.asset_id) : undefined;
        const duration = (node.clip_out || 5) - (node.clip_in || 0);
        const durationPx = duration * PIXELS_PER_SECOND;

        // Determine track
        let trackId = 'v1';
        if (node.type === 'SATELLITE') {
          const relativeY = node.drift_y || 0;
          if (relativeY === 0 || relativeY === 1) trackId = 'v2';
          else trackId = 'v3';
        }

        return {
          id: node.id,
          nodeId: node.id,
          trackId,
          name: asset?.clean_name || asset?.file_name || 'Untitled',
          start: (node.x - minX), // Normalize to start from 0
          duration: Math.max(durationPx, 50), // Minimum 50px width
          inPoint: node.clip_in || 0,
          outPoint: node.clip_out || duration,
          color: node.type === 'SPINE' ? '#A855F7' : '#06B6D4',
        };
      });

      setClips(newClips);

      // Update tracks based on used tracks
      const usedTracks = new Set(newClips.map(c => c.trackId));
      setTracks(prev => prev.map(track => ({
        ...track,
        visible: usedTracks.has(track.id) || track.id === 'v1',
      })));

    } catch (error) {
      console.error('[Timeline] Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [canvasId, projectId]);

  // Load data on mount and when canvasId changes
  useEffect(() => {
    loadTimelineData();
  }, [loadTimelineData]);
  const [dragState, setDragState] = useState<{
    clipId: string;
    handle: 'start' | 'end' | 'body' | null;
    startX: number;
    originalStart: number;
    originalDuration: number;
  } | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);

  // Generate timecode markers
  const markers = Array.from({ length: 40 }, (_, i) => {
    const seconds = i * 5;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return {
      position: i * 100,
      timecode: `00:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:00`,
    };
  });

  // Get all cut points across all clips for magnetic snapping
  const getCutPoints = useCallback(() => {
    const points: number[] = [0]; // Start of timeline
    clips.forEach((clip) => {
      points.push(clip.start);
      points.push(clip.start + clip.duration);
    });
    return points.sort((a, b) => a - b);
  }, [clips]);

  // Snap to nearest cut point if within threshold
  const snapToNearestCut = useCallback(
    (position: number, threshold = 8) => {
      if (!magneticSnap) return position;

      const cutPoints = getCutPoints();
      let nearestPoint = position;
      let minDistance = threshold + 1;

      cutPoints.forEach((point) => {
        const distance = Math.abs(position - point);
        if (distance < minDistance) {
          minDistance = distance;
          nearestPoint = point;
        }
      });

      return minDistance <= threshold ? nearestPoint : position;
    },
    [magneticSnap, getCutPoints]
  );

  // Handle clip drag start
  const handleClipMouseDown = useCallback(
    (e: React.MouseEvent, clipId: string, handle: 'start' | 'end' | 'body') => {
      e.preventDefault();
      e.stopPropagation();

      const clip = clips.find((c) => c.id === clipId);
      if (!clip) return;

      setSelectedClipId(clipId);
      setDragState({
        clipId,
        handle,
        startX: e.clientX,
        originalStart: clip.start,
        originalDuration: clip.duration,
      });
    },
    [clips]
  );

  // Handle mouse move for dragging
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragState) return;

      const deltaX = e.clientX - dragState.startX;
      const clip = clips.find((c) => c.id === dragState.clipId);
      if (!clip) return;

      let newClips = [...clips];
      const clipIndex = newClips.findIndex((c) => c.id === dragState.clipId);

      if (dragState.handle === 'body') {
        // Move entire clip
        let newStart = dragState.originalStart + deltaX;
        newStart = Math.max(0, newStart);
        newStart = snapToNearestCut(newStart);

        newClips[clipIndex] = { ...clip, start: newStart };
      } else if (dragState.handle === 'start') {
        // Trim start (in point)
        let newStart = dragState.originalStart + deltaX;
        newStart = Math.max(0, newStart);
        newStart = snapToNearestCut(newStart);

        const maxTrim = dragState.originalDuration - 20; // Min 20px clip
        const actualDelta = Math.min(newStart - dragState.originalStart, maxTrim);

        newClips[clipIndex] = {
          ...clip,
          start: dragState.originalStart + actualDelta,
          duration: dragState.originalDuration - actualDelta,
          inPoint: clip.inPoint + actualDelta,
        };
      } else if (dragState.handle === 'end') {
        // Trim end (out point)
        let newDuration = dragState.originalDuration + deltaX;
        newDuration = Math.max(20, newDuration); // Min 20px clip

        const newEnd = dragState.originalStart + newDuration;
        const snappedEnd = snapToNearestCut(newEnd);
        newDuration = snappedEnd - dragState.originalStart;

        newClips[clipIndex] = {
          ...clip,
          duration: newDuration,
          outPoint: clip.inPoint + newDuration,
        };
      }

      setClips(newClips);
    },
    [dragState, clips, snapToNearestCut]
  );

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

  // Set up global mouse listeners
  React.useEffect(() => {
    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState, handleMouseMove, handleMouseUp]);

  return (
    <div className="h-full bg-surface-high flex flex-col">
      {/* Timeline Toolbar */}
      <div className="px-4 py-2 border-b border-void-gray flex items-center justify-between bg-void-dark">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-text-primary">Temporal Floor</h3>

          <div className="w-px h-5 bg-void-gray" />

          {/* Magnetic Snap Toggle */}
          <button
            onClick={() => setMagneticSnap(!magneticSnap)}
            className={`btn-ghost text-xs flex items-center gap-2 ${
              magneticSnap ? 'text-accent-indigo' : ''
            }`}
            title={magneticSnap ? 'Magnetic Snap ON' : 'Magnetic Snap OFF'}
          >
            <Magnet size={14} className={magneticSnap ? 'text-accent-indigo' : ''} />
            Magnet {magneticSnap ? 'ON' : 'OFF'}
          </button>

          {/* Razor Tool (placeholder) */}
          <button
            className="btn-ghost text-xs flex items-center gap-2"
            title="Razor Tool (Cut Clip)"
          >
            <Scissors size={14} />
            Razor
          </button>

          {/* Refresh Button */}
          <button
            onClick={loadTimelineData}
            className={`btn-ghost text-xs flex items-center gap-2 ${isLoading ? 'animate-spin' : ''}`}
            title="Refresh Timeline"
            disabled={isLoading}
          >
            <RefreshCw size={14} />
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>

          {/* Fullscreen Toggle */}
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className={`btn-ghost text-xs flex items-center gap-2 ${
                isFullscreen ? 'text-accent-indigo' : ''
              }`}
              title={isFullscreen ? 'Exit Timeline Focus' : 'Timeline Focus Mode'}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              {isFullscreen ? 'Exit Focus' : 'Focus Mode'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-text-tertiary">
          <span className="text-text-secondary">{clips.length} clips</span>
          <span className="text-void-gray">|</span>
          <span className="timecode">00:00:00:00</span>
          <span>→</span>
          <span className="timecode">00:02:30:00</span>
        </div>
      </div>

      {/* Timeline Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track Headers */}
        <div className="w-32 flex-shrink-0 bg-void-dark border-r border-void-gray">
          {tracks.map((track) => (
            <div
              key={track.id}
              className={`h-16 border-b border-void-gray px-3 flex items-center justify-between ${
                track.type === 'spine' ? 'bg-accent-purple bg-opacity-5' : ''
              }`}
            >
              <span className="text-xs font-medium text-text-primary">
                {track.name}
              </span>
              <div className="flex gap-1">
                <button className="text-text-tertiary hover:text-text-primary transition-colors">
                  {track.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button className="text-text-tertiary hover:text-text-primary transition-colors">
                  {track.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Timeline Tracks */}
        <div ref={timelineRef} className="flex-1 overflow-x-auto overflow-y-hidden relative">
          {/* Time Ruler */}
          <div className="h-8 bg-void-dark border-b border-void-gray relative">
            {markers.map((marker) => (
              <div
                key={marker.timecode}
                className="absolute top-0 bottom-0"
                style={{ left: marker.position }}
              >
                <div className="h-2 w-px bg-void-gray" />
                <span className="text-[10px] text-text-tertiary timecode absolute top-2 left-1">
                  {marker.timecode}
                </span>
              </div>
            ))}
          </div>

          {/* Tracks */}
          <div className="relative" style={{ minWidth: '4000px' }}>
            {tracks.map((track, index) => (
              <div
                key={track.id}
                className={`h-16 border-b border-void-gray relative ${
                  track.type === 'spine'
                    ? 'bg-accent-purple bg-opacity-5'
                    : index % 2 === 0
                    ? 'bg-void-dark'
                    : 'bg-void'
                }`}
              >
                {/* Render clips for this track */}
                {clips
                  .filter((clip) => clip.trackId === track.id)
                  .map((clip) => {
                    const isSelected = selectedClipId === clip.id;
                    const isDragging = dragState?.clipId === clip.id;

                    return (
                      <div
                        key={clip.id}
                        className={`absolute top-2 bottom-2 rounded border-2 transition-all ${
                          isSelected
                            ? 'border-white shadow-lg z-10'
                            : 'border-opacity-60'
                        } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                        style={{
                          left: clip.start,
                          width: clip.duration,
                          backgroundColor: `${clip.color}66`,
                          borderColor: clip.color,
                        }}
                        onMouseDown={(e) => handleClipMouseDown(e, clip.id, 'body')}
                        onClick={() => setSelectedClipId(clip.id)}
                      >
                        {/* Clip Content */}
                        <div className="px-2 py-1 text-xs text-text-primary truncate pointer-events-none">
                          {clip.name}
                        </div>

                        {/* Trim Handle - Start */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white hover:bg-opacity-30 transition-colors group"
                          onMouseDown={(e) => handleClipMouseDown(e, clip.id, 'start')}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-1 h-4 bg-white opacity-0 group-hover:opacity-60 rounded-full" />
                        </div>

                        {/* Trim Handle - End */}
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white hover:bg-opacity-30 transition-colors group"
                          onMouseDown={(e) => handleClipMouseDown(e, clip.id, 'end')}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-1 h-4 bg-white opacity-0 group-hover:opacity-60 rounded-full" />
                        </div>
                      </div>
                    );
                  })}
              </div>
            ))}

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-px bg-accent-red z-20 pointer-events-none"
              style={{ left: playheadPosition }}
            >
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-accent-red rotate-45" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineView;
