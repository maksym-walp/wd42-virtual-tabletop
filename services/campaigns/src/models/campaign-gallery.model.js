const pool = require('../config/db');

// Авторизація (лише Майстер на запис, учасники на читання) повністю
// вирішується в контролері — тут гейта за user_id немає, як і в решті
// дочірніх моделей (campaign-character.model.js, ...).
const CampaignGalleryModel = {
  async listByCampaign(campaignId) {
    const { rows } = await pool.query(
      `SELECT * FROM campaigns.campaign_gallery
       WHERE campaign_id = $1
       ORDER BY created_at DESC`,
      [campaignId]
    );
    return rows;
  },

  async add(campaignId, imageUrl) {
    const { rows } = await pool.query(
      `INSERT INTO campaigns.campaign_gallery (campaign_id, image_url)
       VALUES ($1, $2)
       RETURNING *`,
      [campaignId, imageUrl]
    );
    return rows[0];
  },

  // Скоуп одночасно за id зображення І за кампанією: навіть якщо перевірка
  // рівня кампанії колись зрегресує, вгаданим id не вийде видалити чужий рядок.
  async remove(id, campaignId) {
    const { rowCount } = await pool.query(
      `DELETE FROM campaigns.campaign_gallery WHERE id = $1 AND campaign_id = $2`,
      [id, campaignId]
    );
    return rowCount > 0;
  },
};

module.exports = CampaignGalleryModel;
