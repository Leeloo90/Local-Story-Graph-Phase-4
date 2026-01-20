import React, { useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { StoryNode as StoryNodeType, MediaAsset, ConnectionMode, FractalContainer, ReactFlowNodeData } from '../../../shared/types';
import {
  ArrowLeft,
  Maximize2,
  Eye,
  Link,
  Unlink,
  FileDown,
  Archive,
  Layers,
  Film,
  Plus,
} from 'lucide-react';
import SpineNode from './nodes/SpineNode';
import SatelliteNode from './nodes/SatelliteNode';
import MulticamNode from './nodes/MulticamNode';
import ContainerNode from './nodes/ContainerNode';
import TimelineView from './TimelineView';
import InspectorPanel from './InspectorPanel';
import MediaLibraryPanel from './MediaLibraryPanel';
import NodeContextMenu from './NodeContextMenu';
import BucketPanel from './BucketPanel';
import IsolationViewer from './IsolationViewer';
import { computeAbsolutePositions, getAnchorEdges, calculateTreeBounds } from '../utils/topology'; 

interface CanvasViewProps {
  projectId: string;
  canvasId: string;
  onBack: () => void;
}

const nodeTypes = {
  spine: SpineNode,
  satellite: SatelliteNode,
  multicam: MulticamNode,
  container: ContainerNode,
};

const CanvasViewContent: React.FC<CanvasViewProps> = ({ projectId, canvasId, onBack }) => {
  const { screenToFlowPosition, setViewport } = useReactFlow();
  const viewport = useViewport();

  const [showTimeline, setShowTimeline] = useState(true);
  const [showBucket, setShowBucket] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [linkToggle, setLinkToggle] = useState(false);
  const [_proxyMode, _setProxyMode] = useState(false); // Reserved for future use
  const [_fullScreen, _setFullScreen] = useState(false); // Reserved for future use
  const [timelineFullscreen, setTimelineFullscreen] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(true);
  const [showInspector, setShowInspector] = useState(true);

  const [showIsolationViewer, setShowIsolationViewer] = useState(false);
  const [isolatedMulticamNode, setIsolatedMulticamNode] = useState<StoryNodeType | null>(null);

  // Panel positioning state
  const [panelPositions, setPanelPositions] = useState<{
    left: 'media-library' | 'inspector' | null;
    right: 'media-library' | 'inspector' | null;
  }>({
    left: 'media-library',
    right: 'inspector',
  });

  // Drag state
  const [draggingPanel, setDraggingPanel] = useState<'media-library' | 'inspector' | null>(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [showDropZones, setShowDropZones] = useState(false);

  // Visual Feedback State
  const [dragTarget, setDragTarget] = useState<{
    nodeId: string;
    mode: ConnectionMode;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Node relinking state - tracks when dragging an existing node to relink it
  const [draggingNode, setDraggingNode] = useState<{
    id: string;
    originalAnchorId: string | undefined;
    originalConnectionMode: ConnectionMode | undefined;
    originalPosition: { x: number; y: number };
    prependChildren: StoryNodeType[];  // PREPEND children to handle based on Link Mode
    appendChildren: StoryNodeType[];   // APPEND children to handle based on Link Mode
  } | null>(null);

  // Preview box state
  const [previewPosition, setPreviewPosition] = useState({
    x: Math.max(20, window.innerWidth - 400),
    y: Math.max(20, window.innerHeight - 320)
  });
  const [previewSize, _setPreviewSize] = useState({ width: 320, height: 240 }); // Reserved for resize
  const [isDraggingPreview, setIsDraggingPreview] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Nodes & Edges
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [bucketItems, setBucketItems] = useState<StoryNodeType[]>([]);

  // Containers (Phase 5)
  const [containers, setContainers] = useState<FractalContainer[]>([]);
  const [showContainerMenu, setShowContainerMenu] = useState(false);

  // Context Menu
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    position: { x: number; y: number };
    node: StoryNodeType | null;
  }>({
    show: false,
    position: { x: 0, y: 0 },
    node: null,
  });

  // Load Data
  useEffect(() => {
    loadCanvasNodes();
  }, [canvasId, projectId]);

  // Fit view to show entire tree when nodes change significantly
  const fitViewToTree = useCallback(() => {
    if (nodes.length === 0) return;

    // Get all story nodes to calculate bounds
    const storyNodes = nodes.map(n => n.data.storyNode as StoryNodeType).filter(Boolean);
    const bounds = calculateTreeBounds(storyNodes);

    if (bounds.minX === Infinity) return;

    // Add padding around the tree
    const padding = 100;
    const treeWidth = bounds.maxX - bounds.minX + padding * 2;
    const treeHeight = bounds.maxY - bounds.minY + padding * 2;

    // Get canvas dimensions (approximate based on window)
    const canvasWidth = window.innerWidth - (showMediaLibrary ? 320 : 0) - (showInspector ? 380 : 0);
    const canvasHeight = window.innerHeight - (showTimeline ? 256 : 0) - 150; // Header + footer

    // Calculate zoom level to fit entire tree
    const zoomX = canvasWidth / treeWidth;
    const zoomY = canvasHeight / treeHeight;
    const zoom = Math.min(zoomX, zoomY, 1); // Don't zoom in beyond 1

    // Calculate center position
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    // Set viewport to center on tree with calculated zoom
    setViewport({
      x: canvasWidth / 2 - centerX * zoom,
      y: canvasHeight / 2 - centerY * zoom,
      zoom: Math.max(0.1, zoom), // Minimum zoom of 0.1
    });
  }, [nodes, showMediaLibrary, showInspector, showTimeline, setViewport]);

  const loadCanvasNodes = async () => {
    try {
      // Load containers (Phase 5)
      const canvasContainers: FractalContainer[] = await window.electronAPI.containerList(canvasId);
      setContainers(canvasContainers);

      const storyNodes: StoryNodeType[] = await window.electronAPI.nodeList(canvasId);
      const computedNodes = computeAbsolutePositions(storyNodes);

      // Load media assets to get file names
      const mediaAssets: MediaAsset[] = await window.electronAPI.mediaGetAll(projectId);
      const assetMap = new Map(mediaAssets.map(a => [a.id, a]));

      const rootNode = computedNodes.find(n => !n.anchor_id && n.type === 'SPINE');

      const bucketNodes = computedNodes.filter(n => {
        if (n.anchor_id) return false;
        if (n.id === rootNode?.id) return false;
        return true;
      });

      const assemblyNodes = computedNodes.filter(n => !bucketNodes.includes(n));

      // Create container nodes (rendered behind story nodes)
      const containerNodes: Node[] = canvasContainers.map((c) => ({
        id: `container-${c.id}`,
        type: 'container',
        position: { x: c.x, y: c.y },
        style: { width: c.width, height: c.height },
        data: {
          container: c,
          onDelete: handleDeleteContainer,
          onRename: handleRenameContainer,
          onResize: handleResizeContainer,
        },
        zIndex: -1, // Behind story nodes
      }));

      const flowNodes: Node[] = assemblyNodes.map((n) => {
        const asset = n.asset_id ? assetMap.get(n.asset_id) : undefined;
        return {
          id: n.id,
          type: n.type === 'SPINE' ? 'spine' : 'satellite',
          position: { x: n.x, y: n.y },
          data: {
            storyNode: n,
            asset: asset,
            label: asset?.clean_name || asset?.file_name || n.asset_id || 'Untitled',
          },
        };
      });

      const anchorEdges = getAnchorEdges(assemblyNodes);

      // Combine container nodes and story nodes
      setNodes([...containerNodes, ...flowNodes]);
      setEdges(anchorEdges as Edge[]);
      setBucketItems(bucketNodes);

    } catch (error) {
      console.error('[Canvas] Failed to load nodes:', error);
    }
  };

  // Container handlers (Phase 5)
  const handleCreateContainer = useCallback(async (type: 'ACT' | 'SCENE') => {
    try {
      const name = type === 'ACT' ? `Act ${containers.filter(c => c.type === 'ACT').length + 1}` : `Scene ${containers.filter(c => c.type === 'SCENE').length + 1}`;

      const containerData: Omit<FractalContainer, 'id'> = {
        project_id: projectId,
        canvas_id: canvasId,
        type,
        name,
        x: 50,
        y: type === 'ACT' ? -100 : 50,
        width: type === 'ACT' ? 800 : 400,
        height: type === 'ACT' ? 600 : 300,
      };

      await window.electronAPI.containerCreate(canvasId, containerData);
      await loadCanvasNodes();
      setShowContainerMenu(false);
    } catch (error) {
      console.error('[Canvas] Failed to create container:', error);
    }
  }, [canvasId, projectId, containers, loadCanvasNodes]);

  const handleDeleteContainer = useCallback(async (containerId: string) => {
    try {
      // Extract actual ID from the node ID (remove 'container-' prefix)
      const actualId = containerId.replace('container-', '');
      await window.electronAPI.containerDelete(actualId);
      await loadCanvasNodes();
    } catch (error) {
      console.error('[Canvas] Failed to delete container:', error);
    }
  }, [loadCanvasNodes]);

  const handleRenameContainer = useCallback(async (containerId: string, newName: string) => {
    try {
      await window.electronAPI.containerUpdate(containerId, { name: newName });
      await loadCanvasNodes();
    } catch (error) {
      console.error('[Canvas] Failed to rename container:', error);
    }
  }, [loadCanvasNodes]);

  const handleResizeContainer = useCallback(async (containerId: string, width: number, height: number) => {
    try {
      const container = containers.find(c => c.id === containerId);
      if (container) {
        await window.electronAPI.containerUpdateBounds(containerId, container.x, container.y, width, height);
      }
    } catch (error) {
      console.error('[Canvas] Failed to resize container:', error);
    }
  }, [containers]);

  // Constants for ghost box positioning
  const GHOST_GAP = 20; // Gap between node and ghost box in flow coordinates
  const BUFFER_ZONE = 80; // Buffer zone around nodes for hover detection

  const getDropModeFromZone = (mouseX: number, mouseY: number, node: Node): ConnectionMode | null => {
    const nx = node.position.x;
    const ny = node.position.y;
    const nw = node.width || 200;
    const nh = node.height || 150;

    // Check if mouse is in the extended zone (node + buffer)
    const inLeftZone = mouseX >= nx - BUFFER_ZONE && mouseX < nx && mouseY >= ny && mouseY <= ny + nh;
    const inRightZone = mouseX > nx + nw && mouseX <= nx + nw + BUFFER_ZONE && mouseY >= ny && mouseY <= ny + nh;
    const inTopZone = mouseY >= ny - BUFFER_ZONE && mouseY < ny && mouseX >= nx && mouseX <= nx + nw;

    // Inside the node - use quadrant detection
    const insideNode = mouseX >= nx && mouseX <= nx + nw && mouseY >= ny && mouseY <= ny + nh;

    if (inLeftZone) return 'PREPEND';
    if (inRightZone) return 'APPEND';
    if (inTopZone) return 'STACK';

    if (insideNode) {
      const relX = (mouseX - nx) / nw;
      const relY = (mouseY - ny) / nh;

      // Top 30% of node = STACK
      if (relY < 0.3) return 'STACK';
      // Left 25% = PREPEND
      if (relX < 0.25) return 'PREPEND';
      // Right 25% = APPEND
      if (relX > 0.75) return 'APPEND';
      // Middle = STACK (default)
      return 'STACK';
    }

    return null;
  };

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';

    const { x, y } = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    // Find node with expanded hit area (including buffer zones)
    const targetNode = nodes.find(n => {
      const nx = n.position.x;
      const ny = n.position.y;
      const nw = n.width || 200;
      const nh = n.height || 150;
      // Expanded bounds including buffer zone
      return x >= nx - BUFFER_ZONE && x <= nx + nw + BUFFER_ZONE &&
             y >= ny - BUFFER_ZONE && y <= ny + nh;
    });

    if (targetNode) {
      const mode = getDropModeFromZone(x, y, targetNode);
      if (mode) {
        setDragTarget({
          nodeId: targetNode.id,
          mode,
          x: targetNode.position.x,
          y: targetNode.position.y,
          width: targetNode.width || 200,
          height: targetNode.height || 150
        });
      } else {
        setDragTarget(null);
      }
    } else {
      setDragTarget(null);
    }
  }, [nodes, screenToFlowPosition]);

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      setDragTarget(null);

      const data = event.dataTransfer.getData('application/media-asset');
      if (!data) return;

      try {
        const asset: MediaAsset = JSON.parse(data);
        const { x, y } = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        const existingNodes = await window.electronAPI.nodeList(canvasId);
        const hasRoot = existingNodes.some((n: StoryNodeType) => !n.anchor_id && n.type === 'SPINE');

        // Determine default type
        let nodeType = asset.media_type === 'DIALOGUE' ? 'SPINE' : 'SATELLITE';
        const subtype = asset.media_type === 'MUSIC' ? 'MUSIC' : 'VIDEO';

        if (!hasRoot) {
          const rootNode: Omit<StoryNodeType, 'id'> = {
            asset_id: asset.id,
            type: 'SPINE', 
            subtype: subtype as any,
            is_global: false,
            x: 100, y: 400,
            width: 300, height: 150,
          };
          await window.electronAPI.nodeCreate(canvasId, rootNode);
          await loadCanvasNodes();
          return;
        }

        // Find target node using same expanded hit area as drag detection (includes buffer zones)
        const targetNode = nodes.find(n => {
          const nx = n.position.x;
          const ny = n.position.y;
          const nw = n.width || 200;
          const nh = n.height || 150;
          // Include buffer zone around nodes - same logic as handleDragOver
          return x >= nx - BUFFER_ZONE && x <= nx + nw + BUFFER_ZONE &&
                 y >= ny - BUFFER_ZONE && y <= ny + nh;
        });

        if (targetNode) {
          const mode = getDropModeFromZone(x, y, targetNode) || 'STACK';

          // Coupler & Stack visual constants
          const COUPLER_GAP = 10; // px gap between spine cars (reduced from 50 → 20 → 10)
          const STACK_GAP = 6; // px gap between stacked satellite and parent (reduced from 12 → 6)

          // Phase: DNA Rules
          // Rule A: Dropping onto a Satellite makes the new node a Satellite
          const parentStoryNode = targetNode.data.storyNode as StoryNodeType;
          if (parentStoryNode && parentStoryNode.type === 'SATELLITE') {
            nodeType = 'SATELLITE';
          } else if (parentStoryNode && parentStoryNode.type === 'SPINE') {
            // If hitting coupler areas (PREPEND/APPEND), create SPINE; center area => SATELLITE
            if (mode === 'PREPEND' || mode === 'APPEND') nodeType = 'SPINE';
            else nodeType = 'SATELLITE';
          }

          const childWidth = nodeType === 'SPINE' ? 300 : 240;
          const childHeight = nodeType === 'SPINE' ? 150 : 180;

          // Compute drop snap position based on mode
          let desiredX = x;
          let desiredY = y;

          if (mode === 'PREPEND') {
            // Place child to the left with coupler gap, vertically aligned
            desiredX = targetNode.position.x - (childWidth + COUPLER_GAP);
            desiredY = targetNode.position.y;
          } else if (mode === 'APPEND') {
            // Place child to the right with coupler gap, vertically aligned
            desiredX = targetNode.position.x + (targetNode.width || 300) + COUPLER_GAP;
            desiredY = targetNode.position.y;
          } else {
            // STACK: center horizontally above parent with small gap
            const parentW = targetNode.width || 300;
            desiredX = targetNode.position.x + Math.round((parentW - childWidth) / 2);
            desiredY = targetNode.position.y - (childHeight + STACK_GAP);
          }

          const newNode: Omit<StoryNodeType, 'id'> = {
            asset_id: asset.id,
            type: nodeType as any,
            subtype: subtype as any,
            is_global: false,
            x: desiredX,
            y: desiredY,
            width: childWidth,
            height: childHeight,
          };

          const createdNode = await window.electronAPI.nodeCreate(canvasId, newNode);

          // Persist the drop position immediately so the main process can compute smart drift
          await window.electronAPI.nodeUpdatePosition(createdNode.id, desiredX, desiredY);

          // Check if there's already a child at this anchor position
          // If so, we need to "insert" the new node between parent and existing child
          const existingChildAtPosition = existingNodes.find((n: StoryNodeType) =>
            n.anchor_id === targetNode.id && n.connection_mode === mode
          );

          const validation = await window.electronAPI.nodeValidateAnchor(createdNode.id, targetNode.id, mode);
          if (!validation.valid) {
            alert(`Invalid Move: ${validation.reason}`);
            // Clean up the created node on invalid anchor
            await window.electronAPI.nodeDelete(createdNode.id);
            return;
          }

          const linkResult = await window.electronAPI.nodeLink(createdNode.id, targetNode.id, mode);
          if (!linkResult.success) {
            console.error('[Canvas] Failed to link node:', linkResult.error);
            alert(`Failed to link node: ${linkResult.error}`);
            await window.electronAPI.nodeDelete(createdNode.id);
            return;
          }

          // If there was an existing child at this position, re-parent it to the new node
          // This creates the "insertion" behavior: Parent -> NewNode -> OldChild
          if (existingChildAtPosition) {
            console.log('[Canvas] Inserting node - re-parenting existing child:', existingChildAtPosition.id);

            // The existing child should now connect to the new node with the same connection mode
            const relinkResult = await window.electronAPI.nodeLink(
              existingChildAtPosition.id,
              createdNode.id,
              mode
            );

            if (!relinkResult.success) {
              console.warn('[Canvas] Failed to re-parent existing child:', relinkResult.error);
              // Don't fail the whole operation, just log it
            }
          }

          await loadCanvasNodes();

        } else {
          console.log('[Canvas] Dropped in Void -> Bucket');
          const bucketNode: Omit<StoryNodeType, 'id'> = {
            asset_id: asset.id,
            type: nodeType as any,
            subtype: subtype as any,
            is_global: false,
            x: -1000,
            y: 0,
            width: 240,
            height: 180,
          };
          await window.electronAPI.nodeCreate(canvasId, bucketNode);
          await loadCanvasNodes();
          if (!showBucket) setShowBucket(true);
        }

      } catch (error) {
        console.error('[Canvas] Drop Error:', error);
      }
    },
    [nodes, canvasId, showBucket, screenToFlowPosition]
  );

  const handleDeleteNode = useCallback(async (nodeId: string) => {
    await window.electronAPI.nodeDelete(nodeId);
    await loadCanvasNodes();
  }, [loadCanvasNodes]);

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    const storyNode = node.data.storyNode as StoryNodeType;
    if (!storyNode) return;
    setContextMenu({
      show: true,
      position: { x: event.clientX, y: event.clientY },
      node: storyNode,
    });
  }, []);

  const handleChangeNodeType = useCallback(async (nodeId: string, newType: 'SPINE' | 'SATELLITE') => {
    await window.electronAPI.nodeChangeType(nodeId, newType);
    await loadCanvasNodes();
  }, [loadCanvasNodes]);

  const handleUnlinkNode = useCallback(async (nodeId: string) => {
    await window.electronAPI.nodeUnlink(nodeId);
    await loadCanvasNodes();
  }, [loadCanvasNodes]);

  const isValidConnection = useCallback(() => false, []);
  const onConnect = useCallback(() => console.warn('[Canvas] Wire dragging disabled. Use Drop-to-Snap.'), []);

  // Node drag handlers for relinking existing nodes
  const handleNodeDragStart = useCallback(async (_event: React.MouseEvent, node: Node) => {
    const storyNode = node.data.storyNode as StoryNodeType;
    if (!storyNode) return;

    // Find PREPEND and APPEND children of this node
    const allNodes = await window.electronAPI.nodeList(canvasId);
    const prependChildren = allNodes.filter((n: StoryNodeType) =>
      n.anchor_id === node.id && n.connection_mode === 'PREPEND'
    );
    const appendChildren = allNodes.filter((n: StoryNodeType) =>
      n.anchor_id === node.id && n.connection_mode === 'APPEND'
    );

    // Store original anchor info for potential restoration/snap-back
    setDraggingNode({
      id: node.id,
      originalAnchorId: storyNode.anchor_id,
      originalConnectionMode: storyNode.connection_mode,
      originalPosition: { x: node.position.x, y: node.position.y },
      prependChildren,
      appendChildren,
    });

    // Unlink the node from its parent (it will be relinked on drop)
    if (storyNode.anchor_id) {
      console.log('[Canvas] Node drag start - unlinking node:', node.id);
      await window.electronAPI.nodeUnlink(node.id);

      // Link Mode OFF: Re-parent PREPEND/APPEND children to the original parent
      // Link Mode ON: Children move with the node (no action needed here)
      if (!linkToggle && storyNode.anchor_id) {
        for (const child of prependChildren) {
          // Calculate new drift to maintain same timeline position
          const childStoryNode = child as StoryNodeType;
          const originalParentDrift = storyNode.drift_x || 0;
          const childDrift = childStoryNode.drift_x || 0;
          // The child's absolute position was: parentDrift + childDrift
          // After re-parenting to grandparent, new drift should be: originalParentDrift + childDrift
          const newDrift = originalParentDrift + childDrift;

          await window.electronAPI.nodeUnlink(child.id);
          await window.electronAPI.nodeLink(child.id, storyNode.anchor_id, 'PREPEND');
          await window.electronAPI.nodeUpdateDrift(child.id, newDrift, childStoryNode.drift_y || 0);
        }
        for (const child of appendChildren) {
          const childStoryNode = child as StoryNodeType;
          const originalParentDrift = storyNode.drift_x || 0;
          const childDrift = childStoryNode.drift_x || 0;
          const newDrift = originalParentDrift + childDrift;

          await window.electronAPI.nodeUnlink(child.id);
          await window.electronAPI.nodeLink(child.id, storyNode.anchor_id, 'APPEND');
          await window.electronAPI.nodeUpdateDrift(child.id, newDrift, childStoryNode.drift_y || 0);
        }
      }
    }
  }, [canvasId, linkToggle]);

  const handleNodeDrag = useCallback((_event: React.MouseEvent, node: Node) => {
    if (!draggingNode) return;

    // Get current position of the dragged node
    const x = node.position.x;
    const y = node.position.y;
    const draggedWidth = node.width || 200;
    const draggedHeight = node.height || 150;

    // Find potential target node (excluding the dragged node and its descendants)
    const targetNode = nodes.find(n => {
      if (n.id === draggingNode.id) return false;

      // Check if this node is a descendant of the dragged node (can't anchor to own children)
      const checkIsDescendant = (checkId: string): boolean => {
        const checkNode = nodes.find(nn => nn.id === checkId);
        if (!checkNode) return false;
        const checkStoryNode = checkNode.data.storyNode as StoryNodeType;
        if (!checkStoryNode?.anchor_id) return false;
        if (checkStoryNode.anchor_id === draggingNode.id) return true;
        return checkIsDescendant(checkStoryNode.anchor_id);
      };
      if (checkIsDescendant(n.id)) return false;

      const nx = n.position.x;
      const ny = n.position.y;
      const nw = n.width || 200;
      const nh = n.height || 150;

      // Check if dragged node overlaps with buffer zone of this node
      const dragCenterX = x + draggedWidth / 2;
      const dragCenterY = y + draggedHeight / 2;

      return dragCenterX >= nx - BUFFER_ZONE && dragCenterX <= nx + nw + BUFFER_ZONE &&
             dragCenterY >= ny - BUFFER_ZONE && dragCenterY <= ny + nh;
    });

    if (targetNode) {
      // Use center of dragged node for zone detection
      const dragCenterX = x + draggedWidth / 2;
      const dragCenterY = y + draggedHeight / 2;
      const mode = getDropModeFromZone(dragCenterX, dragCenterY, targetNode);

      if (mode) {
        setDragTarget({
          nodeId: targetNode.id,
          mode,
          x: targetNode.position.x,
          y: targetNode.position.y,
          width: targetNode.width || 200,
          height: targetNode.height || 150
        });
      } else {
        setDragTarget(null);
      }
    } else {
      setDragTarget(null);
    }
  }, [draggingNode, nodes, getDropModeFromZone, BUFFER_ZONE]);

  const handleNodeDragStop = useCallback(async (_event: React.MouseEvent, node: Node) => {
    try {
      if (draggingNode) {
        // This is a relink operation
        if (dragTarget) {
          // Found a target - link to it
          const mode = dragTarget.mode;
          const targetNodeId = dragTarget.nodeId;

          console.log('[Canvas] Relinking node', node.id, 'to', targetNodeId, 'with mode', mode);

          // Check for existing child at this position (for insertion behavior)
          const existingNodes = await window.electronAPI.nodeList(canvasId);
          const existingChildAtPosition = existingNodes.find((n: StoryNodeType) =>
            n.anchor_id === targetNodeId && n.connection_mode === mode
          );

          // Validate the new anchor
          const validation = await window.electronAPI.nodeValidateAnchor(node.id, targetNodeId, mode);
          if (!validation.valid) {
            console.warn('[Canvas] Invalid relink:', validation.reason);
            // Snap back: Restore original link and position
            if (draggingNode.originalAnchorId && draggingNode.originalConnectionMode) {
              await window.electronAPI.nodeLink(node.id, draggingNode.originalAnchorId, draggingNode.originalConnectionMode);
            }
            await window.electronAPI.nodeUpdatePosition(node.id, draggingNode.originalPosition.x, draggingNode.originalPosition.y);
            await loadCanvasNodes();
            setDraggingNode(null);
            setDragTarget(null);
            return;
          }

          // Link to new parent
          const linkResult = await window.electronAPI.nodeLink(node.id, targetNodeId, mode);
          if (!linkResult.success) {
            console.error('[Canvas] Failed to relink node:', linkResult.error);
            // Snap back: Restore original link and position
            if (draggingNode.originalAnchorId && draggingNode.originalConnectionMode) {
              await window.electronAPI.nodeLink(node.id, draggingNode.originalAnchorId, draggingNode.originalConnectionMode);
            }
            await window.electronAPI.nodeUpdatePosition(node.id, draggingNode.originalPosition.x, draggingNode.originalPosition.y);
          } else {
            // Success! Handle insertion behavior
            if (existingChildAtPosition && existingChildAtPosition.id !== node.id) {
              console.log('[Canvas] Inserting - re-parenting existing child:', existingChildAtPosition.id);
              await window.electronAPI.nodeLink(existingChildAtPosition.id, node.id, mode);
            }

            // Link Mode ON: PREPEND/APPEND children stay linked to this node
            // They move with the parent automatically through topology recalculation
            // No additional action needed - children are already connected
          }
        } else {
          // No target - check if this was a bucket drop or should snap back

          // Check if dropped over the bucket panel area (left side, x < 0 in flow coords)
          const isOverBucket = node.position.x < 0 || showBucket;

          if (isOverBucket || !draggingNode.originalAnchorId) {
            // Move to bucket
            console.log('[Canvas] Node dropped in void - moving to bucket');
            await window.electronAPI.nodeUpdatePosition(node.id, -1000, 0);
            if (!showBucket) setShowBucket(true);
          } else {
            // Snap back: Restore original link and position
            console.log('[Canvas] No valid target - snapping back to original position');
            await window.electronAPI.nodeLink(node.id, draggingNode.originalAnchorId, draggingNode.originalConnectionMode!);
            await window.electronAPI.nodeUpdatePosition(node.id, draggingNode.originalPosition.x, draggingNode.originalPosition.y);

            // Link Mode OFF: Need to restore the children that were re-parented
            if (!linkToggle) {
              for (const child of draggingNode.prependChildren) {
                await window.electronAPI.nodeUnlink(child.id);
                await window.electronAPI.nodeLink(child.id, node.id, 'PREPEND');
              }
              for (const child of draggingNode.appendChildren) {
                await window.electronAPI.nodeUnlink(child.id);
                await window.electronAPI.nodeLink(child.id, node.id, 'APPEND');
              }
            }
          }
        }

        setDraggingNode(null);
        setDragTarget(null);
        await loadCanvasNodes();
      } else {
        // Normal drag (not a relink) - just update position
        await window.electronAPI.nodeUpdatePosition(node.id, node.position.x, node.position.y);
        await loadCanvasNodes();
      }
    } catch (err) {
      console.error('[Canvas] Node drag stop error:', err);
      setDraggingNode(null);
      setDragTarget(null);
    }
  }, [draggingNode, dragTarget, canvasId, showBucket, linkToggle, loadCanvasNodes]);

  // Panel Drag Handlers...
  const handlePanelDragStart = useCallback((panel: 'media-library' | 'inspector', e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest('.panel-drag-handle')) return;
    setDraggingPanel(panel);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setShowDropZones(true);
  }, []);

  const handlePanelDragMove = useCallback((e: MouseEvent) => {
    if (!draggingPanel) return;
    const deltaX = Math.abs(e.clientX - dragStartPos.x);
    if (deltaX > 10) setShowDropZones(true);
  }, [draggingPanel, dragStartPos]);

  const handlePanelDrop = useCallback((e: MouseEvent) => {
    if (!draggingPanel) return;
    const dropX = e.clientX;
    const windowWidth = window.innerWidth;
    
    if (dropX < windowWidth * 0.3) {
      if (panelPositions.left !== draggingPanel) {
        setPanelPositions({
          left: draggingPanel,
          right: panelPositions.left === 'media-library' ? 'media-library' : 'inspector',
        });
      }
    } else if (dropX > windowWidth * 0.7) {
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

  const handlePreviewMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.preview-drag-handle')) {
      setIsDraggingPreview(true);
      setDragOffset({ x: e.clientX - previewPosition.x, y: e.clientY - previewPosition.y });
    }
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingPreview) {
        setPreviewPosition({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
      }
    };
    const handleMouseUp = () => setIsDraggingPreview(false);
    if (isDraggingPreview) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingPreview, dragOffset]);

  // Ghost Box - Calculate position in FLOW coordinates (scales with zoom automatically)
  const getGhostBoxFlowPosition = () => {
    if (!dragTarget) return null;

    const { x, y, width, height } = dragTarget;

    // Ghost box has SAME dimensions as the target node
    const ghostWidth = width;
    const ghostHeight = height;

    let ghostX = x;
    let ghostY = y;

    if (dragTarget.mode === 'PREPEND') {
      // Position ghost to the LEFT of the node with gap
      ghostX = x - ghostWidth - GHOST_GAP;
      ghostY = y; // Same vertical position
    } else if (dragTarget.mode === 'APPEND') {
      // Position ghost to the RIGHT of the node with gap
      ghostX = x + width + GHOST_GAP;
      ghostY = y; // Same vertical position
    } else if (dragTarget.mode === 'STACK') {
      // Position ghost ABOVE the node with gap
      ghostX = x; // Same horizontal position
      ghostY = y - ghostHeight - GHOST_GAP;
    }

    return { x: ghostX, y: ghostY, width: ghostWidth, height: ghostHeight };
  };

  const timelineHeight = _fullScreen ? 400 : showTimeline ? 256 : 0;
  const mediaLibraryWidth = showMediaLibrary ? 320 : 0;
  const inspectorWidth = showInspector ? 380 : 0;

  const { getNodes } = useReactFlow();
  const selectedNode = (getNodes().find(n => n.selected)?.data as ReactFlowNodeData | undefined)?.storyNode;

  const renderPanel = (panelType: 'media-library' | 'inspector', position: 'left' | 'right') => {
    const isVisible = panelType === 'media-library' ? showMediaLibrary : showInspector;
    const width = panelType === 'media-library' ? mediaLibraryWidth : inspectorWidth;
    
    if (!isVisible) return null;

    return (
      <div
        key={panelType}
        style={{ width }}
        className={`bg-surface-high ${position === 'left' ? 'border-r' : 'border-l'} border-void-gray flex flex-col ${
          draggingPanel === panelType ? 'opacity-50' : ''
        }`}
        onMouseDown={(e) => handlePanelDragStart(panelType, e)}
      >
        {panelType === 'media-library' ? (
          <MediaLibraryPanel
            projectId={projectId}
            onToggleCollapse={() => setShowMediaLibrary(false)}
            position={position}
          />
        ) : (
          <InspectorPanel
            selectedNode={selectedNode}
            onToggleCollapse={() => setShowInspector(false)}
            position={position}
          />
        )}
      </div>
    );
  };

  return (
    <div className="w-screen h-screen bg-void flex flex-col overflow-hidden">
      <header className="bg-surface-high border-b border-void-gray px-6 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-text-tertiary hover:text-text-primary">
            <ArrowLeft size={20} />
          </button>
          <nav className="flex items-center gap-2 text-sm">
            <span className="text-text-secondary">Project</span>
            <span className="text-text-tertiary">/</span>
            <span className="text-text-primary font-medium">Canvas</span>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fitViewToTree} className="btn-ghost text-sm flex items-center gap-2" title="Fit view to show entire tree">
            <Maximize2 size={16} /> Fit
          </button>
          <button onClick={() => setLinkToggle(!linkToggle)} className={`btn-ghost text-sm flex items-center gap-2 ${linkToggle ? 'text-accent-indigo' : ''}`}>
            {linkToggle ? <Link size={16} /> : <Unlink size={16} />}
            {linkToggle ? 'Link ON' : 'Link OFF'}
          </button>
          <div className="w-px h-6 bg-void-gray" />
          {/* Container Creation (Phase 5) */}
          <div className="relative">
            <button
              onClick={() => setShowContainerMenu(!showContainerMenu)}
              className="btn-ghost text-sm flex items-center gap-2"
              title="Add Act or Scene"
            >
              <Plus size={16} /> Container
            </button>
            {showContainerMenu && (
              <div className="absolute top-full right-0 mt-1 bg-surface-high border border-void-gray rounded-lg shadow-lg z-50 py-1 min-w-[140px]">
                <button
                  onClick={() => handleCreateContainer('ACT')}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-void-gray flex items-center gap-2"
                >
                  <Layers size={14} className="text-accent-amber" /> Add Act
                </button>
                <button
                  onClick={() => handleCreateContainer('SCENE')}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-void-gray flex items-center gap-2"
                >
                  <Film size={14} className="text-green-500" /> Add Scene
                </button>
              </div>
            )}
          </div>
          <div className="w-px h-6 bg-void-gray" />
          <button
            onClick={async () => {
              const filePath = await window.electronAPI.selectFolder();
              if (filePath) {
                const result = await window.electronAPI.exportGenerateFCPXML(projectId, `${filePath}/export.fcpxml`);
                if (result.success) {
                  alert('FCPXML exported successfully!');
                } else {
                  alert(`FCPXML export failed: ${result.error}`);
                }
              }
            }}
            className="btn-primary text-sm flex items-center gap-2"
          >
            <FileDown size={16} /> Export XML
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {showDropZones && draggingPanel && (
          <>
            <div className="absolute left-0 w-1/3 h-full bg-accent-indigo/20 border-r-2 border-dashed border-accent-indigo z-50 pointer-events-none" />
            <div className="absolute right-0 w-1/3 h-full bg-accent-indigo/20 border-l-2 border-dashed border-accent-indigo z-50 pointer-events-none" />
          </>
        )}

        {panelPositions.left && renderPanel(panelPositions.left, 'left')}

        <div className="flex-1 flex flex-col overflow-hidden relative">
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
              onNodeDragStart={handleNodeDragStart}
              onNodeDrag={handleNodeDrag}
              onNodeDragStop={handleNodeDragStop}
              onNodeContextMenu={handleNodeContextMenu}
              onNodeDoubleClick={(_event, node) => {
                if (node.type === 'multicam' && node.data.storyNode) {
                  setIsolatedMulticamNode(node.data.storyNode as StoryNodeType);
                  setShowIsolationViewer(true);
                }
              }}
              nodeTypes={nodeTypes}
              fitView
              minZoom={0.05}
              maxZoom={2}
              className="bg-void"
            >
              <Background color="#2C2C2E" gap={20} size={1} />
              <Controls className="!bg-surface-high !border-void-gray" />
              <MiniMap className="!bg-surface-high !border-void-gray" />
            </ReactFlow>

            {dragTarget && (() => {
              const ghostPos = getGhostBoxFlowPosition();
              if (!ghostPos) return null;

              // Transform flow coordinates to screen coordinates using viewport
              const { x: vx, y: vy, zoom } = viewport;
              const screenX = ghostPos.x * zoom + vx;
              const screenY = ghostPos.y * zoom + vy;
              const screenW = ghostPos.width * zoom;
              const screenH = ghostPos.height * zoom;

              return (
                <div
                  className="absolute pointer-events-none border-2 border-dashed border-accent-indigo bg-accent-indigo/20 z-50 rounded-lg"
                  style={{
                    left: screenX,
                    top: screenY,
                    width: screenW,
                    height: screenH,
                  }}
                >
                  <div
                    className="absolute left-1/2 -translate-x-1/2 bg-accent-indigo text-white text-xs px-2 py-1 rounded"
                    style={{ top: -24 * zoom, fontSize: 12 * zoom }}
                  >
                    {dragTarget.mode}
                  </div>
                </div>
              );
            })()}

            {showPreview && !timelineFullscreen && (
              <div
                style={{
                  left: previewPosition.x,
                  top: previewPosition.y,
                  width: previewSize.width,
                }}
                className="absolute z-50 panel rounded-lg overflow-hidden shadow-node"
                onMouseDown={handlePreviewMouseDown}
              >
                <div className="preview-drag-handle panel-header cursor-grab active:cursor-grabbing">
                  <h4 className="text-xs font-semibold">Preview</h4>
                  <button onClick={() => setShowPreview(false)}>✕</button>
                </div>
                <div className="aspect-video bg-void-dark flex items-center justify-center">
                  <span className="text-xs text-text-tertiary">Video Preview</span>
                </div>
              </div>
            )}
          </div>

          {showTimeline && !timelineFullscreen && (
            <div style={{ height: timelineHeight }} className="border-t border-void-gray">
              <TimelineView canvasId={canvasId} projectId={projectId} isFullscreen={false} onToggleFullscreen={() => setTimelineFullscreen(true)} />
            </div>
          )}
          
          {showBucket && (
            <BucketPanel 
              isOpen={showBucket}
              items={bucketItems}
              onClose={() => setShowBucket(false)}
              onItemDelete={handleDeleteNode}
            />
          )}

          {showIsolationViewer && isolatedMulticamNode && (
            <IsolationViewer
              node={isolatedMulticamNode}
              onClose={() => {
                setShowIsolationViewer(false);
                setIsolatedMulticamNode(null);
              }}
            />
          )}
        </div>

        {panelPositions.right && renderPanel(panelPositions.right, 'right')}
      </div>

      <div className="bg-surface-high border-t border-void-gray px-6 py-2 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTimeline(!showTimeline)} className={`btn-ghost text-xs flex items-center gap-2 ${showTimeline ? 'text-accent-indigo' : ''}`}>
            <Eye size={14} /> Timeline
          </button>
          <button onClick={() => setShowBucket(!showBucket)} className={`btn-ghost text-xs flex items-center gap-2 ${showBucket ? 'text-accent-indigo' : ''}`}>
            <Archive size={14} /> Bucket ({bucketItems.length})
          </button>
        </div>
      </div>

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

const CanvasView: React.FC<CanvasViewProps> = (props) => {
  return (
    <ReactFlowProvider>
      <CanvasViewContent {...props} />
    </ReactFlowProvider>
  );
};

export default CanvasView;