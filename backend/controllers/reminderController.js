import AcademicReminder, { REMINDER_CATEGORIES } from '../models/AcademicReminder.js'

function normalizeCategory(cat) {
  if (!cat || typeof cat !== 'string') return ''
  const trimmed = cat.trim().toLowerCase()
  const found = REMINDER_CATEGORIES.find(c => c.toLowerCase() === trimmed)
  return found || trimmed
}

/**
 * List academic reminders with optional filters.
 * Supports: category, semester, branch, date/from/to.
 * Reminders do NOT affect recurring classes.
 * Route: GET /api/schedule/reminders
 */
export async function listReminders(req, res, next) {
  try {
    const filter = {}

    if (req.query.category) {
      const normCat = normalizeCategory(req.query.category)
      if (normCat) filter.category = normCat
    }

    if (req.query.semester) {
      const sem = parseInt(req.query.semester, 10)
      if (!isNaN(sem)) {
        filter.$or = [{ semester: sem }, { semester: { $exists: false } }, { semester: null }]
      }
    }

    if (req.query.branch && req.query.branch !== 'All') {
      filter.$or = filter.$or || []
      filter.$or.push({ branch: req.query.branch.trim() }, { branch: 'All' })
    }

    // Date filtering: support single date, or from/to range
    if (req.query.date) {
      const targetDate = new Date(req.query.date)
      if (!isNaN(targetDate.getTime())) {
        const startOfDay = new Date(targetDate)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(targetDate)
        endOfDay.setHours(23, 59, 59, 999)

        // Reminder falls on this day: startDate <= endOfDay AND (endDate >= startOfDay OR (!endDate AND startDate >= startOfDay))
        filter.$or = [
          { startDate: { $gte: startOfDay, $lte: endOfDay } },
          { startDate: { $lte: endOfDay }, endDate: { $gte: startOfDay } }
        ]
      }
    } else {
      if (req.query.from) {
        const fromDate = new Date(req.query.from)
        if (!isNaN(fromDate.getTime())) {
          filter.$or = [
            { startDate: { $gte: fromDate } },
            { endDate: { $gte: fromDate } }
          ]
        }
      }
      if (req.query.to) {
        const toDate = new Date(req.query.to)
        if (!isNaN(toDate.getTime())) {
          filter.startDate = { ...(filter.startDate || {}), $lte: toDate }
        }
      }
    }

    const data = await AcademicReminder.find(filter)
      .populate('createdBy', 'name email role')
      .sort({ startDate: 1, endDate: 1 })

    res.json({
      success: true,
      reminders: data,
      count: data.length
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get a single academic reminder by ID.
 * Route: GET /api/schedule/reminders/:id
 */
export async function getReminderById(req, res, next) {
  try {
    const item = await AcademicReminder.findById(req.params.id).populate('createdBy', 'name email role')
    if (!item) {
      return res.status(404).json({ message: 'Reminder not found.' })
    }

    res.json({
      success: true,
      reminder: item
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Create a new academic reminder.
 * Reminders must NOT affect recurring classes (affectsClasses is strictly false).
 * User ID is extracted strictly from req.user._id.
 * Route: POST /api/schedule/reminders
 */
export async function createReminder(req, res, next) {
  try {
    const userId = req.user._id

    const {
      title,
      date,
      startDate,
      endDate,
      description = '',
      category = 'general',
      semester,
      branch = 'All',
      academicSession = 'July-Dec 2026'
    } = req.body

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ message: 'Title is required.' })
    }

    // Support either date or startDate
    const dateInput = startDate || date
    if (!dateInput) {
      return res.status(400).json({ message: 'date or startDate is required.' })
    }

    const parsedStart = new Date(dateInput)
    if (isNaN(parsedStart.getTime())) {
      return res.status(400).json({ message: 'Invalid startDate / date format.' })
    }

    let parsedEnd = undefined
    if (endDate) {
      parsedEnd = new Date(endDate)
      if (isNaN(parsedEnd.getTime())) {
        return res.status(400).json({ message: 'Invalid endDate format.' })
      }
      if (parsedEnd < parsedStart) {
        return res.status(400).json({ message: 'End date cannot be earlier than start date.' })
      }
    }

    let semNumber = undefined
    if (semester !== undefined && semester !== null && semester !== '') {
      semNumber = parseInt(semester, 10)
      if (isNaN(semNumber) || semNumber < 1 || semNumber > 10) {
        return res.status(400).json({ message: 'Semester must be between 1 and 10.' })
      }
    }

    const normCat = normalizeCategory(category) || 'general'
    if (!REMINDER_CATEGORIES.includes(normCat)) {
      return res.status(400).json({
        message: `Category must be one of: ${REMINDER_CATEGORIES.join(', ')}.`
      })
    }

    const cleanTitle = title.trim()
    const cleanBranch = typeof branch === 'string' && branch.trim() ? branch.trim() : 'All'
    const cleanSession = typeof academicSession === 'string' && academicSession.trim() ? academicSession.trim() : 'July-Dec 2026'

    // Duplicate prevention: avoid identical reminder for the same title, startDate and semester/cohort
    const existing = await AcademicReminder.findOne({
      title: cleanTitle,
      startDate: parsedStart,
      academicSession: cleanSession,
      semester: semNumber,
      branch: cleanBranch
    })

    if (existing) {
      return res.status(409).json({
        message: `Reminder "${cleanTitle}" already exists for this date.`,
        reminder: existing
      })
    }

    const newReminder = await AcademicReminder.create({
      title: cleanTitle,
      startDate: parsedStart,
      endDate: parsedEnd,
      description: typeof description === 'string' ? description.trim() : '',
      category: normCat,
      semester: semNumber,
      branch: cleanBranch,
      academicSession: cleanSession,
      affectsClasses: false, // Invariant: reminders NEVER cancel or affect classes
      createdBy: userId
    })

    res.status(201).json({
      success: true,
      reminder: newReminder
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Update an academic reminder.
 * Route: PUT /api/schedule/reminders/:id
 */
export async function updateReminder(req, res, next) {
  try {
    const item = await AcademicReminder.findById(req.params.id)
    if (!item) {
      return res.status(404).json({ message: 'Reminder not found.' })
    }

    const isOwner = item.createdBy.toString() === req.user._id.toString()
    const isAdmin = req.user.role === 'admin'
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'You do not have permission to modify this reminder.' })
    }

    const {
      title,
      date,
      startDate,
      endDate,
      description,
      category,
      semester,
      branch,
      academicSession
    } = req.body

    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ message: 'Title cannot be empty.' })
      item.title = title.trim()
    }

    const dateInput = startDate !== undefined ? startDate : date
    let parsedStart = item.startDate
    if (dateInput !== undefined) {
      parsedStart = new Date(dateInput)
      if (isNaN(parsedStart.getTime())) {
        return res.status(400).json({ message: 'Invalid start date / date format.' })
      }
      item.startDate = parsedStart
    }

    let parsedEnd = item.endDate
    if (endDate !== undefined) {
      if (endDate === null || endDate === '') {
        item.endDate = undefined
        parsedEnd = undefined
      } else {
        parsedEnd = new Date(endDate)
        if (isNaN(parsedEnd.getTime())) {
          return res.status(400).json({ message: 'Invalid endDate format.' })
        }
        item.endDate = parsedEnd
      }
    }

    if (parsedEnd && parsedEnd < parsedStart) {
      return res.status(400).json({ message: 'End date cannot be earlier than start date.' })
    }

    if (description !== undefined) {
      item.description = typeof description === 'string' ? description.trim() : ''
    }

    if (category !== undefined) {
      const normCat = normalizeCategory(category)
      if (!REMINDER_CATEGORIES.includes(normCat)) {
        return res.status(400).json({
          message: `Category must be one of: ${REMINDER_CATEGORIES.join(', ')}.`
        })
      }
      item.category = normCat
    }

    if (semester !== undefined) {
      if (semester === null || semester === '') {
        item.semester = undefined
      } else {
        const semNumber = parseInt(semester, 10)
        if (isNaN(semNumber) || semNumber < 1 || semNumber > 10) {
          return res.status(400).json({ message: 'Semester must be between 1 and 10.' })
        }
        item.semester = semNumber
      }
    }

    if (branch !== undefined) {
      item.branch = typeof branch === 'string' && branch.trim() ? branch.trim() : 'All'
    }

    if (academicSession !== undefined) {
      item.academicSession = typeof academicSession === 'string' && academicSession.trim() ? academicSession.trim() : 'July-Dec 2026'
    }

    // Explicitly guarantee affectsClasses remains false
    item.affectsClasses = false

    await item.save()

    res.json({
      success: true,
      reminder: item
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Delete an academic reminder.
 * Route: DELETE /api/schedule/reminders/:id
 */
export async function deleteReminder(req, res, next) {
  try {
    const item = await AcademicReminder.findById(req.params.id)
    if (!item) {
      return res.status(404).json({ message: 'Reminder not found.' })
    }

    const isOwner = item.createdBy.toString() === req.user._id.toString()
    const isAdmin = req.user.role === 'admin'
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'You do not have permission to delete this reminder.' })
    }

    await item.deleteOne()

    res.json({
      success: true,
      message: 'Reminder deleted successfully.'
    })
  } catch (error) {
    next(error)
  }
}
