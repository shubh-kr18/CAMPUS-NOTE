import jwt from 'jsonwebtoken'
import User from '../models/User.js'
export async function protect(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1] || req.query.token
  if (!token) return res.status(401).json({ message: 'Authentication required.' })
  try { req.userId = jwt.verify(token, process.env.JWT_SECRET).id; req.user = await User.findById(req.userId).select('role'); if (!req.user) return res.status(401).json({ message: 'User not found.' }); next() }
  catch { return res.status(401).json({ message: 'Invalid or expired session.' }) }
}
export function canManageNotes(user) { return !(process.env.ADMIN_EMAILS || '').trim() || user?.role === 'admin' }
export function requireAdmin(req, res, next) { if (!canManageNotes(req.user)) return res.status(403).json({ message: 'Only authorized note administrators can upload or delete PDFs.' }); next() }
