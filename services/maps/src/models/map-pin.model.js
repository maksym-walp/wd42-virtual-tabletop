const pool = require('../config/db');

const MapPinModel = {
  // Join the location for display labels. Deliberately excludes gm_note — pins
  // are read by any campaign member, so no GM-only field may leak through here.
  // Unfiltered by lens_ids/visible_campaign_ids — for the map owner/admin, who
  // sees every pin plus which campaigns each one belongs to (see access.canWriteMap).
  async listByMap(mapId) {
    const { rows } = await pool.query(
      `SELECT p.*,
              l.name  AS location_name,
              l.type  AS location_type,
              l.marker_icon  AS location_marker_icon,
              l.marker_level AS location_marker_level
       FROM maps.map_pins p
       JOIN maps.locations l ON l.id = p.location_id
       WHERE p.map_id = $1
       ORDER BY p.created_at ASC`,
      [mapId]
    );
    return rows;
  },

  // Same as listByMap, but drops any pin whose visible_campaign_ids is
  // non-empty and doesn't include campaignId — for a regular reader (not the
  // map owner/admin), who only ever sees pins with no campaign restriction,
  // plus (if campaignId is given, already verified as one they're a member
  // of — see access.isCampaignMember) pins scoped to that campaign.
  // array_length(..., 1) IS NULL is the correct "is this array empty" check
  // in Postgres — an empty array's length is NULL, not 0.
  async listVisibleToPlayer(mapId, campaignId) {
    const { rows } = await pool.query(
      `SELECT p.*,
              l.name  AS location_name,
              l.type  AS location_type,
              l.marker_icon  AS location_marker_icon,
              l.marker_level AS location_marker_level
       FROM maps.map_pins p
       JOIN maps.locations l ON l.id = p.location_id
       WHERE p.map_id = $1
         AND (array_length(p.visible_campaign_ids, 1) IS NULL OR $2::uuid = ANY(p.visible_campaign_ids))
       ORDER BY p.created_at ASC`,
      [mapId, campaignId]
    );
    return rows;
  },

  // The controller supplies concrete min_zoom/max_zoom (defaulting them when
  // omitted) and validated lens_ids/visible_campaign_ids arrays (defaulting
  // to [] when omitted), so the model stays a plain INSERT.
  async add(mapId, { locationId, x, y, minZoom, maxZoom, lensIds, visibleCampaignIds }) {
    const { rows } = await pool.query(
      `INSERT INTO maps.map_pins
         (map_id, location_id, x_coordinate, y_coordinate, min_zoom, max_zoom, lens_ids, visible_campaign_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7::uuid[], $8::uuid[])
       RETURNING *`,
      [mapId, locationId, x, y, minZoom, maxZoom, lensIds, visibleCampaignIds]
    );
    return rows[0];
  },

  // Scope by both pin id AND map_id (defensive, like map-lens).
  async update(id, mapId, { x, y, minZoom, maxZoom, lensIds, visibleCampaignIds }) {
    const { rows } = await pool.query(
      `UPDATE maps.map_pins
       SET x_coordinate = $3, y_coordinate = $4, min_zoom = $5, max_zoom = $6,
           lens_ids = $7::uuid[], visible_campaign_ids = $8::uuid[], updated_at = NOW()
       WHERE id = $1 AND map_id = $2
       RETURNING *`,
      [id, mapId, x, y, minZoom, maxZoom, lensIds, visibleCampaignIds]
    );
    return rows[0] || null;
  },

  async remove(id, mapId) {
    const { rowCount } = await pool.query(
      `DELETE FROM maps.map_pins WHERE id = $1 AND map_id = $2`,
      [id, mapId]
    );
    return rowCount > 0;
  },
};

module.exports = MapPinModel;
