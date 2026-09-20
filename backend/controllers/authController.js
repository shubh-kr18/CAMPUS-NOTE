import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
const tokenFor = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' })
const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email, branch: user.branch, graduationYear: user.graduationYear, role: user.role || 'student' })
const isAdminEmail = (email) => (process.env.ADMIN_EMAILS || '').split(',').map(item => item.trim().toLowerCase()).includes(email.toLowerCase())
export async function register(req, res, next) { try {
  const { name, email, password, branch, graduationYear } = req.body
  if (!name || !email || !password || !branch || !graduationYear) return res.status(400).json({ message: 'Please complete every field.' })
  if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters.' })
  if (await User.findOne({ email })) return res.status(409).json({ message: 'An account with this email already exists.' })
  const user = await User.create({ name, email, password: await bcrypt.hash(password, 12), branch, graduationYear, role: isAdminEmail(email) ? 'admin' : 'student' })
  res.status(201).json({ token: tokenFor(user._id), user: publicUser(user) })
} catch (err) { next(err) } }
export async function login(req, res, next) { try {
  const { email, password } = req.body; const user = await User.findOne({ email }).select('+password')
  if (!user || !(await bcrypt.compare(password || '', user.password))) return res.status(401).json({ message: 'Invalid email or password.' })
  if (isAdminEmail(user.email) && user.role !== 'admin') { user.role = 'admin'; await user.save() }
  res.json({ token: tokenFor(user._id), user: publicUser(user) })
} catch (err) { next(err) } }
export async function me(req, res, next) { try { const user = await User.findById(req.userId); if (!user) return res.status(404).json({ message: 'User not found.' }); res.json({ user: publicUser(user) }) } catch (err) { next(err) } }
