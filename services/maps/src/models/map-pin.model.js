const pool = require('../config/db');

const MapPinModel = {
  // Join the location for display labels. Deliberately excludes gm_note — pins
  // are read by any campaign member, so no GM-only field may leak through here.
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

  // The controller supplies concrete min_zoom/max_zoom (defaulting them when
  // omitted), so the model stays a plain INSERT.
  async add(mapId, { locationId, x, y, minZoom, maxZoom }) {
    const { rows } = await pool.query(
      `INSERT INTO maps.map_pins
         (map_id, location_id, x_coordinate, y_coordinate, min_zoom, max_zoom)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [mapId, locationId, x, y, minZoom, maxZoom]
    );
    return rows[0];
  },

  // Scope by both pin id AND map_id (defensive, like map-lens).
  async update(id, mapId, { x, y, minZoom, maxZoom }) {
    const { rows } = await pool.query(
      `UPDATE maps.map_pins
       SET x_coordinate = $3, y_coordinate = $4, min_zoom = $5, max_zoom = $6,
           updated_at = NOW()
       WHERE id = $1 AND map_id = $2
       RETURNING *`,
      [id, mapId, x, y, minZoom, maxZoom]
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
