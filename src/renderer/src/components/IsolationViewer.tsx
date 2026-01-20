import React from 'react';
import { X } from 'lucide-react';
import { StoryNode } from '../../../shared/types';

interface IsolationViewerProps {
  node: StoryNode;
  onClose: () => void;
}

const IsolationViewer: React.FC<IsolationViewerProps> = ({ node, onClose }) => {
  return (
    <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-surface-high p-8 rounded-lg max-w-4xl w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Isolation Mode</h2>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        <p className="text-text-secondary mb-4">
          Viewing multicam node: {node.id.slice(0, 8)}
        </p>
        <div className="aspect-video bg-void-dark rounded-lg flex items-center justify-center">
          <p className="text-text-tertiary">Multicam preview area</p>
        </div>
      </div>
    </div>
  );
};

export default IsolationViewer;
