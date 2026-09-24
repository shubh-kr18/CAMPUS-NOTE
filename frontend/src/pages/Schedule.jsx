import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  User,
  Coffee,
  AlertCircle,
  Bell,
  Sparkles,
  Layers,
  FlaskConical,
  GraduationCap,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  CalendarPlus,
  BellPlus,
  RotateCcw,
  FileText,
  CreditCard,
  Award,
  AlertTriangle,
  CheckCircle2,
  Sun
} from 'lucide-react'
import { api } from '../services/api'

const DAYS_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Odd Semester 2026 Teaching Instruction Period
export const RECURRING_CLASSES_START_ISO = '2026-07-06'
export const RECURRING_CLASSES_END_ISO = '2026-10-23'

function formatIsoDate(d) {
  if (!d) return ''
  if (typeof d === 'string') return d.split('T')[0]
  if (d instanceof Date && !isNaN(d.getTime())) {
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0 && d.getTimezoneOffset() !== 0) {
      const year = d.getUTCFullYear()
      const month = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return ''
}

function parseTimeToMinutes(t) {
  if (!t || typeof t !== 'string') return 0
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function formatMinutesToTime(mins) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Returns color tokens and icons for schedule override types
 */
function getOverrideBadgeStyle(type) {
  switch (type?.toLowerCase()) {
    case 'exam':
      return {
        border: 'border-violet-500/30',
        bg: 'bg-violet-500/10',
        cardBg: 'bg-gradient-to-br from-violet-950/30 via-[#181524] to-[#121418]',
        text: 'text-violet-300',
        badgeBg: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
        icon: GraduationCap,
        name: 'Exam'
      }
    case 'break':
      return {
        border: 'border-emerald-500/30',
        bg: 'bg-emerald-500/10',
        cardBg: 'bg-gradient-to-br from-emerald-950/30 via-[#14211a] to-[#121418]',
        text: 'text-emerald-300',
        badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        icon: Coffee,
        name: 'Academic Break'
      }
    case 'cancellation':
      return {
        border: 'border-rose-500/30',
        bg: 'bg-rose-500/10',
        cardBg: 'bg-gradient-to-br from-rose-950/30 via-[#231418] to-[#121418]',
        text: 'text-rose-300',
        badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        icon: AlertTriangle,
        name: 'Cancellation'
      }
    case 'holiday':
    default:
      return {
        border: 'border-amber-400/30',
        bg: 'bg-amber-400/10',
        cardBg: 'bg-gradient-to-br from-amber-950/30 via-[#231e14] to-[#121418]',
        text: 'text-amber-300',
        badgeBg: 'bg-amber-400/20 text-amber-300 border-amber-400/40',
        icon: Sparkles,
        name: 'Holiday'
      }
  }
}

/**
 * Returns color tokens and icons for academic reminder categories
 */
function getReminderCategoryStyle(category) {
  switch (category?.toLowerCase()) {
    case 'exam':
      return {
        border: 'border-violet-500/30',
        bg: 'bg-violet-500/15',
        text: 'text-violet-300',
        icon: FileText
      }
    case 'fee':
      return {
        border: 'border-amber-500/30',
        bg: 'bg-amber-500/15',
        text: 'text-amber-300',
        icon: CreditCard
      }
    case 'registration':
      return {
        border: 'border-sky-500/30',
        bg: 'bg-sky-500/15',
        text: 'text-sky-300',
        icon: Award
      }
    case 'result':
      return {
        border: 'border-emerald-500/30',
        bg: 'bg-emerald-500/15',
        text: 'text-emerald-300',
        icon: CheckCircle2
      }
    case 'event':
      return {
        border: 'border-fuchsia-500/30',
        bg: 'bg-fuchsia-500/15',
        text: 'text-fuchsia-300',
        icon: Sparkles
      }
    case 'holiday':
      return {
        border: 'border-amber-400/30',
        bg: 'bg-amber-400/15',
        text: 'text-amber-300',
        icon: Sun
      }
    default:
      return {
        border: 'border-indigo-400/30',
        bg: 'bg-indigo-500/15',
        text: 'text-indigo-300',
        icon: Bell
      }
  }
}

export default function Schedule() {
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('campus_user') || localStorage.getItem('user') || '{}')
    } catch {
      return {}
    }
  }, [])

  // Core data states
  const [recurringClasses, setRecurringClasses] = useState([])
  const [overrides, setOverrides] = useState([])
  const [reminders, setReminders] = useState([])

  // UI state
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [viewMode, setViewMode] = useState('daily') // 'daily' | 'week'
  const [selectedBatch, setSelectedBatch] = useState('All') // 'All' | 'Batch-1' | 'Batch-2'

  // Notification banners (success / error)
  const [actionSuccess, setActionSuccess] = useState('')
  const [actionError, setActionError] = useState('')

  // Selected date (Defaults to today if within teaching period 06 July - 23 October 2026, else July 16, 2026)
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date()
    const nowIso = formatIsoDate(now)
    if (nowIso >= RECURRING_CLASSES_START_ISO && nowIso <= RECURRING_CLASSES_END_ISO) {
      return now
    }
    return new Date(2026, 6, 16, 12, 0, 0)
  })

  // Management Modal Visibility States
  const [classModalOpen, setClassModalOpen] = useState(false)
  const [overrideModalOpen, setOverrideModalOpen] = useState(false)
  const [reminderModalOpen, setReminderModalOpen] = useState(false)

  // Target item being edited (null = adding new)
  const [editingClass, setEditingClass] = useState(null)
  const [editingOverride, setEditingOverride] = useState(null)
  const [editingReminder, setEditingReminder] = useState(null)

  // Form input states
  const [classForm, setClassForm] = useState({
    subject: '',
    code: '',
    teacher: '',
    room: '',
    day: 'Monday',
    startTime: '09:00',
    endTime: '09:55',
    isLab: false,
    lab: '',
    batch: 'All',
    branch: user.branch || 'ECE',
    semester: 5
  })

  const [overrideForm, setOverrideForm] = useState({
    title: '',
    date: formatIsoDate(new Date(2026, 6, 16)),
    endDate: '',
    type: 'holiday',
    affectsClasses: true,
    description: '',
    semester: 5,
    branch: 'All'
  })

  const [reminderForm, setReminderForm] = useState({
    title: '',
    date: formatIsoDate(new Date(2026, 6, 16)),
    category: 'general',
    description: '',
    semester: 5,
    branch: 'All'
  })

  const [submitting, setSubmitting] = useState(false)

  // Fetch all recurring classes, overrides, and reminders from backend APIs
  const fetchScheduleData = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    const branch = 'ECE'
    const semester = 5 // Default semester V for this cohort

    try {
      const [classRes, overrideRes, reminderRes] = await Promise.all([
        api(`/schedule?branch=${branch}&semester=${semester}`),
        api(`/schedule/overrides`),
        api(`/schedule/reminders?semester=${semester}`)
      ])

      const classesList = classRes.classes?.length ? classRes.classes : classRes.schedule || []
      setRecurringClasses(classesList)
      setOverrides(overrideRes.overrides || [])
      setReminders(reminderRes.reminders || [])
    } catch (err) {
      console.error('Schedule fetch error:', err)
      setFetchError(err.message || 'Unable to connect to the schedule server. Please verify your connection.')
    } finally {
      setLoading(false)
    }
  }, [user.branch])

  useEffect(() => {
    fetchScheduleData()
  }, [fetchScheduleData])

  // Clear banner alerts after 6 seconds
  useEffect(() => {
    if (actionSuccess || actionError) {
      const timer = setTimeout(() => {
        setActionSuccess('')
        setActionError('')
      }, 6000)
      return () => clearTimeout(timer)
    }
  }, [actionSuccess, actionError])

  // ============================================================
  // HANDLERS FOR RECURRING CLASSES
  // ============================================================
  const handleOpenAddClass = (defaultDay) => {
    setEditingClass(null)
    setClassForm({
      subject: '',
      code: '',
      teacher: '',
      room: '',
      day: defaultDay || dayName || 'Monday',
      startTime: '09:00',
      endTime: '09:55',
      isLab: false,
      lab: '',
      batch: selectedBatch === 'All' ? 'All' : selectedBatch,
      branch: user.branch || 'ECE',
      semester: 5
    })
    setClassModalOpen(true)
  }

  const handleOpenEditClass = (classItem) => {
    setEditingClass(classItem)
    setClassForm({
      subject: classItem.subject || '',
      code: classItem.code || '',
      teacher: classItem.teacher || '',
      room: classItem.room || '',
      day: classItem.day || 'Monday',
      startTime: classItem.startTime || '09:00',
      endTime: classItem.endTime || '09:55',
      isLab: Boolean(classItem.isLab || classItem.lab),
      lab: classItem.lab || (classItem.isLab ? classItem.subject : ''),
      batch: classItem.batch || 'All',
      branch: classItem.branch || user.branch || 'ECE',
      semester: classItem.semester || 5
    })
    setClassModalOpen(true)
  }

  const handleSubmitClass = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setActionError('')
    try {
      const payload = {
        ...classForm,
        semester: Number(classForm.semester),
        lab: classForm.isLab ? (classForm.lab || classForm.subject) : null
      }

      if (editingClass) {
        await api(`/schedule/${editingClass._id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
        setActionSuccess(`Updated class "${payload.subject}".`)
      } else {
        await api(`/schedule`, {
          method: 'POST',
          body: JSON.stringify(payload)
        })
        setActionSuccess(`Added new class "${payload.subject}".`)
      }

      setClassModalOpen(false)
      await fetchScheduleData()
    } catch (err) {
      setActionError(err.message || 'Failed to save class.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteClass = async (classItem) => {
    if (!window.confirm(`Are you sure you want to delete "${classItem.subject}" (${classItem.day} ${classItem.startTime})?`)) {
      return
    }
    setActionError('')
    try {
      await api(`/schedule/${classItem._id}`, {
        method: 'DELETE'
      })
      setActionSuccess(`Deleted class "${classItem.subject}".`)
      await fetchScheduleData()
    } catch (err) {
      setActionError(err.message || 'Failed to delete class.')
    }
  }

  // ============================================================
  // HANDLERS FOR CALENDAR OVERRIDES
  // ============================================================
  const handleOpenAddOverride = () => {
    setEditingOverride(null)
    setOverrideForm({
      title: '',
      date: formatIsoDate(selectedDate),
      endDate: '',
      type: 'holiday',
      affectsClasses: true,
      description: '',
      semester: 5,
      branch: 'All'
    })
    setOverrideModalOpen(true)
  }

  const handleOpenEditOverride = (overrideItem) => {
    setEditingOverride(overrideItem)
    const rawStart = overrideItem.startDate || overrideItem.date
    const startDateIso = rawStart ? rawStart.split('T')[0] : formatIsoDate(selectedDate)
    const rawEnd = overrideItem.endDate || overrideItem.startDate || overrideItem.date
    const endDateIso = rawEnd ? rawEnd.split('T')[0] : ''
    setOverrideForm({
      title: overrideItem.title || '',
      date: startDateIso,
      endDate: endDateIso,
      type: overrideItem.type || 'holiday',
      affectsClasses: overrideItem.affectsClasses !== false,
      description: overrideItem.description || '',
      semester: overrideItem.semester || 5,
      branch: overrideItem.branch || 'All'
    })
    setOverrideModalOpen(true)
  }

  const handleSubmitOverride = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setActionError('')
    try {
      const payload = {
        ...overrideForm,
        startDate: overrideForm.date,
        endDate: overrideForm.endDate ? overrideForm.endDate : overrideForm.date
      }

      if (editingOverride) {
        await api(`/schedule/overrides/${editingOverride._id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
        setActionSuccess(`Updated override "${payload.title}".`)
      } else {
        await api(`/schedule/overrides`, {
          method: 'POST',
          body: JSON.stringify(payload)
        })
        setActionSuccess(`Created override "${payload.title}".`)
      }

      setOverrideModalOpen(false)
      await fetchScheduleData()
    } catch (err) {
      setActionError(err.message || 'Failed to save override.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteOverride = async (overrideItem) => {
    if (!window.confirm(`Delete calendar override "${overrideItem.title}"?`)) {
      return
    }
    setActionError('')
    try {
      await api(`/schedule/overrides/${overrideItem._id}`, {
        method: 'DELETE'
      })
      setActionSuccess(`Deleted override "${overrideItem.title}".`)
      await fetchScheduleData()
    } catch (err) {
      setActionError(err.message || 'Failed to delete override.')
    }
  }

  // ============================================================
  // HANDLERS FOR ACADEMIC REMINDERS
  // ============================================================
  const handleOpenAddReminder = () => {
    setEditingReminder(null)
    setReminderForm({
      title: '',
      date: formatIsoDate(selectedDate),
      category: 'general',
      description: '',
      semester: 5,
      branch: 'All'
    })
    setReminderModalOpen(true)
  }

  const handleOpenEditReminder = (reminderItem) => {
    setEditingReminder(reminderItem)
    const rawDate = reminderItem.startDate || reminderItem.date
    const dateIso = rawDate ? rawDate.split('T')[0] : formatIsoDate(selectedDate)
    setReminderForm({
      title: reminderItem.title || '',
      date: dateIso,
      category: reminderItem.category || 'general',
      description: reminderItem.description || '',
      semester: reminderItem.semester || 5,
      branch: reminderItem.branch || 'All'
    })
    setReminderModalOpen(true)
  }

  const handleSubmitReminder = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setActionError('')
    try {
      const payload = {
        ...reminderForm,
        startDate: reminderForm.date
      }

      if (editingReminder) {
        await api(`/schedule/reminders/${editingReminder._id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
        setActionSuccess(`Updated reminder "${payload.title}".`)
      } else {
        await api(`/schedule/reminders`, {
          method: 'POST',
          body: JSON.stringify(payload)
        })
        setActionSuccess(`Created reminder "${payload.title}".`)
      }

      setReminderModalOpen(false)
      await fetchScheduleData()
    } catch (err) {
      setActionError(err.message || 'Failed to save reminder.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteReminder = async (reminderItem) => {
    if (!window.confirm(`Delete reminder "${reminderItem.title}"?`)) {
      return
    }
    setActionError('')
    try {
      await api(`/schedule/reminders/${reminderItem._id}`, {
        method: 'DELETE'
      })
      setActionSuccess(`Deleted reminder "${reminderItem.title}".`)
      await fetchScheduleData()
    } catch (err) {
      setActionError(err.message || 'Failed to delete reminder.')
    }
  }

  // ============================================================
  // DATE CALCULATION & NAVIGATION
  // ============================================================
  const formattedSelectedIso = useMemo(() => formatIsoDate(selectedDate), [selectedDate])

  const dayName = useMemo(() => {
    const [y, m, d] = formattedSelectedIso.split('-').map(Number)
    return DAYS_ORDER[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  }, [formattedSelectedIso])

  const friendlyDateString = useMemo(() => {
    if (!formattedSelectedIso) return ''
    const [y, m, d] = formattedSelectedIso.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
    })
  }, [formattedSelectedIso])

  const isToday = useMemo(() => {
    return formattedSelectedIso === formatIsoDate(new Date())
  }, [formattedSelectedIso])

  const isWeekend = useMemo(() => {
    const [y, m, d] = formattedSelectedIso.split('-').map(Number)
    const dDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
    return dDay === 0 || dDay === 6
  }, [formattedSelectedIso])

  // Monday–Friday days of the currently selected week
  const weekDays = useMemo(() => {
    const [selY, selM, selD] = formattedSelectedIso.split('-').map(Number)
    const currentDay = new Date(Date.UTC(selY, selM - 1, selD)).getUTCDay()
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay

    const monday = new Date(Date.UTC(selY, selM - 1, selD + diffToMonday))

    const days = []
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

    for (let i = 0; i < 5; i++) {
      const d = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + i))
      const year = d.getUTCFullYear()
      const month = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      const iso = `${year}-${month}-${day}`
      const todayIso = formatIsoDate(new Date())

      days.push({
        date: new Date(year, d.getUTCMonth(), d.getUTCDate(), 12, 0, 0),
        iso,
        dayName: DAYS_ORDER[d.getUTCDay()],
        label: dayLabels[i],
        dayNumber: d.getUTCDate(),
        monthShort: d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
        isToday: iso === todayIso,
        isSelected: iso === formattedSelectedIso
      })
    }
    return days
  }, [formattedSelectedIso])

  const handlePrevDay = () => {
    const next = new Date(selectedDate)
    if (viewMode === 'week') {
      next.setDate(next.getDate() - 7)
    } else {
      next.setDate(next.getDate() - 1)
    }
    setSelectedDate(next)
  }

  const handleNextDay = () => {
    const next = new Date(selectedDate)
    if (viewMode === 'week') {
      next.setDate(next.getDate() + 7)
    } else {
      next.setDate(next.getDate() + 1)
    }
    setSelectedDate(next)
  }

  const handleToday = () => {
    const now = new Date()
    const nowIso = formatIsoDate(now)
    if (nowIso >= RECURRING_CLASSES_START_ISO && nowIso <= RECURRING_CLASSES_END_ISO) {
      setSelectedDate(now)
    } else {
      setSelectedDate(new Date(2026, 6, 16, 12, 0, 0))
    }
  }

  const handleNextMonday = () => {
    const [y, m, d] = formattedSelectedIso.split('-').map(Number)
    const currentDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
    const daysUntilMonday = currentDay === 0 ? 1 : 8 - currentDay
    setSelectedDate(new Date(y, m - 1, d + daysUntilMonday, 12, 0, 0))
  }

  const handleDateChange = (e) => {
    if (!e.target.value) return
    const [y, m, d] = e.target.value.split('-').map(Number)
    setSelectedDate(new Date(y, m - 1, d, 12, 0, 0))
  }

  // Check if selected date falls within Odd Semester 2026 teaching period (06 July 2026 to 23 October 2026)
  const isWithinTeachingPeriod = useMemo(() => {
    return formattedSelectedIso >= RECURRING_CLASSES_START_ISO && formattedSelectedIso <= RECURRING_CLASSES_END_ISO
  }, [formattedSelectedIso])

  const isAfterTeachingEnd = useMemo(() => {
    return formattedSelectedIso > RECURRING_CLASSES_END_ISO
  }, [formattedSelectedIso])

  // Active academic reminders for this date
  const activeReminders = useMemo(() => {
    return reminders.filter((r) => {
      const start = formatIsoDate(r.startDate || r.date)
      const end = formatIsoDate(r.endDate || r.startDate || r.date)
      return Boolean(start) && formattedSelectedIso >= start && formattedSelectedIso <= end
    })
  }, [reminders, formattedSelectedIso])

  // Class-affecting override (holiday/exam/break) for this date
  const classAffectingOverride = useMemo(() => {
    return overrides.find((o) => {
      if (!o.affectsClasses || o.affectsClasses === 'false') return false
      // Only match overrides applicable to this cohort
      const normBranch = (o.branch || 'All').trim().toLowerCase()
      if (normBranch !== 'all' && normBranch !== 'ece') return false
      if (o.semester && Number(o.semester) !== 5) return false
      // Single class-level override does not suspend the full day
      if (o.classId) return false

      const startDate = formatIsoDate(o.startDate || o.date)
      const endDate = formatIsoDate(o.endDate || o.startDate || o.date)
      return Boolean(startDate) && formattedSelectedIso >= startDate && formattedSelectedIso <= endDate
    })
  }, [overrides, formattedSelectedIso])

  // Applicable semester events, exams, and breaks for the selected date
  const applicableSemesterEvents = useMemo(() => {
    const list = []
    overrides.forEach((o) => {
      const start = formatIsoDate(o.startDate || o.date)
      const end = formatIsoDate(o.endDate || o.startDate || o.date)
      if (Boolean(start) && formattedSelectedIso >= start && formattedSelectedIso <= end) {
        list.push({
          ...o,
          isOverride: true,
          itemType: o.type || 'event'
        })
      }
    })
    reminders.forEach((r) => {
      const start = formatIsoDate(r.startDate || r.date)
      const end = formatIsoDate(r.endDate || r.startDate || r.date)
      if (Boolean(start) && formattedSelectedIso >= start && formattedSelectedIso <= end) {
        list.push({
          ...r,
          isOverride: false,
          itemType: r.category || 'academic'
        })
      }
    })
    return list
  }, [overrides, reminders, formattedSelectedIso])

  // Filtered recurring classes for this weekday:
  // Shown ONLY from 06 July 2026 to 23 October 2026, and suppressed if a class-affecting override occurs.
  // Academic reminders NEVER suppress recurring classes.
  const effectiveDayClasses = useMemo(() => {
    if (!isWithinTeachingPeriod || classAffectingOverride) return []

    const forDay = recurringClasses.filter(
      (c) => (c.day || '').trim().toLowerCase() === (dayName || '').trim().toLowerCase()
    )

    // Filter out any individual class that has a targeted class-level override
    const uncancelledClasses = forDay.filter((c) => {
      const isClassCancelled = overrides.some((o) => {
        if (!o.affectsClasses || o.affectsClasses === 'false') return false
        const targetClassId = o.classId?._id ? String(o.classId._id) : (o.classId ? String(o.classId) : '')
        if (!targetClassId || targetClassId !== String(c._id)) return false
        const startDate = formatIsoDate(o.startDate || o.date)
        const endDate = formatIsoDate(o.endDate || o.startDate || o.date)
        return Boolean(startDate) && formattedSelectedIso >= startDate && formattedSelectedIso <= endDate
      })
      return !isClassCancelled
    })

    const forBatch = uncancelledClasses.filter((c) => {
      if (selectedBatch === 'All') return true
      if (!c.batch || c.batch === 'All') return true
      return c.batch === selectedBatch
    })

    return [...forBatch].sort((a, b) => {
      const startDiff = parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime)
      if (startDiff !== 0) return startDiff
      return (a.batch || '').localeCompare(b.batch || '')
    })
  }, [recurringClasses, dayName, isWithinTeachingPeriod, classAffectingOverride, selectedBatch, overrides, formattedSelectedIso])

  // Daily Timeline Items with Recess Breaks
  const timelineItems = useMemo(() => {
    if (classAffectingOverride || effectiveDayClasses.length === 0) {
      return []
    }

    const items = []
    const lunchBreakStart = parseTimeToMinutes('13:00')
    const lunchBreakEnd = parseTimeToMinutes('14:00')
    let lunchInserted = false

    for (let i = 0; i < effectiveDayClasses.length; i++) {
      const current = effectiveDayClasses[i]
      const currentStart = parseTimeToMinutes(current.startTime)

      if (!lunchInserted && currentStart >= lunchBreakEnd) {
        items.push({
          isBreak: true,
          title: 'Lunch Break & Recess',
          startTime: '13:00',
          endTime: '14:00',
          durationMins: 60
        })
        lunchInserted = true
      }

      if (i > 0) {
        const prev = effectiveDayClasses[i - 1]
        const prevEnd = parseTimeToMinutes(prev.endTime)
        const gap = currentStart - prevEnd
        if (gap >= 15 && !(prevEnd <= lunchBreakStart && currentStart >= lunchBreakEnd)) {
          items.push({
            isBreak: true,
            title: 'Recess Break',
            startTime: formatMinutesToTime(prevEnd),
            endTime: formatMinutesToTime(currentStart),
            durationMins: gap
          })
        }
      }

      items.push({
        ...current,
        isBreak: false
      })
    }

    return items
  }, [effectiveDayClasses, classAffectingOverride])

  // Week Timetable Data
  const weekRangeLabel = useMemo(() => {
    if (weekDays.length < 5) return ''
    const start = weekDays[0]
    const end = weekDays[4]
    return `${start.monthShort} ${start.dayNumber} – ${end.monthShort} ${end.dayNumber}`
  }, [weekDays])

  const weekTimetable = useMemo(() => {
    return weekDays.map((dayItem) => {
      const dayIso = dayItem.iso
      const dayClassAffectingOverride = overrides.find((o) => {
        if (!o.affectsClasses || o.affectsClasses === 'false') return false
        const normBranch = (o.branch || 'All').trim().toLowerCase()
        if (normBranch !== 'all' && normBranch !== 'ece') return false
        if (o.semester && Number(o.semester) !== 5) return false
        if (o.classId) return false

        const startDate = formatIsoDate(o.startDate || o.date)
        const endDate = formatIsoDate(o.endDate || o.startDate || o.date)
        return Boolean(startDate) && dayIso >= startDate && dayIso <= endDate
      })

      // Academic reminders NEVER suppress recurring classes
      const dayReminders = reminders.filter((r) => {
        const start = formatIsoDate(r.startDate || r.date)
        const end = formatIsoDate(r.endDate || r.startDate || r.date)
        return Boolean(start) && dayIso >= start && dayIso <= end
      })

      const dayIsWithinTeaching = dayIso >= RECURRING_CLASSES_START_ISO && dayIso <= RECURRING_CLASSES_END_ISO

      let effectiveClasses = []
      if (dayIsWithinTeaching && !dayClassAffectingOverride) {
        const dayClasses = recurringClasses.filter(
          (c) => (c.day || '').trim().toLowerCase() === (dayItem.dayName || '').trim().toLowerCase()
        )

        // Filter out any individual class that has a targeted class-level override
        const uncancelledDayClasses = dayClasses.filter((c) => {
          const isClassCancelled = overrides.some((o) => {
            if (!o.affectsClasses || o.affectsClasses === 'false') return false
            const targetClassId = o.classId?._id ? String(o.classId._id) : (o.classId ? String(o.classId) : '')
            if (!targetClassId || targetClassId !== String(c._id)) return false
            const startDate = formatIsoDate(o.startDate || o.date)
            const endDate = formatIsoDate(o.endDate || o.startDate || o.date)
            return Boolean(startDate) && dayIso >= startDate && dayIso <= endDate
          })
          return !isClassCancelled
        })

        const batchFiltered = uncancelledDayClasses.filter((c) => {
          if (selectedBatch === 'All') return true
          if (!c.batch || c.batch === 'All') return true
          return c.batch === selectedBatch
        })
        effectiveClasses = [...batchFiltered].sort((a, b) => {
          return parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime)
        })
      }

      return {
        ...dayItem,
        override: dayClassAffectingOverride,
        reminders: dayReminders,
        classes: effectiveClasses
      }
    })
  }, [weekDays, overrides, reminders, recurringClasses, selectedBatch])

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Top Header / Context */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wider text-lime-300 uppercase">
            Academic Timetable
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
            Class Schedule
          </h1>
          <p className="mt-1 text-xs text-slate-400 sm:text-sm">
            {user.branch || 'ECE'} · Semester 5 · Session July–Dec 2026
          </p>
        </div>

        {/* View Switcher, Batch Filter & Management Action Controls */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
          {/* Top Controls Row on Mobile: View Mode & Batch */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Switcher: Daily View | Week View */}
            <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
              <button
                onClick={() => setViewMode('daily')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  viewMode === 'daily'
                    ? 'bg-lime-300 text-slate-900 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Daily View
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  viewMode === 'week'
                    ? 'bg-lime-300 text-slate-900 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Week View
              </button>
            </div>

            {/* Batch Filter Pills */}
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
              <span className="hidden px-2 text-xs font-medium text-slate-400 sm:inline">Batch:</span>
              {['All', 'Batch-1', 'Batch-2'].map((b) => (
                <button
                  key={b}
                  onClick={() => setSelectedBatch(b)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    selectedBatch === b
                      ? 'bg-lime-300 text-slate-900 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {b === 'Batch-1' ? 'B-1' : b === 'Batch-2' ? 'B-2' : 'All'}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons: Add Class, Add Override, Add Reminder */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleOpenAddClass()}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-lime-300 px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-lime-200 active:scale-95 sm:flex-initial"
              title="Add Recurring Class"
            >
              <Plus size={14} />
              <span>Add Class</span>
            </button>
            <button
              onClick={handleOpenAddOverride}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-400/20 active:scale-95 sm:flex-initial"
              title="Add Holiday / Exam / Schedule Override"
            >
              <CalendarPlus size={14} />
              <span>Override</span>
            </button>
            <button
              onClick={handleOpenAddReminder}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-indigo-400/30 bg-indigo-500/15 px-3 py-2 text-xs font-semibold text-indigo-300 transition hover:bg-indigo-500/25 active:scale-95 sm:flex-initial"
              title="Add Academic Reminder"
            >
              <BellPlus size={14} />
              <span>Reminder</span>
            </button>
          </div>
        </div>
      </div>

      {/* Action Notification Banners */}
      {actionError && (
        <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError('')} className="p-1 hover:text-white" title="Dismiss error">
            <X size={15} />
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="flex items-center justify-between rounded-xl border border-lime-300/30 bg-lime-300/10 px-4 py-3 text-sm text-lime-300">
          <div className="flex items-center gap-2">
            <Check size={16} className="shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess('')} className="p-1 hover:text-white" title="Dismiss success">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Date Navigation Bar */}
      <div className="dash-card space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Navigation buttons: Previous Day/Week, Today, Next Day/Week */}
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePrevDay}
                className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white active:scale-95"
                title={viewMode === 'week' ? 'Previous Week' : 'Previous Day'}
                aria-label={viewMode === 'week' ? 'Previous Week' : 'Previous Day'}
              >
                <ChevronLeft size={18} />
              </button>

              <button
                onClick={handleToday}
                className={`rounded-xl px-3 py-2 text-xs font-semibold tracking-wide transition active:scale-95 ${
                  isToday
                    ? 'bg-lime-300 text-slate-900 shadow-sm'
                    : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                Today
              </button>

              <button
                onClick={handleNextDay}
                className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white active:scale-95"
                title={viewMode === 'week' ? 'Next Week' : 'Next Day'}
                aria-label={viewMode === 'week' ? 'Next Week' : 'Next Day'}
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Date label: visible on mobile & desktop */}
            <div className="text-right sm:text-left sm:ml-2">
              <span className="text-sm sm:text-base font-semibold text-white block">
                {viewMode === 'week' ? `Week of ${weekRangeLabel}` : friendlyDateString}
              </span>
              <span className="text-[11px] text-slate-400 sm:hidden block">
                {viewMode === 'week' ? 'Mon – Fri Timetable' : `${dayName}${isToday ? ' (Today)' : ''}`}
              </span>
            </div>
          </div>

          {/* Date Picker Input */}
          <div className="flex items-center justify-between sm:justify-end gap-2.5">
            <div className="relative flex items-center flex-1 sm:flex-initial">
              <input
                type="date"
                value={formattedSelectedIso}
                onChange={handleDateChange}
                className="w-full rounded-xl border border-white/10 bg-[#15181e] px-3 py-2 text-xs sm:text-sm text-slate-200 outline-none transition focus:border-lime-300 focus:ring-1 focus:ring-lime-300"
              />
            </div>
            <span className="shrink-0 rounded-lg bg-white/5 px-2.5 py-2 text-xs font-semibold text-lime-300 border border-white/10">
              {viewMode === 'week' ? 'Mon – Fri' : dayName}
            </span>
          </div>
        </div>

        {/* Small Monday–Friday Date Navigator */}
        <div className="border-t border-white/10 pt-3">
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {weekDays.map((item) => {
              return (
                <button
                  key={item.iso}
                  onClick={() => {
                    setSelectedDate(new Date(item.date))
                    if (viewMode === 'week') {
                      setViewMode('daily')
                    }
                  }}
                  className={`group relative flex flex-col items-center justify-center rounded-xl py-2 px-1 text-center transition active:scale-95 sm:py-2.5 min-h-[46px] ${
                    item.isSelected
                      ? 'bg-lime-300 text-slate-900 shadow-sm font-semibold ring-2 ring-lime-300/40'
                      : item.isToday
                      ? 'border border-lime-300/40 bg-lime-300/10 text-lime-300 hover:bg-lime-300/20'
                      : 'border border-white/5 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10 hover:text-white'
                  }`}
                  title={`${item.label}, ${item.monthShort} ${item.dayNumber} (Click for Daily View)`}
                >
                  <span
                    className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider ${
                      item.isSelected ? 'text-slate-800' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </span>
                  <span
                    className={`mt-0.5 text-sm sm:text-base font-semibold ${
                      item.isSelected ? 'text-slate-900' : 'text-white'
                    }`}
                  >
                    {item.dayNumber}
                  </span>
                  <span
                    className={`text-[9px] sm:text-[10px] ${
                      item.isSelected ? 'text-slate-700 font-medium' : 'text-slate-500'
                    }`}
                  >
                    {item.monthShort}
                  </span>

                  {item.isToday && !item.isSelected && (
                    <span className="absolute -top-1 right-2 h-1.5 w-1.5 rounded-full bg-lime-300" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ERROR STATE */}
      {fetchError && (
        <div className="dash-card py-12 px-6 text-center space-y-4 border-rose-500/20 bg-rose-500/5">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300">
            <AlertTriangle size={28} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-semibold text-white">Unable to Load Schedule</h3>
            <p className="mx-auto max-w-md text-sm text-slate-300 leading-relaxed">
              {fetchError}
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={fetchScheduleData}
              className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-4 py-2.5 text-xs font-semibold text-slate-900 transition hover:bg-lime-200 active:scale-95 shadow-sm"
            >
              <RotateCcw size={14} />
              <span>Try Again</span>
            </button>
          </div>
        </div>
      )}

      {/* WEEK VIEW */}
      {!fetchError && viewMode === 'week' ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base sm:text-lg font-semibold text-white">
              Monday – Friday Weekly Timetable
            </h2>
            <span className="text-xs font-medium text-slate-400">
              {weekRangeLabel} · Tap any column to focus Daily View
            </span>
          </div>

          {loading ? (
            /* Skeleton Loading for Week View */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
              {[1, 2, 3, 4, 5].map((n) => (
                <div
                  key={n}
                  className="rounded-2xl border border-white/10 bg-[#121418] p-3.5 space-y-3 animate-pulse"
                >
                  <div className="space-y-1.5 pb-3 border-b border-white/10">
                    <div className="h-3 w-10 bg-lime-300/20 rounded" />
                    <div className="h-4 w-20 bg-white/10 rounded" />
                  </div>
                  <div className="space-y-2.5 pt-1">
                    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2.5 space-y-2">
                      <div className="h-3 w-14 bg-lime-300/20 rounded" />
                      <div className="h-3.5 w-3/4 bg-white/15 rounded" />
                      <div className="h-2.5 w-1/2 bg-white/10 rounded" />
                    </div>
                    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2.5 space-y-2">
                      <div className="h-3 w-14 bg-lime-300/20 rounded" />
                      <div className="h-3.5 w-4/5 bg-white/15 rounded" />
                      <div className="h-2.5 w-2/3 bg-white/10 rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
              {weekTimetable.map((col) => {
                const overrideStyle = col.override ? getOverrideBadgeStyle(col.override.type) : null
                const OverrideIcon = overrideStyle ? overrideStyle.icon : null

                return (
                  <div
                    key={col.iso}
                    className={`flex flex-col rounded-2xl border transition ${
                      col.isSelected
                        ? 'border-lime-300/40 bg-white/[0.04]'
                        : col.isToday
                        ? 'border-lime-300/20 bg-lime-300/[0.02]'
                        : 'border-white/10 bg-[#121418]'
                    }`}
                  >
                    {/* Day Column Header */}
                    <button
                      onClick={() => {
                        setSelectedDate(new Date(col.date))
                        setViewMode('daily')
                      }}
                      className="group flex items-center justify-between border-b border-white/10 p-3.5 text-left transition hover:bg-white/5 rounded-t-2xl"
                      title="Open in Daily View"
                    >
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-lime-300">
                          {col.label}
                        </span>
                        <h3 className="text-sm font-semibold text-white group-hover:text-lime-300 transition">
                          {col.monthShort} {col.dayNumber}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {col.isToday && (
                          <span className="rounded-md bg-lime-300/20 px-1.5 py-0.5 text-[10px] font-semibold text-lime-300">
                            Today
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400 group-hover:text-slate-200">
                          {col.override ? '0' : col.classes.length} {col.classes.length === 1 ? 'class' : 'classes'}
                        </span>
                      </div>
                    </button>

                    {/* Column Content */}
                    <div className="flex-1 space-y-2.5 p-3">
                      {/* Day Override / Suspension */}
                      {col.override ? (
                        <div className={`rounded-xl border ${overrideStyle.border} ${overrideStyle.cardBg} p-3 space-y-1.5`}>
                          <div className={`flex items-center gap-1.5 ${overrideStyle.text}`}>
                            <OverrideIcon size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-wider">
                              {col.override.type}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-white">
                            {col.override.title}
                          </p>
                          <p className="text-[11px] text-slate-300 line-clamp-2">
                            Classes suspended
                          </p>
                        </div>
                      ) : col.classes.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-500">
                          No classes scheduled
                        </div>
                      ) : (
                        col.classes.map((c, cIdx) => {
                          const isLab = Boolean(c.isLab || c.lab)
                          return (
                            <div
                              key={c._id || cIdx}
                              className="group rounded-xl border border-white/5 bg-white/[0.03] p-2.5 space-y-1.5 transition hover:border-lime-300/30 hover:bg-white/[0.06]"
                            >
                              <div className="flex items-center justify-between text-[11px] font-mono text-lime-300 tabular-nums">
                                <span>{c.startTime}</span>
                                <span className="text-slate-500 font-sans">to {c.endTime}</span>
                              </div>

                              <h4 className="text-xs font-semibold text-white leading-tight line-clamp-2 group-hover:text-lime-300 transition">
                                {c.subject}
                              </h4>

                              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                {c.code && (
                                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-mono text-slate-300">
                                    {c.code}
                                  </span>
                                )}
                                {isLab && (
                                  <span className="inline-flex items-center gap-0.5 rounded bg-emerald-400/15 border border-emerald-400/30 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
                                    <FlaskConical size={9} />
                                    Lab
                                  </span>
                                )}
                                {c.batch && c.batch !== 'All' && (
                                  <span className="rounded bg-sky-400/15 border border-sky-400/30 px-1.5 py-0.5 text-[9px] font-medium text-sky-300">
                                    {c.batch}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-white/5">
                                {c.room && (
                                  <span className="truncate">R: {c.room}</span>
                                )}
                                <div className="flex items-center gap-1 ml-auto">
                                  {c.teacher && (
                                    <span className="truncate max-w-[80px] text-right font-medium text-slate-300">
                                      {c.teacher}
                                    </span>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleOpenEditClass(c)
                                    }}
                                    className="p-1 text-slate-400 hover:text-lime-300 transition rounded"
                                    title="Edit class"
                                  >
                                    <Edit2 size={11} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDeleteClass(c)
                                    }}
                                    className="p-1 text-slate-400 hover:text-rose-400 transition rounded"
                                    title="Delete class"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        })
                      )}

                      {/* Day Reminders badge in Week view */}
                      {col.reminders.length > 0 && (
                        <div className="rounded-lg border border-indigo-400/20 bg-indigo-500/10 p-2 text-[10px] text-indigo-300 space-y-1">
                          <div className="flex items-center gap-1 font-semibold">
                            <Bell size={10} />
                            <span>{col.reminders.length} Reminder{col.reminders.length > 1 ? 's' : ''}</span>
                          </div>
                          <div className="truncate text-slate-300">
                            {col.reminders.map((r) => r.title).join(', ')}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Quick Add Class to Day Column */}
                    <div className="border-t border-white/5 p-2 text-center rounded-b-2xl">
                      <button
                        onClick={() => handleOpenAddClass(col.dayName)}
                        className="inline-flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium text-slate-400 transition hover:bg-white/5 hover:text-lime-300"
                        title={`Add class for ${col.dayName}`}
                      >
                        <Plus size={11} />
                        <span>Add Class</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      ) : !fetchError ? (
        /* DAILY VIEW (Default) */
        <>
          {/* Class Override / Holiday Notice (when active) */}
          {classAffectingOverride && (() => {
            const style = getOverrideBadgeStyle(classAffectingOverride.type)
            const OverrideIcon = style.icon
            return (
              <div className={`rounded-2xl border ${style.border} ${style.cardBg} p-4 sm:p-5 shadow-sm`}>
                <div className="flex items-start justify-between gap-3.5">
                  <div className="flex items-start gap-3.5">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${style.bg} ${style.text} border ${style.border}`}>
                      <OverrideIcon size={20} />
                    </span>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.badgeBg} border`}>
                          {classAffectingOverride.type}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">Classes suspended / replaced</span>
                      </div>
                      <h3 className="text-base sm:text-lg font-semibold text-white">
                        {classAffectingOverride.title}
                      </h3>
                      {classAffectingOverride.description && (
                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                          {classAffectingOverride.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleOpenEditOverride(classAffectingOverride)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border ${style.border} ${style.bg} ${style.text} transition hover:brightness-125`}
                      title="Edit override"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteOverride(classAffectingOverride)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-400/30 bg-rose-400/10 text-rose-300 transition hover:bg-rose-400/20"
                      title="Delete override"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Timeline Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-semibold text-white">
                Classes on {dayName}
              </h2>
              <div className="flex items-center gap-2.5 sm:gap-3">
                <span className="text-xs font-medium text-slate-400">
                  {classAffectingOverride
                    ? 'Classes suspended'
                    : isAfterTeachingEnd
                    ? 'Teaching concluded (exams / breaks period)'
                    : !isWithinTeachingPeriod
                    ? 'Outside teaching period'
                    : `${effectiveDayClasses.length} ${effectiveDayClasses.length === 1 ? 'class' : 'classes'} scheduled`}
                </span>
                <button
                  onClick={() => handleOpenAddClass(dayName)}
                  className="inline-flex items-center gap-1 rounded-lg border border-lime-300/30 bg-lime-300/10 px-2.5 py-1 text-xs font-semibold text-lime-300 transition hover:bg-lime-300 hover:text-slate-900"
                  title={`Add class for ${dayName}`}
                >
                  <Plus size={13} />
                  <span>Add Class</span>
                </button>
              </div>
            </div>

            {loading ? (
              /* Skeleton Loading for Daily View */
              <div className="space-y-3.5">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="dash-card animate-pulse flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sm:p-5"
                  >
                    <div className="flex items-start gap-4">
                      <div className="space-y-2 min-w-24">
                        <div className="h-4 w-16 bg-white/10 rounded" />
                        <div className="h-3 w-12 bg-white/5 rounded" />
                      </div>
                      <div className="border-l border-white/10 pl-4 space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-14 bg-white/10 rounded" />
                          <div className="h-4 w-16 bg-white/5 rounded" />
                        </div>
                        <div className="h-5 w-48 sm:w-64 bg-white/15 rounded" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pt-2 sm:pt-0 border-t border-white/5 sm:border-0">
                      <div className="h-6 w-20 bg-white/5 rounded-lg" />
                      <div className="h-6 w-28 bg-white/5 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            ) : classAffectingOverride ? (
              /* Override replaced classes for this date */
              (() => {
                const style = getOverrideBadgeStyle(classAffectingOverride.type)
                const OverrideIcon = style.icon
                return (
                  <div className={`dash-card py-14 px-6 text-center border ${style.border} ${style.cardBg} space-y-3.5`}>
                    <div className={`mx-auto mb-2 grid h-14 w-14 place-items-center rounded-2xl ${style.bg} border ${style.border} ${style.text}`}>
                      <OverrideIcon size={28} />
                    </div>
                    <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${style.badgeBg} border`}>
                      <span>{classAffectingOverride.type}</span>
                    </div>
                    <h3 className="text-xl font-bold text-white">
                      {classAffectingOverride.title}
                    </h3>
                    <p className="mx-auto max-w-md text-sm text-slate-300 leading-relaxed">
                      Regular weekly classes for {dayName} are suspended on this date due to {classAffectingOverride.type}.
                      {classAffectingOverride.description && ` (${classAffectingOverride.description})`}
                    </p>
                    <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                      <button
                        onClick={() => handleOpenEditOverride(classAffectingOverride)}
                        className={`inline-flex items-center gap-1.5 rounded-xl border ${style.border} ${style.bg} px-3.5 py-2 text-xs font-semibold ${style.text} hover:brightness-125 transition`}
                      >
                        <Edit2 size={13} />
                        <span>Edit Override</span>
                      </button>
                      <button
                        onClick={() => handleDeleteOverride(classAffectingOverride)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3.5 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-400/20 transition"
                      >
                        <Trash2 size={13} />
                        <span>Delete Override</span>
                      </button>
                    </div>
                  </div>
                )
              })()
            ) : timelineItems.length === 0 ? (
              /* Polished Empty-Day State */
              isWeekend ? (
                <div className="dash-card py-14 px-6 text-center space-y-3.5 border-dashed border-white/15 bg-white/[0.02]">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-400/10 border border-emerald-400/25 text-emerald-300 shadow-inner">
                    <Coffee size={26} />
                  </div>
                  <div className="space-y-1">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 border border-emerald-400/30 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                      Weekend Break
                    </span>
                    <h3 className="text-lg font-semibold text-white">No Classes on {dayName}</h3>
                    <p className="mx-auto max-w-md text-sm text-slate-400 leading-relaxed">
                      It’s the weekend! Relax, catch up on projects, or recharge. Regular Monday–Friday classes will resume shortly.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <button
                      onClick={handleNextMonday}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-lime-300 px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-lime-200 active:scale-95"
                    >
                      <span>Jump to Monday</span>
                      <ChevronRight size={14} />
                    </button>
                    <button
                      onClick={() => handleOpenAddClass(dayName)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition"
                    >
                      <Plus size={14} />
                      <span>Add Weekend Session</span>
                    </button>
                  </div>
                </div>
              ) : isAfterTeachingEnd ? (
                <div className="dash-card py-14 px-6 text-center space-y-3.5 border-dashed border-indigo-400/30 bg-indigo-950/10">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-indigo-500/15 border border-indigo-400/30 text-indigo-300 shadow-inner">
                    <GraduationCap size={28} />
                  </div>
                  <div className="space-y-1.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 border border-indigo-400/40 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                      Teaching Concluded
                    </span>
                    <h3 className="text-lg font-semibold text-white">
                      No Regular Weekly Classes
                    </h3>
                    <p className="mx-auto max-w-md text-sm text-slate-300 leading-relaxed">
                      Odd Semester 2026 teaching concluded on <strong>23 October 2026</strong>. Regular recurring classes are stopped. Academic examinations, student evaluations, and semester breaks are active.
                    </p>
                  </div>
                  {applicableSemesterEvents.length > 0 && (
                    <div className="pt-2 max-w-lg mx-auto text-left">
                      <p className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-2 text-center">
                        Active Schedule & Academic Milestones
                      </p>
                      <div className="space-y-2">
                        {applicableSemesterEvents.map((evt, eIdx) => (
                          <div
                            key={evt._id || eIdx}
                            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs"
                          >
                            <span className="font-medium text-white">{evt.title}</span>
                            <span className="capitalize text-slate-400 font-mono text-[11px]">{evt.itemType}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="pt-3">
                    <button
                      onClick={() => handleOpenAddClass(dayName)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition"
                    >
                      <Plus size={14} />
                      <span>Add Special / Extra Class</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="dash-card py-14 px-6 text-center space-y-3.5 border-dashed border-white/15 bg-white/[0.02]">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-lime-300/10 border border-lime-300/25 text-lime-300 shadow-inner">
                    <CalendarIcon size={26} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-white">No Classes on {dayName}</h3>
                    <p className="mx-auto max-w-md text-sm text-slate-400 leading-relaxed">
                      {!isWithinTeachingPeriod
                        ? `The selected date is outside the Odd Semester 2026 teaching schedule (06 July – 23 October 2026).`
                        : `There are no scheduled lectures or laboratory sessions for this day. Enjoy your free time or add custom classes.`}
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={() => handleOpenAddClass(dayName)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-lime-300 px-4 py-2.5 text-xs font-semibold text-slate-900 transition hover:bg-lime-200 active:scale-95 shadow-sm"
                    >
                      <Plus size={14} />
                      <span>Add First Class for {dayName}</span>
                    </button>
                  </div>
                </div>
              )
            ) : (
              /* Class & Recess Cards */
              <div className="space-y-3.5">
                {timelineItems.map((item, idx) => {
                  if (item.isBreak) {
                    // Break / Recess card
                    return (
                      <div
                        key={`break-${idx}`}
                        className="flex items-center gap-3 sm:gap-4 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-3 text-slate-400"
                      >
                        <div className="text-xs font-semibold tabular-nums text-slate-400 shrink-0">
                          {item.startTime} – {item.endTime}
                        </div>
                        <div className="h-3 w-px bg-white/10 shrink-0" />
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                          <Coffee size={15} className="text-amber-400/80 shrink-0" />
                          <span>{item.title}</span>
                          <span className="text-slate-500">({item.durationMins} mins)</span>
                        </div>
                      </div>
                    )
                  }

                  // Normal or Lab Class Card
                  const isLab = Boolean(item.isLab || item.lab)
                  return (
                    <article
                      key={item._id || idx}
                      className="dash-card group relative flex flex-col gap-3.5 p-4 sm:p-5 transition hover:border-lime-300/40"
                    >
                      {/* Card Header: Time, Tags, and Edit/Delete Actions */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Time block */}
                          <div className="flex items-center gap-1.5 text-sm font-semibold tabular-nums text-lime-300">
                            <Clock size={15} className="text-lime-300/80 shrink-0" />
                            <span>{item.startTime}</span>
                            <span className="text-xs text-slate-400 font-medium">to {item.endTime}</span>
                          </div>

                          {item.code && (
                            <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-mono font-medium text-slate-300 border border-white/10">
                              {item.code}
                            </span>
                          )}
                          {isLab && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-400/15 border border-emerald-400/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                              <FlaskConical size={12} />
                              Laboratory
                            </span>
                          )}
                          {item.batch && item.batch !== 'All' && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-sky-400/15 border border-sky-400/30 px-2 py-0.5 text-[11px] font-medium text-sky-300">
                              <Layers size={12} />
                              {item.batch}
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleOpenEditClass(item)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition hover:border-lime-300/40 hover:bg-white/10 hover:text-lime-300"
                            title="Edit class"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteClass(item)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition hover:border-rose-400/40 hover:bg-white/10 hover:text-rose-400"
                            title="Delete class"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Subject Title */}
                      <h3 className="text-base sm:text-lg font-semibold text-white transition group-hover:text-lime-200">
                        {item.subject}
                      </h3>

                      {/* Card Footer: Room & Teacher Info */}
                      {(item.room || item.teacher) && (
                        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/5 text-xs text-slate-400">
                          {item.room && (
                            <div className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1 text-slate-300 border border-white/10">
                              <MapPin size={13} className="text-lime-300" />
                              <span>Room {item.room}</span>
                            </div>
                          )}
                          {item.teacher && (
                            <div className="flex items-center gap-1.5">
                              <User size={13} className="text-slate-500" />
                              <span>Instructor: <strong className="text-slate-200 font-medium">{item.teacher}</strong></span>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          {/* Academic Events & Reminders that do NOT affect classes (Rendered at the bottom of the day's schedule) */}
          {activeReminders.length > 0 && (
            <div className="dash-card space-y-3.5 border-indigo-400/20 bg-indigo-500/5 p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-300">
                  <Bell size={15} />
                  <span>Academic Events & Milestones ({activeReminders.length})</span>
                </div>
                <button
                  onClick={handleOpenAddReminder}
                  className="flex items-center gap-1 text-[11px] font-semibold text-indigo-300 hover:text-white transition"
                >
                  <Plus size={13} />
                  <span>Add Reminder</span>
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {activeReminders.map((r, i) => {
                  const catStyle = getReminderCategoryStyle(r.category)
                  const CatIcon = catStyle.icon
                  return (
                    <div
                      key={r._id || i}
                      className={`flex items-start justify-between gap-3 rounded-xl border ${catStyle.border} bg-white/[0.03] p-3.5 transition hover:bg-white/[0.05]`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${catStyle.bg} ${catStyle.text} border ${catStyle.border}`}>
                          <CatIcon size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${catStyle.text}`}>
                              {r.category || 'Academic'}
                            </span>
                            {r.affectsClasses === false && (
                              <span className="text-[10px] text-slate-400 font-medium bg-white/5 px-1.5 py-0.5 rounded">
                                Classes as usual
                              </span>
                            )}
                          </div>
                          <h4 className="mt-1 truncate text-sm font-semibold text-white">
                            {r.title}
                          </h4>
                          {r.description && (
                            <p className="mt-1 text-xs text-slate-400 leading-relaxed line-clamp-2">
                              {r.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 pl-1">
                        <button
                          onClick={() => handleOpenEditReminder(r)}
                          className="p-1.5 text-slate-400 hover:text-white transition rounded-lg hover:bg-white/5"
                          title="Edit reminder"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteReminder(r)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 transition rounded-lg hover:bg-white/5"
                          title="Delete reminder"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      ) : null}

      {/* ============================================================ */}
      {/* 1. RECURRING CLASS MODAL (Add / Edit)                       */}
      {/* ============================================================ */}
      {classModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 overflow-y-auto">
          <form
            onSubmit={handleSubmitClass}
            className="my-8 w-full max-w-lg rounded-2xl border border-white/10 bg-panel p-5 sm:p-6 text-white shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {editingClass ? 'Edit Recurring Class' : 'Add Recurring Class'}
                </h3>
                <p className="text-xs text-slate-400">
                  Weekly schedule entry saved to MongoDB backend.
                </p>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setClassModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
                title="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="font-medium text-slate-300">Subject Title *</span>
                <input
                  required
                  disabled={submitting}
                  className="field text-slate-900"
                  placeholder="e.g. VLSI-D"
                  value={classForm.subject}
                  onChange={(e) => setClassForm({ ...classForm, subject: e.target.value })}
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="font-medium text-slate-300">Subject Code</span>
                  <input
                    disabled={submitting}
                    className="field text-slate-900"
                    placeholder="e.g. ECE-5001"
                    value={classForm.code}
                    onChange={(e) => setClassForm({ ...classForm, code: e.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="font-medium text-slate-300">Day of Week *</span>
                  <select
                    disabled={submitting}
                    className="field text-slate-900"
                    value={classForm.day}
                    onChange={(e) => setClassForm({ ...classForm, day: e.target.value })}
                  >
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="font-medium text-slate-300">Start Time *</span>
                  <input
                    type="time"
                    required
                    disabled={submitting}
                    className="field text-slate-900"
                    value={classForm.startTime}
                    onChange={(e) => setClassForm({ ...classForm, startTime: e.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="font-medium text-slate-300">End Time *</span>
                  <input
                    type="time"
                    required
                    disabled={submitting}
                    className="field text-slate-900"
                    value={classForm.endTime}
                    onChange={(e) => setClassForm({ ...classForm, endTime: e.target.value })}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="font-medium text-slate-300">Room</span>
                  <input
                    disabled={submitting}
                    className="field text-slate-900"
                    placeholder="e.g. F-102 or DSP Lab"
                    value={classForm.room}
                    onChange={(e) => setClassForm({ ...classForm, room: e.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="font-medium text-slate-300">Teacher / Instructor</span>
                  <input
                    disabled={submitting}
                    className="field text-slate-900"
                    placeholder="e.g. Dr. K. Verma"
                    value={classForm.teacher}
                    onChange={(e) => setClassForm({ ...classForm, teacher: e.target.value })}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="font-medium text-slate-300">Batch Filter</span>
                  <select
                    disabled={submitting}
                    className="field text-slate-900"
                    value={classForm.batch}
                    onChange={(e) => setClassForm({ ...classForm, batch: e.target.value })}
                  >
                    <option value="All">All Batches</option>
                    <option value="Batch-1">Batch-1</option>
                    <option value="Batch-2">Batch-2</option>
                  </select>
                </label>

                <label className="block">
                  <span className="font-medium text-slate-300">Branch</span>
                  <input
                    disabled={submitting}
                    className="field text-slate-900"
                    value={classForm.branch}
                    onChange={(e) => setClassForm({ ...classForm, branch: e.target.value })}
                  />
                </label>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={submitting}
                    className="rounded border-white/20 text-lime-400 focus:ring-lime-300"
                    checked={classForm.isLab}
                    onChange={(e) => setClassForm({ ...classForm, isLab: e.target.checked })}
                  />
                  <span className="text-xs font-semibold text-white">This is a Practical / Laboratory session</span>
                </label>
                {classForm.isLab && (
                  <input
                    disabled={submitting}
                    className="field text-xs text-slate-900 mt-1"
                    placeholder="Lab Name (e.g. VLSI-D Lab)"
                    value={classForm.lab}
                    onChange={(e) => setClassForm({ ...classForm, lab: e.target.value })}
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setClassModalOpen(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-lime-300 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-lime-200 transition"
              >
                {submitting ? 'Saving…' : editingClass ? 'Update Class' : 'Create Class'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. SCHEDULE OVERRIDE MODAL (Add / Edit)                    */}
      {/* ============================================================ */}
      {overrideModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 overflow-y-auto">
          <form
            onSubmit={handleSubmitOverride}
            className="my-8 w-full max-w-lg rounded-2xl border border-white/10 bg-panel p-5 sm:p-6 text-white shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {editingOverride ? 'Edit Calendar Override' : 'Add Calendar Override'}
                </h3>
                <p className="text-xs text-slate-400">
                  Holidays, exam schedules, or emergency cancellations.
                </p>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setOverrideModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
                title="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="font-medium text-slate-300">Override Title *</span>
                <input
                  required
                  disabled={submitting}
                  className="field text-slate-900"
                  placeholder="e.g. Independence Day or Mid-Semester Exam"
                  value={overrideForm.title}
                  onChange={(e) => setOverrideForm({ ...overrideForm, title: e.target.value })}
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="font-medium text-slate-300">Start Date *</span>
                  <input
                    type="date"
                    required
                    disabled={submitting}
                    className="field text-slate-900"
                    value={overrideForm.date}
                    onChange={(e) => setOverrideForm({ ...overrideForm, date: e.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="font-medium text-slate-300">End Date (optional)</span>
                  <input
                    type="date"
                    disabled={submitting}
                    className="field text-slate-900"
                    placeholder="Leave blank for 1-day event"
                    value={overrideForm.endDate}
                    onChange={(e) => setOverrideForm({ ...overrideForm, endDate: e.target.value })}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="font-medium text-slate-300">Override Type</span>
                  <select
                    disabled={submitting}
                    className="field text-slate-900"
                    value={overrideForm.type}
                    onChange={(e) => setOverrideForm({ ...overrideForm, type: e.target.value })}
                  >
                    <option value="holiday">Holiday</option>
                    <option value="exam">Examination</option>
                    <option value="break">Academic Break</option>
                    <option value="cancellation">Cancellation</option>
                    <option value="special_class">Special Schedule</option>
                  </select>
                </label>

                <label className="block">
                  <span className="font-medium text-slate-300">Target Branch</span>
                  <select
                    disabled={submitting}
                    className="field text-slate-900"
                    value={overrideForm.branch}
                    onChange={(e) => setOverrideForm({ ...overrideForm, branch: e.target.value })}
                  >
                    <option value="All">All Branches</option>
                    <option value="ECE">ECE Only</option>
                  </select>
                </label>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={submitting}
                    className="rounded border-white/20 text-amber-400 focus:ring-amber-300"
                    checked={overrideForm.affectsClasses}
                    onChange={(e) => setOverrideForm({ ...overrideForm, affectsClasses: e.target.checked })}
                  />
                  <span className="text-xs font-semibold text-white">Affects / suspends regular classes on these dates</span>
                </label>
                <p className="text-[11px] text-slate-400 pl-6">
                  When checked, regular weekly classes will be replaced with this event notice in the timetable.
                </p>
              </div>

              <label className="block">
                <span className="font-medium text-slate-300">Description (optional)</span>
                <textarea
                  disabled={submitting}
                  className="field min-h-20 text-slate-900"
                  placeholder="e.g. National holiday observed across all departments..."
                  value={overrideForm.description}
                  onChange={(e) => setOverrideForm({ ...overrideForm, description: e.target.value })}
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setOverrideModalOpen(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-300 transition"
              >
                {submitting ? 'Saving…' : editingOverride ? 'Update Override' : 'Create Override'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. ACADEMIC REMINDER MODAL (Add / Edit)                     */}
      {/* ============================================================ */}
      {reminderModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 overflow-y-auto">
          <form
            onSubmit={handleSubmitReminder}
            className="my-8 w-full max-w-lg rounded-2xl border border-white/10 bg-panel p-5 sm:p-6 text-white shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {editingReminder ? 'Edit Academic Reminder' : 'Add Academic Reminder'}
                </h3>
                <p className="text-xs text-slate-400">
                  Deadlines, feedback forms, fees, or event reminders.
                </p>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setReminderModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
                title="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="font-medium text-slate-300">Reminder Title *</span>
                <input
                  required
                  disabled={submitting}
                  className="field text-slate-900"
                  placeholder="e.g. Display of Mid-Sem Answer Books"
                  value={reminderForm.title}
                  onChange={(e) => setReminderForm({ ...reminderForm, title: e.target.value })}
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="font-medium text-slate-300">Date *</span>
                  <input
                    type="date"
                    required
                    disabled={submitting}
                    className="field text-slate-900"
                    value={reminderForm.date}
                    onChange={(e) => setReminderForm({ ...reminderForm, date: e.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="font-medium text-slate-300">Category</span>
                  <select
                    disabled={submitting}
                    className="field text-slate-900"
                    value={reminderForm.category}
                    onChange={(e) => setReminderForm({ ...reminderForm, category: e.target.value })}
                  >
                    <option value="general">General Academic</option>
                    <option value="exam">Exam Milestone</option>
                    <option value="fee">Fee Submission</option>
                    <option value="registration">Registration / Form</option>
                    <option value="result">Result Declaration</option>
                    <option value="event">Event / Activity</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="font-medium text-slate-300">Description (optional)</span>
                <textarea
                  disabled={submitting}
                  className="field min-h-20 text-slate-900"
                  placeholder="e.g. Last date for students to verify attendance with course coordinators..."
                  value={reminderForm.description}
                  onChange={(e) => setReminderForm({ ...reminderForm, description: e.target.value })}
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setReminderModalOpen(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-lime-300 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-lime-200 transition"
              >
                {submitting ? 'Saving…' : editingReminder ? 'Update Reminder' : 'Create Reminder'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
