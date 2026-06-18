import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { kioskGetEmployee, kioskLogoutEmployee } from '../services/authService';
import Spinner from '../components/ui/Spinner';
import FaceVerification from '../components/face/FaceVerification';
import useGeolocation from '../hooks/useGeolocation';
import { useTranslation } from 'react-i18next';
import Sidebar from '../components/ui/Sidebar';

const LogoutKioskPage = () => {
  const { t } = useTranslation();
  const locationState = useLocation().state;
  const navigate = useNavigate();
  
  const fromAttendance = locationState?.fromAttendance || false;
  const { location, error: locationError } = useGeolocation();
  const [showVerification, setShowVerification] = useState(false);

  const [employeeId, setEmployeeId] = useState(locationState?.employeeId || '');
  const [employee, setEmployee] = useState(null);
  
  const [loginTimeInput, setLoginTimeInput] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [isLoading, setIsLoading] = useState(false);
  const [calcResult, setCalcResult] = useState(null);
  const timeInputRef = React.useRef(null);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-search if employee ID was passed from Attendance page
  useEffect(() => {
    if (locationState?.employeeId && !employee) {
      handleAutoSearch(locationState.employeeId);
    }
  }, []);

  const handleAutoSearch = async (eid) => {
    setIsLoading(true);
    try {
      const res = await kioskGetEmployee(eid);
      if (res.status && res.data) {
        setEmployee(res.data);
        // Force login time input to be empty initially, asking the employee to enter it manually
        setLoginTimeInput('');
      } else {
        toast.error(res.message || 'Employee not found');
      }
    } catch (err) {
      toast.error('Failed to fetch employee');
    } finally {
      setIsLoading(false);
    }
  };

  // Recalculate duration whenever login time or current time changes
  useEffect(() => {
    if (!employee || !loginTimeInput) {
      setCalcResult(null);
      return;
    }
    
    // Parse login time input (HH:mm)
    const [hoursStr, minutesStr] = loginTimeInput.split(':');
    const loginDate = new Date();
    loginDate.setHours(parseInt(hoursStr, 10));
    loginDate.setMinutes(parseInt(minutesStr, 10));
    loginDate.setSeconds(0);
    
    // If they supposedly logged in 'in the future' for today, maybe it was yesterday evening?
    // We'll assume simplest case: same day calculations.
    if (loginDate > currentTime) {
      loginDate.setDate(loginDate.getDate() - 1);
    }
    
    const diffMs = currentTime - loginDate;
    const diffHours = diffMs / (1000 * 60 * 60);
    
    setCalcResult({
      durationHours: diffHours,
      isAllowed: diffHours >= employee.hours_per_day,
      diffMs: diffMs,
    });
    
  }, [loginTimeInput, currentTime, employee]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!employeeId.trim()) return toast.error("Please enter Employee ID");
    
    setIsLoading(true);
    try {
      const res = await kioskGetEmployee(employeeId.trim());
      if (res.status && res.data) {
        setEmployee(res.data);
        
        // Force login time input to be empty initially, asking the employee to enter it manually
        setLoginTimeInput('');
        
        toast.success("Employee found");
      } else {
        toast.error(res.message || "Employee not found");
      }
    } catch (err) {
      toast.error(err.message || "Failed to fetch employee");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!loginTimeInput) {
      return toast.error("Please enter your login time first.");
    }
    
    if (!location) {
      return toast.error("Waiting for GPS location... Please ensure GPS is enabled and try again.");
    }
    
    // If we came from AttendancePage and already verified face+location, skip face scan!
    if (locationState?.verifiedFace) {
      const { image, challengeFrame, location: verifiedLoc } = locationState.verifiedFace;
      try {
        const durationMins = Math.floor(calcResult.diffMs / (1000 * 60));
        const res = await kioskLogoutEmployee(employee.employee_id, loginTimeInput, durationMins, image, challengeFrame, verifiedLoc || location);
        if (res.status) {
          toast.success(`Goodbye ${employee.name}! You have been logged out.`);
          setEmployee(null);
          setEmployeeId('');
          setLoginTimeInput('');
          if (fromAttendance) {
            setTimeout(() => navigate('/attendance'), 1500);
          }
        } else {
          toast.error(res.message || "Logout failed");
        }
      } catch (err) {
        toast.error(err?.response?.data?.detail || "Failed to process logout");
      }
      return;
    }

    if (locationState?.skipVerification || (employee?.skip_face && employee?.skip_location)) {
      try {
        const durationMins = Math.floor(calcResult.diffMs / (1000 * 60));
        const res = await kioskLogoutEmployee(employee.employee_id, loginTimeInput, durationMins, null, null, location);
        if (res.status) {
          toast.success(`Goodbye ${employee.name}! You have been logged out.`);
          setEmployee(null);
          setEmployeeId('');
          setLoginTimeInput('');
          if (fromAttendance) {
            setTimeout(() => navigate('/attendance'), 1500);
          }
        } else {
          toast.error(res.message || "Logout failed");
        }
      } catch (err) {
        toast.error(err?.response?.data?.detail || "Failed to process logout");
      }
      return;
    }

    setShowVerification(true);
  };

  const verifyLogout = async (userId, image, challengeFrame) => {
    if (!location) { return { status: false, message: "Waiting for GPS location... Please ensure GPS is enabled." }; }
    
    try {
      const durationMins = Math.floor(calcResult.diffMs / (1000 * 60));
      const res = await kioskLogoutEmployee(employee.employee_id, loginTimeInput, durationMins, image, challengeFrame, location);
      if (res.status) {
        toast.success(`Goodbye ${employee.name}! You have been logged out.`);
        // Reset kiosk
        setEmployee(null);
        setEmployeeId('');
        setLoginTimeInput('');
        setShowVerification(false);
        // Redirect back to attendance if came from there
        if (fromAttendance) {
          setTimeout(() => navigate('/attendance'), 1500);
        }
        return { status: true, confidence: 100, message: res.message };
      } else {
        return { status: false, message: res.message || "Logout failed" };
      }
    } catch (err) {
      return { status: false, message: err?.response?.data?.detail || "Failed to process logout" };
    }
  };

  const formatDuration = (ms) => {
    if (ms < 0) return "0 hrs 0 mins";
    const h = Math.floor(ms / (1000 * 60 * 60));
    const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${h} hrs ${m} mins`;
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col md:flex-row animate-fadeIn font-sans">
      <Sidebar />
      <div className="flex-1 bg-white flex flex-col min-w-0">
        <div className="min-h-[calc(100vh-4rem)] bg-white p-4 sm:p-6 overflow-y-auto flex items-center justify-center">
          <div className="w-full max-w-3xl">
            <div className="bg-stone-900/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden animate-fadeIn border border-amber-600/15 golden-glow">
              
              {/* Header */}
              <div className="bg-gradient-to-r from-amber-600 to-yellow-600 p-6 text-white text-center rounded-b-3xl">
                <h1 className="text-3xl font-extrabold tracking-tight">🏢 {t('kiosk_title')}</h1>
                <p className="text-amber-100 mt-2 font-medium">{t('kiosk_desc')}</p>
              </div>

              <div className="p-8">
                
                {/* Step 1: Search */}
                {!employee ? (
                  <form onSubmit={handleSearch} className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-amber-200/80 mb-2">{t('scan_enter_eid')}</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <svg className="h-6 w-6 text-amber-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                          </svg>
                        </div>
                        <input 
                          type="text" 
                          value={employeeId}
                          onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                          placeholder="e.g. EMP-1A2B3C"
                          required
                          className="block w-full pl-12 pr-4 py-4 border-2 border-amber-700/30 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all text-xl font-mono uppercase tracking-widest outline-none bg-stone-800/60 text-amber-50 placeholder-amber-200/30"
                        />
                      </div>
                    </div>
                    <button 
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-4 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-stone-900 font-bold text-lg rounded-xl transition-all shadow-md shadow-amber-500/20 active:scale-[0.98] disabled:opacity-70 flex justify-center items-center"
                    >
                      {isLoading ? (
                        <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        t('retrieve_profile')
                      )}
                    </button>
                  </form>
                ) : (
                  /* Step 2: Time Check */
                  <div className="space-y-8 animate-fadeIn">
                    
                    {/* Employee Card */}
                    <div className="flex items-center gap-4 bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20">
                      <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-400 font-bold text-2xl">
                        {employee.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <h2 className="text-xl font-bold text-amber-50">{employee.name}</h2>
                        <p className="text-amber-400 font-semibold">{employee.designation}</p>
                        <p className="text-xs text-amber-200/40 font-mono mt-1">ID: {employee.employee_id}</p>
                      </div>
                      <button 
                        onClick={() => { setEmployee(null); setLoginTimeInput(''); }}
                        className="px-3 py-1.5 text-sm font-medium bg-stone-800 text-amber-200 rounded-lg shadow-sm border border-amber-700/20 hover:bg-stone-700"
                      >
                        {t('change_emp')}
                      </button>
                    </div>

                    {/* Clocks */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-stone-800/50 p-4 rounded-xl border border-amber-700/20 text-center flex flex-col justify-center min-h-[108px]">
                        <label className="block text-xs font-bold text-amber-300/60 uppercase mb-2">{t('current_time')}</label>
                        <p className="text-3xl font-mono text-amber-50 tracking-wider">
                          {currentTime.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </p>
                      </div>
                      <div 
                        onClick={() => timeInputRef.current?.showPicker()}
                        className="bg-stone-800/50 p-4 rounded-xl border-2 border-amber-500/30 text-center relative overflow-hidden cursor-pointer hover:border-amber-400/50 transition-all flex flex-col justify-center min-h-[108px] group"
                      >
                        <label className="block text-xs font-bold text-amber-400 uppercase mb-2 pointer-events-none">{t('login_time')}</label>
                        <div className="relative flex items-center justify-center w-full">
                          <input 
                            ref={timeInputRef}
                            type="time" 
                            value={loginTimeInput}
                            onChange={(e) => setLoginTimeInput(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="text-center text-2xl font-mono font-bold text-amber-400 bg-transparent outline-none cursor-pointer w-full focus:ring-0 focus:border-transparent border-none p-0"
                          />
                          <div className="absolute right-2 text-amber-400 group-hover:text-amber-300 transition-colors pointer-events-none">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        </div>
                        <div className="absolute top-0 right-0 p-1 text-[10px] bg-amber-500/20 text-amber-400 font-bold rounded-bl-lg pointer-events-none">{t('editable')}</div>
                      </div>
                    </div>

                    {/* Calculation Output */}
                    {loginTimeInput && calcResult ? (
                      <div className={`p-5 rounded-2xl border-2 transition-all duration-300 ${calcResult.isAllowed ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
                        
                        <div className="flex justify-between items-end mb-4">
                          <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t('time_logged')}</p>
                            <p className={`text-4xl font-extrabold ${calcResult.isAllowed ? 'text-green-600' : 'text-orange-500'}`}>
                              {formatDuration(calcResult.diffMs)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t('company_goal')}</p>
                            <p className="text-xl font-bold text-gray-700">{employee.hours_per_day} hrs</p>
                          </div>
                        </div>

                        {calcResult.isAllowed ? (
                          <div className="bg-green-100 text-green-800 p-3 rounded-lg text-center font-bold text-sm">
                            ✅ {t('work_complete')}
                          </div>
                        ) : (
                          <div className="bg-orange-100 text-orange-800 p-3 rounded-lg text-center font-bold text-sm">
                            ⚠️ {t('less_hours_msg')}
                          </div>
                        )}

                      </div>
                    ) : (
                      <div className="p-6 bg-stone-800/50 rounded-2xl border border-amber-700/20 text-center text-amber-200/40 font-medium space-y-2">
                        <p>{t('enter_login_time')}</p>
                        {!location && !locationError && (
                          <div className="flex items-center justify-center gap-2 text-xs text-amber-500 font-bold animate-pulse">
                            <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                            Acquiring GPS Location...
                          </div>
                        )}
                        {locationError && (
                          <p className="text-xs text-red-500 font-bold">⚠️ GPS Error: {locationError}</p>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <button
                      onClick={handleLogout}
                      disabled={!loginTimeInput || isLoading}
                      className={`w-full py-4 font-bold text-lg rounded-xl transition-all shadow-md flex justify-center items-center ${
                        loginTimeInput
                          ? 'bg-red-600 hover:bg-red-700 text-white active:scale-[0.98]' 
                          : 'bg-stone-800 text-amber-200/30 cursor-not-allowed'
                      }`}
                    >
                      {isLoading ? (
                        <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        "🚪 " + t('logout')
                      )}
                    </button>

                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Face Match Modal (Step 2 & 3) */}
      {showVerification && employee && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center flex-col">
           <div className="w-full max-w-md p-4">
              <div className="bg-white p-4 rounded-t-2xl flex justify-between items-center shadow-md z-10 relative">
                 <div>
                   <h3 className="font-bold text-gray-900">{t('face_loc_verify')}</h3>
                   <p className="text-xs text-gray-500">{t('verifying_emp')} {employee?.name}</p>
                 </div>
                 <button onClick={() => setShowVerification(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                   <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                 </button>
              </div>
              <div className="bg-black relative rounded-b-2xl overflow-hidden shadow-2xl border-x border-b border-white/20">
                <FaceVerification
                  userId={employee.employee_id}
                  verifyFn={verifyLogout}
                  onVerified={() => setShowVerification(false)}
                  onCancel={() => setShowVerification(false)}
                />
                {!location && !locationError && (
                  <div className="absolute top-4 left-4 right-4 bg-yellow-500/90 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-2 backdrop-blur-sm z-50 animate-pulse">
                    <Spinner size="sm" /> {t('acquiring_gps')}
                  </div>
                )}
                {locationError && (
                  <div className="absolute top-4 left-4 right-4 bg-red-600/90 text-white text-xs font-bold px-3 py-2 rounded-lg backdrop-blur-sm z-50 shadow-lg">
                    ⚠️ {t('location_required')}: {locationError}
                  </div>
                )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default LogoutKioskPage;
