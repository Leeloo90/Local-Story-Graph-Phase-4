import React, { useState, useEffect } from 'react';
import { Plus, Search, FileVideo, FileAudio, Music, Layers, PanelLeftClose, PanelRightClose, GripVertical } from 'lucide-react';
import { MediaAsset } from '../../../shared/types';

interface MediaLibraryPanelProps {
  projectId?: string;
  onToggleCollapse?: () => void;
  position?: 'left' | 'right';
}

const MediaLibraryPanel: React.FC<MediaLibraryPanelProps> = ({ projectId, onToggleCollapse, position = 'left' }) => {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'BROLL' | 'DIALOGUE' | 'MUSIC' | 'IMAGE' | 'MULTICAM'>('ALL');
  const [loading, setLoading] = useState(false);

  // Load media assets from database when component mounts
  useEffect(() => {
    if (projectId) {
      loadMediaAssets();
    }
  }, [projectId]);

  const loadMediaAssets = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      const loadedAssets = await window.electronAPI.mediaGetAll(projectId);
      setAssets(loadedAssets);
      console.log('[Media Library] Loaded', loadedAssets.length, 'assets');
    } catch (error) {
      console.error('[Media Library] Failed to load assets:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle media import
  const handleImport = async () => {
    if (!projectId) {
      console.warn('[Media Library] No project ID provided');
      return;
    }

    try {
      // Open file picker
      const filePaths = await window.electronAPI.selectFiles();

      if (filePaths.length === 0) {
        console.log('[Media Library] Import canceled');
        return;
      }

      console.log('[Media Library] Importing', filePaths.length, 'files...');
      setLoading(true);

      // Import files via IPC
      const importedAssets = await window.electronAPI.mediaImport(projectId, filePaths);

      // Update state with new assets
      setAssets((prev) => [...importedAssets, ...prev]);

      console.log('[Media Library] Successfully imported', importedAssets.length, 'assets');
    } catch (error) {
      console.error('[Media Library] Import failed:', error);
      alert('Failed to import media files. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch = asset.clean_name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'ALL' || asset.media_type === filterType;
    return matchesSearch && matchesType;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'DIALOGUE':
      case 'BROLL':
        return <FileVideo size={16} />;
      case 'MUSIC':
        return <Music size={16} />;
      case 'MULTICAM':
        return <Layers size={16} />;
      case 'IMAGE':
        return <FileAudio size={16} />; // Or use an Image icon
      default:
        return <FileAudio size={16} />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'DIALOGUE':
        return 'text-accent-purple';
      case 'BROLL':
        return 'text-accent-cyan';
      case 'MUSIC':
        return 'text-accent-green';
      case 'MULTICAM':
        return 'text-accent-amber';
      case 'IMAGE':
        return 'text-text-secondary';
      default:
        return 'text-text-tertiary';
    }
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="panel-header">
        <div className="flex items-center gap-2">
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="text-text-tertiary hover:text-text-primary transition-colors"
              title="Hide Media Library"
            >
              {position === 'left' ? <PanelLeftClose size={16} /> : <PanelRightClose size={16} />}
            </button>
          )}
          <div className="panel-drag-handle cursor-move flex items-center gap-1 px-1 hover:bg-void-dark rounded transition-colors">
            <GripVertical size={14} className="text-text-tertiary" />
            <h3 className="text-sm font-semibold text-text-primary">Media Library</h3>
          </div>
        </div>
        <button
          onClick={handleImport}
          disabled={loading || !projectId}
          className="text-accent-indigo hover:text-indigo-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={loading ? 'Importing...' : 'Import Media'}
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-void-gray">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search media..."
            className="w-full pl-9 pr-3 py-2 bg-void-dark border border-void-gray rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-indigo focus:border-transparent"
          />
        </div>
      </div>

      {/* Type Filters */}
      <div className="px-3 py-2 border-b border-void-gray flex gap-1 overflow-x-auto">
        {['ALL', 'DIALOGUE', 'BROLL', 'MUSIC', 'IMAGE', 'MULTICAM'].map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type as any)}
            className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors ${
              filterType === type
                ? 'bg-accent-indigo text-white'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-low'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Assets List */}
      <div className="flex-1 overflow-y-auto">
        {loading && assets.length === 0 ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-indigo mx-auto mb-2"></div>
            <p className="text-sm text-text-secondary">Loading media...</p>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="p-6 text-center">
            <FileVideo size={32} className="mx-auto mb-2 text-text-tertiary" />
            <p className="text-sm text-text-secondary">
              {searchQuery ? 'No matches found' : 'No media assets yet'}
            </p>
            {!projectId && (
              <p className="text-xs text-text-tertiary mt-2">
                Open a project to import media
              </p>
            )}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredAssets.map((asset) => (
              <div
                key={asset.id}
                className="p-3 rounded-lg bg-void-dark hover:bg-surface-low border border-transparent hover:border-void-gray cursor-grab active:cursor-grabbing transition-all group"
                draggable
                onDragStart={(e) => {
                  // Store asset data for canvas drop
                  e.dataTransfer.setData('application/media-asset', JSON.stringify(asset));
                  e.dataTransfer.effectAllowed = 'copy';
                  console.log('[Drag] Started dragging:', asset.clean_name);
                }}
              >
                {/* Asset Header */}
                <div className="flex items-start gap-2 mb-2">
                  <div className={`mt-0.5 ${getTypeColor(asset.media_type)}`}>
                    {getTypeIcon(asset.media_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate group-hover:text-accent-indigo transition-colors">
                      {asset.clean_name}
                    </p>
                    <p className="text-xs text-text-tertiary file-path truncate">
                      {asset.file_name}
                    </p>
                  </div>
                </div>

                {/* Asset Meta */}
                <div className="flex items-center gap-3 text-xs text-text-tertiary">
                  <span className="timecode">{formatDuration(asset.duration)}</span>
                  {asset.fps && (
                    <span className="timecode">{asset.fps.toFixed(2)} fps</span>
                  )}
                  {asset.resolution && (
                    <span className="coordinate">{asset.resolution}</span>
                  )}
                </div>

                {/* Badges */}
                <div className="flex gap-1 mt-2">
                  {asset.resolution?.includes('3840') && (
                    <span className="badge bg-accent-cyan bg-opacity-20 text-accent-cyan text-[10px]">
                      4K
                    </span>
                  )}
                  {asset.resolution?.includes('7680') && (
                    <span className="badge bg-accent-cyan bg-opacity-20 text-accent-cyan text-[10px]">
                      8K
                    </span>
                  )}
                  {asset.media_type === 'MULTICAM' && (
                    <span className="badge-multicam text-[10px]">MC</span>
                  )}
                  {asset.format && (
                    <span className="badge bg-void-gray bg-opacity-50 text-text-tertiary text-[10px] uppercase">
                      {asset.format}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="px-4 py-2 border-t border-void-gray bg-void-dark">
        <p className="text-xs text-text-tertiary">
          {filteredAssets.length} {filteredAssets.length === 1 ? 'asset' : 'assets'}
          {filterType !== 'ALL' && ` · ${filterType}`}
        </p>
      </div>
    </div>
  );
};

export default MediaLibraryPanel;
