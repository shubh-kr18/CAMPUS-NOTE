import mongoose from 'mongoose'
const clubSchema = new mongoose.Schema({ name: String, category: String, description: String, image: String, contact: String })
export default mongoose.model('Club', clubSchema)
