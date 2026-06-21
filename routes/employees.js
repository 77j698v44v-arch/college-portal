const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { Pool } = require('pg')
const dotenv = require('dotenv')

dotenv.config()

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false }
})

// Employee login — Employee Code + ID Number
router.post('/login', async (req, res) => {
  const { employee_code, id_number } = req.body
  try {
    const result = await pool.query(
      'SELECT * FROM employees WHERE employee_code = $1',
      [employee_code]
    )
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Employee not found' })
    }
    const employee = result.rows[0]
    const validId = await bcrypt.compare(id_number, employee.id_number)
    if (!validId) {
      return res.status(401).json({ error: 'Invalid ID number' })
    }
    const token = jwt.sign(
      { employee_code: employee.employee_code, full_name: employee.full_name, role: employee.role },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    )
    res.json({
      message: 'Login successful!',
      token,
      employee_code: employee.employee_code,
      full_name: employee.full_name,
      role: employee.role
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Chief Admin only — create a new employee (teacher or another chief admin)
router.post('/create', async (req, res) => {
  const { employee_code, id_number, full_name, role, requester_code } = req.body
  try {
    // Confirm requester is a chief_admin
    const requesterCheck = await pool.query(
      'SELECT role FROM employees WHERE employee_code = $1',
      [requester_code]
    )
    if (requesterCheck.rows.length === 0 || requesterCheck.rows[0].role !== 'chief_admin') {
      return res.status(403).json({ error: 'Only Chief Admin can create employee accounts' })
    }

    const hashedId = await bcrypt.hash(id_number, 10)
    const result = await pool.query(
      `INSERT INTO employees (employee_code, id_number, full_name, role)
       VALUES ($1, $2, $3, $4) RETURNING employee_code, full_name, role`,
      [employee_code, hashedId, full_name, role]
    )
    res.json({ message: 'Employee created!', employee: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// List all employees (Chief Admin only — checked via requester_code query param)
router.get('/all', async (req, res) => {
  const { requester_code } = req.query
  try {
    const requesterCheck = await pool.query(
      'SELECT role FROM employees WHERE employee_code = $1',
      [requester_code]
    )
    if (requesterCheck.rows.length === 0 || requesterCheck.rows[0].role !== 'chief_admin') {
      return res.status(403).json({ error: 'Only Chief Admin can view employee list' })
    }
    const result = await pool.query(
      'SELECT employee_code, full_name, role, created_at FROM employees ORDER BY created_at DESC'
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
