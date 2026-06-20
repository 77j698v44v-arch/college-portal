const { Pool } = require('pg')
const dotenv = require('dotenv')

dotenv.config()

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false }
})

const createTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        student_id VARCHAR(20) UNIQUE NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(15),
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS results (
        id SERIAL PRIMARY KEY,
        student_id VARCHAR(20) REFERENCES students(student_id),
        unit_name VARCHAR(100) NOT NULL,
        cat_score DECIMAL(5,2),
        exam_score DECIMAL(5,2),
        total_score DECIMAL(5,2),
        grade VARCHAR(5),
        semester VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS fees (
        id SERIAL PRIMARY KEY,
        student_id VARCHAR(20) REFERENCES students(student_id),
        amount DECIMAL(10,2) NOT NULL,
        paid DECIMAL(10,2) DEFAULT 0,
        balance DECIMAL(10,2),
        semester VARCHAR(20),
        due_date DATE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        student_id VARCHAR(20) REFERENCES students(student_id),
        amount DECIMAL(10,2) NOT NULL,
        mpesa_receipt VARCHAR(50),
        phone VARCHAR(15),
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS timetable (
        id SERIAL PRIMARY KEY,
        unit_name VARCHAR(100) NOT NULL,
        day VARCHAR(20) NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        room VARCHAR(50),
        semester VARCHAR(20)
      );

      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        student_id VARCHAR(20) REFERENCES students(student_id),
        unit_name VARCHAR(100) NOT NULL,
        classes_attended INT DEFAULT 0,
        total_classes INT DEFAULT 0,
        percentage DECIMAL(5,2),
        semester VARCHAR(20)
      );
    `)
    console.log('All tables created successfully!')
  } catch (err) {
    console.error('Error creating tables:', err)
  } finally {
    pool.end()
  }
}

createTables()