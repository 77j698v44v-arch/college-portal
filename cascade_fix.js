const { Pool } = require('pg')
const dotenv = require('dotenv')

dotenv.config()

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false }
})

const fix = async () => {
  try {
    // Drop and recreate all foreign keys with ON DELETE CASCADE
    await pool.query(`
      ALTER TABLE results DROP CONSTRAINT IF EXISTS results_student_id_fkey;
      ALTER TABLE results ADD CONSTRAINT results_student_id_fkey
        FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE;
    `)
    console.log('results FK fixed.')

    await pool.query(`
      ALTER TABLE fees DROP CONSTRAINT IF EXISTS fees_student_id_fkey;
      ALTER TABLE fees ADD CONSTRAINT fees_student_id_fkey
        FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE;
    `)
    console.log('fees FK fixed.')

    await pool.query(`
      ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_student_id_fkey;
      ALTER TABLE attendance ADD CONSTRAINT attendance_student_id_fkey
        FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE;
    `)
    console.log('attendance FK fixed.')

    await pool.query(`
      ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_student_id_fkey;
      ALTER TABLE payments ADD CONSTRAINT payments_student_id_fkey
        FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE;
    `)
    console.log('payments FK fixed.')

    await pool.query(`
      ALTER TABLE exam_fees DROP CONSTRAINT IF EXISTS exam_fees_student_id_fkey;
      ALTER TABLE exam_fees ADD CONSTRAINT exam_fees_student_id_fkey
        FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE;
    `)
    console.log('exam_fees FK fixed.')

    await pool.query(`
      ALTER TABLE hostel DROP CONSTRAINT IF EXISTS hostel_student_id_fkey;
      ALTER TABLE hostel ADD CONSTRAINT hostel_student_id_fkey
        FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE;
    `)
    console.log('hostel FK fixed.')

    console.log('All done! Deleting a student will now automatically remove all their records.')
  } catch (err) {
    console.error('Error:', err.message)
  } finally {
    pool.end()
  }
}

fix()
