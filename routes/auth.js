const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { Pool } = require('pg')
const dotenv = require('dotenv')
dotenv.config()

const pool = new Pool({ connectionString: process.env.DB_URL, ssl: { rejectUnauthorized: false } })

// Register student
router.post('/register', async (req, res) => {
  const { student_id, full_name, email, phone, course, password } = req.body
  try {
    const hashed = await bcrypt.hash(password, 10)
    const result = await pool.query(
      `INSERT INTO students (student_id, full_name, email, phone, course, password) VALUES ($1,$2,$3,$4,$5,$6) RETURNING student_id, full_name, course`,
      [student_id, full_name, email, phone, course, hashed]
    )
    res.json({ message: 'Student registered!', student: result.rows[0] })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Student login
router.post('/login', async (req, res) => {
  const { student_id, password } = req.body
  try {
    const result = await pool.query('SELECT * FROM students WHERE student_id = $1', [student_id])
    if (!result.rows.length) return res.status(401).json({ error: 'Student not found' })
    const student = result.rows[0]
    const valid = await bcrypt.compare(password, student.password)
    if (!valid) return res.status(401).json({ error: 'Incorrect password' })
    const token = jwt.sign({ student_id: student.student_id }, process.env.JWT_SECRET, { expiresIn: '12h' })
    res.json({ message: 'Login successful!', token, student_id: student.student_id, full_name: student.full_name, course: student.course })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Change password
router.post('/change-password', async (req, res) => {
  const { student_id, current_password, new_password } = req.body
  try {
    const result = await pool.query('SELECT * FROM students WHERE student_id = $1', [student_id])
    if (!result.rows.length) return res.status(404).json({ error: 'Student not found' })
    const student = result.rows[0]
    const valid = await bcrypt.compare(current_password, student.password)
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' })
    if (new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' })
    const hashed = await bcrypt.hash(new_password, 10)
    await pool.query('UPDATE students SET password=$1 WHERE student_id=$2', [hashed, student_id])
    res.json({ message: 'Password changed successfully!' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
