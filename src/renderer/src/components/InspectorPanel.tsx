import React, { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, PanelRightClose, PanelLeftClose, GripVertical } from 'lucide-react';
import WordHighlighter from './WordHighlighter';

interface InspectorPanelProps {
  onToggleCollapse?: () => void;
  position?: 'left' | 'right';
}

const InspectorPanel: React.FC<InspectorPanelProps> = ({ onToggleCollapse, position = 'right' }) => {
  const [activeTab, setActiveTab] = useState<'media' | 'canvas' | 'highlighter'>('media');
  const [isPlaying, setIsPlaying] = useState(false);

  const tabs = [
    { id: 'media', label: 'Media' },
    { id: 'canvas', label: 'Canvas' },
    { id: 'highlighter', label: 'Highlighter' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="panel-header">
        <div className="flex items-center gap-2">
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="text-text-tertiary hover:text-text-primary transition-colors"
              title="Hide Inspector"
            >
              {position === 'left' ? <PanelLeftClose size={16} /> : <PanelRightClose size={16} />}
            </button>
          )}
          <div className="panel-drag-handle cursor-move flex items-center gap-1 px-1 hover:bg-void-dark rounded transition-colors">
            <GripVertical size={14} className="text-text-tertiary" />
            <h3 className="text-sm font-semibold text-text-primary">Inspector</h3>
          </div>
        </div>
      </div>

      {/* Forensic Player */}
      <div className="border-b border-void-gray">
        {/* Video Preview */}
        <div className="aspect-video bg-void-dark flex items-center justify-center border-b border-void-gray">
          <div className="text-center text-text-tertiary">
            <Play size={48} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No preview available</p>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="p-3 bg-surface-low">
          {/* Scrub Bar */}
          <div className="mb-3">
            <div className="relative h-2 bg-void-dark rounded-full overflow-hidden group cursor-pointer">
              <div className="absolute left-0 top-0 h-full w-1/3 bg-accent-indigo" />
              <div className="absolute left-1/3 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Timecode Display */}
          <div className="flex items-center justify-between mb-3 text-xs">
            <span className="timecode text-text-primary font-mono">01:23:45:12</span>
            <span className="timecode text-text-tertiary font-mono">02:45:30:00</span>
          </div>

          {/* Transport Controls */}
          <div className="flex items-center justify-center gap-2">
            <button className="p-2 hover:bg-void-dark rounded transition-colors text-text-secondary hover:text-text-primary">
              <SkipBack size={18} />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-3 bg-accent-indigo hover:bg-indigo-600 rounded-lg transition-colors text-white"
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button className="p-2 hover:bg-void-dark rounded transition-colors text-text-secondary hover:text-text-primary">
              <SkipForward size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-void-gray flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? 'text-accent-indigo'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-indigo" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'media' && (
          <div className="p-4 space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-text-tertiary uppercase mb-2">
                File Information
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Format</span>
                  <span className="text-text-primary">ProRes 422 HQ</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Resolution</span>
                  <span className="text-text-primary coordinate">1920x1080</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Frame Rate</span>
                  <span className="text-text-primary timecode">24 fps</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Duration</span>
                  <span className="text-text-primary timecode">00:03:00:12</span>
                </div>
              </div>
            </div>

            <div className="border-t border-void-gray pt-4">
              <h4 className="text-xs font-semibold text-text-tertiary uppercase mb-2">
                Audio Channels
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Ch 1-2</span>
                  <span className="text-text-primary">Stereo Mix</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'canvas' && (
          <div className="p-4 space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-text-tertiary uppercase mb-2">
                Canvas Settings
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">FPS</span>
                  <span className="text-text-primary timecode">24</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Resolution</span>
                  <span className="text-text-primary coordinate">1920x1080</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Timecode Mode</span>
                  <span className="text-text-primary">Non-Drop</span>
                </div>
              </div>
            </div>

            <div className="border-t border-void-gray pt-4">
              <h4 className="text-xs font-semibold text-text-tertiary uppercase mb-2">
                Statistics
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Total Nodes</span>
                  <span className="text-text-primary">47</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Spine Nodes</span>
                  <span className="text-accent-purple">12</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Satellite Nodes</span>
                  <span className="text-accent-cyan">35</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Total Duration</span>
                  <span className="text-text-primary timecode">00:24:15:18</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'highlighter' && <WordHighlighter />}
      </div>
    </div>
  );
};

export default InspectorPanel;
