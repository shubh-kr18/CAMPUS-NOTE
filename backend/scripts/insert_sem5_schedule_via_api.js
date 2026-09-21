import '../config/env.js'
import mongoose from 'mongoose'
import User from '../models/User.js'
import RecurringClass from '../models/RecurringClass.js'
import ScheduleOverride from '../models/ScheduleOverride.js'
import AcademicReminder from '../models/AcademicReminder.js'

const BASE_URL = `http://localhost:${process.env.PORT || 5002}/api`

async function run() {
  console.log('Connecting to check and prepare authentication token...')
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campus-notes')
  
  // Find or create an admin/academic user
  let user = await User.findOne({ role: 'admin' })
  if (!user) {
    user = await User.findOne()
  }
  if (!user) {
    user = await User.create({
      name: 'Academic Coordinator',
      email: 'coordinator@iiitbhopal.ac.in',
      password: '$2a$12$eXAmPLeHaShEdPaSsWoRdDoNoTuSeDiReCtLy1234567890',
      branch: 'ECE',
      graduationYear: 2026,
      role: 'admin'
    })
  }

  // Generate valid login session or register test user for API calls
  const testEmail = `coordinator_${Date.now()}@example.com`
  const regRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Academic Coordinator',
      email: testEmail,
      password: 'Password123!',
      branch: 'ECE',
      graduationYear: 2026
    })
  })
  
  let token
  if (regRes.ok) {
    const data = await regRes.json()
    token = data.token
    console.log('Registered session for API ingestion, user:', data.user?.id)
  } else {
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test_student@example.com', password: 'Password123!' })
    })
    const data = await loginRes.json()
    token = data.token
    console.log('Logged in existing session for API ingestion')
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }

  const branch = 'ECE'
  const semester = 5
  const academicSession = 'July-Dec 2026'

  console.log(`Checking existing records for Semester ${semester} ${branch} (${academicSession}) to prevent duplicates...`)

  // 1. RECURRING CLASSES INSERTION VIA API (Duplicate prevention: check by branch, semester, day, startTime, batch, room)
  const existingClassesRes = await fetch(`${BASE_URL}/schedule?branch=${branch}&semester=${semester}`, { headers: authHeaders })
  const existingClassesData = await existingClassesRes.json()
  const existingClasses = existingClassesData.classes || []
  console.log(`Current existing recurring classes in DB: ${existingClasses.length}`)

  const approvedClasses = [
    // Monday
    { subject: 'VLSI-D', code: 'ECE-5001', day: 'Monday', startTime: '09:00', endTime: '11:00', teacher: 'AK', room: 'TD-207', batch: 'Batch-1', isLab: true },
    { subject: 'DIP', code: 'ECE-5003', day: 'Monday', startTime: '09:00', endTime: '11:00', teacher: 'BSK', room: 'TC-101', batch: 'Batch-2', isLab: true },
    { subject: 'Microwave Engineering', code: 'ECE-5002', day: 'Monday', startTime: '11:00', endTime: '12:00', teacher: 'PK', room: 'TD-207', batch: 'All', isLab: false },
    { subject: 'Mobile and Wireless Communication', code: 'ECE-5004', day: 'Monday', startTime: '12:00', endTime: '13:00', teacher: 'NSI', room: 'TD-207', batch: 'All', isLab: false },
    { subject: 'DIP', code: 'ECE-5003', day: 'Monday', startTime: '14:00', endTime: '15:00', teacher: 'BSK', room: 'TD-207', batch: 'All', isLab: false },
    { subject: 'DSD', code: 'ECE-5102', day: 'Monday', startTime: '15:00', endTime: '16:00', teacher: 'AK', room: 'TD-207', batch: 'All', isLab: false },

    // Tuesday
    { subject: 'VLSI-D', code: 'ECE-5001', day: 'Tuesday', startTime: '11:00', endTime: '12:00', teacher: 'AK', room: 'TD-207', batch: 'All', isLab: false },
    { subject: 'Mobile and Wireless Communication', code: 'ECE-5004', day: 'Tuesday', startTime: '12:00', endTime: '13:00', teacher: 'NSI', room: 'TD-207', batch: 'All', isLab: false },
    { subject: 'Microwave Engineering', code: 'ECE-5002', day: 'Tuesday', startTime: '14:00', endTime: '15:00', teacher: 'PK', room: 'TD-207', batch: 'All', isLab: false },
    { subject: 'DIP', code: 'ECE-5003', day: 'Tuesday', startTime: '15:00', endTime: '16:00', teacher: 'BSK', room: 'TD-207', batch: 'All', isLab: false },
    { subject: 'Microwave Engineering', code: 'ECE-5002', day: 'Tuesday', startTime: '16:00', endTime: '18:00', teacher: 'PK', room: 'TD-207', batch: 'All', isLab: true },

    // Wednesday
    { subject: 'VLSI-D', code: 'ECE-5001', day: 'Wednesday', startTime: '11:00', endTime: '12:00', teacher: 'AK', room: 'TD-207', batch: 'All', isLab: false },
    { subject: 'OS', code: 'ECE-5103', day: 'Wednesday', startTime: '12:00', endTime: '13:00', teacher: 'JSR', room: 'TD-207', batch: 'All', isLab: false },
    { subject: 'DSD', code: 'ECE-5102', day: 'Wednesday', startTime: '14:00', endTime: '15:00', teacher: 'AK', room: 'TD-207', batch: 'All', isLab: false },
    { subject: 'Mobile and Wireless Communication', code: 'ECE-5004', day: 'Wednesday', startTime: '15:00', endTime: '16:00', teacher: 'NSI', room: 'TD-207', batch: 'All', isLab: false },
    { subject: 'Microwave Engineering', code: 'ECE-5002', day: 'Wednesday', startTime: '16:00', endTime: '18:00', teacher: 'PK', room: 'TD-207', batch: 'All', isLab: true },

    // Thursday
    { subject: 'DIP', code: 'ECE-5003', day: 'Thursday', startTime: '10:00', endTime: '11:00', teacher: 'BSK', room: 'TD-207', batch: 'All', isLab: false },
    { subject: 'VLSI-D', code: 'ECE-5001', day: 'Thursday', startTime: '11:00', endTime: '12:00', teacher: 'AK', room: 'TD-207', batch: 'All', isLab: false },
    { subject: 'OS', code: 'ECE-5103', day: 'Thursday', startTime: '12:00', endTime: '13:00', teacher: 'JSR', room: 'TD-207', batch: 'All', isLab: false },
    { subject: 'DSD', code: 'ECE-5102', day: 'Thursday', startTime: '14:00', endTime: '15:00', teacher: 'AK', room: 'TD-207', batch: 'All', isLab: false },
    { subject: 'PD Lab', code: 'ECE-5005', day: 'Thursday', startTime: '15:00', endTime: '17:00', teacher: 'Faculty', room: 'TD-207', batch: 'All', isLab: true },

    // Friday
    { subject: 'VLSI-D', code: 'ECE-5001', day: 'Friday', startTime: '09:00', endTime: '11:00', teacher: 'AK', room: 'TD-207', batch: 'Batch-2', isLab: true },
    { subject: 'DIP', code: 'ECE-5003', day: 'Friday', startTime: '09:00', endTime: '11:00', teacher: 'BSK', room: 'TC-101', batch: 'Batch-1', isLab: true },
    { subject: 'Microwave Engineering', code: 'ECE-5002', day: 'Friday', startTime: '11:00', endTime: '12:00', teacher: 'PK', room: 'TD-207', batch: 'All', isLab: false },
    { subject: 'OS', code: 'ECE-5103', day: 'Friday', startTime: '12:00', endTime: '13:00', teacher: 'JSR', room: 'TD-207', batch: 'All', isLab: false },
    { subject: 'PD Lab', code: 'ECE-5005', day: 'Friday', startTime: '14:00', endTime: '16:00', teacher: 'Faculty', room: 'TD-207', batch: 'All', isLab: true }
  ]

  let classesCreated = 0
  let classesSkipped = 0
  for (const c of approvedClasses) {
    const isDuplicate = existingClasses.some(ex =>
      ex.day === c.day &&
      ex.startTime === c.startTime &&
      ex.endTime === c.endTime &&
      (ex.batch || 'All') === c.batch &&
      ex.code === c.code &&
      ex.room === c.room
    )
    if (isDuplicate) {
      classesSkipped++
    } else {
      const res = await fetch(`${BASE_URL}/schedule`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          ...c,
          branch,
          semester,
          academicSession
        })
      })
      if (!res.ok) {
        throw new Error(`Failed to insert class ${c.subject}: ${await res.text()}`)
      }
      classesCreated++
    }
  }
  console.log(`Recurring classes: ${classesCreated} created, ${classesSkipped} already existed (no duplicates).`)

  // 2. OVERRIDES INSERTION VIA API (Duplicate prevention: check by title and startDate)
  const existingOverridesRes = await fetch(`${BASE_URL}/schedule/overrides`, { headers: authHeaders })
  const existingOverridesData = await existingOverridesRes.json()
  const existingOverrides = existingOverridesData.overrides || []
  console.log(`Current existing overrides in DB: ${existingOverrides.length}`)

  const approvedOverrides = [
    { title: 'Independence Day', type: 'holiday', startDate: '2026-08-15T00:00:00.000Z', endDate: '2026-08-15T23:59:59.999Z', description: 'Public Holiday (Saturday)', affectsClasses: true },
    { title: 'Milad-Un-Navi / Eid-E-Milad', type: 'holiday', startDate: '2026-08-26T00:00:00.000Z', endDate: '2026-08-26T23:59:59.999Z', description: 'Public Holiday (Hajrat Mohd. Sahab Birthday) (Wednesday)', affectsClasses: true },
    { title: 'Janmasthmi', type: 'holiday', startDate: '2026-09-04T00:00:00.000Z', endDate: '2026-09-04T23:59:59.999Z', description: 'Public Holiday (Friday)', affectsClasses: true },
    { title: 'Mid-Term Examination', type: 'exam', startDate: '2026-09-04T00:00:00.000Z', endDate: '2026-09-11T23:59:59.999Z', description: 'Mid-Term Examinations for Odd Semester', affectsClasses: true, semester },
    { title: 'Ganesh Chaturthi / Vinayaka Chaturthi', type: 'holiday', startDate: '2026-09-14T00:00:00.000Z', endDate: '2026-09-14T23:59:59.999Z', description: 'Public Holiday (Monday)', affectsClasses: true },
    { title: 'Mahatma Gandhi Jayanti', type: 'holiday', startDate: '2026-10-02T00:00:00.000Z', endDate: '2026-10-02T23:59:59.999Z', description: 'Public Holiday (Friday)', affectsClasses: true },
    { title: 'Dashahra (Vijaydashmi)', type: 'holiday', startDate: '2026-10-20T00:00:00.000Z', endDate: '2026-10-20T23:59:59.999Z', description: 'Public Holiday (Tuesday)', affectsClasses: true },
    { title: 'End Term Practical & Project Examination', type: 'exam', startDate: '2026-10-26T00:00:00.000Z', endDate: '2026-11-06T23:59:59.999Z', description: 'End Term Practical & Project Examinations', affectsClasses: true, semester },
    { title: 'Diwali (Deepavali)', type: 'holiday', startDate: '2026-11-08T00:00:00.000Z', endDate: '2026-11-08T23:59:59.999Z', description: 'Public Holiday (Sunday)', affectsClasses: true },
    { title: 'Festival Break', type: 'break', startDate: '2026-11-09T00:00:00.000Z', endDate: '2026-11-13T23:59:59.999Z', description: 'Academic Calendar Festival Break', affectsClasses: true },
    { title: 'End Term Theory Examinations', type: 'exam', startDate: '2026-11-18T00:00:00.000Z', endDate: '2026-11-30T23:59:59.999Z', description: 'End Term Theory Examinations for Odd Semester', affectsClasses: true, semester },
    { title: 'Guru Nanak Jayanti', type: 'holiday', startDate: '2026-11-24T00:00:00.000Z', endDate: '2026-11-24T23:59:59.999Z', description: 'Public Holiday (Tuesday)', affectsClasses: true },
    { title: 'Supplementary Examination', type: 'exam', startDate: '2026-12-01T00:00:00.000Z', endDate: '2026-12-10T23:59:59.999Z', description: 'Supplementary Examinations (Odd and Even Semester)', affectsClasses: true, semester },
    { title: 'Semester Break U.G. and MCA students', type: 'break', startDate: '2026-12-01T00:00:00.000Z', endDate: '2026-12-31T23:59:59.999Z', description: 'Semester Break for undergraduate students', affectsClasses: true },
    { title: 'Christmas Day', type: 'holiday', startDate: '2026-12-25T00:00:00.000Z', endDate: '2026-12-25T23:59:59.999Z', description: 'Public Holiday (Friday)', affectsClasses: true }
  ]

  let overridesCreated = 0
  let overridesSkipped = 0
  for (const o of approvedOverrides) {
    const isDuplicate = existingOverrides.some(ex =>
      ex.title === o.title &&
      new Date(ex.startDate).toISOString().slice(0, 10) === new Date(o.startDate).toISOString().slice(0, 10)
    )
    if (isDuplicate) {
      overridesSkipped++
    } else {
      const res = await fetch(`${BASE_URL}/schedule/overrides`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          ...o,
          branch,
          academicSession
        })
      })
      if (!res.ok) {
        throw new Error(`Failed to insert override ${o.title}: ${await res.text()}`)
      }
      overridesCreated++
    }
  }
  console.log(`Overrides: ${overridesCreated} created, ${overridesSkipped} already existed (no duplicates).`)

  // 3. REMINDERS INSERTION VIA API (Duplicate prevention: check by title and startDate)
  const existingRemindersRes = await fetch(`${BASE_URL}/schedule/reminders?semester=${semester}`, { headers: authHeaders })
  const existingRemindersData = await existingRemindersRes.json()
  const existingReminders = existingRemindersData.reminders || []
  console.log(`Current existing reminders in DB: ${existingReminders.length}`)

  const approvedReminders = [
    { title: 'Online Fees Payments / Clearance of dues', startDate: '2026-06-15T00:00:00.000Z', endDate: '2026-06-28T23:59:59.999Z', description: 'Registration of existing students: Online Fees Payments / Clearance of dues', category: 'fee' },
    { title: 'Online Academic Registration', startDate: '2026-06-15T00:00:00.000Z', endDate: '2026-06-28T23:59:59.999Z', description: 'Registration of existing students: Online Academic Registration', category: 'registration' },
    { title: 'Online Registration with late fees', startDate: '2026-06-29T00:00:00.000Z', endDate: '2026-07-03T23:59:59.999Z', description: 'No registration allowed after the last date (03rd July 2026)', category: 'registration' },
    { title: 'Starting of Regular Classes', startDate: '2026-07-06T00:00:00.000Z', endDate: '2026-07-06T23:59:59.999Z', description: 'Classes commence for Odd Semester July-Dec 2026', category: 'event' },
    { title: 'Display of Attendance before Mini Test', startDate: '2026-07-27T00:00:00.000Z', endDate: '2026-07-27T23:59:59.999Z', description: 'Official display of attendance cut-off before Mini Test', category: 'general' },
    { title: 'Mini Test', startDate: '2026-08-03T00:00:00.000Z', endDate: '2026-08-07T23:59:59.999Z', description: 'No separate Time Table shall be issued & Examinations to be conducted during class hours only', category: 'quiz' },
    { title: 'Display of Attendance before Mid-Term Examination', startDate: '2026-08-31T00:00:00.000Z', endDate: '2026-08-31T23:59:59.999Z', description: 'Official attendance display prior to Mid-Term examinations', category: 'general' },
    { title: 'Student Week', startDate: '2026-09-15T00:00:00.000Z', endDate: '2026-09-18T23:59:59.999Z', description: 'Student cultural and extracurricular week', category: 'event' },
    { title: 'Last date of showing Answer Booklets & Display of Mid-Term Examination Marks', startDate: '2026-09-21T00:00:00.000Z', endDate: '2026-09-21T23:59:59.999Z', description: 'Showing of Mid-Term answer booklets and display of marks', category: 'exam' },
    { title: 'Online filling of Supplementary examination forms (Odd and Even Semester)', startDate: '2026-09-28T00:00:00.000Z', endDate: '2026-10-01T23:59:59.999Z', description: 'Portal open for filling supplementary exam forms', category: 'registration' },
    { title: 'Convocation 2026 (Tentative)', startDate: '2026-10-10T00:00:00.000Z', endDate: '2026-10-10T23:59:59.999Z', description: 'Annual Institute Convocation ceremony', category: 'event' },
    { title: 'End of Teaching', startDate: '2026-10-23T00:00:00.000Z', endDate: '2026-10-23T23:59:59.999Z', description: 'Last official day of teaching instruction for the semester', category: 'event' },
    { title: 'Display of Attendance & Final Detention List (if any)', startDate: '2026-10-23T00:00:00.000Z', endDate: '2026-10-23T23:59:59.999Z', description: 'Final attendance tabulation and detention list notification', category: 'general' },
    { title: 'Students Feedback Form filling', startDate: '2026-10-26T00:00:00.000Z', endDate: '2026-10-30T23:59:59.999Z', description: 'Collection of online student course feedback', category: 'general' },
    { title: 'Online students choice filling of elective subject for next semester', startDate: '2026-11-27T00:00:00.000Z', endDate: '2026-12-04T23:59:59.999Z', description: 'Choice filling for upcoming semester elective subjects', category: 'registration' },
    { title: 'Showing of answer booklet and submission of grades on academic portal', startDate: '2026-12-02T00:00:00.000Z', endDate: '2026-12-10T23:59:59.999Z', description: 'End term answer script review and grade submission', category: 'exam' },
    { title: 'Last date of On-line submission of marks with grades for supplementary exam on academic portal', startDate: '2026-12-11T00:00:00.000Z', endDate: '2026-12-11T23:59:59.999Z', description: 'Faculty grade submission deadline for supplementary exams', category: 'exam' },
    { title: 'Declaration of Result', startDate: '2026-12-15T00:00:00.000Z', endDate: '2026-12-15T23:59:59.999Z', description: 'Official odd semester result announcement on academic portal', category: 'event' }
  ]

  let remindersCreated = 0
  let remindersSkipped = 0
  for (const r of approvedReminders) {
    const isDuplicate = existingReminders.some(ex =>
      ex.title === r.title &&
      new Date(ex.startDate).toISOString().slice(0, 10) === new Date(r.startDate).toISOString().slice(0, 10)
    )
    if (isDuplicate) {
      remindersSkipped++
    } else {
      const res = await fetch(`${BASE_URL}/schedule/reminders`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          ...r,
          semester,
          branch,
          academicSession
        })
      })
      if (!res.ok) {
        throw new Error(`Failed to insert reminder ${r.title}: ${await res.text()}`)
      }
      remindersCreated++
    }
  }
  console.log(`Reminders: ${remindersCreated} created, ${remindersSkipped} already existed (no duplicates).`)

  console.log('\nFinal DB Verification:')
  const finalClasses = await RecurringClass.countDocuments({ branch, semester, academicSession })
  const finalOverrides = await ScheduleOverride.countDocuments({ academicSession })
  const finalReminders = await AcademicReminder.countDocuments({ semester, branch, academicSession })
  console.log(`Recurring classes: ${finalClasses} total`)
  console.log(`Schedule overrides: ${finalOverrides} total`)
  console.log(`Academic reminders: ${finalReminders} total`)

  await mongoose.disconnect()
}

run().catch(err => {
  console.error('Insertion via API failed:', err)
  process.exit(1)
})
