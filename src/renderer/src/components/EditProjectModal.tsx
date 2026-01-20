import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Project } from '../../../shared/types';

interface EditProjectModalProps {
  project: Project;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Project>) => void;
}

const EditProjectModal: React.FC<EditProjectModalProps> = ({
  project,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    name: project.name,
    client: project.client || '',
    description: project.description || '',
    status: project.status,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(project.id, {
      name: formData.name,
      client: formData.client || undefined,
      description: formData.description || undefined,
      status: formData.status,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="panel rounded-lg w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="panel-header">
          <h2 className="text-lg font-semibold text-text-primary">
            Edit Project
          </h2>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            {/* Project Name */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Project Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Documentary: Climate Crisis"
                className="input"
                required
                autoFocus
              />
            </div>

            {/* Client */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Client
              </label>
              <input
                type="text"
                value={formData.client}
                onChange={(e) =>
                  setFormData({ ...formData, client: e.target.value })
                }
                placeholder="e.g., National Geographic"
                className="input"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of the project..."
                rows={3}
                className="input resize-none"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as Project['status'] })
                }
                className="input"
              >
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-void-gray">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProjectModal;
