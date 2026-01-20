import React from 'react';
import { Clock, User } from 'lucide-react';
import { Project } from '../../../shared/types';

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  variant?: 'grid' | 'list';
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onClick,
  onContextMenu,
  variant = 'grid'
}) => {
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'badge-status-active';
      case 'ARCHIVED':
        return 'badge-status-archived';
      case 'COMPLETED':
        return 'bg-accent-indigo bg-opacity-20 text-accent-indigo';
      default:
        return 'badge-status-archived';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (variant === 'list') {
    return (
      <div
        onClick={onClick}
        onContextMenu={onContextMenu}
        className="panel rounded-lg p-4 cursor-pointer transition-all hover:border-accent-indigo hover:shadow-node-active group"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-base font-medium text-text-primary group-hover:text-accent-indigo transition-colors">
                {project.name}
              </h3>
              <span className={`badge ${getStatusBadgeClass(project.status)}`}>
                {project.status}
              </span>
            </div>
            <p className="text-sm text-text-secondary line-clamp-1">
              {project.description}
            </p>
          </div>

          <div className="flex items-center gap-6 text-sm text-text-tertiary">
            {project.client && (
              <div className="flex items-center gap-2">
                <User size={14} />
                <span>{project.client}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock size={14} />
              <span>{formatDate(project.updated_at)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="panel rounded-lg overflow-hidden cursor-pointer transition-all hover:border-accent-indigo hover:shadow-node-active hover:-translate-y-1 group"
    >
      {/* Thumbnail */}
      <div className="w-full h-32 bg-void-dark flex items-center justify-center border-b border-void-gray">
        <div className="text-text-tertiary">
          {/* Placeholder for project thumbnail */}
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
          </svg>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="mb-3">
          <h3 className="text-base font-medium text-text-primary mb-1 line-clamp-2 group-hover:text-accent-indigo transition-colors">
            {project.name}
          </h3>
          {project.client && (
            <p className="text-xs text-text-tertiary">
              {project.client}
            </p>
          )}
        </div>

        <p className="text-sm text-text-secondary line-clamp-2 mb-4">
          {project.description}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className={`badge ${getStatusBadgeClass(project.status)}`}>
            {project.status}
          </span>
          <span className="text-xs text-text-tertiary">
            {formatDate(project.updated_at)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
