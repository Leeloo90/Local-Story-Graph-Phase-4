import React, { useState, useEffect } from 'react';
import { X, Settings, Copy } from 'lucide-react';

interface NewCanvasModalProps {
  projectId: string;
  onClose: () => void;
  onCreateCanvas: (data: {
    name: string;
    description: string;
    fps: number;
    resolution: string;
    timecodeMode: string;
  }) => void;
}

interface ProjectSettings {
  fps: number;
  resolution: string;
}

const NewCanvasModal: React.FC<NewCanvasModalProps> = ({
  projectId,
  onClose,
  onCreateCanvas,
}) => {
  const [useProjectSettings, setUseProjectSettings] = useState(true);
  const [projectSettings, setProjectSettings] = useState<ProjectSettings | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    fps: 24,
    resolution: '1920x1080',
    timecodeMode: 'NON_DROP',
  });

  // Load project settings to use as defaults
  useEffect(() => {
    const loadProjectSettings = async () => {
      try {
        // Get project's first canvas to use as reference for settings
        const canvases = await window.electronAPI.canvasList(projectId);
        if (canvases.length > 0) {
          const firstCanvas = canvases[0];
          const settings = {
            fps: firstCanvas.FPS || 24,
            resolution: firstCanvas.Resolution || '1920x1080',
          };
          setProjectSettings(settings);
          setFormData((prev) => ({
            ...prev,
            fps: settings.fps,
            resolution: settings.resolution,
          }));
        }
      } catch (error) {
        console.error('[NewCanvas] Failed to load project settings:', error);
      }
    };

    loadProjectSettings();
  }, [projectId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateCanvas(formData);
  };

  const handleSettingsModeChange = (useProject: boolean) => {
    setUseProjectSettings(useProject);
    if (useProject && projectSettings) {
      setFormData((prev) => ({
        ...prev,
        fps: projectSettings.fps,
        resolution: projectSettings.resolution,
      }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="panel rounded-lg w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="panel-header">
          <h2 className="text-lg font-semibold text-text-primary">New Canvas</h2>
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
                placeholder="e.g., Director's Cut, TV Edit, Social Media"
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
                placeholder="Brief description of this canvas version..."
                rows={2}
                className="input resize-none"
              />
            </div>

            {/* Settings Mode Toggle */}
            <div className="border-t border-void-gray pt-4">
              <label className="block text-sm font-medium text-text-primary mb-3">
                Timeline Settings
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSettingsModeChange(true)}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                    useProjectSettings
                      ? 'border-accent-indigo bg-accent-indigo bg-opacity-10 text-accent-indigo'
                      : 'border-void-gray text-text-secondary hover:border-text-tertiary'
                  }`}
                >
                  <Copy size={16} />
                  <span className="text-sm font-medium">Use Project Settings</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSettingsModeChange(false)}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                    !useProjectSettings
                      ? 'border-accent-indigo bg-accent-indigo bg-opacity-10 text-accent-indigo'
                      : 'border-void-gray text-text-secondary hover:border-text-tertiary'
                  }`}
                >
                  <Settings size={16} />
                  <span className="text-sm font-medium">Custom Settings</span>
                </button>
              </div>
              {useProjectSettings && projectSettings && (
                <p className="mt-2 text-xs text-text-tertiary">
                  Will use: {projectSettings.fps} fps, {projectSettings.resolution}
                </p>
              )}
            </div>

            {/* Custom Settings (only shown when not using project settings) */}
            {!useProjectSettings && (
              <div className="space-y-4 p-4 bg-void-dark rounded-lg">
                {/* FPS */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Frame Rate (FPS)
                  </label>
                  <select
                    value={formData.fps}
                    onChange={(e) =>
                      setFormData({ ...formData, fps: Number(e.target.value) })
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
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Resolution
                  </label>
                  <select
                    value={formData.resolution}
                    onChange={(e) =>
                      setFormData({ ...formData, resolution: e.target.value })
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
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Timecode Mode
                  </label>
                  <select
                    value={formData.timecodeMode}
                    onChange={(e) =>
                      setFormData({ ...formData, timecodeMode: e.target.value })
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
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-void-gray">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Create Canvas
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewCanvasModal;
