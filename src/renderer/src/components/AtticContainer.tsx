import React from 'react';
import { StoryNodeType } from '../../../shared/types';

interface AtticContainerProps {
  spineId: string;
  items: StoryNodeType[];
  position: { x: number; y: number };
  onItemClick?: (item: StoryNodeType) => void;
  onItemDragStart?: (item: StoryNodeType) => void;
}

const ATTIC_HEIGHT = 80;
const ATTIC_MARGIN_TOP = 20;
const SPINE_BASE_WIDTH = 300;

/**
 * Phase 4.2: Attic Container Component
 *
 * Renders a semi-transparent overlay above spine nodes containing "parked" nodes.
 * These are nodes with attic_parent_id set, representing local context/previews.
 */
const AtticContainer: React.FC<AtticContainerProps> = ({
  spineId,
  items,
  position,
  onItemClick,
  onItemDragStart
}) => {
  if (items.length === 0) {
    return null; // Don't render empty attics
  }

  return (
    <div
      className="absolute bg-surface-high/50 border border-void-gray rounded-lg p-2 backdrop-blur-sm"
      style={{
        left: position.x,
        top: position.y - ATTIC_HEIGHT - ATTIC_MARGIN_TOP,
        minWidth: SPINE_BASE_WIDTH,
        height: ATTIC_HEIGHT,
        zIndex: 10,
      }}
    >
      {/* Attic Label */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-text-tertiary font-semibold">
          Attic ({items.length})
        </span>
      </div>

      {/* Attic Items */}
      <div className="flex gap-2 overflow-x-auto">
        {items.map(item => (
          <div
            key={item.id}
            className="flex-shrink-0 bg-surface-high border border-subtle rounded p-2 cursor-pointer hover:border-accent-indigo transition-colors"
            style={{
              width: 120,
              height: 50,
            }}
            onClick={() => onItemClick?.(item)}
            draggable
            onDragStart={() => onItemDragStart?.(item)}
          >
            <div className="text-xs text-text-primary truncate font-semibold">
              {item.id.slice(0, 8)}
            </div>
            <div className="text-[10px] text-text-tertiary truncate">
              {item.type} • {item.subtype}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AtticContainer;
