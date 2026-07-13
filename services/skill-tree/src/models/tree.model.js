const pool = require('../config/db');

const TreeModel = {
  async importTree(nodes, edges, archetype) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Scoped to the imported archetype only — an unscoped delete here would
      // wipe every other archetype's nodes/edges/player progress via cascade.
      await client.query('DELETE FROM skill_tree.nodes WHERE archetype = $1', [archetype]);

      const idMap = {};
      // replaces_node_id is set in a second pass below so FK insert order
      // doesn't depend on the JSON array listing the referenced node first.
      for (const node of nodes) {
        const { rows } = await client.query(
          `INSERT INTO skill_tree.nodes
             (id, title, description, icon, cost, pos_x, pos_y, narrative_condition, effect, races, archetype, archetypes, require_both, is_root)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           RETURNING id`,
          [
            node.id, node.title, node.description ?? null, node.icon ?? null,
            node.cost ?? 0, node.pos_x ?? 0, node.pos_y ?? 0,
            node.narrative_condition ?? [], node.effect ?? [], node.races ?? [],
            node.archetype ?? archetype, node.archetypes ?? [],
            node.require_both ?? false, node.is_root ?? false,
          ]
        );
        idMap[node.id] = rows[0].id;
      }

      for (const node of nodes) {
        if (node.replaces_node_id && idMap[node.replaces_node_id]) {
          await client.query(
            `UPDATE skill_tree.nodes SET replaces_node_id = $2 WHERE id = $1`,
            [idMap[node.id], idMap[node.replaces_node_id]]
          );
        }
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
};

module.exports = TreeModel;
