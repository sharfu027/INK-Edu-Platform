import LeaveRequest from '../models/LeaveRequest.js';
import Teacher from '../models/Teacher.js';
import Timetable from '../models/Timetable.js';
import TeacherAttendance from '../models/TeacherAttendance.js';
import SubstituteAssignment from '../models/SubstituteAssignment.js';
import Notification from '../models/Notification.js';
import { getIO } from '../config/socket.js';

/**
 * Teacher files a leave request
 */
export const requestLeave = async (req, res) => {
  const { leaveDate, reason } = req.body;
  try {
    const teacher = await Teacher.findOne({ user: req.user._id });
    if (!teacher) {
      return res.status(404).json({ status: false, message: 'Teacher profile not found' });
    }

    const request = await LeaveRequest.create({
      teacher: teacher._id,
      leaveDate,
      reason
    });

    return res.status(201).json({ status: true, message: 'Leave request submitted successfully', data: request });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Get all leave requests (Admin)
 */
export const getLeaveRequests = async (req, res) => {
  try {
    const requests = await LeaveRequest.find()
      .populate('teacher', 'name employeeId')
      .sort({ createdAt: -1 });
    return res.status(200).json({ status: true, data: requests });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Suggest substitute teachers for an absent teacher's periods on a specific day
 */
const getDayFromDate = (dateStr) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const d = new Date(dateStr);
  return days[d.getDay()];
};

export const getSubstituteSuggestions = async (req, res) => {
  const { teacherId, date } = req.query;
  try {
    const day = getDayFromDate(date);
    if (day === 'Sunday') {
      return res.status(400).json({ status: false, message: 'No classes on Sunday' });
    }

    // 1. Find the absent teacher's scheduled classes for that day
    const affectedPeriods = await Timetable.find({
      teacher: teacherId,
      day
    }).populate('class', 'standard section').populate('subject', 'name');

    if (affectedPeriods.length === 0) {
      return res.status(200).json({ status: true, data: [] });
    }

    const suggestionsList = [];

    // 2. For each period, find available substitutes
    for (const periodEntry of affectedPeriods) {
      // Find all teachers
      const allTeachers = await Teacher.find({ status: 'Active' });
      
      const candidates = [];
      for (const t of allTeachers) {
        if (t._id.toString() === teacherId.toString()) continue; // skip the absent teacher

        // A. Check if this teacher is scheduled to teach during this period on this day
        const isBusy = await Timetable.findOne({
          teacher: t._id,
          day,
          period: periodEntry.period
        });
        if (isBusy) continue; // skip if busy teaching another class

        // B. Check if this teacher is absent or on leave on this date
        const isAbsent = await TeacherAttendance.findOne({
          date,
          teacher: t._id,
          status: { $in: ['Absent', 'Leave'] }
        });
        if (isAbsent) continue; // skip if absent/on leave

        // C. Check if this teacher teaches the same subject (subject match)
        const isSubjectMatch = periodEntry.subject && t.qualification && t.qualification.toLowerCase().includes(periodEntry.subject.name.toLowerCase());
        
        candidates.push({
          teacherId: t._id,
          name: t.name,
          employeeId: t.employeeId,
          subjectMatch: isSubjectMatch
        });
      }

      // Sort candidates: subject matches first
      candidates.sort((a, b) => b.subjectMatch - a.subjectMatch);

      suggestionsList.push({
        periodEntryId: periodEntry._id,
        period: periodEntry.period,
        timeSlot: periodEntry.timeSlot,
        class: `${periodEntry.class.standard}-${periodEntry.class.section}`,
        subject: periodEntry.subject.name,
        candidates
      });
    }

    return res.status(200).json({ status: true, data: suggestionsList });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Approve leave request and allocate substitutes
 */
export const approveLeave = async (req, res) => {
  const { id } = req.params; // Leave request ID
  const { status, substituteAllocations } = req.body; // status: 'Approved' or 'Rejected', substituteAllocations: [{ periodEntryId, substituteTeacherId }]
  try {
    const request = await LeaveRequest.findById(id).populate('teacher');
    if (!request) return res.status(404).json({ status: false, message: 'Leave request not found' });

    request.status = status;
    request.approvedBy = req.user._id;
    await request.save();

    if (status === 'Approved') {
      // Mark teacher attendance for that day as 'Leave'
      await TeacherAttendance.findOneAndUpdate(
        { date: request.leaveDate, teacher: request.teacher._id },
        { status: 'Leave' },
        { upsert: true }
      );

      // Save substitute assignments
      if (substituteAllocations && substituteAllocations.length > 0) {
        for (const alloc of substituteAllocations) {
          const timetableEntry = await Timetable.findById(alloc.periodEntryId);
          if (!timetableEntry) continue;

          // Create assignment
          await SubstituteAssignment.findOneAndUpdate(
            {
              date: request.leaveDate,
              class: timetableEntry.class,
              period: timetableEntry.period
            },
            {
              timetableEntry: timetableEntry._id,
              originalTeacher: timetableEntry.teacher,
              substituteTeacher: alloc.substituteTeacherId,
              subject: timetableEntry.subject,
              status: 'Assigned'
            },
            { upsert: true }
          );

          // Find substitute teacher user to send notification
          const subTeacher = await Teacher.findById(alloc.substituteTeacherId).populate('user');
          if (subTeacher && subTeacher.user) {
            const message = `You have been assigned Period ${timetableEntry.period} for Class ${timetableEntry.standard || ''} because ${request.teacher.name} is absent.`;
            
            // Create notification document
            const notif = await Notification.create({
              recipient: subTeacher.user._id,
              message
            });

            // Emit live websocket notification to substitute teacher
            const io = getIO();
            if (io) {
              io.to(subTeacher.user._id.toString()).emit('new_notification', {
                _id: notif._id,
                message,
                createdAt: notif.createdAt
              });
            }
          }
        }
      }
    }

    return res.status(200).json({ status: true, message: `Leave request status updated to ${status}`, data: request });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Assign substitutes directly for a teacher on a specific day without an active leave request
 */
export const assignSubstituteDirectly = async (req, res) => {
  const { teacherId, date, substituteAllocations } = req.body;
  try {
    // Mark teacher attendance for that day as 'Absent' if not already set
    await TeacherAttendance.findOneAndUpdate(
      { date, teacher: teacherId },
      { status: 'Absent' },
      { upsert: true }
    );

    const origTeacher = await Teacher.findById(teacherId);

    // Save substitute assignments
    if (substituteAllocations && substituteAllocations.length > 0) {
      for (const alloc of substituteAllocations) {
        const timetableEntry = await Timetable.findById(alloc.periodEntryId);
        if (!timetableEntry) continue;

        // Create assignment
        await SubstituteAssignment.findOneAndUpdate(
          {
            date,
            class: timetableEntry.class,
            period: timetableEntry.period
          },
          {
            timetableEntry: timetableEntry._id,
            originalTeacher: timetableEntry.teacher,
            substituteTeacher: alloc.substituteTeacherId,
            subject: timetableEntry.subject,
            status: 'Assigned'
          },
          { upsert: true }
        );

        // Find substitute teacher user to send notification
        const subTeacher = await Teacher.findById(alloc.substituteTeacherId).populate('user');
        if (subTeacher && subTeacher.user) {
          const message = `You have been assigned Period ${timetableEntry.period} for Class ${timetableEntry.standard || ''} because ${origTeacher ? origTeacher.name : 'a teacher'} is absent.`;
          
          // Create notification document
          const notif = await Notification.create({
            recipient: subTeacher.user._id,
            message
          });

          // Emit live websocket notification to substitute teacher
          const io = getIO();
          if (io) {
            io.to(subTeacher.user._id.toString()).emit('new_notification', {
              _id: notif._id,
              message,
              createdAt: notif.createdAt
            });
          }
        }
      }
    }

    return res.status(200).json({ status: true, message: 'Substitutes allocated successfully' });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};
