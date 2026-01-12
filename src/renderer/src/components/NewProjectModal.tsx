import React, { useState } from 'react';
import { X } from 'lucide-react';

interface NewProjectModalProps {
  onClose: () => void;
  onCreateProject: (data: {
    name: string;
    client: string;
    description: string;
    fps: number;
    resolution: string;
  }) => void;
}

const NewProjectModal: React.FC<NewProjectModalProps> = ({
  onClose,
  onCreateProject,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState({
    name: '',
    client: '',
    description: '',
    fps: 24,
    resolution: '1920x1080',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      setStep(2);
    } else {
      onCreateProject(formData);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="panel rounded-lg w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="panel-header">
          <h2 className="text-lg font-semibold text-text-primary">
            {step === 1 ? 'New Project' : 'Canvas Setup'}
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
          {step === 1 ? (
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
            </div>
          ) : (
            <div className="space-y-4">
              {/* FPS */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Frame Rate (FPS) *
                </label>
                <select
                  value={formData.fps}
                  onChange={(e) =>
                    setFormData({ ...formData, fps: Number(e.target.value) })
                  }
                  className="input"
                  required
                >
                  <option value={23.976}>23.976 (Film)</option>
                  <option value={24}>24 (Cinema)</option>
                  <option value={25}>25 (PAL)</option>
                  <option value={29.97}>29.97 (NTSC)</option>
                  <option value={30}>30 (HD)</option>
                  <option value={60}>60 (High Frame Rate)</option>
                </select>
                <p className="mt-1 text-xs text-text-tertiary">
                  Default frame rate for the project timeline
                </p>
              </div>

              {/* Resolution */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Resolution *
                </label>
                <select
                  value={formData.resolution}
                  onChange={(e) =>
                    setFormData({ ...formData, resolution: e.target.value })
                  }
                  className="input"
                  required
                >
                  <option value="1920x1080">1920x1080 (Full HD)</option>
                  <option value="2560x1440">2560x1440 (2K)</option>
                  <option value="3840x2160">3840x2160 (4K UHD)</option>
                  <option value="4096x2160">4096x2160 (4K DCI)</option>
                  <option value="7680x4320">7680x4320 (8K)</option>
                </select>
                <p className="mt-1 text-xs text-text-tertiary">
                  Default resolution for preview and export
                </p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-void-gray">
            <div className="text-sm text-text-tertiary">
              Step {step} of 2
            </div>
            <div className="flex gap-3">
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn-secondary"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                {step === 1 ? 'Next' : 'Create Project'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewProjectModal;
