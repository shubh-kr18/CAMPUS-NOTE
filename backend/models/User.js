import mongoose from 'mongoose'
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true }, email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false }, branch: { type: String, required: true }, graduationYear: { type: Number, required: true },
  role: { type: String, enum: ['student', 'admin'], default: 'student' }
}, { timestamps: true })
export default mongoose.model('User', userSchema)
