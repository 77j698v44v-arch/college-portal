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

/* ============ EXAM FEES (national_exam, internal_exam, ream_papers_files) ============ */

// Add exam fee record — Chief Admin only
router.post('/exam-fees', async (req, res) => {
  const { student_id, fee_type, amount, semester, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can manage exam fees' })

    const result = await pool.query(
      `INSERT INTO exam_fees (student_id, fee_type, amount, paid, balance, semester)
       VALUES ($1, $2, $3, 0, $3, $4) RETURNING *`,
      [student_id, fee_type, amount, semester]
    )
    res.json({ message: 'Exam fee record added!', fee: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get a student's exam fees (all types) — used by student portal, no auth needed (same pattern as /students/fees)
router.get('/exam-fees/student/:student_id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM exam_fees WHERE student_id = $1 ORDER BY created_at DESC',
      [req.params.student_id]
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Record a payment toward an exam fee — Chief Admin only
router.put('/exam-fees/:id/pay', async (req, res) => {
  const { id } = req.params
  const { amount_paid, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can record payments' })

    const existing = await pool.query('SELECT * FROM exam_fees WHERE id = $1', [id])
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Record not found' })

    const fee = existing.rows[0]
    const newPaid = parseFloat(fee.paid) + parseFloat(amount_paid)
    const newBalance = parseFloat(fee.amount) - newPaid

    const updated = await pool.query(
      `UPDATE exam_fees SET paid=$1, balance=$2 WHERE id=$3 RETURNING *`,
      [newPaid, newBalance, id]
    )
    res.json({ message: 'Payment recorded!', fee: updated.rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Directly edit the balance of an exam fee (inline edit) — Chief Admin only
router.put('/exam-fees/:id/balance', async (req, res) => {
  const { id } = req.params
  const { new_balance, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can edit balances' })

    const updated = await pool.query(
      `UPDATE exam_fees SET balance=$1 WHERE id=$2 RETURNING *`,
      [new_balance, id]
    )
    if (updated.rows.length === 0) return res.status(404).json({ error: 'Record not found' })
    res.json({ message: 'Balance updated!', fee: updated.rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* ============ HOSTEL ============ */

// Register a student into hostel — Chief Admin only
router.post('/hostel', async (req, res) => {
  const { student_id, room_details, amount, semester, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can manage hostel records' })

    const result = await pool.query(
      `INSERT INTO hostel (student_id, room_details, amount, paid, balance, semester)
       VALUES ($1, $2, $3, 0, $3, $4)
       ON CONFLICT (student_id) DO UPDATE SET room_details=$2, amount=$3, balance=$3, semester=$4
       RETURNING *`,
      [student_id, room_details, amount, semester]
    )
    res.json({ message: 'Student registered to hostel!', hostel: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// List all hostel-registered students — Chief Admin only
router.get('/hostel/all', async (req, res) => {
  const { requester_code } = req.query
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can view hostel list' })

    const result = await pool.query(`
      SELECT h.*, s.full_name, s.course
      FROM hostel h
      JOIN students s ON h.student_id = s.student_id
      ORDER BY h.created_at DESC
    `)
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get a single student's hostel record (or null if not registered) — used by student portal
router.get('/hostel/student/:student_id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM hostel WHERE student_id = $1', [req.params.student_id]
    )
    res.json(result.rows.length ? result.rows[0] : null)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Record a hostel payment — Chief Admin only
router.put('/hostel/:id/pay', async (req, res) => {
  const { id } = req.params
  const { amount_paid, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can record payments' })

    const existing = await pool.query('SELECT * FROM hostel WHERE id = $1', [id])
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Record not found' })

    const h = existing.rows[0]
    const newPaid = parseFloat(h.paid) + parseFloat(amount_paid)
    const newBalance = parseFloat(h.amount) - newPaid

    const updated = await pool.query(
      `UPDATE hostel SET paid=$1, balance=$2 WHERE id=$3 RETURNING *`,
      [newPaid, newBalance, id]
    )
    res.json({ message: 'Payment recorded!', hostel: updated.rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Directly edit hostel balance (inline edit) — Chief Admin only
router.put('/hostel/:id/balance', async (req, res) => {
  const { id } = req.params
  const { new_balance, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can edit balances' })

    const updated = await pool.query(
      `UPDATE hostel SET balance=$1 WHERE id=$2 RETURNING *`,
      [new_balance, id]
    )
    if (updated.rows.length === 0) return res.status(404).json({ error: 'Record not found' })
    res.json({ message: 'Balance updated!', hostel: updated.rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Remove a student from hostel — Chief Admin only
router.delete('/hostel/:student_id', async (req, res) => {
  const { student_id } = req.params
  const { requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can remove hostel records' })

    await pool.query('DELETE FROM hostel WHERE student_id = $1', [student_id])
    res.json({ message: 'Student removed from hostel.' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* ============ INLINE EDIT — School Fees balance ============ */
router.put('/fees/:id/balance', async (req, res) => {
  const { id } = req.params
  const { new_balance, requester_code } = req.body
  try {
    const role = await getRole(requester_code)
    if (role !== 'chief_admin') return res.status(403).json({ error: 'Only Chief Admin can edit balances' })

    const updated = await pool.query(
      `UPDATE fees SET balance=$1 WHERE id=$2 RETURNING *`,
      [new_balance, id]
    )
    if (updated.rows.length === 0) return res.status(404).json({ error: 'Record not found' })
    res.json({ message: 'Balance updated!', fee: updated.rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
