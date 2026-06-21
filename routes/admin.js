const express = require('express')
const router = express.Router()
const { Pool } = require('pg')
const dotenv = require('dotenv')

dotenv.config()

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false }
})

// Helper — look up an employee's role
async function getRole(employee_code) {
  const r = await pool.query('SELECT role FROM employees WHERE employee_code = $1', [employee_code])
  return r.rows.length ? r.rows[0].role : null
}

/* ---------------- RESULTS ---------------- */
// Add result — any logged-in employee (teacher or chief_admin)
router.post('/results', async (req, res) => {
  const { student_id, unit_name, cat_score, exam_score, total_score, grade, semester, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (!role) return res.status(403).json({ error: 'Not authorized' })

    const result = await pool.query(
      `INSERT INTO results (student_id, unit_name, cat_score, exam_score, total_score, grade, semester, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [student_id, unit_name, cat_score, exam_score, total_score, grade, semester, requester_code]
    )
    res.json({ message: 'Result added!', result: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Edit result — only the creator, or chief_admin
router.put('/results/:id', async (req, res) => {
  const { id } = req.params
  const { cat_score, exam_score, total_score, grade, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (!role) return res.status(403).json({ error: 'Not authorized' })

    const existing = await pool.query('SELECT created_by FROM results WHERE id = $1', [id])
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Result not found' })

    if (role !== 'chief_admin' && existing.rows[0].created_by !== requester_code) {
      return res.status(403).json({ error: 'You can only edit results you created' })
    }

    const updated = await pool.query(
      `UPDATE results SET cat_score=$1, exam_score=$2, total_score=$3, grade=$4 WHERE id=$5 RETURNING *`,
      [cat_score, exam_score, total_score, grade, id]
    )
    res.json({ message: 'Result updated!', result: updated.rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Delete result — only the creator, or chief_admin
router.delete('/results/:id', async (req, res) => {
  const { id } = req.params
  const { requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (!role) return res.status(403).json({ error: 'Not authorized' })

    const existing = await pool.query('SELECT created_by FROM results WHERE id = $1', [id])
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Result not found' })

    if (role !== 'chief_admin' && existing.rows[0].created_by !== requester_code) {
      return res.status(403).json({ error: 'You can only delete results you created' })
    }

    await pool.query('DELETE FROM results WHERE id = $1', [id])
    res.json({ message: 'Result deleted!' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* ---------------- ATTENDANCE ---------------- */
// Add/update attendance — any logged-in employee
router.post('/attendance', async (req, res) => {
  const { student_id, unit_name, classes_attended, total_classes, semester, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (!role) return res.status(403).json({ error: 'Not authorized' })

    const percentage = ((classes_attended / total_classes) * 100).toFixed(2)
    const result = await pool.query(
      `INSERT INTO attendance (student_id, unit_name, classes_attended, total_classes, percentage, semester, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (student_id, unit_name, semester)
       DO UPDATE SET classes_attended=$3, total_classes=$4, percentage=$5, created_by=$7 RETURNING *`,
      [student_id, unit_name, classes_attended, total_classes, percentage, semester, requester_code]
    )
    res.json({ message: 'Attendance updated!', attendance: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Delete attendance — only the creator, or chief_admin
router.delete('/attendance/:id', async (req, res) => {
  const { id } = req.params
  const { requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (!role) return res.status(403).json({ error: 'Not authorized' })

    const existing = await pool.query('SELECT created_by FROM attendance WHERE id = $1', [id])
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Attendance record not found' })

    if (role !== 'chief_admin' && existing.rows[0].created_by !== requester_code) {
      return res.status(403).json({ error: 'You can only delete attendance you created' })
    }

    await pool.query('DELETE FROM attendance WHERE id = $1', [id])
    res.json({ message: 'Attendance deleted!' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* ---------------- FEES — Chief Admin only ---------------- */
router.post('/fees', async (req, res) => {
  const { student_id, amount, semester, due_date, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can manage fees' })

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

/* ---------------- TIMETABLE — Chief Admin only ---------------- */
router.post('/timetable', async (req, res) => {
  const { unit_name, day, start_time, end_time, room, semester, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can manage the timetable' })

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

/* ---------------- STUDENTS — register/list: Chief Admin only ---------------- */
router.get('/students', async (req, res) => {
  const { requester_code } = req.query
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can view the student list' })

    const result = await pool.query(
      'SELECT student_id, full_name, email, phone, created_at FROM students'
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/students/:student_id', async (req, res) => {
  const { student_id } = req.params
  const { requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can delete students' })

    await pool.query('DELETE FROM students WHERE student_id = $1', [student_id])
    res.json({ message: 'Student deleted!' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
