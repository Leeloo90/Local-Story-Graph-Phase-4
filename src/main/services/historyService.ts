import StoryGraphDatabase from '../database/schema';
import { StoryNode, ConnectionMode } from '../../shared/types';

interface Command {
  name: string;
  execute: (db: StoryGraphDatabase) => Promise<void>;
  undo: (db: StoryGraphDatabase) => Promise<void>;
}

const historyStack: Command[] = [];
const redoStack: Command[] = [];

export const executeCommand = async (db: StoryGraphDatabase, command: Command) => {
  await command.execute(db);
  historyStack.push(command);
  redoStack.length = 0; // Clear redo on new action
  console.log(`Executed command: ${command.name}`);
};

export const undo = async (db: StoryGraphDatabase) => {
  const cmd = historyStack.pop();
  if (cmd) {
    await cmd.undo(db);
    redoStack.push(cmd);
    console.log(`Undone command: ${cmd.name}`);
  }
};

export const redo = async (db: StoryGraphDatabase) => {
  const cmd = redoStack.pop();
  if (cmd) {
    await cmd.execute(db);
    historyStack.push(cmd);
    console.log(`Redone command: ${cmd.name}`);
  }
};

// ============================================================================
// COMMAND FACTORIES
// ============================================================================

export const createNodeCommand = (node: StoryNode): Command => ({
  name: `Create Node ${node.id}`,
  execute: async (db) => {
    db.execute(
      `INSERT INTO story_nodes (
        id, asset_id, act_id, scene_id, type, subtype, is_global,
        x, y, width, height, color,
        anchor_id, connection_mode, drift_x, drift_y,
        clip_in, clip_out,
        internal_state_map
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        node.id, node.asset_id || null, node.act_id || null, node.scene_id || null,
        node.type, node.subtype, node.is_global ? 1 : 0,
        node.x, node.y, node.width, node.height, node.color || null,
        node.anchor_id || null, node.connection_mode || 'STACK', node.drift_x || 0, node.drift_y || 0,
        node.clip_in || 0, node.clip_out || null,
        node.internal_state_map ? JSON.stringify(node.internal_state_map) : null,
      ]
    );
  },
  undo: async (db) => {
    db.execute(`DELETE FROM story_nodes WHERE id = ?`, [node.id]);
  },
});

export const deleteNodeCommand = (node: StoryNode): Command => ({
  name: `Delete Node ${node.id}`,
  execute: async (db) => {
    db.execute(`DELETE FROM story_nodes WHERE id = ?`, [node.id]);
  },
  undo: async (db) => {
    // Re-create the node
    await createNodeCommand(node).execute(db);
  },
});

export const updateNodeCommand = (nodeId: string, oldNode: StoryNode, updates: Partial<StoryNode>): Command => ({
  name: `Update Node ${nodeId}`,
  execute: async (db) => {
    const fields: string[] = [];
    const values: any[] = [];
    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'id') return;
      fields.push(`${key} = ?`);
      if (key === 'is_global') {
        values.push(value ? 1 : 0);
      } else if (key === 'internal_state_map' && value) {
        values.push(JSON.stringify(value));
      } else {
        values.push(value === undefined ? null : value);
      }
    });
    values.push(nodeId);
    db.execute(`UPDATE story_nodes SET ${fields.join(', ')} WHERE id = ?`, values);
  },
  undo: async (db) => {
    const fields: string[] = [];
    const values: any[] = [];
    Object.entries(updates).forEach(([key]) => {
      // Revert to oldNode's value for this key
      fields.push(`${key} = ?`);
      const oldValue = (oldNode as Record<string, any>)[key];
      if (key === 'is_global') {
        values.push(oldValue ? 1 : 0);
      } else if (key === 'internal_state_map' && oldValue) {
        values.push(JSON.stringify(oldValue));
      } else {
        values.push(oldValue === undefined ? null : oldValue);
      }
    });
    values.push(nodeId);
    db.execute(`UPDATE story_nodes SET ${fields.join(', ')} WHERE id = ?`, values);
  },
});

export const updateNodePositionCommand = (nodeId: string, oldX: number, oldY: number, newX: number, newY: number): Command => ({
  name: `Move Node ${nodeId}`,
  execute: async (db) => {
    db.execute(`UPDATE story_nodes SET x = ?, y = ? WHERE id = ?`, [newX, newY, nodeId]);
  },
  undo: async (db) => {
    db.execute(`UPDATE story_nodes SET x = ?, y = ? WHERE id = ?`, [oldX, oldY, nodeId]);
  },
});

export const linkNodeCommand = (childId: string, parentId: string, connectionMode: ConnectionMode, oldAnchorId: string | undefined, oldConnectionMode: ConnectionMode | undefined, oldDriftX: number, oldDriftY: number, newDriftX: number, newDriftY: number): Command => ({
  name: `Link Node ${childId} to ${parentId}`,
  execute: async (db) => {
    db.execute(
      `UPDATE story_nodes
       SET anchor_id = ?,
           connection_mode = ?,
           drift_x = ?,
           drift_y = ?
       WHERE id = ?`,
      [parentId, connectionMode, newDriftX, newDriftY, childId]
    );
  },
  undo: async (db) => {
    db.execute(
      `UPDATE story_nodes
       SET anchor_id = ?,
           connection_mode = ?,
           drift_x = ?,
           drift_y = ?
       WHERE id = ?`,
      [oldAnchorId || null, oldConnectionMode || 'STACK', oldDriftX, oldDriftY, childId]
    );
  },
});

export const unlinkNodeCommand = (nodeId: string, oldAnchorId: string, oldConnectionMode: ConnectionMode, oldDriftX: number, oldDriftY: number): Command => ({
  name: `Unlink Node ${nodeId}`,
  execute: async (db) => {
    db.execute(
      `UPDATE story_nodes
       SET anchor_id = NULL, connection_mode = 'STACK', drift_x = 0, drift_y = 0
       WHERE id = ?`,
      [nodeId]
    );
  },
  undo: async (db) => {
    db.execute(
      `UPDATE story_nodes
       SET anchor_id = ?,
           connection_mode = ?,
           drift_x = ?,
           drift_y = ?
       WHERE id = ?`,
      [oldAnchorId, oldConnectionMode, oldDriftX, oldDriftY, nodeId]
    );
  },
});

export const changeNodeTypeCommand = (nodeId: string, oldType: 'SPINE' | 'SATELLITE', newType: 'SPINE' | 'SATELLITE'): Command => ({
  name: `Change Node Type ${nodeId} to ${newType}`,
  execute: async (db) => {
    db.execute(`UPDATE story_nodes SET type = ? WHERE id = ?`, [newType, nodeId]);
  },
  undo: async (db) => {
    db.execute(`UPDATE story_nodes SET type = ? WHERE id = ?`, [oldType, nodeId]);
  },
});

export const moveNodeToBucketCommand = (nodeId: string, oldAnchorId: string | undefined, oldConnectionMode: ConnectionMode | undefined, oldDriftX: number, oldDriftY: number, oldX: number, oldY: number): Command => ({
  name: `Move Node ${nodeId} to Bucket`,
  execute: async (db) => {
    db.execute(
      `UPDATE story_nodes
       SET anchor_id = NULL,
           connection_mode = 'STACK',
           drift_x = 0,
           drift_y = 0,
           x = -1000,
           y = 0,
           is_global = 1
       WHERE id = ?`,
      [nodeId]
    );
  },
  undo: async (db) => {
    db.execute(
      `UPDATE story_nodes
       SET anchor_id = ?,
           connection_mode = ?,
           drift_x = ?,
           drift_y = ?,
           x = ?,
           y = ?,
           is_global = 0
       WHERE id = ?`,
      [oldAnchorId || null, oldConnectionMode || 'STACK', oldDriftX, oldDriftY, oldX, oldY, nodeId]
    );
  },
});
