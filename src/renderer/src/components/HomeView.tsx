import React, { useState, useEffect } from 'react';
import { Plus, FolderOpen } from 'lucide-react';
import { mockProjects, MockProject } from '../data/mockData';
import { Project } from '../../../shared/types';
import ProjectCard from './ProjectCard';
import NewProjectModal from './NewProjectModal';

interface HomeViewProps {
  onOpenProject: (projectId: string) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onOpenProject }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);

  // Load projects from database and create mock ones if needed
  useEffect(() => {
    loadOrCreateProjects();
  }, []);

  const loadOrCreateProjects = async () => {
    try {
      setLoading(true);

      // Try to load existing projects
      const existingProjects = await window.electronAPI.projectList();

      // If no projects exist, create the mock ones
      if (existingProjects.length === 0) {
        console.log('[Home] No projects found, creating mock projects...');

        for (const mockProject of mockProjects) {
          await window.electronAPI.projectCreate({
            name: mockProject.name,
            client: mockProject.client,
            status: mockProject.status as 'ACTIVE' | 'ARCHIVED' | 'COMPLETED',
          });
        }

        // Reload projects after creating
        const newProjects = await window.electronAPI.projectList();
        setProjects(newProjects);
        console.log('[Home] Created', newProjects.length, 'projects');
      } else {
        setProjects(existingProjects);
        console.log('[Home] Loaded', existingProjects.length, 'projects');
      }
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
      const updatedProjects = await window.electronAPI.projectList();
      setProjects(updatedProjects);

      // 4. Close the modal
      setShowNewProjectModal(false);

      console.log('[Home] Project creation complete');
    } catch (error) {
      console.error('[Home] Failed to create project:', error);
      alert('Failed to create project. Check console for details.');
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
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => onOpenProject(project.id)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => onOpenProject(project.id)}
                  variant="list"
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <NewProjectModal
          onClose={() => setShowNewProjectModal(false)}
          onCreateProject={handleCreateProject}
        />
      )}
    </div>
  );
};

export default HomeView;
