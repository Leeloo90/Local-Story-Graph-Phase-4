/**
 * Topology Utilities (Renderer)
 * Client-side position calculations for anchor chains
 * Phase 4: Single Anchor System with Connection Modes - RUNTIME MATH
 */

import { StoryNode, ConnectionMode } from '../../../shared/types';

// Constants for layout - Must match your CSS/Component sizing
export const PIXELS_PER_SECOND = 20; // 1 sec = 20px
export const PIXELS_PER_TRACK = 120; // Vertical spacing between tracks

/**
 * Build a Map for fast node lookups
 */
export const buildNodeMap = (nodes: StoryNode[]): Map<string, StoryNode> => {
  return new Map(nodes.map((n) => [n.id, n]));
};

/**
 * Calculate node duration (clip_out - clip_in)
 */
export const calculateDuration = (node: StoryNode): number => {
  const clipIn = node.clip_in || 0;
  const clipOut = node.clip_out;

  if (clipOut !== undefined && clipOut !== null) {
    return clipOut - clipIn;
  }

  // If no clip_out, we can't determine duration yet
  return 0;
};

/**
 * RECURSIVE POSITION CALCULATION
 * Walks up the tree to find the absolute position based on anchors
 */
export const calculateAbsolutePosition = (
  node: StoryNode,
  nodeMap: Map<string, StoryNode>,
  visited: Set<string> = new Set()
): { x: number; y: number } => {
  // Cycle detection
  if (visited.has(node.id)) {
    console.error('[Topology] Cycle detected while calculating position for node:', node.id);
    return { x: node.x, y: node.y }; // Fallback to stored position
  }
  visited.add(node.id);

  // Base Case: If no anchor, use the stored absolute coordinates (Root Node)
  if (!node.anchor_id) {
    return { x: node.x, y: node.y };
  }

  // Recursive Step: Get Parent's calculated position
  const parent = nodeMap.get(node.anchor_id);
  if (!parent) {
    console.warn(`[Topology] Orphaned node ${node.id}: Parent ${node.anchor_id} not found.`);
    return { x: node.x, y: node.y }; // Fallback to absolute
  }

  const parentPos = calculateAbsolutePosition(parent, nodeMap, visited);
  const parentDuration = calculateDuration(parent);
  const parentWidth = parentDuration * PIXELS_PER_SECOND;

  // Calculate Offset based on Connection Mode
  let offsetX = 0;
  let offsetY = 0;

  // 1. Add the Base Offset (Where the port is)
  switch (node.connection_mode) {
    case 'STACK':
      // Top Port: Align with start of parent
      offsetX = 0;
      // Stack usually implies a track above.
      // NOTE: drift_y controls the track offset, but visually we might want a default gap.
      break;
    case 'PREPEND':
      // Left Port: Ends where parent starts
      // We subtract our own width (calculated via duration) to align right-edge to left-edge
      const myDuration = calculateDuration(node);
      offsetX = -(myDuration * PIXELS_PER_SECOND);
      break;
    case 'APPEND':
      // Right Port: Starts where parent ends
      offsetX = parentWidth;
      break;
  }

  // 2. Add the stored Drift (User adjustments)
  // drift_x is in seconds, so we scale it.
  offsetX += ((node.drift_x || 0) * PIXELS_PER_SECOND);

  // drift_y is track index.
  offsetY += ((node.drift_y || 0) * PIXELS_PER_TRACK);

  // Connection Mode 'STACK' usually forces at least 1 track up implicitly,
  // but let's rely on drift_y = 1 from the DB default.

  return {
    x: parentPos.x + offsetX,
    y: parentPos.y - offsetY // React Flow Y is positive downwards. Subtract to go UP.
  };
};

/**
 * Calculate generation (depth) in anchor chain
 */
export const calculateGeneration = (
  node: StoryNode,
  nodeMap: Map<string, StoryNode>
): number => {
  let generation = 0;
  let currentNode: StoryNode | undefined = node;
  const visited = new Set<string>();

  while (currentNode && currentNode.anchor_id) {
    if (visited.has(currentNode.id)) {
      console.error('[Topology] Cycle detected while calculating generation');
      break;
    }
    visited.add(currentNode.id);

    const parentNode = nodeMap.get(currentNode.anchor_id);
    if (!parentNode) break;

    generation++;
    currentNode = parentNode;
  }

  return generation;
};

/**
 * Compute absolute positions and generation for all nodes
 * Adds _computed field with calculated values
 */
export const computeAbsolutePositions = (nodes: StoryNode[]): StoryNode[] => {
  const nodeMap = buildNodeMap(nodes);

  return nodes.map((node) => {
    // This recurses up to the root for every node
    const { x, y } = calculateAbsolutePosition(node, nodeMap);
    const generation = calculateGeneration(node, nodeMap);
    const duration = calculateDuration(node);

    return {
      ...node,
      // Override x, y with calculated positions for React Flow
      x,
      y,
      _computed: {
        absoluteTime: 0, // Will be calculated when needed
        absoluteTrack: 0, // Will be calculated when needed
        duration,
        generation,
        hasAnchor: !!node.anchor_id,
      },
    };
  });
};

/**
 * Map Connection Mode to Target Handle ID
 */
const MODE_TO_HANDLE_ID: Record<string, string> = {
  'STACK': 'anchor-top',
  'PREPEND': 'anchor-left',
  'APPEND': 'anchor-right'
};

/**
 * Get all anchor relationships as edges
 * Returns array with proper handle IDs for React Flow edges
 */
export const getAnchorEdges = (
  nodes: StoryNode[]
): Array<{
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  connectionMode?: ConnectionMode;
  type: string;
  style: Record<string, any>;
  animated: boolean;
}> => {
  const edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle: string;
    targetHandle: string;
    connectionMode?: ConnectionMode;
    type: string;
    style: Record<string, any>;
    animated: boolean;
  }> = [];

  nodes.forEach((node) => {
    // Check if node has an anchor
    if (node.anchor_id && node.connection_mode) {
      const targetHandle = MODE_TO_HANDLE_ID[node.connection_mode] || 'anchor-top';

      edges.push({
        id: `anchor-${node.id}-${node.anchor_id}`,
        source: node.id, // Child (the one being anchored)
        target: node.anchor_id, // Parent (the anchor)
        sourceHandle: 'tether-source', // Child's output handle
        targetHandle: targetHandle, // Parent's specific port
        connectionMode: node.connection_mode,
        type: 'step',
        style: { stroke: '#2C2C2E', strokeWidth: 2 },
        animated: false,
      });
    }
  });

  return edges;
};
