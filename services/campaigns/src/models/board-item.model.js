const pool = require('../config/db');

// Записи Столу (zone='table') і Ширми (zone='screen'). Авторизація — у
// контролері; тут, як і в інших дочірніх моделях, кожен запит скоупиться ще
// й за campaign_id, щоб вгаданим id не можна було зачепити чужу кампанію.

const EDITABLE_FIELDS = ['title', 'subtitle', 'content', 'image_url', 'image_crop'];

async function inTransaction(run) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Новий запис стає першим у своїй зоні.
async function topPosition(client, campaignId, zone) {
  const { rows } = await client.query(
    `SELECT COALESCE(MIN(position), 0) - 1 AS position
     FROM campaigns.campaign_board_items
     WHERE campaign_id = $1 AND zone = $2`,
    [campaignId, zone]
  );
  return rows[0].position;
}

const BoardItemModel = {
  // Гравцеві (manager = false) — лише видимі записи Столу, а мапи — лише ті,
  // які він справді може відкрити в maps-сервісі (публічні/власні), щоб не
  // показувати картку, що веде на 403. Майстрові — усе, плюс map_is_public
  // для підказки «гравці не зможуть відкрити цю мапу».
  async listByZone(campaignId, zone, { manager, userId, admin }) {
    const { rows } = await pool.query(
      `SELECT b.*, m.is_public AS map_is_public
       FROM campaigns.campaign_board_items b
       LEFT JOIN maps.maps m ON b.kind = 'map' AND m.id = b.ref_id
       WHERE b.campaign_id = $1 AND b.zone = $2
         AND ($3::bool OR (
           b.is_visible
           AND (b.kind <> 'map' OR (m.id IS NOT NULL AND ($5::bool OR m.is_public OR m.created_by = $4)))
         ))
       ORDER BY b.position, b.created_at`,
      [campaignId, zone, manager, userId, admin]
    );
    return rows;
  },

  async findById(id, campaignId) {
    const { rows } = await pool.query(
      `SELECT * FROM campaigns.campaign_board_items WHERE id = $1 AND campaign_id = $2`,
      [id, campaignId]
    );
    return rows[0] || null;
  },

  async mapOnBoard(campaignId, mapId) {
    const { rows } = await pool.query(
      `SELECT 1 FROM campaigns.campaign_board_items
       WHERE campaign_id = $1 AND kind = 'map' AND ref_id = $2
       LIMIT 1`,
      [campaignId, mapId]
    );
    return rows.length > 0;
  },

  // Мапа на дошці також лінкується в campaign_maps — звідти maps-сервіс
  // бере контекст кампанії для пінів (campaign-membership.model.js).
  async create(campaignId, data, addedBy) {
    return inTransaction(async (client) => {
      const position = await topPosition(client, campaignId, data.zone);
      const { rows } = await client.query(
        `INSERT INTO campaigns.campaign_board_items
           (campaign_id, zone, kind, ref_id, ref_subtype, title, subtitle, image_url, image_crop,
            content, is_visible, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          campaignId, data.zone, data.kind, data.ref_id ?? null, data.ref_subtype ?? null,
          data.title, data.subtitle ?? null, data.image_url ?? null, data.image_crop ?? null,
          data.content ?? null, data.is_visible ?? false, position,
        ]
      );
      if (data.kind === 'map') {
        await client.query(
          `INSERT INTO campaigns.campaign_maps (campaign_id, map_id, added_by)
           VALUES ($1, $2, $3)
           ON CONFLICT (campaign_id, map_id) DO NOTHING`,
          [campaignId, data.ref_id, addedBy]
        );
      }
      return rows[0];
    });
  },

  // Текстові поля картки (знімок, нотатка, довільна картка).
  async updateFields(id, campaignId, fields) {
    const entries = EDITABLE_FIELDS.filter((key) => fields[key] !== undefined);
    if (entries.length === 0) return this.findById(id, campaignId);

    const sets = entries.map((key, i) => `${key} = $${i + 3}`);
    const { rows } = await pool.query(
      `UPDATE campaigns.campaign_board_items
       SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $1 AND campaign_id = $2
       RETURNING *`,
      [id, campaignId, ...entries.map((key) => fields[key])]
    );
    return rows[0] || null;
  },

  async setVisible(id, campaignId, visible) {
    const { rows } = await pool.query(
      `UPDATE campaigns.campaign_board_items
       SET is_visible = $3, updated_at = NOW()
       WHERE id = $1 AND campaign_id = $2
       RETURNING *`,
      [id, campaignId, visible]
    );
    return rows[0] || null;
  },

  // Основний запис — один на кампанію (частковий UNIQUE-індекс), тож спершу
  // знімаємо позначку з попереднього.
  async setFeatured(id, campaignId, featured) {
    return inTransaction(async (client) => {
      if (featured) {
        await client.query(
          `UPDATE campaigns.campaign_board_items SET is_featured = false
           WHERE campaign_id = $1 AND is_featured AND id <> $2`,
          [campaignId, id]
        );
      }
      const { rows } = await client.query(
        `UPDATE campaigns.campaign_board_items
         SET is_featured = $3, updated_at = NOW()
         WHERE id = $1 AND campaign_id = $2
         RETURNING *`,
        [id, campaignId, featured]
      );
      return rows[0] || null;
    });
  },

  // Перенесення між Столом і Ширмою: запис стає першим у новій зоні,
  // а на Стіл потрапляє захованим — майстер відкриває його свідомо.
  async moveToZone(id, campaignId, zone) {
    return inTransaction(async (client) => {
      const position = await topPosition(client, campaignId, zone);
      const { rows } = await client.query(
        `UPDATE campaigns.campaign_board_items
         SET zone = $3, position = $4, is_visible = false, is_featured = false, updated_at = NOW()
         WHERE id = $1 AND campaign_id = $2
         RETURNING *`,
        [id, campaignId, zone, position]
      );
      return rows[0] || null;
    });
  },

  // ids — повний новий порядок зони; чужі id просто не зачепить WHERE.
  async reorder(campaignId, zone, ids) {
    await pool.query(
      `UPDATE campaigns.campaign_board_items b
       SET position = o.ord - 1
       FROM unnest($3::uuid[]) WITH ORDINALITY AS o(id, ord)
       WHERE b.id = o.id AND b.campaign_id = $1 AND b.zone = $2`,
      [campaignId, zone, ids]
    );
  },

  async remove(id, campaignId) {
    return inTransaction(async (client) => {
      const { rows } = await client.query(
        `DELETE FROM campaigns.campaign_board_items
         WHERE id = $1 AND campaign_id = $2
         RETURNING *`,
        [id, campaignId]
      );
      const removed = rows[0] || null;
      if (removed?.kind === 'map') {
        await client.query(
          `DELETE FROM campaigns.campaign_maps WHERE campaign_id = $1 AND map_id = $2`,
          [campaignId, removed.ref_id]
        );
      }
      return removed;
    });
  },
};

module.exports = BoardItemModel;
