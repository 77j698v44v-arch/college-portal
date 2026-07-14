const { Pool } = require('pg')
const dotenv = require('dotenv')
dotenv.config()

const pool = new Pool({ connectionString: process.env.DB_URL, ssl: { rejectUnauthorized: false } })

const migrate = async () => {
  try {
    // 1. Wipe timetable and add course column
    await pool.query(`DELETE FROM timetable`)
    console.log('Timetable wiped.')
    await pool.query(`ALTER TABLE timetable ADD COLUMN IF NOT EXISTS course VARCHAR(100)`)
    console.log('Course column added to timetable.')

    // 2. Add year column to results
    await pool.query(`ALTER TABLE results ADD COLUMN IF NOT EXISTS year VARCHAR(20)`)
    console.log('Year column added to results.')

    // 3. Create notices table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notices (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        target_course VARCHAR(100) DEFAULT 'all',
        posted_by VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('Notices table created.')

    console.log('All migrations complete!')
  } catch (err) {
    console.error('Error:', err.message)
  } finally {
    pool.end()
  }
}

migrate()
