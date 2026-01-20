import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Layers } from 'lucide-react';
import { ReactFlowNodeData } from '../../../../shared/types';

interface MulticamNodeProps {
  data: ReactFlowNodeData;
  selected?: boolean;
}

const MulticamNode: React.FC<MulticamNodeProps> = ({ data, selected }) => {
  const { storyNode, label } = data;
  const activeAngle = storyNode?.internal_state_map?.active_angle || 'CAM A';

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
          ? 'border-accent-amber shadow-node-active'
          : 'border-accent-amber border-opacity-50'
      }`}
    >
      {/* Header */}
      <div className="px-3 py-2 bg-accent-amber bg-opacity-10 border-b border-accent-amber border-opacity-20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-accent-amber" />
          <span className="text-xs font-semibold text-accent-amber uppercase">
            Multicam
          </span>
        </div>
        <span className="badge-multicam text-[10px]">{activeAngle}</span>
      </div>

      {/* Quad Preview */}
      <div className="grid grid-cols-2 gap-px bg-void-gray">
        {[1, 2, 3, 4].map((angle) => (
          <div
            key={angle}
            className={`aspect-video bg-void-dark flex items-center justify-center ${activeAngle === `CAM ${String.fromCharCode(64 + angle)}` ? 'border-2 border-accent-amber' : ''}`}
          >
            <span className="text-[10px] text-text-tertiary font-mono">
              CAM {String.fromCharCode(64 + angle)}
            </span>
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="p-3">
        <h4 className="text-sm font-medium text-text-primary mb-1 truncate">
          {label}
        </h4>
        <div className="flex items-center justify-between text-xs">
          <span className="timecode text-text-tertiary">
            {formatDuration(storyNode?.clip_out ? storyNode.clip_out - (storyNode.clip_in || 0) : 0)}
          </span>
        </div>
      </div>

      {/* Handles - Multicam functions like Spine nodes */}
      {/* Left Anchor - Horizontal chaining (Target) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-accent-amber !border-2 !border-surface-high"
        id="anchor-left"
      />

      {/* Right Anchor - Horizontal chaining (Source) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-accent-amber !border-2 !border-surface-high"
        id="anchor-right"
      />

      {/* Top Anchor - Stacking anchor for nodes above (source for children to attach) */}
      <Handle
        type="source"
        position={Position.Top}
        className="!w-3 !h-3 !bg-accent-amber !border-2 !border-surface-high"
        id="anchor-top"
      />

      {/* Bottom Anchor - Base anchor for child nodes */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-accent-amber !border-2 !border-surface-high"
        id="anchor-bottom"
      />
    </div>
  );
};

export default MulticamNode;
