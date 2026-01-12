/**
 * Topology Utilities (Renderer)
 * Client-side position calculations for anchor chains
 * Phase 4: Single Anchor System with Connection Modes
 */

import { StoryNode, ConnectionMode } from '../../../shared/types';

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
 * Calculate absolute position from anchor chain
 * For canvas rendering, we still use pixel positions (x, y)
 * The temporal calculations (time, track) will be used in timeline view
 */
export const calculateAbsolutePosition = (
  node: StoryNode,
  nodeMap: Map<string, StoryNode>
): { x: number; y: number } => {
  // For now, just return the node's position
  // Later phases will implement proper temporal-to-spatial conversion
  return { x: node.x, y: node.y };
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
    const { x, y } = calculateAbsolutePosition(node, nodeMap);
    const generation = calculateGeneration(node, nodeMap);
    const duration = calculateDuration(node);

    return {
      ...node,
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
  connectionMode?: ConnectionMode
}> => {
  const edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle: string;
    targetHandle: string;
    connectionMode?: ConnectionMode
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
      });
    }
  });

  return edges;
};
