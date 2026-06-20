const express = require('express')
const router = express.Router()
const axios = require('axios')
const { Pool } = require('pg')
const dotenv = require('dotenv')

dotenv.config()

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false }
})

// Get Daraja access token
const getAccessToken = async () => {
  const auth = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString('base64')

  const response = await axios.get(
    'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    { headers: { Authorization: `Basic ${auth}` } }
  )
  return response.data.access_token
}

// STK Push — trigger payment prompt on student phone
router.post('/pay', async (req, res) => {
  const { student_id, phone, amount } = req.body
  try {
    const token = await getAccessToken()
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14)
    const password = Buffer.from(
      `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString('base64')

    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      {
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: phone,
        PartyB: process.env.MPESA_SHORTCODE,
        PhoneNumber: phone,
        CallBackURL: process.env.MPESA_CALLBACK_URL,
        AccountReference: student_id,
        TransactionDesc: 'Fee payment'
      },
      { headers: { Authorization: `Bearer ${token}` } }
    )

    // Save pending payment to database
    await pool.query(
      `INSERT INTO payments (student_id, amount, phone, status) VALUES ($1, $2, $3, 'pending')`,
      [student_id, amount, phone]
    )

    res.json({ message: 'Payment prompt sent!', data: response.data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Callback URL — Safaricom posts result here after student pays
router.post('/callback', async (req, res) => {
  const callback = req.body.Body.stkCallback
  const resultCode = callback.ResultCode

  if (resultCode === 0) {
    const items = callback.CallbackMetadata.Item
    const amount = items.find(i => i.Name === 'Amount').Value
    const receipt = items.find(i => i.Name === 'MpesaReceiptNumber').Value
    const phone = items.find(i => i.Name === 'PhoneNumber').Value

    await pool.query(
      `UPDATE payments SET status='completed', mpesa_receipt=$1 WHERE phone=$2 AND status='pending'`,
      [receipt, phone.toString()]
    )

    await pool.query(
      `UPDATE fees SET paid = paid + $1, balance = balance - $1 WHERE student_id = (
        SELECT student_id FROM payments WHERE mpesa_receipt = $2
      )`,
      [amount, receipt]
    )
  }

  res.json({ ResultCode: 0, ResultDesc: 'Success' })
})

module.exports = router