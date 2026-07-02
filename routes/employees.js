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

// Employee login
router.post('/login', async (req, res) => {
  const { employee_code, id_number } = req.body
  try {
    const result = await pool.query('SELECT * FROM employees WHERE employee_code = $1', [employee_code])
    if (!result.rows.length) return res.status(401).json({ error: 'Employee not found' })
    const employee = result.rows[0]
    const validId = await bcrypt.compare(id_number, employee.id_number)
    if (!validId) return res.status(401).json({ error: 'Invalid ID number' })
    const token = jwt.sign(
      { employee_code: employee.employee_code, full_name: employee.full_name, role: employee.role },
      process.env.JWT_SECRET, { expiresIn: '12h' }
    )
    res.json({ message: 'Login successful!', token, employee_code: employee.employee_code, full_name: employee.full_name, role: employee.role })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Create employee — Chief Admin only
router.post('/create', async (req, res) => {
  const { employee_code, id_number, full_name, role, requester_code } = req.body
  try {
    const requesterCheck = await pool.query('SELECT role FROM employees WHERE employee_code = $1', [requester_code])
    if (!requesterCheck.rows.length || requesterCheck.rows[0].role !== 'chief_admin') {
      return res.status(403).json({ error: 'Only Chief Admin can create employee accounts' })
    }
    const hashedId = await bcrypt.hash(id_number, 10)
    const result = await pool.query(
      `INSERT INTO employees (employee_code, id_number, full_name, role) VALUES ($1, $2, $3, $4) RETURNING employee_code, full_name, role`,
      [employee_code, hashedId, full_name, role]
    )
    res.json({ message: 'Employee created!', employee: result.rows[0] })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// List all employees — Chief Admin only
router.get('/all', async (req, res) => {
  const { requester_code } = req.query
  try {
    const requesterCheck = await pool.query('SELECT role FROM employees WHERE employee_code = $1', [requester_code])
    if (!requesterCheck.rows.length || requesterCheck.rows[0].role !== 'chief_admin') {
      return res.status(403).json({ error: 'Only Chief Admin can view employee list' })
    }
    const result = await pool.query('SELECT employee_code, full_name, role, created_at FROM employees ORDER BY created_at DESC')
    res.json(result.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Delete employee — Chief Admin only, cannot delete yourself
router.delete('/:employee_code', async (req, res) => {
  const { employee_code } = req.params
  const { requester_code } = req.body
  try {
    const requesterCheck = await pool.query('SELECT role FROM employees WHERE employee_code = $1', [requester_code])
    if (!requesterCheck.rows.length || requesterCheck.rows[0].role !== 'chief_admin') {
      return res.status(403).json({ error: 'Only Chief Admin can delete employee accounts' })
    }
    if (employee_code === requester_code) {
      return res.status(400).json({ error: 'You cannot delete your own account' })
    }
    await pool.query('DELETE FROM employees WHERE employee_code = $1', [employee_code])
    res.json({ message: 'Employee account deleted!' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
