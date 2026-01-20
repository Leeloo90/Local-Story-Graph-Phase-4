/**
 * Multicam Service
 * Phase 8: Parse multicam XML (FCPXML v1.10 / FCP7) and manage multicam clips
 */

import { create } from 'xmlbuilder2';
import { v4 as uuidv4 } from 'uuid';
import StoryGraphDatabase from '../database/schema';

// These interfaces are reserved for future use when we expand multicam parsing
// interface MulticamAngle {
//   label: string;
//   filePath: string;
//   syncOffset: number;
//   audioChannelMap?: string;
// }

// interface ParsedMulticam {
//   name: string;
//   angles: MulticamAngle[];
// }

/**
 * Parse FCPXML to extract multicam clip information
 * Supports FCPXML v1.10 format
 */
export const parseMulticamXml = async (
  db: StoryGraphDatabase,
  xmlContent: string
): Promise<{ success: boolean; multicamIds: string[]; error?: string }> => {
  try {
    console.log('[Multicam] Parsing XML content...');

    // Parse XML using xmlbuilder2
    const doc = create(xmlContent);
    const multicamIds: string[] = [];

    // Convert to object for easier traversal
    const xmlObj = doc.end({ format: 'object' }) as any;

    // Navigate FCPXML structure
    const fcpxml = xmlObj.fcpxml;
    if (!fcpxml) {
      return { success: false, multicamIds: [], error: 'Invalid XML: no fcpxml root element' };
    }

    const resources = fcpxml.resources;
    if (!resources) {
      return { success: false, multicamIds: [], error: 'No resources found in FCPXML' };
    }

    // Build a map of assets by ID for quick lookup
    const assetMap = new Map<string, { id: string; src: string }>();
    const assetArray = Array.isArray(resources.asset) ? resources.asset : resources.asset ? [resources.asset] : [];
    assetArray.forEach((asset: any) => {
      if (asset['@id'] && asset['@src']) {
        assetMap.set(asset['@id'], { id: asset['@id'], src: asset['@src'] });
      }
    });

    // Find media elements that contain multicam data
    const mediaArray = Array.isArray(resources.media) ? resources.media : resources.media ? [resources.media] : [];

    for (const media of mediaArray) {
      const multicam = media.multicam;
      if (!multicam) continue;

      // Note: media['@id'] is available for future reference tracking
      const mediaName = media['@name'] || 'Untitled Multicam';

      console.log(`[Multicam] Found multicam: ${mediaName}`);

      // Create virtual multicam asset in media_library
      const multicamAssetId = uuidv4();
      db.execute(
        `INSERT INTO media_library (
          id, project_id, file_name, clean_name, file_path, format, media_type,
          fps, resolution, duration, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          multicamAssetId,
          null, // Will be assigned to project when used
          `${mediaName}.multicam`,
          mediaName,
          '', // Virtual asset, no file path
          'multicam',
          'MULTICAM',
          null,
          null,
          null,
        ]
      );

      // Parse angles from mc-angle elements
      const mcAngles = Array.isArray(multicam['mc-angle'])
        ? multicam['mc-angle']
        : multicam['mc-angle']
        ? [multicam['mc-angle']]
        : [];

      let angleIndex = 0;
      for (const angle of mcAngles) {
        const angleLabel = angle['@name'] || `Angle ${angleIndex + 1}`;
        const angleRef = angle['@ref'];

        // Find the referenced asset to get file path
        if (angleRef) {
          const referencedAsset = assetMap.get(angleRef);
          if (referencedAsset) {
            const filePath = referencedAsset.src.replace('file://', '');

            // Check if this media already exists in library
            const existingMedia = db.query(
              'SELECT id FROM media_library WHERE file_path = ?',
              [filePath]
            );

            let memberMediaId: string;
            if (existingMedia.length > 0) {
              memberMediaId = (existingMedia[0] as { id: string }).id;
            } else {
              // Create new media entry for this angle
              memberMediaId = uuidv4();
              const fileName = filePath.split('/').pop() || 'unknown';
              db.execute(
                `INSERT INTO media_library (
                  id, project_id, file_name, clean_name, file_path, format, media_type, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [memberMediaId, null, fileName, angleLabel, filePath, 'mov', 'BROLL']
              );
            }

            // Insert multicam member relationship
            db.execute(
              `INSERT INTO multicam_members (
                multicam_media_id, member_media_id, angle_label, sync_offset
              ) VALUES (?, ?, ?, ?)`,
              [multicamAssetId, memberMediaId, angleLabel, 0]
            );

            console.log(`[Multicam]   - Angle: ${angleLabel} -> ${filePath}`);
          }
        }
        angleIndex++;
      }

      multicamIds.push(multicamAssetId);
    }

    if (multicamIds.length === 0) {
      return { success: false, multicamIds: [], error: 'No multicam clips found in XML' };
    }

    console.log(`[Multicam] Successfully parsed ${multicamIds.length} multicam clip(s)`);
    return { success: true, multicamIds };
  } catch (error) {
    console.error('[Multicam] Parse error:', error);
    return {
      success: false,
      multicamIds: [],
      error: error instanceof Error ? error.message : 'Unknown parse error',
    };
  }
};

/**
 * Get all angles for a multicam clip
 */
export const getMulticamAngles = (
  db: StoryGraphDatabase,
  multicamMediaId: string
): Array<{ member_media_id: string; angle_label: string; sync_offset: number }> => {
  return db.query(
    `SELECT mm.member_media_id, mm.angle_label, mm.sync_offset, ml.file_path, ml.clean_name
     FROM multicam_members mm
     JOIN media_library ml ON mm.member_media_id = ml.id
     WHERE mm.multicam_media_id = ?
     ORDER BY mm.angle_label`,
    [multicamMediaId]
  );
};

/**
 * Set the active angle for a multicam node
 */
export const setActiveAngle = (
  db: StoryGraphDatabase,
  nodeId: string,
  memberMediaId: string
): void => {
  // Update the node's internal_state_map to track active angle
  db.execute(
    `UPDATE story_nodes
     SET internal_state_map = json_set(COALESCE(internal_state_map, '{}'), '$.active_angle', ?)
     WHERE id = ?`,
    [memberMediaId, nodeId]
  );
  console.log(`[Multicam] Set active angle for node ${nodeId} to ${memberMediaId}`);
};

/**
 * Create a multicam clip manually from selected media assets
 */
export const createMulticamFromAssets = (
  db: StoryGraphDatabase,
  projectId: string,
  name: string,
  angles: Array<{ mediaId: string; label: string; syncOffset?: number }>
): string => {
  // Create virtual multicam asset
  const multicamId = uuidv4();
  db.execute(
    `INSERT INTO media_library (
      id, project_id, file_name, clean_name, file_path, format, media_type, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [multicamId, projectId, `${name}.multicam`, name, '', 'multicam', 'MULTICAM']
  );

  // Add angle members
  angles.forEach((angle) => {
    db.execute(
      `INSERT INTO multicam_members (
        multicam_media_id, member_media_id, angle_label, sync_offset
      ) VALUES (?, ?, ?, ?)`,
      [multicamId, angle.mediaId, angle.label, angle.syncOffset || 0]
    );
  });

  console.log(`[Multicam] Created multicam "${name}" with ${angles.length} angles`);
  return multicamId;
};
