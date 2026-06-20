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

// Register a student
router.post('/register', async (req, res) => {
  const { student_id, full_name, email, phone, password } = req.body
  try {
    const hashedPassword = await bcrypt.hash(password, 10)
    const result = await pool.query(
      `INSERT INTO students (student_id, full_name, email, phone, password)
       VALUES ($1, $2, $3, $4, $5) RETURNING student_id, full_name, email`,
      [student_id, full_name, email, phone, hashedPassword]
    )
    res.json({ message: 'Student registered successfully!', student: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Login
router.post('/login', async (req, res) => {
  const { student_id, password } = req.body
  try {
    const result = await pool.query(
      'SELECT * FROM students WHERE student_id = $1', [student_id]
    )
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Student not found' })
    }
    const student = result.rows[0]
    const validPassword = await bcrypt.compare(password, student.password)
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid password' })
    }
    const token = jwt.sign(
      { student_id: student.student_id, full_name: student.full_name },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    )
    res.json({ message: 'Login successful!', token, student_id: student.student_id, full_name: student.full_name })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router