import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { attendance, clubs, club } from '../controllers/dataController.js';
import { listClasses, getClassById, createClass, updateClass, deleteClass } from '../controllers/scheduleController.js';
import { listOverrides, getOverrideById, createOverride, updateOverride, deleteOverride } from '../controllers/overrideController.js';
import { listReminders, getReminderById, createReminder, updateReminder, deleteReminder } from '../controllers/reminderController.js';
import { chat, checkAiStatus } from '../controllers/aiController.js';

export const attendanceRouter = Router();
attendanceRouter.get('/', protect, attendance);

export const scheduleRouter = Router();
scheduleRouter.get('/', protect, listClasses);
scheduleRouter.get('/recurring', protect, listClasses);

// Calendar & Class Overrides CRUD endpoints
scheduleRouter.get('/overrides', protect, listOverrides);
scheduleRouter.get('/overrides/:id', protect, getOverrideById);
scheduleRouter.post('/overrides', protect, createOverride);
scheduleRouter.put('/overrides/:id', protect, updateOverride);
scheduleRouter.delete('/overrides/:id', protect, deleteOverride);

// Academic Reminders CRUD endpoints (does NOT affect recurring classes)
scheduleRouter.get('/reminders', protect, listReminders);
scheduleRouter.get('/reminders/:id', protect, getReminderById);
scheduleRouter.post('/reminders', protect, createReminder);
scheduleRouter.put('/reminders/:id', protect, updateReminder);
scheduleRouter.delete('/reminders/:id', protect, deleteReminder);

scheduleRouter.get('/:id', protect, getClassById);
scheduleRouter.post('/', protect, createClass);
scheduleRouter.post('/recurring', protect, createClass);
scheduleRouter.put('/:id', protect, updateClass);
scheduleRouter.delete('/:id', protect, deleteClass);

export const clubRouter = Router();
clubRouter.get('/', protect, clubs);
clubRouter.get('/:id', protect, club);

export const aiRouter = Router();
aiRouter.get('/status', protect, checkAiStatus);
aiRouter.post('/chat', protect, chat);
