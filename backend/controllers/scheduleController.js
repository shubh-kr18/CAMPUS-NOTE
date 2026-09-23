import RecurringClass, { DAYS_OF_WEEK } from '../models/RecurringClass.js'

const fallbackSchedule = [
  { subject: 'Microwave Engineering', code: 'ECE-5002', day: 'Wednesday', startTime: '09:00', endTime: '10:00', teacher: 'PK', room: 'A-204', batch: 'All', isLab: false, semester: 5, branch: 'ECE' },
  { subject: 'VLSI-D', code: 'ECE-5001', day: 'Wednesday', startTime: '10:00', endTime: '11:00', teacher: 'AK', room: 'A-204', batch: 'All', isLab: false, semester: 5, branch: 'ECE' },
  { subject: 'VLSI-D', code: 'ECE-5001', day: 'Wednesday', startTime: '11:00', endTime: '12:00', teacher: 'NSI', room: 'Lab 2', batch: 'Batch-1', isLab: true, semester: 5, branch: 'ECE' }
]

function normalizeDay(day) {
  if (!day || typeof day !== 'string') return ''
  const trimmed = day.trim().toLowerCase()
  const found = DAYS_OF_WEEK.find(d => d.toLowerCase() === trimmed)
  return found || day.trim()
}

/**
 * List all recurring classes with optional filters.
 * Supports: day, semester, branch, batch, isLab, subject, teacher, code.
 * Route: GET /api/schedule
 */
export async function listClasses(req, res, next) {
  try {
    const filter = {}

    if (req.query.day) {
      const norm = normalizeDay(req.query.day)
      if (norm) filter.day = norm
    }
    if (req.query.semester) {
      const sem = parseInt(req.query.semester, 10)
      if (!isNaN(sem)) filter.semester = sem
    }
    if (req.query.branch) {
      filter.branch = req.query.branch.trim()
    }
    if (req.query.batch) {
      filter.batch = req.query.batch.trim()
    }
    if (req.query.isLab !== undefined) {
      filter.isLab = req.query.isLab === 'true'
    } else if (req.query.lab !== undefined) {
      filter.isLab = req.query.lab === 'true'
    }
    if (req.query.subject) {
      filter.subject = new RegExp(req.query.subject.trim(), 'i')
    }
    if (req.query.teacher) {
      filter.teacher = new RegExp(req.query.teacher.trim(), 'i')
    }
    if (req.query.code) {
      filter.code = new RegExp(req.query.code.trim(), 'i')
    }

    let data = await RecurringClass.find(filter)
      .populate('createdBy', 'name email role')
      .sort({ day: 1, startTime: 1 })

    // If requested branch has no classes, fall back to available cohort classes in MongoDB
    if (!data.length && filter.branch) {
      const fallbackFilter = { ...filter }
      delete fallbackFilter.branch
      data = await RecurringClass.find(fallbackFilter)
        .populate('createdBy', 'name email role')
        .sort({ day: 1, startTime: 1 })
    }

    res.json({
      schedule: data.length ? data : fallbackSchedule,
      classes: data,
      count: data.length
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get a single recurring class by ID.
 * Route: GET /api/schedule/:id
 */
export async function getClassById(req, res, next) {
  try {
    const item = await RecurringClass.findById(req.params.id).populate('createdBy', 'name email role')
    if (!item) {
      return res.status(404).json({ message: 'Class not found.' })
    }
    res.json({
      classItem: item,
      schedule: item
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Create a new recurring weekly class.
 * User ID is extracted strictly from req.user._id.
 * Route: POST /api/schedule
 */
export async function createClass(req, res, next) {
  try {
    const userId = req.user._id

    const {
      subject,
      code = '',
      day,
      startTime,
      endTime,
      teacher = '',
      room,
      batch = 'All',
      isLab,
      lab,
      semester,
      branch = 'General',
      academicSession = 'July-Dec 2026'
    } = req.body

    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      return res.status(400).json({ message: 'Subject is required.' })
    }

    const validDay = normalizeDay(day)
    if (!DAYS_OF_WEEK.includes(validDay)) {
      return res.status(400).json({
        message: `Day must be one of: ${DAYS_OF_WEEK.join(', ')}.`
      })
    }

    if (!startTime || typeof startTime !== 'string' || !startTime.trim()) {
      return res.status(400).json({ message: 'Start time is required.' })
    }

    if (!endTime || typeof endTime !== 'string' || !endTime.trim()) {
      return res.status(400).json({ message: 'End time is required.' })
    }

    if (!room || typeof room !== 'string' || !room.trim()) {
      return res.status(400).json({ message: 'Room is required.' })
    }

    const semNumber = parseInt(semester, 10)
    if (isNaN(semNumber) || semNumber < 1 || semNumber > 10) {
      return res.status(400).json({ message: 'Semester must be a valid number between 1 and 10.' })
    }

    const isLabValue =
      typeof isLab === 'boolean'
        ? isLab
        : typeof lab === 'boolean'
        ? lab
        : req.body.type === 'lab'

    const cleanBranch = branch.trim() || 'General'
    const cleanBatch = batch.trim() || 'All'
    const cleanSession = academicSession.trim() || 'July-Dec 2026'
    const cleanStartTime = startTime.trim()
    const cleanEndTime = endTime.trim()
    const cleanRoom = room.trim()

    // Duplicate prevention: avoid inserting duplicate recurring class slot for same cohort/room
    const existing = await RecurringClass.findOne({
      branch: cleanBranch,
      semester: semNumber,
      academicSession: cleanSession,
      day: validDay,
      startTime: cleanStartTime,
      endTime: cleanEndTime,
      batch: cleanBatch,
      room: cleanRoom
    })

    if (existing) {
      return res.status(409).json({
        message: `Class already exists for ${validDay} ${cleanStartTime}-${cleanEndTime} (${cleanRoom}, ${cleanBatch}).`,
        classItem: existing
      })
    }

    const newClass = await RecurringClass.create({
      subject: subject.trim(),
      code: code.trim(),
      day: validDay,
      startTime: cleanStartTime,
      endTime: cleanEndTime,
      teacher: teacher.trim(),
      room: cleanRoom,
      batch: cleanBatch,
      isLab: isLabValue,
      semester: semNumber,
      branch: cleanBranch,
      academicSession: cleanSession,
      createdBy: userId
    })

    res.status(201).json({
      success: true,
      classItem: newClass,
      schedule: newClass
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Update an existing recurring class.
 * User ID is verified from req.user._id.
 * Route: PUT /api/schedule/:id
 */
export async function updateClass(req, res, next) {
  try {
    const userId = req.user._id

    const item = await RecurringClass.findById(req.params.id)
    if (!item) {
      return res.status(404).json({ message: 'Class not found.' })
    }

    // Ownership check: only creator or admin can update
    const isOwner = item.createdBy.toString() === userId.toString()
    const isAdmin = req.user.role === 'admin'
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'You do not have permission to modify this class.' })
    }

    const {
      subject,
      code,
      day,
      startTime,
      endTime,
      teacher,
      room,
      batch,
      isLab,
      lab,
      semester,
      branch,
      academicSession
    } = req.body

    if (subject !== undefined) {
      if (!subject.trim()) return res.status(400).json({ message: 'Subject cannot be empty.' })
      item.subject = subject.trim()
    }

    if (code !== undefined) {
      item.code = code.trim()
    }

    if (day !== undefined) {
      const validDay = normalizeDay(day)
      if (!DAYS_OF_WEEK.includes(validDay)) {
        return res.status(400).json({ message: `Day must be one of: ${DAYS_OF_WEEK.join(', ')}.` })
      }
      item.day = validDay
    }

    if (startTime !== undefined) {
      if (!startTime.trim()) return res.status(400).json({ message: 'Start time cannot be empty.' })
      item.startTime = startTime.trim()
    }

    if (endTime !== undefined) {
      if (!endTime.trim()) return res.status(400).json({ message: 'End time cannot be empty.' })
      item.endTime = endTime.trim()
    }

    if (teacher !== undefined) {
      item.teacher = teacher.trim()
    }

    if (room !== undefined) {
      if (!room.trim()) return res.status(400).json({ message: 'Room cannot be empty.' })
      item.room = room.trim()
    }

    if (batch !== undefined) {
      item.batch = batch.trim() || 'All'
    }

    if (isLab !== undefined) {
      item.isLab = Boolean(isLab)
    } else if (lab !== undefined) {
      item.isLab = Boolean(lab)
    }

    if (semester !== undefined) {
      const semNumber = parseInt(semester, 10)
      if (isNaN(semNumber) || semNumber < 1 || semNumber > 10) {
        return res.status(400).json({ message: 'Semester must be between 1 and 10.' })
      }
      item.semester = semNumber
    }

    if (branch !== undefined) {
      item.branch = branch.trim() || 'General'
    }

    if (academicSession !== undefined) {
      item.academicSession = academicSession.trim() || 'July-Dec 2026'
    }

    await item.save()

    res.json({
      success: true,
      classItem: item,
      schedule: item
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Delete a recurring class.
 * Route: DELETE /api/schedule/:id
 */
export async function deleteClass(req, res, next) {
  try {
    const userId = req.user._id

    const item = await RecurringClass.findById(req.params.id)
    if (!item) {
      return res.status(404).json({ message: 'Class not found.' })
    }

    // Ownership check: only creator or admin can delete
    const isOwner = item.createdBy.toString() === userId.toString()
    const isAdmin = req.user.role === 'admin'
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'You do not have permission to delete this class.' })
    }

    await item.deleteOne()

    res.json({
      success: true,
      message: 'Class deleted successfully.'
    })
  } catch (error) {
    next(error)
  }
}
