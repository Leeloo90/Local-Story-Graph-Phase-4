/**
 * Topology Service
 * Handles anchor chain validation and position calculations
 * Phase 4: Single Anchor System with Connection Modes
 */

import { StoryNode, ConnectionMode } from '../../shared/types';

/**
 * Validate semantic anchor rules based on node types
 * Simplified for single anchor system
 */
export const validateSemanticRules = (
  _childNode: StoryNode,
  _parentNode: StoryNode,
  _connectionMode: ConnectionMode
): { valid: boolean; reason?: string } => {
  // Allow all connection types for now - semantic rules will be refined later
  // The main constraint is: no paradoxes (cycle detection handles this)
  return { valid: true };
};

/**
 * Validate that creating an anchor relationship won't create a cycle (paradox)
 * Returns true if safe, false if paradox detected
 *
 * @param nodes - Map of all nodes in the canvas
 * @param childId - ID of node that will be anchored
 * @param proposedParentId - ID of node that will be the parent
 * @returns boolean - true if safe, false if paradox
 */
export const validateAnchorChain = (
  nodes: Map<string, StoryNode>,
  childId: string,
  proposedParentId: string
): boolean => {
  // 1. Immediate Paradox: Linking to self
  if (childId === proposedParentId) {
    console.warn('[Topology] Paradox: Cannot anchor node to itself');
    return false;
  }

  // 2. Ancestry Check: Walk up anchor chain to check if child is an ancestor
  let currentId: string | null | undefined = proposedParentId;
  const visited = new Set<string>();

  while (currentId) {
    // Prevent infinite loops in case of data corruption
    if (visited.has(currentId)) {
      console.error('[Topology] Corrupted anchor chain detected (cycle exists)');
      return false;
    }
    visited.add(currentId);

    if (currentId === childId) {
      console.warn('[Topology] Paradox: Child is already an ancestor of proposed parent');
      return false; // PARADOX: The child is the ancestor of the parent
    }

    const node = nodes.get(currentId);
    if (!node) {
      console.error('[Topology] Node not found in chain:', currentId);
      break;
    }

    // Walk up the single anchor chain
    currentId = node.anchor_id;
  }

  return true; // Safe
};

/**
 * Calculate node duration (clip_out - clip_in)
 * If clip_out is not set, use asset duration or default to 0
 *
 * @param node - The node to calculate duration for
 * @returns number - Duration in seconds
 */
export const calculateDuration = (node: StoryNode): number => {
  const clipIn = node.clip_in || 0;
  const clipOut = node.clip_out;

  if (clipOut !== undefined && clipOut !== null) {
    return clipOut - clipIn;
  }

  // If no clip_out, we can't determine duration yet
  // This will be populated later when asset data is available
  return 0;
};

/**
 * Calculate the absolute time and track position of a node by walking up its anchor chain
 *
 * @param node - The node to calculate position for
 * @param nodes - Map of all nodes
 * @returns Object with absolute time and track coordinates
 */
export const calculateAbsolutePosition = (
  node: StoryNode,
  nodes: Map<string, StoryNode>
): { time: number; track: number } => {
  let time = 0;
  let track = 0;
  let currentNode: StoryNode | undefined = node;
  const visited = new Set<string>();

  // Walk up anchor chain, computing temporal position
  while (currentNode && currentNode.anchor_id) {
    // Prevent infinite loops
    if (visited.has(currentNode.id)) {
      console.error('[Topology] Cycle detected in anchor chain for node:', node.id);
      break;
    }
    visited.add(currentNode.id);

    const parentNode = nodes.get(currentNode.anchor_id);
    if (!parentNode) {
      console.warn('[Topology] Parent node not found:', currentNode.anchor_id);
      break;
    }

    // Calculate parent's absolute position recursively
    const parentPos = calculateAbsolutePosition(parentNode, nodes);
    const driftX = currentNode.drift_x || 0;
    const driftY = currentNode.drift_y || 0;

    switch (currentNode.connection_mode) {
      case 'STACK':
        // Vertical layering/compositing - floats directly above parent
        time = parentPos.time + driftX;
        track = parentPos.track + 1 + driftY;  // Default to one track above
        break;

      case 'PREPEND':
        // Plays before parent (lead-in)
        // drift_x is the GAP: 0 = touching, positive = gap before parent
        const duration = calculateDuration(currentNode);
        time = parentPos.time - duration - driftX;
        track = parentPos.track + driftY;
        break;

      case 'APPEND':
        // Plays after parent (lead-out)
        const parentDuration = calculateDuration(parentNode);
        time = parentPos.time + parentDuration + driftX;
        track = parentPos.track + driftY;
        break;

      default:
        // Default to STACK behavior
        time = parentPos.time + driftX;
        track = parentPos.track + driftY;
    }

    return { time, track };
  }

  // Root node (no anchor) - time and track are both 0
  return { time, track };
};

/**
 * Calculate the drift needed to preserve visual position when anchoring
 * For now, drift defaults to 0 (nodes attach directly)
 * Later phases can implement smart drift calculation
 *
 * @param childNode - Node being anchored
 * @param parentNode - Node it's being anchored to
 * @param connectionMode - How the connection is made
 * @param allNodes - Map of all nodes for position calculation
 * @returns Object with drift_x and drift_y
 */
export const calculateDriftToPreservePosition = (
  _childNode: StoryNode,
  _parentNode: StoryNode,
  _connectionMode: ConnectionMode,
  _allNodes: Map<string, StoryNode>
): { drift_x: number; drift_y: number } => {
  // For Phase 4, default drift is 0 (immediate attachment)
  // Later phases can implement smart positioning
  return { drift_x: 0, drift_y: 0 };
};

/**
 * Get all descendants of a node (nodes that are anchored to it, directly or indirectly)
 *
 * @param nodeId - ID of the parent node
 * @param allNodes - Map of all nodes
 * @returns Array of descendant node IDs
 */
export const getDescendants = (
  nodeId: string,
  allNodes: Map<string, StoryNode>
): string[] => {
  const descendants: string[] = [];
  const visited = new Set<string>();

  const findChildren = (parentId: string) => {
    if (visited.has(parentId)) return;
    visited.add(parentId);

    for (const [id, node] of allNodes) {
      // Check if this node is anchored to the parent
      if (node.anchor_id === parentId && id !== parentId) {
        descendants.push(id);
        findChildren(id); // Recursive search
      }
    }
  };

  findChildren(nodeId);
  return descendants;
};

/**
 * Calculate generation depth (how many levels deep in anchor chain)
 *
 * @param node - Node to calculate generation for
 * @param allNodes - Map of all nodes
 * @returns number - 0 for root nodes, 1+ for anchored nodes
 */
export const calculateGeneration = (
  node: StoryNode,
  allNodes: Map<string, StoryNode>
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

    const parentNode = allNodes.get(currentNode.anchor_id);
    if (!parentNode) break;

    generation++;
    currentNode = parentNode;
  }

  return generation;
};
