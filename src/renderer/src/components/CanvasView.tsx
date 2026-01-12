import React, { useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  OnDragOver,
  OnDrop,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { StoryNode as StoryNodeType, MediaAsset, ConnectionMode } from '../../../shared/types';
import {
  ArrowLeft,
  Maximize2,
  Eye,
  EyeOff,
  Link,
  Unlink,
  Undo2,
  Redo2,
  Monitor,
  ChevronLeft,
  ChevronRight,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  FileDown,
} from 'lucide-react';
import { mockNodes } from '../data/mockData';
import SpineNode from './nodes/SpineNode';
import SatelliteNode from './nodes/SatelliteNode';
import MulticamNode from './nodes/MulticamNode';
import TimelineView from './TimelineView';
import InspectorPanel from './InspectorPanel';
import MediaLibraryPanel from './MediaLibraryPanel';
import NodeContextMenu from './NodeContextMenu';
import { computeAbsolutePositions, getAnchorEdges } from '../utils/topology';

interface CanvasViewProps {
  projectId: string;
  canvasId: string;
  onBack: () => void;
}

const nodeTypes = {
  spine: SpineNode,
  satellite: SatelliteNode,
  multicam: MulticamNode,
};

const CanvasView: React.FC<CanvasViewProps> = ({ projectId, canvasId, onBack }) => {
  const [showTimeline, setShowTimeline] = useState(true);
  const [showBucket, setShowBucket] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [linkToggle, setLinkToggle] = useState(false);
  const [proxyMode, setProxyMode] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [timelineFullscreen, setTimelineFullscreen] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(true);
  const [showInspector, setShowInspector] = useState(true);

  // Panel positioning state
  const [panelPositions, setPanelPositions] = useState<{
    left: 'media-library' | 'inspector' | null;
    right: 'media-library' | 'inspector' | null;
  }>({
    left: 'media-library',
    right: 'inspector',
  });

  // Panel drag state for reorganization
  const [draggingPanel, setDraggingPanel] = useState<'media-library' | 'inspector' | null>(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [showDropZones, setShowDropZones] = useState(false);

  // Preview box position state
  const [previewPosition, setPreviewPosition] = useState({
    x: Math.max(20, window.innerWidth - 400),
    y: Math.max(20, window.innerHeight - 320)
  });
  const [previewSize, setPreviewSize] = useState({ width: 320, height: 240 });
  const [isDraggingPreview, setIsDraggingPreview] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // State for nodes and edges
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [mediaAssets, setMediaAssets] = useState<Map<string, MediaAsset>>(new Map());

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    position: { x: number; y: number };
    node: StoryNodeType | null;
  }>({
    show: false,
    position: { x: 0, y: 0 },
    node: null,
  });

  // Load nodes from database on mount
  useEffect(() => {
    loadCanvasNodes();
    loadMediaAssets();
  }, [canvasId, projectId]);

  const loadCanvasNodes = async () => {
    try {
      console.log('[Canvas] Loading nodes for canvas:', canvasId);
      const storyNodes: StoryNodeType[] = await window.electronAPI.nodeList(canvasId);

      // Phase 4: Compute absolute positions from anchor chains
      const nodesWithComputed = computeAbsolutePositions(storyNodes);

      // Convert StoryNode[] to React Flow Node[]
      const flowNodes: Node[] = nodesWithComputed.map((sn) => ({
        id: sn.id,
        type: sn.subtype === 'MUSIC' || sn.type === 'SATELLITE' ? 'satellite' : 'spine',
        position: {
          x: sn._computed?.absoluteX ?? sn.x,
          y: sn._computed?.absoluteY ?? sn.y,
        },
        data: {
          storyNode: sn,
          label: `Node ${sn.id.substring(0, 8)}`,
          onDelete: handleDeleteNode,
        },
      }));

      setNodes(flowNodes);

      // Phase 4: Generate anchor edges for visualization
      const anchorEdges = getAnchorEdges(nodesWithComputed);
      const flowEdges: Edge[] = anchorEdges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        style: { stroke: '#6B7280', strokeWidth: 1 },
        animated: false,
      }));

      setEdges(flowEdges);

      console.log('[Canvas] Loaded', flowNodes.length, 'nodes and', flowEdges.length, 'anchor edges');
    } catch (error) {
      console.error('[Canvas] Failed to load nodes:', error);
    }
  };

  const loadMediaAssets = async () => {
    try {
      const assets: MediaAsset[] = await window.electronAPI.mediaGetAll(projectId);
      const assetMap = new Map<string, MediaAsset>();
      assets.forEach((asset) => assetMap.set(asset.id, asset));
      setMediaAssets(assetMap);
      console.log('[Canvas] Loaded', assets.length, 'media assets');
    } catch (error) {
      console.error('[Canvas] Failed to load media assets:', error);
    }
  };

  // Handle drag over canvas (allow drop)
  const handleDragOver: OnDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  // Handle drop on canvas
  const handleDrop: OnDrop = useCallback(
    async (event) => {
      event.preventDefault();

      const data = event.dataTransfer.getData('application/media-asset');
      if (!data) {
        console.warn('[Canvas Drop] No media asset data found');
        return;
      }

      try {
        const asset: MediaAsset = JSON.parse(data);
        console.log('[Canvas Drop] Dropped asset:', asset.clean_name);

        // Calculate drop position in React Flow coordinates
        const reactFlowBounds = (event.target as HTMLElement).closest('.react-flow')?.getBoundingClientRect();
        if (!reactFlowBounds) {
          console.error('[Canvas Drop] Could not get React Flow bounds');
          return;
        }

        // Calculate position relative to canvas viewport
        const x = event.clientX - reactFlowBounds.left;
        const y = event.clientY - reactFlowBounds.top;

        console.log('[Canvas Drop] Position:', { x, y });

        // Determine node type based on media_type
        const nodeType = asset.media_type === 'DIALOGUE' ? 'SPINE' : 'SATELLITE';
        const subtype = asset.media_type === 'MUSIC' ? 'MUSIC' : 'VIDEO';

        // Create StoryNode in database
        const newStoryNode: Omit<StoryNodeType, 'id'> = {
          asset_id: asset.id,
          type: nodeType,
          subtype: subtype as 'VIDEO' | 'MUSIC' | 'TEXT' | 'IMAGE',
          is_global: false,
          x,
          y,
          width: 240,
          height: 180,
        };

        const createdNode: StoryNodeType = await window.electronAPI.nodeCreate(canvasId, newStoryNode);
        console.log('[Canvas Drop] Created node:', createdNode.id);

        // Add to React Flow
        const newFlowNode: Node = {
          id: createdNode.id,
          type: nodeType === 'SPINE' ? 'spine' : 'satellite',
          position: { x: createdNode.x, y: createdNode.y },
          data: {
            storyNode: createdNode,
            asset: asset,
            label: asset.clean_name,
            onDelete: handleDeleteNode,
          },
        };

        setNodes((nds) => [...nds, newFlowNode]);

        console.log('[Canvas Drop] Node added to canvas');
      } catch (error) {
        console.error('[Canvas Drop] Failed to create node:', error);
        alert('Failed to create node. Check console for details.');
      }
    },
    [canvasId, setNodes]
  );

  // Handle node deletion
  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      try {
        console.log('[Canvas] Deleting node:', nodeId);
        await window.electronAPI.nodeDelete(nodeId);
        setNodes((nds) => nds.filter((n) => n.id !== nodeId));
        console.log('[Canvas] Node deleted successfully');
      } catch (error) {
        console.error('[Canvas] Failed to delete node:', error);
        alert('Failed to delete node. Check console for details.');
      }
    },
    [setNodes]
  );

  // Handle node right-click context menu
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();

      // Find the StoryNode data from the node
      const storyNode = node.data.storyNode as StoryNodeType;
      if (!storyNode) {
        console.warn('[Canvas] No story node data found for context menu');
        return;
      }

      setContextMenu({
        show: true,
        position: { x: event.clientX, y: event.clientY },
        node: storyNode,
      });
    },
    []
  );

  // Handle node type change
  const handleChangeNodeType = useCallback(
    async (nodeId: string, newType: 'SPINE' | 'SATELLITE') => {
      try {
        console.log('[Canvas] Changing node type:', nodeId, 'to', newType);
        const result = await window.electronAPI.nodeChangeType(nodeId, newType);

        if (result.success) {
          console.log('[Canvas] Node type changed successfully');
          // Reload nodes to reflect changes
          await loadCanvasNodes();
        } else {
          console.error('[Canvas] Failed to change node type:', result.error);
          alert(`Failed to change node type: ${result.error}`);
        }
      } catch (error) {
        console.error('[Canvas] Node type change error:', error);
        alert(`Error changing node type: ${error}`);
      }
    },
    [canvasId]
  );

  // Handle node unlink
  const handleUnlinkNode = useCallback(
    async (nodeId: string) => {
      try {
        console.log('[Canvas] Unlinking node:', nodeId);
        const result = await window.electronAPI.nodeUnlink(nodeId);

        if (result.success) {
          console.log('[Canvas] Node unlinked successfully');
          // Reload nodes to reflect changes
          await loadCanvasNodes();
        } else {
          console.error('[Canvas] Failed to unlink node');
          alert('Failed to unlink node');
        }
      } catch (error) {
        console.error('[Canvas] Unlink error:', error);
        alert(`Error unlinking node: ${error}`);
      }
    },
    [canvasId]
  );

  // Handle node position change (persist to database)
  const handleNodeDragStop = useCallback(
    async (_event: React.MouseEvent, node: Node) => {
      try {
        console.log('[Canvas] Node dragged to:', node.position);
        await window.electronAPI.nodeUpdatePosition(node.id, node.position.x, node.position.y);
        console.log('[Canvas] Node position updated in database');
      } catch (error) {
        console.error('[Canvas] Failed to update node position:', error);
      }
    },
    []
  );

  // Update nodes when bucket visibility changes
  React.useEffect(() => {
    const bucketNode: Node = {
      id: 'bucket',
      type: 'default',
      position: { x: -1200, y: 0 },
      data: { label: '🗑️ THE BUCKET' },
      style: {
        width: 300,
        height: 600,
        background: 'rgba(28, 28, 30, 0.5)',
        border: '2px dashed #2C2C2E',
        borderRadius: '12px',
        padding: '16px',
      },
      draggable: true,
      selectable: true,
    };

    if (showBucket) {
      // Add bucket if it doesn't exist
      setNodes((nds) => {
        const hasBucket = nds.some((n) => n.id === 'bucket');
        if (!hasBucket) {
          return [...nds, bucketNode];
        }
        return nds;
      });
    } else {
      // Remove bucket if it exists
      setNodes((nds) => nds.filter((n) => n.id !== 'bucket'));
    }
  }, [showBucket, setNodes]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Validate connections - allow any handle to connect to any handle
  const isValidConnection = useCallback((connection: Connection) => {
    const validPorts = ['anchor-top', 'anchor-left', 'anchor-right'];
    const sourceIsPort = validPorts.includes(connection.sourceHandle || '');
    const targetIsPort = validPorts.includes(connection.targetHandle || '');

    // We need exactly one Port (Parent) and one Tether (Child)
    // XOR check: (A and not B) or (not A and B)
    const isValid = sourceIsPort ? !targetIsPort : targetIsPort;

    // Prevent self-linking
    if (connection.source === connection.target) return false;

    return isValid;
  }, []);

  const onConnect = useCallback(
    async (params: Connection) => {
      // Identify which handle is the "Port" (The Parent's Docking Station)
      // The Port handle will have an ID like 'anchor-top', 'anchor-left', 'anchor-right'

      const handleToMode: Record<string, ConnectionMode> = {
        'anchor-top': 'STACK',
        'anchor-left': 'PREPEND',
        'anchor-right': 'APPEND',
      };

      let parentId: string | null = null;
      let childId: string | null = null;
      let connectionMode: ConnectionMode | null = null;

      // Check if Target was the Port (User dragged Child -> Parent)
      if (params.targetHandle && handleToMode[params.targetHandle]) {
        parentId = params.target;
        childId = params.source;
        connectionMode = handleToMode[params.targetHandle];
      }
      // Check if Source was the Port (User dragged Parent -> Child)
      else if (params.sourceHandle && handleToMode[params.sourceHandle]) {
        parentId = params.source;
        childId = params.target;
        connectionMode = handleToMode[params.sourceHandle];
      }

      if (!parentId || !childId || !connectionMode) {
        console.warn('[Canvas] Invalid connection: Could not determine Parent/Child relationship from handles.');
        return;
      }

      console.log(`[Canvas] Linking: Parent (${parentId}) <- [${connectionMode}] <- Child (${childId})`);

      try {
        // Validate
        const validation = await window.electronAPI.nodeValidateAnchor(
          childId,
          parentId,
          connectionMode
        );

        if (!validation.valid) {
          alert(`Cannot connect: ${validation.reason}`);
          return;
        }

        // Link in DB
        const result = await window.electronAPI.nodeLink(
          childId,
          parentId,
          connectionMode
        );

        if (result.success) {
          console.log('[Canvas] Link created successfully');
          await loadCanvasNodes();
        } else {
          console.error('[Canvas] Link failed:', result.error);
          alert(`Failed to create link: ${result.error}`);
        }
      } catch (error) {
        console.error('[Canvas] Connection error:', error);
        alert(`Connection error: ${error}`);
      }
    },
    [canvasId]
  );

  // Handle preview box dragging
  const handlePreviewMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.preview-drag-handle')) {
      setIsDraggingPreview(true);
      setDragOffset({
        x: e.clientX - previewPosition.x,
        y: e.clientY - previewPosition.y,
      });
    }
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingPreview) {
        setPreviewPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDraggingPreview(false);
    };

    if (isDraggingPreview) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingPreview, dragOffset]);

  // Panel drag handlers for reorganization
  const handlePanelDragStart = useCallback((panel: 'media-library' | 'inspector', e: React.MouseEvent) => {
    // Only trigger from panel header
    if (!(e.target as HTMLElement).closest('.panel-drag-handle')) return;

    setDraggingPanel(panel);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setShowDropZones(true);
  }, []);

  const handlePanelDragMove = useCallback((e: MouseEvent) => {
    if (!draggingPanel) return;

    const deltaX = Math.abs(e.clientX - dragStartPos.x);
    const deltaY = Math.abs(e.clientY - dragStartPos.y);

    // Threshold to start showing drop zones
    if (deltaX > 10 || deltaY > 10) {
      setShowDropZones(true);
    }
  }, [draggingPanel, dragStartPos]);

  const handlePanelDrop = useCallback((e: MouseEvent) => {
    if (!draggingPanel) return;

    const dropX = e.clientX;
    const windowWidth = window.innerWidth;
    const leftZone = windowWidth * 0.3; // Left 30% of screen
    const rightZone = windowWidth * 0.7; // Right 70% of screen

    // Determine drop zone
    if (dropX < leftZone) {
      // Dropped in left zone
      if (panelPositions.left !== draggingPanel) {
        setPanelPositions({
          left: draggingPanel,
          right: panelPositions.left === 'media-library' ? 'media-library' : 'inspector',
        });
      }
    } else if (dropX > rightZone) {
      // Dropped in right zone
      if (panelPositions.right !== draggingPanel) {
        setPanelPositions({
          left: panelPositions.right === 'media-library' ? 'media-library' : 'inspector',
          right: draggingPanel,
        });
      }
    }

    setDraggingPanel(null);
    setShowDropZones(false);
  }, [draggingPanel, panelPositions]);

  // Set up global mouse listeners for panel dragging
  React.useEffect(() => {
    if (draggingPanel) {
      window.addEventListener('mousemove', handlePanelDragMove);
      window.addEventListener('mouseup', handlePanelDrop);
      return () => {
        window.removeEventListener('mousemove', handlePanelDragMove);
        window.removeEventListener('mouseup', handlePanelDrop);
      };
    }
  }, [draggingPanel, handlePanelDragMove, handlePanelDrop]);

  const timelineHeight = fullScreen ? 400 : showTimeline ? 256 : 0;
  const mediaLibraryWidth = showMediaLibrary ? 320 : 0;
  const inspectorWidth = showInspector ? 380 : 0;

  // Render panel based on type and position
  const renderPanel = (panelType: 'media-library' | 'inspector', position: 'left' | 'right') => {
    const isMediaLibrary = panelType === 'media-library';
    const isVisible = isMediaLibrary ? showMediaLibrary : showInspector;
    const width = isMediaLibrary ? mediaLibraryWidth : inspectorWidth;
    const isLeft = position === 'left';

    if (!isVisible) return null;

    return (
      <div
        key={panelType}
        style={{ width }}
        className={`bg-surface-high ${isLeft ? 'border-r' : 'border-l'} border-void-gray flex flex-col ${
          draggingPanel === panelType ? 'opacity-50' : ''
        }`}
        onMouseDown={(e) => handlePanelDragStart(panelType, e)}
      >
        {isMediaLibrary ? (
          <MediaLibraryPanel
            projectId={projectId}
            onToggleCollapse={() => setShowMediaLibrary(false)}
            position={position}
          />
        ) : (
          <InspectorPanel
            onToggleCollapse={() => setShowInspector(false)}
            position={position}
          />
        )}
      </div>
    );
  };

  return (
    <div className="w-screen h-screen bg-void flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="bg-surface-high border-b border-void-gray px-6 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-text-tertiary hover:text-text-primary transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} />
          </button>

          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-sm">
            <span className="text-text-secondary">Documentary Project</span>
            <span className="text-text-tertiary">/</span>
            <span className="text-text-primary font-medium">Director's Cut</span>
            <span className="text-text-tertiary">/</span>
            <span className="text-text-tertiary timecode">24 fps</span>
            <span className="text-text-tertiary">|</span>
            <span className="text-text-tertiary coordinate">1920x1080</span>
          </nav>
        </div>

        {/* Main Controls */}
        <div className="flex items-center gap-3">
          {/* Container Navigation */}
          <div className="flex items-center gap-1 bg-void-dark border border-void-gray rounded-lg p-1">
            <button
              className="p-1.5 text-text-tertiary hover:text-text-primary transition-colors rounded"
              title="Previous Container"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="p-1.5 text-text-tertiary hover:text-text-primary transition-colors rounded"
              title="Next Container"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Undo/Redo */}
          <div className="flex items-center gap-1 bg-void-dark border border-void-gray rounded-lg p-1">
            <button
              className="p-1.5 text-text-tertiary hover:text-text-primary transition-colors rounded"
              title="Undo"
            >
              <Undo2 size={16} />
            </button>
            <button
              className="p-1.5 text-text-tertiary hover:text-text-primary transition-colors rounded"
              title="Redo"
            >
              <Redo2 size={16} />
            </button>
          </div>

          <div className="w-px h-6 bg-void-gray" />

          {/* Link Toggle */}
          <button
            onClick={() => setLinkToggle(!linkToggle)}
            className={`btn-ghost text-sm flex items-center gap-2 ${
              linkToggle ? 'text-accent-indigo' : ''
            }`}
            title={linkToggle ? 'Link Mode ON (Magnetic Ripple)' : 'Link Mode OFF (Freeform)'}
          >
            {linkToggle ? <Link size={16} /> : <Unlink size={16} />}
            {linkToggle ? 'Link ON' : 'Link OFF'}
          </button>

          {/* Proxy Mode */}
          <button
            onClick={() => setProxyMode(!proxyMode)}
            className={`btn-ghost text-sm flex items-center gap-2 ${
              proxyMode ? 'text-accent-cyan' : ''
            }`}
            title="Toggle Proxy Mode"
          >
            <Monitor size={16} />
            {proxyMode ? 'Proxy' : 'Full Res'}
          </button>

          <div className="w-px h-6 bg-void-gray" />

          <button
            onClick={() => console.log('[MOCK] Zoom to Extents')}
            className="btn-ghost text-sm flex items-center gap-2"
            title="Zoom to Fit"
          >
            <Maximize2 size={16} />
            Zoom to Fit
          </button>

          <div className="w-px h-6 bg-void-gray" />

          <button
            onClick={() => console.log('[MOCK] Export FCPXML - Phase 9')}
            className="btn-primary text-sm flex items-center gap-2"
            title="Export Final Cut Pro XML"
          >
            <FileDown size={16} />
            Export XML
          </button>

          <button className="btn-ghost" title="Canvas Settings">
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      {timelineFullscreen ? (
        /* Timeline Fullscreen Mode (DaVinci-style) */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Fixed Preview Window (Top) */}
          <div className="h-64 bg-void-dark border-b border-void-gray flex items-center justify-center">
            <div className="w-full h-full flex">
              {/* Preview */}
              <div className="flex-1 flex items-center justify-center">
                <div className="aspect-video h-5/6 bg-void rounded-lg border border-void-gray flex items-center justify-center">
                  <span className="text-sm text-text-tertiary">Preview Window</span>
                </div>
              </div>
              {/* Scopes/Waveform placeholder */}
              <div className="w-80 bg-surface-high border-l border-void-gray p-4">
                <div className="h-full bg-void rounded border border-void-gray flex items-center justify-center">
                  <span className="text-xs text-text-tertiary">Scopes</span>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline (Full Height) */}
          <div className="flex-1 overflow-hidden">
            <TimelineView
              canvasId={canvasId}
              isFullscreen={timelineFullscreen}
              onToggleFullscreen={() => setTimelineFullscreen(false)}
            />
          </div>
        </div>
      ) : (
        /* Normal Canvas + Timeline Mode */
        <div className="flex-1 flex overflow-hidden relative">
          {/* Drop Zone Overlays */}
          {showDropZones && draggingPanel && (
            <>
              {/* Left Drop Zone */}
              <div className="absolute left-0 top-0 bottom-0 w-1/3 bg-accent-indigo bg-opacity-20 border-2 border-accent-indigo border-dashed z-50 flex items-center justify-center pointer-events-none">
                <span className="text-accent-indigo font-semibold text-lg">Drop Here (Left)</span>
              </div>
              {/* Right Drop Zone */}
              <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-accent-indigo bg-opacity-20 border-2 border-accent-indigo border-dashed z-50 flex items-center justify-center pointer-events-none">
                <span className="text-accent-indigo font-semibold text-lg">Drop Here (Right)</span>
              </div>
            </>
          )}

          {/* Left Panel */}
          {panelPositions.left && renderPanel(panelPositions.left, 'left')}

          {/* Canvas + Timeline Container */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Canvas */}
            <div className="flex-1 relative">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              isValidConnection={isValidConnection}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onNodeDragStop={handleNodeDragStop}
              onNodeContextMenu={handleNodeContextMenu}
              nodeTypes={nodeTypes}
              fitView
              className="bg-void"
              defaultEdgeOptions={{
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#6366F1', strokeWidth: 2 },
              }}
            >
              <Background color="#2C2C2E" gap={20} size={1} />
              <Controls
                className="!bg-surface-high !border-void-gray"
                style={{
                  button: {
                    backgroundColor: '#1C1C1E',
                    color: '#E5E5E7',
                    borderBottom: '1px solid #2C2C2E',
                  },
                }}
              />
              <MiniMap
                className="!bg-surface-high !border !border-void-gray"
                maskColor="rgba(10, 10, 11, 0.6)"
                nodeColor={(node) => {
                  if (node.type === 'spine') return '#A855F7';
                  if (node.type === 'satellite') return '#06B6D4';
                  if (node.type === 'multicam') return '#F59E0B';
                  return '#2C2C2E';
                }}
              />
            </ReactFlow>

            {/* Floating Preview Box */}
            {showPreview && !timelineFullscreen && (
              <div
                style={{
                  position: 'absolute',
                  left: previewPosition.x,
                  top: previewPosition.y,
                  width: previewSize.width,
                  zIndex: 100,
                  cursor: isDraggingPreview ? 'grabbing' : 'default',
                }}
                onMouseDown={handlePreviewMouseDown}
                className="panel rounded-lg overflow-hidden shadow-node"
              >
                <div className="preview-drag-handle panel-header cursor-grab active:cursor-grabbing">
                  <h4 className="text-xs font-semibold">Floating Preview</h4>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="text-text-tertiary hover:text-text-primary transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <div className="aspect-video bg-void-dark flex items-center justify-center">
                  <span className="text-xs text-text-tertiary">No preview</span>
                </div>
                <div className="px-2 py-1 bg-void-dark border-t border-void-gray">
                  <span className="text-[10px] text-text-tertiary timecode">
                    01:23:45:12
                  </span>
                </div>
              </div>
            )}
          </div>

            {/* Timeline */}
            {showTimeline && !timelineFullscreen && (
              <div style={{ height: timelineHeight }} className="border-t border-void-gray">
                <TimelineView
                  canvasId={canvasId}
                  isFullscreen={false}
                  onToggleFullscreen={() => setTimelineFullscreen(true)}
                />
              </div>
            )}
          </div>

          {/* Right Panel */}
          {panelPositions.right && renderPanel(panelPositions.right, 'right')}
        </div>
      )}

      {/* Bottom Bar - Workspace Toggles */}
      <div className="bg-surface-high border-t border-void-gray px-6 py-2 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          {!showMediaLibrary && (
            <button
              onClick={() => setShowMediaLibrary(true)}
              className="btn-ghost text-xs flex items-center gap-2"
              title="Show Media Library"
            >
              <PanelLeftOpen size={14} />
              Media Library
            </button>
          )}

          {!showInspector && (
            <button
              onClick={() => setShowInspector(true)}
              className="btn-ghost text-xs flex items-center gap-2"
              title="Show Inspector"
            >
              <PanelRightOpen size={14} />
              Inspector
            </button>
          )}

          {(!showMediaLibrary || !showInspector) && <div className="w-px h-4 bg-void-gray" />}

          <button
            onClick={() => setShowTimeline(!showTimeline)}
            className={`btn-ghost text-xs flex items-center gap-2 ${
              showTimeline ? 'text-accent-indigo' : ''
            }`}
          >
            {showTimeline ? <Eye size={14} /> : <EyeOff size={14} />}
            Timeline
          </button>

          <button
            onClick={() => setShowBucket(!showBucket)}
            className={`btn-ghost text-xs flex items-center gap-2 ${
              showBucket ? 'text-accent-indigo' : ''
            }`}
          >
            {showBucket ? <Eye size={14} /> : <EyeOff size={14} />}
            Bucket
          </button>

          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`btn-ghost text-xs flex items-center gap-2 ${
              showPreview ? 'text-accent-indigo' : ''
            }`}
          >
            {showPreview ? <Eye size={14} /> : <EyeOff size={14} />}
            Preview
          </button>

          <button
            onClick={() => setFullScreen(!fullScreen)}
            className={`btn-ghost text-xs flex items-center gap-2 ${
              fullScreen ? 'text-accent-indigo' : ''
            }`}
          >
            <Maximize2 size={14} />
            {fullScreen ? 'Canvas Focus' : 'Timeline Focus'}
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs text-text-tertiary">
          <span>47 nodes</span>
          <span>•</span>
          <span className="timecode">00:24:15:18</span>
          <span>•</span>
          <span>No conflicts</span>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu.show && contextMenu.node && (
        <NodeContextMenu
          node={contextMenu.node}
          position={contextMenu.position}
          onClose={() => setContextMenu({ show: false, position: { x: 0, y: 0 }, node: null })}
          onChangeType={handleChangeNodeType}
          onUnlink={handleUnlinkNode}
        />
      )}
    </div>
  );
};

export default CanvasView;
