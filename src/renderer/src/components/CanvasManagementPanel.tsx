import React, { useState } from 'react';
import { Plus, Play } from 'lucide-react';
import { mockCanvases, MockCanvas } from '../data/mockData';

interface CanvasManagementPanelProps {
  projectId: string;
  onOpenCanvas: (canvasId: string) => void;
}

const CanvasManagementPanel: React.FC<CanvasManagementPanelProps> = ({
  onOpenCanvas,
}) => {
  const [canvases] = useState<MockCanvas[]>(mockCanvases);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-6 border-b border-void-gray">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-text-primary">Canvases</h2>
          <button
            onClick={() => console.log('[MOCK] Create new canvas')}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <Plus size={16} />
            New Canvas
          </button>
        </div>
        <p className="text-sm text-text-secondary">
          Manage multiple versions and narrative paths for your project
        </p>
      </div>

      {/* Canvas List */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {canvases.map((canvas) => (
            <div
              key={canvas.id}
              className="panel rounded-lg overflow-hidden hover:border-accent-indigo transition-all group"
            >
              {/* Canvas Preview Area */}
              <div className="h-32 bg-void-dark flex items-center justify-center border-b border-void-gray">
                <div className="text-center">
                  <Play
                    size={32}
                    className="mx-auto mb-2 text-text-tertiary group-hover:text-accent-indigo transition-colors"
                  />
                  <p className="text-xs text-text-tertiary">Canvas Preview</p>
                </div>
              </div>

              {/* Canvas Info */}
              <div className="p-4">
                <h3 className="text-base font-semibold text-text-primary mb-2 group-hover:text-accent-indigo transition-colors">
                  {canvas.name}
                </h3>

                {/* Canvas Specs */}
                <div className="flex items-center gap-4 mb-4 text-sm text-text-secondary">
                  <div className="flex items-center gap-1.5">
                    <span className="timecode">{canvas.fps} fps</span>
                  </div>
                  <div className="w-px h-3 bg-void-gray" />
                  <div className="flex items-center gap-1.5">
                    <span className="coordinate">{canvas.resolution}</span>
                  </div>
                  <div className="w-px h-3 bg-void-gray" />
                  <div>
                    <span>{canvas.node_count} nodes</span>
                  </div>
                </div>

                {/* Open Button */}
                <button
                  onClick={() => onOpenCanvas(canvas.id)}
                  className="w-full btn-primary flex items-center justify-center gap-2"
                >
                  <Play size={16} />
                  Open Spatial Canvas
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info Footer */}
      <div className="px-8 py-4 border-t border-void-gray bg-surface-high">
        <p className="text-xs text-text-tertiary">
          💡 <strong>Tip:</strong> Create multiple canvases to explore different narrative
          structures or delivery formats (Director's Cut, TV Edit, Social Media, etc.)
        </p>
      </div>
    </div>
  );
};

export default CanvasManagementPanel;
