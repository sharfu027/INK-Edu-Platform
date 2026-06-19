import Timetable from '../models/Timetable.js';
import ClassSession from '../models/ClassSession.js';
import AuditLogs from '../models/AuditLogs.js';
import Class from '../models/Class.js';
import TeacherAttendance from '../models/TeacherAttendance.js';
import { getIO } from '../config/socket.js';
import PeriodConfiguration from '../models/PeriodConfiguration.js';

const getLocalDateString = () => {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().split('T')[0];
};

const getDayFromDate = (dateStr) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const d = new Date(dateStr);
  return days[d.getUTCDay()];
};

const getScheduledTime = (dateStr, timeStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [h, m] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, h, m, 0, 0);
};

const getAllTimetableForDate = async (dateStr, day) => {
  const classes = await Class.find();
  const allEntries = [];
  for (const cls of classes) {
    const overrides = await Timetable.find({ class: cls._id, date: dateStr })
      .populate('class')
      .populate('teacher')
      .populate('subject')
      .lean();
    if (overrides.length > 0) {
      allEntries.push(...overrides);
    } else {
      const defaults = await Timetable.find({ class: cls._id, day, $or: [{ date: null }, { date: { $exists: false } }] })
        .populate('class')
        .populate('teacher')
        .populate('subject')
        .lean();
      allEntries.push(...defaults);
    }
  }

  const periods = await PeriodConfiguration.find().lean();
  const periodMap = {};
  periods.forEach(p => {
    if (p.periodNumber !== null && p.periodNumber !== undefined) {
      periodMap[p.periodNumber] = p;
    }
  });

  allEntries.forEach(entry => {
    const pConfig = periodMap[entry.period];
    if (pConfig) {
      entry.startTime = pConfig.startTime;
      entry.endTime = pConfig.endTime;
      entry.timeSlot = `${pConfig.startTime}-${pConfig.endTime}`;
    }
  });

  return allEntries;
};

export const runComplianceCheck = async () => {
  try {
    const todayStr = getLocalDateString();
    const day = getDayFromDate(todayStr);

    if (day === 'Sunday') return;

    const todayEntries = await getAllTimetableForDate(todayStr, day);
    const sessions = await ClassSession.find({ date: todayStr }).lean();

    const now = new Date();

    for (const entry of todayEntries) {
      const cls = entry.class;
      if (!cls) continue;

      const session = sessions.find(s => 
        (s.class?._id || s.class)?.toString() === (cls._id || cls).toString() &&
        s.period === entry.period
      );

      // If no session exists, check if it has been delayed / teacher is absent
      if (!session) {
        const startTimeStr = entry.startTime || entry.timeSlot.split('-')[0];
        const schedStart = getScheduledTime(todayStr, startTimeStr);
        const diffMins = (now - schedStart) / (1000 * 60);

        // If current time is past scheduled start by more than 10 minutes
        if (diffMins > 10) {
          const className = entry.className || `${cls.standard}-${cls.section}`;
          const assignedTeacherName = entry.teacher?.name || 'Not Assigned';
          
          const logId = `${todayStr}_${(cls._id || cls).toString()}_${entry.period}_alert_red`;

          // Check if this alert was already generated today
          const existingAlert = await AuditLogs.findOne({ logId });
          if (!existingAlert) {
            // Write alert entry to AuditLogs
            await AuditLogs.create({
              logId,
              className,
              teacherName: assignedTeacherName,
              action: 'Attendance Alert',
              timestamp: new Date()
            });

            console.log(`[Compliance Alert] RED status alert logged for ${className}, Period ${entry.period}`);

            // Emit live updates to sockets so UI updates instantly
            const io = getIO();
            if (io) {
              io.emit('class_status_change', {
                classId: (cls._id || cls).toString(),
                period: entry.period,
                date: todayStr,
                action: 'alert_red',
                className
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error in compliance check background job:', error);
  }
};

let intervalId = null;

export const startComplianceJob = () => {
  if (intervalId) return;
  // Run compliance check every 30 seconds
  intervalId = setInterval(runComplianceCheck, 30000);
  console.log('Compliance Check Background Job started.');
};

export const stopComplianceJob = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('Compliance Check Background Job stopped.');
  }
};
