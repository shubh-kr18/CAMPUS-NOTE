import mongoose from 'mongoose'
const noteSchema = new mongoose.Schema({ title: { type: String, required: true, trim: true }, subject: { type: String, required: true, trim: true }, description: { type: String, trim: true, maxlength: 500 }, fileUrl: { type: String, required: true }, originalName: String, fileSize: { type: Number, required: true }, uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true } }, { timestamps: true })
noteSchema.index({ title: 1, subject: 1 }, { unique: true })
export default mongoose.model('Note', noteSchema)
