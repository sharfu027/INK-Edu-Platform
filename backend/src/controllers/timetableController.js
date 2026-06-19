import Timetable from '../models/Timetable.js';
import Class from '../models/Class.js';
import Teacher from '../models/Teacher.js';
import Subject from '../models/Subject.js';
import TeacherClassSubjectMapping from '../models/TeacherClassSubjectMapping.js';
import PeriodConfiguration from '../models/PeriodConfiguration.js';

/**
 * Get weekly timetables. Optional query param classId to filter.
 */
export const getTimetables = async (req, res) => {
  const { classId } = req.query;
  try {
    const filter = {};
    if (classId) {
      filter.class = classId;
    }

    const entries = await Timetable.find(filter)
      .populate('class', 'standard section')
      .populate('teacher', 'name employeeId')
      .populate('subject', 'name')
      .sort({ day: 1, period: 1 });

    const periods = await PeriodConfiguration.find().lean();
    const periodMap = {};
    periods.forEach(p => {
      if (p.periodNumber !== null && p.periodNumber !== undefined) {
        periodMap[p.periodNumber] = p;
      }
    });

    const mappedEntries = entries.map(entry => {
      const entryObj = entry.toObject ? entry.toObject() : entry;
      const pConfig = periodMap[entryObj.period];
      if (pConfig) {
        entryObj.startTime = pConfig.startTime;
        entryObj.endTime = pConfig.endTime;
        entryObj.timeSlot = `${pConfig.startTime}-${pConfig.endTime}`;
      }
      return entryObj;
    });

    return res.status(200).json({ status: true, data: mappedEntries });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Create or update weekly timetable entries
 */
export const createTimetableEntry = async (req, res) => {
  const { classId, day, period, startTime, endTime, teacherId, subjectId } = req.body;
  try {
    // Validate references
    const cls = await Class.findById(classId);
    if (!cls) return res.status(404).json({ status: false, message: 'Class not found' });
    if (cls.isActive === false) return res.status(400).json({ status: false, message: 'Cannot schedule a timetable for a deactivated class' });

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) return res.status(404).json({ status: false, message: 'Teacher not found' });

    const subject = await Subject.findById(subjectId);
    if (!subject) return res.status(404).json({ status: false, message: 'Subject not found' });
    if (subject.isActive === false) return res.status(400).json({ status: false, message: 'Cannot schedule a timetable with a deactivated subject' });

    const periodConf = await PeriodConfiguration.findOne({ periodNumber: period });
    const finalStart = periodConf ? periodConf.startTime : startTime;
    const finalEnd = periodConf ? periodConf.endTime : endTime;

    if (!finalStart || !finalEnd) {
      return res.status(400).json({ status: false, message: 'Start time and End time are required' });
    }

    const timeSlot = `${finalStart}-${finalEnd}`;
    const teacherIdStr = teacher.teacherId || teacher.employeeId || '';
    const classNameStr = `${cls.standard}-${cls.section}`;

    // Upsert the entry (so if there's already an entry for this class/day/period, it gets overwritten)
    const entry = await Timetable.findOneAndUpdate(
      { class: classId, day, period },
      { 
        startTime: finalStart, 
        endTime: finalEnd, 
        timeSlot, 
        teacher: teacherId, 
        subject: subjectId,
        teacherId: teacherIdStr,
        className: classNameStr
      },
      { new: true, upsert: true, runValidators: true }
    );

    if (!entry.timetableId) {
      entry.timetableId = entry._id.toString();
      await entry.save();
    }

    const populated = await entry.populate([
      { path: 'class', select: 'standard section' },
      { path: 'teacher', select: 'name employeeId' },
      { path: 'subject', select: 'name' }
    ]);

    // Log to AuditLogs
    try {
      const AuditLogs = (await import('../models/AuditLogs.js')).default;
      const cName = populated.class ? `${populated.class.standard}-${populated.class.section}` : 'Unknown';
      const tName = populated.teacher ? populated.teacher.name : 'Unknown';
      await AuditLogs.create({
        logId: `${Date.now()}_mod`,
        className: cName,
        teacherName: tName,
        action: 'Timetable modifications',
        timestamp: new Date()
      });
      // Emit live socket status change for statistics/monitoring updates
      const socketModule = await import('../config/socket.js');
      const io = socketModule.getIO ? socketModule.getIO() : null;
      if (io) {
        io.emit('class_status_change', { action: 'timetable_mod' });
      }
    } catch (e) {
      console.error('Audit log failed', e);
    }

    return res.status(200).json({
      status: true,
      message: 'Timetable entry created/updated successfully',
      data: populated
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Update an existing timetable entry
 */
export const updateTimetableEntry = async (req, res) => {
  const { id } = req.params;
  const { classId, day, period, startTime, endTime, teacherId, subjectId } = req.body;
  try {
    const entry = await Timetable.findById(id);
    if (!entry) {
      return res.status(404).json({ status: false, message: 'Entry not found' });
    }

    if (classId) {
      const cls = await Class.findById(classId);
      if (!cls) return res.status(404).json({ status: false, message: 'Class not found' });
      entry.class = classId;
    }
    if (teacherId) {
      const teacher = await Teacher.findById(teacherId);
      if (!teacher) return res.status(404).json({ status: false, message: 'Teacher not found' });
      entry.teacher = teacherId;
    }
    if (subjectId) {
      const subject = await Subject.findById(subjectId);
      if (!subject) return res.status(404).json({ status: false, message: 'Subject not found' });
      entry.subject = subjectId;
    }

    if (day) entry.day = day;
    if (period) entry.period = period;

    const targetPeriod = period || entry.period;
    const periodConf = await PeriodConfiguration.findOne({ periodNumber: targetPeriod });
    if (periodConf) {
      entry.startTime = periodConf.startTime;
      entry.endTime = periodConf.endTime;
      entry.timeSlot = `${periodConf.startTime}-${periodConf.endTime}`;
    } else {
      if (startTime) entry.startTime = startTime;
      if (endTime) entry.endTime = endTime;
      if (startTime || endTime) {
        const s = startTime || entry.startTime;
        const e = endTime || entry.endTime;
        entry.timeSlot = `${s}-${e}`;
      }
    }

    await entry.save();

    const populated = await entry.populate([
      { path: 'class', select: 'standard section' },
      { path: 'teacher', select: 'name employeeId' },
      { path: 'subject', select: 'name' }
    ]);

    // Log to AuditLogs
    try {
      const AuditLogs = (await import('../models/AuditLogs.js')).default;
      const cName = populated.class ? `${populated.class.standard}-${populated.class.section}` : 'Unknown';
      const tName = populated.teacher ? populated.teacher.name : 'Unknown';
      await AuditLogs.create({
        logId: `${Date.now()}_mod`,
        className: cName,
        teacherName: tName,
        action: 'Timetable modifications',
        timestamp: new Date()
      });
      const socketModule = await import('../config/socket.js');
      const io = socketModule.getIO ? socketModule.getIO() : null;
      if (io) {
        io.emit('class_status_change', { action: 'timetable_mod' });
      }
    } catch (e) {
      console.error('Audit log failed', e);
    }

    return res.status(200).json({
      status: true,
      message: 'Timetable entry updated successfully',
      data: populated
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Delete a timetable entry
 */
export const deleteTimetableEntry = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Timetable.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ status: false, message: 'Entry not found' });
    }

    // Log to AuditLogs
    try {
      const AuditLogs = (await import('../models/AuditLogs.js')).default;
      const ClassModel = (await import('../models/Class.js')).default;
      const TeacherModel = (await import('../models/Teacher.js')).default;

      const cls = await ClassModel.findById(deleted.class);
      const teacherDoc = await TeacherModel.findById(deleted.teacher);

      const cName = cls ? `${cls.standard}-${cls.section}` : 'Unknown';
      const tName = teacherDoc ? teacherDoc.name : 'Unknown';

      await AuditLogs.create({
        logId: `${Date.now()}_mod`,
        className: cName,
        teacherName: tName,
        action: 'Timetable modifications',
        timestamp: new Date()
      });
      const socketModule = await import('../config/socket.js');
      const io = socketModule.getIO ? socketModule.getIO() : null;
      if (io) {
        io.emit('class_status_change', { action: 'timetable_mod' });
      }
    } catch (e) {
      console.error('Audit log failed', e);
    }

    return res.status(200).json({ status: true, message: 'Timetable entry deleted successfully' });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};


/**
 * Create a timetable entry by a teacher directly
 */
export const createTeacherSchedule = async (req, res) => {
  const { standard, section, board, subjectName, day, date, period, timeSlot } = req.body;
  try {
    const teacher = await Teacher.findOne({ user: req.user._id });
    if (!teacher) {
      return res.status(404).json({ status: false, message: 'Teacher profile not found' });
    }

    if (!standard || !section || !board || !subjectName || !period || !timeSlot) {
      return res.status(400).json({ status: false, message: 'Missing required fields: standard, section, board, subjectName, period, timeSlot' });
    }

    // 1. Find or create Class
    let cls = await Class.findOne({ standard, section, board });
    if (!cls) {
      cls = await Class.create({
        standard,
        section,
        board,
        strength: 40
      });
    }

    // 2. Find or create Subject
    let subject = await Subject.findOne({ name: { $regex: new RegExp(`^${subjectName.trim()}$`, 'i') } });
    if (!subject) {
      subject = await Subject.create({ name: subjectName.trim() });
    }

    // 3. Create mapping if not exists
    let mapping = await TeacherClassSubjectMapping.findOne({
      teacher: teacher._id,
      class: cls._id,
      subject: subject._id
    });
    if (!mapping) {
      await TeacherClassSubjectMapping.create({
        teacher: teacher._id,
        class: cls._id,
        subject: subject._id
      });
    }

    // 4. Resolve Day
    let entryDay = day;
    if (date && !entryDay) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const d = new Date(date);
      entryDay = days[d.getDay()];
    }
    if (!entryDay) {
      return res.status(400).json({ status: false, message: 'Day of week is required if date is not provided' });
    }

    // 5. Create or update Timetable slot
    const findQuery = {
      class: cls._id,
      day: entryDay,
      period
    };
    if (date) {
      findQuery.date = date;
    } else {
      findQuery.$or = [{ date: null }, { date: { $exists: false } }];
    }

    const [startTime, endTime] = timeSlot.split('-');
    const teacherIdStr = teacher.teacherId || teacher.employeeId || '';
    const classNameStr = `${cls.standard}-${cls.section}`;

    const updatePayload = {
      timeSlot,
      startTime: startTime || '09:00',
      endTime: endTime || '09:45',
      teacher: teacher._id,
      subject: subject._id,
      teacherId: teacherIdStr,
      className: classNameStr
    };
    if (date) {
      updatePayload.date = date;
    }

    const entry = await Timetable.findOneAndUpdate(
      findQuery,
      updatePayload,
      { new: true, upsert: true, runValidators: true }
    );

    if (!entry.timetableId) {
      entry.timetableId = entry._id.toString();
      await entry.save();
    }

    const populated = await entry.populate([
      { path: 'class', select: 'standard section board' },
      { path: 'teacher', select: 'name employeeId' },
      { path: 'subject', select: 'name' }
    ]);

    return res.status(200).json({
      status: true,
      message: 'Schedule entry created/updated successfully',
      data: populated
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};
