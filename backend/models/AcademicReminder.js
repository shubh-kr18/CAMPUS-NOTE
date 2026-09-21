import mongoose from 'mongoose'

export const REMINDER_CATEGORIES = [
  'assignment',
  'quiz',
  'exam',
  'project',
  'fee',
  'registration',
  'event',
  'general'
]

const academicReminderSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required.'],
      trim: true
    },
    startDate: {
      type: Date,
      required: [true, 'Start date / date is required.']
    },
    endDate: {
      type: Date
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    category: {
      type: String,
      enum: {
        values: REMINDER_CATEGORIES,
        message: '{VALUE} is not a valid reminder category. Supported: ' + REMINDER_CATEGORIES.join(', ')
      },
      default: 'general',
      lowercase: true,
      trim: true
    },
    semester: {
      type: Number,
      min: [1, 'Semester must be at least 1.'],
      max: [10, 'Semester cannot exceed 10.']
    },
    branch: {
      type: String,
      trim: true,
      default: 'All'
    },
    academicSession: {
      type: String,
      trim: true,
      default: 'July-Dec 2026'
    },
    // Explicit immutable guarantee: academic reminders do NOT affect recurring classes
    affectsClasses: {
      type: Boolean,
      default: false,
      immutable: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator user ID is required.']
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
)

// Virtual alias 'date' for startDate for API ergonomics
academicReminderSchema.virtual('date')
  .get(function () {
    return this.startDate
  })
  .set(function (val) {
    this.startDate = val
  })

academicReminderSchema.index({ startDate: 1, endDate: 1 })
academicReminderSchema.index({ category: 1, startDate: 1 })
academicReminderSchema.index({ semester: 1, branch: 1 })
academicReminderSchema.index({ createdBy: 1 })

const AcademicReminder = mongoose.model('AcademicReminder', academicReminderSchema)

export default AcademicReminder
