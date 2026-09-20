import mongoose from 'mongoose'
const scheduleSchema = new mongoose.Schema({ subject: String, day: String, startTime: String, endTime: String, room: String })
export default mongoose.model('Schedule', scheduleSchema)
