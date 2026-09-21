import '../config/env.js'
import mongoose from 'mongoose'
import User from '../models/User.js'
import RecurringClass from '../models/RecurringClass.js'
import ScheduleOverride from '../models/ScheduleOverride.js'
import AcademicReminder from '../models/AcademicReminder.js'

async function seed() {
  console.log('Connecting to MongoDB...')
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campus-notes')
  console.log('Connected.')

  let systemUser = await User.findOne({ role: 'admin' })
  if (!systemUser) {
    systemUser = await User.findOne()
  }
  if (!systemUser) {
    systemUser = await User.create({
      name: 'Academic Administrator',
      email: 'admin@iiitbhopal.ac.in',
      password: '$2a$12$eXAmPLeHaShEdPaSsWoRdDoNoTuSeDiReCtLy1234567890',
      branch: 'ECE',
      graduationYear: 2026,
      role: 'admin'
    })
    console.log('Created Academic Administrator user:', systemUser._id)
  } else {
    console.log('Using existing user as creator:', systemUser._id, systemUser.email)
  }

  const userId = systemUser._id
  const branch = 'ECE'
  const semester = 5
  const academicSession = 'July-Dec 2026'

  console.log('Cleaning existing Sem 5 ECE records for July-Dec 2026...')
  await RecurringClass.deleteMany({ branch, semester, academicSession })
  await ScheduleOverride.deleteMany({ branch: { $in: [branch, 'All'] }, academicSession })
  await AcademicReminder.deleteMany({ branch: { $in: [branch, 'All'] }, academicSession })

  // 1. RECURRING WEEKLY CLASSES
  const recurringClasses = [
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
  ].map(c => ({
    ...c,
    branch,
    semester,
    academicSession,
    createdBy: userId
  }))

  const insertedClasses = await RecurringClass.insertMany(recurringClasses)
  console.log(`Inserted ${insertedClasses.length} recurring weekly classes.`)

  // 2. CLASS-AFFECTING OVERRIDES (holidays, exams, breaks)
  const overrides = [
    {
      title: 'Independence Day',
      type: 'holiday',
      startDate: new Date('2026-08-15T00:00:00.000Z'),
      endDate: new Date('2026-08-15T23:59:59.999Z'),
      description: 'Public Holiday (Saturday)',
      affectsClasses: true
    },
    {
      title: 'Milad-Un-Navi / Eid-E-Milad',
      type: 'holiday',
      startDate: new Date('2026-08-26T00:00:00.000Z'),
      endDate: new Date('2026-08-26T23:59:59.999Z'),
      description: 'Public Holiday (Hajrat Mohd. Sahab Birthday) (Wednesday)',
      affectsClasses: true
    },
    {
      title: 'Janmasthmi',
      type: 'holiday',
      startDate: new Date('2026-09-04T00:00:00.000Z'),
      endDate: new Date('2026-09-04T23:59:59.999Z'),
      description: 'Public Holiday (Friday)',
      affectsClasses: true
    },
    {
      title: 'Mid-Term Examination',
      type: 'exam',
      startDate: new Date('2026-09-04T00:00:00.000Z'),
      endDate: new Date('2026-09-11T23:59:59.999Z'),
      description: 'Mid-Term Examinations for Odd Semester',
      affectsClasses: true,
      semester
    },
    {
      title: 'Ganesh Chaturthi / Vinayaka Chaturthi',
      type: 'holiday',
      startDate: new Date('2026-09-14T00:00:00.000Z'),
      endDate: new Date('2026-09-14T23:59:59.999Z'),
      description: 'Public Holiday (Monday)',
      affectsClasses: true
    },
    {
      title: 'Mahatma Gandhi Jayanti',
      type: 'holiday',
      startDate: new Date('2026-10-02T00:00:00.000Z'),
      endDate: new Date('2026-10-02T23:59:59.999Z'),
      description: 'Public Holiday (Friday)',
      affectsClasses: true
    },
    {
      title: 'Dashahra (Vijaydashmi)',
      type: 'holiday',
      startDate: new Date('2026-10-20T00:00:00.000Z'),
      endDate: new Date('2026-10-20T23:59:59.999Z'),
      description: 'Public Holiday (Tuesday)',
      affectsClasses: true
    },
    {
      title: 'End Term Practical & Project Examination',
      type: 'exam',
      startDate: new Date('2026-10-26T00:00:00.000Z'),
      endDate: new Date('2026-11-06T23:59:59.999Z'),
      description: 'End Term Practical & Project Examinations',
      affectsClasses: true,
      semester
    },
    {
      title: 'Diwali (Deepavali)',
      type: 'holiday',
      startDate: new Date('2026-11-08T00:00:00.000Z'),
      endDate: new Date('2026-11-08T23:59:59.999Z'),
      description: 'Public Holiday (Sunday)',
      affectsClasses: true
    },
    {
      title: 'Festival Break',
      type: 'break',
      startDate: new Date('2026-11-09T00:00:00.000Z'),
      endDate: new Date('2026-11-13T23:59:59.999Z'),
      description: 'Academic Calendar Festival Break',
      affectsClasses: true
    },
    {
      title: 'End Term Theory Examinations',
      type: 'exam',
      startDate: new Date('2026-11-18T00:00:00.000Z'),
      endDate: new Date('2026-11-30T23:59:59.999Z'),
      description: 'End Term Theory Examinations for Odd Semester',
      affectsClasses: true,
      semester
    },
    {
      title: 'Guru Nanak Jayanti',
      type: 'holiday',
      startDate: new Date('2026-11-24T00:00:00.000Z'),
      endDate: new Date('2026-11-24T23:59:59.999Z'),
      description: 'Public Holiday (Tuesday)',
      affectsClasses: true
    },
    {
      title: 'Supplementary Examination',
      type: 'exam',
      startDate: new Date('2026-12-01T00:00:00.000Z'),
      endDate: new Date('2026-12-10T23:59:59.999Z'),
      description: 'Supplementary Examinations (Odd and Even Semester)',
      affectsClasses: true,
      semester
    },
    {
      title: 'Semester Break U.G. and MCA students',
      type: 'break',
      startDate: new Date('2026-12-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T23:59:59.999Z'),
      description: 'Semester Break for undergraduate students',
      affectsClasses: true
    },
    {
      title: 'Christmas Day',
      type: 'holiday',
      startDate: new Date('2026-12-25T00:00:00.000Z'),
      endDate: new Date('2026-12-25T23:59:59.999Z'),
      description: 'Public Holiday (Friday)',
      affectsClasses: true
    }
  ].map(o => ({
    ...o,
    branch: o.branch || branch,
    academicSession,
    createdBy: userId
  }))

  const insertedOverrides = await ScheduleOverride.insertMany(overrides)
  console.log(`Inserted ${insertedOverrides.length} class-affecting overrides.`)

  // 3. ACADEMIC REMINDERS (Does NOT affect recurring classes)
  const reminders = [
    {
      title: 'Online Fees Payments / Clearance of dues',
      startDate: new Date('2026-06-15T00:00:00.000Z'),
      endDate: new Date('2026-06-28T23:59:59.999Z'),
      description: 'Registration of existing students: Online Fees Payments / Clearance of dues',
      category: 'fee'
    },
    {
      title: 'Online Academic Registration',
      startDate: new Date('2026-06-15T00:00:00.000Z'),
      endDate: new Date('2026-06-28T23:59:59.999Z'),
      description: 'Registration of existing students: Online Academic Registration',
      category: 'registration'
    },
    {
      title: 'Online Registration with late fees',
      startDate: new Date('2026-06-29T00:00:00.000Z'),
      endDate: new Date('2026-07-03T23:59:59.999Z'),
      description: 'No registration allowed after the last date (03rd July 2026)',
      category: 'registration'
    },
    {
      title: 'Starting of Regular Classes',
      startDate: new Date('2026-07-06T00:00:00.000Z'),
      endDate: new Date('2026-07-06T23:59:59.999Z'),
      description: 'Classes commence for Odd Semester July-Dec 2026',
      category: 'event'
    },
    {
      title: 'Display of Attendance before Mini Test',
      startDate: new Date('2026-07-27T00:00:00.000Z'),
      endDate: new Date('2026-07-27T23:59:59.999Z'),
      description: 'Official display of attendance cut-off before Mini Test',
      category: 'general'
    },
    {
      title: 'Mini Test',
      startDate: new Date('2026-08-03T00:00:00.000Z'),
      endDate: new Date('2026-08-07T23:59:59.999Z'),
      description: 'No separate Time Table shall be issued & Examinations to be conducted during class hours only',
      category: 'quiz'
    },
    {
      title: 'Display of Attendance before Mid-Term Examination',
      startDate: new Date('2026-08-31T00:00:00.000Z'),
      endDate: new Date('2026-08-31T23:59:59.999Z'),
      description: 'Official attendance display prior to Mid-Term examinations',
      category: 'general'
    },
    {
      title: 'Student Week',
      startDate: new Date('2026-09-15T00:00:00.000Z'),
      endDate: new Date('2026-09-18T23:59:59.999Z'),
      description: 'Student cultural and extracurricular week',
      category: 'event'
    },
    {
      title: 'Last date of showing Answer Booklets & Display of Mid-Term Examination Marks',
      startDate: new Date('2026-09-21T00:00:00.000Z'),
      endDate: new Date('2026-09-21T23:59:59.999Z'),
      description: 'Showing of Mid-Term answer booklets and display of marks',
      category: 'exam'
    },
    {
      title: 'Online filling of Supplementary examination forms (Odd and Even Semester)',
      startDate: new Date('2026-09-28T00:00:00.000Z'),
      endDate: new Date('2026-10-01T23:59:59.999Z'),
      description: 'Portal open for filling supplementary exam forms',
      category: 'registration'
    },
    {
      title: 'Convocation 2026 (Tentative)',
      startDate: new Date('2026-10-10T00:00:00.000Z'),
      endDate: new Date('2026-10-10T23:59:59.999Z'),
      description: 'Annual Institute Convocation ceremony',
      category: 'event'
    },
    {
      title: 'End of Teaching',
      startDate: new Date('2026-10-23T00:00:00.000Z'),
      endDate: new Date('2026-10-23T23:59:59.999Z'),
      description: 'Last official day of teaching instruction for the semester',
      category: 'event'
    },
    {
      title: 'Display of Attendance & Final Detention List (if any)',
      startDate: new Date('2026-10-23T00:00:00.000Z'),
      endDate: new Date('2026-10-23T23:59:59.999Z'),
      description: 'Final attendance tabulation and detention list notification',
      category: 'general'
    },
    {
      title: 'Students Feedback Form filling',
      startDate: new Date('2026-10-26T00:00:00.000Z'),
      endDate: new Date('2026-10-30T23:59:59.999Z'),
      description: 'Collection of online student course feedback',
      category: 'general'
    },
    {
      title: 'Online students choice filling of elective subject for next semester',
      startDate: new Date('2026-11-27T00:00:00.000Z'),
      endDate: new Date('2026-12-04T23:59:59.999Z'),
      description: 'Choice filling for upcoming semester elective subjects',
      category: 'registration'
    },
    {
      title: 'Showing of answer booklet and submission of grades on academic portal',
      startDate: new Date('2026-12-02T00:00:00.000Z'),
      endDate: new Date('2026-12-10T23:59:59.999Z'),
      description: 'End term answer script review and grade submission',
      category: 'exam'
    },
    {
      title: 'Last date of On-line submission of marks with grades for supplementary exam on academic portal',
      startDate: new Date('2026-12-11T00:00:00.000Z'),
      endDate: new Date('2026-12-11T23:59:59.999Z'),
      description: 'Faculty grade submission deadline for supplementary exams',
      category: 'exam'
    },
    {
      title: 'Declaration of Result',
      startDate: new Date('2026-12-15T00:00:00.000Z'),
      endDate: new Date('2026-12-15T23:59:59.999Z'),
      description: 'Official odd semester result announcement on academic portal',
      category: 'event'
    }
  ].map(r => ({
    ...r,
    semester,
    branch,
    academicSession,
    affectsClasses: false,
    createdBy: userId
  }))

  const insertedReminders = await AcademicReminder.insertMany(reminders)
  console.log(`Inserted ${insertedReminders.length} academic reminders.`)

  console.log('Seeding completed successfully!')
  await mongoose.disconnect()
}

seed().catch(err => {
  console.error('Seeding failed:', err)
  process.exit(1)
})
