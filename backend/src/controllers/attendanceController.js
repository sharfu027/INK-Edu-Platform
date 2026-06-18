import TeacherAttendance from '../models/TeacherAttendance.js';
import StudentAttendance from '../models/StudentAttendance.js';
import Teacher from '../models/Teacher.js';
import NonTeachingStaff from '../models/NonTeachingStaff.js';
import User from '../models/User.js';
import Class from '../models/Class.js';
import ClassSession from '../models/ClassSession.js';
import Timetable from '../models/Timetable.js';
import ClassAuditLog from '../models/ClassAuditLog.js';
import { runFaceCLI } from '../utils/faceBridge.js';
import { getIO } from '../config/socket.js';

/**
 * Format date as YYYY-MM-DD in local timezone
 */
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // metres
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
};

const getLocalDateString = () => {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().split('T')[0];
};

/**
 * Get all teacher attendance logs
 */
export const getAttendanceLogs = async (req, res) => {
  try {
    const logs = await TeacherAttendance.find().sort({ date: -1, createdAt: -1 }).lean();
    const teachers = await Teacher.find().lean();
    const staffList = await NonTeachingStaff.find().lean();

    const mappedLogs = logs.map(log => {
      let faculty = teachers.find(t => t._id.toString() === log.teacher.toString());
      let type = 'Teacher';
      if (!faculty) {
        faculty = staffList.find(s => s._id.toString() === log.teacher.toString());
        type = faculty ? (faculty.staffRole || 'Staff') : 'Staff';
      }
      return {
        ...log,
        teacher: faculty ? { _id: faculty._id, name: faculty.name, employeeId: faculty.employeeId } : null,
        role: type
      };
    });

    return res.status(200).json({ status: true, data: mappedLogs });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Punch In Teacher or Staff (Face + GPS Check)
 */
export const punchIn = async (req, res) => {
  const { employee_id, face_image, challenge_frame, location } = req.body;
  try {
    // 1. Find teacher or non-teaching staff
    let faculty = await Teacher.findOne({ employeeId: employee_id }).populate('user');
    let type = 'teacher';

    if (!faculty) {
      faculty = await NonTeachingStaff.findOne({ employeeId: employee_id }).populate('user');
      type = 'staff';
    }

    if (!faculty) {
      return res.status(404).json({ status: false, message: 'Employee ID not found' });
    }

    const todayStr = getLocalDateString();

    // Check if already punched in
    let attendance = await TeacherAttendance.findOne({ date: todayStr, teacher: faculty._id });
    if (attendance && attendance.status === 'Present') {
      return res.status(400).json({ status: false, message: 'Already punched in for today' });
    }

    // 2. Perform Face Recognition if user login is linked and face embeddings are set
    if (faculty.user && faculty.user.face_embeddings && faculty.user.face_embeddings.length > 0 && face_image) {
      const cliResult = await runFaceCLI('extract_embedding', { image: face_image, strict: true });
      if (!cliResult.status) {
        return res.status(400).json({ status: false, message: `Face Verification Failed: ${cliResult.message}` });
      }

      const compareResult = await runFaceCLI('compare', {
        live_embedding: cliResult.embedding,
        stored_embeddings: faculty.user.face_embeddings
      });

      if (!compareResult.status || !compareResult.isMatch) {
        return res.status(400).json({ status: false, message: 'Face mismatch. Punch-in rejected.' });
      }

      if (challenge_frame) {
        const temporalResult = await runFaceCLI('temporal_liveness', {
          frame1: face_image,
          frame2: challenge_frame
        });
        if (!temporalResult.status || !temporalResult.isLive) {
          return res.status(400).json({ status: false, message: temporalResult.reason || 'Liveness check failed' });
        }
      }
    }

    // 3. Reverse-geocode punch-in address (optional)
    let address = 'School Campus';
    if (location && location.latitude) {
      address = `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.latitude}&lon=${location.longitude}&zoom=18&addressdetails=1`,
          { headers: { 'User-Agent': 'FaceAuthSchoolSystem/1.0' } }
        );
        const data = await response.json();
        if (data && data.display_name) {
          address = data.display_name;
        }
      } catch {
        // use coordinates
      }
    }

    // 4. Record attendance
    if (!attendance) {
      attendance = new TeacherAttendance({
        date: todayStr,
        teacher: faculty._id,
        status: 'Present',
        punchIn: new Date(),
        location,
        address
      });
    } else {
      attendance.status = 'Present';
      attendance.punchIn = new Date();
      attendance.location = location;
      attendance.address = address;
    }

    await attendance.save();

    try {
      const AuditLogs = (await import('../models/AuditLogs.js')).default;
      await AuditLogs.create({
        logId: `${todayStr}_${faculty.employeeId}_gate_login`,
        className: 'Gate',
        teacherName: faculty.name,
        action: 'Teacher Logged In',
        timestamp: new Date()
      });
    } catch (err) {
      console.error('Failed to create gate login audit log:', err);
    }

    // Emit live WebSocket update to admin/principal dashboards
    const io = getIO();
    if (io) {
      io.emit('attendance_punch', {
        employeeId: faculty.employeeId,
        name: faculty.name,
        role: type === 'teacher' ? 'Teacher' : faculty.staffRole,
        date: todayStr,
        punchIn: attendance.punchIn,
        status: 'Present'
      });
    }

    return res.status(200).json({
      status: true,
      message: 'Punch-in registered successfully',
      data: attendance
    });
  } catch (error) {
    console.error('Punch-in error:', error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Punch Out Teacher or Staff
 */
export const punchOut = async (req, res) => {
  const { employee_id } = req.body;
  try {
    let faculty = await Teacher.findOne({ employeeId: employee_id });
    if (!faculty) {
      faculty = await NonTeachingStaff.findOne({ employeeId: employee_id });
    }

    if (!faculty) {
      return res.status(404).json({ status: false, message: 'Employee ID not found' });
    }

    const todayStr = getLocalDateString();
    const attendance = await TeacherAttendance.findOne({ date: todayStr, teacher: faculty._id });

    if (!attendance || attendance.status !== 'Present') {
      return res.status(400).json({ status: false, message: 'Not punched in yet for today' });
    }

    attendance.punchOut = new Date();
    await attendance.save();

    try {
      const AuditLogs = (await import('../models/AuditLogs.js')).default;
      await AuditLogs.create({
        logId: `${todayStr}_${faculty.employeeId}_gate_logout`,
        className: 'Gate',
        teacherName: faculty.name,
        action: 'Teacher Logged Out',
        timestamp: new Date()
      });
    } catch (err) {
      console.error('Failed to create gate logout audit log:', err);
    }

    const io = getIO();
    if (io) {
      io.emit('attendance_punch', {
        employeeId: faculty.employeeId,
        name: faculty.name,
        date: todayStr,
        punchOut: attendance.punchOut,
        status: 'Left'
      });
    }

    return res.status(200).json({
      status: true,
      message: 'Punch-out registered successfully',
      data: attendance
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Kiosk logout / verify-logout
 */
export const verifyLogout = async (req, res) => {
  const { employee_id, face_image, challenge_frame, location } = req.body;
  try {
    let faculty = await Teacher.findOne({ employeeId: employee_id }).populate('user');
    if (!faculty) {
      faculty = await NonTeachingStaff.findOne({ employeeId: employee_id }).populate('user');
    }

    if (!faculty) {
      return res.status(404).json({ status: false, message: 'Employee not found' });
    }

    // Verify face
    if (faculty.user && faculty.user.face_embeddings && faculty.user.face_embeddings.length > 0 && face_image) {
      const cliResult = await runFaceCLI('extract_embedding', { image: face_image, strict: true });
      if (!cliResult.status) {
        return res.status(400).json({ status: false, message: 'Face Verification Failed' });
      }

      const compareResult = await runFaceCLI('compare', {
        live_embedding: cliResult.embedding,
        stored_embeddings: faculty.user.face_embeddings
      });

      if (!compareResult.status || !compareResult.isMatch) {
        return res.status(400).json({ status: false, message: 'Face mismatch. Punch-out rejected.' });
      }
    }

    const todayStr = getLocalDateString();
    const attendance = await TeacherAttendance.findOne({ date: todayStr, teacher: faculty._id });
    if (!attendance) {
      return res.status(400).json({ status: false, message: 'No attendance logs found for today' });
    }

    attendance.punchOut = new Date();
    await attendance.save();

    try {
      const AuditLogs = (await import('../models/AuditLogs.js')).default;
      await AuditLogs.create({
        logId: `${todayStr}_${faculty.employeeId}_gate_logout`,
        className: 'Gate',
        teacherName: faculty.name,
        action: 'Teacher Logged Out',
        timestamp: new Date()
      });
    } catch (err) {
      console.error('Failed to create gate kiosk logout audit log:', err);
    }

    return res.status(200).json({
      status: true,
      message: 'Logout verified and registered successfully',
      data: attendance
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Get student attendance records
 */
export const getStudentAttendance = async (req, res) => {
  const { date, classId } = req.query;
  try {
    const records = await StudentAttendance.find({
      date: date || getLocalDateString(),
      class: classId
    });
    return res.status(200).json({ status: true, data: records });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Mark student attendance (upsert multiple records)
 */
export const markStudentAttendance = async (req, res) => {
  const { date, classId, attendanceData } = req.body; // attendanceData: [{ studentName, status }]
  try {
    const cls = await Class.findById(classId);
    if (!cls) return res.status(404).json({ status: false, message: 'Class not found' });

    const targetDate = date || getLocalDateString();
    const savedRecords = [];

    for (const record of attendanceData) {
      const saved = await StudentAttendance.findOneAndUpdate(
        { date: targetDate, class: classId, studentName: record.studentName },
        { status: record.status },
        { new: true, upsert: true, runValidators: true }
      );
      savedRecords.push(saved);
    }

    return res.status(200).json({
      status: true,
      message: 'Student attendance marked successfully',
      data: savedRecords
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Get daily status list (Admin Company Status / Monitor)
 * Emulates the original FastAPI `attendance/daily-status` route.
 */
export const getDailyStatus = async (req, res) => {
  const dateStr = req.query.date_str || getLocalDateString();
  try {
    // Get all teachers and staff
    const teachers = await Teacher.find({ status: 'Active' });
    const staff = await NonTeachingStaff.find({ status: 'Active' });

    const allFaculty = [...teachers, ...staff];

    const results = [];
    for (const member of allFaculty) {
      const att = await TeacherAttendance.findOne({ date: dateStr, teacher: member._id });
      results.push({
        employee_id: member.employeeId,
        name: member.name,
        department: member.qualification ? 'Teaching' : member.staffRole,
        punch_in: att?.punchIn || null,
        punch_out: att?.punchOut || null,
        status: att ? (att.punchOut ? 'Left Office' : 'In Office') : 'Absent'
      });
    }

    return res.status(200).json({ status: true, data: results });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Get consolidated reporting
 */
export const getConsolidatedReport = async (req, res) => {
  const { month, year } = req.query; // YYYY, MM
  try {
    const teachers = await Teacher.find();
    const report = [];

    const monthStr = month ? String(month).padStart(2, '0') : '';
    const dateRegex = monthStr && year ? new RegExp(`^${year}-${monthStr}-\\d{2}$`) : null;

    for (const t of teachers) {
      const query = { teacher: t._id };
      if (dateRegex) {
        query.date = dateRegex;
      }

      const records = await TeacherAttendance.find(query);
      const totalDays = records.length;
      const presentDays = records.filter(r => r.status === 'Present').length;
      const absentDays = records.filter(r => r.status === 'Absent').length;
      const leaveDays = records.filter(r => r.status === 'Leave').length;

      const attRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

      report.push({
        employeeId: t.employeeId,
        name: t.name,
        qualification: t.qualification,
        totalDays,
        presentDays,
        absentDays,
        leaveDays,
        attendanceRate: attRate
      });
    }

    return res.status(200).json({ status: true, data: report });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Class Session Login (Punch in when class starts)
 */
export const classLogin = async (req, res) => {
  const { classId, period, subjectId, location } = req.body;
  try {
    const clsDoc = await Class.findById(classId);
    const classNameStr = clsDoc ? `${clsDoc.standard}-${clsDoc.section}` : 'Class';
    const isAdminOrPrincipal = ['admin', 'principal', 'hod'].includes(req.user.role?.toLowerCase());
    let teacherId;
    if (isAdminOrPrincipal) {
      teacherId = req.body.teacherId;
      if (!teacherId) {
        // Resolve from mapping
        const TeacherClassSubjectMapping = (await import('../models/TeacherClassSubjectMapping.js')).default;
        const mapping = await TeacherClassSubjectMapping.findOne({ class: classId, subject: subjectId });
        teacherId = mapping ? mapping.teacher : null;
      }
      if (!teacherId) {
        // Fallback to class teacher
        const cls = await Class.findById(classId);
        teacherId = cls?.classTeacher;
      }
      if (!teacherId) {
        // Fallback to any teacher
        const t = await Teacher.findOne();
        teacherId = t ? t._id : null;
      }
    } else {
      const teacher = await Teacher.findOne({ user: req.user._id });
      if (!teacher) {
        return res.status(404).json({ status: false, message: 'Teacher profile not found' });
      }
      teacherId = teacher._id;
    }

    // Geofencing Check: 100 meters limit (skip for admin/principal)
    if (!isAdminOrPrincipal) {
      const user = await User.findById(req.user._id);
      if (!user.skip_location) {
        if (!location || !location.latitude || !location.longitude) {
          return res.status(403).json({ status: false, message: 'GPS location is required' });
        }
        if (user.registeredLocation) {
          const distance = getDistance(
            user.registeredLocation.latitude,
            user.registeredLocation.longitude,
            location.latitude,
            location.longitude
          );
          if (distance > 100) {
            return res.status(403).json({
              status: false,
              message: `Location Mismatch: you are ${Math.round(distance)}m away from school. Max allowed: 100m.`
            });
          }
        }
      }
    }

    const todayStr = getLocalDateString();

    // Check if session already exists for this class, period, date
    const existingSession = await ClassSession.findOne({
      class: classId,
      period,
      date: todayStr
    });

    if (existingSession) {
      return res.status(400).json({ status: false, message: 'Class session already logged in/completed for this period' });
    }

    const TeacherClassSubjectMapping = (await import('../models/TeacherClassSubjectMapping.js')).default;
    const mapping = await TeacherClassSubjectMapping.findOne({ class: classId, subject: subjectId });
    let assignedTeacherId = null;
    if (mapping) {
      assignedTeacherId = mapping.teacher;
    } else {
      const ClassModel = (await import('../models/Class.js')).default;
      const cls = await ClassModel.findById(classId);
      if (cls && cls.classTeacher) {
        assignedTeacherId = cls.classTeacher;
      }
    }

    const isSubstitute = assignedTeacherId ? assignedTeacherId.toString() !== teacherId.toString() : false;

    const session = await ClassSession.create({
      class: classId,
      period,
      teacher: teacherId,
      subject: subjectId,
      date: todayStr,
      loginTime: new Date(),
      loginLocation: location || { latitude: 0, longitude: 0 },
      status: 'active'
    });


    // Write to user-specified ClassStatus and AuditLogs collections
    try {
      const ClassStatus = (await import('../models/ClassStatus.js')).default;
      const AuditLogs = (await import('../models/AuditLogs.js')).default;
      const TeacherModel = (await import('../models/Teacher.js')).default;

      const activeTeacherDoc = await TeacherModel.findById(teacherId);
      const activeTeacherName = activeTeacherDoc ? activeTeacherDoc.name : 'Unknown';
      const activeTeacherStringId = activeTeacherDoc ? (activeTeacherDoc.teacherId || activeTeacherDoc.employeeId || teacherId.toString()) : teacherId.toString();

      let assignedTeacherStringId = '';
      if (assignedTeacherId) {
        const assTeacher = await TeacherModel.findById(assignedTeacherId);
        assignedTeacherStringId = assTeacher ? (assTeacher.teacherId || assTeacher.employeeId || assignedTeacherId.toString()) : assignedTeacherId.toString();
      }

      const statusColor = assignedTeacherStringId === activeTeacherStringId ? 'GREEN' : 'YELLOW';
      const statusId = `${todayStr}_${classId}_${period}`;

      await ClassStatus.findOneAndUpdate(
        { statusId },
        {
          statusId,
          className: classNameStr,
          assignedTeacherId: assignedTeacherStringId || 'None',
          activeTeacherId: activeTeacherStringId,
          statusColor,
          timestamp: new Date()
        },
        { upsert: true, new: true }
      );

      await AuditLogs.create({
        logId: `${todayStr}_${classId}_${period}_login`,
        className: classNameStr,
        teacherName: activeTeacherName,
        action: isSubstitute ? 'Substitute Assigned' : 'Class Started',
        timestamp: new Date()
      });
    } catch (dbErr) {
      console.error('Error logging user-specified ClassStatus / AuditLogs:', dbErr);
    }

    // Emit live socket status change
    const io = getIO();
    if (io) {
      io.emit('class_status_change', {
        classId,
        period,
        date: todayStr,
        action: 'login',
        teacherId,
        isSubstitute,
        className: classNameStr
      });
    }

    return res.status(201).json({
      status: true,
      message: 'Class login successful. Class is now active.',
      data: session
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Class Session Logout (Punch out when class finishes)
 */
export const classLogout = async (req, res) => {
  const { classId, period, location } = req.body;
  try {
    const clsDoc = await Class.findById(classId);
    const classNameStr = clsDoc ? `${clsDoc.standard}-${clsDoc.section}` : 'Class';
    const isAdminOrPrincipal = ['admin', 'principal', 'hod'].includes(req.user.role?.toLowerCase());
    let teacherId;
    if (isAdminOrPrincipal) {
      const session = await ClassSession.findOne({
        class: classId,
        period,
        date: getLocalDateString(),
        status: 'active'
      });
      teacherId = session ? session.teacher : req.body.teacherId;
    } else {
      const teacher = await Teacher.findOne({ user: req.user._id });
      if (!teacher) {
        return res.status(404).json({ status: false, message: 'Teacher profile not found' });
      }
      teacherId = teacher._id;
    }

    // Geofencing Check: 100 meters limit (skip for admin/principal)
    if (!isAdminOrPrincipal) {
      const user = await User.findById(req.user._id);
      if (!user.skip_location) {
        if (!location || !location.latitude || !location.longitude) {
          return res.status(403).json({ status: false, message: 'GPS location is required' });
        }
        if (user.registeredLocation) {
          const distance = getDistance(
            user.registeredLocation.latitude,
            user.registeredLocation.longitude,
            location.latitude,
            location.longitude
          );
          if (distance > 100) {
            return res.status(403).json({
              status: false,
              message: `Location Mismatch: you are ${Math.round(distance)}m away from school. Max allowed: 100m.`
            });
          }
        }
      }
    }

    const todayStr = getLocalDateString();

    const session = await ClassSession.findOne({
      class: classId,
      period,
      date: todayStr,
      teacher: teacherId,
      status: 'active'
    });

    if (!session) {
      return res.status(404).json({ status: false, message: 'Active class session not found for this period' });
    }

    session.logoutTime = new Date();
    session.logoutLocation = location || { latitude: 0, longitude: 0 };
    session.status = 'completed';
    await session.save();

    const TeacherClassSubjectMapping = (await import('../models/TeacherClassSubjectMapping.js')).default;
    const mapping = await TeacherClassSubjectMapping.findOne({ class: classId, subject: session.subject });
    let assignedTeacherId = null;
    if (mapping) {
      assignedTeacherId = mapping.teacher;
    } else {
      const ClassModel = (await import('../models/Class.js')).default;
      const cls = await ClassModel.findById(classId);
      if (cls && cls.classTeacher) {
        assignedTeacherId = cls.classTeacher;
      }
    }

    const isSubstitute = assignedTeacherId ? assignedTeacherId.toString() !== teacherId.toString() : false;


    // Write to user-specified ClassStatus and AuditLogs collections
    try {
      const ClassStatus = (await import('../models/ClassStatus.js')).default;
      const AuditLogs = (await import('../models/AuditLogs.js')).default;
      const TeacherModel = (await import('../models/Teacher.js')).default;

      const activeTeacherDoc = await TeacherModel.findById(teacherId);
      const activeTeacherName = activeTeacherDoc ? activeTeacherDoc.name : 'Unknown';

      let assignedTeacherStringId = '';
      if (assignedTeacherId) {
        const assTeacher = await TeacherModel.findById(assignedTeacherId);
        assignedTeacherStringId = assTeacher ? (assTeacher.teacherId || assTeacher.employeeId || assignedTeacherId.toString()) : assignedTeacherId.toString();
      }

      const statusId = `${todayStr}_${classId}_${period}`;

      await ClassStatus.findOneAndUpdate(
        { statusId },
        {
          statusId,
          className: classNameStr,
          assignedTeacherId: assignedTeacherStringId || 'None',
          activeTeacherId: null,
          statusColor: 'RED',
          timestamp: new Date()
        },
        { upsert: true, new: true }
      );

      await AuditLogs.create({
        logId: `${todayStr}_${classId}_${period}_logout`,
        className: classNameStr,
        teacherName: activeTeacherName,
        action: 'Class Ended',
        timestamp: new Date()
      });
    } catch (dbErr) {
      console.error('Error logging logout ClassStatus / AuditLogs:', dbErr);
    }

    // Emit live socket status change
    const io = getIO();
    if (io) {
      io.emit('class_status_change', {
        classId,
        period,
        date: todayStr,
        action: 'logout',
        teacherId,
        isSubstitute,
        className: classNameStr
      });
    }

    return res.status(200).json({
      status: true,
      message: 'Class logout successful. Class is now ended.',
      data: session
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};
