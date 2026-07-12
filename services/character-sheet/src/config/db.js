const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.POSTGRES_HOST     || 'postgres',
  port:     parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB       || 'walp',
  user:     process.env.POSTGRES_USER     || 'walp',
  password: process.env.POSTGRES_PASSWORD || '',
});

module.exports = pool;
