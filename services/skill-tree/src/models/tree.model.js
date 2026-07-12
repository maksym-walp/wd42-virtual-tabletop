const pool = require('../config/db');

const TreeModel = {
  async importTree(nodes, edges) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM skill_tree.nodes'); // cascades edges + player_progress

      const idMap = {};
      for (const node of nodes) {
        const { rows } = await client.query(
          `INSERT INTO skill_tree.nodes
             (id, title, description, icon, cost, pos_x, pos_y, narrative_condition, effect, races, archetype)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          [
            node.id, node.title, node.description ?? null, node.icon ?? null,
            node.cost ?? 0, node.pos_x ?? 0, node.pos_y ?? 0,
            node.narrative_condition ?? null, node.effect ?? null, node.races ?? [],
            node.archetype ?? '',
          ]
        );
        idMap[node.id] = rows[0].id;
      }

      for (const edge of edges) {
        const src = idMap[edge.source_id];
        const dst = idMap[edge.target_id];
        if (src && dst && src !== dst) {
          await client.query(
            `INSERT INTO skill_tree.edges (source_id, target_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [src, dst]
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
