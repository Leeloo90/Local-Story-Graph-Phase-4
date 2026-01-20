import { create } from 'xmlbuilder2';
import fs from 'fs/promises';
import StoryGraphDatabase from '../database/schema';
import { StoryNode, MediaAsset } from '../../shared/types';

interface AssetInfo {
  xml_id: string;
  file_path: string;
  duration: number;
  fps_base: number;
}

export const generateFCPXML = async (db: StoryGraphDatabase, projectId: string, filePath: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const project = db.query('SELECT * FROM projects WHERE id = ?', [projectId])[0];
    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    // This is a simplified flattening for now. A full implementation would
    // traverse the entire graph of nodes and containers to create a linear sequence.
    const storyNodes: StoryNode[] = db.query('SELECT * FROM story_nodes');
    const mediaAssets: MediaAsset[] = db.query('SELECT * FROM media_library WHERE project_id = ?', [projectId]);
    const assetMap = new Map(mediaAssets.map(a => [a.id, a]));

    const defaultFps = 24; // Default FPS if not set

    const uniqueAssets: AssetInfo[] = Array.from(new Set(storyNodes.map(n => n.asset_id)))
      .filter((assetId): assetId is string => assetId !== null && assetId !== undefined)
      .map(assetId => {
        const asset = assetMap.get(assetId);
        if (!asset) return null;
        return {
          xml_id: `r${asset.id}`,
          file_path: asset.file_path || '',
          duration: asset.duration || 0,
          fps_base: asset.fps || defaultFps,
        };
      })
      .filter((a): a is AssetInfo => a !== null);

    const xml = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('fcpxml', { version: '1.10' });

    const resources = xml.ele('resources');
    uniqueAssets.forEach(asset => {
      const durationFrames = Math.floor(asset.duration * asset.fps_base);
      resources.ele('asset', {
        id: asset.xml_id,
        src: `file://${asset.file_path}`,
        start: '0s',
        duration: `${durationFrames}/${asset.fps_base}s`,
        hasVideo: '1',
        hasAudio: '1'
      });
    });

    const library = xml.ele('library');
    const event = library.ele('event', { name: project.name });
    const projectXml = event.ele('project', { name: 'Story Graph Export' });
    const sequence = projectXml.ele('sequence', { format: 'r1' }); // Placeholder format
    const spine = sequence.ele('spine');

    // Simple linear export of spine nodes for now
    storyNodes
      .filter(n => n.type === 'SPINE' && !n.anchor_id)
      .sort((a, b) => a.x - b.x)
      .forEach(node => {
        if (!node.asset_id) return;
        const asset = assetMap.get(node.asset_id);
        if (!asset) return;

        const clipDuration = (node.clip_out || asset.duration || 0) - (node.clip_in || 0);

        spine.ele('asset-clip', {
          name: asset.clean_name || asset.file_name || 'Untitled',
          ref: `r${asset.id}`,
          offset: '0s', // Simplified, actual offset calculation would be complex
          start: `${node.clip_in || 0}s`,
          duration: `${clipDuration}s`
        });
      });

    const xmlString = xml.end({ prettyPrint: true });
    await fs.writeFile(filePath, xmlString);

    console.log(`FCPXML exported to ${filePath}`);
    return { success: true };
  } catch (error) {
    console.error('Error generating FCPXML:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};
