const pool = require('../config/db');
const NodeGrantModel = require('./node-grant.model');

const TreeModel = {
  // Full-archetype replace: wipes every node/edge/grant of `archetype`
  // (cascade) and rebuilds from the document, preserving node ids.
  async importTree(nodes, edges, archetype) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Scoped to the imported archetype only — an unscoped delete here would
      // wipe every other archetype's nodes/edges/player progress via cascade.
      await client.query('DELETE FROM skill_tree.nodes WHERE archetype = $1', [archetype]);

      const idMap = {};
      for (const node of nodes) {
        const { rows } = await client.query(
          `INSERT INTO skill_tree.nodes
             (id, title, description, icon, cost, pos_x, pos_y, narrative_condition, effect, archetype, archetypes, require_both, is_root)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           RETURNING id`,
          [
            node.id, node.title, node.description ?? null, node.icon ?? null,
            node.cost ?? 0, node.pos_x ?? 0, node.pos_y ?? 0,
            node.narrative_condition ?? [], node.effect ?? [],
            node.archetype ?? archetype, node.archetypes ?? [],
            node.require_both ?? false, node.is_root ?? false,
          ]
        );
        idMap[node.id] = rows[0].id;
        await NodeGrantModel.insertMany(client, rows[0].id, node.grants);
      }

      for (const edge of edges) {
        const src = idMap[edge.source_id];
        const dst = idMap[edge.target_id];
        if (src && dst && src !== dst) {
          await client.query(
            `INSERT INTO skill_tree.edges (source_id, target_id, edge_type) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [src, dst, edge.edge_type ?? 'required']
          );
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // Additive import of a subset of nodes (a single node, or a node + its
  // branches). Nothing is deleted. Every imported node gets a FRESH id, so
  // the same document can be imported repeatedly / into any tree. Nodes with
  // no incoming edge within the set are wired to `attachToNodeId` (if given);
  // otherwise they land as orphans the GM connects manually.
  async importNodes(nodes, edges, archetype, attachToNodeId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const idMap = {};
      for (const node of nodes) {
        const { rows } = await client.query(
          `INSERT INTO skill_tree.nodes
             (title, description, icon, cost, pos_x, pos_y, narrative_condition, effect, archetype, archetypes, require_both, is_root)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false)
           RETURNING id`,
          [
            node.title, node.description ?? null, node.icon ?? null,
            node.cost ?? 0, node.pos_x ?? 0, node.pos_y ?? 0,
            node.narrative_condition ?? [], node.effect ?? [],
            archetype, node.archetypes?.length ? node.archetypes : [archetype],
            node.require_both ?? false,
          ]
        );
        idMap[node.id] = rows[0].id;
        await NodeGrantModel.insertMany(client, rows[0].id, node.grants);
      }

      const importedIds = new Set(nodes.map((n) => n.id));
      const wiredTargets = new Set();
      for (const edge of edges) {
        const src = idMap[edge.source_id];
        const dst = idMap[edge.target_id];
        if (src && dst && src !== dst) {
          await client.query(
            `INSERT INTO skill_tree.edges (source_id, target_id, edge_type) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [src, dst, edge.edge_type ?? 'required']
          );
          if (importedIds.has(edge.source_id)) wiredTargets.add(edge.target_id);
        }
      }

      if (attachToNodeId) {
        for (const node of nodes) {
          if (!wiredTargets.has(node.id)) {
            await client.query(
              `INSERT INTO skill_tree.edges (source_id, target_id, edge_type)
               VALUES ($1, $2, 'required') ON CONFLICT DO NOTHING`,
              [attachToNodeId, idMap[node.id]]
            );
          }
        }
      }

      await client.query('COMMIT');
      return { nodeCount: nodes.length, edgeCount: edges.length };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};

module.exports = TreeModel;
