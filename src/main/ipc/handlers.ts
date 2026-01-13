/**
 * IPC Handlers
 * Main process handlers for all IPC channels
 */

import { ipcMain, dialog } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import type { Project, Canvas, StoryNode, MediaAsset, ConnectionMode } from '../../shared/types';
import StoryGraphDatabase from '../database/schema';
import { extractMetadata, isSupportedMediaFile, generateCleanName, calculateEndTimecode } from '../services/ffmpeg';
import {
  validateAnchorChain,
  validateSemanticRules,
} from '../services/topology';
import path from 'path';

let db: StoryGraphDatabase | null = null;

export function initializeDatabase(projectName: string = 'default') {
  db = new StoryGraphDatabase(projectName);
  return db;
}

export function registerIpcHandlers() {
  // ===========================================================================
  // FILE OPERATIONS
  // ===========================================================================
  ipcMain.handle('select-files', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Media Files', extensions: ['mov', 'mp4', 'avi', 'mkv', 'wav', 'mp3', 'aac', 'jpg', 'png'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });

    return result.canceled ? null : result.filePaths[0];
  });

  // ===========================================================================
  // DATABASE OPERATIONS
  // ===========================================================================
  ipcMain.handle('db-query', async (_event, query: string, params: any[] = []) => {
    if (!db) throw new Error('Database not initialized');
    return db.query(query, params);
  });

  ipcMain.handle('db-execute', async (_event, query: string, params: any[] = []) => {
    if (!db) throw new Error('Database not initialized');
    db.execute(query, params);
  });

  // ===========================================================================
  // PROJECT CRUD
  // ===========================================================================
  ipcMain.handle('project-create', async (_event, projectData: Omit<Project, 'id' | 'created_at' | 'updated_at'>) => {
    if (!db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    const project: Project = {
      id,
      ...projectData,
      status: projectData.status || 'ACTIVE',
      created_at: now,
      updated_at: now,
    };

    db.execute(
      `INSERT INTO projects (id, name, description, client, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [project.id, project.name, project.description || null, project.client || null, project.status, project.created_at, project.updated_at]
    );

    // Create default project settings
    db.execute(
      `INSERT INTO project_settings (project_id, proxy_mode_enabled)
       VALUES (?, 0)`,
      [project.id]
    );

    // Create default canvas
    const canvasId = uuidv4();
    db.execute(
      `INSERT INTO canvases (id, project_id, name, created_at, updated_at, FPS, Resolution, Timecode_mode)
       VALUES (?, ?, ?, ?, ?, 24, '1920x1080', 'NON_DROP')`,
      [canvasId, project.id, 'Main Canvas', now, now]
    );

    // Set default canvas in settings
    db.execute(
      `UPDATE project_settings SET last_canvas_id = ? WHERE project_id = ?`,
      [canvasId, project.id]
    );

    console.log(`Project created: ${project.name} (${project.id})`);
    return project;
  });

  ipcMain.handle('project-get', async (_event, id: string) => {
    if (!db) throw new Error('Database not initialized');

    const results = db.query('SELECT * FROM projects WHERE id = ?', [id]);
    return results.length > 0 ? results[0] : null;
  });

  ipcMain.handle('project-list', async () => {
    if (!db) throw new Error('Database not initialized');
    return db.query('SELECT * FROM projects ORDER BY updated_at DESC');
  });

  ipcMain.handle('project-update', async (_event, id: string, updates: Partial<Project>) => {
    if (!db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.client !== undefined) {
      fields.push('client = ?');
      values.push(updates.client);
    }
    if (updates.status) {
      fields.push('status = ?');
      values.push(updates.status);
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    db.execute(
      `UPDATE projects SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    console.log(`Project updated: ${id}`);
  });

  ipcMain.handle('project-delete', async (_event, id: string) => {
    if (!db) throw new Error('Database not initialized');

    // CASCADE will handle deletion of related records
    db.execute('DELETE FROM projects WHERE id = ?', [id]);

    console.log(`Project deleted: ${id}`);
  });

  // ===========================================================================
  // MEDIA OPERATIONS
  // ===========================================================================
  ipcMain.handle('media-import', async (_event, projectId: string, filePaths: string[]) => {
    if (!db) throw new Error('Database not initialized');

    console.log('[Media Import] Starting import for', filePaths.length, 'files');

    const importedAssets: MediaAsset[] = [];
    const errors: Array<{ file: string; error: string }> = [];

    for (const filePath of filePaths) {
      try {
        // Validate file is supported
        if (!isSupportedMediaFile(filePath)) {
          console.warn(`[Media Import] Unsupported file type: ${filePath}`);
          errors.push({ file: filePath, error: 'Unsupported file type' });
          continue;
        }

        // Extract forensic metadata via FFprobe
        const metadata = await extractMetadata(filePath);

        // Generate IDs and names
        const id = uuidv4();
        const fileName = path.basename(filePath);
        const cleanName = generateCleanName(fileName);
        const format = path.extname(filePath).toLowerCase().replace('.', '');

        // Determine media type based on metadata
        let media_type: 'BROLL' | 'DIALOGUE' | 'MUSIC' | 'IMAGE' | 'MULTICAM' = 'BROLL';
        if (!metadata.has_video && metadata.has_audio) {
          media_type = 'MUSIC'; // Audio-only defaults to MUSIC
        } else if (metadata.has_video && !metadata.has_audio) {
          media_type = 'BROLL'; // Video-only (B-Roll)
        } else if (metadata.width === 0 && metadata.height === 0) {
          media_type = 'IMAGE'; // Image file
        }
        // DIALOGUE and MULTICAM types will be set manually by user later

        // Use total_frames from FFprobe if available, otherwise calculate
        const total_frames = metadata.total_frames ||
          (metadata.duration > 0 && metadata.fps > 0
            ? Math.floor(metadata.duration * metadata.fps)
            : null);

        // Extract start timecode and calculate end timecode
        const start_tc = metadata.timecode_start;
        const end_tc = start_tc && metadata.fps > 0
          ? calculateEndTimecode(start_tc, metadata.duration, metadata.fps)
          : null;

        // Create MediaAsset object
        const asset: MediaAsset = {
          id,
          project_id: projectId,
          file_name: fileName,
          clean_name: cleanName,
          file_path: filePath,
          format,
          media_type,
          fps: metadata.fps || null,
          resolution: metadata.resolution,
          start_tc,
          end_tc,
          total_frames,
          duration: metadata.duration,
          size: metadata.file_size,
          metadata_raw: JSON.stringify({
            mime_type: metadata.mime_type,
            has_video: metadata.has_video,
            has_audio: metadata.has_audio,
            width: metadata.width,
            height: metadata.height,
            timecode_start: metadata.timecode_start,
            total_frames: metadata.total_frames,
          }),
          created_at: new Date().toISOString(),
        };

        // Insert into database
        db.execute(
          `INSERT INTO media_library (
            id, project_id, file_name, clean_name, file_path, format, media_type,
            fps, resolution, start_tc, end_tc, total_frames, duration, size, metadata_raw, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            asset.id,
            asset.project_id,
            asset.file_name,
            asset.clean_name,
            asset.file_path,
            asset.format,
            asset.media_type,
            asset.fps,
            asset.resolution,
            asset.start_tc,
            asset.end_tc,
            asset.total_frames,
            asset.duration,
            asset.size,
            asset.metadata_raw,
            asset.created_at,
          ]
        );

        importedAssets.push(asset);

        console.log(`[Media Import] ✓ Imported: ${cleanName} (${metadata.resolution} @ ${metadata.fps}fps)`);
      } catch (error) {
        console.error(`[Media Import] ✗ Failed to import ${filePath}:`, error);
        errors.push({
          file: filePath,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(`[Media Import] Complete: ${importedAssets.length} imported, ${errors.length} failed`);

    if (errors.length > 0) {
      console.warn('[Media Import] Errors:', errors);
    }

    return importedAssets;
  });

  // Get all media assets for a project
  ipcMain.handle('media-get-all', async (_event, projectId: string) => {
    if (!db) throw new Error('Database not initialized');

    const assets = db.query(
      'SELECT * FROM media_library WHERE project_id = ? ORDER BY created_at DESC',
      [projectId]
    );

    return assets as MediaAsset[];
  });

  // Delete media asset (from database only, not disk)
  ipcMain.handle('media-delete', async (_event, assetId: string) => {
    if (!db) throw new Error('Database not initialized');

    db.execute('DELETE FROM media_library WHERE id = ?', [assetId]);
    console.log(`[Media Delete] Asset removed: ${assetId}`);
  });

  ipcMain.handle('media-get-metadata', async (_event, filePath: string) => {
    console.log('[STUB] media-get-metadata called for:', filePath);
    // Will implement FFprobe integration in Phase 2
    return {
      format: 'mov',
      duration: 120,
      fps: 24,
      resolution: '1920x1080',
    };
  });

  // ===========================================================================
  // CANVAS OPERATIONS
  // ===========================================================================
  ipcMain.handle('canvas-create', async (_event, projectId: string, canvasData: Omit<Canvas, 'id' | 'created_at' | 'updated_at'>) => {
    if (!db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    const canvas: Canvas = {
      id,
      ...canvasData,
      project_id: projectId,
      created_at: now,
      updated_at: now,
    };

    db.execute(
      `INSERT INTO canvases (id, project_id, name, description, created_at, updated_at, FPS, Resolution, Timecode_mode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [canvas.id, canvas.project_id, canvas.name, canvas.description || null, canvas.created_at, canvas.updated_at, canvas.FPS, canvas.Resolution, canvas.Timecode_mode]
    );

    console.log(`Canvas created: ${canvas.name} (${canvas.id})`);
    return canvas;
  });

  ipcMain.handle('canvas-list', async (_event, projectId: string) => {
    if (!db) throw new Error('Database not initialized');
    return db.query('SELECT * FROM canvases WHERE project_id = ? ORDER BY created_at DESC', [projectId]);
  });

  // ===========================================================================
  // NODE OPERATIONS
  // ===========================================================================
  ipcMain.handle('node-create', async (_event, canvasId: string, nodeData: Omit<StoryNode, 'id'>) => {
    if (!db) throw new Error('Database not initialized');

    // Note: canvasId is passed for future use (Phase 5: Containers)
    // For now, nodes aren't directly linked to canvas, but to containers
    console.log(`[Node Create] Creating node for canvas: ${canvasId}`);

    const id = uuidv4();

    const node: StoryNode = {
      id,
      ...nodeData,
    };

    db.execute(
      `INSERT INTO story_nodes (
        id, asset_id, act_id, scene_id, type, subtype, is_global,
        x, y, width, height, color,
        anchor_id, connection_mode, drift_x, drift_y,
        clip_in, clip_out,
        internal_state_map
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        node.id,
        node.asset_id || null,
        node.act_id || null,
        node.scene_id || null,
        node.type,
        node.subtype,
        node.is_global ? 1 : 0,
        node.x,
        node.y,
        node.width,
        node.height,
        node.color || null,
        node.anchor_id || null,
        node.connection_mode || 'STACK',
        node.drift_x || 0,
        node.drift_y || 0,
        node.clip_in || 0,
        node.clip_out || null,
        node.internal_state_map ? JSON.stringify(node.internal_state_map) : null,
      ]
    );

    console.log(`Node created: ${node.id}`);
    return node;
  });

  ipcMain.handle('node-update', async (_event, id: string, updates: Partial<StoryNode>) => {
    if (!db) throw new Error('Database not initialized');

    const fields: string[] = [];
    const values: any[] = [];

    // Build dynamic UPDATE query
    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'id') return; // Don't update ID
      fields.push(`${key} = ?`);
      if (key === 'is_global') {
        values.push(value ? 1 : 0);
      } else if (key === 'internal_state_map' && value) {
        values.push(JSON.stringify(value));
      } else {
        values.push(value === undefined ? null : value);
      }
    });

    if (fields.length > 0) {
      values.push(id);
      db.execute(
        `UPDATE story_nodes SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
      console.log(`Node updated: ${id}`);
    }
  });

  ipcMain.handle('node-delete', async (_event, id: string) => {
    if (!db) throw new Error('Database not initialized');
    db.execute('DELETE FROM story_nodes WHERE id = ?', [id]);
    console.log(`Node deleted: ${id}`);
  });

  ipcMain.handle('node-update-position', async (_event, id: string, x: number, y: number) => {
    if (!db) throw new Error('Database not initialized');
    db.execute('UPDATE story_nodes SET x = ?, y = ? WHERE id = ?', [x, y, id]);
    console.log(`Node position updated: ${id} to (${x}, ${y})`);
  });

  ipcMain.handle('node-list', async (_event, canvasId: string) => {
    if (!db) throw new Error('Database not initialized');

    // Phase 3: Get all nodes for this canvas
    // For now, we get:
    // 1. Global nodes (is_global = 1) - nodes in "The Bucket"
    // 2. Nodes linked to containers on this canvas
    // 3. Nodes without containers (phase 3 nodes) - we'll add a canvas_id field later
    //
    // TEMPORARY SOLUTION: Return all nodes for now since we haven't added canvas_id to story_nodes yet
    // In Phase 5 (Containers), we'll fix this query to properly filter by canvas

    const nodes = db.query(
      `SELECT sn.* FROM story_nodes sn
       LEFT JOIN fractal_containers fc ON sn.scene_id = fc.id OR sn.act_id = fc.id
       WHERE fc.canvas_id = ? OR sn.is_global = 1 OR (sn.act_id IS NULL AND sn.scene_id IS NULL)`,
      [canvasId]
    );

    console.log(`[Node List] Found ${nodes.length} nodes for canvas ${canvasId}`);
    return nodes;
  });

  // ===========================================================================
  // NODE ANCHORING OPERATIONS (Phase 4)
  // ===========================================================================

  /**
   * Validate if an anchor relationship would create a paradox (cycle)
   * Phase 4: Single anchor system with connection modes
   */
  ipcMain.handle('node-validate-anchor', async (_event, childId: string, parentId: string, connectionMode: ConnectionMode) => {
    if (!db) throw new Error('Database not initialized');

    try {
      // Fetch all nodes to build the graph
      const allNodesArray: StoryNode[] = db.query('SELECT * FROM story_nodes');
      const allNodes = new Map<string, StoryNode>(allNodesArray.map(n => [n.id, n]));

      const childNode = allNodes.get(childId);
      const parentNode = allNodes.get(parentId);

      if (!childNode || !parentNode) {
        return {
          valid: false,
          reason: 'Child or parent node not found',
        };
      }

      // 1. Validate semantic rules (node type constraints)
      const semanticCheck = validateSemanticRules(childNode, parentNode, connectionMode);
      if (!semanticCheck.valid) {
        return semanticCheck;
      }

      // 2. Run paradox validation (cycle detection)
      const isValid = validateAnchorChain(allNodes, childId, parentId);

      if (!isValid) {
        return {
          valid: false,
          reason: 'Would create a cyclic dependency (paradox)',
        };
      }

      return { valid: true };
    } catch (error) {
      console.error('[Node Validate Anchor] Error:', error);
      return {
        valid: false,
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  /**
   * Link a node to a parent (create parent-child relationship)
   * Phase 4: Single anchor system with connection modes
   */
  ipcMain.handle('node-link', async (_event, childId: string, parentId: string, connectionMode: ConnectionMode) => {
    if (!db) throw new Error('Database not initialized');

    try {
      // 1. Determine default drifts based on mode
      let newDriftX = 0;
      let newDriftY = 0;

      // Logic: Snap to the logical position of the port
      switch (connectionMode) {
        case 'STACK':
          // Stacks float above (Track + 1) and start at same time (DriftX 0)
          newDriftX = 0;
          newDriftY = 1;
          break;
        case 'PREPEND':
          // J-Cut: Ends when parent starts.
          // Math: Start = ParentStart - Duration + Drift.
          // For a perfect "touching" snap, Drift should be 0.
          newDriftX = 0;
          newDriftY = 0;
          break;
        case 'APPEND':
          // L-Cut: Starts when parent ends.
          // Math: Start = ParentEnd + Drift.
          // For a perfect "touching" snap, Drift should be 0.
          newDriftX = 0;
          newDriftY = 0;
          break;
        default:
          throw new Error('Invalid Mode');
      }

      // 2. Perform the Update
      // CRITICAL: We overwrite the old "Absolute" drift values with new "Relative" ones
      db.execute(
        `UPDATE story_nodes 
        SET anchor_id = ?, 
            connection_mode = ?, 
            drift_x = ?, 
            drift_y = ?
        WHERE id = ?`,
        [parentId, connectionMode, newDriftX, newDriftY, childId]
      );

      return { success: true };
    } catch (err: any) {
      console.error('[IPC] Link Error:', err);
      return { success: false, error: err.message };
    }
  });

  /**
   * Unlink a node from its parent anchor
   * Phase 4: Single anchor system
   */
  ipcMain.handle('node-unlink', async (_event, nodeId: string) => {
    if (!db) throw new Error('Database not initialized');

    try {
      console.log(`[Node Unlink] Unlinking ${nodeId}`);

      // Fetch all nodes
      const allNodesArray: StoryNode[] = db.query('SELECT * FROM story_nodes');
      const allNodes = new Map<string, StoryNode>(allNodesArray.map(n => [n.id, n]));

      const node = allNodes.get(nodeId);
      if (!node) {
        return {
          success: false,
          error: 'Node not found',
        };
      }

      // Check if the node has an anchor
      if (!node.anchor_id) {
        console.log(`[Node Unlink] Node ${nodeId} has no anchor`);
        return { success: true }; // Already unlinked
      }

      // Update DB: remove anchor
      db.execute(
        `UPDATE story_nodes
         SET anchor_id = NULL, connection_mode = 'STACK', drift_x = 0, drift_y = 0
         WHERE id = ?`,
        [nodeId]
      );

      console.log(`[Node Unlink] Successfully unlinked ${nodeId}`);

      return { success: true };
    } catch (error) {
      console.error('[Node Unlink] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  /**
   * Change a node's type between SPINE and SATELLITE
   * Phase 4: Node type conversion
   */
  ipcMain.handle('node-change-type', async (_event, nodeId: string, newType: 'SPINE' | 'SATELLITE') => {
    if (!db) throw new Error('Database not initialized');

    try {
      console.log(`[Node Change Type] Changing ${nodeId} to ${newType}`);

      // Get the node
      const nodes: StoryNode[] = db.query('SELECT * FROM story_nodes WHERE id = ?', [nodeId]);
      const node = nodes[0];

      if (!node) {
        return {
          success: false,
          error: 'Node not found',
        };
      }

      if (node.type === newType) {
        console.log(`[Node Change Type] Node is already type ${newType}`);
        return { success: true }; // Already the correct type
      }

      // Update the node type
      db.execute(
        `UPDATE story_nodes SET type = ? WHERE id = ?`,
        [newType, nodeId]
      );

      console.log(`[Node Change Type] Successfully changed ${nodeId} from ${node.type} to ${newType}`);

      return { success: true };
    } catch (error) {
      console.error('[Node Change Type] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // ===========================================================================
  // BACKUP OPERATIONS
  // ===========================================================================
  ipcMain.handle('backup-create', async () => {
    if (!db) throw new Error('Database not initialized');
    db.createBackup();
  });

  ipcMain.handle('backup-restore', async (_event, backupPath: string) => {
    console.log('[STUB] backup-restore called for:', backupPath);
    // Will implement restoration logic with user confirmation
  });

  ipcMain.handle('backup-list', async () => {
    if (!db) throw new Error('Database not initialized');
    return db.listBackups();
  });

  console.log('IPC handlers registered');
}

export function getDatabaseInstance(): StoryGraphDatabase | null {
  return db;
}
