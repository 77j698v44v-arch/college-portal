const { Pool } = require('pg')
const dotenv = require('dotenv')

dotenv.config()

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false }
})

const migrate = async () => {
  try {
    // Exam-related fees: national exams, internal exams, ream papers & files — tracked separately from school fees
    await pool.query(`
      CREATE TABLE IF NOT EXISTS exam_fees (
        id SERIAL PRIMARY KEY,
        student_id VARCHAR(20) REFERENCES students(student_id),
        fee_type VARCHAR(30) NOT NULL CHECK (fee_type IN ('national_exam', 'internal_exam', 'ream_papers_files')),
        amount DECIMAL(10,2) NOT NULL,
        paid DECIMAL(10,2) DEFAULT 0,
        balance DECIMAL(10,2),
        semester VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `)
    console.log('exam_fees table created.')

    // Hostel: only students registered here have a hostel balance, everyone else shows Nil
    await pool.query(`
      CREATE TABLE IF NOT EXISTS hostel (
        id SERIAL PRIMARY KEY,
        student_id VARCHAR(20) UNIQUE REFERENCES students(student_id),
        room_details VARCHAR(100),
        amount DECIMAL(10,2) NOT NULL,
        paid DECIMAL(10,2) DEFAULT 0,
        balance DECIMAL(10,2),
        semester VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `)
    console.log('hostel table created.')

    console.log('Migration complete!')
  } catch (err) {
    console.error('Migration error:', err.message)
  } finally {
    pool.end()
  }
}

migrate()
