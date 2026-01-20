/**
 * ContainerNode Component
 * Phase 5: Visual representation of Acts and Scenes on the canvas
 *
 * Acts are larger containers (amber/orange color)
 * Scenes are smaller containers nested inside Acts (green color)
 *
 * Containers are rendered as resizable rectangles that can hold story nodes
 */

import React, { useState, useCallback } from 'react';
import { NodeResizer } from '@xyflow/react';
import { Layers, Film, Trash2, Edit2, Check, X } from 'lucide-react';
import { ContainerNodeData } from '../../../../shared/types';

interface ContainerNodeProps {
  data: ContainerNodeData;
  selected?: boolean;
}

const ContainerNode: React.FC<ContainerNodeProps> = ({ data, selected }) => {
  const { container, onDelete, onRename, onResize } = data;
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(container.name);

  const isAct = container.type === 'ACT';

  // Color scheme based on container type
  const colorScheme = isAct
    ? {
        border: 'border-accent-amber',
        bg: 'bg-accent-amber/5',
        header: 'bg-accent-amber/10',
        text: 'text-accent-amber',
        icon: <Layers size={14} className="text-accent-amber" />,
      }
    : {
        border: 'border-green-500',
        bg: 'bg-green-500/5',
        header: 'bg-green-500/10',
        text: 'text-green-500',
        icon: <Film size={14} className="text-green-500" />,
      };

  const handleSaveRename = useCallback(() => {
    if (editName.trim() && editName !== container.name) {
      onRename?.(container.id, editName.trim());
    }
    setIsEditing(false);
  }, [editName, container.id, container.name, onRename]);

  const handleCancelRename = useCallback(() => {
    setEditName(container.name);
    setIsEditing(false);
  }, [container.name]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSaveRename();
      } else if (e.key === 'Escape') {
        handleCancelRename();
      }
    },
    [handleSaveRename, handleCancelRename]
  );

  return (
    <>
      {/* Node Resizer - only visible when selected */}
      <NodeResizer
        minWidth={200}
        minHeight={150}
        isVisible={selected}
        lineClassName="!border-accent-indigo"
        handleClassName="!w-3 !h-3 !bg-accent-indigo !border-2 !border-white"
        onResize={(_event, params) => {
          onResize?.(container.id, params.width, params.height);
        }}
      />

      <div
        className={`w-full h-full rounded-lg border-2 border-dashed transition-all ${colorScheme.border} ${colorScheme.bg} ${
          selected ? 'shadow-lg' : ''
        }`}
        style={{
          minWidth: container.width || 300,
          minHeight: container.height || 200,
        }}
      >
        {/* Header */}
        <div
          className={`px-3 py-2 rounded-t-lg flex items-center justify-between ${colorScheme.header}`}
        >
          <div className="flex items-center gap-2 flex-1">
            {colorScheme.icon}
            {isEditing ? (
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="bg-void text-text-primary text-sm px-2 py-0.5 rounded border border-void-gray flex-1 focus:outline-none focus:border-accent-indigo"
                  autoFocus
                />
                <button
                  onClick={handleSaveRename}
                  className="text-green-500 hover:text-green-400 p-1"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={handleCancelRename}
                  className="text-accent-red hover:text-red-400 p-1"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <span className={`text-xs font-semibold uppercase ${colorScheme.text}`}>
                  {container.type}
                </span>
                <span className="text-sm text-text-primary font-medium truncate">
                  {container.name}
                </span>
              </>
            )}
          </div>

          {/* Actions */}
          {!isEditing && (
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="text-text-tertiary hover:text-text-primary transition-colors p-1"
                title="Rename"
              >
                <Edit2 size={12} />
              </button>
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(container.id);
                  }}
                  className="text-text-tertiary hover:text-accent-red transition-colors p-1"
                  title="Delete Container"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Container Body - Empty area for nodes */}
        <div className="p-2 h-full">
          {/* This area is intentionally empty - nodes inside will be positioned by React Flow */}
        </div>
      </div>
    </>
  );
};

export default ContainerNode;
