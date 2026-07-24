// Snapshots a row (and any cascade-deleted children) into trash.deleted_records
// before it's gone for good, so an admin can recover it by hand via adminer.
// See database/migrations/33-trash.sql for the table shape/rationale.
//
// childQueries: [{ key, sql, params }] — run BEFORE the delete, since an
// ON DELETE CASCADE wipes them out the instant the parent row goes.
async function deleteWithTrash(pool, { schemaName, tableName, deleteQuery, deleteParams, childQueries = [], deletedBy = null }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const children = {};
    for (const cq of childQueries) {
      const { rows } = await client.query(cq.sql, cq.params);
      children[cq.key] = rows;
    }

    const { rows } = await client.query(deleteQuery, deleteParams);
    if (!rows.length) {
      await client.query('ROLLBACK');
      return null;
    }
    const record = rows[0];

    await client.query(
      `INSERT INTO trash.deleted_records (schema_name, table_name, record_id, record, children, deleted_by)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)`,
      [schemaName, tableName, record.id, JSON.stringify(record), JSON.stringify(children), deletedBy]
    );

    await client.query('COMMIT');
    return record;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { deleteWithTrash };
