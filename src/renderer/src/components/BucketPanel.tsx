import React from 'react';
import { Archive, X } from 'lucide-react';
import { StoryNodeType } from '../../../shared/types';

interface BucketPanelProps {
  isOpen: boolean;
  items: StoryNodeType[];
  onClose: () => void;
  onItemClick?: (item: StoryNodeType) => void;
  onItemDragStart?: (item: StoryNodeType, event: React.DragEvent) => void;
  onItemDelete?: (itemId: string) => void;
}

/**
 * Phase 4.2: Bucket Panel Component
 *
 * Bottom drawer displaying unanchored nodes (no anchor_id, no attic_parent_id).
 * Acts as persistent storage for unused clips/ideas.
 */
const BucketPanel: React.FC<BucketPanelProps> = ({
  isOpen,
  items,
  onClose,
  onItemClick,
  onItemDragStart,
  onItemDelete
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="absolute bottom-0 left-0 right-0 bg-surface-high border-t border-void-gray shadow-lg z-50"
      style={{
        height: '240px',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-void-gray">
        <div className="flex items-center gap-2">
          <Archive size={16} className="text-text-tertiary" />
          <h3 className="text-sm font-semibold text-text-primary">
            Bucket ({items.length} items)
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-text-tertiary hover:text-text-primary transition-colors rounded"
          title="Close Bucket"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 overflow-y-auto" style={{ height: 'calc(100% - 48px)' }}>
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-tertiary text-sm">
            No items in bucket. Drag nodes here to store them.
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-3">
            {items.map(item => (
              <div
                key={item.id}
                className="bg-void-dark border border-subtle rounded-lg p-3 cursor-pointer hover:border-accent-cyan transition-colors group"
                onClick={() => onItemClick?.(item)}
                draggable
                onDragStart={(e) => onItemDragStart?.(item, e)}
              >
                <div className="flex flex-col gap-1">
                  <div className="text-xs text-text-primary truncate font-semibold">
                    {item.id.slice(0, 8)}
                  </div>
                  <div className="text-[10px] text-text-tertiary">
                    {item.type}
                  </div>
                  <div className="text-[10px] text-text-tertiary truncate">
                    {item.subtype}
                  </div>
                </div>

                {/* Delete button (appears on hover) */}
                {onItemDelete && (
                  <button
                    className="absolute top-1 right-1 p-1 bg-void-dark rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      onItemDelete(item.id);
                    }}
                    title="Delete permanently"
                  >
                    <X size={12} className="text-text-tertiary hover:text-red-500" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BucketPanel;
