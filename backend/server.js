import './config/env.js';

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import noteRoutes from './routes/noteRoutes.js';
import aiDocumentRoutes from './routes/aiDocumentRoutes.js';
import { attendanceRouter, scheduleRouter, clubRouter, aiRouter } from './routes/dataRoutes.js';
import { errorHandler, notFound } from './middleware/errorMiddleware.js';
const app = express()
const isAllowedDevOrigin = (origin) => !origin || origin === process.env.CLIENT_URL || /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(origin)
fs.mkdirSync('uploads', { recursive: true })
app.use(cors({ origin: (origin, callback) => callback(isAllowedDevOrigin(origin) ? null : new Error('Origin not allowed by CORS'), isAllowedDevOrigin(origin)) }))
app.use(express.json())
app.use('/uploads', express.static('uploads'))
app.get('/api/health', (req, res) => res.json({ status: 'ok' }))
app.use('/api/auth', authRoutes)
app.use('/api/notes', noteRoutes)
app.use('/api/ai/documents', aiDocumentRoutes)
app.use('/api/attendance', attendanceRouter)
app.use('/api/schedule', scheduleRouter)
app.use('/api/clubs', clubRouter)
app.use('/api/ai', aiRouter)
app.use(notFound)
app.use(errorHandler)
connectDB()
  .then(() => {
    const port = process.env.PORT || 5000;
    const server = app.listen(port, () => console.log(`API listening on ${port}`));
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Please stop the existing process before starting the server.`);
      } else {
        console.error('Server error:', err.message);
      }
      process.exit(1);
    });
  })
  .catch(err => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  });
