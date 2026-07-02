const express = require('express')
const router = express.Router()
const { Pool } = require('pg')
const dotenv = require('dotenv')

dotenv.config()

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false }
})

async function getRole(employee_code) {
  const r = await pool.query('SELECT role FROM employees WHERE employee_code = $1', [employee_code])
  return r.rows.length ? r.rows[0].role : null
}

/* --- RESULTS --- */
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
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/results/:id', async (req, res) => {
  const { id } = req.params
  const { cat_score, exam_score, total_score, grade, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (!role) return res.status(403).json({ error: 'Not authorized' })
    const existing = await pool.query('SELECT created_by FROM results WHERE id = $1', [id])
    if (!existing.rows.length) return res.status(404).json({ error: 'Result not found' })
    if (role !== 'chief_admin' && existing.rows[0].created_by !== requester_code) {
      return res.status(403).json({ error: 'You can only edit results you created' })
    }
    const updated = await pool.query(
      `UPDATE results SET cat_score=$1, exam_score=$2, total_score=$3, grade=$4 WHERE id=$5 RETURNING *`,
      [cat_score, exam_score, total_score, grade, id]
    )
    res.json({ message: 'Result updated!', result: updated.rows[0] })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/results/:id', async (req, res) => {
  const { id } = req.params
  const { requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (!role) return res.status(403).json({ error: 'Not authorized' })
    const existing = await pool.query('SELECT created_by FROM results WHERE id = $1', [id])
    if (!existing.rows.length) return res.status(404).json({ error: 'Result not found' })
    if (role !== 'chief_admin' && existing.rows[0].created_by !== requester_code) {
      return res.status(403).json({ error: 'You can only delete results you created' })
    }
    await pool.query('DELETE FROM results WHERE id = $1', [id])
    res.json({ message: 'Result deleted!' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Get results for a student (for admin view with delete buttons)
router.get('/results/student/:student_id', async (req, res) => {
  const { requester_code } = req.query
  try {
    const role = await getRole(requester_code)
    if (!role) return res.status(403).json({ error: 'Not authorized' })
    const result = await pool.query('SELECT * FROM results WHERE student_id = $1 ORDER BY created_at DESC', [req.params.student_id])
    res.json(result.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/* --- ATTENDANCE --- */
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
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/attendance/:id', async (req, res) => {
  const { id } = req.params
  const { requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (!role) return res.status(403).json({ error: 'Not authorized' })
    const existing = await pool.query('SELECT created_by FROM attendance WHERE id = $1', [id])
    if (!existing.rows.length) return res.status(404).json({ error: 'Attendance record not found' })
    if (role !== 'chief_admin' && existing.rows[0].created_by !== requester_code) {
      return res.status(403).json({ error: 'You can only delete attendance you created' })
    }
    await pool.query('DELETE FROM attendance WHERE id = $1', [id])
    res.json({ message: 'Attendance deleted!' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/* --- FEES --- */
router.post('/fees', async (req, res) => {
  const { student_id, amount, semester, due_date, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can manage fees' })
    const result = await pool.query(
      `INSERT INTO fees (student_id, amount, paid, balance, semester, due_date) VALUES ($1, $2, 0, $2, $3, $4) RETURNING *`,
      [student_id, amount, semester, due_date]
    )
    res.json({ message: 'Fee record added!', fee: result.rows[0] })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/fees/bulk', async (req, res) => {
  const { course, amount, semester, due_date, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can manage fees' })
    const students = await pool.query('SELECT student_id FROM students WHERE course = $1', [course])
    if (!students.rows.length) return res.status(404).json({ error: 'No students found for that course' })
    var count = 0
    for (var i = 0; i < students.rows.length; i++) {
      await pool.query(
        `INSERT INTO fees (student_id, amount, paid, balance, semester, due_date) VALUES ($1, $2, 0, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [students.rows[i].student_id, amount, semester, due_date]
      )
      count++
    }
    res.json({ message: 'Bulk fee applied to ' + count + ' students in ' + course })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/fees/:id/pay', async (req, res) => {
  const { id } = req.params
  const { amount_paid, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can record payments' })
    const existing = await pool.query('SELECT * FROM fees WHERE id = $1', [id])
    if (!existing.rows.length) return res.status(404).json({ error: 'Fee record not found' })
    const fee = existing.rows[0]
    const newPaid = parseFloat(fee.paid) + parseFloat(amount_paid)
    const newBalance = parseFloat(fee.amount) - newPaid
    const updated = await pool.query(`UPDATE fees SET paid=$1, balance=$2 WHERE id=$3 RETURNING *`, [newPaid, newBalance, id])
    await pool.query(
      `INSERT INTO payments (student_id, amount, mpesa_receipt, phone, status) VALUES ($1, $2, $3, $4, 'completed')`,
      [fee.student_id, amount_paid, 'CASH-' + Date.now(), 'cash']
    )
    res.json({ message: 'Payment recorded!', fee: updated.rows[0] })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/fees/overview', async (req, res) => {
  const { requester_code } = req.query
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can view fees overview' })
    const result = await pool.query(`
      SELECT s.student_id, s.full_name, s.course,
        COALESCE(SUM(f.amount), 0) AS total_billed,
        COALESCE(SUM(f.paid), 0) AS total_paid,
        COALESCE(SUM(f.balance), 0) AS total_balance
      FROM students s LEFT JOIN fees f ON s.student_id = f.student_id
      GROUP BY s.student_id, s.full_name, s.course ORDER BY total_balance DESC
    `)
    const summary = await pool.query(`SELECT COALESCE(SUM(amount),0) AS grand_total, COALESCE(SUM(paid),0) AS grand_paid, COALESCE(SUM(balance),0) AS grand_balance FROM fees`)
    res.json({ students: result.rows, summary: summary.rows[0] })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/fees/student/:student_id', async (req, res) => {
  const { requester_code } = req.query
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can view fee details' })
    const result = await pool.query('SELECT * FROM fees WHERE student_id = $1 ORDER BY created_at DESC', [req.params.student_id])
    res.json(result.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/* --- TIMETABLE --- */
router.post('/timetable', async (req, res) => {
  const { unit_name, day, start_time, end_time, room, semester, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can manage the timetable' })
    const result = await pool.query(
      `INSERT INTO timetable (unit_name, day, start_time, end_time, room, semester) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [unit_name, day, start_time, end_time, room, semester]
    )
    res.json({ message: 'Timetable entry added!', entry: result.rows[0] })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/timetable/all', async (req, res) => {
  const { requester_code } = req.query
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can view timetable' })
    const result = await pool.query('SELECT * FROM timetable ORDER BY day, start_time')
    res.json(result.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/* --- STUDENTS --- */
router.get('/students', async (req, res) => {
  const { requester_code } = req.query
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can view the student list' })
    const result = await pool.query('SELECT student_id, full_name, email, phone, course, created_at FROM students ORDER BY full_name')
    res.json(result.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/students/:student_id', async (req, res) => {
  const { student_id } = req.params
  const { requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can delete students' })
    await pool.query('DELETE FROM students WHERE student_id = $1', [student_id])
    res.json({ message: 'Student deleted!' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
