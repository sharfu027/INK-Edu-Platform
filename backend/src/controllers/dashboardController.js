import Timetable from '../models/Timetable.js';
import Teacher from '../models/Teacher.js';
import TeacherAttendance from '../models/TeacherAttendance.js';
import SubstituteAssignment from '../models/SubstituteAssignment.js';
import Notification from '../models/Notification.js';
import Class from '../models/Class.js';
import Subject from '../models/Subject.js';
import ClassSession from '../models/ClassSession.js';
import ClassAuditLog from '../models/ClassAuditLog.js';


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

const getComplianceStatus = (entry, session, dateStr) => {
  const queryDate = dateStr || getLocalDateString();
  
  if (session) {
    const assignedTeacherId = (entry.teacher?._id || entry.teacher)?.toString();
    const sessionTeacherId = (session.teacher?._id || session.teacher)?.toString();
    
    // PURPLE (Substitute Active)
    if (assignedTeacherId && sessionTeacherId && assignedTeacherId !== sessionTeacherId) {
      return 'purple';
    }
    
    const schedStart = getScheduledTime(queryDate, entry.startTime || entry.timeSlot.split('-')[0]);
    const actualLogin = new Date(session.loginTime);
    const diffMins = (actualLogin - schedStart) / (1000 * 60);
    
    if (diffMins <= 10) {
      return 'green';
    } else if (diffMins <= 15) {
      return 'yellow';
    } else {
      return 'red';
    }
  } else {
    const schedStart = getScheduledTime(queryDate, entry.startTime || entry.timeSlot.split('-')[0]);
    const now = new Date();
    const diffMins = (now - schedStart) / (1000 * 60);
    
    if (now < schedStart || diffMins <= 10) {
      return 'blue';
    } else {
      return 'red';
    }
  }
};

/**
 * Helper to parse timeSlot (e.g. "09:00-09:45") and check if it's completed, active, or upcoming
 */
const getPeriodStatus = (timeSlot) => {
  try {
    const [startStr, endStr] = timeSlot.split('-');
    const now = new Date();
    const [startH, startM] = startStr.split(':').map(Number);
    const [endH, endM] = endStr.split(':').map(Number);

    const startTime = new Date();
    startTime.setHours(startH, startM, 0, 0);

    const endTime = new Date();
    endTime.setHours(endH, endM, 0, 0);

    if (now > endTime) return 'completed';
    if (now >= startTime && now <= endTime) return 'active';
    return 'upcoming';
  } catch {
    return 'upcoming';
  }
};

const getClassDuration = (timeSlot) => {
  try {
    const [startStr, endStr] = timeSlot.split('-');
    const [startH, startM] = startStr.split(':').map(Number);
    const [endH, endM] = endStr.split(':').map(Number);
    const diffMins = (endH * 60 + endM) - (startH * 60 + startM);
    return diffMins > 0 ? diffMins : 45;
  } catch {
    return 45;
  }
};

const getAllTimetableForDate = async (dateStr, day) => {
  const classes = await Class.find();
  const allEntries = [];
  for (const cls of classes) {
    // Check overrides
    const overrides = await Timetable.find({ class: cls._id, date: dateStr })
      .populate('class', 'standard section board strength')
      .populate('teacher', 'name employeeId')
      .populate('subject', 'name')
      .lean();
    if (overrides.length > 0) {
      allEntries.push(...overrides);
    } else {
      const defaults = await Timetable.find({ class: cls._id, day, $or: [{ date: null }, { date: { $exists: false } }] })
        .populate('class', 'standard section board strength')
        .populate('teacher', 'name employeeId')
        .populate('subject', 'name')
        .lean();
      allEntries.push(...defaults);
    }
  }
  return allEntries;
};

/**
 * Teacher Dashboard Data
 */
export const getTeacherDashboard = async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user._id });
    if (!teacher) {
      return res.status(200).json({
        status: true,
        data: {
          schedule: [],
          cards: { total: 0, completed: 0, upcoming: 0, substitute: 0 },
          notifications: []
        }
      });
    }

    const todayStr = getLocalDateString();
    const day = getDayFromDate(todayStr);

    if (day === 'Sunday') {
      return res.status(200).json({
        status: true,
        data: {
          schedule: [],
          cards: { total: 0, completed: 0, upcoming: 0, substitute: 0 },
          notifications: []
        }
      });
    }

    const TeacherClassSubjectMapping = (await import('../models/TeacherClassSubjectMapping.js')).default;
    const Class = (await import('../models/Class.js')).default;

    // Fetch all classes mapped to this teacher
    const teacherMappings = await TeacherClassSubjectMapping.find({ teacher: teacher._id })
      .populate('class')
      .populate('subject')
      .lean();

    // Fetch classes where this teacher is class teacher
    const classTeacherClasses = await Class.find({ classTeacher: teacher._id }).lean();

    const isAbsentToday = await TeacherAttendance.findOne({
      date: todayStr,
      teacher: teacher._id,
      status: { $in: ['Absent', 'Leave'] }
    });

    const schedule = [];
    const seenClasses = new Set();
    const defaultSlots = {
      1: { s: '09:00', e: '09:45' },
      2: { s: '09:45', e: '10:30' },
      3: { s: '10:45', e: '11:30' },
      4: { s: '11:30', e: '12:15' },
      5: { s: '13:00', e: '13:45' },
      6: { s: '13:45', e: '14:30' },
      7: { s: '14:45', e: '15:30' },
      8: { s: '15:30', e: '16:15' }
    };

    if (!isAbsentToday) {
      // Fetch today's timetable entries for this teacher
      let todayEntries = await Timetable.find({ teacher: teacher._id, date: todayStr })
        .populate('class')
        .populate('subject')
        .lean();
      if (todayEntries.length === 0) {
        todayEntries = await Timetable.find({
          teacher: teacher._id,
          day,
          $or: [{ date: null }, { date: { $exists: false } }]
        })
        .populate('class')
        .populate('subject')
        .lean();
      }

      // Sort entries by period
      todayEntries.sort((a, b) => a.period - b.period);

      for (const entry of todayEntries) {
        const session = await ClassSession.findOne({
          class: entry.class?._id || entry.class,
          period: entry.period,
          date: todayStr
        }).populate('teacher').populate('subject').lean();

        let classStatusText = 'upcoming';
        if (session) {
          classStatusText = session.status;
        } else {
          const pStatus = getPeriodStatus(entry.timeSlot);
          if (pStatus === 'completed' || pStatus === 'active') {
            classStatusText = pStatus;
          }
        }

        let classMarkColor = 'stone';
        let teacherMarkColor = 'stone';
        let arrangedMarkColor = null;

        if (session) {
          if (session.status === 'active') {
            classMarkColor = 'green';
          } else {
            classMarkColor = 'red';
          }

          const activeTeacherStrId = (session.teacher?._id || session.teacher)?.toString();
          if (activeTeacherStrId === teacher._id.toString()) {
            teacherMarkColor = 'green';
          } else {
            teacherMarkColor = 'red';
            arrangedMarkColor = 'orange'; // Substitute teacher took it
          }
        } else {
          const pStatus = getPeriodStatus(entry.timeSlot);
          if (pStatus === 'completed' || pStatus === 'active') {
            classMarkColor = 'red';
            teacherMarkColor = 'red';
          }
        }

        schedule.push({
          type: 'regular',
          period: entry.period,
          timeSlot: entry.timeSlot,
          duration: getClassDuration(entry.timeSlot),
          standard: entry.class?.standard || 'N/A',
          section: entry.class?.section || 'N/A',
          board: entry.class?.board || 'CBSE',
          classId: entry.class?._id || entry.class,
          subject: entry.subject?.name || 'Not Assigned',
          subjectId: entry.subject?._id || null,
          status: classStatusText,
          classSession: session ? { loginTime: session.loginTime, logoutTime: session.logoutTime, status: session.status } : null,
          classMarkColor,
          teacherMarkColor,
          arrangedMarkColor
        });
      }
    }

    const total = schedule.length;
    const completed = schedule.filter(s => s.status === 'completed').length;
    const upcoming = schedule.filter(s => s.status === 'upcoming').length;
    const substitute = schedule.filter(s => s.arrangedMarkColor === 'orange').length;

    const notifications = await Notification.find({ recipient: req.user._id, isRead: false })
      .sort({ createdAt: -1 })
      .limit(10);

    return res.status(200).json({
      status: true,
      data: {
        schedule,
        cards: {
          total,
          completed,
          upcoming,
          substitute
        },
        notifications
      }
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Admin/Principal Dashboard Classroom Live Status
 */
export const getAdminDashboard = async (req, res) => {
  try {
    const todayStr = getLocalDateString();
    const day = getDayFromDate(todayStr);

    if (day === 'Sunday') {
      return res.status(200).json({
        status: true,
        data: {
          activeClasses: [],
          classesWithoutTeacher: [],
          substitutePending: [],
          allTodayPeriods: [],
          stats: { totalTeachers: 0, presentTeachers: 0, absentTeachers: 0, greenClasses: 0, redClasses: 0, goldClasses: 0 }
        }
      });
    }

    const Class = (await import('../models/Class.js')).default;
    const TeacherClassSubjectMapping = (await import('../models/TeacherClassSubjectMapping.js')).default;
    const ClassSession = (await import('../models/ClassSession.js')).default;
    const Teacher = (await import('../models/Teacher.js')).default;
    const TeacherAttendance = (await import('../models/TeacherAttendance.js')).default;

    const classes = await Class.find().populate('classTeacher', 'name employeeId').lean();
    const mappings = await TeacherClassSubjectMapping.find()
      .populate('teacher', 'name employeeId')
      .populate('class', 'standard section')
      .populate('subject', 'name')
      .lean();
    
    const sessions = await ClassSession.find({ date: todayStr }).populate('teacher').populate('subject').lean();
    const attendances = await TeacherAttendance.find({ date: todayStr }).lean();
    const allTeachers = await Teacher.find({ status: 'Active' }).lean();

    const todayEntries = await getAllTimetableForDate(todayStr, day);

    const activeClasses = [];
    const classesWithoutTeacher = [];
    const substitutePending = [];
    const allTodayPeriods = [];

    let greenClasses = 0;
    let yellowClasses = 0;
    let redClasses = 0;
    let purpleClasses = 0;
    let blueClasses = 0;

    for (const entry of todayEntries) {
      const cls = entry.class;
      if (!cls) continue;

      const session = sessions.find(s => 
        (s.class?._id || s.class)?.toString() === (cls._id || cls).toString() &&
        s.period === entry.period
      );

      const status = getComplianceStatus(entry, session, todayStr);

      const assignedTeacherName = entry.teacher?.name || 'Not Assigned';
      const assignedTeacherIdStr = (entry.teacher?._id || entry.teacher)?.toString() || '';
      const subjectName = entry.subject?.name || 'Not Assigned';
      const subjectIdStr = (entry.subject?._id || entry.subject)?.toString() || '';

      const className = entry.className || `${cls.standard}-${cls.section}`;

      let color = 'blue';
      let statusText = '🔵 Upcoming';

      if (status === 'green') {
        color = 'green';
        statusText = '🟢 On Time';
        greenClasses++;
        activeClasses.push({
          class: `${className} (${cls.board || 'CBSE'})`,
          teacher: assignedTeacherName,
          subject: subjectName,
          duration: 45,
          classStatus: 'going',
          classMarkColor: 'green',
          teacherMarkColor: 'green',
          arrangedMarkColor: null
        });
      } else if (status === 'yellow') {
        color = 'yellow';
        statusText = '🟡 Late';
        yellowClasses++;
        activeClasses.push({
          class: `${className} (${cls.board || 'CBSE'})`,
          teacher: assignedTeacherName,
          subject: subjectName,
          duration: 45,
          classStatus: 'going',
          classMarkColor: 'green',
          teacherMarkColor: 'green',
          arrangedMarkColor: null
        });
      } else if (status === 'purple') {
        color = 'purple';
        statusText = '🟣 Substitute Active';
        purpleClasses++;
        activeClasses.push({
          class: `${className} (${cls.board || 'CBSE'})`,
          teacher: session?.teacher?.name || 'Substitute',
          subject: session?.subject?.name || subjectName,
          duration: 45,
          classStatus: 'going',
          classMarkColor: 'green',
          teacherMarkColor: 'green',
          arrangedMarkColor: 'orange'
        });
      } else if (status === 'red') {
        color = 'red';
        statusText = '🔴 Absent/Delayed';
        redClasses++;
        classesWithoutTeacher.push({
          class: `${className} (${cls.board || 'CBSE'})`,
          subject: subjectName,
          absentTeacher: assignedTeacherName,
          duration: 45,
          classStatus: 'not-taken',
          classMarkColor: 'red',
          teacherMarkColor: 'red',
          arrangedMarkColor: null
        });
        substitutePending.push({
          class: `${className} (${cls.board || 'CBSE'})`,
          subject: subjectName,
          teacherId: assignedTeacherIdStr,
          date: todayStr
        });
      } else {
        blueClasses++;
      }

      allTodayPeriods.push({
        _id: cls._id || cls,
        period: entry.period,
        timeSlot: entry.timeSlot,
        class: `${className} (${cls.board || 'CBSE'})`,
        classId: cls._id || cls,
        standard: cls.standard || className.split('-')[0],
        section: cls.section || className.split('-')[1],
        board: cls.board || 'CBSE',
        classStrength: cls.strength || 0,
        teacher: session ? (session.teacher?.name || 'Unknown') : assignedTeacherName,
        teacherId: session ? (session.teacher?._id || session.teacher)?.toString() : assignedTeacherIdStr,
        assignedTeacherId: assignedTeacherIdStr,
        assignedTeacherName: assignedTeacherName,
        subject: session ? (session.subject?.name || 'Unknown') : subjectName,
        subjectId: session ? (session.subject?._id || session.subject)?.toString() : subjectIdStr,
        isPresentInSchool: true,
        isAbsent: status === 'red',
        color,
        statusText,
        session: session ? { loginTime: session.loginTime, logoutTime: session.logoutTime, status: session.status } : null,
        substitute: null
      });
    }

    // Calculate teacher presence counts based on active teaching sessions and gate attendance
    const activeTeacherIds = new Set(sessions.filter(s => s.status === 'active').map(s => (s.teacher?._id || s.teacher)?.toString()).filter(Boolean));
    const punchedInTeacherIds = new Set(attendances.filter(a => a.status === 'Present' && !a.punchOut).map(a => a.teacher?.toString()).filter(Boolean));

    const totalTeachers = allTeachers.length;
    const currentlyTeaching = allTeachers.filter(t => activeTeacherIds.has(t._id.toString())).length;
    const availableTeachers = allTeachers.filter(t => punchedInTeacherIds.has(t._id.toString()) && !activeTeacherIds.has(t._id.toString())).length;
    const absentTeachers = allTeachers.filter(t => !activeTeacherIds.has(t._id.toString()) && !punchedInTeacherIds.has(t._id.toString())).length;

    const stats = {
      totalTeachers,
      currentlyTeaching,
      availableTeachers,
      absentTeachers,
      greenClasses,
      yellowClasses,
      redClasses,
      purpleClasses,
      blueClasses,
      totalScheduled: todayEntries.length
    };

    return res.status(200).json({
      status: true,
      data: {
        activeClasses,
        classesWithoutTeacher,
        substitutePending,
        allTodayPeriods,
        stats,
        allClasses: classes,
        todaySessions: sessions,
        allMappings: mappings
      }
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Consolidated attendance stats for the admin dashboard
 */
export const getConsolidatedStats = async (req, res) => {
  try {
    const todayStr = getLocalDateString();

    // Fetch active teachers and staff
    const teachers = await Teacher.find({ status: 'Active' }).populate('user', 'role name').lean();
    const staff = await NonTeachingStaff.find({ status: 'Active' }).populate('user', 'role name').lean();

    const allEmployees = [
      ...teachers.map(t => ({ _id: t._id.toString(), name: t.name, employeeId: t.employeeId, role: t.user?.role || 'Teacher', type: 'teacher' })),
      ...staff.map(s => ({ _id: s._id.toString(), name: s.name, employeeId: s.employeeId, role: s.staffRole || s.user?.role || 'Staff', type: 'staff' }))
    ];

    const todayRecords = await TeacherAttendance.find({ date: todayStr }).lean();

    // Map records to employee
    const recordsWithEmployee = todayRecords.map(rec => {
      const emp = allEmployees.find(e => e._id === rec.teacher.toString());
      return { ...rec, employee: emp };
    });

    const presentCount = recordsWithEmployee.filter(r => r.status === 'Present' && r.employee).length;
    const totalCount = allEmployees.length;
    const absentCount = totalCount - presentCount;

    // Late arrivals count: punchIn after grace period
    let graceHour = 9;
    let graceMin = 30;
    try {
      const SchoolSettings = (await import('../models/SchoolSettings.js')).default;
      const settings = await SchoolSettings.findOne();
      if (settings && settings.office_start_time) {
        const [h, m] = settings.office_start_time.split(':').map(Number);
        const grace = settings.grace_period_mins || 0;
        const totalMins = h * 60 + m + grace;
        graceHour = Math.floor(totalMins / 60);
        graceMin = totalMins % 60;
      }
    } catch (err) {}

    const lateCount = recordsWithEmployee.filter(r => {
      if (r.status !== 'Present' || !r.punchIn || !r.employee) return false;
      const pi = new Date(r.punchIn);
      return pi.getHours() > graceHour || (pi.getHours() === graceHour && pi.getMinutes() > graceMin);
    }).length;

    // Leave requests
    let leaveCount = 0;
    try {
      const LeaveRequest = (await import('../models/LeaveRequest.js')).default;
      leaveCount = await LeaveRequest.countDocuments({ leaveDate: todayStr, status: 'Pending' });
    } catch (err) {}

    // Dynamic Role-wise breakdown
    const roleWise = {};
    // Initialize standard roles from DB
    try {
      const Role = (await import('../models/Role.js')).default;
      const dbRoles = await Role.find().lean();
      for (const r of dbRoles) {
        roleWise[r.roleName] = { present: 0, absent: 0, late: 0, total: 0 };
      }
    } catch (err) {}

    // fallback initialize for any roles in allEmployees
    for (const emp of allEmployees) {
      if (!roleWise[emp.role]) {
        roleWise[emp.role] = { present: 0, absent: 0, late: 0, total: 0 };
      }
      roleWise[emp.role].total++;
    }

    for (const rec of recordsWithEmployee) {
      if (!rec.employee) continue;
      const roleName = rec.employee.role;
      if (rec.status === 'Present') {
        roleWise[roleName].present++;
        // check late
        if (rec.punchIn) {
          const pi = new Date(rec.punchIn);
          if (pi.getHours() > graceHour || (pi.getHours() === graceHour && pi.getMinutes() > graceMin)) {
            roleWise[roleName].late++;
          }
        }
      }
    }

    // calculate absent for each role
    for (const roleName of Object.keys(roleWise)) {
      roleWise[roleName].absent = roleWise[roleName].total - roleWise[roleName].present;
    }

    // Recent check-ins
    const recentCheckIns = recordsWithEmployee
      .filter(r => r.status === 'Present' && r.punchIn && r.employee)
      .sort((a, b) => new Date(b.punchIn) - new Date(a.punchIn))
      .slice(0, 10)
      .map(r => ({
        name: r.employee.name,
        employeeId: r.employee.employeeId,
        punchIn: r.punchIn,
        status: r.status,
        role: r.employee.role
      }));

    // 10-day historical trend
    const trend = [];
    const totalEmpCount = allEmployees.length || 1;
    for (let i = 9; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayPresent = await TeacherAttendance.countDocuments({ date: dateStr, status: 'Present' });
      trend.push({
        date: dateStr,
        percentage: Math.round((dayPresent / totalEmpCount) * 100)
      });
    }

    return res.status(200).json({
      status: true,
      data: {
        totalTeachers: totalCount,
        presentToday: presentCount,
        absentToday: absentCount,
        lateArrivals: lateCount,
        leaveRequests: leaveCount,
        roleWise,
        recentCheckIns,
        trend
      }
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Individual teacher stats - classes assigned vs taken per day for the last 7 days
 */
export const getIndividualStats = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const teacher = await Teacher.findById(teacherId).populate('user', 'name email role');
    if (!teacher) {
      return res.status(404).json({ status: false, message: 'Teacher not found' });
    }

    const TeacherClassSubjectMapping = (await import('../models/TeacherClassSubjectMapping.js')).default;
    const assigned = await TeacherClassSubjectMapping.countDocuments({
      teacher: teacherId
    });

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = getDayFromDate(dateStr);

      if (dayName === 'Sunday') {
        days.push({ date: dateStr, day: dayName, assigned: 0, taken: 0 });
        continue;
      }

      // Taken classes from ClassSession
      const taken = await ClassSession.countDocuments({
        teacher: teacherId,
        date: dateStr,
        status: 'completed'
      });

      days.push({ date: dateStr, day: dayName, assigned, taken });
    }

    // Attendance records for the last 7 days
    const attendanceLogs = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const record = await TeacherAttendance.findOne({ date: dateStr, teacher: teacherId });
      attendanceLogs.push({
        date: dateStr,
        status: record?.status || 'Absent',
        punchIn: record?.punchIn || null,
        punchOut: record?.punchOut || null
      });
    }

    return res.status(200).json({
      status: true,
      data: {
        teacher: {
          _id: teacher._id,
          name: teacher.name,
          employeeId: teacher.employeeId,
          role: teacher.user?.role || 'teacher'
        },
        classEfficiency: days,
        attendanceLogs
      }
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Get current class status for dashboard monitoring
 */
export const getClassStatus = async (req, res) => {
  const { date, classId, teacherId, subjectId } = req.query;
  try {
    const todayStr = getLocalDateString();
    const queryDate = date || todayStr;
    const day = getDayFromDate(queryDate);

    if (day === 'Sunday') {
      return res.status(200).json({ status: true, data: [] });
    }

    const ClassStatus = (await import('../models/ClassStatus.js')).default;
    const ClassSession = (await import('../models/ClassSession.js')).default;
    const Class = (await import('../models/Class.js')).default;
    const TeacherClassSubjectMapping = (await import('../models/TeacherClassSubjectMapping.js')).default;

    const todayEntries = await getAllTimetableForDate(queryDate, day);
    const sessions = await ClassSession.find({ date: queryDate }).populate('teacher').populate('subject').lean();

    // 4. Fetch all school attendances for this date
    const attendances = await TeacherAttendance.find({ date: queryDate }).lean();

    const results = [];

    for (const entry of todayEntries) {
      const cls = entry.class;
      if (!cls) continue;

      const session = sessions.find(s => 
        (s.class?._id || s.class)?.toString() === (cls._id || cls).toString() &&
        s.period === entry.period
      );

      const status = getComplianceStatus(entry, session, queryDate);

      const assignedTeacherName = entry.teacher?.name || 'Not Assigned';
      const assignedTeacherIdStr = (entry.teacher?._id || entry.teacher)?.toString() || '';
      const subjectName = entry.subject?.name || 'Not Assigned';
      const subjectIdStr = (entry.subject?._id || entry.subject)?.toString() || '';

      const classNameStr = entry.className || `${cls.standard}-${cls.section}`;

      // Check school attendance for assigned teacher
      const attRecord = attendances.find(a => a.teacher?.toString() === assignedTeacherIdStr);
      const schoolAttendanceStatus = attRecord ? attRecord.status : 'Absent (Not Checked In)';
      const schoolPunchIn = attRecord?.punchIn || null;
      const schoolPunchOut = attRecord?.punchOut || null;

      const lastUpdatedTime = session ? (session.updatedAt || session.loginTime) : null;

      // Upsert into ClassStatus collection
      const statusId = `${queryDate}_${cls._id || cls}_${entry.period}`;
      const statusDoc = await ClassStatus.findOneAndUpdate(
        { statusId },
        {
          statusId,
          className: classNameStr,
          assignedTeacherId: assignedTeacherIdStr || 'None',
          activeTeacherId: session ? (session.teacher?._id || session.teacher)?.toString() : null,
          statusColor: status.toUpperCase(),
          timestamp: lastUpdatedTime || new Date()
        },
        { upsert: true, new: true }
      );

      results.push({
        statusId: statusDoc.statusId,
        classId: (cls._id || cls).toString(),
        className: classNameStr,
        standard: cls.standard || classNameStr.split('-')[0],
        section: cls.section || classNameStr.split('-')[1],
        board: cls.board || 'CBSE',
        subjectId: subjectIdStr || 'None',
        subjectName,
        assignedTeacherId: assignedTeacherIdStr || 'None',
        assignedTeacherName,
        activeTeacherId: session ? (session.teacher?._id || session.teacher)?.toString() : null,
        activeTeacherName: session ? (session.teacher?.name || 'Unknown') : 'None',
        currentTeacherName: session ? (session.teacher?.name || 'Unknown') : 'None',
        period: entry.period,
        timeSlot: entry.timeSlot,
        statusColor: status, // 'green', 'yellow', 'red', 'blue', 'purple'
        statusText: status === 'green' ? '🟢 On Time' : status === 'yellow' ? '🟡 Late' : status === 'red' ? '🔴 Absent/Delayed' : status === 'blue' ? '🔵 Upcoming' : '🟣 Substitute Active',
        lastUpdatedTime: lastUpdatedTime || statusDoc.updatedAt || statusDoc.timestamp,
        loginTime: session ? session.loginTime : null,
        logoutTime: session ? session.logoutTime : null,
        schoolAttendanceStatus,
        schoolPunchIn,
        schoolPunchOut
      });
    }

    // Apply filters in memory
    let filtered = results;
    if (classId && classId !== 'All') {
      filtered = filtered.filter(c => c.classId === classId);
    }
    if (teacherId && teacherId !== 'All') {
      filtered = filtered.filter(c => 
        c.assignedTeacherId === teacherId || 
        (c.activeTeacherId && c.activeTeacherId === teacherId)
      );
    }
    if (subjectId && subjectId !== 'All') {
      filtered = filtered.filter(c => c.subjectId === subjectId);
    }

    return res.status(200).json({ status: true, data: filtered });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Get aggregated monitoring statistics
 */
export const getMonitoringStats = async (req, res) => {
  const { date } = req.query;
  try {
    const todayStr = getLocalDateString();
    const queryDate = date || todayStr;
    const day = getDayFromDate(queryDate);

    if (day === 'Sunday') {
      return res.status(200).json({
        status: true,
        data: {
          totalScheduled: 0,
          onTime: 0,
          late: 0,
          absent: 0,
          substituteActive: 0,
          upcoming: 0
        }
      });
    }

    const ClassSession = (await import('../models/ClassSession.js')).default;
    const Class = (await import('../models/Class.js')).default;
    const TeacherClassSubjectMapping = (await import('../models/TeacherClassSubjectMapping.js')).default;

    const todayEntries = await getAllTimetableForDate(queryDate, day);
    const sessions = await ClassSession.find({ date: queryDate }).lean();

    let onTime = 0;
    let late = 0;
    let absent = 0;
    let substituteActive = 0;
    let upcoming = 0;

    for (const entry of todayEntries) {
      const cls = entry.class;
      if (!cls) continue;

      const session = sessions.find(s => 
        (s.class?._id || s.class)?.toString() === (cls._id || cls).toString() &&
        s.period === entry.period
      );

      const status = getComplianceStatus(entry, session, queryDate);

      if (status === 'green') onTime++;
      else if (status === 'yellow') late++;
      else if (status === 'red') absent++;
      else if (status === 'purple') substituteActive++;
      else if (status === 'blue') upcoming++;
    }

    return res.status(200).json({
      status: true,
      data: {
        totalScheduled: todayEntries.length,
        onTime,
        late,
        absent,
        substituteActive,
        upcoming
      }
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Get chronological audit logs of teacher class actions
 */
export const getAuditLogs = async (req, res) => {
  try {
    const AuditLogs = (await import('../models/AuditLogs.js')).default;
    const logs = await AuditLogs.find()
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    const transformed = logs.map(l => {
      const isEnter = ['Teacher entered class', 'Teacher Logged In', 'Substitute Assigned', 'Class Started'].includes(l.action);
      const isLeave = ['Teacher left class', 'Teacher Logged Out', 'Class Ended'].includes(l.action);
      const isSub = ['Substitute teacher assigned', 'Substitute Assigned'].includes(l.action);
      const isAlert = ['Attendance Alert'].includes(l.action);
      return {
        _id: l._id,
        timestamp: l.timestamp,
        action: isAlert ? 'alert' : isEnter ? 'enter' : isLeave ? 'leave' : 'mod',
        isSubstitute: isSub,
        class: {
          standard: l.className.split('-')[0] || 'Class',
          section: l.className.split('-')[1] || '',
          board: 'CBSE'
        },
        teacher: {
          name: l.teacherName
        },
        subject: {
          name: l.action.includes('modifications') ? 'Timetable' : 'Class'
        },
        details: l.action
      };
    });

    return res.status(200).json({ status: true, data: transformed });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Get recent class login sessions for history monitoring
 */
export const getClassHistory = async (req, res) => {
  const { classId } = req.params;
  try {
    const sessions = await ClassSession.find({ class: classId })
      .populate('teacher', 'name employeeId')
      .populate('subject', 'name')
      .sort({ loginTime: -1 })
      .limit(20)
      .lean();
    return res.status(200).json({ status: true, data: sessions });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};


