/**
 * Preload Script
 * Exposes secure IPC bridge between Main and Renderer processes
 * Implements context isolation for security
 */

import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // ===========================================================================
  // FILE OPERATIONS
  // ===========================================================================
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),

  // ===========================================================================
  // DATABASE OPERATIONS
  // ===========================================================================
  dbQuery: (query: string, params?: any[]) =>
    ipcRenderer.invoke('db-query', query, params),

  dbExecute: (query: string, params?: any[]) =>
    ipcRenderer.invoke('db-execute', query, params),

  // ===========================================================================
  // PROJECT CRUD
  // ===========================================================================
  projectCreate: (project: any) =>
    ipcRenderer.invoke('project-create', project),

  projectGet: (id: string) =>
    ipcRenderer.invoke('project-get', id),

  projectList: () =>
    ipcRenderer.invoke('project-list'),

  projectUpdate: (id: string, updates: any) =>
    ipcRenderer.invoke('project-update', id, updates),

  projectDelete: (id: string) =>
    ipcRenderer.invoke('project-delete', id),

  // ===========================================================================
  // MEDIA OPERATIONS
  // ===========================================================================
  mediaImport: (projectId: string, filePaths: string[]) =>
    ipcRenderer.invoke('media-import', projectId, filePaths),

  mediaGetAll: (projectId: string) =>
    ipcRenderer.invoke('media-get-all', projectId),

  mediaDelete: (assetId: string) =>
    ipcRenderer.invoke('media-delete', assetId),

  mediaGetMetadata: (filePath: string) =>
    ipcRenderer.invoke('media-get-metadata', filePath),

  // ===========================================================================
  // CANVAS OPERATIONS
  // ===========================================================================
  canvasCreate: (projectId: string, canvas: any) =>
    ipcRenderer.invoke('canvas-create', projectId, canvas),

  canvasList: (projectId: string) =>
    ipcRenderer.invoke('canvas-list', projectId),

  canvasGet: (canvasId: string) =>
    ipcRenderer.invoke('canvas-get', canvasId),

  canvasUpdate: (canvasId: string, updates: any) =>
    ipcRenderer.invoke('canvas-update', canvasId, updates),

  canvasDelete: (canvasId: string) =>
    ipcRenderer.invoke('canvas-delete', canvasId),

  // ===========================================================================
  // NODE OPERATIONS
  // ===========================================================================
  nodeCreate: (canvasId: string, node: any) =>
    ipcRenderer.invoke('node-create', canvasId, node),

  nodeUpdate: (id: string, updates: any) =>
    ipcRenderer.invoke('node-update', id, updates),

  nodeDelete: (id: string) =>
    ipcRenderer.invoke('node-delete', id),

  nodeList: (canvasId: string) =>
    ipcRenderer.invoke('node-list', canvasId),

  nodeUpdatePosition: (id: string, x: number, y: number) =>
    ipcRenderer.invoke('node-update-position', id, x, y),

  nodeUpdateDrift: (id: string, driftX: number, driftY: number) =>
    ipcRenderer.invoke('node-update-drift', id, driftX, driftY),

  nodeLink: (childId: string, parentId: string, connectionMode: string) =>
    ipcRenderer.invoke('node-link', childId, parentId, connectionMode),

  nodeUnlink: (nodeId: string) =>
    ipcRenderer.invoke('node-unlink', nodeId),

  nodeValidateAnchor: (childId: string, parentId: string, connectionMode: string) =>
    ipcRenderer.invoke('node-validate-anchor', childId, parentId, connectionMode),

  nodeChangeType: (nodeId: string, newType: 'SPINE' | 'SATELLITE') =>
    ipcRenderer.invoke('node-change-type', nodeId, newType),

  // Phase 4.2: Zone transition operations
  nodeMoveToAttic: (nodeId: string, spineId: string) =>
    ipcRenderer.invoke('node-move-to-attic', nodeId, spineId),

  nodeMoveToBucket: (nodeId: string) =>
    ipcRenderer.invoke('node-move-to-bucket', nodeId),

  // ===========================================================================
  // CONTAINER OPERATIONS (Phase 5: Acts & Scenes)
  // ===========================================================================
  containerCreate: (canvasId: string, container: any) =>
    ipcRenderer.invoke('container-create', canvasId, container),

  containerList: (canvasId: string) =>
    ipcRenderer.invoke('container-list', canvasId),

  containerGet: (containerId: string) =>
    ipcRenderer.invoke('container-get', containerId),

  containerUpdate: (id: string, updates: any) =>
    ipcRenderer.invoke('container-update', id, updates),

  containerUpdateBounds: (id: string, x: number, y: number, width: number, height: number) =>
    ipcRenderer.invoke('container-update-bounds', id, x, y, width, height),

  containerDelete: (id: string) =>
    ipcRenderer.invoke('container-delete', id),

  containerAssignNode: (nodeId: string, containerId: string, containerType: 'ACT' | 'SCENE') =>
    ipcRenderer.invoke('container-assign-node', nodeId, containerId, containerType),

  containerUnassignNode: (nodeId: string, containerType: 'ACT' | 'SCENE') =>
    ipcRenderer.invoke('container-unassign-node', nodeId, containerType),

  containerGetNodes: (containerId: string, containerType: 'ACT' | 'SCENE') =>
    ipcRenderer.invoke('container-get-nodes', containerId, containerType),

  containerCalculateBounds: (containerId: string, containerType: 'ACT' | 'SCENE') =>
    ipcRenderer.invoke('container-calculate-bounds', containerId, containerType),

  // ===========================================================================
  // TRANSCRIPT OPERATIONS (Phase 7)
  // ===========================================================================
  transcriptImport: (mediaId: string, filePath: string) =>
    ipcRenderer.invoke('transcript:import', mediaId, filePath),

  transcriptGetForNode: (nodeId: string) =>
    ipcRenderer.invoke('transcript:get-for-node', nodeId),

  // ===========================================================================
  // MULTICAM OPERATIONS (Phase 8)
  // ===========================================================================
  multicamImportXml: (filePath: string) =>
    ipcRenderer.invoke('multicam:import-xml', filePath),

  multicamGetMembers: (multicamMediaId: string) =>
    ipcRenderer.invoke('multicam:get-members', multicamMediaId),

  nodeSetAngle: (nodeId: string, memberMediaId: string) =>
    ipcRenderer.invoke('node:set-angle', nodeId, memberMediaId),

  // ===========================================================================
  // EXPORT OPERATIONS (Phase 9)
  // ===========================================================================
  exportGenerateFCPXML: (projectId: string, filePath: string) =>
    ipcRenderer.invoke('export:generate-fcpxml', projectId, filePath),

  // ===========================================================================
  // HISTORY OPERATIONS (Phase 9)
  // ===========================================================================
  historyUndo: () =>
    ipcRenderer.invoke('history:undo'),

  historyRedo: () =>
    ipcRenderer.invoke('history:redo'),

  // ===========================================================================
  // BACKUP OPERATIONS
  // ===========================================================================
  backupCreate: () =>
    ipcRenderer.invoke('backup-create'),

  backupRestore: (backupPath: string) =>
    ipcRenderer.invoke('backup-restore', backupPath),

  backupList: () =>
    ipcRenderer.invoke('backup-list'),
});

// Type definitions for window.electronAPI
declare global {
  interface Window {
    electronAPI: {
      // File operations
      selectFiles: () => Promise<string[]>;
      selectFolder: () => Promise<string | null>;

      // Database operations
      dbQuery: (query: string, params?: any[]) => Promise<any>;
      dbExecute: (query: string, params?: any[]) => Promise<void>;

      // Project CRUD
      projectCreate: (project: any) => Promise<any>;
      projectGet: (id: string) => Promise<any>;
      projectList: () => Promise<any[]>;
      projectUpdate: (id: string, updates: any) => Promise<void>;
      projectDelete: (id: string) => Promise<void>;

      // Media operations
      mediaImport: (projectId: string, filePaths: string[]) => Promise<any[]>;
      mediaGetAll: (projectId: string) => Promise<any[]>;
      mediaDelete: (assetId: string) => Promise<void>;
      mediaGetMetadata: (filePath: string) => Promise<any>;

      // Canvas operations
      canvasCreate: (projectId: string, canvas: any) => Promise<any>;
      canvasList: (projectId: string) => Promise<any[]>;
      canvasGet: (canvasId: string) => Promise<any>;
      canvasUpdate: (canvasId: string, updates: any) => Promise<void>;
      canvasDelete: (canvasId: string) => Promise<void>;

      // Node operations
      nodeCreate: (canvasId: string, node: any) => Promise<any>;
      nodeUpdate: (id: string, updates: any) => Promise<void>;
      nodeDelete: (id: string) => Promise<void>;
      nodeList: (canvasId: string) => Promise<any[]>;
      nodeUpdatePosition: (id: string, x: number, y: number) => Promise<void>;
      nodeUpdateDrift: (id: string, driftX: number, driftY: number) => Promise<void>;
      nodeLink: (childId: string, parentId: string, connectionMode: string) => Promise<{ success: boolean; error?: string }>;
      nodeUnlink: (nodeId: string) => Promise<{ success: boolean }>;
      nodeValidateAnchor: (childId: string, parentId: string, connectionMode: string) => Promise<{ valid: boolean; reason?: string }>;
      nodeChangeType: (nodeId: string, newType: 'SPINE' | 'SATELLITE') => Promise<{ success: boolean; error?: string }>;

      // Container operations (Phase 5: Acts & Scenes)
      containerCreate: (canvasId: string, container: any) => Promise<any>;
      containerList: (canvasId: string) => Promise<any[]>;
      containerGet: (containerId: string) => Promise<any>;
      containerUpdate: (id: string, updates: any) => Promise<void>;
      containerUpdateBounds: (id: string, x: number, y: number, width: number, height: number) => Promise<void>;
      containerDelete: (id: string) => Promise<void>;
      containerAssignNode: (nodeId: string, containerId: string, containerType: 'ACT' | 'SCENE') => Promise<void>;
      containerUnassignNode: (nodeId: string, containerType: 'ACT' | 'SCENE') => Promise<void>;
      containerGetNodes: (containerId: string, containerType: 'ACT' | 'SCENE') => Promise<any[]>;
      containerCalculateBounds: (containerId: string, containerType: 'ACT' | 'SCENE') => Promise<{ x: number; y: number; width: number; height: number } | null>;

      // Transcript operations (Phase 7)
      transcriptImport: (mediaId: string, filePath: string) => Promise<{ success: boolean; error?: string }>;
      transcriptGetForNode: (nodeId: string) => Promise<{ transcript: any; clip_in: number; clip_out: number } | null>;

      // Multicam operations (Phase 8)
      multicamImportXml: (filePath: string) => Promise<void>;
      multicamGetMembers: (multicamMediaId: string) => Promise<any[]>;
      nodeSetAngle: (nodeId: string, memberMediaId: string) => Promise<void>;

      // Export operations (Phase 9)
      exportGenerateFCPXML: (projectId: string, filePath: string) => Promise<{ success: boolean; error?: string }>;

      // History operations (Phase 9)
      historyUndo: () => Promise<void>;
      historyRedo: () => Promise<void>;

      // Backup operations
      backupCreate: () => Promise<void>;
      backupRestore: (backupPath: string) => Promise<void>;
      backupList: () => Promise<string[]>;
    };
  }
}
