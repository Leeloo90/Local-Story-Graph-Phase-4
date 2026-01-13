/**
 * Database Schema v4.5
 * Complete SQLite schema with all 7 core tables
 * Implements WAL mode, foreign keys, and backup system
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export class StoryGraphDatabase {
  private db: Database.Database;
  private dbPath: string;
  private backupInterval: NodeJS.Timeout | null = null;

  constructor(projectName: string = 'default') {
    // Store database in user data directory
    const userDataPath = app.getPath('userData');
    const dbDir = path.join(userDataPath, 'databases');

    // Ensure directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.dbPath = path.join(dbDir, `${projectName}.db`);
    this.db = new Database(this.dbPath);

    this.initialize();
  }

  private initialize() {
    // Enable WAL mode for crash recovery and better concurrency
    this.db.pragma('journal_mode = WAL');

    // Enable foreign key constraints
    this.db.pragma('foreign_keys = ON');

    // Create all tables
    this.createTables();

    // Start automatic backup system (every 15 minutes)
    this.startBackupSystem();

    console.log(`Database initialized at: ${this.dbPath}`);
  }

  private createTables() {
    // ========================================================================
    // TABLE 1: projects
    // Root container for all project metadata
    // ========================================================================
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        client TEXT,
        status TEXT CHECK(status IN ('ACTIVE', 'ARCHIVED', 'COMPLETED')) DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
    `);

    // ========================================================================
    // TABLE 2: media_library
    // Forensic metadata extracted via FFprobe
    // ========================================================================
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS media_library (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        clean_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        format TEXT,
        media_type TEXT CHECK(media_type IN ('BROLL', 'DIALOGUE', 'MUSIC', 'IMAGE', 'MULTICAM')) NOT NULL,
        fps REAL,
        resolution TEXT,
        start_tc TEXT,
        end_tc TEXT,
        total_frames INTEGER,
        duration REAL,
        size INTEGER,
        metadata_raw TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_media_project ON media_library(project_id);
      CREATE INDEX IF NOT EXISTS idx_media_clean_name ON media_library(clean_name);
      CREATE INDEX IF NOT EXISTS idx_media_type ON media_library(media_type);
    `);

    // ========================================================================
    // TABLE 3: transcripts
    // Word-accurate text data linked to dialogue assets
    // ========================================================================
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transcripts (
        id TEXT PRIMARY KEY,
        asset_id TEXT NOT NULL,
        speaker TEXT,
        time_in INTEGER NOT NULL,
        time_out INTEGER NOT NULL,
        content TEXT NOT NULL,
        word_map TEXT,
        sync_offset_frames INTEGER DEFAULT 0,
        FOREIGN KEY (asset_id) REFERENCES media_library(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_transcript_asset ON transcripts(asset_id);
    `);

    // ========================================================================
    // TABLE 4: canvases
    // Versioning and multiple narrative paths
    // ========================================================================
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS canvases (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FPS INTEGER NOT NULL DEFAULT 24,
        Resolution TEXT DEFAULT '1920x1080',
        Timecode_mode TEXT CHECK(Timecode_mode IN ('NON_DROP', 'DROP')) DEFAULT 'NON_DROP',
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_canvas_project ON canvases(project_id);
    `);

    // ========================================================================
    // TABLE 5: fractal_containers
    // Acts & Scenes - hierarchical blocks containing nodes
    // ========================================================================
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS fractal_containers (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        canvas_id TEXT NOT NULL,
        parent_id TEXT,
        type TEXT CHECK(type IN ('ACT', 'SCENE')) NOT NULL,
        name TEXT NOT NULL,
        x REAL NOT NULL DEFAULT 0,
        y REAL NOT NULL DEFAULT 0,
        width REAL NOT NULL DEFAULT 300,
        height REAL NOT NULL DEFAULT 200,
        color TEXT,
        ANCHOR_START_ID TEXT,
        ANCHOR_START_DRIFT INTEGER DEFAULT 0,
        ANCHOR_END_ID TEXT,
        ANCHOR_END_DRIFT INTEGER DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (canvas_id) REFERENCES canvases(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES fractal_containers(id) ON DELETE CASCADE,
        FOREIGN KEY (ANCHOR_START_ID) REFERENCES story_nodes(id) ON DELETE SET NULL,
        FOREIGN KEY (ANCHOR_END_ID) REFERENCES story_nodes(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_container_canvas ON fractal_containers(canvas_id);
      CREATE INDEX IF NOT EXISTS idx_container_parent ON fractal_containers(parent_id);
      CREATE INDEX IF NOT EXISTS idx_container_type ON fractal_containers(type);
    `);

    // ========================================================================
    // TABLE 6: story_nodes
    // Atomic narrative units - the core of the fractal topology
    // Single anchor system with connection modes
    // ========================================================================
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS story_nodes (
        id TEXT PRIMARY KEY,
        asset_id TEXT,
        act_id TEXT,
        scene_id TEXT,
        type TEXT CHECK(type IN ('SPINE', 'SATELLITE')) NOT NULL,
        subtype TEXT CHECK(subtype IN ('VIDEO', 'MUSIC', 'TEXT', 'IMAGE')) NOT NULL,
        is_global INTEGER DEFAULT 0,
        x REAL NOT NULL DEFAULT 0,
        y REAL NOT NULL DEFAULT 0,
        width REAL NOT NULL DEFAULT 150,
        height REAL NOT NULL DEFAULT 100,
        color TEXT,

        -- Single anchor system (Single Source of Truth)
        anchor_id TEXT,
        connection_mode TEXT CHECK(connection_mode IN ('STACK', 'PREPEND', 'APPEND')) DEFAULT 'STACK',
        drift_x REAL DEFAULT 0,
        drift_y INTEGER DEFAULT 0,

        -- Attic system (Magnetic Construction v2)
        -- Nodes in the Attic are "parked" above a Spine, not yet committed to the edit
        attic_parent_id TEXT,

        -- Clip trimming (in seconds)
        clip_in REAL DEFAULT 0,
        clip_out REAL,

        internal_state_map TEXT,
        FOREIGN KEY (asset_id) REFERENCES media_library(id) ON DELETE SET NULL,
        FOREIGN KEY (act_id) REFERENCES fractal_containers(id) ON DELETE SET NULL,
        FOREIGN KEY (scene_id) REFERENCES fractal_containers(id) ON DELETE SET NULL,
        FOREIGN KEY (anchor_id) REFERENCES story_nodes(id) ON DELETE SET NULL,
        FOREIGN KEY (attic_parent_id) REFERENCES story_nodes(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_node_asset ON story_nodes(asset_id);
      CREATE INDEX IF NOT EXISTS idx_node_scene ON story_nodes(scene_id);
      CREATE INDEX IF NOT EXISTS idx_node_act ON story_nodes(act_id);
      CREATE INDEX IF NOT EXISTS idx_node_type ON story_nodes(type);
      CREATE INDEX IF NOT EXISTS idx_node_is_global ON story_nodes(is_global);
      CREATE INDEX IF NOT EXISTS idx_node_anchor ON story_nodes(anchor_id);
      CREATE INDEX IF NOT EXISTS idx_node_connection_mode ON story_nodes(connection_mode);
      CREATE INDEX IF NOT EXISTS idx_node_attic_parent ON story_nodes(attic_parent_id);
    `);

    // ========================================================================
    // TABLE 7: multicam_members
    // Tracks relationships between multicam containers and source files
    // ========================================================================
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS multicam_members (
        id TEXT PRIMARY KEY,
        parent_asset_id TEXT NOT NULL,
        child_asset_id TEXT NOT NULL,
        track_index INTEGER NOT NULL,
        sync_offset INTEGER DEFAULT 0,
        is_primary_audio INTEGER DEFAULT 0,
        audio_role TEXT,
        is_sync_reference INTEGER DEFAULT 0,
        FOREIGN KEY (parent_asset_id) REFERENCES media_library(id) ON DELETE CASCADE,
        FOREIGN KEY (child_asset_id) REFERENCES media_library(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_multicam_parent ON multicam_members(parent_asset_id);
      CREATE INDEX IF NOT EXISTS idx_multicam_child ON multicam_members(child_asset_id);
    `);

    // ========================================================================
    // TABLE 8: project_settings
    // Environment-specific configurations
    // ========================================================================
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS project_settings (
        project_id TEXT PRIMARY KEY,
        render_preview_path TEXT,
        proxy_mode_enabled INTEGER DEFAULT 0,
        last_canvas_id TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (last_canvas_id) REFERENCES canvases(id) ON DELETE SET NULL
      );
    `);

    console.log('All tables created successfully');
  }

  // ========================================================================
  // BACKUP SYSTEM
  // Auto-backup every 15 minutes, keep last 10 backups
  // ========================================================================
  private startBackupSystem() {
    const BACKUP_INTERVAL = 15 * 60 * 1000; // 15 minutes

    this.backupInterval = setInterval(() => {
      this.createBackup();
    }, BACKUP_INTERVAL);

    console.log('Backup system started (15-minute intervals)');
  }

  createBackup(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(path.dirname(this.dbPath), 'backups');

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupPath = path.join(backupDir, `backup-${timestamp}.db`);

    // Use SQLite backup API
    this.db.backup(backupPath);

    // Keep only last 10 backups
    this.cleanOldBackups(backupDir);

    console.log(`Backup created: ${backupPath}`);
    return backupPath;
  }

  private cleanOldBackups(backupDir: string) {
    const backups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
      .map(f => ({
        name: f,
        path: path.join(backupDir, f),
        mtime: fs.statSync(path.join(backupDir, f)).mtime,
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    // Keep only last 10
    backups.slice(10).forEach(backup => {
      fs.unlinkSync(backup.path);
      console.log(`Deleted old backup: ${backup.name}`);
    });
  }

  listBackups(): string[] {
    const backupDir = path.join(path.dirname(this.dbPath), 'backups');

    if (!fs.existsSync(backupDir)) {
      return [];
    }

    return fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
      .map(f => path.join(backupDir, f))
      .sort()
      .reverse();
  }

  // ========================================================================
  // INTEGRITY CHECKS
  // Run on startup and every 30 minutes
  // ========================================================================
  checkIntegrity(): boolean {
    try {
      const result = this.db.pragma('integrity_check') as any[];
      const fkCheck = this.db.pragma('foreign_key_check') as any[];

      if (result[0]?.integrity_check === 'ok' && fkCheck.length === 0) {
        console.log('Database integrity check: PASSED');
        return true;
      } else {
        console.error('Database integrity check: FAILED', result, fkCheck);
        return false;
      }
    } catch (error) {
      console.error('Integrity check error:', error);
      return false;
    }
  }

  // ========================================================================
  // DATABASE ACCESS METHODS
  // ========================================================================
  getDatabase(): Database.Database {
    return this.db;
  }

  query(sql: string, params: any[] = []): any[] {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params);
    } catch (error) {
      console.error('Query error:', error);
      throw error;
    }
  }

  execute(sql: string, params: any[] = []): void {
    try {
      const stmt = this.db.prepare(sql);
      stmt.run(...params);
    } catch (error) {
      console.error('Execute error:', error);
      throw error;
    }
  }

  // ========================================================================
  // CLEANUP
  // ========================================================================
  close() {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }

    // Create final backup before closing
    this.createBackup();

    this.db.close();
    console.log('Database closed');
  }
}

export default StoryGraphDatabase;
