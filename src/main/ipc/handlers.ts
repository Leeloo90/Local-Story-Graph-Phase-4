/**
 * IPC Handlers
 * Main process handlers for all IPC channels
 */

import { ipcMain, dialog } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import type { Project, Canvas, StoryNode, MediaAsset, ConnectionMode, FractalContainer } from '../../shared/types';
import StoryGraphDatabase from '../database/schema';
import { extractMetadata, isSupportedMediaFile, generateCleanName, calculateEndTimecode } from '../services/ffmpeg';
import {
  validateAnchorChain,
  validateSemanticRules,
} from '../services/topology';
import { importTranscript, getTranscriptForNode } from '../services/transcriptService';
import { parseMulticamXml } from '../services/multicamService';
import { generateFCPXML } from '../services/exportService';
import {
  executeCommand,
  undo,
  redo,
  createNodeCommand,
  deleteNodeCommand,
  updateNodeCommand,
  updateNodePositionCommand,
  linkNodeCommand,
  unlinkNodeCommand,
} from '../services/historyService';
import fs from 'fs/promises';
import path from 'path';

let db: StoryGraphDatabase | null = null;

export function initializeDatabase(projectName: string = 'default') {
  db = new StoryGraphDatabase(projectName);
  return db;
}

export function registerIpcHandlers() {
  // ===========================================================================
  // HISTORY OPERATIONS
  // ===========================================================================
  ipcMain.handle('history:undo', async () => {
    if (!db) throw new Error('Database not initialized');
    await undo(db);
  });

  ipcMain.handle('history:redo', async () => {
    if (!db) throw new Error('Database not initialized');
    await redo(db);
  });

  // ===========================================================================
  // EXPORT OPERATIONS
  // ===========================================================================
  ipcMain.handle('export:generate-fcpxml', async (_event, projectId: string, filePath: string) => {
    if (!db) throw new Error('Database not initialized');
    return generateFCPXML(db, projectId, filePath);
  });

  // ===========================================================================
  // MULTICAM OPERATIONS
  // ===========================================================================
  ipcMain.handle('multicam:import-xml', async (_event, filePath: string) => {
    if (!db) throw new Error('Database not initialized');
    const xmlContent = await fs.readFile(filePath, 'utf-8');
    return parseMulticamXml(db, xmlContent);
  });

  ipcMain.handle('multicam:get-members', async (_event, multicamMediaId: string) => {
    if (!db) throw new Error('Database not initialized');
    return db.query('SELECT * FROM multicam_members WHERE multicam_media_id = ?', [multicamMediaId]);
  });

  ipcMain.handle('node:set-angle', async (_event, nodeId: string, memberMediaId: string) => {
    if (!db) throw new Error('Database not initialized');
    db.execute(
      `UPDATE story_nodes SET internal_state = json_set(internal_state, '$.active_angle', ?) WHERE id = ?`,
      [memberMediaId, nodeId]
    );
  });

  // ===========================================================================
  // TRANSCRIPT OPERATIONS
  // ===========================================================================
  ipcMain.handle('transcript:import', async (_event, mediaId: string, filePath: string) => {
    if (!db) throw new Error('Database not initialized');
    return importTranscript(db, mediaId, filePath);
  });

  ipcMain.handle('transcript:get-for-node', async (_event, nodeId: string) => {
    if (!db) throw new Error('Database not initialized');
    return getTranscriptForNode(db, nodeId);
  });

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
      `INSERT INTO projects (id, name, description, client, status, defaultFps, defaultResolution, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [project.id, project.name, project.description || null, project.client || null, project.status, project.defaultFps, project.defaultResolution, project.created_at, project.updated_at]
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
       VALUES (?, ?, ?, ?, ?, ?, ?, 'NON_DROP')`,
      [canvasId, project.id, 'Main Canvas', now, now, project.defaultFps, project.defaultResolution]
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

  ipcMain.handle('canvas-get', async (_event, canvasId: string) => {
    if (!db) throw new Error('Database not initialized');
    const results = db.query('SELECT * FROM canvases WHERE id = ?', [canvasId]);
    return results[0] || null;
  });

  ipcMain.handle('canvas-update', async (_event, canvasId: string, updates: Partial<Canvas>) => {
    if (!db) throw new Error('Database not initialized');

    const allowedFields = ['name', 'description', 'FPS', 'Resolution', 'Timecode_mode'];
    const setClauses: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (setClauses.length === 0) return;

    setClauses.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(canvasId);

    db.execute(
      `UPDATE canvases SET ${setClauses.join(', ')} WHERE id = ?`,
      values
    );

    console.log(`Canvas updated: ${canvasId}`);
  });

  ipcMain.handle('canvas-delete', async (_event, canvasId: string) => {
    if (!db) throw new Error('Database not initialized');

    // Delete associated nodes first
    db.execute('DELETE FROM story_nodes WHERE scene_id IN (SELECT id FROM fractal_containers WHERE canvas_id = ?)', [canvasId]);
    db.execute('DELETE FROM story_nodes WHERE act_id IN (SELECT id FROM fractal_containers WHERE canvas_id = ?)', [canvasId]);

    // Delete containers
    db.execute('DELETE FROM fractal_containers WHERE canvas_id = ?', [canvasId]);

    // Delete the canvas
    db.execute('DELETE FROM canvases WHERE id = ?', [canvasId]);

    console.log(`Canvas deleted: ${canvasId}`);
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

    await executeCommand(db, createNodeCommand(node));

    console.log(`Node created: ${node.id}`);
    return node;
  });

  ipcMain.handle('node-update', async (_event, id: string, updates: Partial<StoryNode>) => {
    if (!db) throw new Error('Database not initialized');

    const oldNodeQuery = db.query('SELECT * FROM story_nodes WHERE id = ?', [id]);
    if (oldNodeQuery.length === 0) {
      console.warn(`Attempted to update non-existent node: ${id}`);
      return;
    }
    const oldNode = oldNodeQuery[0] as StoryNode;

    await executeCommand(db, updateNodeCommand(id, oldNode, updates));
    console.log(`Node updated: ${id}`);
  });

  ipcMain.handle('node-delete', async (_event, id: string) => {
    if (!db) throw new Error('Database not initialized');
    const nodeToDelete: StoryNode[] = db.query('SELECT * FROM story_nodes WHERE id = ?', [id]);
    if (nodeToDelete.length > 0) {
      await executeCommand(db, deleteNodeCommand(nodeToDelete[0]));
      console.log(`Node deleted: ${id}`);
    } else {
      console.warn(`Attempted to delete non-existent node: ${id}`);
    }
  });

  /**
   * Smart Position Update
   * Handles both Absolute movement (Roots) and Relative movement (Children)
   * Phase 4: Single Anchor System with automatic drift recalculation
   */
  ipcMain.handle('node-update-position', async (_event, id: string, x: number, y: number) => {
    if (!db) throw new Error('Database not initialized');

    // Constants for calculation (must match topology.ts)
    const PIXELS_PER_SECOND = 20;
    const PIXELS_PER_TRACK = 120;

    // 1. Get the node to see if it's anchored
    const nodes: StoryNode[] = db.query('SELECT * FROM story_nodes WHERE id = ?', [id]);
    const node = nodes[0];
    if (!node) {
      console.error(`[Pos Update] Node not found: ${id}`);
      return;
    }

    // 2. Always update stored x, y (this is the "cache" for root nodes)
    // db.execute('UPDATE story_nodes SET x = ?, y = ? WHERE id = ?', [x, y, id]);
    // This is now handled by the command
    await executeCommand(db, updateNodePositionCommand(id, node.x, node.y, x, y));

    // 3. If this is an anchored node, recalculate its drift
    if (node.anchor_id) {
      const parentNodes: StoryNode[] = db.query('SELECT * FROM story_nodes WHERE id = ?', [node.anchor_id]);
      const parent = parentNodes[0];

      if (parent) {
        // Calculate current visual distance
        const currentDistX = x - parent.x;
        const currentDistY = parent.y - y; // Y is inverted

        // Calculate port base offset
        let portOffsetX = 0;
        const childDuration = (node.clip_out || 0) - (node.clip_in || 0);
        const parentDuration = (parent.clip_out || 0) - (parent.clip_in || 0);
        const parentWidth = parentDuration * PIXELS_PER_SECOND;

        switch (node.connection_mode) {
          case 'STACK':
            portOffsetX = 0;
            break;
          case 'PREPEND':
            portOffsetX = -(childDuration * PIXELS_PER_SECOND);
            break;
          case 'APPEND':
            portOffsetX = parentWidth;
            break;
        }

        // Solve for new drift
        const newDriftX = (currentDistX - portOffsetX) / PIXELS_PER_SECOND;

        // Only allow vertical drift adjustments for STACK connections to keep PREPEND/APPEND aligned
        let newDriftY = 0;
        if (node.connection_mode === 'STACK') {
          newDriftY = Math.round(currentDistY / PIXELS_PER_TRACK);
        } else {
          newDriftY = 0;
        }

        // Update drift in database
        db.execute(
          'UPDATE story_nodes SET drift_x = ?, drift_y = ? WHERE id = ?',
          [newDriftX, newDriftY, id]
        );

        console.log(`[Pos Update] Anchored node ${id} -> drift updated: driftX=${newDriftX}s, driftY=${newDriftY} tracks`);
      } else {
        console.warn(`[Pos Update] Parent node ${node.anchor_id} not found for anchored node ${id}`);
      }
    } else {
      console.log(`[Pos Update] Root node ${id} moved to (${x}, ${y})`);
    }
  });

  /**
   * New Handler: Explicitly update drift
   * Phase 4: For anchored nodes, update relative positioning
   */
  ipcMain.handle('node-update-drift', async (_event, id: string, driftX: number, driftY: number) => {
    if (!db) throw new Error('Database not initialized');

    db.execute(
      'UPDATE story_nodes SET drift_x = ?, drift_y = ? WHERE id = ?',
      [driftX, driftY, id]
    );
    console.log(`[Pos Update] Child drift updated: ${id} -> driftX: ${driftX}s, driftY: ${driftY} tracks`);
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
   * Phase 4: Single anchor system with "Smart Initial Drift"
   *
   * This calculates the drift needed to PRESERVE the current visual positions,
   * preventing the "jump" effect when linking nodes.
   */
  ipcMain.handle('node-link', async (_event, childId: string, parentId: string, connectionMode: ConnectionMode) => {
    if (!db) throw new Error('Database not initialized');

    try {
      // Constants for calculation (must match topology.ts)
      const PIXELS_PER_SECOND = 20;
      const PIXELS_PER_TRACK = 120;

      // 1. Fetch both nodes
      const nodes: StoryNode[] = db.query('SELECT * FROM story_nodes WHERE id IN (?, ?)', [childId, parentId]);
      const child = nodes.find(n => n.id === childId);
      const parent = nodes.find(n => n.id === parentId);

      if (!child || !parent) {
        throw new Error('Child or parent node not found');
      }

      // 2. Calculate current visual distance
      const currentDistX = child.x - parent.x;
      const currentDistY = parent.y - child.y; // Y is inverted (up is negative)

      // 3. Calculate port base offset
      let portOffsetX = 0;
      const childDuration = (child.clip_out || 0) - (child.clip_in || 0);
      const parentDuration = (parent.clip_out || 0) - (parent.clip_in || 0);
      const parentWidth = parentDuration * PIXELS_PER_SECOND;

      switch (connectionMode) {
        case 'STACK':
          // Top Port: Aligns with parent start
          portOffsetX = 0;
          break;
        case 'PREPEND':
          // Left Port: Child's right edge touches parent's left edge
          portOffsetX = -(childDuration * PIXELS_PER_SECOND);
          break;
        case 'APPEND':
          // Right Port: Child's left edge touches parent's right edge
          portOffsetX = parentWidth;
          break;
      }

      // 4. Solve for drift that preserves current position
      // Formula: currentDistX = portOffsetX + (drift_x * PIXELS_PER_SECOND)
      // Therefore: drift_x = (currentDistX - portOffsetX) / PIXELS_PER_SECOND
      const newDriftX = (currentDistX - portOffsetX) / PIXELS_PER_SECOND;

      // 5. Snap drift_y to nearest track, but only allow vertical drift for STACK
      let newDriftY = 0;
      if (connectionMode === 'STACK') {
        newDriftY = Math.round(currentDistY / PIXELS_PER_TRACK);
      } else {
        newDriftY = 0; // Keep horizontal anchors perfectly aligned
      }

      console.log(`[Node Link] Smart Initial Drift calculated: driftX=${newDriftX}s, driftY=${newDriftY} tracks`);

      // 6. Update database
      await executeCommand(db, linkNodeCommand(childId, parentId, connectionMode, child.anchor_id, child.connection_mode, child.drift_x || 0, child.drift_y || 0, newDriftX, newDriftY));

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
      await executeCommand(db, unlinkNodeCommand(nodeId, node.anchor_id, node.connection_mode || 'STACK', node.drift_x || 0, node.drift_y || 0));

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


  /**
   * Phase 4.2: Move node to bucket
   * Removes anchor and resets position
   */
  ipcMain.handle('node-move-to-bucket', async (_event, nodeId: string) => {
    if (!db) throw new Error('Database not initialized');

    try {
      console.log(`[Node Move To Bucket] Moving ${nodeId} to bucket`);

      // Update node: remove anchor
      db.execute(
        `UPDATE story_nodes
         SET anchor_id = NULL,
             connection_mode = 'STACK',
             drift_x = 0,
             drift_y = 0,
             x = -1000, -- Move visually to bucket
             is_global = 1 -- Flag as bucket item
         WHERE id = ?`,
        [nodeId]
      );

      console.log(`[Node Move To Bucket] Successfully moved ${nodeId} to bucket`);

      return { success: true };
    } catch (error) {
      console.error('[Node Move To Bucket] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // ===========================================================================
  // CONTAINER OPERATIONS (Phase 5: Acts & Scenes)
  // ===========================================================================

  /**
   * Create a new container (Act or Scene)
   * Phase 5: Fractal containers for organizing nodes
   */
  ipcMain.handle('container-create', async (
    _event,
    _canvasId: string,
    containerData: Omit<FractalContainer, 'id'>
  ) => {
    if (!db) throw new Error('Database not initialized');

    const id = uuidv4();

    const container: FractalContainer = {
      id,
      ...containerData,
    };

    db.execute(
      `INSERT INTO fractal_containers (
        id, project_id, canvas_id, parent_id, type, name,
        x, y, width, height, color,
        ANCHOR_START_ID, ANCHOR_START_DRIFT, ANCHOR_END_ID, ANCHOR_END_DRIFT
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        container.id,
        container.project_id,
        container.canvas_id,
        container.parent_id || null,
        container.type,
        container.name,
        container.x,
        container.y,
        container.width,
        container.height,
        container.color || null,
        container.ANCHOR_START_ID || null,
        container.ANCHOR_START_DRIFT || 0,
        container.ANCHOR_END_ID || null,
        container.ANCHOR_END_DRIFT || 0,
      ]
    );

    console.log(`[Container Create] Created ${container.type}: ${container.name} (${container.id})`);
    return container;
  });

  /**
   * Get all containers for a canvas
   */
  ipcMain.handle('container-list', async (_event, canvasId: string) => {
    if (!db) throw new Error('Database not initialized');

    const containers = db.query(
      'SELECT * FROM fractal_containers WHERE canvas_id = ? ORDER BY type DESC, name ASC',
      [canvasId]
    );

    console.log(`[Container List] Found ${containers.length} containers for canvas ${canvasId}`);
    return containers as FractalContainer[];
  });

  /**
   * Get a single container by ID
   */
  ipcMain.handle('container-get', async (_event, containerId: string) => {
    if (!db) throw new Error('Database not initialized');

    const containers = db.query(
      'SELECT * FROM fractal_containers WHERE id = ?',
      [containerId]
    );

    return containers.length > 0 ? containers[0] as FractalContainer : null;
  });

  /**
   * Update a container
   */
  ipcMain.handle('container-update', async (_event, id: string, updates: Partial<FractalContainer>) => {
    if (!db) throw new Error('Database not initialized');

    const fields: string[] = [];
    const values: any[] = [];

    // Build dynamic UPDATE query
    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'id') return; // Don't update ID
      fields.push(`${key} = ?`);
      values.push(value === undefined ? null : value);
    });

    if (fields.length > 0) {
      values.push(id);
      db.execute(
        `UPDATE fractal_containers SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
      console.log(`[Container Update] Updated container: ${id}`);
    }
  });

  /**
   * Update container position and size
   */
  ipcMain.handle('container-update-bounds', async (
    _event,
    id: string,
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    if (!db) throw new Error('Database not initialized');

    db.execute(
      'UPDATE fractal_containers SET x = ?, y = ?, width = ?, height = ? WHERE id = ?',
      [x, y, width, height, id]
    );
    console.log(`[Container Update] Bounds updated for ${id}: (${x}, ${y}) ${width}x${height}`);
  });

  /**
   * Delete a container
   * Note: Nodes inside the container will have their act_id/scene_id set to NULL (ON DELETE SET NULL)
   */
  ipcMain.handle('container-delete', async (_event, id: string) => {
    if (!db) throw new Error('Database not initialized');

    // First, get all nodes in this container and move them to unassigned
    // (The FK constraint will handle this via ON DELETE SET NULL, but we can be explicit)
    db.execute('UPDATE story_nodes SET act_id = NULL WHERE act_id = ?', [id]);
    db.execute('UPDATE story_nodes SET scene_id = NULL WHERE scene_id = ?', [id]);

    // Delete the container (child containers will also be deleted via CASCADE)
    db.execute('DELETE FROM fractal_containers WHERE id = ?', [id]);

    console.log(`[Container Delete] Deleted container: ${id}`);
  });

  /**
   * Assign a node to a container (Act or Scene)
   */
  ipcMain.handle('container-assign-node', async (
    _event,
    nodeId: string,
    containerId: string,
    containerType: 'ACT' | 'SCENE'
  ) => {
    if (!db) throw new Error('Database not initialized');

    if (containerType === 'ACT') {
      db.execute('UPDATE story_nodes SET act_id = ? WHERE id = ?', [containerId, nodeId]);
    } else {
      db.execute('UPDATE story_nodes SET scene_id = ? WHERE id = ?', [containerId, nodeId]);
    }

    console.log(`[Container Assign] Node ${nodeId} assigned to ${containerType} ${containerId}`);
  });

  /**
   * Remove a node from its container
   */
  ipcMain.handle('container-unassign-node', async (
    _event,
    nodeId: string,
    containerType: 'ACT' | 'SCENE'
  ) => {
    if (!db) throw new Error('Database not initialized');

    if (containerType === 'ACT') {
      db.execute('UPDATE story_nodes SET act_id = NULL WHERE id = ?', [nodeId]);
    } else {
      db.execute('UPDATE story_nodes SET scene_id = NULL WHERE id = ?', [nodeId]);
    }

    console.log(`[Container Unassign] Node ${nodeId} removed from ${containerType}`);
  });

  /**
   * Get all nodes in a container
   */
  ipcMain.handle('container-get-nodes', async (_event, containerId: string, containerType: 'ACT' | 'SCENE') => {
    if (!db) throw new Error('Database not initialized');

    const column = containerType === 'ACT' ? 'act_id' : 'scene_id';
    const nodes = db.query(
      `SELECT * FROM story_nodes WHERE ${column} = ?`,
      [containerId]
    );

    return nodes as StoryNode[];
  });

  /**
   * Calculate container bounds based on contained nodes
   * Returns the bounding box that would encompass all nodes in the container
   */
  ipcMain.handle('container-calculate-bounds', async (_event, containerId: string, containerType: 'ACT' | 'SCENE') => {
    if (!db) throw new Error('Database not initialized');

    const column = containerType === 'ACT' ? 'act_id' : 'scene_id';
    const nodes: StoryNode[] = db.query(
      `SELECT * FROM story_nodes WHERE ${column} = ?`,
      [containerId]
    );

    if (nodes.length === 0) {
      return null; // No nodes to calculate bounds from
    }

    const padding = 50; // Padding around nodes
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach(node => {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + (node.width || 200));
      maxY = Math.max(maxY, node.y + (node.height || 150));
    });

    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };
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
