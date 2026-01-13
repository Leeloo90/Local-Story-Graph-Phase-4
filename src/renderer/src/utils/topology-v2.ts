/**
 * Topology V2: Magnetic Construction Architecture
 *
 * This replaces the recursive calculation system with a strict zone-based layout.
 *
 * Zones:
 * - Zone A (Attic): Floating context above each Spine
 * - Zone B (Assembly): The main anchored structure (Spine + Satellites)
 * - Zone C (Bucket): Global storage (handled separately in UI)
 *
 * Rules:
 * - Nodes cannot float freely
 * - Horizontal spine is a linked list (left/right anchors)
 * - Vertical stacking is a tree (top/bottom anchors)
 * - First node becomes ROOT (anchor_id = null)
 */

import { StoryNode, ConnectionMode } from '../../../shared/types';
import { Node, Edge } from '@xyflow/react';

// ============================================================================
// CONSTANTS
// ============================================================================

export const SPINE_BASE_WIDTH = 300;
export const SPINE_BASE_HEIGHT = 150;
export const SPINE_HORIZONTAL_GAP = 50; // Gap between sequential spines

export const SATELLITE_WIDTH = 200;
export const SATELLITE_HEIGHT = 100;
export const SATELLITE_VERTICAL_GAP = 20; // Gap between stacked satellites

export const ATTIC_HEIGHT = 80;
export const ATTIC_MARGIN_TOP = 50; // Distance above spine
export const ATTIC_ITEM_GAP = 10; // Gap between items in attic
export const ATTIC_ITEM_WIDTH = 180;
export const ATTIC_ITEM_HEIGHT = 60;

export const CANVAS_START_X = 100; // Where the first spine appears
export const CANVAS_CENTER_Y = 400; // Vertical center for spine nodes

export const SPINE_DROP_THRESHOLD = 300; // Max distance to snap to spine's attic

// ============================================================================
// TYPES
// ============================================================================

export enum Zone {
  ASSEMBLY = 'ASSEMBLY',  // Main canvas (anchored nodes)
  ATTIC = 'ATTIC',        // Floating above spines
  BUCKET = 'BUCKET',      // Global storage
}

export interface LayoutNode extends Node {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zone: Zone;
  data: {
    storyNode: StoryNode;
    label: string;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get node duration in seconds
 */
function getDuration(node: StoryNode): number {
  const clipIn = node.clip_in || 0;
  const clipOut = node.clip_out;

  if (clipOut !== undefined && clipOut !== null) {
    return clipOut - clipIn;
  }

  // Default duration if not set
  return 10;
}

/**
 * Find the ROOT node (anchor_id = null and not in attic)
 */
function findRootNode(nodes: StoryNode[]): StoryNode | null {
  return nodes.find(n => !n.anchor_id && !n.attic_parent_id) || null;
}

/**
 * Find all nodes in a specific spine's attic
 */
function findAtticNodes(spineId: string, allNodes: StoryNode[]): StoryNode[] {
  return allNodes.filter(n => n.attic_parent_id === spineId);
}

/**
 * Find the right neighbor of a spine node (sequential link)
 */
function findRightNeighbor(spineId: string, allNodes: StoryNode[]): StoryNode | null {
  return allNodes.find(n =>
    n.anchor_id === spineId &&
    n.connection_mode === 'APPEND' &&
    n.type === 'SPINE'
  ) || null;
}

/**
 * Find all satellites stacked on top of a node
 */
function findTopSatellites(nodeId: string, allNodes: StoryNode[]): StoryNode[] {
  return allNodes.filter(n =>
    n.anchor_id === nodeId &&
    n.connection_mode === 'STACK'
  );
}

/**
 * Calculate dynamic width for a spine based on its contents
 */
function calculateSpineWidth(spine: StoryNode, allNodes: StoryNode[]): number {
  // 1. Calculate width needed for stacked satellites
  const topSatellites = findTopSatellites(spine.id, allNodes);
  const stackWidth = topSatellites.length > 0
    ? SPINE_BASE_WIDTH + (topSatellites.length * 50)
    : SPINE_BASE_WIDTH;

  // 2. Calculate width needed for attic items
  const atticItems = findAtticNodes(spine.id, allNodes);
  const atticWidth = atticItems.length > 0
    ? (atticItems.length * (ATTIC_ITEM_WIDTH + ATTIC_ITEM_GAP))
    : SPINE_BASE_WIDTH;

  // 3. Return maximum (the "breathing" effect)
  return Math.max(stackWidth, atticWidth);
}

// ============================================================================
// LAYOUT ALGORITHM
// ============================================================================

/**
 * Build the complete graph layout
 *
 * This is the main entry point that replaces the old recursive calculation
 */
export function buildGraphLayout(storyNodes: StoryNode[]): {
  nodes: LayoutNode[];
  edges: Edge[];
} {
  const layoutNodes: LayoutNode[] = [];
  const edges: Edge[] = [];

  // 1. Find the ROOT spine (first node in sequence)
  const root = findRootNode(storyNodes);

  if (!root) {
    // No nodes yet, return empty
    return { nodes: [], edges: [] };
  }

  // 2. Walk the horizontal spine (linked list)
  let currentSpine: StoryNode | null = root;
  let currentX = CANVAS_START_X;
  const spineMap = new Map<string, { x: number; y: number; width: number }>();

  while (currentSpine) {
    // Calculate this spine's width
    const spineWidth = calculateSpineWidth(currentSpine, storyNodes);
    const spineY = CANVAS_CENTER_Y;

    // Store spine position
    spineMap.set(currentSpine.id, { x: currentX, y: spineY, width: spineWidth });

    // Add spine to layout
    layoutNodes.push({
      id: currentSpine.id,
      type: 'spineNode',
      position: { x: currentX, y: spineY },
      data: {
        storyNode: currentSpine,
        label: currentSpine.asset_id || 'Spine Node',
      },
      x: currentX,
      y: spineY,
      width: spineWidth,
      height: SPINE_BASE_HEIGHT,
      zone: Zone.ASSEMBLY,
    });

    // Layout attic nodes above this spine
    const atticNodes = findAtticNodes(currentSpine.id, storyNodes);
    layoutAtticNodes(currentSpine.id, atticNodes, currentX, spineY, layoutNodes);

    // Layout satellites stacked on top
    const topSatellites = findTopSatellites(currentSpine.id, storyNodes);
    layoutStackedSatellites(currentSpine.id, topSatellites, currentX, spineY, spineWidth, layoutNodes, edges);

    // Move to next spine in sequence
    currentX += spineWidth + SPINE_HORIZONTAL_GAP;
    currentSpine = findRightNeighbor(currentSpine.id, storyNodes);

    // Create edge for the link (if there's a next node)
    if (currentSpine) {
      edges.push({
        id: `spine-${currentSpine.anchor_id}-${currentSpine.id}`,
        source: currentSpine.anchor_id!,
        target: currentSpine.id,
        sourceHandle: 'anchor-right',
        targetHandle: 'anchor-left',
        type: 'step',
        style: { stroke: '#2C2C2E', strokeWidth: 2 },
      });
    }
  }

  return { nodes: layoutNodes, edges };
}

/**
 * Layout nodes in a spine's attic
 */
function layoutAtticNodes(
  spineId: string,
  atticNodes: StoryNode[],
  spineX: number,
  spineY: number,
  layoutNodes: LayoutNode[]
): void {
  if (atticNodes.length === 0) return;

  const atticY = spineY - SPINE_BASE_HEIGHT / 2 - ATTIC_MARGIN_TOP - ATTIC_HEIGHT / 2;
  let currentX = spineX;

  atticNodes.forEach((node, index) => {
    const nodeX = currentX + (index * (ATTIC_ITEM_WIDTH + ATTIC_ITEM_GAP));

    layoutNodes.push({
      id: node.id,
      type: 'satelliteNode',
      position: { x: nodeX, y: atticY },
      data: {
        storyNode: node,
        label: node.asset_id || 'Attic Node',
      },
      x: nodeX,
      y: atticY,
      width: ATTIC_ITEM_WIDTH,
      height: ATTIC_ITEM_HEIGHT,
      zone: Zone.ATTIC,
    });
  });
}

/**
 * Layout satellites stacked vertically on top of a parent
 */
function layoutStackedSatellites(
  parentId: string,
  satellites: StoryNode[],
  parentX: number,
  parentY: number,
  parentWidth: number,
  layoutNodes: LayoutNode[],
  edges: Edge[]
): void {
  satellites.forEach((sat, index) => {
    const satX = parentX + (parentWidth / 2) - (SATELLITE_WIDTH / 2);
    const satY = parentY - SPINE_BASE_HEIGHT / 2 - (index + 1) * (SATELLITE_HEIGHT + SATELLITE_VERTICAL_GAP);

    layoutNodes.push({
      id: sat.id,
      type: 'satelliteNode',
      position: { x: satX, y: satY },
      data: {
        storyNode: sat,
        label: sat.asset_id || 'Satellite',
      },
      x: satX,
      y: satY,
      width: SATELLITE_WIDTH,
      height: SATELLITE_HEIGHT,
      zone: Zone.ASSEMBLY,
    });

    // Create edge from satellite to parent
    edges.push({
      id: `sat-${sat.id}-${parentId}`,
      source: sat.id,
      target: parentId,
      sourceHandle: 'tether-source',
      targetHandle: 'anchor-top',
      type: 'step',
      style: { stroke: '#2C2C2E', strokeWidth: 2 },
    });
  });
}

// ============================================================================
// DROP ZONE DETECTION
// ============================================================================

export interface DropZone {
  nodeId: string;
  type: 'left' | 'right' | 'top' | 'bottom' | 'attic';
  bounds: { x: number; y: number; width: number; height: number };
  spineId: string; // The spine this zone belongs to
}

/**
 * Generate drop zones for all nodes
 */
export function generateDropZones(layoutNodes: LayoutNode[]): DropZone[] {
  const zones: DropZone[] = [];

  layoutNodes.forEach(node => {
    if (node.zone !== Zone.ASSEMBLY) return; // Only assembly nodes have drop zones

    const nodeX = node.x;
    const nodeY = node.y;
    const nodeWidth = node.width;
    const nodeHeight = node.height;

    // Left zone (20% of width)
    zones.push({
      nodeId: node.id,
      type: 'left',
      bounds: {
        x: nodeX - nodeWidth * 0.1,
        y: nodeY - nodeHeight / 2,
        width: nodeWidth * 0.2,
        height: nodeHeight,
      },
      spineId: node.id,
    });

    // Right zone (20% of width)
    zones.push({
      nodeId: node.id,
      type: 'right',
      bounds: {
        x: nodeX + nodeWidth * 0.9,
        y: nodeY - nodeHeight / 2,
        width: nodeWidth * 0.2,
        height: nodeHeight,
      },
      spineId: node.id,
    });

    // Top zone (full width, above node)
    zones.push({
      nodeId: node.id,
      type: 'top',
      bounds: {
        x: nodeX,
        y: nodeY - nodeHeight / 2 - 50,
        width: nodeWidth,
        height: 50,
      },
      spineId: node.id,
    });

    // Attic zone (full width, well above node)
    zones.push({
      nodeId: node.id,
      type: 'attic',
      bounds: {
        x: nodeX,
        y: nodeY - nodeHeight / 2 - ATTIC_MARGIN_TOP - ATTIC_HEIGHT,
        width: nodeWidth,
        height: ATTIC_HEIGHT,
      },
      spineId: node.id,
    });
  });

  return zones;
}

/**
 * Detect which drop zone the mouse is over
 */
export function detectDropZone(
  mouseX: number,
  mouseY: number,
  dropZones: DropZone[]
): DropZone | null {
  for (const zone of dropZones) {
    const { x, y, width, height } = zone.bounds;

    if (
      mouseX >= x &&
      mouseX <= x + width &&
      mouseY >= y &&
      mouseY <= y + height
    ) {
      return zone;
    }
  }

  return null;
}

/**
 * Handle dropping a node in "the void" (empty space)
 * Returns the spine ID to move the node to, or 'bucket' if too far
 */
export function handleVoidDrop(
  dropX: number,
  layoutNodes: LayoutNode[]
): string | 'bucket' {
  // Find all spine nodes
  const spines = layoutNodes.filter(n => n.data.storyNode.type === 'SPINE');

  if (spines.length === 0) return 'bucket';

  // Find nearest spine by X coordinate
  let nearestSpine: LayoutNode | null = null;
  let minDistance = Infinity;

  spines.forEach(spine => {
    const distance = Math.abs(dropX - spine.x);
    if (distance < minDistance) {
      minDistance = distance;
      nearestSpine = spine;
    }
  });

  if (nearestSpine && minDistance <= SPINE_DROP_THRESHOLD) {
    return nearestSpine.id; // Move to this spine's attic
  }

  return 'bucket'; // Too far, goes to bucket
}
