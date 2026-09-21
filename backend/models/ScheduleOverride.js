import mongoose from 'mongoose'

export const OVERRIDE_TYPES = [
  'holiday',
  'exam',
  'break',
  'cancellation',
  'special class'
]

const scheduleOverrideSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required.'],
      trim: true
    },
    type: {
      type: String,
      required: [true, 'Type is required.'],
      enum: {
        values: OVERRIDE_TYPES,
        message: '{VALUE} is not a valid override type. Supported: ' + OVERRIDE_TYPES.join(', ')
      },
      lowercase: true,
      trim: true
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required.']
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required.']
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    affectsClasses: {
      type: Boolean,
      default: true
    },
    branch: {
      type: String,
      trim: true,
      default: 'All'
    },
    semester: {
      type: Number,
      min: 1,
      max: 10
    },
    academicSession: {
      type: String,
      trim: true,
      default: 'July-Dec 2026'
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RecurringClass'
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

scheduleOverrideSchema.index({ startDate: 1, endDate: 1 })
scheduleOverrideSchema.index({ type: 1, startDate: 1 })
scheduleOverrideSchema.index({ createdBy: 1 })

const ScheduleOverride = mongoose.model('ScheduleOverride', scheduleOverrideSchema)

export default ScheduleOverride
