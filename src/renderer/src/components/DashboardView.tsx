import React, { useState, useEffect } from 'react';
import { ArrowLeft, Settings } from 'lucide-react';
import MediaLibraryPanel from './MediaLibraryPanel';
import CanvasManagementPanel from './CanvasManagementPanel';
import InspectorPanel from './InspectorPanel';
import { Project } from '../../../shared/types';

interface DashboardViewProps {
  projectId: string;
  onBack: () => void;
  onOpenCanvas: (canvasId: string) => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({
  projectId,
  onBack,
  onOpenCanvas,
}) => {
  const [project, setProject] = useState<Project | null>(null);
  const [leftPanelWidth, setLeftPanelWidth] = useState(320);
  const [rightPanelWidth, setRightPanelWidth] = useState(380);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

  // Load project data
  useEffect(() => {
    const loadProject = async () => {
      try {
        const loadedProject = await window.electronAPI.projectGet(projectId);
        setProject(loadedProject);
        console.log('[Dashboard] Loaded project:', loadedProject?.name);
      } catch (error) {
        console.error('[Dashboard] Failed to load project:', error);
      }
    };

    loadProject();
  }, [projectId]);

  const handleMouseMove = (e: MouseEvent) => {
    if (isResizingLeft) {
      const newWidth = Math.max(250, Math.min(500, e.clientX));
      setLeftPanelWidth(newWidth);
    }
    if (isResizingRight) {
      const newWidth = Math.max(300, Math.min(600, window.innerWidth - e.clientX));
      setRightPanelWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    setIsResizingLeft(false);
    setIsResizingRight(false);
  };

  useEffect(() => {
    if (isResizingLeft || isResizingRight) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizingLeft, isResizingRight]);

  return (
    <div className="w-screen h-screen bg-void overflow-hidden flex flex-col">
      {/* Top Bar */}
      <header className="bg-surface-high border-b border-void-gray px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-text-tertiary hover:text-text-primary transition-colors"
            title="Back to Projects"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">
              {project?.name || 'Loading...'}
            </h1>
            <p className="text-xs text-text-tertiary">
              {project?.client ? `${project.client} · ` : ''}Project Dashboard
            </p>
          </div>
        </div>

        <button className="btn-ghost flex items-center gap-2">
          <Settings size={16} />
          <span>Settings</span>
        </button>
      </header>

      {/* Three-Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Panel A: Media Library (Left) */}
        <div
          style={{ width: leftPanelWidth }}
          className="bg-surface-high border-r border-void-gray flex flex-col"
        >
          <MediaLibraryPanel projectId={projectId} />
        </div>

        {/* Resize Handle (Left) */}
        <div
          onMouseDown={() => setIsResizingLeft(true)}
          className="w-1 bg-void-gray hover:bg-accent-indigo cursor-col-resize transition-colors"
        />

        {/* Panel B: Canvas Management (Center) */}
        <div className="flex-1 bg-void flex flex-col overflow-hidden">
          <CanvasManagementPanel
            projectId={projectId}
            onOpenCanvas={onOpenCanvas}
          />
        </div>

        {/* Resize Handle (Right) */}
        <div
          onMouseDown={() => setIsResizingRight(true)}
          className="w-1 bg-void-gray hover:bg-accent-indigo cursor-col-resize transition-colors"
        />

        {/* Panel C: Inspector (Right) */}
        <div
          style={{ width: rightPanelWidth }}
          className="bg-surface-high border-l border-void-gray flex flex-col"
        >
          <InspectorPanel />
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
