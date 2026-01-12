import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Video, Trash2 } from 'lucide-react';
import { ReactFlowNodeData } from '../../../../shared/types';

const SatelliteNode: React.FC<NodeProps<ReactFlowNodeData>> = ({ data, selected }) => {
  const { storyNode, asset, label, onDelete } = data;

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`min-w-[180px] bg-surface-high rounded-node border-2 transition-all ${
        selected
          ? 'border-accent-cyan shadow-node-active'
          : 'border-accent-cyan border-opacity-50'
      }`}
    >
      {/* Header */}
      <div className="px-3 py-2 bg-accent-cyan bg-opacity-10 border-b border-accent-cyan border-opacity-20 flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Video size={14} className="text-accent-cyan" />
          <span className="text-xs font-semibold text-accent-cyan uppercase">
            Satellite
          </span>
        </div>
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(storyNode.id);
            }}
            className="text-text-tertiary hover:text-accent-red transition-colors"
            title="Delete Node"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* Thumbnail Preview */}
      <div className="aspect-video bg-void-dark flex items-center justify-center border-b border-void-gray">
        <Video size={32} className="text-text-tertiary opacity-50" />
      </div>

      {/* Content */}
      <div className="p-3">
        <h4 className="text-sm font-medium text-text-primary mb-1">
          {label}
        </h4>
        {asset && (
          <div className="flex items-center gap-2 text-xs">
            <span className="timecode text-text-tertiary">
              {formatDuration(asset.duration)}
            </span>
            {asset.fps && (
              <span className="timecode text-text-tertiary">
                {asset.fps.toFixed(2)} fps
              </span>
            )}
          </div>
        )}
        {!asset && (
          <div className="text-xs text-text-tertiary">
            No asset
          </div>
        )}
      </div>

      {/* Handles - Satellites have anchors on all sides */}
      {/* Top Anchor - Can anchor TO another satellite (stacking) OR receive from below */}
      <Handle
        type="both"
        position={Position.Top}
        className="!w-4 !h-4 !bg-accent-cyan !border-2 !border-white"
        id="anchor-top"
        style={{ opacity: 1 }}
      />

      {/* Bottom Anchor - Can anchor TO Spine TOP OR anchor TO Satellite TOP */}
      <Handle
        type="both"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-accent-cyan !border-2 !border-surface-high"
        id="anchor-bottom"
      />

      {/* Left Anchor - Horizontal connections (both directions) */}
      <Handle
        type="both"
        position={Position.Left}
        className="!w-3 !h-3 !bg-accent-cyan !border-2 !border-surface-high"
        id="anchor-left"
      />

      {/* Right Anchor - Horizontal connections (both directions) */}
      <Handle
        type="both"
        position={Position.Right}
        className="!w-3 !h-3 !bg-accent-cyan !border-2 !border-surface-high"
        id="anchor-right"
      />
    </div>
  );
};

export default SatelliteNode;
