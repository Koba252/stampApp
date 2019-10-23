const pg = require('pg');
require('dotenv').config();

exports.pool = pg.Pool({
  host: process.env.env_host,
  database: process.env.env_db,
  user: process.env.env_user,
  port: 5432,
  password: process.env.env_pass
});