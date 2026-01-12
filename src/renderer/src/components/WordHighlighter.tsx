import React, { useState } from 'react';
import { mockWords, MockWord } from '../data/mockData';

const WordHighlighter: React.FC = () => {
  const [words, setWords] = useState<MockWord[]>(mockWords);
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());

  const handleWordClick = (wordId: string) => {
    setSelectedWords((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(wordId)) {
        newSet.delete(wordId);
      } else {
        newSet.add(wordId);
      }
      return newSet;
    });
  };

  const handleAddToCanvas = () => {
    console.log('[MOCK] Adding selected words to canvas:', Array.from(selectedWords));
    setSelectedWords(new Set());
  };

  const selectedCount = selectedWords.size;
  const hasSelection = selectedCount > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header with Actions */}
      <div className="p-4 border-b border-void-gray">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-text-primary">
            Word Grid
          </h4>
          {hasSelection && (
            <span className="text-xs text-accent-indigo">
              {selectedCount} {selectedCount === 1 ? 'word' : 'words'} selected
            </span>
          )}
        </div>

        {hasSelection && (
          <div className="flex gap-2">
            <button
              onClick={handleAddToCanvas}
              className="flex-1 btn-primary text-sm py-2"
            >
              Add to Canvas
            </button>
            <button
              onClick={() => setSelectedWords(new Set())}
              className="flex-1 btn-secondary text-sm py-2"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Word Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-wrap gap-1.5">
          {words.map((word) => {
            const isSelected = selectedWords.has(word.id);
            return (
              <button
                key={word.id}
                onClick={() => handleWordClick(word.id)}
                className={`px-2.5 py-1.5 rounded text-sm font-medium transition-all ${
                  isSelected
                    ? 'bg-accent-indigo text-white shadow-md scale-105'
                    : 'text-text-primary hover:bg-accent-indigo hover:bg-opacity-50'
                }`}
                title={`Frame ${word.frame_in}-${word.frame_out}`}
              >
                {word.word}
              </button>
            );
          })}
        </div>

        {/* Selection Info */}
        {hasSelection && (
          <div className="mt-6 p-3 bg-void-dark rounded-lg border border-void-gray">
            <h5 className="text-xs font-semibold text-text-tertiary uppercase mb-2">
              Selection Info
            </h5>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">Word Count</span>
                <span className="text-text-primary">{selectedCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Frame Range</span>
                <span className="text-text-primary timecode">
                  {Math.min(...Array.from(selectedWords).map(id =>
                    words.find(w => w.id === id)?.frame_in || 0
                  ))}-{Math.max(...Array.from(selectedWords).map(id =>
                    words.find(w => w.id === id)?.frame_out || 0
                  ))}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="p-4 border-t border-void-gray bg-void-dark">
        <p className="text-xs text-text-tertiary">
          💡 Click words to select frame-accurate segments for your timeline
        </p>
      </div>
    </div>
  );
};

export default WordHighlighter;
