const { Pool } = require('pg')
const dotenv = require('dotenv')

dotenv.config()

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false }
})

const migrate = async () => {
  try {
    await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'cash';`)
    await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_details JSONB;`)
    console.log('Payment method and details columns added!')
  } catch (err) {
    console.error('Error:', err.message)
  } finally {
    pool.end()
  }
}

migrate()
