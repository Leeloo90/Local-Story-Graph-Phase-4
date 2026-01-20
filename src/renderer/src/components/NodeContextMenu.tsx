import React from 'react';
import { StoryNode } from '../../../shared/types';
import { Unlink as UnlinkIcon, RefreshCw } from 'lucide-react';

interface NodeContextMenuProps {
  node: StoryNode;
  position: { x: number; y: number };
  onClose: () => void;
  onChangeType: (nodeId: string, newType: 'SPINE' | 'SATELLITE') => void;
  onUnlink: (nodeId: string) => void;
}

const NodeContextMenu: React.FC<NodeContextMenuProps> = ({
  node,
  position,
  onClose,
  onChangeType,
  onUnlink,
}) => {
  // Check if node has an anchor
  const hasAnchor = !!node.anchor_id;

  // Get connection mode label
  const getConnectionModeLabel = (mode?: string) => {
    switch (mode) {
      case 'STACK': return 'Stacked (same time, track above)';
      case 'PREPEND': return 'Lead-in (plays before)';
      case 'APPEND': return 'Lead-out (plays after)';
      default: return 'Unknown';
    }
  };

  return (
    <>
      {/* Backdrop to close menu */}
      <div
        className="fixed inset-0 z-[9999]"
        onClick={onClose}
      />

      {/* Context Menu */}
      <div
        className="fixed z-[10000] min-w-[200px] bg-surface-high border border-border-subtle rounded shadow-lg"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
      >
        {/* Node Type Conversion */}
        <div className="border-b border-border-subtle p-2">
          <div className="text-xs text-text-tertiary uppercase mb-1 px-2">
            Node Type
          </div>
          <button
            onClick={() => {
              const newType = node.type === 'SPINE' ? 'SATELLITE' : 'SPINE';
              onChangeType(node.id, newType);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-text-primary hover:bg-surface-hover rounded transition-colors"
          >
            <RefreshCw size={14} />
            <span>
              Convert to {node.type === 'SPINE' ? 'Satellite' : 'Spine'}
            </span>
          </button>
        </div>

        {/* Anchor Status */}
        {hasAnchor && (
          <div className="p-2 border-b border-border-subtle">
            <div className="text-xs text-text-tertiary uppercase mb-1 px-2">
              Current Anchor
            </div>
            <div className="px-2 py-1 text-xs text-text-secondary">
              <div className="font-medium">{getConnectionModeLabel(node.connection_mode)}</div>
              {node.drift_x !== 0 && (
                <div className="text-text-tertiary">Drift: {node.drift_x}s</div>
              )}
              {(node.drift_y ?? 0) !== 0 && (
                <div className="text-text-tertiary">Track offset: {(node.drift_y ?? 0) > 0 ? '+' : ''}{node.drift_y}</div>
              )}
            </div>
          </div>
        )}

        {/* Unlink Option */}
        {hasAnchor && (
          <div className="p-2">
            <button
              onClick={() => {
                onUnlink(node.id);
                onClose();
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-text-primary hover:bg-surface-hover rounded transition-colors"
            >
              <UnlinkIcon size={14} />
              <span>Detach Anchor</span>
            </button>
          </div>
        )}

        {/* No Anchor Message */}
        {!hasAnchor && (
          <div className="p-2 border-t border-border-subtle">
            <div className="text-xs text-text-tertiary px-2 py-1">
              No anchor attached
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default NodeContextMenu;
