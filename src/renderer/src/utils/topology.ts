/**
 * Topology Utilities (Renderer)
 * Client-side position calculations for anchor chains
 * Phase 4: Story Graph Physics Engine
 *
 * Implements the "Laws of Physics" for Story Graph:
 * - Snowplow Effect: Adding nodes pushes timeline RIGHT
 * - Vacuum Effect: Removing nodes pulls timeline LEFT (or DOWN for stacks)
 * - Zero is Absolute: Nothing moves LEFT during insertion; the world moves RIGHT
 * - Manual Width is Impossible: Nodes have fixed dimensions
 * - Elastic Width is Automatic: A node's "territory" expands based on child tree horizontal extent
 */

import { StoryNode } from '../../../shared/types';

// =============================================================================
// LAYOUT CONSTANTS (per Physics Spec v11.0)
// =============================================================================

export const BASE_WIDTH_PX = 200;           // Default node width if no duration set
export const PIXELS_PER_SECOND = 20;        // Duration-based width calculation
export const SPINE_GAP = 100;               // Gap between Spine nodes (horizontal chain)
export const SATELLITE_GAP = 50;            // Gap between Satellite wings (PREPEND/APPEND)
export const STACK_GAP = 50;                // Vertical gap between stacked nodes
export const PIXELS_PER_TRACK = 120;        // Vertical spacing per track (drift_y)

// Legacy constants (kept for backward compatibility)
export const HORIZONTAL_SPACING = SATELLITE_GAP;
export const COUPLER_GAP = 10;

// Fixed node heights
export const SPINE_HEIGHT = 130;
export const SATELLITE_HEIGHT = 180;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

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
    return Math.max(0, clipOut - clipIn);
  }

  // Fallback for new nodes without set duration
  return 5.0;
};

/**
 * PASS 1: Calculate Base Widths
 * Node width is based on duration (or minimum BASE_WIDTH_PX)
 */
const calculateBaseWidth = (node: StoryNode): number => {
  const duration = calculateDuration(node);
  return Math.max(BASE_WIDTH_PX, duration * PIXELS_PER_SECOND);
};

/**
 * Get the appropriate gap based on node types
 * Spine-to-Spine: 100px
 * Satellite wings: 50px
 */
const getGapForConnection = (parentType: string, childType: string, mode: string): number => {
  if (mode === 'STACK') return STACK_GAP;
  if (parentType === 'SPINE' && childType === 'SPINE') return SPINE_GAP;
  return SATELLITE_GAP;
};

// =============================================================================
// COLUMN WIDTH CALCULATION (The Umbrella Effect)
// =============================================================================

/**
 * Calculate the "Column Width" for a node
 * This is the territory a node reserves, including all PREPEND/APPEND children
 * of its stacked children (but not the stacked children themselves - they're above)
 *
 * The column width is used for:
 * 1. Elastic stretching of the node's visual width
 * 2. Determining how much space this node's "column" takes on the timeline
 */
const calculateColumnWidth = (
  node: StoryNode,
  allNodes: StoryNode[],
  baseWidths: Map<string, number>,
  columnWidths: Map<string, number>,
  visited: Set<string> = new Set()
): number => {
  if (visited.has(node.id)) {
    return columnWidths.get(node.id) || baseWidths.get(node.id) || BASE_WIDTH_PX;
  }
  visited.add(node.id);

  const baseWidth = baseWidths.get(node.id) || BASE_WIDTH_PX;

  // Find all stacked children (vertical tree above this node)
  const stackedChildren = allNodes.filter(
    n => n.anchor_id === node.id && n.connection_mode === 'STACK'
  );

  // First, recursively calculate column widths for all stacked children
  stackedChildren.forEach(child => {
    if (!columnWidths.has(child.id)) {
      calculateColumnWidth(child, allNodes, baseWidths, columnWidths, new Set(visited));
    }
  });

  // Now calculate the horizontal extent of this node's tree
  // This includes PREPEND/APPEND children of stacked children
  let leftExtent = 0;
  let rightExtent = baseWidth;

  stackedChildren.forEach(child => {
    const childColumnWidth = columnWidths.get(child.id) || baseWidths.get(child.id) || BASE_WIDTH_PX;
    const driftX = child.drift_x || 0;
    const childOffset = driftX * PIXELS_PER_SECOND;

    // Find PREPEND children of this stacked child
    const prependChildren = allNodes.filter(
      n => n.anchor_id === child.id && n.connection_mode === 'PREPEND'
    );

    // Find APPEND children of this stacked child
    const appendChildren = allNodes.filter(
      n => n.anchor_id === child.id && n.connection_mode === 'APPEND'
    );

    // Calculate left extent from PREPEND children
    let prependWidth = 0;
    prependChildren.forEach(prepend => {
      const prependColumnWidth = columnWidths.get(prepend.id) || baseWidths.get(prepend.id) || BASE_WIDTH_PX;
      prependWidth += prependColumnWidth + SATELLITE_GAP;
    });

    // Calculate right extent from APPEND children
    let appendWidth = 0;
    appendChildren.forEach(append => {
      const appendColumnWidth = columnWidths.get(append.id) || baseWidths.get(append.id) || BASE_WIDTH_PX;
      appendWidth += appendColumnWidth + SATELLITE_GAP;
    });

    // The stacked child's tree starts at childOffset and extends:
    // - Left by prependWidth
    // - Right by childColumnWidth + appendWidth
    const childLeftEdge = childOffset - prependWidth;
    const childRightEdge = childOffset + childColumnWidth + appendWidth;

    leftExtent = Math.min(leftExtent, childLeftEdge);
    rightExtent = Math.max(rightExtent, childRightEdge);
  });

  // Column width is the span from leftmost to rightmost extent
  const columnWidth = Math.max(baseWidth, rightExtent - leftExtent);
  columnWidths.set(node.id, columnWidth);

  return columnWidth;
};

/**
 * Calculate the left offset for a node
 * This is how much the node's content area shifts right to accommodate PREPEND children
 */
const calculateLeftOffset = (
  node: StoryNode,
  allNodes: StoryNode[],
  baseWidths: Map<string, number>,
  columnWidths: Map<string, number>
): number => {
  const stackedChildren = allNodes.filter(
    n => n.anchor_id === node.id && n.connection_mode === 'STACK'
  );

  let maxLeftExtent = 0;

  stackedChildren.forEach(child => {
    const driftX = child.drift_x || 0;
    const childOffset = driftX * PIXELS_PER_SECOND;

    // Find PREPEND children of this stacked child
    const prependChildren = allNodes.filter(
      n => n.anchor_id === child.id && n.connection_mode === 'PREPEND'
    );

    let prependWidth = 0;
    prependChildren.forEach(prepend => {
      const prependColumnWidth = columnWidths.get(prepend.id) || baseWidths.get(prepend.id) || BASE_WIDTH_PX;
      prependWidth += prependColumnWidth + SATELLITE_GAP;
    });

    const childLeftEdge = childOffset - prependWidth;
    maxLeftExtent = Math.min(maxLeftExtent, childLeftEdge);
  });

  return maxLeftExtent < 0 ? Math.abs(maxLeftExtent) : 0;
};

// =============================================================================
// POSITION CALCULATION
// =============================================================================

/**
 * PASS 3: Calculate absolute positions for all nodes
 * Implements the positioning rules from the Physics Spec
 */
const calculatePosition = (
  node: StoryNode,
  nodeMap: Map<string, StoryNode>,
  columnWidths: Map<string, number>,
  leftOffsets: Map<string, number>,
  visited: Set<string> = new Set()
): { x: number; y: number } => {
  if (visited.has(node.id)) {
    console.error('[Topology] Cycle detected for node:', node.id);
    return { x: node.x, y: node.y };
  }
  visited.add(node.id);

  // Root nodes: Use their stored position (Origin Spine at x=0, y=0)
  if (!node.anchor_id) {
    return { x: node.x, y: node.y };
  }

  const parent = nodeMap.get(node.anchor_id);
  if (!parent) {
    console.warn(`[Topology] Orphaned node ${node.id}: Parent ${node.anchor_id} not found`);
    return { x: node.x, y: node.y };
  }

  // Recursively get parent position
  const parentPos = calculatePosition(parent, nodeMap, columnWidths, leftOffsets, visited);
  const parentColumnWidth = columnWidths.get(parent.id) || BASE_WIDTH_PX;
  const parentLeftOffset = leftOffsets.get(parent.id) || 0;
  const nodeColumnWidth = columnWidths.get(node.id) || BASE_WIDTH_PX;
  const nodeHeight = node.height || (node.type === 'SPINE' ? SPINE_HEIGHT : SATELLITE_HEIGHT);

  let x = parentPos.x;
  let y = parentPos.y;

  switch (node.connection_mode) {
    case 'STACK':
      // Stacked above parent, using drift_x for horizontal offset
      // Add parent's leftOffset so stacked children align with visual content
      x = parentPos.x + (node.drift_x || 0) * PIXELS_PER_SECOND + parentLeftOffset;
      y = parentPos.y - nodeHeight - STACK_GAP;
      break;

    case 'PREPEND':
      // Left of parent, using gap based on node types
      const prependGap = getGapForConnection(parent.type, node.type, 'PREPEND');
      x = parentPos.x + parentLeftOffset - nodeColumnWidth - prependGap;
      y = parentPos.y; // Same vertical level
      break;

    case 'APPEND':
      // Right of parent (after parent's full column width)
      const appendGap = getGapForConnection(parent.type, node.type, 'APPEND');
      x = parentPos.x + parentColumnWidth + appendGap;
      y = parentPos.y; // Same vertical level
      break;

    default:
      console.warn(`[Topology] Unknown connection mode: ${node.connection_mode}`);
  }

  // Apply vertical drift (track offset)
  if (node.drift_y) {
    y -= node.drift_y * PIXELS_PER_TRACK;
  }

  return { x, y };
};

// =============================================================================
// ATTACHED CHILDREN CALCULATION (for Dynamic Handles)
// =============================================================================

/**
 * Calculate relX positions for stacked children (for dynamic handle placement)
 */
const calculateAttachedChildren = (
  parentId: string,
  nodes: StoryNode[],
  columnWidths: Map<string, number>
): Array<{ id: string; relX: number }> => {
  const parentWidth = columnWidths.get(parentId) || BASE_WIDTH_PX;

  const stackedChildren = nodes.filter(
    n => n.anchor_id === parentId && n.connection_mode === 'STACK'
  );

  return stackedChildren.map(child => {
    const driftX = child.drift_x || 0;
    const pixelOffset = driftX * PIXELS_PER_SECOND;
    // relX is percentage (0-100) along the parent's top edge
    const relX = (pixelOffset / parentWidth) * 100;
    return { id: child.id, relX: Math.max(0, Math.min(100, relX)) };
  });
};

// =============================================================================
// MAIN COMPUTATION FUNCTION
// =============================================================================

/**
 * Main Topology Computation - Multi-Pass Layout Engine
 *
 * Pass 1: Calculate base widths (from duration)
 * Pass 2: Calculate column widths (umbrella effect - tree extent)
 * Pass 3: Calculate positions (snowplow/vacuum physics)
 */
export const computeAbsolutePositions = (nodes: StoryNode[]): StoryNode[] => {
  if (nodes.length === 0) return [];

  const nodeMap = buildNodeMap(nodes);

  // PASS 1: Calculate base widths
  const baseWidths = new Map<string, number>();
  nodes.forEach(node => {
    baseWidths.set(node.id, calculateBaseWidth(node));
  });

  // PASS 2: Calculate column widths (recursive, bottom-up)
  const columnWidths = new Map<string, number>();

  // Start with root nodes (no anchor)
  const rootNodes = nodes.filter(n => !n.anchor_id);
  rootNodes.forEach(root => {
    calculateColumnWidth(root, nodes, baseWidths, columnWidths, new Set());
  });

  // Ensure all nodes have column widths (handle orphaned branches)
  nodes.forEach(node => {
    if (!columnWidths.has(node.id)) {
      calculateColumnWidth(node, nodes, baseWidths, columnWidths, new Set());
    }
  });

  // Calculate left offsets for all nodes
  const leftOffsets = new Map<string, number>();
  nodes.forEach(node => {
    leftOffsets.set(node.id, calculateLeftOffset(node, nodes, baseWidths, columnWidths));
  });

  // PASS 3: Calculate positions
  return nodes.map(node => {
    const { x, y } = calculatePosition(node, nodeMap, columnWidths, leftOffsets, new Set());
    const duration = calculateDuration(node);
    const columnWidth = columnWidths.get(node.id) || BASE_WIDTH_PX;
    const attachedChildren = calculateAttachedChildren(node.id, nodes, columnWidths);

    return {
      ...node,
      x,
      y,
      width: columnWidth, // Elastic width based on column calculation
      _computed: {
        absoluteTime: 0,   // TODO: Calculate from timeline position
        absoluteTrack: 0,  // TODO: Calculate from vertical position
        duration,
        generation: 0,     // TODO: Calculate depth in anchor chain
        hasAnchor: !!node.anchor_id,
        elasticWidth: columnWidth,
        attachedChildren,
      },
    };
  });
};

// =============================================================================
// TREE BOUNDS (for Viewport Fitting)
// =============================================================================

/**
 * Calculate bounds for the entire node tree
 * Used for "Fit View" to zoom out enough to see all nodes
 */
export const calculateTreeBounds = (
  nodes: StoryNode[]
): { minX: number; maxX: number; minY: number; maxY: number } => {
  if (nodes.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  nodes.forEach(node => {
    const width = node._computed?.elasticWidth || node.width || BASE_WIDTH_PX;
    const height = node.height || (node.type === 'SPINE' ? SPINE_HEIGHT : SATELLITE_HEIGHT);

    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x + width);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y + height);
  });

  return { minX, maxX, minY, maxY };
};

// =============================================================================
// EDGE GENERATION
// =============================================================================

/**
 * Map Connection Mode to Handle ID on the PARENT node
 */
const MODE_TO_PARENT_HANDLE: Record<string, string> = {
  'STACK': 'anchor-top',
  'PREPEND': 'anchor-left',
  'APPEND': 'anchor-right'
};

/**
 * Generate edges for anchor relationships
 * Uses smoothstep for orthogonal connections
 */
export const getAnchorEdges = (
  nodes: StoryNode[]
): Array<{
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  type: string;
  style: { stroke: string; strokeWidth: number; strokeDasharray: string };
  animated: boolean;
}> => {
  const edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle: string;
    targetHandle: string;
    type: string;
    style: { stroke: string; strokeWidth: number; strokeDasharray: string };
    animated: boolean;
  }> = [];

  nodes.forEach((node) => {
    if (node.anchor_id && node.connection_mode) {
      const parent = nodes.find(n => n.id === node.anchor_id);
      if (!parent) return;

      const parentHandle = MODE_TO_PARENT_HANDLE[node.connection_mode];

      // Determine child handle based on connection mode
      let childHandle = 'tether-target';
      if (node.connection_mode === 'PREPEND') childHandle = 'tether-right';
      else if (node.connection_mode === 'APPEND') childHandle = 'tether-left';

      // For STACK connections, use dynamic handle ID
      let sourceHandle = parentHandle;
      if (node.connection_mode === 'STACK' && parent._computed?.attachedChildren) {
        const childInfo = parent._computed.attachedChildren.find(c => c.id === node.id);
        if (childInfo) {
          sourceHandle = `anchor-top-${node.id}`;
        }
      }

      edges.push({
        id: `edge-${node.anchor_id}-${node.id}`,
        source: node.anchor_id,
        target: node.id,
        sourceHandle,
        targetHandle: childHandle,
        type: 'smoothstep',
        style: { stroke: '#6366F1', strokeWidth: 2, strokeDasharray: '4 2' },
        animated: false,
      });
    }
  });

  return edges;
};
