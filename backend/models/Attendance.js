import mongoose from 'mongoose'
const attendanceSchema = new mongoose.Schema({ student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, subject: String, attendedClasses: Number, totalClasses: Number, percentage: Number })
export default mongoose.model('Attendance', attendanceSchema)
