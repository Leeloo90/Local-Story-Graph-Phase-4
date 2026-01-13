import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Film, Trash2 } from 'lucide-react';
import { ReactFlowNodeData } from '../../../../shared/types';

const SpineNode: React.FC<NodeProps<ReactFlowNodeData>> = ({ data, selected }) => {
  const { storyNode, asset, label, onDelete } = data;

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`min-w-[200px] bg-surface-high rounded-node border-2 transition-all ${
        selected
          ? 'border-accent-purple shadow-node-active'
          : 'border-accent-purple border-opacity-50'
      }`}
    >
      {/* Header */}
      <div className="px-3 py-2 bg-accent-purple bg-opacity-10 border-b border-accent-purple border-opacity-20 flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Film size={14} className="text-accent-purple" />
          <span className="text-xs font-semibold text-accent-purple uppercase">
            Spine
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

      {/* Content */}
      <div className="p-3">
        <h4 className="text-sm font-medium text-text-primary mb-2">
          {label}
        </h4>

        {asset && (
          <>
            {/* Waveform Placeholder */}
            <div className="h-12 bg-void-dark rounded mb-2 flex items-center justify-center">
              <div className="flex gap-0.5 h-8">
                {[...Array(20)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-accent-purple rounded"
                    style={{
                      height: `${Math.random() * 100}%`,
                      opacity: 0.6,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Metadata */}
            <div className="flex items-center gap-2 text-xs">
              <span className="timecode text-text-tertiary">
                {formatDuration(asset.duration)}
              </span>
              {asset.fps && (
                <span className="timecode text-text-tertiary">
                  {asset.fps.toFixed(2)} fps
                </span>
              )}
              {asset.resolution && (
                <span className="coordinate text-text-tertiary text-[10px]">
                  {asset.resolution}
                </span>
              )}
            </div>
          </>
        )}

        {!asset && (
          <div className="text-xs text-text-tertiary">
            Text Node
          </div>
        )}
      </div>

      {/* PORTS (TARGETS) - These accept incoming connections from Satellites */}

      {/* Left Port: For PREPEND (J-Cut) Satellites */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-accent-purple !border-2 !border-surface-high hover:!bg-white"
        id="anchor-left"
      />

      {/* Right Port: For APPEND (L-Cut) Satellites */}
      <Handle
        type="target"
        position={Position.Right}
        className="!w-3 !h-3 !bg-accent-purple !border-2 !border-surface-high hover:!bg-white"
        id="anchor-right"
      />

      {/* Top Port: For STACK (Overlay) Satellites */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-accent-purple !border-2 !border-surface-high hover:!bg-white"
        id="anchor-top"
      />

      {/* Bottom Port: Reserved for music satellites (later phase) */}
      <Handle
        type="target"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-accent-purple !border-2 !border-surface-high hover:!bg-white"
        id="anchor-bottom"
      />

      {/* This allows a Spine node to be dragged onto another node (becoming a child) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="tether-source"
        className="!w-3 !h-3 !bg-white !border-2 !border-accent-purple !-bottom-1.5 !z-50 hover:!scale-125"
      />
    </div>
  );
};

export default SpineNode;
