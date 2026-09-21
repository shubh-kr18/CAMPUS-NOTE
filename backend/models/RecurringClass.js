import mongoose from 'mongoose'

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const recurringClassSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: [true, 'Subject is required.'],
      trim: true
    },
    code: {
      type: String,
      trim: true,
      default: ''
    },
    day: {
      type: String,
      required: [true, 'Day is required.'],
      enum: {
        values: DAYS_OF_WEEK,
        message: '{VALUE} is not a valid day of the week.'
      }
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required.'],
      trim: true
    },
    endTime: {
      type: String,
      required: [true, 'End time is required.'],
      trim: true
    },
    teacher: {
      type: String,
      trim: true,
      default: ''
    },
    room: {
      type: String,
      required: [true, 'Room is required.'],
      trim: true
    },
    batch: {
      type: String,
      trim: true,
      default: 'All'
    },
    isLab: {
      type: Boolean,
      default: false
    },
    semester: {
      type: Number,
      required: [true, 'Semester is required.'],
      min: [1, 'Semester must be at least 1.'],
      max: [10, 'Semester cannot exceed 10.']
    },
    branch: {
      type: String,
      trim: true,
      default: 'General'
    },
    academicSession: {
      type: String,
      trim: true,
      default: 'July-Dec 2026'
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

// Index for performant timetable resolution by cohort and day
recurringClassSchema.index({ branch: 1, semester: 1, day: 1, startTime: 1 })
recurringClassSchema.index({ createdBy: 1 })

// Virtual field "lab" mapping to isLab for flexibility
recurringClassSchema.virtual('lab').get(function () {
  return this.isLab
})

const RecurringClass = mongoose.model('RecurringClass', recurringClassSchema)

export { DAYS_OF_WEEK }
export default RecurringClass
