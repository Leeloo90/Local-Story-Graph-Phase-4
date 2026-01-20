import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Canvas } from '../../../shared/types';

interface EditCanvasModalProps {
  canvas: Canvas;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Canvas>) => void;
}

const EditCanvasModal: React.FC<EditCanvasModalProps> = ({
  canvas,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    name: canvas.name,
    description: canvas.description || '',
    FPS: canvas.FPS,
    Resolution: canvas.Resolution,
    Timecode_mode: canvas.Timecode_mode || 'NON_DROP',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(canvas.id, formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="panel rounded-lg w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="panel-header">
          <h2 className="text-lg font-semibold text-text-primary">
            Edit Canvas Settings
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
            {/* Canvas Name */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Canvas Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Director's Cut"
                className="input"
                required
                autoFocus
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
                placeholder="Brief description of this canvas..."
                rows={2}
                className="input resize-none"
              />
            </div>

            {/* Timeline Settings */}
            <div className="border-t border-void-gray pt-4">
              <h3 className="text-sm font-medium text-text-primary mb-4">
                Timeline Settings
              </h3>

              {/* FPS */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Frame Rate (FPS)
                </label>
                <select
                  value={formData.FPS}
                  onChange={(e) =>
                    setFormData({ ...formData, FPS: Number(e.target.value) })
                  }
                  className="input"
                >
                  <option value={23.976}>23.976 (Film)</option>
                  <option value={24}>24 (Cinema)</option>
                  <option value={25}>25 (PAL)</option>
                  <option value={29.97}>29.97 (NTSC)</option>
                  <option value={30}>30 (HD)</option>
                  <option value={50}>50 (PAL HFR)</option>
                  <option value={59.94}>59.94 (NTSC HFR)</option>
                  <option value={60}>60 (High Frame Rate)</option>
                </select>
              </div>

              {/* Resolution */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Resolution
                </label>
                <select
                  value={formData.Resolution}
                  onChange={(e) =>
                    setFormData({ ...formData, Resolution: e.target.value })
                  }
                  className="input"
                >
                  <option value="1280x720">1280x720 (HD 720p)</option>
                  <option value="1920x1080">1920x1080 (Full HD 1080p)</option>
                  <option value="2560x1440">2560x1440 (2K QHD)</option>
                  <option value="3840x2160">3840x2160 (4K UHD)</option>
                  <option value="4096x2160">4096x2160 (4K DCI)</option>
                  <option value="7680x4320">7680x4320 (8K UHD)</option>
                  <option value="1080x1920">1080x1920 (Vertical HD)</option>
                  <option value="1080x1080">1080x1080 (Square)</option>
                </select>
              </div>

              {/* Timecode Mode */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Timecode Mode
                </label>
                <select
                  value={formData.Timecode_mode}
                  onChange={(e) =>
                    setFormData({ ...formData, Timecode_mode: e.target.value as 'NON_DROP' | 'DROP' })
                  }
                  className="input"
                >
                  <option value="NON_DROP">Non-Drop Frame</option>
                  <option value="DROP">Drop Frame</option>
                </select>
                <p className="mt-1 text-xs text-text-tertiary">
                  Drop frame is typically used for NTSC framerates (29.97, 59.94)
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-void-gray">
            <button type="button" onClick={onClose} className="btn-secondary">
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

export default EditCanvasModal;
