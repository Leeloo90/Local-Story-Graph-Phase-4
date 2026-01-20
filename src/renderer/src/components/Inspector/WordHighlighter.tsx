import React, { useState, useEffect, useRef } from 'react';
import { WordToken, StoryNode } from '../../../../shared/types';

interface WordChipProps {
  word: WordToken;
  status: 'ACTIVE' | 'GHOST' | 'SELECTED';
  onClick: () => void;
  onDragStart: () => void;
  onDragEnter: () => void;
}

const WordChip: React.FC<WordChipProps> = ({ word, status, onClick, onDragStart, onDragEnter }) => {
  const getStatusStyles = () => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-accent-cyan bg-opacity-20 text-text-primary';
      case 'GHOST':
        return 'bg-surface-high text-text-tertiary opacity-60';
      case 'SELECTED':
        return 'bg-accent-indigo text-white scale-105 shadow-lg';
      default:
        return '';
    }
  };

  return (
    <span
      className={`px-2 py-1 rounded-md text-sm font-mono cursor-pointer transition-all duration-150 ${getStatusStyles()}`}
      onClick={onClick}
      onMouseDown={onDragStart}
      onMouseEnter={onDragEnter}
      title={`[${word.start.toFixed(2)} - ${word.end.toFixed(2)}]`}
    >
      {word.text}
    </span>
  );
};

interface WordHighlighterProps {
  node: StoryNode;
}

const WordHighlighter: React.FC<WordHighlighterProps> = ({ node }) => {
  const [words, setWords] = useState<WordToken[]>([]);
  const [selection, setSelection] = useState<[number, number] | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const selectionStartWord = useRef<WordToken | null>(null);

  useEffect(() => {
    const fetchTranscript = async () => {
      if (node) {
        const result = await window.electronAPI.transcriptGetForNode(node.id);
        if (result) {
          setWords(result.transcript.word_map_json);
        } else {
          setWords([]);
        }
      }
    };
    fetchTranscript();
  }, [node]);

  const handleSeek = (time: number) => {
    // Implement seek functionality if a video player is available
    console.log(`Seek to: ${time}`);
  };

  const handleSelectionStart = (word: WordToken) => {
    setIsDragging(true);
    selectionStartWord.current = word;
    setSelection([word.start, word.end]);
  };

  const handleSelectionExtend = (word: WordToken) => {
    if (isDragging && selectionStartWord.current) {
      const start = Math.min(selectionStartWord.current.start, word.start);
      const end = Math.max(selectionStartWord.current.end, word.end);
      setSelection([start, end]);
    }
  };

  const handleSelectionEnd = () => {
    setIsDragging(false);
    if (selection) {
      const [newIn, newOut] = selection;
      // window.electron.ipcRenderer.invoke('node:update', node.id, { clip_in: newIn, clip_out: newOut });
      console.log(`New trim for node ${node.id}: ${newIn} - ${newOut}`);
    }
    selectionStartWord.current = null;
  };

  if (!words.length) {
    return (
      <div className="p-4 text-center text-text-tertiary">
        <p>No transcript data for this node.</p>
        <button className="mt-2 btn-secondary text-sm">Import SRT</button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-wrap gap-1.5 p-4 bg-surface-high font-inter select-none"
      onMouseUp={handleSelectionEnd}
      onMouseLeave={handleSelectionEnd}
    >
      {words.map((word) => {
        const isSelected = selection && word.start >= selection[0] && word.end <= selection[1];
        const isActive = !isSelected && node.clip_in !== undefined && node.clip_out !== undefined && word.start >= node.clip_in && word.end <= node.clip_out;

        return (
          <WordChip
            key={word.id}
            word={word}
            status={isSelected ? 'SELECTED' : isActive ? 'ACTIVE' : 'GHOST'}
            onClick={() => handleSeek(word.start)}
            onDragStart={() => handleSelectionStart(word)}
            onDragEnter={() => handleSelectionExtend(word)}
          />
        );
      })}
    </div>
  );
};

export default WordHighlighter;
