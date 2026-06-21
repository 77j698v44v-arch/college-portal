const { Pool } = require('pg')
const dotenv = require('dotenv')
const bcrypt = require('bcryptjs')

dotenv.config()

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false }
})

const fix = async () => {
  try {
    // Widen the column so it can hold a hashed password
    await pool.query(`ALTER TABLE employees ALTER COLUMN id_number TYPE VARCHAR(255);`)
    console.log('Column widened successfully.')

    const employeeCode = 'ADM-001'
    const idNumber = '24868787'
    const hashedId = await bcrypt.hash(idNumber, 10)

    const existing = await pool.query('SELECT * FROM employees WHERE employee_code = $1', [employeeCode])
    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO employees (employee_code, id_number, full_name, role) VALUES ($1, $2, $3, $4)`,
        [employeeCode, hashedId, 'Emmanuel Andrew', 'chief_admin']
      )
      console.log('Chief Admin created! Employee Code: ' + employeeCode)
    } else {
      console.log('Chief Admin already exists, skipped.')
    }

    console.log('Fix complete!')
  } catch (err) {
    console.error('Fix error:', err.message)
  } finally {
    pool.end()
  }
}

fix()
