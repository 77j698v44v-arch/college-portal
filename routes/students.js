const express = require('express')
const router = express.Router()
const { Pool } = require('pg')
const dotenv = require('dotenv')

dotenv.config()

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false }
})

// Get student results
router.get('/:student_id/results', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM results WHERE student_id = $1',
      [req.params.student_id]
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get student fees
router.get('/:student_id/fees', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM fees WHERE student_id = $1',
      [req.params.student_id]
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get student attendance
router.get('/:student_id/attendance', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM attendance WHERE student_id = $1',
      [req.params.student_id]
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get timetable
router.get('/timetable', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM timetable')
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get payment history
router.get('/:student_id/payments', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM payments WHERE student_id = $1',
      [req.params.student_id]
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router