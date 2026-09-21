import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const CODE_MAP = [
  { match: { $or: [{ code: 'ECE 5001' }, { code: 'ECE-5001' }] }, update: { subject: 'VLSI-D', code: 'ECE-5001' } },
  { match: { $or: [{ code: 'ECE 5002' }, { code: 'ECE-5002' }] }, update: { subject: 'Microwave Engineering', code: 'ECE-5002' } },
  { match: { $or: [{ code: 'ECE 5003' }, { code: 'ECE-5003' }] }, update: { subject: 'DIP', code: 'ECE-5003' } },
  { match: { $or: [{ code: 'ECE 5004' }, { code: 'ECE-5004' }] }, update: { subject: 'Mobile and Wireless Communication', code: 'ECE-5004' } },
  { match: { $or: [{ code: 'ECE 5005' }, { code: 'ECE-5005' }] }, update: { subject: 'PD Lab', code: 'ECE-5005' } },
  { match: { $or: [{ code: 'ECE 5102' }, { code: 'ECE-5102' }] }, update: { subject: 'DSD', code: 'ECE-5102' } },
  { match: { $or: [{ code: 'ECE 5103' }, { code: 'ECE-5103' }] }, update: { subject: 'OS', code: 'ECE-5103' } }
];

await mongoose.connect(process.env.MONGO_URI);
const db = mongoose.connection.db;
const col = db.collection('recurringclasses');

for (const rule of CODE_MAP) {
  const res = await col.updateMany(rule.match, { $set: rule.update });
  console.log(`Updated for rule ${rule.update.code} (${rule.update.subject}): matched ${res.matchedCount}, modified ${res.modifiedCount}`);
}

// Also update lab field where isLab is true
await col.updateMany({ isLab: true, code: 'ECE-5001' }, { $set: { lab: 'VLSI-D' } });
await col.updateMany({ isLab: true, code: 'ECE-5002' }, { $set: { lab: 'Microwave Engineering' } });
await col.updateMany({ isLab: true, code: 'ECE-5003' }, { $set: { lab: 'DIP' } });
await col.updateMany({ isLab: true, code: 'ECE-5005' }, { $set: { lab: 'PD Lab' } });

// Print final result
const classes = await col.find({ semester: 5, branch: 'ECE' }).sort({ day: 1, startTime: 1 }).toArray();
console.log('\n--- FINAL UPDATED CLASSES IN MONGODB ---');
for (const c of classes) {
  console.log(`${c.day.padEnd(9)} | ${c.startTime}-${c.endTime} | code: '${c.code}' | subject: '${c.subject.padEnd(32)}' | teacher: '${c.teacher.padEnd(7)}' | room: '${c.room}' | batch: '${c.batch}' | isLab: ${c.isLab}`);
}

await mongoose.disconnect();
console.log('\nSuccessfully finished MongoDB update.');
