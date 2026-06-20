const express = require('express')
const router = express.Router()
const { Pool } = require('pg')
const dotenv = require('dotenv')

dotenv.config()

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false }
})

// Add exam result
router.post('/results', async (req, res) => {
  const { student_id, unit_name, cat_score, exam_score, total_score, grade, semester } = req.body
  try {
    const result = await pool.query(
      `INSERT INTO results (student_id, unit_name, cat_score, exam_score, total_score, grade, semester)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [student_id, unit_name, cat_score, exam_score, total_score, grade, semester]
    )
    res.json({ message: 'Result added!', result: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Add fee record
router.post('/fees', async (req, res) => {
  const { student_id, amount, semester, due_date } = req.body
  try {
    const result = await pool.query(
      `INSERT INTO fees (student_id, amount, paid, balance, semester, due_date)
       VALUES ($1, $2, 0, $2, $3, $4) RETURNING *`,
      [student_id, amount, semester, due_date]
    )
    res.json({ message: 'Fee record added!', fee: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Add attendance
router.post('/attendance', async (req, res) => {
  const { student_id, unit_name, classes_attended, total_classes, semester } = req.body
  try {
    const percentage = ((classes_attended / total_classes) * 100).toFixed(2)
    const result = await pool.query(
      `INSERT INTO attendance (student_id, unit_name, classes_attended, total_classes, percentage, semester)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (student_id, unit_name, semester) 
       DO UPDATE SET classes_attended=$3, total_classes=$4, percentage=$5 RETURNING *`,
      [student_id, unit_name, classes_attended, total_classes, percentage, semester]
    )
    res.json({ message: 'Attendance updated!', attendance: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Add timetable entry
router.post('/timetable', async (req, res) => {
  const { unit_name, day, start_time, end_time, room, semester } = req.body
  try {
    const result = await pool.query(
      `INSERT INTO timetable (unit_name, day, start_time, end_time, room, semester)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [unit_name, day, start_time, end_time, room, semester]
    )
    res.json({ message: 'Timetable entry added!', entry: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get all students
router.get('/students', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT student_id, full_name, email, phone, created_at FROM students'
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router