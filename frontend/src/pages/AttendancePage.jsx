/**
 * Attendance Page — Dual mode attendance system.
 * 1. Teacher Biometric Face Punch-in (supports both personal login & gate kiosk mode).
 * 2. Student Attendance Grid (grouped by standard/section, with Present/Absent/Late status triggers).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  getClasses, 
  punchIn, 
  punchOut, 
  getStudentAttendance, 
  markStudentAttendance, 
  getAttendanceLogs 
} from '../services/authService';
import Spinner from '../components/ui/Spinner';
import Sidebar from '../components/ui/Sidebar';
import useGeolocation from '../hooks/useGeolocation';
import FaceVerification from '../components/face/FaceVerification';
import toast from 'react-hot-toast';

// Seed list of default students for the class grid
const DEFAULT_STUDENTS = [
  'Aarav Sharma', 'Ananya Iyer', 'Vihaan Patel', 'Diya Sen', 'Sai Krishna', 
  'Meera Nair', 'Rohan Das', 'Ishaan Roy', 'Kavya Reddy', 'Aditya Joshi',
  'Priya Verma', 'Kabir Malhotra', 'Zara Khan', 'Arjun Mehta', 'Sneha Patil'
];

const AttendancePage = () => {
  const { user } = useAuth();
  const { position: geoPosition, loading: geoLoading, error: geoError, permissionDenied: geoDenied, refresh: geoRefresh } = useGeolocation({ watch: true });

  const [activeTab, setActiveTab] = useState('teacher-punch'); // 'teacher-punch' | 'student-grid' | 'logs'
  const [currentTime, setCurrentTime] = useState(new Date());

  // Teacher Punch State
  const [kioskEmpId, setKioskEmpId] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [showFaceScanner, setShowFaceScanner] = useState(false);
  const [personalLogs, setPersonalLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [isPunchingOut, setIsPunchingOut] = useState(false);

  // Student Grid State
  const [classesList, setClassesList] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [studentsData, setStudentsData] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [isSavingStudentAtt, setIsSavingStudentAtt] = useState(false);

  // Load Classes list for dropdown
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await getClasses();
        if (res?.status && Array.isArray(res.data)) {
          setClassesList(res.data);
          if (res.data.length > 0) {
            setSelectedClassId(res.data[0]._id);
          }
        }
      } catch (err) {
        console.error('Failed to load classes list:', err);
      }
    };
    fetchClasses();
  }, []);

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load Teacher's personal attendance logs
  const fetchPersonalLogs = useCallback(async () => {
    if (!user?.employee_id) return;
    setLogsLoading(true);
    try {
      const res = await getAttendanceLogs();
      if (res?.status && Array.isArray(res.data)) {
        // Filter logs only for the logged-in teacher
        const myLogs = res.data.filter(log => log.teacher && (log.teacher.employeeId === user.employee_id || log.teacher._id === user._id));
        setPersonalLogs(myLogs);
      }
    } catch (err) {
      console.error('Failed to load teacher attendance logs:', err);
    } finally {
      setLogsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchPersonalLogs();
    }
  }, [activeTab, fetchPersonalLogs]);

  // Load Student Attendance Grid
  const fetchStudentAttendance = useCallback(async () => {
    if (!selectedClassId) return;
    setLoadingStudents(true);
    try {
      const res = await getStudentAttendance(null, null, attendanceDate, selectedClassId);
      if (res?.status && Array.isArray(res.data)) {
        const dbRecords = res.data;
        // Merge DB records with our seed student list so we always show the full class strength
        const merged = DEFAULT_STUDENTS.map(studentName => {
          const match = dbRecords.find(record => record.studentName === studentName);
          return {
            studentName,
            status: match ? match.status : 'Present' // default to Present if not marked
          };
        });
        setStudentsData(merged);
      } else {
        // Seed default grid if no records exist
        setStudentsData(DEFAULT_STUDENTS.map(name => ({ studentName: name, status: 'Present' })));
      }
    } catch (err) {
      toast.error('Failed to load student attendance.');
      setStudentsData(DEFAULT_STUDENTS.map(name => ({ studentName: name, status: 'Present' })));
    } finally {
      setLoadingStudents(false);
    }
  }, [selectedClassId, attendanceDate]);

  useEffect(() => {
    if (activeTab === 'student-grid' && selectedClassId) {
      fetchStudentAttendance();
    }
  }, [activeTab, selectedClassId, attendanceDate, fetchStudentAttendance]);

  // Handle Teacher Face Scan Completion (Punch In)
  const handleFaceVerified = async (result) => {
    setShowFaceScanner(false);
    toast.success('Biometric verification passed. Attendance recorded!');
    fetchPersonalLogs();
    setActiveTab('logs');
  };

  // Face scanner verifyFn bridge: sends base64 image and coordinates to backend /punch-in
  const handlePunchInVerification = async (uid, image, challengeFrame) => {
    const targetEmpId = selectedEmpId || user?.employee_id;
    if (!targetEmpId) {
      throw new Error('Employee ID reference missing.');
    }

    const locationData = geoPosition 
      ? { latitude: geoPosition.latitude, longitude: geoPosition.longitude }
      : null;

    return await punchIn(targetEmpId, image, challengeFrame, locationData);
  };

  // Handle Teacher Punch Out (doesn't require face re-verification, just hits punch-out with ID)
  const handlePunchOut = async () => {
    const targetEmpId = user?.employee_id || kioskEmpId;
    if (!targetEmpId) {
      toast.error('Please specify an Employee ID to punch out.');
      return;
    }

    setIsPunchingOut(true);
    try {
      const res = await punchOut(targetEmpId);
      if (res?.status) {
        toast.success('Punch-out registered successfully!');
        fetchPersonalLogs();
        setActiveTab('logs');
      } else {
        toast.error(res.message || 'Failed to punch out.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error punching out.');
    } finally {
      setIsPunchingOut(false);
    }
  };

  // Save Student Attendance
  const handleSaveStudentAttendance = async () => {
    if (!selectedClassId) return;
    setIsSavingStudentAtt(true);
    try {
      const res = await markStudentAttendance({
        date: attendanceDate,
        classId: selectedClassId,
        attendanceData: studentsData
      });
      if (res?.status) {
        toast.success('Student attendance matrix saved successfully!');
        fetchStudentAttendance();
      } else {
        toast.error(res.message || 'Failed to save student records.');
      }
    } catch (err) {
      toast.error('Error saving student attendance.');
    } finally {
      setIsSavingStudentAtt(false);
    }
  };

  // Trigger Face Scan for Kiosk
  const handleKioskScanTrigger = (e) => {
    e.preventDefault();
    if (!kioskEmpId.trim()) {
      toast.error('Please enter a Faculty/Staff ID.');
      return;
    }
    
    // GPS check
    if (!geoPosition || !geoPosition.latitude || !geoPosition.longitude) {
      if (geoDenied) {
        toast.error('Location permissions denied. Enable GPS to record punch-in.');
      } else {
        toast.error('Acquiring location coordinates... please try in a second.');
        geoRefresh();
      }
      return;
    }

    setSelectedEmpId(kioskEmpId.trim());
    setShowFaceScanner(true);
  };

  // Trigger Face Scan for Personal Login
  const handlePersonalScanTrigger = () => {
    if (!user?.employee_id) return;

    if (!geoPosition || !geoPosition.latitude || !geoPosition.longitude) {
      if (geoDenied) {
        toast.error('Location permissions denied. Enable GPS to record punch-in.');
      } else {
        toast.error('Acquiring location coordinates... please try in a second.');
        geoRefresh();
      }
      return;
    }

    setSelectedEmpId('');
    setShowFaceScanner(true);
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col md:flex-row font-sans">
      <Sidebar />
      <div className="flex-1 bg-stone-900/40 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        
        {/* Top Header */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-stone-850 pb-4">
          <div>
            <h1 className="text-2xl font-black text-amber-100 flex items-center gap-2">
              <span>🕐</span> Attendance Registry
            </h1>
            <p className="text-stone-400 text-xs mt-0.5">
              Live Biometrics & Student Records
            </p>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold font-mono text-amber-400 block">{currentTime.toLocaleTimeString()}</span>
            <span className="text-xs text-stone-500">{currentTime.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })}</span>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2 mb-8 overflow-x-auto py-1">
          <button
            onClick={() => { setActiveTab('teacher-punch'); setShowFaceScanner(false); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
              activeTab === 'teacher-punch'
                ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-md'
                : 'bg-stone-900/40 text-stone-400 border-stone-800 hover:bg-stone-900/80 hover:text-stone-200'
            }`}
          >
            👤 Faculty Punch-In
          </button>
          
          {(user?.role?.toLowerCase() === 'teacher' || user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'principal' || user?.role?.toLowerCase() === 'hod' || user?.isAdmin) && (
            <button
              onClick={() => { setActiveTab('student-grid'); setShowFaceScanner(false); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                activeTab === 'student-grid'
                  ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-md'
                  : 'bg-stone-900/40 text-stone-400 border-stone-800 hover:bg-stone-900/80 hover:text-stone-200'
              }`}
            >
              📚 Student Attendance Grid
            </button>
          )}

          <button
            onClick={() => { setActiveTab('logs'); setShowFaceScanner(false); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
              activeTab === 'logs'
                ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-md'
                : 'bg-stone-900/40 text-stone-400 border-stone-800 hover:bg-stone-900/80 hover:text-stone-200'
            }`}
          >
            📋 Attendance History
          </button>
        </div>

        {/* ─── TAB 1: FACULTY PUNCH-IN ─── */}
        {activeTab === 'teacher-punch' && (
          <div className="max-w-4xl mx-auto">
            {showFaceScanner ? (
              <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-6 shadow-xl animate-fadeIn relative">
                <button
                  onClick={() => setShowFaceScanner(false)}
                  className="absolute top-4 right-4 bg-stone-800 hover:bg-stone-750 text-stone-400 hover:text-amber-400 px-3 py-1.5 rounded-lg text-xs font-bold"
                >
                  ✕ Close Scanner
                </button>
                <FaceVerification
                  userId={user?._id || 'kiosk'}
                  onVerified={handleFaceVerified}
                  onFailed={(msg) => toast.error(msg || 'Face Verification Failed')}
                  verifyFn={handlePunchInVerification}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Personal Punch-In Card */}
                <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-bold text-amber-100 mb-2">My Punch-In Console</h3>
                    <p className="text-xs text-stone-400 mb-6 leading-relaxed">
                      Punched in logs will be linked to your user account. Verification runs face matching, liveness scans, and verifies range boundary coordinates (max 500m from registered school location).
                    </p>

                    {/* Geolocation status warning */}
                    <div className="mb-4">
                      {geoPosition ? (
                        <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                          <span>GPS Ready: {geoPosition.latitude.toFixed(5)}, {geoPosition.longitude.toFixed(5)}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-amber-400 font-mono bg-amber-500/5 p-3 rounded-xl border border-amber-500/10 animate-pulse">
                          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                          <span>Acquiring GPS Signal...</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={handlePersonalScanTrigger}
                      disabled={!geoPosition}
                      className="w-full py-4 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-stone-950 font-black text-sm rounded-xl transition-all shadow-lg shadow-amber-500/10 disabled:opacity-50"
                    >
                      📷 Biometric Face Punch-In
                    </button>
                    <button
                      onClick={handlePunchOut}
                      disabled={isPunchingOut}
                      className="w-full py-3 bg-red-650 hover:bg-red-700 text-stone-100 font-bold text-xs rounded-xl transition-all border border-red-900/20"
                    >
                      {isPunchingOut ? 'Punching out...' : '🚪 Punch-Out'}
                    </button>
                  </div>
                </div>

                {/* Shared Gate Kiosk Punch-In Card */}
                <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-6">
                  <h3 className="text-base font-bold text-amber-100 mb-2">Shared Institution Gate Kiosk</h3>
                  <p className="text-xs text-stone-400 mb-6 leading-relaxed">
                    Used as a physical wall terminal. Enter your unique faculty ID to trigger biometric scans, matching your face template stored in the database.
                  </p>
                  
                  <form onSubmit={handleKioskScanTrigger} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Faculty/Staff ID Reference</label>
                      <input
                        type="text"
                        placeholder="e.g. TCH-123456 or STF-123456"
                        value={kioskEmpId}
                        onChange={(e) => setKioskEmpId(e.target.value)}
                        className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-stone-100 text-sm outline-none focus:border-amber-500 placeholder-stone-700 font-mono uppercase"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="submit"
                        disabled={!geoPosition}
                        className="py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-stone-950 font-bold text-xs rounded-xl transition-all disabled:opacity-50"
                      >
                        📷 Scan Face (Punch-In)
                      </button>
                      <button
                        type="button"
                        onClick={handlePunchOut}
                        disabled={isPunchingOut || !kioskEmpId.trim()}
                        className="py-3 bg-stone-850 hover:bg-stone-800 border border-stone-800 text-stone-300 font-bold text-xs rounded-xl transition-all disabled:opacity-50"
                      >
                        🚪 Punch-Out
                      </button>
                    </div>
                  </form>
                </div>

              </div>
            )}
          </div>
        )}

        {/* ─── TAB 2: STUDENT ATTENDANCE GRID ─── */}
        {activeTab === 'student-grid' && (
          <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-6 max-w-4xl mx-auto">
            
            {/* Header / Selectors */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-stone-850 pb-5 mb-6">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold text-stone-500 uppercase mb-1 tracking-wider">Class Standard</label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="bg-stone-950 border border-stone-800 text-amber-100 text-xs rounded-xl px-3 py-2 outline-none focus:border-amber-500 w-44 font-semibold"
                  >
                    {classesList.map(c => (
                      <option key={c._id} value={c._id}>Class {c.standard} - {c.section}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-stone-500 uppercase mb-1 tracking-wider">Date</label>
                  <input
                    type="date"
                    value={attendanceDate}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    className="bg-stone-950 border border-stone-800 text-amber-100 text-xs rounded-xl px-3 py-1.5 outline-none focus:border-amber-500 font-semibold"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveStudentAttendance}
                disabled={isSavingStudentAtt || studentsData.length === 0}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-stone-950 font-black text-xs rounded-xl transition-all shadow-md shadow-amber-500/10 disabled:opacity-50"
              >
                {isSavingStudentAtt ? 'Saving Matrix...' : '💾 Save Attendance Grid'}
              </button>
            </div>

            {/* Students Table */}
            {loadingStudents ? (
              <div className="text-center py-12">
                <Spinner size="lg" className="mx-auto mb-2" />
                <p className="text-stone-500 text-xs italic">Fetching student roster...</p>
              </div>
            ) : studentsData.length === 0 ? (
              <p className="text-stone-500 text-xs italic text-center py-8">Select a class standard to display students.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-stone-850 text-stone-500 font-extrabold uppercase tracking-wider">
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4 text-right">Attendance Status Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentsData.map((student, idx) => (
                      <tr key={idx} className="border-b border-stone-850/50 hover:bg-stone-900/20 text-stone-300">
                        <td className="py-3.5 px-4 font-bold text-amber-50">{student.studentName}</td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex bg-stone-950 border border-stone-850 rounded-lg p-0.5">
                            {['Present', 'Absent', 'Late'].map(statusOption => {
                              const isActive = student.status === statusOption;
                              const getBadgeClass = () => {
                                if (!isActive) return 'text-stone-500 hover:text-stone-300';
                                if (statusOption === 'Present') return 'bg-emerald-500 text-stone-950 font-bold';
                                if (statusOption === 'Absent') return 'bg-red-500 text-stone-950 font-bold';
                                return 'bg-amber-500 text-stone-950 font-bold';
                              };
                              return (
                                <button
                                  key={statusOption}
                                  type="button"
                                  onClick={() => {
                                    const updated = [...studentsData];
                                    updated[idx].status = statusOption;
                                    setStudentsData(updated);
                                  }}
                                  className={`px-3 py-1 text-[10px] rounded-md transition-all ${getBadgeClass()}`}
                                >
                                  {statusOption}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        )}

        {/* ─── TAB 3: ATTENDANCE HISTORY LOGS ─── */}
        {activeTab === 'logs' && (
          <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-6 max-w-4xl mx-auto">
            <h3 className="text-base font-bold text-amber-100 mb-4">My Personal Biometric Attendance Logs</h3>
            {logsLoading ? (
              <div className="text-center py-12"><Spinner size="lg" className="mx-auto" /></div>
            ) : personalLogs.length === 0 ? (
              <p className="text-stone-500 text-xs italic text-center py-8">No personal attendance logs found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-stone-850 text-stone-500 font-extrabold uppercase tracking-wider">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Punch-In Time</th>
                      <th className="py-3 px-4">Punch-Out Time</th>
                      <th className="py-3 px-4">Logged Location</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personalLogs.map((log, idx) => (
                      <tr key={idx} className="border-b border-stone-850/50 hover:bg-stone-900/20 text-stone-300">
                        <td className="py-3 px-4 font-mono font-bold text-amber-50">{log.date}</td>
                        <td className="py-3 px-4 font-mono">{log.punchIn ? new Date(log.punchIn).toLocaleTimeString() : '--:--'}</td>
                        <td className="py-3 px-4 font-mono">{log.punchOut ? new Date(log.punchOut).toLocaleTimeString() : '--:--'}</td>
                        <td className="py-3 px-4 text-stone-400 truncate max-w-[200px]" title={log.address}>{log.address || 'School Campus'}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold uppercase text-[9px] border ${
                            log.status === 'Present'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : log.status === 'Leave'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default AttendancePage;
