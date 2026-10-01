const pool = require('../config/db');

// Таблиця трекінгу міграцій (database/migrate.sh). Потрапляє в бекап для
// довідки, але ніколи не відновлюється: її вміст має описувати фактичну схему
// БД, а не ту, з якої знімали бекап.
const MIGRATIONS_TABLE = 'public.schema_migrations';

const quoteIdent = (s) => `"${String(s).replace(/"/g, '""')}"`;
const qualified = (key) => {
  const [schema, table] = key.split('.');
  return `${quoteIdent(schema)}.${quoteIdent(table)}`;
};

async function listTables(client) {
  const { rows } = await client.query(
    `SELECT table_schema || '.' || table_name AS key
     FROM information_schema.tables
     WHERE table_type = 'BASE TABLE'
       AND table_schema NOT IN ('pg_catalog', 'information_schema')
       AND table_schema NOT LIKE 'pg\\_%'
     ORDER BY 1`
  );
  return rows.map((r) => r.key);
}

async function listColumns(client, key) {
  const [schema, table] = key.split('.');
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2 AND is_generated = 'NEVER'`,
    [schema, table]
  );
  return rows.map((r) => r.column_name);
}

async function listMigrations(client, tables) {
  if (!tables.includes(MIGRATIONS_TABLE)) return null;
  const { rows } = await client.query(`SELECT filename FROM ${qualified(MIGRATIONS_TABLE)} ORDER BY filename`);
  return rows.map((r) => r.filename);
}

const BackupModel = {
  MIGRATIONS_TABLE,

  // Знімок усієї БД в одній REPEATABLE READ транзакції, щоб таблиці були
  // узгоджені між собою. JSON будує сам Postgres (json_agg) і віддає текстом —
  // так дати, numeric і масиви зберігаються точно, без проходу через JS-типи.
  async dumpAll() {
    const client = await pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const keys = await listTables(client);
      const tables = [];
      for (const key of keys) {
        const { rows } = await client.query(
          `SELECT count(*)::int AS n, coalesce(json_agg(t), '[]')::text AS data
           FROM ${qualified(key)} t`
        );
        tables.push({ key, rowCount: rows[0].n, json: rows[0].data });
      }
      const migrations = await listMigrations(client, keys);
      await client.query('COMMIT');
      return { tables, migrations };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  },

  async currentState() {
    const client = await pool.connect();
    try {
      const tables = await listTables(client);
      const migrations = await listMigrations(client, tables);
      return { tables, migrations };
    } finally {
      client.release();
    }
  },

  // entries: [{ key: 'schema.table', json: '<JSON-масив рядків>' }].
  // clearKeys: таблиці, які треба спорожнити (надмножина keys для повного
  // відновлення — щоб таблиці, яких нема в бекапі, теж повернулись до стану
  // бекапу, тобто стали порожніми).
  //
  // session_replication_role = replica вимикає FK-тригери (і ON DELETE
  // CASCADE) на час транзакції: таблиці можна чистити й заповнювати в
  // довільному порядку, включно з самопосиланнями (parent_id). Потребує
  // суперюзера — саме ним сервіси й підключаються.
  async restore(entries, clearKeys) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL session_replication_role = replica');

      for (const key of clearKeys) {
        await client.query(`DELETE FROM ${qualified(key)}`);
      }

      const results = [];
      for (const { key, json } of entries) {
        const invalid = Object.assign(new Error(`${key}: очікується JSON-масив об'єктів`), { statusCode: 400 });
        let shape;
        try {
          ({ rows: [shape] } = await client.query(
            `SELECT json_typeof($1::json) AS type,
                    CASE WHEN json_typeof($1::json) = 'array'
                         THEN (SELECT count(*) FILTER (WHERE json_typeof(e) <> 'object')
                               FROM json_array_elements($1::json) e)
                    END AS non_objects`,
            [json]
          ));
        } catch (err) {
          if (err.code === '22P02') throw invalid; // invalid_text_representation — не JSON
          throw err;
        }
        if (shape.type !== 'array' || Number(shape.non_objects) > 0) throw invalid;

        const { rows: keyRows } = await client.query(
          `SELECT DISTINCT k FROM json_array_elements($1::json) e, json_object_keys(e) k`,
          [json]
        );
        const tableColumns = new Set(await listColumns(client, key));
        const backupColumns = keyRows.map((r) => r.k);
        const columns = backupColumns.filter((c) => tableColumns.has(c));
        const ignoredColumns = backupColumns.filter((c) => !tableColumns.has(c));

        let rowCount = 0;
        if (columns.length > 0) {
          const cols = columns.map(quoteIdent).join(', ');
          try {
            const res = await client.query(
              `INSERT INTO ${qualified(key)} (${cols})
               SELECT ${cols} FROM json_populate_recordset(NULL::${qualified(key)}, $1::json)`,
              [json]
            );
            rowCount = res.rowCount;
          } catch (err) {
            // Клас 22 — некоректні дані, 23 — порушення обмежень (NOT NULL,
            // унікальність, CHECK): це проблема файлу, а не сервера.
            if (/^2[23]/.test(err.code || '')) {
              throw Object.assign(new Error(`${key}: ${err.message}`), { statusCode: 400 });
            }
            throw err;
          }
        }
        results.push({ table: key, rows: rowCount, ignoredColumns });
      }

      await client.query('COMMIT');
      return results;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  },
};

module.exports = BackupModel;
