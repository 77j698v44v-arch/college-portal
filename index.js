const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const authRoutes = require('./routes/auth')
const studentRoutes = require('./routes/students')
const mpesaRoutes = require('./routes/mpesa')
const adminRoutes = require('./routes/admin')

app.use('/api/auth', authRoutes)
app.use('/api/students', studentRoutes)
app.use('/api/mpesa', mpesaRoutes)
app.use('/api/admin', adminRoutes)

app.get('/', (req, res) => {
  res.json({ message: 'College portal API is running!' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})