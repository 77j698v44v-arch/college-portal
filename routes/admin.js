const express = require('express')
const router = express.Router()
const { Pool } = require('pg')
const dotenv = require('dotenv')
dotenv.config()

const pool = new Pool({ connectionString: process.env.DB_URL, ssl: { rejectUnauthorized: false } })

async function getRole(code) {
  const r = await pool.query('SELECT role FROM employees WHERE employee_code = $1', [code])
  return r.rows.length ? r.rows[0].role : null
}

/* --- RESULTS --- */
router.post('/results', async (req, res) => {
  const { student_id, unit_name, cat_score, exam_score, total_score, grade, semester, year, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (!role) return res.status(403).json({ error: 'Not authorized' })
    const result = await pool.query(
      `INSERT INTO results (student_id, unit_name, cat_score, exam_score, total_score, grade, semester, year, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [student_id, unit_name, cat_score, exam_score, total_score, grade, semester, year || null, requester_code]
    )
    res.json({ message: 'Result added!', result: result.rows[0] })
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
    if (role !== 'chief_admin' && existing.rows[0].created_by !== requester_code)
      return res.status(403).json({ error: 'You can only delete results you created' })
    await pool.query('DELETE FROM results WHERE id = $1', [id])
    res.json({ message: 'Result deleted!' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/results/student/:student_id', async (req, res) => {
  const { requester_code } = req.query
  try {
    const role = await getRole(requester_code)
    if (!role) return res.status(403).json({ error: 'Not authorized' })
    const result = await pool.query('SELECT * FROM results WHERE student_id = $1 ORDER BY created_at DESC', [req.params.student_id])
    res.json(result.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// View results by course with optional filters
router.get('/results/course/:course', async (req, res) => {
  const { requester_code, year, semester } = req.query
  try {
    const role = await getRole(requester_code)
    if (!role) return res.status(403).json({ error: 'Not authorized' })
    let query = `SELECT r.*, s.full_name FROM results r JOIN students s ON r.student_id = s.student_id WHERE s.course = $1`
    const params = [decodeURIComponent(req.params.course)]
    let count = 2
    if (year) { query += ` AND r.year = $${count}`; params.push(year); count++ }
    if (semester) { query += ` AND r.semester = $${count}`; params.push(semester); count++ }
    query += ' ORDER BY s.full_name, r.unit_name'
    const result = await pool.query(query, params)
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
       VALUES ($1,$2,$3,$4,$5,$6,$7)
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
      `INSERT INTO fees (student_id, amount, paid, balance, semester, due_date) VALUES ($1,$2,0,$2,$3,$4) RETURNING *`,
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
    let count = 0
    for (const s of students.rows) {
      await pool.query(
        `INSERT INTO fees (student_id, amount, paid, balance, semester, due_date) VALUES ($1,$2,0,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [s.student_id, amount, semester, due_date]
      )
      count++
    }
    res.json({ message: `Bulk fee applied to ${count} students in ${course}` })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/fees/overview', async (req, res) => {
  const { requester_code } = req.query
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can view fees overview' })
    const result = await pool.query(`
      SELECT s.student_id, s.full_name, s.course,
        COALESCE(SUM(f.amount),0) AS total_billed,
        COALESCE(SUM(f.paid),0) AS total_paid,
        COALESCE(SUM(f.balance),0) AS total_balance
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

router.put('/fees/:id/pay', async (req, res) => {
  const { id } = req.params
  const { amount_paid, payment_method, payment_details, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can record payments' })
    const existing = await pool.query('SELECT * FROM fees WHERE id = $1', [id])
    if (!existing.rows.length) return res.status(404).json({ error: 'Fee record not found' })
    const fee = existing.rows[0]
    const newPaid = parseFloat(fee.paid) + parseFloat(amount_paid)
    const newBalance = parseFloat(fee.amount) - newPaid
    const updated = await pool.query(`UPDATE fees SET paid=$1, balance=$2 WHERE id=$3 RETURNING *`, [newPaid, newBalance, id])
    const method = payment_method || 'cash'
    let receiptRef = 'CASH-' + Date.now()
    if (method === 'cheque' && payment_details && payment_details.cheque_number) receiptRef = 'CHQ-' + payment_details.cheque_number
    else if (method === 'bank_transfer' && payment_details && payment_details.reference_number) receiptRef = 'BNK-' + payment_details.reference_number
    await pool.query(
      `INSERT INTO payments (student_id, amount, mpesa_receipt, phone, status, payment_method, payment_details) VALUES ($1,$2,$3,$4,'completed',$5,$6)`,
      [fee.student_id, amount_paid, receiptRef, method, method, JSON.stringify(payment_details || {})]
    )
    res.json({ message: 'Payment recorded!', fee: updated.rows[0] })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/fees/:id/balance', async (req, res) => {
  const { id } = req.params
  const { new_balance, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can edit balances' })
    const updated = await pool.query(`UPDATE fees SET balance=$1 WHERE id=$2 RETURNING *`, [new_balance, id])
    if (!updated.rows.length) return res.status(404).json({ error: 'Fee record not found' })
    res.json({ message: 'Balance updated!', fee: updated.rows[0] })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/fees/:id', async (req, res) => {
  const { id } = req.params
  const { requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can delete fee records' })
    await pool.query('DELETE FROM fees WHERE id = $1', [id])
    res.json({ message: 'Fee record deleted!' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/* --- TIMETABLE --- */
router.post('/timetable', async (req, res) => {
  const { unit_name, day, start_time, end_time, room, semester, course, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can manage the timetable' })
    const result = await pool.query(
      `INSERT INTO timetable (unit_name, day, start_time, end_time, room, semester, course) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [unit_name, day, start_time, end_time, room, semester, course]
    )
    res.json({ message: 'Timetable entry added!', entry: result.rows[0] })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/timetable/all', async (req, res) => {
  const { requester_code } = req.query
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can view timetable' })
    const result = await pool.query('SELECT * FROM timetable ORDER BY course, day, start_time')
    res.json(result.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/timetable/:id', async (req, res) => {
  const { id } = req.params
  const { requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can delete timetable entries' })
    await pool.query('DELETE FROM timetable WHERE id = $1', [id])
    res.json({ message: 'Timetable entry deleted!' })
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

router.put('/students/:student_id/course', async (req, res) => {
  const { student_id } = req.params
  const { course, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can update student courses' })
    await pool.query('UPDATE students SET course=$1 WHERE student_id=$2', [course, student_id])
    res.json({ message: 'Course updated!' })
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

/* --- NOTICES --- */
router.post('/notices', async (req, res) => {
  const { title, message, target_course, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can post notices' })
    const result = await pool.query(
      `INSERT INTO notices (title, message, target_course, posted_by) VALUES ($1,$2,$3,$4) RETURNING *`,
      [title, message, target_course || 'all', requester_code]
    )
    res.json({ message: 'Notice posted!', notice: result.rows[0] })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/notices/all', async (req, res) => {
  const { requester_code } = req.query
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can view all notices' })
    const result = await pool.query('SELECT * FROM notices ORDER BY created_at DESC')
    res.json(result.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/notices/student', async (req, res) => {
  const { course } = req.query
  try {
    const result = await pool.query(
      `SELECT * FROM notices WHERE target_course = 'all' OR target_course = $1 ORDER BY created_at DESC`,
      [course]
    )
    res.json(result.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/notices/:id', async (req, res) => {
  const { id } = req.params
  const { requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can delete notices' })
    await pool.query('DELETE FROM notices WHERE id = $1', [id])
    res.json({ message: 'Notice deleted!' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
