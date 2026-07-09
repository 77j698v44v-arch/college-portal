const { Pool } = require('pg')
const dotenv = require('dotenv')

dotenv.config()

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false }
})

const migrate = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance_sessions (
        id SERIAL PRIMARY KEY,
        student_id VARCHAR(20) REFERENCES students(student_id) ON DELETE CASCADE,
        unit_name VARCHAR(100) NOT NULL,
        course VARCHAR(100) NOT NULL,
        semester VARCHAR(20) NOT NULL,
        class_date DATE NOT NULL,
        status VARCHAR(10) NOT NULL CHECK (status IN ('present', 'absent')),
        recorded_by VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `)
    console.log('attendance_sessions table created!')

    // Index for fast lookups by course + date range
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_att_sessions_course ON attendance_sessions(course, unit_name, class_date);
    `)
    console.log('Index created!')
    console.log('Migration complete!')
  } catch (err) {
    console.error('Error:', err.message)
  } finally {
    pool.end()
  }
}

migrate()
