const { Pool } = require('pg')
const dotenv = require('dotenv')

dotenv.config()

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false }
})

const migrate = async () => {
  try {
    await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS course VARCHAR(100);`)
    console.log('Course column added to students table!')
  } catch (err) {
    console.error('Migration error:', err.message)
  } finally {
    pool.end()
  }
}

migrate()
