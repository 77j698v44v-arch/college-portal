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

/* ============ EXAM FEES ============ */
router.post('/exam-fees', async (req, res) => {
  const { student_id, fee_type, amount, semester, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can manage exam fees' })
    const result = await pool.query(
      `INSERT INTO exam_fees (student_id, fee_type, amount, paid, balance, semester) VALUES ($1, $2, $3, 0, $3, $4) RETURNING *`,
      [student_id, fee_type, amount, semester]
    )
    res.json({ message: 'Exam fee record added!', fee: result.rows[0] })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/exam-fees/student/:student_id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM exam_fees WHERE student_id = $1 ORDER BY created_at DESC', [req.params.student_id])
    res.json(result.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/exam-fees/:id/pay', async (req, res) => {
  const { id } = req.params
  const { amount_paid, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can record payments' })
    const existing = await pool.query('SELECT * FROM exam_fees WHERE id = $1', [id])
    if (!existing.rows.length) return res.status(404).json({ error: 'Record not found' })
    const fee = existing.rows[0]
    const newPaid = parseFloat(fee.paid) + parseFloat(amount_paid)
    const newBalance = parseFloat(fee.amount) - newPaid
    const updated = await pool.query(`UPDATE exam_fees SET paid=$1, balance=$2 WHERE id=$3 RETURNING *`, [newPaid, newBalance, id])
    res.json({ message: 'Payment recorded!', fee: updated.rows[0] })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/exam-fees/:id/balance', async (req, res) => {
  const { id } = req.params
  const { new_balance, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can edit balances' })
    const updated = await pool.query(`UPDATE exam_fees SET balance=$1 WHERE id=$2 RETURNING *`, [new_balance, id])
    if (!updated.rows.length) return res.status(404).json({ error: 'Record not found' })
    res.json({ message: 'Balance updated!', fee: updated.rows[0] })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/exam-fees/:id', async (req, res) => {
  const { id } = req.params
  const { requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can delete exam fee records' })
    await pool.query('DELETE FROM exam_fees WHERE id = $1', [id])
    res.json({ message: 'Exam fee record deleted!' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/* ============ HOSTEL ============ */
router.post('/hostel', async (req, res) => {
  const { student_id, room_details, amount, semester, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can manage hostel records' })
    const result = await pool.query(
      `INSERT INTO hostel (student_id, room_details, amount, paid, balance, semester) VALUES ($1, $2, $3, 0, $3, $4)
       ON CONFLICT (student_id) DO UPDATE SET room_details=$2, amount=$3, balance=$3, semester=$4 RETURNING *`,
      [student_id, room_details, amount, semester]
    )
    res.json({ message: 'Student registered to hostel!', hostel: result.rows[0] })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/hostel/all', async (req, res) => {
  const { requester_code } = req.query
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can view hostel list' })
    const result = await pool.query(`SELECT h.*, s.full_name, s.course FROM hostel h JOIN students s ON h.student_id = s.student_id ORDER BY h.created_at DESC`)
    res.json(result.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/hostel/student/:student_id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM hostel WHERE student_id = $1', [req.params.student_id])
    res.json(result.rows.length ? result.rows[0] : null)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/hostel/:id/pay', async (req, res) => {
  const { id } = req.params
  const { amount_paid, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can record payments' })
    const existing = await pool.query('SELECT * FROM hostel WHERE id = $1', [id])
    if (!existing.rows.length) return res.status(404).json({ error: 'Record not found' })
    const h = existing.rows[0]
    const newPaid = parseFloat(h.paid) + parseFloat(amount_paid)
    const newBalance = parseFloat(h.amount) - newPaid
    const updated = await pool.query(`UPDATE hostel SET paid=$1, balance=$2 WHERE id=$3 RETURNING *`, [newPaid, newBalance, id])
    res.json({ message: 'Payment recorded!', hostel: updated.rows[0] })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/hostel/:id/balance', async (req, res) => {
  const { id } = req.params
  const { new_balance, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can edit balances' })
    const updated = await pool.query(`UPDATE hostel SET balance=$1 WHERE id=$2 RETURNING *`, [new_balance, id])
    if (!updated.rows.length) return res.status(404).json({ error: 'Record not found' })
    res.json({ message: 'Balance updated!', hostel: updated.rows[0] })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/hostel/:student_id', async (req, res) => {
  const { student_id } = req.params
  const { requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can remove hostel records' })
    await pool.query('DELETE FROM hostel WHERE student_id = $1', [student_id])
    res.json({ message: 'Student removed from hostel.' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/* ============ INLINE EDIT — School Fees balance ============ */
router.put('/fees/:id/balance', async (req, res) => {
  const { id } = req.params
  const { new_balance, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can edit balances' })
    const updated = await pool.query(`UPDATE fees SET balance=$1 WHERE id=$2 RETURNING *`, [new_balance, id])
    if (!updated.rows.length) return res.status(404).json({ error: 'Record not found' })
    res.json({ message: 'Balance updated!', fee: updated.rows[0] })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/* ============ DELETE — Timetable ============ */
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

/* ============ DELETE — Fee record ============ */
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

/* ============ BULK ATTENDANCE — with explicit Present/Absent per student ============ */
router.post('/attendance/bulk', async (req, res) => {
  const { course, unit_name, semester, class_date, attendance_records, requester_code } = req.body
  // attendance_records = [{ student_id: 'WC-001', status: 'present' }, ...]
  try {
    const role = await getRole(requester_code)
    if (!role) return res.status(403).json({ error: 'Not authorized' })

    var present = 0
    var absent = 0

    for (var i = 0; i < attendance_records.length; i++) {
      var sid = attendance_records[i].student_id
      var status = attendance_records[i].status
      var wasPresent = status === 'present'

      // Save individual session record
      await pool.query(
        `INSERT INTO attendance_sessions (student_id, unit_name, course, semester, class_date, status, recorded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING`,
        [sid, unit_name, course, semester, class_date, status, requester_code]
      )

      // Update running totals
      const existing = await pool.query(
        'SELECT * FROM attendance WHERE student_id = $1 AND unit_name = $2 AND semester = $3',
        [sid, unit_name, semester]
      )

      if (existing.rows.length === 0) {
        const attended = wasPresent ? 1 : 0
        const pct = wasPresent ? 100 : 0
        await pool.query(
          `INSERT INTO attendance (student_id, unit_name, classes_attended, total_classes, percentage, semester, created_by)
           VALUES ($1, $2, $3, 1, $4, $5, $6)`,
          [sid, unit_name, attended, pct, semester, requester_code]
        )
      } else {
        const rec = existing.rows[0]
        const newTotal = parseInt(rec.total_classes) + 1
        const newAttended = parseInt(rec.classes_attended) + (wasPresent ? 1 : 0)
        const newPct = ((newAttended / newTotal) * 100).toFixed(2)
        await pool.query(
          `UPDATE attendance SET classes_attended=$1, total_classes=$2, percentage=$3, created_by=$4
           WHERE student_id=$5 AND unit_name=$6 AND semester=$7`,
          [newAttended, newTotal, newPct, requester_code, sid, unit_name, semester]
        )
      }

      if (wasPresent) present++; else absent++;
    }

    res.json({
      message: 'Attendance submitted! ' + present + ' present, ' + absent + ' absent.',
      present, absent, total: attendance_records.length, date: class_date
    })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/* ============ GET ATTENDANCE SESSIONS — by course, unit, date range ============ */
router.get('/attendance/sessions', async (req, res) => {
  const { course, unit_name, from_date, to_date, requester_code } = req.query
  try {
    const role = await getRole(requester_code)
    if (!role) return res.status(403).json({ error: 'Not authorized' })

    var query = `
      SELECT s.student_id, st.full_name, s.unit_name, s.course, s.class_date, s.status, s.semester
      FROM attendance_sessions s
      JOIN students st ON s.student_id = st.student_id
      WHERE s.course = $1
    `
    var params = [course]
    var paramCount = 2

    if (unit_name) { query += ` AND s.unit_name = $${paramCount}`; params.push(unit_name); paramCount++; }
    if (from_date) { query += ` AND s.class_date >= $${paramCount}`; params.push(from_date); paramCount++; }
    if (to_date) { query += ` AND s.class_date <= $${paramCount}`; params.push(to_date); paramCount++; }

    query += ' ORDER BY s.class_date DESC, st.full_name'

    const result = await pool.query(query, params)
    res.json(result.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

/* ============ GET ATTENDANCE SUMMARY — by course ============ */
router.get('/attendance/summary', async (req, res) => {
  const { course, unit_name, semester, requester_code } = req.query
  try {
    const role = await getRole(requester_code)
    if (!role) return res.status(403).json({ error: 'Not authorized' })

    var query = `
      SELECT a.student_id, st.full_name, a.unit_name, a.semester,
             a.classes_attended, a.total_classes, a.percentage
      FROM attendance a
      JOIN students st ON a.student_id = st.student_id
      WHERE st.course = $1
    `
    var params = [course]
    var paramCount = 2

    if (unit_name) { query += ` AND a.unit_name = $${paramCount}`; params.push(unit_name); paramCount++; }
    if (semester) { query += ` AND a.semester = $${paramCount}`; params.push(semester); paramCount++; }

    query += ' ORDER BY st.full_name, a.unit_name'

    const result = await pool.query(query, params)
    res.json(result.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
