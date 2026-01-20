import React, { useState, useEffect, useRef } from 'react';
import { Plus, Play, MoreVertical, Pencil, Trash2, Settings, Layers } from 'lucide-react';
import { Canvas } from '../../../shared/types';
import NewCanvasModal from './NewCanvasModal';
import EditCanvasModal from './EditCanvasModal';

interface CanvasManagementPanelProps {
  projectId: string;
  onOpenCanvas: (canvasId: string) => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  canvas: Canvas | null;
}

const CanvasManagementPanel: React.FC<CanvasManagementPanelProps> = ({
  projectId,
  onOpenCanvas,
}) => {
  const [canvases, setCanvases] = useState<Canvas[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewCanvasModal, setShowNewCanvasModal] = useState(false);
  const [editingCanvas, setEditingCanvas] = useState<Canvas | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    canvas: null,
  });
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Load canvases from database
  useEffect(() => {
    loadCanvases();
  }, [projectId]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu({ visible: false, x: 0, y: 0, canvas: null });
      }
    };

    if (contextMenu.visible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu.visible]);

  const loadCanvases = async () => {
    try {
      setLoading(true);
      const loadedCanvases = await window.electronAPI.canvasList(projectId);
      setCanvases(loadedCanvases);
      console.log('[Canvas] Loaded', loadedCanvases.length, 'canvases');
    } catch (error) {
      console.error('[Canvas] Failed to load canvases:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCanvas = async (canvasData: {
    name: string;
    description: string;
    fps: number;
    resolution: string;
    timecodeMode: string;
  }) => {
    try {
      await window.electronAPI.canvasCreate(projectId, {
        name: canvasData.name,
        description: canvasData.description,
        FPS: canvasData.fps,
        Resolution: canvasData.resolution,
        Timecode_mode: canvasData.timecodeMode,
      });
      await loadCanvases();
      setShowNewCanvasModal(false);
      console.log('[Canvas] Canvas created:', canvasData.name);
    } catch (error) {
      console.error('[Canvas] Failed to create canvas:', error);
      alert('Failed to create canvas. Check console for details.');
    }
  };

  const handleContextMenu = (e: React.MouseEvent, canvas: Canvas) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      canvas,
    });
  };

  const handleDeleteCanvas = async (canvas: Canvas) => {
    // Don't allow deleting the last canvas
    if (canvases.length <= 1) {
      alert('Cannot delete the last canvas. A project must have at least one canvas.');
      setContextMenu({ visible: false, x: 0, y: 0, canvas: null });
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${canvas.name}"?\n\nThis will permanently delete all nodes and containers in this canvas.`
    );

    if (confirmed) {
      try {
        await window.electronAPI.canvasDelete(canvas.id);
        await loadCanvases();
        console.log('[Canvas] Canvas deleted:', canvas.name);
      } catch (error) {
        console.error('[Canvas] Failed to delete canvas:', error);
        alert('Failed to delete canvas. Check console for details.');
      }
    }

    setContextMenu({ visible: false, x: 0, y: 0, canvas: null });
  };

  const handleEditCanvas = (canvas: Canvas) => {
    setEditingCanvas(canvas);
    setContextMenu({ visible: false, x: 0, y: 0, canvas: null });
  };

  const handleUpdateCanvas = async (canvasId: string, updates: Partial<Canvas>) => {
    try {
      await window.electronAPI.canvasUpdate(canvasId, updates);
      await loadCanvases();
      setEditingCanvas(null);
      console.log('[Canvas] Canvas updated');
    } catch (error) {
      console.error('[Canvas] Failed to update canvas:', error);
      alert('Failed to update canvas. Check console for details.');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-6 border-b border-void-gray">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-text-primary">Canvases</h2>
          <button
            onClick={() => setShowNewCanvasModal(true)}
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
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-indigo"></div>
          </div>
        ) : canvases.length === 0 ? (
          <div className="text-center py-12">
            <Layers size={48} className="mx-auto mb-4 text-text-tertiary" />
            <h3 className="text-lg font-medium text-text-primary mb-2">No canvases yet</h3>
            <p className="text-text-secondary mb-4">Create your first canvas to start editing</p>
            <button
              onClick={() => setShowNewCanvasModal(true)}
              className="btn-primary"
            >
              Create Canvas
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {canvases.map((canvas) => (
              <div
                key={canvas.id}
                className="panel rounded-lg overflow-hidden hover:border-accent-indigo transition-all group relative"
                onContextMenu={(e) => handleContextMenu(e, canvas)}
              >
                {/* Quick Actions Button */}
                <button
                  onClick={(e) => handleContextMenu(e, canvas)}
                  className="absolute top-2 right-2 p-1.5 bg-void-dark bg-opacity-80 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-opacity-100 z-10"
                  title="More options"
                >
                  <MoreVertical size={16} className="text-text-secondary" />
                </button>

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

                  {canvas.description && (
                    <p className="text-sm text-text-secondary mb-3 line-clamp-2">
                      {canvas.description}
                    </p>
                  )}

                  {/* Canvas Specs */}
                  <div className="flex items-center gap-4 mb-4 text-sm text-text-secondary">
                    <div className="flex items-center gap-1.5">
                      <span className="timecode">{canvas.FPS} fps</span>
                    </div>
                    <div className="w-px h-3 bg-void-gray" />
                    <div className="flex items-center gap-1.5">
                      <span className="coordinate">{canvas.Resolution}</span>
                    </div>
                    <div className="w-px h-3 bg-void-gray" />
                    <div>
                      <span className="text-xs">{canvas.Timecode_mode?.replace('_', ' ')}</span>
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
        )}
      </div>

      {/* Info Footer */}
      <div className="px-8 py-4 border-t border-void-gray bg-surface-high">
        <p className="text-xs text-text-tertiary">
          Create multiple canvases to explore different narrative structures or delivery formats (Director's Cut, TV Edit, Social Media, etc.)
        </p>
      </div>

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.canvas && (
        <div
          ref={contextMenuRef}
          className="fixed bg-surface-high border border-void-gray rounded-lg shadow-lg py-1 z-50 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => handleEditCanvas(contextMenu.canvas!)}
            className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-surface-low flex items-center gap-2"
          >
            <Pencil size={14} />
            Rename Canvas
          </button>
          <button
            onClick={() => handleEditCanvas(contextMenu.canvas!)}
            className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-surface-low flex items-center gap-2"
          >
            <Settings size={14} />
            Canvas Settings
          </button>
          <div className="border-t border-void-gray my-1" />
          <button
            onClick={() => handleDeleteCanvas(contextMenu.canvas!)}
            className="w-full px-4 py-2 text-left text-sm text-accent-red hover:bg-surface-low flex items-center gap-2"
          >
            <Trash2 size={14} />
            Delete Canvas
          </button>
        </div>
      )}

      {/* New Canvas Modal */}
      {showNewCanvasModal && (
        <NewCanvasModal
          projectId={projectId}
          onClose={() => setShowNewCanvasModal(false)}
          onCreateCanvas={handleCreateCanvas}
        />
      )}

      {/* Edit Canvas Modal */}
      {editingCanvas && (
        <EditCanvasModal
          canvas={editingCanvas}
          onClose={() => setEditingCanvas(null)}
          onSave={handleUpdateCanvas}
        />
      )}
    </div>
  );
};

export default CanvasManagementPanel;
