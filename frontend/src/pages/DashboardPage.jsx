/**
 * Dashboard Page — Premium Responsive School & Faculty Management Dashboard.
 * Integrates dual-dashboard views:
 *   1. Teacher View: Today's schedule timeline, stats, leave requests, and Socket.IO alerts.
 *   2. Principal/HOD/Admin View: Classroom Live Operations Feed (classes running, absent teachers, alternate assignments).
 * Fully responsive: uses glassmorphism panels, micro-animations, and gold/stone accents.
 */
import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  getTeacherDashboard, 
  getAdminDashboard, 
  requestLeave, 
  getLeaveRequests, 
  getSubstituteSuggestions, 
  approveLeave,
  classLogin,
  classLogout,
  createTeacherSchedule,
  assignSubstituteDirectly,
  getClassStatus,
  getMonitoringStats,
  getAuditLogs,
  getClasses,
  getSubjects,
  getAdminEmployees,
  getTimetables,
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
  getClassHistory
} from '../services/authService';
import Spinner from '../components/ui/Spinner';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/ui/Sidebar';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Unified dashboard state
  const [loading, setLoading] = useState(true);
  const [teacherData, setTeacherData] = useState(null);
  const [adminData, setAdminData] = useState(null);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // Monitoring Dashboard States
  const [activeSubTab, setActiveSubTab] = useState('overview'); // 'overview', 'live_monitoring', 'weekly_timetable', 'teacher_schedule', 'class_schedule', 'activity_logs'
  const [monitoringStats, setMonitoringStats] = useState({
    totalScheduled: 0,
    onTime: 0,
    late: 0,
    absent: 0,
    substituteActive: 0,
    upcoming: 0
  });
  const [classStatuses, setClassStatuses] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [subjectsList, setSubjectsList] = useState([]);
  const [teachersList, setTeachersList] = useState([]);
  const [socketTrigger, setSocketTrigger] = useState(0);

  // Timetable and Schedule States
  const [timetableEntries, setTimetableEntries] = useState([]);
  const [isTimetableEditEnabled, setIsTimetableEditEnabled] = useState(false);
  const [selectedTimetableClass, setSelectedTimetableClass] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [classHistory, setClassHistory] = useState([]);
  const [classHistoryLoading, setClassHistoryLoading] = useState(false);
  const [selectedCellDetails, setSelectedCellDetails] = useState(null);
  const [isCellDetailsModalOpen, setIsCellDetailsModalOpen] = useState(false);
  const [isCardDetailsModalOpen, setIsCardDetailsModalOpen] = useState(false);
  const [selectedCardDetails, setSelectedCardDetails] = useState(null);
  const [cardClassHistory, setCardClassHistory] = useState([]);
  const [cardClassHistoryLoading, setCardClassHistoryLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSavingTimetable, setIsSavingTimetable] = useState(false);
  const [timetableForm, setTimetableForm] = useState({
    classId: '',
    day: 'Monday',
    period: 1,
    startTime: '09:00',
    endTime: '09:45',
    teacherId: '',
    subjectId: ''
  });

  // Monitoring filters state
  const [monDate, setMonDate] = useState(() => {
    const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
    return local.toISOString().split('T')[0];
  });
  const [monClassId, setMonClassId] = useState('All');
  const [monTeacherId, setMonTeacherId] = useState('All');
  const [monSubjectId, setMonSubjectId] = useState('All');

  // Leave Form State
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

  // Timetable Scheduling Form State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedStandard, setSchedStandard] = useState('Nursery');
  const [schedSection, setSchedSection] = useState('A');
  const [schedBoard, setSchedBoard] = useState('CBSE');
  const [schedSubject, setSchedSubject] = useState('');
  const [schedPeriod, setSchedPeriod] = useState(1);
  const [schedTimeSlot, setSchedTimeSlot] = useState('09:00-09:45');
  const [schedDay, setSchedDay] = useState(() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()] || 'Monday';
  });
  const [schedDate, setSchedDate] = useState('');
  const [schedType, setSchedType] = useState('auto'); // 'auto' or 'manual'
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);

  const defaultTimeSlots = {
    1: '09:00-09:45',
    2: '09:45-10:30',
    3: '10:45-11:30',
    4: '11:30-12:15',
    5: '13:00-13:45',
    6: '13:45-14:30',
    7: '14:45-15:30',
    8: '15:30-16:15'
  };

  const handlePeriodChange = (p) => {
    setSchedPeriod(p);
    if (defaultTimeSlots[p]) {
      setSchedTimeSlot(defaultTimeSlots[p]);
    }
  };

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

  const getCellStatusColor = (day, period, entryClassId) => {
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayDayName = daysOfWeek[new Date().getDay()];
    
    if (day !== todayDayName) return 'neutral';
    
    const statusObj = classStatuses.find(c => 
      c.classId === entryClassId?.toString() && 
      c.period === period
    );
    
    if (statusObj) {
      return statusObj.statusColor; // 'green', 'yellow', 'red', 'blue', 'purple'
    }
    
    return 'neutral';
  };

  const getDelayMinutes = (timeSlot, loginTime, monDateStr) => {
    try {
      const startTimeStr = timeSlot.split('-')[0];
      const [h, m] = startTimeStr.split(':').map(Number);
      const datePart = monDateStr || new Date().toISOString().split('T')[0];
      const [year, month, day] = datePart.split('-').map(Number);
      const scheduled = new Date(year, month - 1, day, h, m, 0, 0);

      const actual = loginTime ? new Date(loginTime) : new Date();
      const diffMs = actual - scheduled;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins > 0 ? diffMins : 0;
    } catch {
      return 0;
    }
  };

  // Substitute Allocation Modal State
  const [activeRequest, setActiveRequest] = useState(null); // LeaveRequest currently being reviewed
  const [suggestions, setSuggestions] = useState([]); // suggested substitutes per period
  const [allocations, setAllocations] = useState({}); // { periodEntryId: substituteTeacherId }
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [isApprovingLeave, setIsApprovingLeave] = useState(false);

  // Live grid coverage filters
  const [selectedStandard, setSelectedStandard] = useState('All');
  const [selectedSection, setSelectedSection] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Registered classes, mappings, and UI active card states
  const [allClasses, setAllClasses] = useState([]);
  const [allMappings, setAllMappings] = useState([]);
  const [activeCardId, setActiveCardId] = useState(null);

  // Helper to resolve teacher and subject info for a registered class
  const resolveClassInfo = useCallback((clsId) => {
    const mapping = allMappings.find(m => 
      (m.class?._id || m.class)?.toString() === clsId.toString()
    );
    
    if (mapping) {
      return {
        teacher: mapping.teacher?.name || 'Not Assigned',
        teacherId: mapping.teacher?._id,
        subject: mapping.subject?.name || 'Not Assigned',
        subjectId: mapping.subject?._id
      };
    }
    
    // Fallback to class teacher
    const cls = allClasses.find(c => c._id.toString() === clsId.toString());
    return {
      teacher: cls?.classTeacher?.name || 'Not Assigned',
      teacherId: cls?.classTeacher?._id,
      subject: 'Not Assigned',
      subjectId: null
    };
  }, [allMappings, allClasses]);

  // Fetch Teacher data
  const fetchTeacherData = useCallback(async () => {
    try {
      const res = await getTeacherDashboard();
      if (res?.status && res.data) {
        setTeacherData(res.data);
        if (res.data.notifications) {
          setNotifications(res.data.notifications);
        }
      }
    } catch (err) {
      console.error('Failed to fetch teacher dashboard:', err);
      if (user?.role?.toLowerCase() === 'teacher') {
        toast.error('Could not load schedule data.');
      }
    }
  }, [user]);

  // Fetch Admin / Principal data
  const fetchAdminData = useCallback(async () => {
    try {
      const [dashRes, leavesRes] = await Promise.all([
        getAdminDashboard(),
        getLeaveRequests()
      ]);

      if (dashRes?.status && dashRes.data) {
        setAdminData(dashRes.data);
        if (dashRes.data.allClasses) {
          setAllClasses(dashRes.data.allClasses);
          if (dashRes.data.allClasses.length > 0) {
            setSelectedTimetableClass(prev => prev || dashRes.data.allClasses[0]._id);
            setSelectedClassId(prev => prev || dashRes.data.allClasses[0]._id);
          }
        }
        if (dashRes.data.allMappings) {
          setAllMappings(dashRes.data.allMappings);
        }
      }
      if (leavesRes?.status && leavesRes.data) {
        setLeaveRequests(leavesRes.data);
      }
    } catch (err) {
      console.error('Failed to fetch admin dashboard:', err);
      toast.error('Could not load live status.');
    }
  }, []);

  // Fetch monitoring data
  const fetchMonitoringData = useCallback(async () => {
    if (!['admin', 'principal', 'hod'].includes(user?.role?.toLowerCase()) && !user?.isAdmin) return;
    setMonitoringLoading(true);
    try {
      const params = {
        date: monDate,
        classId: monClassId,
        teacherId: monTeacherId,
        subjectId: monSubjectId
      };
      
      const [statusRes, statsRes, logsRes, ttRes] = await Promise.all([
        getClassStatus(params),
        getMonitoringStats(monDate),
        getAuditLogs(),
        getTimetables()
      ]);

      if (statusRes?.status) {
        setClassStatuses(statusRes.data);
      }
      if (statsRes?.status && statsRes.data) {
        setMonitoringStats(statsRes.data);
      }
      if (logsRes?.status) {
        setAuditLogs(logsRes.data);
      }
      if (ttRes?.status) {
        setTimetableEntries(ttRes.data);
      }
    } catch (err) {
      console.error('Failed to fetch monitoring data:', err);
    } finally {
      setMonitoringLoading(false);
    }
  }, [user, monDate, monClassId, monTeacherId, monSubjectId]);

  // Main fetch loop
  const refreshDashboard = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    // Always load teacher schedule for any logged-in user (all faculty have schedules)
    await fetchTeacherData();
    // Additionally load admin panel data for privileged roles
    if (['admin', 'principal', 'hod'].includes(user?.role?.toLowerCase()) || user?.isAdmin) {
      await fetchAdminData();
      await fetchMonitoringData();
    }
    setLoading(false);
  }, [user, fetchTeacherData, fetchAdminData, fetchMonitoringData]);

  useEffect(() => {
    refreshDashboard(true);
    // Poll every 30 seconds for active class status updates
    const timer = setInterval(() => refreshDashboard(false), 30000);
    return () => clearInterval(timer);
  }, [refreshDashboard]);

  // Load monitoring data when filters change or trigger updates or switching tab
  useEffect(() => {
    fetchMonitoringData();
  }, [fetchMonitoringData, socketTrigger, activeSubTab]);

  // Fetch classes, subjects, and teachers for filters dropdown
  useEffect(() => {
    const fetchFilterMetadata = async () => {
      if (!['admin', 'principal', 'hod'].includes(user?.role?.toLowerCase()) && !user?.isAdmin) return;
      try {
        const [subRes, empRes] = await Promise.all([
          getSubjects(),
          getAdminEmployees()
        ]);
        if (subRes?.status && subRes.data) {
          setSubjectsList(subRes.data);
        }
        if (empRes?.status && empRes.data?.teachers) {
          setTeachersList(empRes.data.teachers);
          if (empRes.data.teachers.length > 0) {
            setSelectedTeacherId(prev => prev || empRes.data.teachers[0]._id);
          }
        }
      } catch (err) {
        console.error('Failed to load filter metadata:', err);
      }
    };
    fetchFilterMetadata();
  }, [user]);

  // Real-time Socket.IO Connection for direct assignment push notifications
  useEffect(() => {
    if (!user?._id) return;
    const socketUrl = import.meta.env.VITE_API_URL || window.location.origin.replace('3000', '8000').replace('5173', '8000');
    const socket = io(socketUrl);

    socket.emit('register_user', user._id);

    socket.on('new_notification', (notif) => {
      setNotifications(prev => [notif, ...prev]);
      toast.success(`📢 New Assignment: ${notif.message}`, { duration: 6000 });
      // Refresh teacher schedule immediately on receiving new substitution
      if (user?.role?.toLowerCase() === 'teacher') {
        fetchTeacherData();
      }
    });

    socket.on('class_status_change', (data) => {
      toast.success(`🔄 Class status updated: Period ${data.period} for ${data.className || 'class'}`, { duration: 4000 });
      // Refresh teacher schedule immediately if teacher is involved
      if (user?.role?.toLowerCase() === 'teacher') {
        fetchTeacherData();
      } else if (['admin', 'principal', 'hod'].includes(user?.role?.toLowerCase()) || user?.isAdmin) {
        refreshDashboard(false);
      }
      // Trigger monitoring reload
      setSocketTrigger(prev => prev + 1);
    });

    return () => {
      socket.disconnect();
    };
  }, [user, fetchTeacherData, refreshDashboard]);

  // Handle Class-Specific Login
  const handleClassLogin = async (classId, period, subjectId) => {
    const toastId = toast.loading('Acquiring location for class login...');
    try {
      if (!("geolocation" in navigator)) {
        toast.error('Geolocation is not supported by this browser.', { id: toastId });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };

          try {
            const res = await classLogin(classId, period, subjectId, location);
            if (res.status) {
              toast.success('Successfully logged into class!', { id: toastId });
              refreshDashboard(false);
            } else {
              toast.error(res.message || 'Class login failed.', { id: toastId });
            }
          } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Class login failed.', { id: toastId });
          }
        },
        (error) => {
          toast.error('Failed to get your location. Please check GPS settings.', { id: toastId });
        },
        { timeout: 6000 }
      );
    } catch (err) {
      toast.error('Error initiating class login.', { id: toastId });
    }
  };

  // Handle Class-Specific Logout
  const handleClassLogout = async (classId, period) => {
    const toastId = toast.loading('Acquiring location for class logout...');
    try {
      if (!("geolocation" in navigator)) {
        toast.error('Geolocation is not supported by this browser.', { id: toastId });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };

          try {
            const res = await classLogout(classId, period, location);
            if (res.status) {
              toast.success('Successfully logged out from class!', { id: toastId });
              refreshDashboard(false);
            } else {
              toast.error(res.message || 'Class logout failed.', { id: toastId });
            }
          } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Class logout failed.', { id: toastId });
          }
        },
        (error) => {
          toast.error('Failed to get your location. Please check GPS settings.', { id: toastId });
        },
        { timeout: 6000 }
      );
    } catch (err) {
      toast.error('Error initiating class logout.', { id: toastId });
    }
  };

  // Handle Leave Submission
  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    if (!leaveDate) {
      toast.error('Please select a leave date.');
      return;
    }
    if (!leaveReason.trim()) {
      toast.error('Please enter a reason.');
      return;
    }

    setIsSubmittingLeave(true);
    try {
      const res = await requestLeave(leaveDate, leaveReason.trim());
      if (res?.status) {
        toast.success('Leave request submitted successfully!');
        setLeaveDate('');
        setLeaveReason('');
        refreshDashboard(false);
      } else {
        toast.error(res?.message || 'Failed to submit leave.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error submitting leave.');
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!schedSubject.trim()) {
      toast.error('Please enter a subject name');
      return;
    }
    
    setIsSubmittingSchedule(true);
    try {
      const payload = {
        standard: schedStandard,
        section: schedSection.toUpperCase(),
        board: schedBoard,
        subjectName: schedSubject,
        period: Number(schedPeriod),
        timeSlot: schedTimeSlot,
        day: schedDay
      };
      
      if (schedType === 'manual') {
        if (!schedDate) {
          toast.error('Please pick a date for manual override');
          setIsSubmittingSchedule(false);
          return;
        }
        payload.date = schedDate;
        
        // Resolve day from date
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const d = new Date(schedDate);
        payload.day = daysOfWeek[d.getUTCDay()];
      }
      
      const res = await createTeacherSchedule(payload);
      if (res?.status) {
        toast.success(res.message || 'Schedule entry saved successfully!');
        setShowScheduleModal(false);
        setSchedSubject('');
        setSchedDate('');
        refreshDashboard(true);
      } else {
        toast.error(res?.message || 'Failed to save schedule');
      }
    } catch (err) {
      console.error('Failed to create teacher schedule:', err);
      toast.error(err.response?.data?.message || 'Error occurred while saving schedule');
    } finally {
      setIsSubmittingSchedule(false);
    }
  };

  // Open substitute selection modal for a specific leave request
  const handleReviewLeave = async (req) => {
    setActiveRequest(req);
    setLoadingSuggestions(true);
    setAllocations({});
    try {
      const res = await getSubstituteSuggestions(req.teacher._id, req.leaveDate);
      if (res?.status && Array.isArray(res.data)) {
        setSuggestions(res.data);
        // Pre-select the first candidate (best match) for each period
        const initialAllocations = {};
        res.data.forEach(period => {
          if (period.candidates && period.candidates.length > 0) {
            initialAllocations[period.periodEntryId] = period.candidates[0].teacherId;
          }
        });
        setAllocations(initialAllocations);
      }
    } catch (err) {
      toast.error('Failed to load substitute suggestions.');
      console.error(err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Handle Leave Approval
  const handleApproveLeave = async (status) => {
    if (!activeRequest) return;
    setIsApprovingLeave(true);
    try {
      const substituteAllocations = Object.entries(allocations).map(([periodEntryId, substituteTeacherId]) => ({
        periodEntryId,
        substituteTeacherId
      }));

      const res = await approveLeave(activeRequest._id, status, substituteAllocations);
      if (res?.status) {
        toast.success(`Leave request ${status.toLowerCase()}!`);
        setActiveRequest(null);
        refreshDashboard(true);
      } else {
        toast.error(res?.message || 'Failed to process request.');
      }
    } catch (err) {
      toast.error('Error processing leave request.');
      console.error(err);
    } finally {
      setIsApprovingLeave(false);
    }
  };

  // Handle Direct Substitute Allocation
  const handleSaveDirectSubstitute = async () => {
    if (!activeRequest) return;
    setIsApprovingLeave(true);
    try {
      const substituteAllocations = Object.entries(allocations).map(([periodEntryId, substituteTeacherId]) => ({
        periodEntryId,
        substituteTeacherId
      }));

      const res = await assignSubstituteDirectly({
        teacherId: activeRequest.teacher._id,
        date: activeRequest.leaveDate,
        substituteAllocations
      });
      
      if (res?.status) {
        toast.success('Substitute teacher arranged successfully!');
        setActiveRequest(null);
        refreshDashboard(true);
      } else {
        toast.error(res?.message || 'Failed to arrange substitute.');
      }
    } catch (err) {
      toast.error('Error arranging substitute teacher.');
      console.error(err);
    } finally {
      setIsApprovingLeave(false);
    }
  };

  const handlePrincipalClassLogin = async (classId, subjectId, teacherId) => {
    if (!subjectId) {
      toast.error('Cannot log in: Class Mapping (Subject/Teacher) is missing.');
      return;
    }
    const toastId = toast.loading('Logging in to class...');
    try {
      const res = await classLogin(classId, 1, subjectId, { latitude: 0, longitude: 0 }, teacherId);
      if (res.status) {
        toast.success('Class session started (Green status)!', { id: toastId });
        refreshDashboard(false);
      } else {
        toast.error(res.message || 'Failed to log in class', { id: toastId });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to log in class', { id: toastId });
    }
  };

  const handlePrincipalClassLogout = async (classId) => {
    const toastId = toast.loading('Logging out from class...');
    try {
      const res = await classLogout(classId, 1, { latitude: 0, longitude: 0 });
      if (res.status) {
        toast.success('Class session ended (Red status)!', { id: toastId });
        refreshDashboard(false);
      } else {
        toast.error(res.message || 'Failed to log out class', { id: toastId });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to log out class', { id: toastId });
    }
  };

  const handleCellClick = async (day, period, classId, entry) => {
    setSelectedCellDetails({ day, period, classId, entry });
    setIsCellDetailsModalOpen(true);
    setIsEditMode(false);
    
    // Prefill form for editing/adding
    setTimetableForm({
      classId: classId || (entry?.class?._id || entry?.class || ''),
      day,
      period,
      startTime: entry?.startTime || defaultTimeSlots[period]?.split('-')[0] || '09:00',
      endTime: entry?.endTime || defaultTimeSlots[period]?.split('-')[1] || '09:45',
      teacherId: entry?.teacher?._id || '',
      subjectId: entry?.subject?._id || ''
    });

    if (classId) {
      setClassHistoryLoading(true);
      try {
        const res = await getClassHistory(classId);
        if (res?.status && res.data) {
          setClassHistory(res.data);
        } else {
          setClassHistory([]);
        }
      } catch (err) {
        console.error('Failed to load class history:', err);
        setClassHistory([]);
      } finally {
        setClassHistoryLoading(false);
      }
    } else {
      setClassHistory([]);
    }
  };

  const fetchClassHistoryForModal = async (classId) => {
    setCardClassHistoryLoading(true);
    try {
      const res = await getClassHistory(classId);
      if (res?.status && res.data) {
        setCardClassHistory(res.data);
      } else {
        setCardClassHistory([]);
      }
    } catch (err) {
      console.error('Failed to load class history for modal:', err);
      setCardClassHistory([]);
    } finally {
      setCardClassHistoryLoading(false);
    }
  };

  const handleTimetableSubmit = async (e) => {
    e.preventDefault();
    if (!timetableForm.classId || !timetableForm.teacherId || !timetableForm.subjectId) {
      toast.error('Please fill in all fields (Class, Teacher, Subject)');
      return;
    }

    setIsSavingTimetable(true);
    const toastId = toast.loading('Saving timetable entry...');
    try {
      let res;
      if (selectedCellDetails?.entry?._id) {
        // Update
        res = await updateTimetableEntry(selectedCellDetails.entry._id, timetableForm);
      } else {
        // Create
        res = await createTimetableEntry(timetableForm);
      }

      if (res?.status) {
        toast.success('Timetable saved successfully!', { id: toastId });
        setIsCellDetailsModalOpen(false);
        refreshDashboard(true);
      } else {
        toast.error(res?.message || 'Failed to save timetable entry', { id: toastId });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Error saving timetable', { id: toastId });
    } finally {
      setIsSavingTimetable(false);
    }
  };

  const handleDeleteTimetable = async (id) => {
    if (!window.confirm('Are you sure you want to delete this timetable slot?')) return;
    const toastId = toast.loading('Deleting timetable entry...');
    try {
      const res = await deleteTimetableEntry(id);
      if (res?.status) {
        toast.success('Timetable entry deleted!', { id: toastId });
        setIsCellDetailsModalOpen(false);
        refreshDashboard(true);
      } else {
        toast.error(res?.message || 'Failed to delete entry', { id: toastId });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Error deleting entry', { id: toastId });
    }
  };

  const escapeCSV = (val) => {
    if (val === undefined || val === null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const handleExportExcel = (type) => {
    let filename = 'timetable.csv';
    let headers = [];
    let rows = [];
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayDayName = daysOfWeek[new Date().getDay()];

    if (type === 'weekly') {
      filename = `weekly_timetable_${selectedTimetableClass}.csv`;
      headers = ['Period', 'Time Slot', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      for (let p = 1; p <= 7; p++) {
        const row = [`Period ${p}`, defaultTimeSlots[p] || ''];
        days.forEach(day => {
          const entry = timetableEntries.find(e => 
            e.day === day && 
            e.period === p && 
            (e.class?._id || e.class)?.toString() === selectedTimetableClass
          );
          
          let statusText = '';
          if (entry) {
            const status = getCellStatusColor(day, p, entry.class?._id || entry.class);
            if (status === 'green') statusText = ' [ACTIVE]';
            else if (status === 'yellow') statusText = ' [SUBSTITUTE]';
            else if (status === 'red') statusText = ' [ABSENT]';
          }
          
          row.push(entry ? `${entry.subject?.name || 'Sub'} (${entry.teacher?.name || 'Teacher'})${statusText}` : '-');
        });
        rows.push(row.map(escapeCSV));
      }
    } else if (type === 'teacher') {
      const teacherName = teachersList.find(t => t._id === selectedTeacherId)?.name || 'teacher';
      filename = `timetable_${teacherName.replace(/\s+/g, '_')}.csv`;
      headers = ['Day', 'Period', 'Time Slot', 'Class', 'Subject'];
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      days.forEach(day => {
        const entries = timetableEntries.filter(e => 
          e.day === day && 
          (e.teacher?._id || e.teacher)?.toString() === selectedTeacherId
        );
        if (entries.length === 0) {
          rows.push([day, '-', '-', '-', '-'].map(escapeCSV));
        } else {
          entries.forEach(e => {
            let statusText = '';
            if (day === todayDayName) {
              const status = getCellStatusColor(day, e.period, e.class?._id || e.class);
              if (status === 'green') statusText = ' [ACTIVE]';
              else if (status === 'yellow') statusText = ' [SUBSTITUTE]';
              else if (status === 'red') statusText = ' [ABSENT]';
            }
            rows.push([
              day,
              `Period ${e.period}`,
              e.timeSlot,
              e.className || `${e.class?.standard || ''}-${e.class?.section || ''}`,
              `${e.subject?.name || ''}${statusText}`
            ].map(escapeCSV));
          });
        }
      });
    } else if (type === 'class') {
      const className = allClasses.find(c => c._id === selectedClassId) 
        ? `${allClasses.find(c => c._id === selectedClassId).standard}-${allClasses.find(c => c._id === selectedClassId).section}` 
        : 'class';
      filename = `timetable_class_${className}.csv`;
      headers = ['Day', 'Period', 'Time Slot', 'Subject', 'Teacher'];
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      days.forEach(day => {
        const entries = timetableEntries.filter(e => 
          e.day === day && 
          (e.class?._id || e.class)?.toString() === selectedClassId
        );
        if (entries.length === 0) {
          rows.push([day, '-', '-', '-', '-'].map(escapeCSV));
        } else {
          entries.forEach(e => {
            let statusText = '';
            if (day === todayDayName) {
              const status = getCellStatusColor(day, e.period, e.class?._id || e.class);
              if (status === 'green') statusText = ' [ACTIVE]';
              else if (status === 'yellow') statusText = ' [SUBSTITUTE]';
              else if (status === 'red') statusText = ' [ABSENT]';
            }
            rows.push([
              day,
              `Period ${e.period}`,
              e.timeSlot,
              `${e.subject?.name || ''}${statusText}`,
              e.teacher?.name || ''
            ].map(escapeCSV));
          });
        }
      });
    }

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintTimetable = (type) => {
    let title = '';
    let contentHtml = '';
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayDayName = daysOfWeek[new Date().getDay()];

    if (type === 'weekly') {
      const clsDoc = allClasses.find(c => c._id === selectedTimetableClass);
      const className = clsDoc ? `${clsDoc.standard}-${clsDoc.section}` : '';
      title = `Weekly Timetable - Class ${className}`;
      
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      contentHtml = `
        <table>
          <thead>
            <tr>
              <th>Period</th>
              <th>Time</th>
              ${days.map(d => `<th>${d}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${[1, 2, 3, 4, 5, 6, 7].map(p => `
              <tr>
                <td><strong>Period ${p}</strong></td>
                <td class="time-slot">${defaultTimeSlots[p] || ''}</td>
                ${days.map(day => {
                  const entry = timetableEntries.find(e => 
                    e.day === day && 
                    e.period === p && 
                    (e.class?._id || e.class)?.toString() === selectedTimetableClass
                  );
                  const status = entry ? getCellStatusColor(day, p, entry.class?._id || entry.class) : 'empty';
                  let cellStyle = '';
                  let statusLabel = '';
                  if (status === 'green') {
                    cellStyle = 'background-color: #d1fae5; color: #065f46; font-weight: bold; border: 1.5px solid #34d399;';
                    statusLabel = ' <span style="font-size: 8px; text-transform: uppercase; background-color: #a7f3d0; padding: 1px 3px; border-radius: 3px;">Active</span>';
                  } else if (status === 'yellow') {
                    cellStyle = 'background-color: #fef3c7; color: #92400e; font-weight: bold; border: 1.5px solid #fbbf24;';
                    statusLabel = ' <span style="font-size: 8px; text-transform: uppercase; background-color: #fde68a; padding: 1px 3px; border-radius: 3px;">Sub</span>';
                  } else if (status === 'red') {
                    cellStyle = 'background-color: #fee2e2; color: #991b1b; font-weight: bold; border: 1.5px solid #f87171;';
                    statusLabel = ' <span style="font-size: 8px; text-transform: uppercase; background-color: #fecaca; padding: 1px 3px; border-radius: 3px;">Absent</span>';
                  } else if (status === 'neutral') {
                    cellStyle = 'background-color: #f5f5f4; color: #444; border: 1px solid #e7e5e4;';
                  }
                  return `
                    <td style="${cellStyle}">
                      ${entry ? `
                        <div class="subject" style="font-weight: 800;">${entry.subject?.name || ''}${statusLabel}</div>
                        <div style="font-size:10px; margin-top: 2px;">👤 ${entry.teacher?.name || ''}</div>
                      ` : '-'}
                    </td>
                  `;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (type === 'teacher') {
      const teacherName = teachersList.find(t => t._id === selectedTeacherId)?.name || 'Teacher';
      title = `Schedule for Teacher: ${teacherName}`;
      
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      contentHtml = days.map(day => {
        const entries = timetableEntries.filter(e => 
          e.day === day && 
          (e.teacher?._id || e.teacher)?.toString() === selectedTeacherId
        ).sort((a,b) => a.period - b.period);
        
        return `
          <div style="margin-bottom: 15px; break-inside: avoid;">
            <h3 style="border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 5px;">${day}</h3>
            ${entries.length === 0 ? '<p style="font-size:11px; color:#666; font-style:italic;">No periods scheduled</p>' : `
              <table>
                <thead>
                  <tr>
                    <th style="width: 15%;">Period</th>
                    <th style="width: 20%;">Time</th>
                    <th style="width: 30%;">Class</th>
                    <th style="width: 35%;">Subject</th>
                  </tr>
                </thead>
                <tbody>
                  ${entries.map(e => {
                    let statusLabel = '';
                    if (day === todayDayName) {
                      const status = getCellStatusColor(day, e.period, e.class?._id || e.class);
                      if (status === 'green') statusLabel = ' <span style="color: #065f46; font-weight: bold; font-size: 10px;">[Active]</span>';
                      else if (status === 'yellow') statusLabel = ' <span style="color: #92400e; font-weight: bold; font-size: 10px;">[Substitute]</span>';
                      else if (status === 'red') statusLabel = ' <span style="color: #991b1b; font-weight: bold; font-size: 10px;">[Absent]</span>';
                    }
                    return `
                      <tr>
                        <td>Period ${e.period}</td>
                        <td class="time-slot">${e.timeSlot}</td>
                        <td>Class ${e.className || `${e.class?.standard || ''}-${e.class?.section || ''}`}</td>
                        <td class="subject">${e.subject?.name || ''}${statusLabel}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            `}
          </div>
        `;
      }).join('');
    } else if (type === 'class') {
      const clsDoc = allClasses.find(c => c._id === selectedClassId);
      const className = clsDoc ? `${clsDoc.standard}-${clsDoc.section} (${clsDoc.board})` : '';
      title = `Schedule for Class: ${className}`;
      
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      contentHtml = days.map(day => {
        const entries = timetableEntries.filter(e => 
          e.day === day && 
          (e.class?._id || e.class)?.toString() === selectedClassId
        ).sort((a,b) => a.period - b.period);
        
        return `
          <div style="margin-bottom: 15px; break-inside: avoid;">
            <h3 style="border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 5px;">${day}</h3>
            ${entries.length === 0 ? '<p style="font-size:11px; color:#666; font-style:italic;">No periods scheduled</p>' : `
              <table>
                <thead>
                  <tr>
                    <th style="width: 15%;">Period</th>
                    <th style="width: 20%;">Time</th>
                    <th style="width: 35%;">Subject</th>
                    <th style="width: 30%;">Teacher</th>
                  </tr>
                </thead>
                <tbody>
                  ${entries.map(e => {
                    let statusLabel = '';
                    if (day === todayDayName) {
                      const status = getCellStatusColor(day, e.period, e.class?._id || e.class);
                      if (status === 'green') statusLabel = ' <span style="color: #065f46; font-weight: bold; font-size: 10px;">[Active]</span>';
                      else if (status === 'yellow') statusLabel = ' <span style="color: #92400e; font-weight: bold; font-size: 10px;">[Substitute]</span>';
                      else if (status === 'red') statusLabel = ' <span style="color: #991b1b; font-weight: bold; font-size: 10px;">[Absent]</span>';
                    }
                    return `
                      <tr>
                        <td>Period ${e.period}</td>
                        <td class="time-slot">${e.timeSlot}</td>
                        <td class="subject">${e.subject?.name || ''}${statusLabel}</td>
                        <td>👤 ${e.teacher?.name || ''}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            `}
          </div>
        `;
      }).join('');
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; color: #1c1917; }
            h1 { text-align: center; font-size: 20px; margin-bottom: 25px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
            h3 { font-size: 14px; font-weight: 700; color: #b45309; text-transform: uppercase; margin-top: 15px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
            th, td { border: 1px solid #e7e5e4; padding: 8px 10px; text-align: left; }
            th { background-color: #f5f5f4; font-weight: 700; text-transform: uppercase; font-size: 10px; color: #57534e; }
            .time-slot { font-weight: 600; color: #b45309; font-family: monospace; }
            .subject { font-weight: 700; color: #1c1917; }
            @media print {
              body { padding: 0; }
              @page { size: A4; margin: 1.5cm; }
            }
          </style>
        </head>
        <body>
           <h1>${title}</h1>
           ${contentHtml}
           <script>
             window.onload = function() {
               window.print();
               setTimeout(function() { window.close(); }, 500);
             };
           </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

   // Live grid coverage filters computations
  const availableStandards = Array.from(new Set((allClasses || []).map(c => c.standard))).filter(Boolean).sort();
  const availableSections = Array.from(new Set((allClasses || []).map(c => c.section))).filter(Boolean).sort();

  const displayedClasses = (allClasses || []).filter(cls => {
    const matchesStandard = selectedStandard === 'All' || cls.standard === selectedStandard;
    const matchesSection = selectedSection === 'All' || cls.section === selectedSection;
    
    const info = resolveClassInfo(cls._id);
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query ||
      info.teacher.toLowerCase().includes(query) ||
      info.subject.toLowerCase().includes(query) ||
      cls.standard.toLowerCase().includes(query) ||
      cls.section.toLowerCase().includes(query);
      
    return matchesStandard && matchesSection && matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-stone-850">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-stone-400">Waking up institution services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-stone-800 flex flex-col md:flex-row font-sans">
      
      {/* Sidebar navigation */}
      <Sidebar />

      {/* Main dashboard content */}
      <div className="flex-1 bg-white p-4 sm:p-6 lg:p-8 overflow-y-auto">
        
        {/* Top welcome banner */}
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-stone-200 shadow-sm rounded-2xl p-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-1">
              {user?.role?.toLowerCase() === 'admin' || user?.isAdmin ? 'System Administrator' : user?.profession || 'Faculty Profile'}
            </div>
            <h1 className="text-2xl font-black text-stone-900">
              Welcome back, {user?.name}
            </h1>
            <p className="text-stone-500 text-sm mt-0.5">
              Today is {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <button
            onClick={() => refreshDashboard(true)}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-xl text-xs font-bold text-stone-700 transition-all flex items-center gap-2"
          >
            <span>🔄</span> Sync Dashboard
          </button>
        </div>

        {/* ─── TEACHER VIEW ─── */}
        {teacherData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left side: Timeline schedule and stats */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-4 text-center">
                  <span className="text-[10px] uppercase font-bold text-stone-400 block mb-1">Total Classes</span>
                  <span className="text-3xl font-extrabold text-amber-600">{teacherData.cards.total}</span>
                </div>
                <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-4 text-center">
                  <span className="text-[10px] uppercase font-bold text-stone-400 block mb-1">Completed</span>
                  <span className="text-3xl font-extrabold text-emerald-600">{teacherData.cards.completed}</span>
                </div>
                <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-4 text-center">
                  <span className="text-[10px] uppercase font-bold text-stone-400 block mb-1">Upcoming</span>
                  <span className="text-3xl font-extrabold text-sky-650">{teacherData.cards.upcoming}</span>
                </div>
                <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 text-center">
                  <span className="text-[10px] uppercase font-bold text-amber-600 block mb-1">Substitutes</span>
                  <span className="text-3xl font-extrabold text-amber-600">{teacherData.cards.substitute}</span>
                </div>
              </div>

              {/* Day Timeline Schedule */}
              <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                    <span>📅</span> Today's Teaching Schedule
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(true)}
                    className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-yellow-600 text-stone-950 text-xs font-black rounded-xl transition-all flex items-center gap-1 shadow-md"
                  >
                    <span>➕</span> Add Class Schedule
                  </button>
                </div>

                {teacherData.schedule.length === 0 ? (
                  <div className="text-center py-12 text-stone-400 italic flex flex-col items-center gap-4">
                    <span>🎉 No classes scheduled for today.</span>
                    <button
                      type="button"
                      onClick={() => setShowScheduleModal(true)}
                      className="px-4 py-2 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-xl text-xs font-bold text-stone-700 transition-all flex items-center gap-2"
                    >
                      <span>📅</span> Create Your School Schedule Now
                    </button>
                  </div>
                ) : (
                  <div className="relative border-l border-stone-200 ml-4 space-y-6">
                    {teacherData.schedule.map((slot, index) => (
                      <div key={index} className="relative pl-6">
                        
                        {/* Timeline point */}
                        <div className={`absolute -left-2 top-1.5 w-4 h-4 rounded-full border-2 border-white ${
                          slot.classMarkColor === 'green'
                            ? 'bg-emerald-500 shadow-md'
                            : slot.classMarkColor === 'red'
                              ? 'bg-red-500 shadow-md'
                              : 'bg-stone-300'
                        }`} />

                        {/* Card wrapper */}
                        <div className={`rounded-xl p-4 border transition-all ${
                          slot.arrangedMarkColor === 'orange'
                            ? 'bg-amber-50/50 border-amber-200'
                            : slot.classMarkColor === 'green'
                              ? 'bg-emerald-50/30 border-emerald-200 shadow-sm'
                              : 'bg-stone-50/50 border-stone-200'
                        }`}>
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono text-stone-500">{slot.timeSlot}</span>
                              <span className="text-xs text-stone-400">({slot.duration} mins)</span>
                              <span className="text-xs font-mono text-stone-400">| Period {slot.period}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {/* Arranged Alternate marker (orange) */}
                              {slot.arrangedMarkColor === 'orange' && (
                                <span className="text-[10px] bg-orange-100 text-orange-850 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border border-orange-200">
                                  Alternate arranged
                                </span>
                              )}
                              {/* Class state marker (green/red) */}
                              {slot.classMarkColor === 'green' ? (
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-emerald-200 animate-pulse">
                                  Class active
                                </span>
                              ) : (
                                <span className="text-[10px] bg-red-100 text-red-800 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-red-200">
                                  Class ended
                                </span>
                              )}
                              {/* Teacher presence marker (green/red) */}
                              {slot.teacherMarkColor === 'green' ? (
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-emerald-200">
                                  Teacher Present
                                </span>
                              ) : (
                                <span className="text-[10px] bg-red-100 text-red-800 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-red-200">
                                  Teacher Absent
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mt-3">
                            <div>
                              <h4 className="text-lg font-black text-stone-900">{slot.subject}</h4>
                              <p className="text-stone-500 text-sm mt-0.5">Class: {slot.standard} - Section {slot.section} ({slot.board || 'CBSE'})</p>
                            </div>
                            
                             {/* Dynamic status display with START CLASS and END CLASS buttons */}
                             <div className="flex gap-2 w-full sm:w-auto">
                               {!slot.classSession ? (
                                 <button
                                   onClick={() => handleClassLogin(slot.classId, slot.period, slot.subjectId)}
                                   className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-stone-900 font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                                 >
                                   🚀 START CLASS
                                 </button>
                               ) : slot.classSession.status === 'active' ? (
                                 <button
                                   onClick={() => handleClassLogout(slot.classId, slot.period)}
                                   className="px-4 py-2 bg-gradient-to-r from-rose-500 to-red-650 hover:from-rose-600 hover:to-red-750 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                                 >
                                   🛑 END CLASS
                                 </button>
                               ) : (
                                 <span className="text-xs text-stone-500 font-bold bg-stone-100 px-3 py-1.5 rounded-lg border border-stone-200">
                                   ✓ Class Log Completed ({new Date(slot.classSession.loginTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(slot.classSession.logoutTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})
                                 </span>
                               )}
                             </div>
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Right side: Leave form & Live updates */}
            <div className="space-y-6">
              
              {/* Leave request form */}
              <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-6">
                <h3 className="text-base font-bold text-stone-900 mb-4 flex items-center gap-2">
                  <span>✍️</span> Apply for Leave
                </h3>
                <form onSubmit={handleLeaveSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 uppercase mb-1">Leave Date</label>
                    <input 
                      type="date"
                      value={leaveDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setLeaveDate(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-500 text-stone-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 uppercase mb-1">Reason</label>
                    <textarea
                      rows="3"
                      value={leaveReason}
                      placeholder="e.g., Medical checkup, family urgency..."
                      onChange={(e) => setLeaveReason(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-500 text-stone-900 placeholder-stone-400"
                    ></textarea>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmittingLeave}
                    className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-stone-950 font-extrabold text-sm rounded-xl transition-all shadow-md disabled:opacity-50"
                  >
                    {isSubmittingLeave ? 'Submitting request...' : 'File Leave Request'}
                  </button>
                </form>
              </div>

              {/* Real-time notifications / inbox list */}
              <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-6">
                <h3 className="text-base font-bold text-stone-900 mb-4 flex items-center gap-2">
                  <span>🔔</span> Live Assignment Alerts
                </h3>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {notifications.length === 0 ? (
                    <p className="text-stone-400 italic text-sm text-center py-6">No new alerts.</p>
                  ) : (
                    notifications.map((notif, index) => (
                      <div key={index} className="bg-stone-50 border border-stone-200/80 rounded-xl p-3.5 text-xs text-stone-700">
                        <p className="leading-relaxed font-medium">{notif.message}</p>
                        <span className="text-[10px] text-stone-400 font-mono block mt-1.5">
                          {new Date(notif.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

          </div>
        )}        {['admin', 'principal', 'hod'].includes(user?.role?.toLowerCase()) && adminData && (() => {
          // Display stats directly from the API response
          const totalTeachers = adminData.stats?.totalTeachers || 0;
          const currentlyTeaching = adminData.stats?.currentlyTeaching || 0;
          const availableTeachers = adminData.stats?.availableTeachers || 0;
          const absentTeachers = adminData.stats?.absentTeachers || 0;

          // Compliance stats counters from monitoringStats API (or fallback to adminData.stats)
          const onTime = monitoringStats?.onTime || adminData.stats?.greenClasses || 0;
          const late = monitoringStats?.late || adminData.stats?.yellowClasses || 0;
          const absent = monitoringStats?.absent || adminData.stats?.redClasses || 0;
          const substituteActive = monitoringStats?.substituteActive || adminData.stats?.purpleClasses || 0;
          const upcoming = monitoringStats?.upcoming || adminData.stats?.blueClasses || 0;
          const totalScheduled = monitoringStats?.totalScheduled || adminData.stats?.totalScheduled || (onTime + late + absent + substituteActive + upcoming);

          const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const periods = [1, 2, 3, 4, 5, 6, 7];
          const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const todayDayName = daysOfWeek[new Date().getDay()]; // always use today's weekday for live indicator colors

          return (
            <div className="space-y-6">
              
              {/* Dashboard Title */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-amber-500/5 to-yellow-500/5 border border-stone-200 rounded-2xl p-6">
                <div>
                  <h2 className="text-xl font-black text-stone-900 tracking-tight uppercase">
                    🏫 Teacher Monitoring Dashboard
                  </h2>
                  <p className="text-stone-550 text-xs mt-1">
                    Unified administration control center for schedules, real-time class operations, and attendance audits.
                  </p>
                </div>
              </div>

              {/* Sub-tab Navigation */}
              <div className="flex border-b border-stone-200 gap-4 mb-2 no-print overflow-x-auto scrollbar-thin">
                {[
                  { id: 'overview', label: '📊 Overview' },
                  { id: 'live_monitoring', label: '⚡ Live Monitoring' },
                  { id: 'weekly_timetable', label: '📅 Weekly Timetable' },
                  { id: 'teacher_schedule', label: '👤 Teacher Schedule' },
                  { id: 'class_schedule', label: '🏫 Class Schedule' },
                  { id: 'activity_logs', label: '📋 Activity Logs' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveSubTab(tab.id)}
                    className={`pb-2.5 text-sm font-extrabold transition-all border-b-2 whitespace-nowrap ${
                      activeSubTab === tab.id
                        ? 'border-amber-500 text-stone-900'
                        : 'border-transparent text-stone-400 hover:text-stone-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* 1. OVERVIEW SUB-TAB */}
              {activeSubTab === 'overview' && (
                <div className="space-y-6 animate-fadeIn">
                  
                  {/* Statistics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
                    <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-4 flex flex-col justify-between transition-all hover:shadow-md">
                      <span className="text-stone-550 text-[10px] font-bold uppercase tracking-wider">Total Teachers</span>
                      <span className="text-3xl font-extrabold text-stone-900 mt-2">{totalTeachers}</span>
                    </div>
                    <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-4 flex flex-col justify-between transition-all hover:shadow-md">
                      <span className="text-stone-555 text-[10px] font-bold uppercase tracking-wider text-emerald-650">Currently Teaching</span>
                      <span className="text-3xl font-extrabold text-emerald-650 mt-2">{currentlyTeaching}</span>
                    </div>
                    <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-4 flex flex-col justify-between transition-all hover:shadow-md">
                      <span className="text-stone-555 text-[10px] font-bold uppercase tracking-wider text-sky-650">Available Teachers</span>
                      <span className="text-3xl font-extrabold text-sky-650 mt-2">{availableTeachers}</span>
                    </div>
                    <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-4 flex flex-col justify-between transition-all hover:shadow-md">
                      <span className="text-stone-555 text-[10px] font-bold uppercase tracking-wider text-rose-650">Absent Teachers</span>
                      <span className="text-3xl font-extrabold text-rose-650 mt-2">{absentTeachers}</span>
                    </div>
                    <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-4 flex flex-col justify-between transition-all hover:shadow-md">
                      <span className="text-stone-555 text-[10px] font-bold uppercase tracking-wider text-emerald-600">On Time</span>
                      <span className="text-3xl font-extrabold text-emerald-600 mt-2">{onTime}</span>
                    </div>
                    <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-4 flex flex-col justify-between transition-all hover:shadow-md">
                      <span className="text-stone-555 text-[10px] font-bold uppercase tracking-wider text-amber-600 font-extrabold">Late</span>
                      <span className="text-3xl font-extrabold text-amber-600 mt-2">{late}</span>
                    </div>
                    <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-4 flex flex-col justify-between transition-all hover:shadow-md">
                      <span className="text-stone-555 text-[10px] font-bold uppercase tracking-wider text-rose-650">Absent / Delayed</span>
                      <span className="text-3xl font-extrabold text-rose-650 mt-2">{absent}</span>
                    </div>
                    <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-4 flex flex-col justify-between transition-all hover:shadow-md">
                      <span className="text-stone-555 text-[10px] font-bold uppercase tracking-wider text-purple-650">Substitute Active</span>
                      <span className="text-3xl font-extrabold text-purple-650 mt-2">{substituteActive}</span>
                    </div>
                  </div>

                  {/* Math Validation Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    <div className="bg-emerald-50/40 border border-emerald-200 rounded-2xl p-5 flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="text-emerald-800 text-xs font-bold uppercase tracking-wider">Faculty Attendance Validation</h4>
                        <p className="text-stone-600 text-xs font-medium mt-1">
                          Teaching ({currentlyTeaching}) + Available ({availableTeachers}) + Absent ({absentTeachers}) = Total Teachers ({totalTeachers})
                        </p>
                      </div>
                      <div className="w-9 h-9 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full flex items-center justify-center text-sm font-extrabold">
                        ✓
                      </div>
                    </div>

                    <div className="bg-amber-50/40 border border-amber-200 rounded-2xl p-5 flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="text-amber-800 text-xs font-bold uppercase tracking-wider">Active Classroom Validation</h4>
                        <p className="text-stone-600 text-xs font-medium mt-1">
                          On Time ({onTime}) + Late ({late}) + Absent ({absent}) + Substitute ({substituteActive}) + Upcoming ({upcoming}) = Scheduled Periods ({totalScheduled})
                        </p>
                      </div>
                      <div className="w-9 h-9 bg-amber-100 text-amber-808 border border-amber-200 rounded-full flex items-center justify-center text-sm font-extrabold">
                        ✓
                      </div>
                    </div>
                  </div>


                  {/* Quick Status Lists */}
                  {(() => {
                    const delayedClasses = classStatuses.filter(c => c.statusColor === 'red' || c.statusColor === 'yellow');
                    return (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* 1. DELAYED CLASSES */}
                        <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-6">
                          <h4 className="text-stone-850 text-xs font-bold uppercase tracking-wider mb-4 flex justify-between">
                            <span>🚨 Delayed Classes</span>
                            <span className="text-rose-600">({delayedClasses.length})</span>
                          </h4>
                          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                            {delayedClasses.length === 0 ? (
                              <p className="text-stone-400 text-xs italic py-6 text-center">No delayed classes detected.</p>
                            ) : (
                              delayedClasses.map((c, idx) => {
                                const delayMins = getDelayMinutes(c.timeSlot, c.loginTime, monDate);
                                return (
                                  <div key={idx} className="bg-stone-50 border border-stone-150 rounded-xl p-3 flex justify-between items-center text-xs">
                                    <div className="min-w-0 flex-1">
                                      <span className="font-extrabold text-stone-900 block truncate">{c.className}</span>
                                      <span className="text-[10px] text-stone-450 mt-0.5 block truncate">Subject: {c.subjectName} | Period: {c.period}</span>
                                      <span className="text-[10px] text-stone-550 font-bold block mt-1 truncate">Teacher: {c.assignedTeacherName}</span>
                                    </div>
                                    <div className="text-right ml-2 flex-shrink-0">
                                      <span className="text-[9px] bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded font-extrabold uppercase block text-center">
                                        Delay: {delayMins} Min
                                      </span>
                                      <span className="text-[8px] text-stone-400 mt-1 block font-mono">{c.timeSlot}</span>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                        {/* 2. CLASSES REQUIRING ATTENTION */}
                        <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-6">
                          <h4 className="text-stone-850 text-xs font-bold uppercase tracking-wider mb-4 flex justify-between">
                            <span>⚠️ Classes Requiring Attendance Attention</span>
                            <span className="text-rose-600">({absent})</span>
                          </h4>
                          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                            {absent === 0 ? (
                              <p className="text-stone-400 text-xs italic py-6 text-center">All classes running correctly or have substitutes.</p>
                            ) : (
                              classStatuses.filter(c => c.statusColor === 'red').map((c, idx) => (
                                <div key={idx} className="bg-stone-50 border border-stone-150 rounded-xl p-3 flex justify-between items-center text-xs">
                                  <div>
                                    <span className="font-extrabold text-stone-900 block">{c.className}</span>
                                    <span className="text-[10px] text-stone-450 mt-0.5 block">Subject: {c.subjectName} | Period: {c.period}</span>
                                  </div>
                                  <span className="text-[9px] bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded font-extrabold uppercase whitespace-nowrap">
                                    Absent: {c.assignedTeacherName}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* 3. SUBSTITUTE ASSIGNMENTS */}
                        <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-6">
                          <h4 className="text-stone-850 text-xs font-bold uppercase tracking-wider mb-4 flex justify-between">
                            <span>🔄 Substitute Teacher Assignments</span>
                            <span className="text-purple-650">({substituteActive})</span>
                          </h4>
                          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                            {substituteActive === 0 ? (
                              <p className="text-stone-400 text-xs italic py-6 text-center">No substitute arrangements currently active.</p>
                            ) : (
                              classStatuses.filter(c => c.statusColor === 'purple').map((c, idx) => (
                                <div key={idx} className="bg-stone-50 border border-stone-150 rounded-xl p-3 flex justify-between items-center text-xs">
                                  <div>
                                    <span className="font-extrabold text-stone-900 block">{c.className}</span>
                                    <span className="text-[10px] text-stone-450 mt-0.5 block">Subject: {c.subjectName} | Period: {c.period}</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[9px] bg-amber-100 text-amber-805 border border-amber-200 px-2 py-0.5 rounded font-extrabold uppercase block text-center">
                                      Sub: {c.currentTeacherName}
                                    </span>
                                    <span className="text-[8px] text-stone-400 mt-1 block">Assigned: {c.assignedTeacherName}</span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })()}

                </div>
              )}

              {/* 2. LIVE MONITORING SUB-TAB */}
              {activeSubTab === 'live_monitoring' && (
                <div className="space-y-6 animate-fadeIn">
                  
                  {/* Filters Bar */}
                  <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-6">
                    <h4 className="text-stone-850 text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                      🔍 Live Monitoring Filters
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Date Filter</label>
                        <input
                          type="date"
                          value={monDate}
                          onChange={(e) => setMonDate(e.target.value)}
                          className="w-full bg-stone-50 border border-stone-200 text-stone-850 text-xs rounded-xl px-4 py-3 outline-none focus:border-amber-500 font-medium transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Class Filter</label>
                        <select
                          value={monClassId}
                          onChange={(e) => setMonClassId(e.target.value)}
                          className="w-full bg-stone-50 border border-stone-200 text-stone-850 text-xs rounded-xl px-4 py-3 outline-none focus:border-amber-500 font-medium transition-all"
                        >
                          <option value="All">All Classes</option>
                          {allClasses.map((c) => (
                            <option key={c._id} value={c._id}>
                              {c.standard} - {c.section} ({c.board})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Teacher Filter</label>
                        <select
                          value={monTeacherId}
                          onChange={(e) => setMonTeacherId(e.target.value)}
                          className="w-full bg-stone-50 border border-stone-200 text-stone-850 text-xs rounded-xl px-4 py-3 outline-none focus:border-amber-500 font-medium transition-all"
                        >
                          <option value="All">All Teachers</option>
                          {teachersList.map((t) => (
                            <option key={t._id} value={t._id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Subject Filter</label>
                        <select
                          value={monSubjectId}
                          onChange={(e) => setMonSubjectId(e.target.value)}
                          className="w-full bg-stone-50 border border-stone-200 text-stone-850 text-xs rounded-xl px-4 py-3 outline-none focus:border-amber-500 font-medium transition-all"
                        >
                          <option value="All">All Subjects</option>
                          {subjectsList.map((s) => (
                            <option key={s._id} value={s._id}>
                              {s.name} ({s.code})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Classroom Monitoring Cards Grid */}
                  <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-6">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                          🏫 Ongoing Class Monitoring Cards
                        </h3>
                        <p className="text-stone-500 text-xs mt-1">Click cards to toggle override Login/Logout action controls.</p>
                      </div>
                      {monitoringLoading && (
                        <span className="flex items-center gap-1.5 text-[10px] text-amber-600 font-bold bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                          <span className="w-3 h-3 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></span>
                          Updating...
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-[650px] overflow-y-auto pr-1">
                      {classStatuses.length === 0 ? (
                        <div className="col-span-full py-16 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                          <span className="text-4xl block mb-2">📭</span>
                          <p className="text-stone-400 text-xs italic font-bold">No scheduled classes found matching filters.</p>
                        </div>
                      ) : (
                        classStatuses.map((card, index) => {
                          let colorClass = 'border-stone-200 bg-stone-50/50 text-stone-500';
                          let glowClass = 'bg-stone-300';
                          let statusLabelColor = 'bg-stone-100 text-stone-700 border-stone-200';

                          if (card.statusColor === 'green') {
                            colorClass = 'border-emerald-250 bg-emerald-50/30 text-emerald-800 shadow-sm';
                            glowClass = 'bg-emerald-500 shadow-lg shadow-emerald-500/55';
                            statusLabelColor = 'bg-emerald-100 text-emerald-805 border-emerald-200';
                          } else if (card.statusColor === 'red') {
                            colorClass = 'border-rose-200 bg-rose-50/30 text-rose-805 shadow-sm';
                            glowClass = 'bg-rose-500 shadow-lg shadow-rose-500/55';
                            statusLabelColor = 'bg-rose-100 text-rose-850 border-rose-200';
                          } else if (card.statusColor === 'yellow') {
                            colorClass = 'border-amber-250 bg-amber-50/30 text-amber-805 shadow-sm';
                            glowClass = 'bg-amber-500 shadow-lg shadow-amber-500/55';
                            statusLabelColor = 'bg-amber-100 text-amber-850 border-amber-200';
                          }

                          return (
                            <div 
                              key={index}
                              onClick={() => {
                                setSelectedCardDetails(card);
                                fetchClassHistoryForModal(card.classId);
                                setIsCardDetailsModalOpen(true);
                              }}
                              className={`border rounded-2xl p-4 flex flex-col justify-between gap-4 transition-all duration-300 hover:shadow-md cursor-pointer ${colorClass}`}
                            >
                              <div className="space-y-1">
                                <div className="flex justify-between items-start gap-2">
                                  <div className="truncate">
                                    <h4 className="font-extrabold text-sm text-stone-900 truncate">{card.className}</h4>
                                    <p className="text-stone-500 text-[10px] font-bold uppercase tracking-wider mt-0.5 truncate">{card.subjectName}</p>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <span className={`w-2 h-2 rounded-full ${glowClass} animate-pulse`} />
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider border uppercase whitespace-nowrap ${statusLabelColor}`}>
                                      {card.statusText}
                                    </span>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 bg-white/70 p-2.5 rounded-xl border border-stone-200/50 text-xs mt-3">
                                  <div className="border-r border-stone-200/50 pr-1 truncate">
                                    <span className="text-[10px] text-stone-405 font-bold block uppercase tracking-wide">Assigned Teacher</span>
                                    <span className="font-bold text-stone-850 truncate block mt-0.5" title={card.assignedTeacherName}>
                                      👤 {card.assignedTeacherName}
                                    </span>
                                  </div>
                                  <div className="pl-1 truncate">
                                    <span className="text-[10px] text-stone-405 font-bold block uppercase tracking-wide">Current Teacher</span>
                                    <span className={`font-bold truncate block mt-0.5 ${
                                      card.statusColor === 'yellow' ? 'text-amber-650' : card.statusColor === 'red' ? 'text-rose-600' : 'text-stone-850'
                                    }`} title={card.currentTeacherName}>
                                      👤 {card.currentTeacherName}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex justify-between items-center text-[10px] text-stone-455 border-t border-stone-200/40 pt-2 font-mono">
                                <span>⏰ Period {card.period} ({card.timeSlot})</span>
                                <span className="whitespace-nowrap">
                                  {card.lastUpdatedTime ? (
                                    `Updated: ${new Date(card.lastUpdatedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                  ) : (
                                    'Not Logged'
                                  )}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                </div>
              )}

              {/* 3. WEEKLY TIMETABLE SUB-TAB */}
              {activeSubTab === 'weekly_timetable' && (
                <div className="space-y-6 animate-fadeIn">
                  
                  {/* Grid Selector bar & Exports */}
                  <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <label className="text-stone-700 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Select Class:</label>
                      <select
                        value={selectedTimetableClass}
                        onChange={(e) => setSelectedTimetableClass(e.target.value)}
                        className="bg-stone-50 border border-stone-250 text-stone-850 text-xs rounded-xl px-4 py-2.5 outline-none focus:border-amber-500 font-semibold"
                      >
                        {allClasses.map((c) => (
                          <option key={c._id} value={c._id}>
                            Class {c.standard} - {c.section} ({c.board})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {([ 'admin', 'principal' ].includes(user?.role?.toLowerCase()) || user?.isAdmin) && (
                        <button
                          type="button"
                          onClick={() => setIsTimetableEditEnabled(!isTimetableEditEnabled)}
                          className={`px-3.5 py-2 border rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            isTimetableEditEnabled 
                              ? 'bg-amber-500 border-amber-600 text-stone-950 font-black shadow-sm'
                              : 'border-stone-200 hover:bg-stone-50 text-stone-700'
                          }`}
                        >
                          <span>{isTimetableEditEnabled ? '🔒 Lock Timetable' : '✏️ Edit Timetable'}</span>
                        </button>
                      )}
                      <button
                        onClick={() => handlePrintTimetable('weekly')}
                        className="px-3.5 py-2 border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                      >
                        <span>🖨️</span> Print Timetable
                      </button>
                      <button
                        onClick={() => handlePrintTimetable('weekly')}
                        className="px-3.5 py-2 border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                      >
                        <span>📄</span> Export PDF
                      </button>
                      <button
                        onClick={() => handleExportExcel('weekly')}
                        className="px-3.5 py-2 border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                      >
                        <span>📊</span> Export Excel
                      </button>
                    </div>
                  </div>

                  {/* 2D Timetable Table Grid */}
                  <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-6">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                          📅 Weekly Timetable Grid
                        </h3>
                        <p className="text-stone-500 text-xs mt-1">Displays schedules for the selected class. Cells show live status updates for today.</p>
                      </div>
                    </div>

                    {/* Status Legend */}
                    <div className="bg-stone-50 border border-stone-150 rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-center gap-6 text-xs font-bold text-stone-700 shadow-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🟢</span>
                        <span>On Time</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🟡</span>
                        <span>Late</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🔴</span>
                        <span>Absent / Delayed</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🔵</span>
                        <span>Upcoming</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🟣</span>
                        <span>Substitute Active</span>
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-stone-200 rounded-2xl shadow-sm">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-stone-200 bg-stone-50/80 text-stone-605 font-extrabold uppercase tracking-wider">
                            <th className="py-4 px-4 text-stone-500 font-bold border-r border-stone-200">Period / Time</th>
                            {days.map(day => {
                              const isToday = day === todayDayName;
                              return (
                                <th key={day} className={`py-4 px-4 font-bold border-r border-stone-200 text-center ${isToday ? 'bg-amber-500/10 text-amber-850' : ''}`}>
                                  {day} {isToday ? '(Today)' : ''}
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {periods.map(p => (
                            <tr key={p} className="border-b border-stone-150 hover:bg-stone-50/40">
                              <td className="py-3 px-4 font-bold text-stone-850 border-r border-stone-200 whitespace-nowrap bg-stone-50/30">
                                Period {p}
                                <span className="block text-[10px] text-stone-400 font-mono mt-0.5 font-medium">{defaultTimeSlots[p] || ''}</span>
                              </td>
                              {days.map(day => {
                                const entry = timetableEntries.find(e => 
                                  e.day === day && 
                                  e.period === p && 
                                  (e.class?._id || e.class)?.toString() === selectedTimetableClass
                                );

                                const color = entry ? getCellStatusColor(day, p, entry.class?._id || entry.class) : 'empty';
                                
                                let cellClass = 'bg-stone-50/20 text-stone-400 border-r border-stone-200 text-center py-4 px-2 select-none hover:bg-stone-100/50 cursor-pointer';
                                if (color === 'green') {
                                  cellClass = 'bg-emerald-50/70 border border-emerald-300 text-emerald-900 border-r border-stone-200 py-3 px-3 hover:bg-emerald-100/90 cursor-pointer transition-all shadow-sm';
                                } else if (color === 'yellow') {
                                  cellClass = 'bg-amber-50/70 border border-amber-300 text-amber-900 border-r border-stone-200 py-3 px-3 hover:bg-amber-100/90 cursor-pointer transition-all shadow-sm';
                                } else if (color === 'red') {
                                  cellClass = 'bg-rose-50/70 border border-rose-300 text-rose-905 border-r border-stone-200 py-3 px-3 hover:bg-rose-100/90 cursor-pointer transition-all shadow-sm';
                                } else if (color === 'blue') {
                                  cellClass = 'bg-blue-50/70 border border-blue-300 text-blue-900 border-r border-stone-200 py-3 px-3 hover:bg-blue-100/90 cursor-pointer transition-all shadow-sm';
                                } else if (color === 'purple') {
                                  cellClass = 'bg-purple-50/70 border border-purple-300 text-purple-900 border-r border-stone-200 py-3 px-3 hover:bg-purple-100/90 cursor-pointer transition-all shadow-sm';
                                } else if (color === 'neutral') {
                                  cellClass = 'bg-stone-100/80 border border-stone-200 text-stone-805 border-r border-stone-200 py-3 px-3 hover:bg-stone-200/90 cursor-pointer transition-all';
                                } else if (color === 'empty' && !isTimetableEditEnabled) {
                                  cellClass = 'bg-stone-50/10 text-stone-300 border-r border-stone-200 text-center py-4 px-2 select-none';
                                }

                                return (
                                  <td 
                                    key={day} 
                                    className={cellClass}
                                    {...(entry || isTimetableEditEnabled ? {
                                      onClick: () => handleCellClick(day, p, selectedTimetableClass, entry)
                                    } : {})}
                                  >
                                    {entry ? (
                                      <div className="space-y-1 text-center">
                                        <div className="font-extrabold text-[12px] truncate" title={entry.subject?.name}>
                                          {color === 'green' && '🟢 '}
                                          {color === 'yellow' && '🟡 '}
                                          {color === 'red' && '🔴 '}
                                          {color === 'blue' && '🔵 '}
                                          {color === 'purple' && '🟣 '}
                                          {color === 'neutral' && '⚪ '}
                                          {entry.subject?.name}
                                        </div>
                                        <div className="text-[10px] font-bold text-stone-605 truncate" title={entry.teacher?.name}>
                                          👤 {entry.teacher?.name}
                                        </div>
                                        <div className="text-[9px] text-stone-400 font-medium">
                                          🏢 {entry.className || `${entry.class?.standard || ''}-${entry.class?.section || ''}`}
                                        </div>
                                        <div className="text-[9px] text-stone-450 font-mono">
                                          ⏰ {entry.timeSlot}
                                        </div>
                                      </div>
                                    ) : isTimetableEditEnabled ? (
                                      <div className="flex flex-col items-center justify-center py-2 text-stone-350 hover:text-amber-600 transition-colors">
                                        <span className="text-sm font-bold">+</span>
                                        <span className="text-[9px]">Add Period</span>
                                      </div>
                                    ) : (
                                      <span className="text-stone-300 font-medium">-</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

              {/* 4. TEACHER TIMETABLE VIEW */}
              {activeSubTab === 'teacher_schedule' && (
                <div className="space-y-6 animate-fadeIn">
                  
                  {/* Teacher filter and exports */}
                  <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <label className="text-stone-700 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Select Teacher:</label>
                      <select
                        value={selectedTeacherId}
                        onChange={(e) => setSelectedTeacherId(e.target.value)}
                        className="bg-stone-50 border border-stone-250 text-stone-850 text-xs rounded-xl px-4 py-2.5 outline-none focus:border-amber-500 font-semibold"
                      >
                        {teachersList.map((t) => (
                          <option key={t._id} value={t._id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handlePrintTimetable('teacher')}
                        className="px-3.5 py-2 border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                      >
                        <span>🖨️</span> Print Schedule
                      </button>
                      <button
                        onClick={() => handlePrintTimetable('teacher')}
                        className="px-3.5 py-2 border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                      >
                        <span>📄</span> Export PDF
                      </button>
                      <button
                        onClick={() => handleExportExcel('teacher')}
                        className="px-3.5 py-2 border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                      >
                        <span>📊</span> Export Excel
                      </button>
                    </div>
                  </div>

                  {(() => {
                    const teacherEntries = timetableEntries.filter(e => 
                      (e.teacher?._id || e.teacher)?.toString() === selectedTeacherId
                    );
                    const totalClasses = teacherEntries.length;
                    const totalMins = teacherEntries.reduce((sum, e) => sum + getClassDuration(e.timeSlot), 0);
                    const totalHours = (totalMins / 60).toFixed(1);
                    
                    const uniqueSubjects = Array.from(new Set(teacherEntries.map(e => e.subject?.name).filter(Boolean)));
                    const uniqueClasses = Array.from(new Set(teacherEntries.map(e => e.className || (e.class ? `${e.class.standard}-${e.class.section}` : null)).filter(Boolean)));
                    
                    let rating = 'No Workload';
                    let ratingColor = 'bg-stone-100 text-stone-700 border-stone-200';
                    if (totalClasses > 0) {
                      if (totalClasses <= 12) {
                        rating = 'Light';
                        ratingColor = 'bg-sky-50 text-sky-700 border-sky-200';
                      } else if (totalClasses <= 24) {
                        rating = 'Optimal';
                        ratingColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      } else if (totalClasses <= 36) {
                        rating = 'Heavy';
                        ratingColor = 'bg-amber-50 text-amber-700 border-amber-200';
                      } else {
                        rating = 'Overloaded';
                        ratingColor = 'bg-rose-50 text-rose-705 border-rose-200';
                      }
                    }

                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 bg-white border border-stone-200 shadow-sm rounded-2xl p-6">
                        <div className="text-center sm:text-left">
                          <span className="text-[10px] uppercase font-bold text-stone-400 block mb-1">Weekly Classes</span>
                          <span className="text-2xl font-black text-stone-900">{totalClasses} periods</span>
                        </div>
                        <div className="text-center sm:text-left border-l border-stone-100 pl-0 sm:pl-4">
                          <span className="text-[10px] uppercase font-bold text-stone-400 block mb-1">Weekly Hours</span>
                          <span className="text-2xl font-black text-stone-900">{totalHours} hrs</span>
                        </div>
                        <div className="text-center sm:text-left border-l border-stone-100 pl-0 sm:pl-4 col-span-2 sm:col-span-2">
                          <span className="text-[10px] uppercase font-bold text-stone-400 block mb-1">Scope of Teaching</span>
                          <span className="text-xs font-bold text-stone-750 block truncate mt-1">
                            📚 Subjects: {uniqueSubjects.length > 0 ? uniqueSubjects.join(', ') : 'None'}
                          </span>
                          <span className="text-xs font-bold text-stone-750 block truncate mt-0.5">
                            🏫 Classes: {uniqueClasses.length > 0 ? uniqueClasses.join(', ') : 'None'}
                          </span>
                        </div>
                        <div className="text-center sm:text-left border-l border-stone-100 pl-0 sm:pl-4 flex flex-col justify-center items-center sm:items-start col-span-2 sm:col-span-1">
                          <span className="text-[10px] uppercase font-bold text-stone-400 block mb-1">Workload Rating</span>
                          <span className={`px-3 py-1 rounded-full text-xs font-extrabold border uppercase tracking-wider ${ratingColor}`}>
                            {rating}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Teacher timetable display */}
                  <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-6">
                    <h3 className="text-base font-bold text-stone-900 mb-6">
                      👤 Schedule for Faculty: <span className="text-amber-600 font-extrabold">{teachersList.find(t => t._id === selectedTeacherId)?.name || 'N/A'}</span>
                    </h3>

                    {/* Status Legend */}
                    <div className="bg-stone-50 border border-stone-150 rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-center gap-6 text-xs font-bold text-stone-700 shadow-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🟢</span>
                        <span>On Time</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🟡</span>
                        <span>Late</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🔴</span>
                        <span>Absent / Delayed</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🔵</span>
                        <span>Upcoming</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🟣</span>
                        <span>Substitute Active</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {days.map(day => {
                        const dayEntries = timetableEntries.filter(e => 
                          e.day === day && 
                          (e.teacher?._id || e.teacher)?.toString() === selectedTeacherId
                        ).sort((a,b) => a.period - b.period);

                        return (
                          <div key={day} className="border border-stone-200 rounded-2xl p-4 bg-stone-50/50 space-y-3">
                            <h4 className="font-extrabold text-xs text-amber-800 uppercase tracking-wider border-b border-stone-200 pb-2">
                              {day}
                            </h4>
                            {dayEntries.length === 0 ? (
                              <p className="text-stone-400 text-xs italic py-4">No classes scheduled.</p>
                            ) : (
                              <div className="space-y-2">
                                {dayEntries.map((e, idx) => {
                                  const color = getCellStatusColor(day, e.period, e.class?._id || e.class);
                                  let cardClass = 'bg-white border border-stone-150 rounded-xl p-3 text-xs space-y-1';
                                  let indicator = '';
                                  if (color === 'green') {
                                    cardClass = 'bg-emerald-50/70 border border-emerald-300 text-stone-900 rounded-xl p-3 text-xs space-y-1 shadow-sm';
                                    indicator = '🟢 ';
                                  } else if (color === 'yellow') {
                                    cardClass = 'bg-amber-50/70 border border-amber-300 text-stone-900 rounded-xl p-3 text-xs space-y-1 shadow-sm';
                                    indicator = '🟡 ';
                                  } else if (color === 'red') {
                                    cardClass = 'bg-rose-50/70 border border-rose-300 text-stone-905 rounded-xl p-3 text-xs space-y-1 shadow-sm';
                                    indicator = '🔴 ';
                                  } else if (color === 'blue') {
                                    cardClass = 'bg-blue-50/70 border border-blue-300 text-stone-900 rounded-xl p-3 text-xs space-y-1 shadow-sm';
                                    indicator = '🔵 ';
                                  } else if (color === 'purple') {
                                    cardClass = 'bg-purple-50/70 border border-purple-300 text-purple-900 rounded-xl p-3 text-xs space-y-1 shadow-sm';
                                    indicator = '🟣 ';
                                  } else if (color === 'neutral') {
                                    cardClass = 'bg-stone-100/80 border border-stone-200 text-stone-805 rounded-xl p-3 text-xs space-y-1';
                                    indicator = '⚪ ';
                                  }

                                  return (
                                    <div key={idx} className={cardClass}>
                                      <div className="flex justify-between items-center">
                                        <span className="font-extrabold text-stone-900">{indicator}{e.subject?.name}</span>
                                        <span className="text-[10px] text-stone-400 font-mono">Period {e.period}</span>
                                      </div>
                                      <div className="flex justify-between items-center text-[10px] text-stone-505 font-medium">
                                        <span>Class: {e.className || `${e.class?.standard || ''}-${e.class?.section || ''}`}</span>
                                        <span className="font-mono text-amber-700">{e.timeSlot}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              )}

              {/* 5. CLASS TIMETABLE VIEW */}
              {activeSubTab === 'class_schedule' && (
                <div className="space-y-6 animate-fadeIn">
                  
                  {/* Class filter and exports */}
                  <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <label className="text-stone-700 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Select Class:</label>
                      <select
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                        className="bg-stone-50 border border-stone-250 text-stone-850 text-xs rounded-xl px-4 py-2.5 outline-none focus:border-amber-500 font-semibold"
                      >
                        {allClasses.map((c) => (
                          <option key={c._id} value={c._id}>
                            Class {c.standard} - {c.section} ({c.board})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handlePrintTimetable('class')}
                        className="px-3.5 py-2 border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                      >
                        <span>🖨️</span> Print Schedule
                      </button>
                      <button
                        onClick={() => handlePrintTimetable('class')}
                        className="px-3.5 py-2 border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                      >
                        <span>📄</span> Export PDF
                      </button>
                      <button
                        onClick={() => handleExportExcel('class')}
                        className="px-3.5 py-2 border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                      >
                        <span>📊</span> Export Excel
                      </button>
                    </div>
                  </div>

                  {(() => {
                    const classEntries = timetableEntries.filter(e => 
                      (e.class?._id || e.class)?.toString() === selectedClassId
                    );
                    const totalPeriods = classEntries.length;
                    const uniqueTeachers = Array.from(new Set(classEntries.map(e => e.teacher?.name).filter(Boolean)));
                    
                    const subjectCounts = {};
                    classEntries.forEach(e => {
                      const subName = e.subject?.name || 'Unknown';
                      subjectCounts[subName] = (subjectCounts[subName] || 0) + 1;
                    });
                    
                    const sortedSubjects = Object.entries(subjectCounts).sort((a, b) => b[1] - a[1]);
                    const dominantSubject = sortedSubjects[0]?.[0] || 'N/A';
                    
                    const summaryText = totalPeriods > 0 
                      ? `This class has ${totalPeriods} weekly periods scheduled across ${uniqueTeachers.length} teachers, with a primary focus on ${dominantSubject}.`
                      : `No periods scheduled for this class.`;

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white border border-stone-200 shadow-sm rounded-2xl p-6">
                        <div className="flex flex-col justify-center">
                          <span className="text-[10px] uppercase font-bold text-stone-400 block mb-1">Weekly Periods</span>
                          <span className="text-2xl font-black text-stone-900">{totalPeriods} periods</span>
                        </div>
                        <div className="flex flex-col justify-center border-t md:border-t-0 md:border-l border-stone-100 pt-3 md:pt-0 md:pl-4">
                          <span className="text-[10px] uppercase font-bold text-stone-400 block mb-1">Subject Distribution</span>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {sortedSubjects.length > 0 ? sortedSubjects.slice(0, 3).map(([sub, count]) => (
                              <span key={sub} className="text-[10px] bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md border border-stone-200 font-bold font-mono">
                                {sub}: {count}
                              </span>
                            )) : <span className="text-stone-400 text-xs italic">None</span>}
                            {sortedSubjects.length > 3 && (
                              <span className="text-[9px] text-stone-450 font-bold align-middle pt-0.5">+{sortedSubjects.length - 3} more</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col justify-center border-t md:border-t-0 md:border-l border-stone-100 pt-3 md:pt-0 md:pl-4">
                          <span className="text-[10px] uppercase font-bold text-stone-400 block mb-1">Schedule Summary</span>
                          <p className="text-stone-550 text-xs mt-1 font-medium leading-relaxed">
                            {summaryText}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Class Timetable display */}
                  <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-6">
                    {(() => {
                      const clsDoc = allClasses.find(c => c._id === selectedClassId);
                      const classNameStr = clsDoc ? `${clsDoc.standard}-${clsDoc.section} (${clsDoc.board})` : 'N/A';
                      return (
                        <h3 className="text-base font-bold text-stone-900 mb-6">
                          🏫 Schedule for Class: <span className="text-amber-600 font-extrabold">{classNameStr}</span>
                        </h3>
                      );
                    })()}

                    {/* Status Legend */}
                    <div className="bg-stone-50 border border-stone-150 rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-center gap-6 text-xs font-bold text-stone-700 shadow-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🟢</span>
                        <span>On Time</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🟡</span>
                        <span>Late</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🔴</span>
                        <span>Absent / Delayed</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🔵</span>
                        <span>Upcoming</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🟣</span>
                        <span>Substitute Active</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {days.map(day => {
                        const dayEntries = timetableEntries.filter(e => 
                          e.day === day && 
                          (e.class?._id || e.class)?.toString() === selectedClassId
                        ).sort((a,b) => a.period - b.period);

                        return (
                          <div key={day} className="border border-stone-200 rounded-2xl p-4 bg-stone-50/50 space-y-3">
                            <h4 className="font-extrabold text-xs text-amber-855 uppercase tracking-wider border-b border-stone-200 pb-2">
                              {day}
                            </h4>
                            {dayEntries.length === 0 ? (
                              <p className="text-stone-400 text-xs italic py-4">No classes scheduled.</p>
                            ) : (
                              <div className="space-y-2">
                                {dayEntries.map((e, idx) => {
                                  const color = getCellStatusColor(day, e.period, e.class?._id || e.class);
                                  let cardClass = 'bg-white border border-stone-150 rounded-xl p-3 text-xs space-y-1';
                                  let indicator = '';
                                  if (color === 'green') {
                                    cardClass = 'bg-emerald-50/70 border border-emerald-300 text-stone-900 rounded-xl p-3 text-xs space-y-1 shadow-sm';
                                    indicator = '🟢 ';
                                  } else if (color === 'yellow') {
                                    cardClass = 'bg-amber-50/70 border border-amber-300 text-stone-900 rounded-xl p-3 text-xs space-y-1 shadow-sm';
                                    indicator = '🟡 ';
                                  } else if (color === 'red') {
                                    cardClass = 'bg-rose-50/70 border border-rose-300 text-stone-905 rounded-xl p-3 text-xs space-y-1 shadow-sm';
                                    indicator = '🔴 ';
                                  } else if (color === 'blue') {
                                    cardClass = 'bg-blue-50/70 border border-blue-300 text-stone-900 rounded-xl p-3 text-xs space-y-1 shadow-sm';
                                    indicator = '🔵 ';
                                  } else if (color === 'purple') {
                                    cardClass = 'bg-purple-50/70 border border-purple-300 text-purple-900 rounded-xl p-3 text-xs space-y-1 shadow-sm';
                                    indicator = '🟣 ';
                                  } else if (color === 'neutral') {
                                    cardClass = 'bg-stone-100/80 border border-stone-200 text-stone-805 rounded-xl p-3 text-xs space-y-1';
                                    indicator = '⚪ ';
                                  }

                                  return (
                                    <div key={idx} className={cardClass}>
                                      <div className="flex justify-between items-center">
                                        <span className="font-extrabold text-stone-900">{indicator}{e.subject?.name}</span>
                                        <span className="text-[10px] text-stone-455 font-bold bg-stone-50 border border-stone-200 px-1.5 py-0.5 rounded">Period {e.period}</span>
                                      </div>
                                      <div className="flex justify-between items-center text-[10px] text-stone-500 font-medium">
                                        <span className="truncate pr-1">Teacher: {e.teacher?.name}</span>
                                        <span className="font-mono text-amber-700 whitespace-nowrap">{e.timeSlot}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              )}

              {/* 6. ACTIVITY LOGS SUB-TAB */}
              {activeSubTab === 'activity_logs' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
                  
                  {/* Logs Feed Panel (Full 3/3 width) */}
                  <div className="lg:col-span-3 bg-white border border-stone-200 shadow-sm rounded-2xl p-6">
                    <div className="flex justify-between items-center mb-6 border-b border-stone-200 pb-4">
                      <div>
                        <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                          📋 Real-Time Activity Log Feed
                        </h3>
                        <p className="text-stone-500 text-xs mt-1">Displays live logs of classroom Punch-ins, Punch-outs, and Substitute allocations (newest first).</p>
                      </div>
                      <span className="text-[10px] font-bold text-stone-500 bg-stone-50 border border-stone-205 px-3 py-1 rounded-full">
                        Socket.IO Live Feed
                      </span>
                    </div>

                    <div className="space-y-3 max-h-[650px] overflow-y-auto pr-1">
                      {auditLogs.length === 0 ? (
                        <div className="py-16 text-center text-stone-400 italic">
                          <span>📭</span> No operations activity logs registered today.
                        </div>
                      ) : (
                        auditLogs.map((log, index) => {
                          const logTime = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                          const logDate = new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
                          
                          let actionColor = 'bg-stone-100 text-stone-700 border-stone-200';
                          let actionLabel = 'Activity Logged';
                          if (log.action === 'enter') {
                            actionColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                            actionLabel = 'Class Login / Start';
                          } else if (log.action === 'leave') {
                            actionColor = 'bg-rose-100 text-rose-800 border-rose-200';
                            actionLabel = 'Class Logout / End';
                          } else if (log.action === 'alert') {
                            actionColor = 'bg-rose-600 text-white border-rose-700 font-extrabold animate-pulse';
                            actionLabel = '⚠️ Attendance Alert';
                          }

                          return (
                            <div key={index} className="bg-stone-50 border border-stone-150 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                              <div className="flex items-center gap-3">
                                <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border whitespace-nowrap ${actionColor}`}>
                                  {actionLabel}
                                </span>
                                <div>
                                  <p className="font-extrabold text-stone-900 text-sm">
                                    Class {log.class?.standard || ''}-{log.class?.section || ''} ({log.class?.board || 'CBSE'})
                                  </p>
                                  <p className="text-stone-500 font-medium mt-0.5">
                                    Teacher: <strong className="text-stone-800">{log.teacher?.name}</strong> | Subject: <strong className="text-stone-800">{log.subject?.name || 'Class'}</strong>
                                  </p>
                                </div>
                              </div>
                              
                              <div className="flex sm:flex-col items-end gap-2 sm:gap-1 text-right w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-0 border-stone-200">
                                <span className="text-[10px] text-stone-400 font-mono">{logDate} | {logTime}</span>
                                {log.isSubstitute && (
                                  <span className="text-[8px] bg-amber-100 text-amber-805 border border-amber-250 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider block">
                                    Alternate Arranged
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                </div>
              )}

            </div>
          );
        })()}

        {/* ─── STAFF VIEW (WELCOME INBOX ONLY) ─── */}
        {user?.role?.toLowerCase() === 'staff' && (
          <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-6 text-center max-w-xl mx-auto py-12">
            <span className="text-5xl block mb-4">🏫</span>
            <h3 className="text-xl font-bold text-stone-900">School Non-Teaching Portal</h3>
            <p className="text-stone-550 text-sm mt-2 leading-relaxed">
              Welcome to your portal. You are registered as non-teaching staff. Your face biometric attendance logs are synced directly to the primary database. If you require password changes or document access, use the profile configurations in the top-right header menu.
            </p>
          </div>
        )}

      </div>

      {/* ─── SUBSTITUTE ALLOCATION MODAL (ADMIN) ─── */}
      {activeRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-scaleUp">
            
            {/* Modal Header */}
            <div className="bg-stone-50 px-6 py-4 border-b border-stone-200 flex justify-between items-center">
              <h3 className="text-base sm:text-lg font-bold text-stone-900">
                {activeRequest.isDirect ? `Arrange Substitute: ${activeRequest.teacher.name}` : `Review Leave: ${activeRequest.teacher.name}`}
              </h3>
              <button 
                onClick={() => setActiveRequest(null)}
                className="text-stone-400 hover:text-stone-600 text-xl font-bold focus:outline-none"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              
              {/* Leave details card */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-xs space-y-2">
                <p><strong className="text-stone-500">Date:</strong> <span className="font-mono text-stone-900">{activeRequest.leaveDate}</span></p>
                <p><strong className="text-stone-500">Reason:</strong> <span className="text-stone-600 italic">"{activeRequest.reason}"</span></p>
              </div>

              {/* Suggestions Timeline List */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-amber-600 uppercase tracking-widest">
                  Allocate Alternative Period Substitute Teachers
                </h4>

                {loadingSuggestions ? (
                  <div className="text-center py-12">
                    <Spinner size="md" className="mx-auto mb-2" />
                    <p className="text-stone-550 text-xs italic">Analyzing available teaching schedules...</p>
                  </div>
                ) : suggestions.length === 0 ? (
                  <p className="text-stone-400 text-xs italic text-center py-8">No scheduled periods affected by this leave request.</p>
                ) : (
                  <div className="space-y-3.5">
                    {suggestions.map((slot) => (
                      <div key={slot.periodEntryId} className="bg-stone-50/50 border border-stone-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        
                        {/* Slot details */}
                        <div className="text-xs">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-stone-950 text-sm">Period {slot.period}</span>
                            <span className="text-[10px] text-stone-400 font-mono">({slot.timeSlot})</span>
                          </div>
                          <p className="text-stone-655">Class: {slot.class} | Subject: <strong className="text-stone-850 font-semibold">{slot.subject}</strong></p>
                        </div>

                        {/* Candidate select dropdown */}
                        <div className="flex-shrink-0">
                          {slot.candidates.length === 0 ? (
                            <span className="text-rose-500 font-bold text-xs uppercase tracking-wide">
                              ⚠️ No Available Teachers
                            </span>
                          ) : (
                            <select
                              value={allocations[slot.periodEntryId] || ''}
                              onChange={(e) => setAllocations(prev => ({
                                ...prev,
                                [slot.periodEntryId]: e.target.value
                              }))}
                              className="bg-white border border-stone-200 text-stone-800 text-xs rounded-lg px-3 py-2 outline-none focus:border-amber-500 w-52 font-medium"
                            >
                              {slot.candidates.map(candidate => (
                                <option key={candidate.teacherId} value={candidate.teacherId}>
                                  {candidate.name} {candidate.subjectMatch ? '🌟 (Subject Match)' : ''}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-stone-50 px-6 py-4 border-t border-stone-200 flex justify-between gap-3">
              {!activeRequest.isDirect ? (
                <button
                  onClick={() => handleApproveLeave('Rejected')}
                  disabled={isApprovingLeave}
                  className="px-4 py-2 border border-stone-250 text-red-500 hover:bg-stone-100 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  Reject Leave
                </button>
              ) : (
                <div />
              )}
              
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveRequest(null)}
                  className="px-4 py-2 border border-stone-250 text-stone-500 hover:bg-stone-100 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={activeRequest.isDirect ? handleSaveDirectSubstitute : () => handleApproveLeave('Approved')}
                  disabled={isApprovingLeave || suggestions.some(s => s.candidates.length === 0)}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-stone-950 font-extrabold text-xs rounded-xl transition-all shadow-md disabled:opacity-50"
                >
                  {isApprovingLeave ? 'Processing...' : activeRequest.isDirect ? 'Save & Allocate' : 'Approve & Allocate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TIMETABLE PERIOD DETAIL & CRUD INTEGRATION MODAL (ADMIN) ─── */}
      {isCellDetailsModalOpen && selectedCellDetails && (() => {
        const { day, period, classId, entry } = selectedCellDetails;
        const clsDoc = allClasses.find(c => c._id === classId) || entry?.class;
        const className = clsDoc ? `${clsDoc.standard}-${clsDoc.section} (${clsDoc.board || 'CBSE'})` : 'Unknown Class';
        
        // Find today's live status card for this class and period
        const liveCard = classStatuses.find(c => 
          c.classId === classId?.toString() && 
          c.period === period
        );

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-white border border-stone-200 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl animate-scaleUp">
              
              {/* Modal Header */}
              <div className="bg-stone-50 px-6 py-4 border-b border-stone-200 flex justify-between items-center">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-stone-900">
                    Timetable Slot: {day}, Period {period} ({defaultTimeSlots[period] || ''})
                  </h3>
                  <p className="text-xs text-stone-500 font-medium">Class: {className}</p>
                </div>
                <button 
                  onClick={() => setIsCellDetailsModalOpen(false)}
                  className="text-stone-400 hover:text-stone-600 text-xl font-bold focus:outline-none"
                >
                  &times;
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 max-h-[75vh] overflow-y-auto">
                
                {/* Left Side: Live Monitoring & Integration */}
                <div className="space-y-5">
                  <h4 className="text-xs font-bold text-amber-600 uppercase tracking-widest border-b border-stone-200 pb-2">
                    ⚡ Live Monitoring & Integration
                  </h4>

                  {entry ? (
                    <div className="space-y-4">
                      {/* Current Status comparison */}
                      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
                        <h5 className="font-extrabold text-xs text-stone-700 uppercase">Current Session Status</h5>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-stone-400 font-bold block uppercase tracking-wide text-[9px]">Assigned Teacher</span>
                            <span className="font-bold text-stone-900 mt-0.5 block">👤 {entry.teacher?.name || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-stone-400 font-bold block uppercase tracking-wide text-[9px]">Current Teacher</span>
                            <span className={`font-bold mt-0.5 block ${
                              liveCard?.statusColor === 'yellow' ? 'text-amber-605' : liveCard?.statusColor === 'red' ? 'text-rose-600' : 'text-stone-900'
                            }`}>
                              👤 {liveCard?.currentTeacherName || 'None'}
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-stone-200/50 mt-1">
                          <span className="text-[10px] text-stone-400 uppercase font-bold tracking-wider">Status Color Badge:</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider border uppercase ${
                            liveCard?.statusColor === 'green'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : liveCard?.statusColor === 'yellow'
                                ? 'bg-amber-100 text-amber-805 border-amber-200'
                                : 'bg-rose-100 text-rose-800 border-rose-200'
                          }`}>
                            {liveCard?.statusText || 'No Session Today'}
                          </span>
                        </div>
                      </div>

                      {/* Attendance Information */}
                      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2 text-xs">
                        <h5 className="font-extrabold text-xs text-stone-700 uppercase">Teacher School Punch-In Status</h5>
                        <p className="flex justify-between">
                          <span className="text-stone-500 font-medium">Attendance Status:</span>
                          <span className={`font-bold uppercase ${
                            liveCard?.schoolAttendanceStatus === 'Present' ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {liveCard?.schoolAttendanceStatus || 'Not Checked In'}
                          </span>
                        </p>
                        {liveCard?.schoolPunchIn && (
                          <p className="flex justify-between font-mono text-[10px]">
                            <span className="text-stone-400">Punch In:</span>
                            <span className="text-stone-700">{new Date(liveCard.schoolPunchIn).toLocaleTimeString()}</span>
                          </p>
                        )}
                        {liveCard?.schoolPunchOut && (
                          <p className="flex justify-between font-mono text-[10px]">
                            <span className="text-stone-400">Punch Out:</span>
                            <span className="text-stone-700">{new Date(liveCard.schoolPunchOut).toLocaleTimeString()}</span>
                          </p>
                        )}
                      </div>

                      {/* Class History Logs */}
                      <div className="space-y-2">
                        <h5 className="font-extrabold text-xs text-stone-700 uppercase">Recent Session History (This Class)</h5>
                        {classHistoryLoading ? (
                          <div className="text-center py-6 text-stone-400 text-xs italic">Loading history...</div>
                        ) : classHistory.length === 0 ? (
                          <p className="text-stone-400 text-xs italic py-4">No recent class session records found.</p>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto border border-stone-200 rounded-xl p-2 bg-stone-50/30">
                            {classHistory.slice(0, 5).map((h, i) => (
                              <div key={i} className="bg-white border border-stone-150 rounded-lg p-2 text-[10px] space-y-1">
                                <div className="flex justify-between text-[9px] text-stone-400 font-mono">
                                  <span>{h.date}</span>
                                  <span>Period {h.period}</span>
                                </div>
                                <p className="font-bold text-stone-800">
                                  {h.teacher?.name} ({h.subject?.name})
                                </p>
                                <p className="text-stone-500">
                                  Logs: {new Date(h.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {h.logoutTime ? ` - ${new Date(h.logoutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' (Active)'}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50/40 border border-amber-250 rounded-xl p-4 text-xs text-amber-800">
                      ⚠️ No period currently scheduled for Class {className} at Period {period} on {day}. You can assign one using the scheduling form on the right.
                    </div>
                  )}
                </div>

                {/* Right Side: Timetable CRUD Management */}
                <div className="space-y-5 border-t lg:border-t-0 lg:border-l border-stone-200 pt-5 lg:pt-0 lg:pl-6">
                  <h4 className="text-xs font-bold text-amber-600 uppercase tracking-widest border-b border-stone-200 pb-2">
                    ⚙️ Timetable Slot Management
                  </h4>

                  {!isEditMode && entry ? (
                    <div className="space-y-4">
                      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2 text-xs">
                        <p><strong className="text-stone-500 font-medium">Assigned Subject:</strong> <span className="font-bold text-stone-900">{entry.subject?.name || 'N/A'}</span></p>
                        <p><strong className="text-stone-500 font-medium">Assigned Teacher:</strong> <span className="font-bold text-stone-900">{entry.teacher?.name || 'N/A'}</span></p>
                        <p><strong className="text-stone-500 font-medium">Scheduled Time:</strong> <span className="font-mono font-bold text-amber-700">{entry.timeSlot}</span></p>
                      </div>

                      {([ 'admin', 'principal' ].includes(user?.role?.toLowerCase()) || user?.isAdmin) && isTimetableEditEnabled ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setIsEditMode(true)}
                            className="flex-1 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-extrabold rounded-xl transition-all border border-stone-300"
                          >
                            ✏️ Edit Slot details
                          </button>
                          <button
                            onClick={() => handleDeleteTimetable(entry._id)}
                            className="py-2 px-4 bg-rose-50 border border-rose-250 text-rose-600 hover:bg-rose-100 text-xs font-extrabold rounded-xl transition-all"
                          >
                            🗑️ Delete Period
                          </button>
                        </div>
                      ) : (
                        <p className="text-stone-400 text-xs italic text-center py-2 bg-stone-50 border border-stone-150 rounded-xl">
                          🔒 Timetable is locked. Enable Edit Timetable to make changes.
                        </p>
                      )}
                    </div>
                  ) : isTimetableEditEnabled || isEditMode ? (
                    <form onSubmit={handleTimetableSubmit} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Assigned Teacher</label>
                        <select
                          value={timetableForm.teacherId}
                          onChange={(e) => setTimetableForm({ ...timetableForm, teacherId: e.target.value })}
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-amber-500 text-stone-900 font-semibold"
                          required
                        >
                          <option value="">-- Choose Teacher --</option>
                          {teachersList.map((t) => (
                            <option key={t._id} value={t._id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Subject</label>
                        <select
                          value={timetableForm.subjectId}
                          onChange={(e) => setTimetableForm({ ...timetableForm, subjectId: e.target.value })}
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-amber-500 text-stone-900 font-semibold"
                          required
                        >
                          <option value="">-- Choose Subject --</option>
                          {subjectsList.map((s) => (
                            <option key={s._id} value={s._id}>
                              {s.name} ({s.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Start Time</label>
                          <input
                            type="time"
                            value={timetableForm.startTime}
                            onChange={(e) => setTimetableForm({ ...timetableForm, startTime: e.target.value })}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs outline-none focus:border-amber-500 font-mono text-stone-900"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">End Time</label>
                          <input
                            type="time"
                            value={timetableForm.endTime}
                            onChange={(e) => setTimetableForm({ ...timetableForm, endTime: e.target.value })}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs outline-none focus:border-amber-500 font-mono text-stone-900"
                            required
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        {entry && (
                          <button
                            type="button"
                            onClick={() => setIsEditMode(false)}
                            className="flex-1 py-2.5 border border-stone-250 text-stone-500 hover:bg-stone-50 rounded-xl text-xs font-bold transition-all"
                          >
                            Back
                          </button>
                        )}
                        <button
                          type="submit"
                          disabled={isSavingTimetable}
                          className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-stone-950 font-extrabold text-xs rounded-xl transition-all shadow-md disabled:opacity-50"
                        >
                          {isSavingTimetable ? 'Saving...' : 'Save slot details'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p className="text-stone-400 text-xs italic text-center py-6 bg-stone-50 border border-stone-150 rounded-xl">
                      🔒 Timetable is locked. Enable Edit Timetable to schedule new periods.
                    </p>
                  )}
                </div>

              </div>

              {/* Modal Footer */}
              <div className="bg-stone-50 px-6 py-4 border-t border-stone-200 flex justify-end">
                <button
                  onClick={() => setIsCellDetailsModalOpen(false)}
                  className="px-4 py-2 border border-stone-250 text-stone-500 hover:bg-stone-100 rounded-xl text-xs font-bold transition-all"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ─── TEACHER SCHEDULE CREATION MODAL ─── */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scaleUp">
            
            {/* Modal Header */}
            <div className="bg-stone-50 px-6 py-4 border-b border-stone-200 flex justify-between items-center">
              <h3 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
                <span>➕</span> Schedule Timetable Slot
              </h3>
              <button 
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="text-stone-400 hover:text-stone-600 text-xl font-bold focus:outline-none"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleScheduleSubmit}>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                
                {/* School Class info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 uppercase mb-1">Standard / Grade</label>
                    <select
                      value={schedStandard}
                      onChange={(e) => setSchedStandard(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-500 text-stone-900 font-medium"
                    >
                      {['Nursery', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'].map(std => (
                        <option key={std} value={std}>{std} Class</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 uppercase mb-1">Section / Division</label>
                    <select
                      value={schedSection}
                      onChange={(e) => setSchedSection(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-500 text-stone-900 font-medium"
                    >
                      {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'].map(sec => (
                        <option key={sec} value={sec}>Section {sec}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* School Board */}
                <div>
                  <label className="block text-xs font-semibold text-stone-500 uppercase mb-1">School Board</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['CBSE', 'STATE', 'ICSE'].map(b => (
                      <button
                        type="button"
                        key={b}
                        onClick={() => setSchedBoard(b)}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                          schedBoard === b
                            ? 'bg-amber-500/10 border-amber-500 text-amber-600 shadow-md'
                            : 'bg-stone-50 border-stone-200 text-stone-600 hover:border-stone-300'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject Name */}
                <div>
                  <label className="block text-xs font-semibold text-stone-500 uppercase mb-1">Subject Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mathematics, Science, English"
                    value={schedSubject}
                    onChange={(e) => setSchedSubject(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-500 text-stone-900 placeholder-stone-400"
                  />
                </div>

                {/* Period & Time Slot */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 uppercase mb-1">Period</label>
                    <select
                      value={schedPeriod}
                      onChange={(e) => handlePeriodChange(Number(e.target.value))}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-500 text-stone-900 font-medium"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(p => (
                        <option key={p} value={p}>Period {p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 uppercase mb-1">Time Slot (Duration)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 09:00-09:45"
                      value={schedTimeSlot}
                      onChange={(e) => setSchedTimeSlot(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-500 text-stone-900 font-mono"
                    />
                  </div>
                </div>

                {/* Schedule Type Selection */}
                <div>
                  <label className="block text-xs font-semibold text-stone-500 uppercase mb-1">Schedule Type</label>
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => setSchedType('auto')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-left flex flex-col justify-center gap-0.5 ${
                        schedType === 'auto'
                          ? 'bg-amber-500/10 border-amber-500 text-amber-600'
                          : 'bg-stone-50 border-stone-200 text-stone-600'
                      }`}
                    >
                      <span className="font-extrabold">🔄 Auto Schedule</span>
                      <span className="text-[10px] text-stone-400 font-normal">Repeats weekly starting from next day</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSchedType('manual')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-left flex flex-col justify-center gap-0.5 ${
                        schedType === 'manual'
                          ? 'bg-amber-500/10 border-amber-500 text-amber-600'
                          : 'bg-stone-50 border-stone-200 text-stone-600'
                      }`}
                    >
                      <span className="font-extrabold">📅 Manual Override</span>
                      <span className="text-[10px] text-stone-400 font-normal">One-time override for a specific date</span>
                    </button>
                  </div>
                </div>

                {/* Conditional fields based on Schedule Type */}
                {schedType === 'auto' ? (
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 uppercase mb-1">Weekday</label>
                    <select
                      value={schedDay}
                      onChange={(e) => setSchedDay(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-500 text-stone-900 font-medium"
                    >
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 uppercase mb-1">Override Date</label>
                    <input
                      type="date"
                      required={schedType === 'manual'}
                      min={new Date(Date.now() + 86400000).toISOString().split('T')[0]} // next day onwards
                      value={schedDate}
                      onChange={(e) => setSchedDate(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-500 text-stone-900 font-mono"
                    />
                  </div>
                )}

              </div>

              {/* Modal Footer */}
              <div className="bg-stone-50 px-6 py-4 border-t border-stone-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 border border-stone-250 text-stone-500 hover:bg-stone-100 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSchedule}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-stone-950 font-black text-xs rounded-xl transition-all shadow-md disabled:opacity-50"
                >
                  {isSubmittingSchedule ? 'Scheduling...' : 'Save Schedule'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* 🌟 LIVE MONITORING DETAILS MODAL 🌟 */}
      {isCardDetailsModalOpen && selectedCardDetails && (() => {
        const card = selectedCardDetails;
        
        // Find if this session is active or has substitute
        const isSubstitute = card.statusColor === 'yellow';
        
        // Get today's activity timeline for this class
        const classTimeline = auditLogs.filter(l => {
          const standard = l.class?.standard || '';
          const section = l.class?.section || '';
          const fullClassName = `${standard}-${section}`;
          return fullClassName === card.className || l.className === card.className;
        });

        // Get substitute history: cardClassHistory where teacher id != assignedTeacherId
        const substituteHistory = cardClassHistory.filter(h => {
          const teacherId = h.teacher?._id || h.teacher;
          return teacherId && card.assignedTeacherId && teacherId.toString() !== card.assignedTeacherId.toString();
        });

        const formattedLoginTime = card.loginTime 
          ? new Date(card.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
          : 'Not Logged In';
        const formattedLogoutTime = card.logoutTime 
          ? new Date(card.logoutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
          : (card.loginTime ? 'Active (Not Logged Out)' : 'N/A');

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white border border-stone-200 shadow-2xl rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleUp">
              
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-stone-900 to-stone-850 text-white px-6 py-4 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-amber-500">Live Classroom Status Details</h3>
                  <h2 className="text-xl font-black mt-0.5">Class {card.className}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCardDetailsModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-lg transition-all"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs text-left">
                
                {/* Status and Teacher Information Card */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-stone-50 border border-stone-150 rounded-2xl p-5">
                  <div className="space-y-1">
                    <span className="text-[10px] text-stone-400 font-bold uppercase block">Class Status</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        card.statusColor === 'green' ? 'bg-emerald-500' : card.statusColor === 'yellow' ? 'bg-amber-500' : 'bg-rose-500'
                      }`} />
                      <span className="font-extrabold uppercase text-[11px] text-stone-800">
                        {card.statusColor === 'green' && '🟢 Assigned Teacher Active'}
                        {card.statusColor === 'yellow' && '🟡 Substitute Active'}
                        {card.statusColor === 'red' && '🔴 Unattended'}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-stone-400 font-bold uppercase block">Assigned Teacher</span>
                    <span className="font-black text-stone-800 block mt-1">👤 {card.assignedTeacherName}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-stone-400 font-bold uppercase block">Current Teacher</span>
                    <span className="font-black text-stone-800 block mt-1">👤 {card.currentTeacherName || 'None'}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-stone-400 font-bold uppercase block">Class Period</span>
                    <span className="font-black text-stone-800 block mt-1">⏰ Period {card.period} ({card.timeSlot})</span>
                  </div>
                </div>

                {/* Login/Logout Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-emerald-50/20 border border-emerald-150 rounded-2xl p-4">
                    <span className="text-[10px] text-emerald-800 font-bold uppercase block mb-1">Class Login Time</span>
                    <span className="text-sm font-black text-stone-800">{formattedLoginTime}</span>
                  </div>
                  <div className="bg-rose-50/20 border border-rose-150 rounded-2xl p-4">
                    <span className="text-[10px] text-rose-805 font-bold uppercase block mb-1">Class Logout Time</span>
                    <span className="text-sm font-black text-stone-800">{formattedLogoutTime}</span>
                  </div>
                </div>

                {/* Sub-sections: History grids */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* 1. Attendance History (Recent Class Sessions) */}
                  <div className="space-y-3 bg-white border border-stone-200 rounded-2xl p-4 flex flex-col">
                    <h4 className="font-extrabold text-xs text-stone-700 uppercase border-b border-stone-100 pb-2">
                      📋 Attendance History (Recent Sessions)
                    </h4>
                    <div className="space-y-2.5 overflow-y-auto max-h-60 pr-1 flex-1">
                      {cardClassHistoryLoading ? (
                        <div className="text-center py-6 text-stone-450 italic">Loading...</div>
                      ) : cardClassHistory.length === 0 ? (
                        <p className="text-stone-400 italic py-4 text-center">No history logs registered.</p>
                      ) : (
                        cardClassHistory.map((h, i) => (
                          <div key={i} className="bg-stone-50 border border-stone-150 rounded-xl p-2.5 space-y-1">
                            <div className="flex justify-between text-[9px] text-stone-450 font-mono">
                              <span>{h.date}</span>
                              <span>Period {h.period}</span>
                            </div>
                            <p className="font-bold text-stone-800">{h.teacher?.name} ({h.subject?.name})</p>
                            <p className="text-stone-500 font-mono text-[9px]">
                              {new Date(h.loginTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                              {h.logoutTime ? ` - ${new Date(h.logoutTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}` : ' (Active)'}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* 2. Substitute History */}
                  <div className="space-y-3 bg-white border border-stone-200 rounded-2xl p-4 flex flex-col">
                    <h4 className="font-extrabold text-xs text-stone-700 uppercase border-b border-stone-100 pb-2">
                      🔄 Substitute Assignment History
                    </h4>
                    <div className="space-y-2.5 overflow-y-auto max-h-60 pr-1 flex-1">
                      {cardClassHistoryLoading ? (
                        <div className="text-center py-6 text-stone-450 italic">Loading...</div>
                      ) : substituteHistory.length === 0 ? (
                        <p className="text-stone-400 italic py-4 text-center">No substitute teachers assigned in recent history.</p>
                      ) : (
                        substituteHistory.map((h, i) => (
                          <div key={i} className="bg-amber-50/40 border border-amber-200 rounded-xl p-2.5 space-y-1">
                            <div className="flex justify-between text-[9px] text-stone-455 font-mono">
                              <span>{h.date}</span>
                              <span>Period {h.period}</span>
                            </div>
                            <p className="font-bold text-stone-800">Sub: {h.teacher?.name} ({h.subject?.name})</p>
                            <p className="text-stone-500 font-mono text-[9px]">
                              {new Date(h.loginTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                              {h.logoutTime ? ` - ${new Date(h.logoutTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}` : ' (Active)'}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* 3. Today's Activity Timeline */}
                  <div className="space-y-3 bg-white border border-stone-200 rounded-2xl p-4 flex flex-col">
                    <h4 className="font-extrabold text-xs text-stone-700 uppercase border-b border-stone-100 pb-2">
                      ⚡ Today's Activity Timeline
                    </h4>
                    <div className="space-y-3 overflow-y-auto max-h-60 pr-1 flex-1">
                      {classTimeline.length === 0 ? (
                        <p className="text-stone-400 italic py-4 text-center">No activities logged for this class today.</p>
                      ) : (
                        classTimeline.map((log, index) => {
                          const logTime = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          let actionLabel = log.details || log.action;
                          if (log.action === 'enter') {
                            actionLabel = log.isSubstitute ? 'Substitute Assigned' : 'Class Login / Start';
                          } else if (log.action === 'leave') {
                            actionLabel = 'Class Logout / End';
                          } else if (log.action === 'alert') {
                            actionLabel = '⚠️ Attendance Alert';
                          }
                          
                          return (
                            <div key={index} className="flex gap-2.5 items-start">
                              <span className="text-sm flex-shrink-0 mt-0.5">
                                {log.action === 'enter' && '🟢'}
                                {log.action === 'leave' && '🔴'}
                                {log.action === 'alert' && '⚠️'}
                                {log.action === 'mod' && '⚙️'}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-stone-800 leading-tight">{actionLabel}</p>
                                <p className="text-[10px] text-stone-450 mt-0.5">
                                  {log.teacher?.name || log.teacherName} | {logTime}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                </div>

                {/* Modal Footer Controls (Override options) */}
                <div className="pt-4 border-t border-stone-200 flex flex-wrap justify-between items-center gap-4">
                  <div className="flex gap-2">
                    {card.statusColor === 'red' ? (
                      <button
                        type="button"
                        onClick={() => {
                          handlePrincipalClassLogin(card.classId, card.subjectId, card.assignedTeacherId);
                          setIsCardDetailsModalOpen(false);
                        }}
                        className="py-2.5 px-4 bg-gradient-to-r from-emerald-50 to-green-600 hover:from-emerald-600 hover:to-green-755 text-stone-900 font-extrabold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                      >
                        <span>🔑</span> Override Login
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          handlePrincipalClassLogout(card.classId);
                          setIsCardDetailsModalOpen(false);
                        }}
                        className="py-2.5 px-4 bg-gradient-to-r from-rose-500 to-red-650 hover:from-rose-600 hover:to-red-755 text-white font-extrabold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                      >
                        <span>🚪</span> Override Logout
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCardDetailsModalOpen(false)}
                    className="px-5 py-2.5 border border-stone-250 hover:bg-stone-50 text-stone-605 rounded-xl font-bold transition-all"
                  >
                    Close Details
                  </button>
                </div>

              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
};

export default DashboardPage;
