import ScheduleOverride, { OVERRIDE_TYPES } from '../models/ScheduleOverride.js'

function normalizeType(type) {
  if (!type || typeof type !== 'string') return ''
  const trimmed = type.trim().toLowerCase()
  const found = OVERRIDE_TYPES.find(t => t.toLowerCase() === trimmed)
  return found || trimmed
}

/**
 * List all schedule/calendar overrides with optional filtering.
 * Supports filtering by type, affectsClasses, date range (from, to, date), branch, semester.
 * Route: GET /api/schedule/overrides
 */
export async function listOverrides(req, res, next) {
  try {
    const filter = {}

    if (req.query.type) {
      const normType = normalizeType(req.query.type)
      if (normType) filter.type = normType
    }

    if (req.query.affectsClasses !== undefined) {
      filter.affectsClasses = req.query.affectsClasses === 'true'
    }

    if (req.query.branch && req.query.branch !== 'All') {
      filter.$or = [{ branch: req.query.branch.trim() }, { branch: 'All' }]
    }

    if (req.query.semester) {
      const sem = parseInt(req.query.semester, 10)
      if (!isNaN(sem)) {
        filter.$or = filter.$or || []
        filter.$or.push({ semester: sem }, { semester: { $exists: false } }, { semester: null })
      }
    }

    // Date filtering
    if (req.query.date) {
      const targetDate = new Date(req.query.date)
      if (!isNaN(targetDate.getTime())) {
        const startOfDay = new Date(targetDate)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(targetDate)
        endOfDay.setHours(23, 59, 59, 999)

        // Override spans this target date: startDate <= endOfDay AND endDate >= startOfDay
        filter.startDate = { $lte: endOfDay }
        filter.endDate = { $gte: startOfDay }
      }
    } else {
      if (req.query.from) {
        const fromDate = new Date(req.query.from)
        if (!isNaN(fromDate.getTime())) {
          filter.endDate = { $gte: fromDate }
        }
      }
      if (req.query.to) {
        const toDate = new Date(req.query.to)
        if (!isNaN(toDate.getTime())) {
          filter.startDate = { ...(filter.startDate || {}), $lte: toDate }
        }
      }
    }

    const data = await ScheduleOverride.find(filter)
      .populate('createdBy', 'name email role')
      .populate('classId', 'subject code day startTime endTime room teacher')
      .sort({ startDate: 1, endDate: 1 })

    res.json({
      success: true,
      overrides: data,
      count: data.length
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get single override by ID.
 * Route: GET /api/schedule/overrides/:id
 */
export async function getOverrideById(req, res, next) {
  try {
    const item = await ScheduleOverride.findById(req.params.id)
      .populate('createdBy', 'name email role')
      .populate('classId', 'subject code day startTime endTime room teacher')

    if (!item) {
      return res.status(404).json({ message: 'Override not found.' })
    }

    res.json({
      success: true,
      override: item
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Create a new calendar/class override.
 * User ID is extracted strictly from req.user._id.
 * Route: POST /api/schedule/overrides
 */
export async function createOverride(req, res, next) {
  try {
    const userId = req.user._id

    const {
      title,
      type,
      startDate,
      endDate,
      description = '',
      affectsClasses = true,
      branch = 'All',
      semester,
      academicSession = 'July-Dec 2026',
      classId
    } = req.body

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ message: 'Title is required.' })
    }

    const normType = normalizeType(type)
    if (!OVERRIDE_TYPES.includes(normType)) {
      return res.status(400).json({
        message: `Type must be one of: ${OVERRIDE_TYPES.join(', ')}.`
      })
    }

    if (!startDate) {
      return res.status(400).json({ message: 'Start date is required.' })
    }
    const parsedStart = new Date(startDate)
    if (isNaN(parsedStart.getTime())) {
      return res.status(400).json({ message: 'Invalid start date format.' })
    }

    if (!endDate) {
      return res.status(400).json({ message: 'End date is required.' })
    }
    const parsedEnd = new Date(endDate)
    if (isNaN(parsedEnd.getTime())) {
      return res.status(400).json({ message: 'Invalid end date format.' })
    }

    if (parsedEnd < parsedStart) {
      return res.status(400).json({ message: 'End date cannot be earlier than start date.' })
    }

    const cleanTitle = title.trim()
    const cleanSession = typeof academicSession === 'string' && academicSession.trim() ? academicSession.trim() : 'July-Dec 2026'
    const cleanBranch = typeof branch === 'string' && branch.trim() ? branch.trim() : 'All'
    const semNumber = semester ? parseInt(semester, 10) : undefined

    // Duplicate prevention: avoid identical override for the same date/session
    const existing = await ScheduleOverride.findOne({
      title: cleanTitle,
      type: normType,
      startDate: parsedStart,
      academicSession: cleanSession
    })

    if (existing) {
      return res.status(409).json({
        message: `Override "${cleanTitle}" already exists for this date.`,
        override: existing
      })
    }

    const newOverride = await ScheduleOverride.create({
      title: cleanTitle,
      type: normType,
      startDate: parsedStart,
      endDate: parsedEnd,
      description: typeof description === 'string' ? description.trim() : '',
      affectsClasses: Boolean(affectsClasses),
      branch: cleanBranch,
      semester: semNumber,
      academicSession: cleanSession,
      classId: classId || undefined,
      createdBy: userId
    })

    res.status(201).json({
      success: true,
      override: newOverride
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Update an existing calendar/class override.
 * Route: PUT /api/schedule/overrides/:id
 */
export async function updateOverride(req, res, next) {
  try {
    const item = await ScheduleOverride.findById(req.params.id)
    if (!item) {
      return res.status(404).json({ message: 'Override not found.' })
    }

    const isOwner = item.createdBy.toString() === req.user._id.toString()
    const isAdmin = req.user.role === 'admin'
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'You do not have permission to modify this override.' })
    }

    const {
      title,
      type,
      startDate,
      endDate,
      description,
      affectsClasses,
      branch,
      semester,
      academicSession,
      classId
    } = req.body

    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ message: 'Title cannot be empty.' })
      item.title = title.trim()
    }

    if (type !== undefined) {
      const normType = normalizeType(type)
      if (!OVERRIDE_TYPES.includes(normType)) {
        return res.status(400).json({
          message: `Type must be one of: ${OVERRIDE_TYPES.join(', ')}.`
        })
      }
      item.type = normType
    }

    let parsedStart = item.startDate
    if (startDate !== undefined) {
      parsedStart = new Date(startDate)
      if (isNaN(parsedStart.getTime())) {
        return res.status(400).json({ message: 'Invalid start date format.' })
      }
      item.startDate = parsedStart
    }

    let parsedEnd = item.endDate
    if (endDate !== undefined) {
      parsedEnd = new Date(endDate)
      if (isNaN(parsedEnd.getTime())) {
        return res.status(400).json({ message: 'Invalid end date format.' })
      }
      item.endDate = parsedEnd
    }

    if (parsedEnd < parsedStart) {
      return res.status(400).json({ message: 'End date cannot be earlier than start date.' })
    }

    if (description !== undefined) {
      item.description = typeof description === 'string' ? description.trim() : ''
    }

    if (affectsClasses !== undefined) {
      item.affectsClasses = Boolean(affectsClasses)
    }

    if (branch !== undefined) {
      item.branch = typeof branch === 'string' && branch.trim() ? branch.trim() : 'All'
    }

    if (semester !== undefined) {
      const sem = parseInt(semester, 10)
      item.semester = isNaN(sem) ? undefined : sem
    }

    if (academicSession !== undefined) {
      item.academicSession = typeof academicSession === 'string' && academicSession.trim() ? academicSession.trim() : 'July-Dec 2026'
    }

    if (classId !== undefined) {
      item.classId = classId || undefined
    }

    await item.save()

    res.json({
      success: true,
      override: item
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Delete a calendar/class override.
 * Route: DELETE /api/schedule/overrides/:id
 */
export async function deleteOverride(req, res, next) {
  try {
    const item = await ScheduleOverride.findById(req.params.id)
    if (!item) {
      return res.status(404).json({ message: 'Override not found.' })
    }

    const isOwner = item.createdBy.toString() === req.user._id.toString()
    const isAdmin = req.user.role === 'admin'
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'You do not have permission to delete this override.' })
    }

    await item.deleteOne()

    res.json({
      success: true,
      message: 'Override deleted successfully.'
    })
  } catch (error) {
    next(error)
  }
}
