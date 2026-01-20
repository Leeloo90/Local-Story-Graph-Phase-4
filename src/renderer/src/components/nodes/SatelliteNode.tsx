import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Video, Trash2 } from 'lucide-react';
import { ReactFlowNodeData } from '../../../../shared/types';

interface SatelliteNodeProps {
  data: ReactFlowNodeData;
  selected?: boolean;
}

const SatelliteNode: React.FC<SatelliteNodeProps> = ({ data, selected }) => {
  const { storyNode, asset, label, onDelete } = data;

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get elastic width and attached children from computed data
  const elasticWidth = storyNode._computed?.elasticWidth || 180;
  const attachedChildren = storyNode._computed?.attachedChildren || [];

  // Fixed height for consistency - satellite nodes should not change height when children attach
  const SATELLITE_HEIGHT = 180; // Fixed height in pixels

  return (
    <div
      className={`min-w-[180px] bg-surface-high rounded-node border-2 transition-all overflow-hidden flex flex-col ${
        selected
          ? 'border-accent-cyan shadow-node-active'
          : 'border-accent-cyan border-opacity-50'
      }`}
      style={{ width: `${elasticWidth}px`, height: `${SATELLITE_HEIGHT}px` }}
    >
      {/* Header */}
      <div className="px-3 py-1.5 bg-accent-cyan bg-opacity-10 border-b border-accent-cyan border-opacity-20 flex items-center gap-2 justify-between flex-shrink-0">
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

      {/* Thumbnail Preview - fixed height instead of aspect-video */}
      <div className="h-20 bg-void-dark flex items-center justify-center border-b border-void-gray flex-shrink-0">
        <Video size={24} className="text-text-tertiary opacity-50" />
      </div>

      {/* Content */}
      <div className="p-2 flex-1 overflow-hidden">
        <h4 className="text-xs font-medium text-text-primary mb-1 truncate">
          {label}
        </h4>
        {asset && (
          <div className="flex items-center gap-2 text-[10px]">
            <span className="timecode text-text-tertiary">
              {formatDuration(asset.duration)}
            </span>
            {asset.fps && (
              <span className="timecode text-text-tertiary">
                {asset.fps.toFixed(0)}fps
              </span>
            )}
          </div>
        )}
        {!asset && (
          <div className="text-[10px] text-text-tertiary">
            No asset
          </div>
        )}
      </div>

      {/* PORTS - For Recursive Anchoring: Other satellites can anchor TO this node */}

      {/* Dynamic Handles for Stacked Children - One handle per child at specific position */}
      {attachedChildren.map((child: { id: string; relX: number }) => (
        <Handle
          key={child.id}
          type="source"
          position={Position.Top}
          className="!w-3 !h-3 !bg-accent-cyan !border-2 !border-surface-high hover:!bg-white"
          id={`anchor-top-${child.id}`}
          style={{ left: `${child.relX}%` }}
        />
      ))}

      {/* Invisible full-width drop zone at top for accepting new children */}
      <Handle
        type="source"
        position={Position.Top}
        className="!w-full !h-3 !opacity-0"
        id="anchor-top"
        style={{ left: 0, width: '100%' }}
      />

      {/* Top TARGET Port: Receive Stacked Satellites (for being a child) - invisible, same position */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-accent-cyan !border-2 !border-surface-high !opacity-0"
        id="anchor-top-target"
      />

      {/* Bottom Target: Receive parent tether connections (stack behavior) */}
      <Handle
        type="target"
        position={Position.Bottom}
        id="tether-target"
        className="!w-3 !h-3 !bg-white !border-2 !border-accent-cyan"
      />

      {/* Left SOURCE Port: Hold Prepend Children */}
      <Handle
        type="source"
        position={Position.Left}
        className="!w-3 !h-3 !bg-accent-cyan !border-2 !border-surface-high hover:!bg-white"
        id="anchor-left"
      />

      {/* Left TARGET: Receive connections when this node is prepended to another - invisible */}
      <Handle
        type="target"
        position={Position.Left}
        id="tether-left"
        className="!w-3 !h-3 !bg-accent-cyan !border-2 !border-surface-high !opacity-0"
      />

      {/* Right SOURCE Port: Hold Append Children */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-accent-cyan !border-2 !border-surface-high hover:!bg-white"
        id="anchor-right"
      />

      {/* Right TARGET: Receive connections when this node is appended to another - invisible */}
      <Handle
        type="target"
        position={Position.Right}
        id="tether-right"
        className="!w-3 !h-3 !bg-accent-cyan !border-2 !border-surface-high !opacity-0"
      />

      {/* TETHER (SOURCE) - This is the "Output" used to connect THIS satellite to a Parent (Spine or Sat) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-white !border-2 !border-accent-cyan"
        id="tether-source"
      />
    </div>
  );
};

export default SatelliteNode;
