import React, { useState, useEffect, useRef } from 'react';
import { Plus, FolderOpen, MoreVertical, Pencil, Trash2, Settings } from 'lucide-react';
import { Project } from '../../../shared/types';
import ProjectCard from './ProjectCard';
import NewProjectModal from './NewProjectModal';
import EditProjectModal from './EditProjectModal';

interface HomeViewProps {
  onOpenProject: (projectId: string) => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  project: Project | null;
}

const HomeView: React.FC<HomeViewProps> = ({ onOpenProject }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    project: null,
  });
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Load projects from database (no mock data)
  useEffect(() => {
    loadProjects();
  }, []);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu({ visible: false, x: 0, y: 0, project: null });
      }
    };

    if (contextMenu.visible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu.visible]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const existingProjects = await window.electronAPI.projectList();
      setProjects(existingProjects);
      console.log('[Home] Loaded', existingProjects.length, 'projects');
    } catch (error) {
      console.error('[Home] Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (projectData: {
    name: string;
    client: string;
    description: string;
    fps: number;
    resolution: string;
  }) => {
    try {
      console.log('[Home] Creating new project:', projectData.name);

      // 1. Create the project in the database
      const newProject = await window.electronAPI.projectCreate({
        name: projectData.name,
        client: projectData.client,
        description: projectData.description,
        status: 'ACTIVE',
        defaultFps: projectData.fps,
        defaultResolution: projectData.resolution,
      });

      console.log('[Home] Project created with ID:', newProject.id);

      // 2. Create a default canvas for the project
      await window.electronAPI.canvasCreate(newProject.id, {
        name: 'Main Canvas',
        description: 'Default canvas',
        FPS: projectData.fps,
        Resolution: projectData.resolution,
        Timecode_mode: 'NON_DROP',
      });

      console.log('[Home] Default canvas created');

      // 3. Refresh the project list
      await loadProjects();

      // 4. Close the modal
      setShowNewProjectModal(false);

      console.log('[Home] Project creation complete');
    } catch (error) {
      console.error('[Home] Failed to create project:', error);
      alert('Failed to create project. Check console for details.');
    }
  };

  const handleContextMenu = (e: React.MouseEvent, project: Project) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      project,
    });
  };

  const handleDeleteProject = async (project: Project) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${project.name}"?\n\nThis will permanently delete the project and all associated canvases, nodes, and media references.`
    );

    if (confirmed) {
      try {
        await window.electronAPI.projectDelete(project.id);
        await loadProjects();
        console.log('[Home] Project deleted:', project.name);
      } catch (error) {
        console.error('[Home] Failed to delete project:', error);
        alert('Failed to delete project. Check console for details.');
      }
    }

    setContextMenu({ visible: false, x: 0, y: 0, project: null });
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setContextMenu({ visible: false, x: 0, y: 0, project: null });
  };

  const handleUpdateProject = async (id: string, updates: Partial<Project>) => {
    try {
      await window.electronAPI.projectUpdate(id, updates);
      await loadProjects();
      setEditingProject(null);
      console.log('[Home] Project updated');
    } catch (error) {
      console.error('[Home] Failed to update project:', error);
      alert('Failed to update project. Check console for details.');
    }
  };

  return (
    <div className="w-screen h-screen bg-void overflow-hidden flex flex-col">
      {/* Header */}
      <header className="border-b border-void-gray bg-surface-high">
        <div className="px-8 py-6">
          <h1 className="text-3xl font-semibold text-text-primary mb-2">
            Story Graph v4.0
          </h1>
          <p className="text-text-secondary text-sm">
            Fractal Narrative Editor
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-8 py-8">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold text-text-primary">Projects</h2>
              <span className="text-text-tertiary text-sm">
                {projects.length} {projects.length === 1 ? 'project' : 'projects'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex items-center gap-1 bg-surface-high border border-void-gray rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-accent-indigo text-white'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    viewMode === 'list'
                      ? 'bg-accent-indigo text-white'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  List
                </button>
              </div>

              {/* New Project Button */}
              <button
                onClick={() => setShowNewProjectModal(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus size={18} />
                New Project
              </button>
            </div>
          </div>

          {/* Projects Grid/List */}
          {loading ? (
            <div className="panel rounded-lg p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-indigo mx-auto mb-4"></div>
              <p className="text-text-secondary">Loading projects...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="panel rounded-lg p-12 text-center">
              <FolderOpen size={48} className="mx-auto mb-4 text-text-tertiary" />
              <h3 className="text-lg font-medium text-text-primary mb-2">
                No projects yet
              </h3>
              <p className="text-text-secondary mb-6">
                Create your first project to get started
              </p>
              <button
                onClick={() => setShowNewProjectModal(true)}
                className="btn-primary"
              >
                Create Project
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {projects.map((project) => (
                <div key={project.id} className="relative group">
                  <ProjectCard
                    project={project}
                    onClick={() => onOpenProject(project.id)}
                    onContextMenu={(e) => handleContextMenu(e, project)}
                  />
                  {/* Quick Actions Button */}
                  <button
                    onClick={(e) => handleContextMenu(e, project)}
                    className="absolute top-2 right-2 p-1.5 bg-void-dark bg-opacity-80 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-opacity-100"
                    title="More options"
                  >
                    <MoreVertical size={16} className="text-text-secondary" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => (
                <div key={project.id} className="relative group">
                  <ProjectCard
                    project={project}
                    onClick={() => onOpenProject(project.id)}
                    onContextMenu={(e) => handleContextMenu(e, project)}
                    variant="list"
                  />
                  {/* Quick Actions Button */}
                  <button
                    onClick={(e) => handleContextMenu(e, project)}
                    className="absolute top-1/2 -translate-y-1/2 right-4 p-1.5 bg-void-dark bg-opacity-80 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-opacity-100"
                    title="More options"
                  >
                    <MoreVertical size={16} className="text-text-secondary" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.project && (
        <div
          ref={contextMenuRef}
          className="fixed bg-surface-high border border-void-gray rounded-lg shadow-lg py-1 z-50 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => handleEditProject(contextMenu.project!)}
            className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-surface-low flex items-center gap-2"
          >
            <Pencil size={14} />
            Edit Project
          </button>
          <button
            onClick={() => handleEditProject(contextMenu.project!)}
            className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-surface-low flex items-center gap-2"
          >
            <Settings size={14} />
            Project Settings
          </button>
          <div className="border-t border-void-gray my-1" />
          <button
            onClick={() => handleDeleteProject(contextMenu.project!)}
            className="w-full px-4 py-2 text-left text-sm text-accent-red hover:bg-surface-low flex items-center gap-2"
          >
            <Trash2 size={14} />
            Delete Project
          </button>
        </div>
      )}

      {/* New Project Modal */}
      {showNewProjectModal && (
        <NewProjectModal
          onClose={() => setShowNewProjectModal(false)}
          onCreateProject={handleCreateProject}
        />
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <EditProjectModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onSave={handleUpdateProject}
        />
      )}
    </div>
  );
};

export default HomeView;
