import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { loginWithPassword, getProfile, getCompanySettings, updateCompanySettings, getConsolidatedReport, getDetailsReport, getAdminEmployees, updateEmployeeSettings, deleteEmployee, exportAttendanceExcel, resetEmployeePassword, getDailyStatus, uploadEmployeeDocument, downloadEmployeeDocument, getRoles, createRole, updateRole, deleteRole } from '../services/authService';
import { useTranslation } from 'react-i18next';
import Spinner from '../components/ui/Spinner';
import useGeolocation from '../hooks/useGeolocation';
import Sidebar from '../components/ui/Sidebar';

const MONTH_NAMES = ['','January','February','March','April','May','June','July','August','September','October','November','December'];

const AdminPage = () => {
  const { t } = useTranslation();
  const { user, loginSuccess, faceVerified } = useAuth();
  const navigate = useNavigate();
  const { position: geoPosition, error: geoError, permissionDenied: geoDenied, refresh: geoRefresh } = useGeolocation({ watch: true });

  const [settings, setSettings] = useState({ 
    hours_per_day: 8.0, 
    hours_per_week: 40.0,
    hours_per_month: 160.0,
    hours_per_year: 1920.0,
    weekly_off: 'Sunday',
    office_start_time: '09:00',
    grace_period_mins: 30
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState('settings');
  // Reports
  const [consolidated, setConsolidated] = useState(null);
  const [details, setDetails] = useState(null);
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [deptFilter, setDeptFilter] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  // Employee Management
  const [employees, setEmployees] = useState([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [empSearch, setEmpSearch] = useState('');
  const [savingEmpId, setSavingEmpId] = useState(null);
  const [exportingType, setExportingType] = useState(null);
  const [selectedUserDashboard, setSelectedUserDashboard] = useState(null);

  // Roles Management
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [rolesSearch, setRolesSearch] = useState('');
  const [roleForm, setRoleForm] = useState({
    RoleCode: 'AUTO-GENERATED',
    Rolename: '',
    GantAdminPrevillage: false
  });

  // Modal Insurance States
  const [modalInsuranceId, setModalInsuranceId] = useState('');
  const [modalInsuranceProvider, setModalInsuranceProvider] = useState('');
  const [modalSaving, setModalSaving] = useState(false);

  useEffect(() => {
    if (selectedUserDashboard) {
      setModalInsuranceId(selectedUserDashboard.insurance_id || '');
      setModalInsuranceProvider(selectedUserDashboard.insurance_provider || '');
    } else {
      setModalInsuranceId('');
      setModalInsuranceProvider('');
    }
  }, [selectedUserDashboard]);

  const handleSaveModalInsurance = async () => {
    if (!selectedUserDashboard) return;
    setModalSaving(true);
    try {
      await updateEmployeeSettings(selectedUserDashboard._id, {
        skip_face: selectedUserDashboard.skip_face,
        skip_location: selectedUserDashboard.skip_location,
        is_enabled: selectedUserDashboard.is_enabled,
        role: selectedUserDashboard.role,
        insurance_id: modalInsuranceId.trim(),
        insurance_provider: modalInsuranceProvider.trim(),
      });
      
      // Update local list state so it syncs immediately without reload
      setEmployees(prev => prev.map(e => e._id === selectedUserDashboard._id ? {
        ...e,
        insurance_id: modalInsuranceId.trim(),
        insurance_provider: modalInsuranceProvider.trim()
      } : e));
      
      // Update selectedUserDashboard state as well
      setSelectedUserDashboard(prev => prev ? {
        ...prev,
        insurance_id: modalInsuranceId.trim(),
        insurance_provider: modalInsuranceProvider.trim()
      } : null);

      toast.success("Insurance details saved successfully!");
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to save insurance details');
    } finally {
      setModalSaving(false);
    }
  };

  const [govtUploading, setGovtUploading] = useState(false);
  const [insUploading, setInsUploading] = useState(false);

  const handleDocumentUpload = async (e, docType) => {
    if (!selectedUserDashboard) return;
    const file = e.target.files?.[0];
    if (!file) return;

    if (docType === 'govt_id') {
      setGovtUploading(true);
    } else {
      setInsUploading(true);
    }

    try {
      const res = await uploadEmployeeDocument(selectedUserDashboard._id, docType, file);
      if (res.status) {
        toast.success(`${docType === 'govt_id' ? 'Government ID' : 'Insurance document'} uploaded successfully!`);
        
        const updatedFilename = file.name;
        
        // Update local list state so it syncs immediately without reload
        setEmployees(prev => prev.map(emp => emp._id === selectedUserDashboard._id ? {
          ...emp,
          [`${docType}_filename`]: updatedFilename
        } : emp));
        
        // Update selectedUserDashboard state as well
        setSelectedUserDashboard(prev => prev ? {
          ...prev,
          [`${docType}_filename`]: updatedFilename
        } : null);
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to upload document');
    } finally {
      if (docType === 'govt_id') {
        setGovtUploading(false);
      } else {
        setInsUploading(false);
      }
    }
  };

  const handleDocumentDownload = async (docType, filename) => {
    if (!selectedUserDashboard) return;
    try {
      await downloadEmployeeDocument(selectedUserDashboard._id, docType, filename);
      toast.success("Document download started!");
    } catch (err) {
      toast.error("Failed to download document");
    }
  };

  // Daily Status Monitor States
  const [dailyStatusDate, setDailyStatusDate] = useState(new Date().toLocaleDateString('en-CA')); // YYYY-MM-DD
  const [dailyStatusData, setDailyStatusData] = useState([]);
  const [dailyStatusLoading, setDailyStatusLoading] = useState(false);
  const [dailySearchQuery, setDailySearchQuery] = useState('');

  const fetchDailyStatus = useCallback(async (dateStr) => {
    try {
      setDailyStatusLoading(true);
      const res = await getDailyStatus(dateStr);
      if (res?.status && Array.isArray(res.data)) {
        setDailyStatusData(res.data);
      } else {
        setDailyStatusData([]);
      }
    } catch (err) {
      toast.error('Failed to load daily status');
      setDailyStatusData([]);
    } finally {
      setDailyStatusLoading(false);
    }
  }, []);

  const handleUserClick = async (db_id) => {
    let empList = employees;
    if (!empList || empList.length === 0) {
      try {
        const res = await getAdminEmployees();
        empList = res?.data || [];
        setEmployees(empList);
      } catch (err) {
        toast.error('Failed to load user details');
        return;
      }
    }
    const fullEmp = empList.find(e => e._id === db_id || e.employee_id === db_id || e.name === db_id);
    if (fullEmp) {
      setSelectedUserDashboard(fullEmp);
    } else {
      toast.error('User details not found');
    }
  };
  const fetchEmployees = useCallback(async () => {
    try {
      setEmpLoading(true);
      const res = await getAdminEmployees();
      if (res?.data) setEmployees(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to load employees');
    } finally {
      setEmpLoading(false);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      setRolesLoading(true);
      const res = await getRoles();
      if (res?.data) {
        setRoles(res.data);
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to load roles');
    } finally {
      setRolesLoading(false);
    }
  }, []);

  const fetchConsolidated = async () => {
    try { setReportLoading(true); const res = await getConsolidatedReport(reportMonth, reportYear, deptFilter);
      if (res?.data) setConsolidated(res.data);
    } catch (err) { toast.error(err?.response?.data?.detail || 'Failed'); } finally { setReportLoading(false); }
  };

  const fetchDetails = async () => {
    try { setReportLoading(true); const res = await getDetailsReport(reportMonth, reportYear, '', deptFilter);
      if (res?.data) setDetails(res.data);
    } catch (err) { toast.error(err?.response?.data?.detail || 'Failed'); } finally { setReportLoading(false); }
  };

  const fetchConsolidatedSilent = async () => {
    try { const res = await getConsolidatedReport(reportMonth, reportYear, deptFilter); if (res?.data) setConsolidated(res.data); } catch (err) {}
  };

  const fetchDetailsSilent = async () => {
    try { const res = await getDetailsReport(reportMonth, reportYear, '', deptFilter); if (res?.data) setDetails(res.data); } catch (err) {}
  };

  useEffect(() => { 
    if (activeTab === 'consolidated') fetchConsolidated(); 
    if (activeTab === 'details' || activeTab === 'individual_details') fetchDetails(); 
    if (activeTab === 'employees') {
      fetchEmployees();
      fetchRoles();
    }
    if (activeTab === 'roles') fetchRoles(); 
    if (activeTab === 'daily_status') fetchDailyStatus(dailyStatusDate);
  }, [activeTab, reportMonth, reportYear, deptFilter, dailyStatusDate, fetchDailyStatus, fetchRoles]);

  // Real-time polling every 15 seconds
  useEffect(() => {
    const pollInterval = setInterval(() => {
      if (activeTab === 'consolidated') fetchConsolidatedSilent();
      else if (activeTab === 'details' || activeTab === 'individual_details') fetchDetailsSilent();
      else if (activeTab === 'employees') {
        getAdminEmployees().then(res => { if (res?.data) setEmployees(res.data); }).catch(() => {});
      } else if (activeTab === 'daily_status') {
        getDailyStatus(dailyStatusDate).then(res => { if (res?.status && Array.isArray(res.data)) setDailyStatusData(res.data); }).catch(() => {});
      }
    }, 15000);
    return () => clearInterval(pollInterval);
  }, [activeTab, reportMonth, reportYear, deptFilter, dailyStatusDate]);

  const handleRoleSubmit = async (e) => {
    e.preventDefault();
    const finalForm = { ...roleForm };
    if (!editingRole) {
      finalForm.RoleCode = 'AUTO-GENERATED';
    }
    if (!finalForm.RoleCode || !finalForm.Rolename) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (user?.role !== 'admin') {
      toast.error("Only admin can create or edit roles");
      return;
    }
    try {
      if (editingRole) {
        const res = await updateRole(editingRole._id, finalForm);
        if (res?.status) {
          toast.success("Role updated successfully");
          setIsRoleModalOpen(false);
          fetchRoles();
        } else {
          toast.error(res?.message || "Failed to update role");
        }
      } else {
        const res = await createRole(finalForm);
        if (res?.status) {
          toast.success("Role created successfully");
          setIsRoleModalOpen(false);
          fetchRoles();
        } else {
          toast.error(res?.message || "Failed to create role");
        }
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || 'Failed to save role');
    }
  };

  const handleRoleDelete = async (id) => {
    if (user?.role !== 'admin') {
      toast.error("Only admin can delete roles");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this role?")) return;
    try {
      const res = await deleteRole(id);
      if (res?.status) {
        toast.success("Role deleted successfully");
        fetchRoles();
      } else {
        toast.error(res?.message || "Failed to delete role");
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to delete role');
    }
  };

  const handleEmpToggle = (idx, field) => {
    setEmployees(prev => prev.map((e, i) => i === idx ? { ...e, [field]: !e[field] } : e));
  };

  const handleEmpRole = (idx, role) => {
    setEmployees(prev => prev.map((e, i) => i === idx ? { ...e, role } : e));
  };

  const handleEmpTextChange = (idx, field, val) => {
    setEmployees(prev => prev.map((e, i) => i === idx ? { ...e, [field]: val } : e));
  };

  const handleSaveEmployee = async (emp) => {
    setSavingEmpId(emp._id);
    try {
      await updateEmployeeSettings(emp._id, {
        skip_face: emp.skip_face,
        skip_location: emp.skip_location,
        is_enabled: emp.is_enabled,
        role: emp.role,
        insurance_id: emp.insurance_id || '',
        insurance_provider: emp.insurance_provider || '',
      });
      toast.success(`${emp.name} settings saved!`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to save');
    } finally {
      setSavingEmpId(null);
    }
  };

  const handleResetPassword = async (empId, name) => {
    const newPass = window.prompt(`Enter new password for ${name}:`);
    if (!newPass) return;
    if (newPass.length < 8) return toast.error("Password must be at least 8 characters");

    setSavingEmpId(empId);
    try {
      const res = await resetEmployeePassword(empId, newPass);
      if (res.status) {
        toast.success(`Password for ${name} reset successfully!`);
        setEmployees(prev => prev.map(e => e._id === empId ? { ...e, plain_password: newPass } : e));
        setSelectedUserDashboard(prev => prev && prev._id === empId ? { ...prev, plain_password: newPass } : prev);
      } else {
        toast.error(res.message || "Failed to reset password");
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Password reset failed");
    } finally {
      setSavingEmpId(null);
    }
  };

  const handleDeleteEmployee = async (empId, name) => {
    if (!window.confirm(`⚠️ DANGER: Are you sure you want to HARD DELETE ${name}? This will permanently remove their profile and all their attendance history. This cannot be undone.`)) return;
    
    setSavingEmpId(empId);
    try {
      const res = await deleteEmployee(empId);
      if (res.status) {
        toast.success(`Employee ${name} deleted permanently.`);
        fetchEmployees();
      } else {
        toast.error(res.message || 'Failed to delete');
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Delete failed');
    } finally {
      setSavingEmpId(null);
    }
  };

  const handleExport = async (type, employeeId = '') => {
    setExportingType(type);
    try {
      await exportAttendanceExcel(type, reportMonth, reportYear, deptFilter, employeeId);
      toast.success('Excel file downloaded!');
    } catch (err) {
      toast.error('Export failed');
    } finally {
      setExportingType(null);
    }
  };

  // Load current settings
  useEffect(() => {
    const loadSettings = async () => {
      if (user?.role !== 'admin') return;
      try {
        const res = await getCompanySettings();
        if (res?.data) {
          setSettings({
            hours_per_day: res.data.hours_per_day || 8.0,
            hours_per_week: res.data.hours_per_week || 40.0,
            hours_per_month: res.data.hours_per_month || 160.0,
            hours_per_year: res.data.hours_per_year || 1920.0,
            weekly_off: res.data.weekly_off || 'Sunday',
            office_start_time: res.data.office_start_time || '09:00',
            grace_period_mins: res.data.grace_period_mins || 30
          });
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, [user]);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast.error("Email and password required");

    // ── MANDATORY GPS CHECK ──
    if (!geoPosition || !geoPosition.latitude || !geoPosition.longitude) {
      if (geoDenied) {
        toast.error('Location permission denied. Please enable GPS in your browser settings and refresh.');
      } else if (geoError) {
        toast.error('GPS location not available. Please enable Location Services and try again.');
      } else {
        toast.error('Acquiring your GPS location... Please wait a moment and try again.');
        geoRefresh();
      }
      return;
    }
    
    setIsLoggingIn(true);
    try {
      const locationData = { latitude: geoPosition.latitude, longitude: geoPosition.longitude };
      const res = await loginWithPassword(email, password, locationData);
      // loginWithPassword throws on error, so if we reach here it was successful!
      loginSuccess(res);
      
      // Fetch profile to set the user
      const profRes = await getProfile();
      if (profRes.data.role !== 'admin') {
        toast.error("Account does not have admin privileges");
        // Logout logic here if needed...
      } else {
        faceVerified(profRes.data); // mock face verification for admin to bypass guards
        toast.success("Admin authenticated successfully");
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const errorMessage = Array.isArray(detail) ? detail.map(e => e.msg).join(', ') : detail || err.message || "Authentication failed";
      toast.error(errorMessage);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSave = async () => {
    const hrsD = parseFloat(settings.hours_per_day);
    const hrsW = parseFloat(settings.hours_per_week);
    const hrsM = parseFloat(settings.hours_per_month);
    const hrsY = parseFloat(settings.hours_per_year);
    
    if (isNaN(hrsD) || hrsD <= 0 || hrsD > 24) return toast.error("Daily hours must be 1-24");
    if (isNaN(hrsW)) return toast.error("Weekly hours required");
    if (isNaN(hrsM)) return toast.error("Monthly hours required");
    if (isNaN(hrsY)) return toast.error("Yearly hours required");
    if (!settings.weekly_off.trim()) {
      return toast.error("Weekly off is required");
    }

    const grace = parseInt(settings.grace_period_mins);

    if (isNaN(grace) || grace < 0) return toast.error("Grace period must be >= 0");

    setIsSaving(true);
    try {
      const settingsPayload = {
        hours_per_day: hrsD,
        hours_per_week: hrsW,
        hours_per_month: hrsM,
        hours_per_year: hrsY,
        weekly_off: settings.weekly_off.trim(),
        office_start_time: settings.office_start_time || '09:00',
        grace_period_mins: grace
      };
      
      await updateCompanySettings(settingsPayload);

      toast.success("Global company settings updated! All employees have been updated.");
    } catch (err) {
      toast.error(err.message || "Failed to update settings");
    } finally {
      setIsSaving(false);
    }
  };

  // If NOT admin, show Login form
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-stone-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-amber-600/15 overflow-hidden golden-glow">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-center">
            <h2 className="text-2xl font-bold text-white">Admin Secure Login</h2>
            <p className="text-indigo-100 text-sm mt-1">Authorized Company Heads Only</p>
          </div>
          <form onSubmit={handleAdminLogin} className="p-8 space-y-6">
            <div>
              <label className="block text-sm font-bold text-indigo-200 uppercase tracking-wider mb-2">Admin Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-4 bg-white/5 border border-white/20 rounded-xl text-white font-medium focus:ring-2 focus:ring-amber-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-indigo-200 uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full px-5 py-4 bg-white/5 border border-white/20 rounded-xl text-white font-medium focus:ring-2 focus:ring-amber-400 outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-stone-900 font-bold text-lg rounded-xl transition-all shadow-lg shadow-amber-500/20 mt-4 disabled:opacity-70 flex justify-center items-center"
            >
              {isLoggingIn ? <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : "Authenticate"}
            </button>
            <div className="text-center mt-4">
              <button type="button" onClick={() => navigate('/')} className="text-indigo-300 hover:text-white text-sm">Return to Home</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col md:flex-row animate-fadeIn font-sans">
      <Sidebar />
      <div className="flex-1 bg-white flex flex-col min-w-0">
        <div className="min-h-[calc(100vh-4rem)] bg-white p-4 sm:p-6 overflow-y-auto">
          <div className="w-full mx-auto">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="mt-3 inline-flex items-center gap-2 bg-amber-100 px-4 py-1.5 rounded-full border border-amber-300">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-sm text-stone-700 font-medium">{t('logged_in_as')} {user?.name} ({user?.role})</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto justify-center">
          {[
            {id:'settings',label:'⚙️ ' + t('tab_settings')},
            {id:'roles',label:'🔑 ' + 'Role'},
            {id:'employees',label:'👥 ' + t('employee_mgmt')},
            {id:'consolidated',label:'📊 ' + t('tab_consolidated')},
            {id:'details',label:'📝 All Details'},
            {id:'daily_status',label:'📅 Daily Status'},
            {id:'individual_details',label:'👤 Individual Details'}
          ].map(tObj => (
            <button key={tObj.id} onClick={() => setActiveTab(tObj.id)} className={`px-5 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${activeTab===tObj.id ? 'bg-amber-500 text-stone-900 shadow-lg scale-105' : 'bg-stone-100 text-stone-700 border border-stone-200 hover:bg-stone-200'}`}>{tObj.label}</button>
          ))}
        </div>

        {activeTab === 'settings' && (
          <>
        {/* Working Hours Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-8">
          <div className="bg-gray-50 border-b border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t('office_hours')}
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              {t('office_hours_desc')}
            </p>
          </div>

          <div className="p-6 sm:p-8">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <span className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></span>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">
                      {t('hours_day')}
                    </label>
                    <input
                      type="number" step="0.5" min="1" max="24"
                      value={settings.hours_per_day}
                      onChange={(e) => setSettings({ ...settings, hours_per_day: e.target.value })}
                      className="w-full px-5 py-4 bg-white border border-gray-300 rounded-xl text-gray-900 text-2xl font-bold focus:ring-2 focus:ring-amber-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">
                      {t('hours_week')}
                    </label>
                    <input
                      type="number" step="0.5" min="1"
                      value={settings.hours_per_week}
                      onChange={(e) => setSettings({ ...settings, hours_per_week: e.target.value })}
                      className="w-full px-5 py-4 bg-white border border-gray-300 rounded-xl text-gray-900 text-2xl font-bold focus:ring-2 focus:ring-amber-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Hours Per Month
                    </label>
                    <input
                      type="number" step="0.5" min="1"
                      value={settings.hours_per_month}
                      onChange={(e) => setSettings({ ...settings, hours_per_month: e.target.value })}
                      className="w-full px-5 py-4 bg-white border border-gray-300 rounded-xl text-gray-900 text-2xl font-bold focus:ring-2 focus:ring-amber-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Hours Per Year
                    </label>
                    <input
                      type="number" step="0.5" min="1"
                      value={settings.hours_per_year}
                      onChange={(e) => setSettings({ ...settings, hours_per_year: e.target.value })}
                      className="w-full px-5 py-4 bg-white border border-gray-300 rounded-xl text-gray-900 text-2xl font-bold focus:ring-2 focus:ring-amber-400 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">
                    Weekly Off Days
                  </label>
                  <input
                    type="text"
                    value={settings.weekly_off}
                    onChange={(e) => setSettings({ ...settings, weekly_off: e.target.value })}
                    placeholder="e.g. Sunday or Saturday, Sunday"
                    className="w-full px-5 py-4 bg-white border border-gray-300 rounded-xl text-gray-900 text-lg font-medium focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none placeholder-gray-400"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Days when employees are not required to work. Separate multiple days with commas.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Office Start Time
                    </label>
                    <input
                      type="time"
                      value={settings.office_start_time}
                      onChange={(e) => setSettings({ ...settings, office_start_time: e.target.value })}
                      className="w-full px-5 py-4 bg-white border border-gray-300 rounded-xl text-gray-900 text-2xl font-bold focus:ring-2 focus:ring-amber-400 outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-2">Time when the office officially opens (used for Late/Early calc).</p>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Grace Period (Mins)
                    </label>
                    <input
                      type="number" step="1" min="0"
                      value={settings.grace_period_mins}
                      onChange={(e) => setSettings({ ...settings, grace_period_mins: e.target.value })}
                      className="w-full px-5 py-4 bg-white border border-gray-300 rounded-xl text-gray-900 text-2xl font-bold focus:ring-2 focus:ring-amber-400 outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-2">Minutes after start time before employee is marked late.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Warning Banner */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 mb-8 flex items-start gap-3">
          <svg className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="text-amber-800 font-bold text-sm">⚠️ This action affects the entire organization</p>
            <p className="text-amber-700/80 text-xs mt-1">
              Saving will immediately cascade the new settings to every employee record in the database.
              Only HR, Manager, or CEO-level users should make changes here.
            </p>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="w-full py-4 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-stone-900 font-bold text-lg rounded-2xl transition-all shadow-2xl shadow-amber-500/30 disabled:opacity-50 flex items-center justify-center gap-3 active:scale-[0.98]"
        >
          {isSaving ? (
            <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Saving to all employees...</>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save & Apply to All Employees
            </>
          )}
        </button>
        </>
        )}

        {/* CONSOLIDATED REPORT TAB */}
        {activeTab === 'consolidated' && (
          <div className="bg-white shadow-xl rounded-3xl p-6 border border-white/10 mb-8 text-gray-900">
            <h2 className="text-xl font-bold mb-4 text-indigo-900">📊 Consolidated Monthly Report</h2>
            <div className="flex flex-wrap gap-3 mb-6">
              <select value={reportMonth} onChange={e => setReportMonth(+e.target.value)} className="px-3 py-2 border rounded-lg text-sm bg-gray-50">
                {MONTH_NAMES.slice(1).map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
              <select value={reportYear} onChange={e => setReportYear(+e.target.value)} className="px-3 py-2 border rounded-lg text-sm bg-gray-50">
                {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <input type="text" placeholder="Search by name, role, designation, dept, or Employee ID..." value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm flex-1 min-w-[200px] bg-gray-50" />
              <button onClick={fetchConsolidated} className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-stone-900 rounded-lg text-sm font-bold hover:from-amber-600 hover:to-yellow-700 shadow-md shadow-amber-500/20">Load Report</button>
              <button onClick={() => handleExport('consolidated')} disabled={exportingType==='consolidated'} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-50 flex items-center gap-1">
                {exportingType==='consolidated' ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : '📥'} {t('export_excel')}
              </button>
            </div>
            {reportLoading ? <div className="text-center py-8"><Spinner size="lg" /></div>
            : consolidated ? (
              <div>
                <div className="mb-4 text-sm text-gray-600">
                  <span className="font-bold">{MONTH_NAMES[consolidated.month]} {consolidated.year}</span> • {consolidated.days_in_month} days • {consolidated.total_employees} employees
                  {consolidated.department_filter && <span> • Filter: <strong>{consolidated.department_filter}</strong></span>}
                </div>
                {consolidated.employees?.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">No employees found matching "{deptFilter}"</p>
                ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50"><tr>
                      {['Employee','Employee ID','Role','Designation','Days Present','Days Absent','Total Hours','Target Hours/Day','OT Hours','Less Hours','Total Late','Total Early'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">{h}</th>)}
                    </tr></thead>
                    <tbody className="divide-y divide-gray-200">
                      {consolidated.employees?.map((emp,i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2"><div className="font-medium text-indigo-600 cursor-pointer hover:underline" onClick={() => handleUserClick(emp.employee_id)}>{emp.name}</div></td>
                          <td className="px-3 py-2 font-mono text-xs text-gray-500">{emp.employee_id}</td>
                          <td className="px-3 py-2"><span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full text-xs font-bold">{emp.department}</span></td>
                          <td className="px-3 py-2 text-gray-600">{emp.designation || '-'}</td>
                          <td className="px-3 py-2 text-center"><span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-bold">{emp.days_present}</span></td>
                          <td className="px-3 py-2 text-center"><span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold">{emp.days_absent}</span></td>
                          <td className="px-3 py-2 text-center font-mono text-gray-700">{emp.total_hours}h</td>
                          <td className="px-3 py-2 text-center font-mono text-gray-700">{emp.target_hours}h</td>
                          <td className="px-3 py-2 text-center font-mono text-green-600 font-bold">{emp.overtime_hours > 0 ? `+${emp.overtime_hours}h` : '-'}</td>
                          <td className="px-3 py-2 text-center font-mono text-red-600 font-bold">{emp.deficit_hours > 0 ? `-${emp.deficit_hours}h` : '-'}</td>
                          <td className="px-3 py-2 text-center font-mono text-orange-600 font-bold">{emp.total_late || '-'}</td>
                          <td className="px-3 py-2 text-center font-mono text-teal-600 font-bold">{emp.total_early || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                )}
              </div>
            ) : <p className="text-center text-gray-400 py-8">Select month/year and click "Load Report"</p>}
          </div>
        )}

        {/* DETAILS REPORT TAB */}
        {activeTab === 'details' && (
          <div className="bg-white shadow-xl rounded-3xl p-6 border border-white/10 mb-8 text-gray-900">
            <h2 className="text-xl font-bold mb-4 text-indigo-900">📝 All Details</h2>
            <div className="flex flex-wrap gap-3 mb-6">
              <select value={reportMonth} onChange={e => setReportMonth(+e.target.value)} className="px-3 py-2 border rounded-lg text-sm bg-gray-50">
                {MONTH_NAMES.slice(1).map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
              <select value={reportYear} onChange={e => setReportYear(+e.target.value)} className="px-3 py-2 border rounded-lg text-sm bg-gray-50">
                {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <input type="text" placeholder="Search by name, role, designation, dept, or Employee ID..." value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm flex-1 min-w-[200px] bg-gray-50" />
              <button onClick={fetchDetails} className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-stone-900 rounded-lg text-sm font-bold hover:from-amber-600 hover:to-yellow-700 shadow-md shadow-amber-500/20">Load Report</button>
              <button onClick={() => handleExport('details')} disabled={exportingType==='details'} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-50 flex items-center gap-1">
                {exportingType==='details' ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : '📥'} {t('export_excel')}
              </button>
            </div>
            {reportLoading ? <div className="text-center py-8"><Spinner size="lg" /></div>
            : details ? (
              <div className="space-y-6">
                <p className="text-sm text-gray-600"><span className="font-bold">{MONTH_NAMES[details.month]} {details.year}</span> • {details.days_in_month} days{deptFilter && <span> • Filter: <strong>{deptFilter}</strong></span>}</p>
                {(() => {
                  const allEmps = details.employees || [];
                  const filterStr = deptFilter.trim().toLowerCase();
                  const filteredEmps = allEmps.filter(emp => {
                    if (!filterStr) return true;
                    return (
                      emp.name?.toLowerCase().includes(filterStr) ||
                      emp.employee_id?.toLowerCase().includes(filterStr) ||
                      emp.department?.toLowerCase().includes(filterStr) ||
                      (emp.designation && emp.designation.toLowerCase().includes(filterStr))
                    );
                  });

                  if (filteredEmps.length === 0) {
                    return <p className="text-center text-gray-400 py-8">No employees found matching "{deptFilter}"</p>;
                  }

                  const dateRows = filteredEmps[0]?.daily || [];

                  return (
                    <div className="overflow-x-auto border rounded-2xl shadow-sm max-h-[600px] overflow-y-auto">
                      <table className="min-w-full divide-y divide-stone-200 text-xs">
                        <thead className="bg-stone-900 text-amber-200 sticky top-0 z-20">
                          <tr>
                            <th className="px-3 py-3 text-left font-bold uppercase tracking-wider sticky left-0 bg-stone-900 z-30 border-r border-stone-800 min-w-[150px]">
                              Employee
                            </th>
                            {dateRows.map((row, j) => {
                              const dayNum = row.date?.split('-')[2] || (j + 1);
                              const shortDay = row.day?.slice(0, 3) || '';
                              return (
                                <th key={j} className="px-2 py-2 text-center font-bold uppercase tracking-wider whitespace-nowrap min-w-[50px] border-r border-stone-800">
                                  <div className="flex flex-col items-center">
                                    <span className="text-white font-black text-xs">{dayNum}</span>
                                    <span className="text-[9px] text-amber-400/70 font-mono font-medium">{shortDay}</span>
                                  </div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 bg-white">
                          {filteredEmps.map((emp, i) => (
                            <tr key={emp.employee_id || i} className="hover:bg-amber-50/20">
                              <td className="px-3 py-2.5 sticky left-0 bg-white z-10 border-r border-stone-100 shadow-sm whitespace-nowrap min-w-[150px]">
                                <div className="flex flex-col">
                                  <span className="font-bold text-gray-900 text-xs">{emp.name}</span>
                                  <span className="text-[9px] text-gray-400 font-mono">{emp.employee_id}</span>
                                </div>
                              </td>
                              {dateRows.map((_, j) => {
                                const dayData = emp.daily?.[j] || {};
                                const isPresent = dayData.status === 'Present' || dayData.status === 'In Office';
                                return (
                                  <td key={j} className="px-2 py-2.5 text-center border-r border-stone-100">
                                    {isPresent ? (
                                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-800 font-black text-[10px] shadow-sm ring-1 ring-green-600/10">P</span>
                                    ) : (
                                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-50 text-red-500 font-black text-[10px] shadow-sm ring-1 ring-red-500/10">A</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            ) : <p className="text-center text-gray-400 py-8">Select month/year and click "Load Report"</p>}
          </div>
        )}

        {/* ROLES MANAGEMENT TAB */}
        {activeTab === 'roles' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-8">
            <div className="bg-gray-50 border-b border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                🔑 Role Management
              </h2>
              <p className="text-gray-500 text-sm mt-1">Configure user roles, codes, and administrative privileges</p>
            </div>
            
            <div className="p-4 sm:p-6">
              {/* Controls */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6 items-center justify-between">
                <input
                  type="text"
                  placeholder="Search roles..."
                  value={rolesSearch}
                  onChange={(e) => setRolesSearch(e.target.value)}
                  className="w-full sm:max-w-xs px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                />
                
                {user?.role === 'admin' && (
                  <button
                    onClick={() => {
                      setEditingRole(null);
                      setRoleForm({ RoleCode: 'AUTO-GENERATED', Rolename: '', GantAdminPrevillage: false });
                      setIsRoleModalOpen(true);
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-stone-900 font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <span>➕ Add Role</span>
                  </button>
                )}
              </div>

              {rolesLoading ? (
                <div className="text-center py-12"><Spinner size="lg" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase font-bold">
                        <th className="px-4 py-3">Role Code</th>
                        <th className="px-4 py-3">Role Name</th>
                        <th className="px-4 py-3">Grant Admin Privilege</th>
                        <th className="px-4 py-3">Created By</th>
                        {user?.role === 'admin' && <th className="px-4 py-3 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {roles
                        .filter(r => 
                          r.RoleCode?.toLowerCase().includes(rolesSearch.toLowerCase()) || 
                          r.Rolename?.toLowerCase().includes(rolesSearch.toLowerCase())
                        )
                        .map(r => (
                          <tr key={r._id} className="hover:bg-gray-50 transition-all text-gray-700">
                            <td className="px-4 py-4 font-mono text-amber-600 font-bold">{r.RoleCode}</td>
                            <td className="px-4 py-4 font-medium">{r.Rolename}</td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                                r.GantAdminPrevillage 
                                  ? 'bg-green-100 text-green-700 border border-green-300' 
                                  : 'bg-gray-100 text-gray-500 border border-gray-200'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${r.GantAdminPrevillage ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                                {r.GantAdminPrevillage ? 'Yes (Admin Privilege)' : 'No (Standard)'}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-gray-400 text-xs">{r.CreatedBy || 'Admin'}</td>
                            {user?.role === 'admin' && (
                              <td className="px-4 py-4 text-right">
                                <div className="inline-flex gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingRole(r);
                                      setRoleForm({
                                        RoleCode: r.RoleCode,
                                        Rolename: r.Rolename,
                                        GantAdminPrevillage: !!r.GantAdminPrevillage
                                      });
                                      setIsRoleModalOpen(true);
                                    }}
                                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 rounded-lg text-xs font-bold transition-all active:scale-95"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleRoleDelete(r._id)}
                                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-300 rounded-lg text-xs font-bold transition-all active:scale-95"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      {roles.filter(r => 
                        r.RoleCode?.toLowerCase().includes(rolesSearch.toLowerCase()) || 
                        r.Rolename?.toLowerCase().includes(rolesSearch.toLowerCase())
                      ).length === 0 && (
                        <tr>
                          <td colSpan={user?.role === 'admin' ? 5 : 4} className="px-4 py-12 text-center text-gray-400">
                            No roles found matching the search criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* EMPLOYEE MANAGEMENT TAB */}
        {activeTab === 'employees' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-8">
            <div className="bg-gray-50 border-b border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                👥 {t('employee_mgmt')}
              </h2>
              <p className="text-gray-500 text-sm mt-1">Manage employee authentication requirements and roles</p>
            </div>
            <div className="p-4 sm:p-6">
              <div className="mb-4">
                <input type="text" placeholder="Search employees..." value={empSearch} onChange={e => setEmpSearch(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-amber-400 outline-none" />
              </div>
              {empLoading ? <div className="text-center py-8"><Spinner size="lg" /></div> : (
                <div>
                  {/* Desktop View Table */}
                  <div className="overflow-x-auto hidden lg:block">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase">Employee</th>
                          <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase">ID</th>
                          <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase">{t('skip_face')}</th>
                          <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase">{t('skip_location')}</th>
                          <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase">Account Status</th>
                          <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase">{t('role_label')}</th>
                          <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase">{t('action_label')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {employees
                          .filter(e => !empSearch || e.name?.toLowerCase().includes(empSearch.toLowerCase()) || e.employee_id?.toLowerCase().includes(empSearch.toLowerCase()) || e.email?.toLowerCase().includes(empSearch.toLowerCase()))
                          .map((emp, idx) => {
                            const realIdx = employees.findIndex(e => e._id === emp._id);
                            return (
                            <tr key={emp._id || idx} className="hover:bg-gray-50 transition-colors">
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-3">
                                  <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm ${emp.is_super_admin ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-400' : emp.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                                    {emp.name?.charAt(0)?.toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-900 cursor-pointer hover:text-amber-600 hover:underline transition-all" onClick={() => handleUserClick(emp._id)}>
                                      {emp.name} {emp.is_super_admin && <span className="ml-1 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">👑 {t('super_admin')}</span>}
                                    </div>
                                    <div className="text-xs text-gray-500">{emp.email} • {emp.profession || 'Employee'}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3 font-mono text-xs text-gray-500">{emp.employee_id}</td>
                              <td className="px-3 py-3 text-center">
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input type="checkbox" checked={emp.skip_face} onChange={() => handleEmpToggle(realIdx, 'skip_face')} className="sr-only peer" />
                                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                </label>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input type="checkbox" checked={emp.skip_location} onChange={() => handleEmpToggle(realIdx, 'skip_location')} className="sr-only peer" />
                                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                </label>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input type="checkbox" checked={emp.is_enabled} onChange={() => handleEmpToggle(realIdx, 'is_enabled')} className="sr-only peer" />
                                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                                </label>
                                <div className={`text-[10px] font-bold mt-1 ${emp.is_enabled ? 'text-blue-600' : 'text-gray-400'}`}>{emp.is_enabled ? 'ENABLED' : 'DISABLED'}</div>
                              </td>
                              <td className="px-3 py-3 text-center">
                                {emp.is_super_admin ? (
                                  <span className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold">Admin (Permanent)</span>
                                ) : (
                                  <select 
                                    value={emp.role} 
                                    onChange={e => handleEmpRole(realIdx, e.target.value)} 
                                    className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-gray-900 text-xs font-medium focus:ring-2 focus:ring-amber-400 outline-none"
                                  >
                                    <option value="user" className="bg-white">Employee</option>
                                    <option value="admin" className="bg-white">Admin</option>
                                    {roles.map(r => {
                                      const val = r.Rolename;
                                      if (val === 'admin' || val === 'user' || val === 'Employee' || val === 'Admin') return null;
                                      return (
                                        <option key={r._id} value={val} className="bg-white">
                                          {r.Rolename} ({r.RoleCode})
                                        </option>
                                      );
                                    })}
                                  </select>
                                )}
                              </td>
                              <td className="px-3 py-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  {/* Save Settings */}
                                  <div className="relative group inline-block">
                                    <button
                                      onClick={() => handleSaveEmployee(emp)}
                                      disabled={savingEmpId === emp._id}
                                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white border border-emerald-300 hover:border-emerald-500 shadow-sm hover:shadow-emerald-500/20 transition-all disabled:opacity-40"
                                      title="Save Settings"
                                    >
                                      {savingEmpId === emp._id ? (
                                        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                                      ) : (
                                        <span className="text-base">💾</span>
                                      )}
                                    </button>
                                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100 group-active:scale-100 group-active:opacity-100 transition-all duration-200 bg-gray-800 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shadow-xl border border-gray-700 whitespace-nowrap z-30">
                                      Save Settings
                                      <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-800"></span>
                                    </span>
                                  </div>

                                  {/* Reset Password */}
                                  <div className="relative group inline-block">
                                    <button
                                      onClick={() => handleResetPassword(emp._id, emp.name)}
                                      disabled={savingEmpId === emp._id}
                                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-indigo-50 hover:bg-indigo-500 text-indigo-600 hover:text-white border border-indigo-300 hover:border-indigo-500 shadow-sm hover:shadow-indigo-500/20 transition-all disabled:opacity-40"
                                      title="Reset Password"
                                    >
                                      <span className="text-base">🔑</span>
                                    </button>
                                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100 group-active:scale-100 group-active:opacity-100 transition-all duration-200 bg-gray-800 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shadow-xl border border-gray-700 whitespace-nowrap z-30">
                                      Reset Password
                                      <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-800"></span>
                                    </span>
                                  </div>

                                  {/* Delete Employee */}
                                  {!emp.is_super_admin && (
                                    <div className="relative group inline-block">
                                      <button
                                        onClick={() => handleDeleteEmployee(emp._id, emp.name)}
                                        disabled={savingEmpId === emp._id}
                                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-50 hover:bg-red-500 text-red-500 hover:text-white border border-red-300 hover:border-red-500 shadow-sm hover:shadow-red-500/20 transition-all disabled:opacity-40"
                                        title="Delete Employee"
                                      >
                                        <span className="text-base">🗑️</span>
                                      </button>
                                      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100 group-active:scale-100 group-active:opacity-100 transition-all duration-200 bg-gray-800 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shadow-xl border border-gray-700 whitespace-nowrap z-30">
                                        Delete Employee
                                        <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-800"></span>
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile & Tablet Card Layout */}
                  <div className="lg:hidden flex flex-col gap-4">
                    {employees
                      .filter(e => !empSearch || e.name?.toLowerCase().includes(empSearch.toLowerCase()) || e.employee_id?.toLowerCase().includes(empSearch.toLowerCase()) || e.email?.toLowerCase().includes(empSearch.toLowerCase()))
                      .map((emp, idx) => {
                        const realIdx = employees.findIndex(e => e._id === emp._id);
                        return (
                          <div 
                            key={emp._id || idx} 
                            className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col gap-4 transition-all hover:border-amber-300 hover:shadow-md"
                          >
                            {/* Card Header */}
                            <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
                              <div className="flex items-center gap-3">
                                <div className={`h-11 w-11 rounded-full flex items-center justify-center font-bold text-sm ${emp.is_super_admin ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-400' : emp.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                                  {emp.name?.charAt(0)?.toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-semibold text-gray-900 cursor-pointer hover:text-amber-600 hover:underline transition-all flex items-center gap-1.5" onClick={() => handleUserClick(emp._id)}>
                                    {emp.name} 
                                    {emp.is_super_admin && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">👑 {t('super_admin')}</span>}
                                  </div>
                                  <div className="text-xs text-gray-500 break-all">{emp.email}</div>
                                  <div className="text-[10px] text-gray-400 mt-0.5 font-mono">ID: {emp.employee_id || 'N/A'}</div>
                                </div>
                              </div>
                              <span className="text-xs text-amber-600 font-semibold px-2 py-0.5 bg-amber-50 rounded-lg border border-amber-200">
                                {emp.profession || 'Employee'}
                              </span>
                            </div>

                            {/* Card Body - Toggles & Config */}
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              {/* Skip Face Toggle */}
                              <div className="flex flex-col gap-1.5 p-3 bg-gray-50 rounded-xl border border-gray-200">
                                <span className="text-gray-600 font-medium">{t('skip_face')}</span>
                                <label className="relative inline-flex items-center cursor-pointer mt-1">
                                  <input type="checkbox" checked={emp.skip_face} onChange={() => handleEmpToggle(realIdx, 'skip_face')} className="sr-only peer" />
                                  <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                                </label>
                              </div>

                              {/* Skip Location Toggle */}
                              <div className="flex flex-col gap-1.5 p-3 bg-gray-50 rounded-xl border border-gray-200">
                                <span className="text-gray-600 font-medium">{t('skip_location')}</span>
                                <label className="relative inline-flex items-center cursor-pointer mt-1">
                                  <input type="checkbox" checked={emp.skip_location} onChange={() => handleEmpToggle(realIdx, 'skip_location')} className="sr-only peer" />
                                  <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                                </label>
                              </div>

                              {/* Account Status Toggle */}
                              <div className="flex flex-col gap-1.5 p-3 bg-gray-50 rounded-xl border border-gray-200">
                                <span className="text-gray-600 font-medium">Status</span>
                                <div className="flex items-center justify-between gap-2 mt-1">
                                  <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={emp.is_enabled} onChange={() => handleEmpToggle(realIdx, 'is_enabled')} className="sr-only peer" />
                                    <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                                  </label>
                                  <span className={`text-[9px] font-bold ${emp.is_enabled ? 'text-blue-600' : 'text-gray-400'}`}>
                                    {emp.is_enabled ? 'ENABLED' : 'DISABLED'}
                                  </span>
                                </div>
                              </div>

                              {/* Role Selector */}
                              <div className="flex flex-col gap-1.5 p-3 bg-gray-50 rounded-xl border border-gray-200">
                                <span className="text-gray-600 font-medium">{t('role_label')}</span>
                                {emp.is_super_admin ? (
                                  <span className="text-[10px] text-amber-700 font-bold mt-1.5">Super Admin</span>
                                ) : (
                                  <select 
                                    value={emp.role} 
                                    onChange={e => handleEmpRole(realIdx, e.target.value)} 
                                    className="w-full mt-0.5 px-2 py-1 bg-white border border-gray-300 rounded-lg text-gray-900 text-xs font-medium focus:ring-1 focus:ring-amber-400 outline-none"
                                  >
                                    <option value="user">Employee</option>
                                    <option value="admin">Admin</option>
                                    {roles.map(r => {
                                      const val = r.Rolename;
                                      if (val === 'admin' || val === 'user' || val === 'Employee' || val === 'Admin') return null;
                                      return (
                                        <option key={r._id} value={val}>
                                          {r.Rolename} ({r.RoleCode})
                                        </option>
                                      );
                                    })}
                                  </select>
                                )}
                              </div>
                            </div>

                            {/* Card Footer - Action Buttons */}
                            <div className="flex items-center justify-center gap-4 border-t border-gray-100 pt-3 mt-1">
                              {/* Save Settings */}
                              <div className="relative group inline-block">
                                <button
                                  onClick={() => handleSaveEmployee(emp)}
                                  disabled={savingEmpId === emp._id}
                                  className="w-11 h-11 flex items-center justify-center rounded-xl bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white border border-emerald-300 hover:border-emerald-500 shadow-sm hover:shadow-emerald-500/20 transition-all disabled:opacity-40"
                                  title="Save Settings"
                                >
                                  {savingEmpId === emp._id ? (
                                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                                  ) : (
                                    <span className="text-base">💾</span>
                                  )}
                                </button>
                                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100 group-active:scale-100 group-active:opacity-100 transition-all duration-200 bg-gray-800 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shadow-xl border border-gray-700 whitespace-nowrap z-30">
                                  Save Settings
                                  <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-800"></span>
                                </span>
                              </div>

                              {/* Reset Password */}
                              <div className="relative group inline-block">
                                <button
                                  onClick={() => handleResetPassword(emp._id, emp.name)}
                                  disabled={savingEmpId === emp._id}
                                  className="w-11 h-11 flex items-center justify-center rounded-xl bg-indigo-50 hover:bg-indigo-500 text-indigo-600 hover:text-white border border-indigo-300 hover:border-indigo-500 shadow-sm hover:shadow-indigo-500/20 transition-all disabled:opacity-40"
                                  title="Reset Password"
                                >
                                  <span className="text-base">🔑</span>
                                </button>
                                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100 group-active:scale-100 group-active:opacity-100 transition-all duration-200 bg-gray-800 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shadow-xl border border-gray-700 whitespace-nowrap z-30">
                                  Reset Password
                                  <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-800"></span>
                                </span>
                              </div>

                              {/* Delete Employee */}
                              {!emp.is_super_admin && (
                                <div className="relative group inline-block">
                                  <button
                                    onClick={() => handleDeleteEmployee(emp._id, emp.name)}
                                    disabled={savingEmpId === emp._id}
                                    className="w-11 h-11 flex items-center justify-center rounded-xl bg-red-50 hover:bg-red-500 text-red-500 hover:text-white border border-red-300 hover:border-red-500 shadow-sm hover:shadow-red-500/20 transition-all disabled:opacity-40"
                                    title="Delete Employee"
                                  >
                                    <span className="text-base">🗑️</span>
                                  </button>
                                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100 group-active:scale-100 group-active:opacity-100 transition-all duration-200 bg-gray-800 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shadow-xl border border-gray-700 whitespace-nowrap z-30">
                                    Delete Employee
                                    <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-800"></span>
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* DAILY OPERATIONAL STATUS MONITOR TAB */}
        {activeTab === 'daily_status' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8 mb-8 text-gray-900">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <h2 className="text-2xl font-bold text-amber-600 flex items-center gap-2">
                  📅 Daily Operational Status
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  Real-time login, logout, and location tracking for all employees
                </p>
              </div>

              {/* Date Selector and Navigation */}
              <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-200 self-start sm:self-auto">
                <button
                  onClick={() => {
                    const prev = new Date(dailyStatusDate);
                    prev.setDate(prev.getDate() - 1);
                    setDailyStatusDate(prev.toLocaleDateString('en-CA'));
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg text-amber-600 transition-colors"
                  title="Yesterday"
                >
                  ⬅️
                </button>
                <input
                  type="date"
                  value={dailyStatusDate}
                  onChange={(e) => setDailyStatusDate(e.target.value)}
                  className="bg-transparent text-gray-900 font-bold outline-none text-sm px-2 cursor-pointer"
                />
                <button
                  onClick={() => {
                    const next = new Date(dailyStatusDate);
                    next.setDate(next.getDate() + 1);
                    setDailyStatusDate(next.toLocaleDateString('en-CA'));
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg text-amber-600 transition-colors"
                  title="Tomorrow"
                >
                  ➡️
                </button>
                <button
                  onClick={() => setDailyStatusDate(new Date().toLocaleDateString('en-CA'))}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-stone-900 font-bold text-xs rounded-md transition-colors"
                >
                  Today
                </button>
              </div>
            </div>

            {/* Quick Metrics Widget */}
            {!dailyStatusLoading && dailyStatusData.length > 0 && (() => {
              const present = dailyStatusData.filter(d => ['In Office', 'Left Office'].includes(d.status)).length;
              const notLoggedIn = dailyStatusData.filter(d => d.status === 'Not Logged In').length;
              const absent = dailyStatusData.filter(d => d.status === 'Absent').length;
              const weeklyOff = dailyStatusData.filter(d => d.status === 'Weekly Off').length;

              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                    <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600">{present}</p>
                    <p className="text-xs text-emerald-500 mt-1 uppercase tracking-wider font-bold">Present</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
                    <p className="text-2xl sm:text-3xl font-extrabold text-amber-600">{notLoggedIn}</p>
                    <p className="text-xs text-amber-500 mt-1 uppercase tracking-wider font-bold">Not Logged In</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
                    <p className="text-2xl sm:text-3xl font-extrabold text-red-600">{absent}</p>
                    <p className="text-xs text-red-500 mt-1 uppercase tracking-wider font-bold">Absent</p>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-center">
                    <p className="text-2xl sm:text-3xl font-extrabold text-purple-600">{weeklyOff}</p>
                    <p className="text-xs text-purple-500 mt-1 uppercase tracking-wider font-bold">Weekly Off</p>
                  </div>
                </div>
              );
            })()}

            {/* Local Filter Box */}
            <div className="mb-6">
              <input
                type="text"
                placeholder="Search employees by name, designation, status or Employee ID..."
                value={dailySearchQuery}
                onChange={(e) => setDailySearchQuery(e.target.value)}
                className="w-full px-5 py-4 bg-white border border-gray-300 rounded-2xl text-gray-900 font-medium focus:ring-2 focus:ring-amber-400 outline-none"
              />
            </div>

            {/* List & Cards */}
            {dailyStatusLoading ? (
              <div className="text-center py-16">
                <Spinner size="lg" />
                <p className="text-gray-500 text-sm mt-3 animate-pulse">Loading daily operational status...</p>
              </div>
            ) : dailyStatusData.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-200">
                <span className="text-4xl block mb-2">📁</span>
                <p className="text-gray-400">No operational records found for this date.</p>
              </div>
            ) : (() => {
              const filtered = dailyStatusData.filter(d => 
                d.employee_name.toLowerCase().includes(dailySearchQuery.toLowerCase()) ||
                d.profession.toLowerCase().includes(dailySearchQuery.toLowerCase()) ||
                d.status.toLowerCase().includes(dailySearchQuery.toLowerCase()) ||
                d.employee_id.toLowerCase().includes(dailySearchQuery.toLowerCase())
              );

              if (filtered.length === 0) {
                return (
                  <p className="text-center text-gray-400 py-8">
                    No results matching "{dailySearchQuery}"
                  </p>
                );
              }

              return (
                <div className="space-y-4">
                  {filtered.map((item, idx) => {
                    const isPresent = ['In Office', 'Left Office'].includes(item.status);
                    
                    // Status Badge Coloring
                    let badgeColor = "bg-gray-100 text-gray-600 border-gray-300";
                    if (item.status === 'In Office') badgeColor = "bg-emerald-100 text-emerald-700 border-emerald-300";
                    else if (item.status === 'Left Office') badgeColor = "bg-teal-100 text-teal-700 border-teal-300";
                    else if (item.status === 'Absent') badgeColor = "bg-red-100 text-red-700 border-red-300";
                    else if (item.status === 'Weekly Off') badgeColor = "bg-purple-100 text-purple-700 border-purple-300";
                    else if (item.status === 'Not Logged In') badgeColor = "bg-amber-100 text-amber-700 border-amber-300";

                    const formatLocation = (loc) => {
                      if (!loc) return null;
                      if (typeof loc === 'string') return loc;
                      const addr = loc.display_name || loc.address || loc.road || (loc.area ? `${loc.area}, ${loc.city}` : null);
                      if (addr) return addr;
                      if (loc.latitude && loc.longitude) {
                        return `${Number(loc.latitude).toFixed(4)}, ${Number(loc.longitude).toFixed(4)}`;
                      }
                      return null;
                    };

                    const getMapUrl = (loc) => {
                      if (!loc || !loc.latitude || !loc.longitude) return null;
                      return `https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`;
                    };

                    const formatTimeStr = (isoStr) => {
                      if (!isoStr) return '';
                      try {
                        const d = new Date(isoStr);
                        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                      } catch {
                        return isoStr;
                      }
                    };

                    return (
                      <div
                        key={idx}
                        className="bg-gray-50 border border-gray-200 rounded-2xl p-5 hover:bg-white hover:shadow-md transition-all hover:scale-[1.01]"
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          {/* User info */}
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-amber-50 border border-amber-200 text-amber-600 rounded-full flex items-center justify-center shrink-0 font-bold">
                              {item.employee_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-gray-900 cursor-pointer hover:underline" onClick={() => handleUserClick(item.employee_id)}>
                                  {item.employee_name}
                                </h3>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeColor}`}>
                                  {item.status}
                                </span>
                              </div>
                              <p className="text-gray-500 text-xs mt-0.5">
                                {item.profession || 'Employee'} • ID: <span className="font-mono">{item.employee_id}</span>
                              </p>
                            </div>
                          </div>

                          {/* Hours display */}
                          {isPresent && item.worked_hours !== null && (
                            <div className="self-start md:self-auto text-right">
                              <span className="text-xs text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full font-bold border border-indigo-200">
                                ⏱️ {item.worked_hours} Hours Worked
                              </span>
                            </div>
                          )}
                        </div>

                        {/* 3-Section Panel: Login, Logout, Location Boundary */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
                          
                          {/* 1. Login Details Section */}
                          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col justify-between min-h-[140px]">
                            <div>
                              <p className="text-xs text-amber-600 font-bold flex items-center gap-1.5 uppercase tracking-wider mb-2">
                                <span className={`w-2 h-2 rounded-full ${item.punch_in ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                                Login Section
                              </p>
                              {item.punch_in ? (
                                <>
                                  <p className="text-sm font-bold text-gray-900 mb-1">
                                    ⏱️ {formatTimeStr(item.punch_in)}
                                  </p>
                                  {item.login_location ? (
                                    <p className="text-xs text-gray-600 line-clamp-3" title={formatLocation(item.login_location)}>
                                      📍 {formatLocation(item.login_location)}
                                    </p>
                                  ) : (
                                    <p className="text-xs text-gray-500 italic">No GPS coordinates recorded</p>
                                  )}
                                </>
                              ) : (
                                <p className="text-xs text-gray-500 italic mt-2">Waiting for employee check-in...</p>
                              )}
                            </div>
                            {item.punch_in && item.login_location && (
                              <div className="mt-3 pt-2 border-t border-gray-200">
                                <a
                                  href={getMapUrl(item.login_location)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-amber-600 font-bold transition-colors hover:underline"
                                >
                                  🗺️ View Login Location Map
                                </a>
                              </div>
                            )}
                          </div>

                          {/* 2. Logout Details Section */}
                          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col justify-between min-h-[140px]">
                            <div>
                              <p className="text-xs text-indigo-600 font-bold flex items-center gap-1.5 uppercase tracking-wider mb-2">
                                <span className={`w-2 h-2 rounded-full ${item.punch_out ? 'bg-teal-500' : item.punch_in ? 'bg-amber-500 animate-pulse' : 'bg-gray-400'}`}></span>
                                Logout Section
                              </p>
                              {item.punch_in ? (
                                item.punch_out ? (
                                  <>
                                    <p className="text-sm font-bold text-gray-900 mb-1">
                                      ⏱️ {formatTimeStr(item.punch_out)}
                                    </p>
                                    {item.logout_location ? (
                                      <p className="text-xs text-gray-300 line-clamp-3" title={formatLocation(item.logout_location)}>
                                        📍 {formatLocation(item.logout_location)}
                                      </p>
                                    ) : (
                                      <p className="text-xs text-gray-500 italic">No GPS coordinates recorded</p>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <p className="text-sm font-bold text-amber-600 mb-1 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping"></span>
                                      Active Session
                                    </p>
                                    <p className="text-xs text-gray-500 italic font-medium">Employee is currently clocked in</p>
                                  </>
                                )
                              ) : (
                                <p className="text-xs text-gray-500 italic mt-2">Waiting for employee check-in...</p>
                              )}
                            </div>
                            {item.punch_out && item.logout_location && (
                              <div className="mt-3 pt-2 border-t border-gray-200">
                                <a
                                  href={getMapUrl(item.logout_location)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-amber-600 font-bold transition-colors hover:underline"
                                >
                                  🗺️ View Logout Location Map
                                </a>
                              </div>
                            )}
                          </div>

                          {/* 3. GPS Boundary Verification Section */}
                          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col justify-between min-h-[140px]">
                            <div>
                              <p className="text-xs text-amber-600 font-bold flex items-center gap-1.5 uppercase tracking-wider mb-2">
                                🛡️ Location boundary Match
                              </p>
                              
                              {/* Registered Office Coordinates */}
                              <div className="mb-2">
                                <span className="text-[10px] uppercase text-gray-500 font-bold block">Registered Office</span>
                                {item.registered_location ? (
                                  <span className="text-xs font-semibold text-amber-700">
                                    🌐 {Number(item.registered_location.latitude).toFixed(5)}, {Number(item.registered_location.longitude).toFixed(5)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-red-500 font-bold block">🌐 GPS Not Registered</span>
                                )}
                              </div>

                              {/* Distance/Boundary Verification Badge */}
                              {item.punch_in && (
                                <div className="mt-1">
                                  {(() => {
                                    const reg = item.registered_location;
                                    const live = item.login_location;
                                    if (!reg || !live || !reg.latitude || !live.latitude) {
                                      return <span className="text-[10px] bg-white/70 text-gray-500 px-2 py-0.5 rounded font-mono font-bold border border-gray-200">No Range Data</span>;
                                    }
                                    const toRad = (d) => (d * Math.PI) / 180;
                                    const R = 6371000;
                                    const dLat = toRad(live.latitude - reg.latitude);
                                    const dLon = toRad(live.longitude - reg.longitude);
                                    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(reg.latitude)) * Math.cos(toRad(live.latitude)) * Math.sin(dLon / 2) ** 2;
                                    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                                    const isOk = dist <= 500;

                                    return (
                                      <div className="space-y-1">
                                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${isOk ? 'bg-green-50 text-green-700 border-green-300' : 'bg-red-50 text-red-700 border-red-300'}`}>
                                          {isOk ? '✓ Match (Within Range)' : '✗ Location Mismatch'}
                                        </span>
                                        <p className="text-[11px] text-gray-600 font-mono mt-0.5">
                                          Distance: <strong className="text-gray-900">{dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(2)}km`}</strong>
                                        </p>
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                            
                            {item.registered_location && (
                              <div className="mt-3 pt-2 border-t border-gray-200">
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${item.registered_location.latitude},${item.registered_location.longitude}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-amber-600 font-bold transition-colors hover:underline"
                                >
                                  🗺️ View Office Boundary Map
                                </a>
                              </div>
                            )}
                          </div>
                          
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* INDIVIDUAL DETAILS REPORT TAB */}
        {activeTab === 'individual_details' && (
          <div className="bg-white shadow-xl rounded-3xl p-6 border border-white/10 mb-8 text-gray-900 animate-fadeIn">
            <h2 className="text-xl font-bold mb-4 text-indigo-900 flex items-center gap-2">👤 Individual Details</h2>
            <div className="flex flex-wrap gap-3 mb-6">
              <select value={reportMonth} onChange={e => setReportMonth(+e.target.value)} className="px-3 py-2 border rounded-lg text-sm bg-gray-50">
                {MONTH_NAMES.slice(1).map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
              <select value={reportYear} onChange={e => setReportYear(+e.target.value)} className="px-3 py-2 border rounded-lg text-sm bg-gray-50">
                {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <button onClick={fetchDetails} className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-stone-900 rounded-lg text-sm font-bold hover:from-amber-600 hover:to-yellow-700 shadow-md shadow-amber-500/20">Load Report</button>
              <button onClick={() => handleExport('details', user?.employee_id)} disabled={exportingType==='details'} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-50 flex items-center gap-1 shadow-md">
                {exportingType==='details' ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : '📥'} {t('export_excel')}
              </button>
            </div>
            {reportLoading ? <div className="text-center py-8"><Spinner size="lg" /></div>
            : details ? (
              <div className="space-y-6">
                <p className="text-sm text-gray-600"><span className="font-bold">{MONTH_NAMES[details.month]} {details.year}</span> • {details.days_in_month} days</p>
                {(() => {
                  const allEmps = details.employees || [];
                  const myEmps = allEmps.filter(emp => emp.employee_id === user?.employee_id || emp.name === user?.name);

                  if (myEmps.length === 0) {
                    return <p className="text-center text-gray-400 py-8">Your employee record was not found in the monthly data.</p>;
                  }

                  const dateRows = myEmps[0]?.daily || [];

                  return (
                    <div className="overflow-x-auto border rounded-2xl shadow-sm max-w-4xl mx-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-stone-900 text-amber-200 sticky top-0 z-20">
                          <tr>
                            <th className="px-3 py-3 text-left font-bold uppercase tracking-wider sticky left-0 bg-stone-900 z-30 border-r border-stone-800 min-w-[150px]">
                              Employee
                            </th>
                            {dateRows.map((row, j) => {
                              const dayNum = row.date?.split('-')[2] || (j + 1);
                              const shortDay = row.day?.slice(0, 3) || '';
                              return (
                                <th key={j} className="px-2 py-2 text-center font-bold uppercase tracking-wider whitespace-nowrap min-w-[50px] border-r border-stone-800">
                                  <div className="flex flex-col items-center">
                                    <span className="text-white font-black text-xs">{dayNum}</span>
                                    <span className="text-[9px] text-amber-400/70 font-mono font-medium">{shortDay}</span>
                                  </div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {myEmps.map((emp, i) => (
                            <tr key={emp.employee_id || i} className="hover:bg-amber-50/20">
                              <td className="px-3 py-2.5 sticky left-0 bg-white z-10 border-r shadow-sm whitespace-nowrap min-w-[150px]">
                                <div className="flex flex-col">
                                  <span className="font-bold text-gray-900 text-xs">{emp.name}</span>
                                  <span className="text-[9px] text-gray-400 font-mono">{emp.employee_id}</span>
                                </div>
                              </td>
                              {dateRows.map((_, j) => {
                                const dayData = emp.daily?.[j] || {};
                                const isPresent = dayData.status === 'Present' || dayData.status === 'In Office';
                                return (
                                  <td key={j} className="px-2 py-2.5 text-center border-r">
                                    {isPresent ? (
                                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-800 font-black text-[10px] shadow-sm ring-1 ring-green-600/10">P</span>
                                    ) : (
                                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-50 text-red-500 font-black text-[10px] shadow-sm ring-1 ring-red-500/10">A</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            ) : <p className="text-center text-gray-400 py-8">Select month/year and click "Load Report"</p>}
          </div>
        )}

      {/* Dashboard Modal */}
      {selectedUserDashboard && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-gray-200 rounded-3xl shadow-2xl p-8 w-full max-w-2xl relative overflow-y-auto max-h-[90vh]">
            <button onClick={() => setSelectedUserDashboard(null)} className="absolute top-6 right-6 text-gray-500 hover:text-gray-900 bg-gray-100 rounded-full p-1 transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            
            <div className="flex flex-col sm:flex-row items-center gap-6 mb-8 pb-6 border-b border-gray-200">
              <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-full flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                <span className="text-3xl font-bold text-white">{selectedUserDashboard.name?.charAt(0)?.toUpperCase() || 'U'}</span>
              </div>
              <div className="text-center sm:text-left flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-1">{selectedUserDashboard.name}</h2>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <p className="text-gray-500">{selectedUserDashboard.designation || selectedUserDashboard.profession || 'Employee'}</p>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    {selectedUserDashboard.liveness_verified ? 'Face Verified' : 'No Face Data'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Email</p>
                <p className="text-gray-900 font-medium break-all">{selectedUserDashboard.email || 'N/A'}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Phone</p>
                <p className="text-gray-900 font-medium">{selectedUserDashboard.phone || 'N/A'}</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                <p className="text-xs text-amber-600 uppercase tracking-wider mb-1">Employee ID</p>
                <p className="text-amber-700 font-bold">{selectedUserDashboard.employee_id || 'N/A'}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Joining Date</p>
                <p className="text-gray-900 font-medium">{selectedUserDashboard.joining_date || 'N/A'}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Hours / Day</p>
                <p className="text-gray-900 font-medium">{selectedUserDashboard.hours_per_day || 8} hours</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Weekly Off</p>
                <p className="text-gray-900 font-medium">{selectedUserDashboard.weekly_off || 'Sunday'}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Account Role</p>
                <p className="text-gray-900 font-medium capitalize bg-amber-100 text-amber-700 px-2 py-0.5 rounded inline-block">
                  {selectedUserDashboard.role || 'user'}
                </p>
              </div>
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                <p className="text-xs text-amber-600 uppercase tracking-wider mb-1">Employee Password</p>
                <p className="text-gray-900 font-bold tracking-wider">{selectedUserDashboard.plain_password || 'N/A'}</p>
              </div>
            </div>

            {/* 🏥 Insurance Details Section (Admin-Editable) */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-bold text-amber-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                🏥 Insurance Information (Admin Control)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col">
                  <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">Insurance ID</label>
                  <input
                    type="text"
                    value={modalInsuranceId}
                    onChange={(e) => setModalInsuranceId(e.target.value)}
                    placeholder="e.g. INS-982312"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                  />
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col">
                  <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">Insurance Provider</label>
                  <input
                    type="text"
                    value={modalInsuranceProvider}
                    onChange={(e) => setModalInsuranceProvider(e.target.value)}
                    placeholder="e.g. MetLife / BlueCross"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                  />
                </div>
              </div>
              <button
                onClick={handleSaveModalInsurance}
                disabled={modalSaving}
                className="w-full mt-4 py-3 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-stone-900 font-bold rounded-xl transition-all shadow-lg shadow-amber-500/10 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
              >
                {modalSaving ? (
                  <><span className="w-4 h-4 border-2 border-stone-900 border-t-transparent rounded-full animate-spin"></span> Saving Insurance Details...</>
                ) : (
                  <>💾 Save Insurance Details</>
                )}
              </button>
            </div>

            {/* 🗂️ Document Upload & Retrieval Section */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-bold text-amber-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                🗂️ Government ID & Insurance Documents (Admin Only)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                
                {/* 1. Government ID Upload / Download */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col justify-between min-h-[140px]">
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold block">Government ID Card</label>
                    {selectedUserDashboard.govt_id_filename ? (
                      <div className="flex items-center gap-2 mb-3 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                        <span className="text-amber-600 text-sm">📄</span>
                        <span className="text-gray-700 text-xs truncate max-w-[200px]" title={selectedUserDashboard.govt_id_filename}>
                          {selectedUserDashboard.govt_id_filename}
                        </span>
                      </div>
                    ) : (
                      <p className="text-stone-500 text-xs italic mb-4">⚠️ No Government ID uploaded yet</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 mt-auto">
                    {selectedUserDashboard.govt_id_filename && (
                      <button
                        onClick={() => handleDocumentDownload('govt_id', selectedUserDashboard.govt_id_filename)}
                        className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95"
                      >
                        📥 Download Govt ID
                      </button>
                    )}
                    
                    <label className="w-full py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 hover:border-gray-400 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 text-center">
                      {govtUploading ? (
                        <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Uploading...</>
                      ) : (
                        <>📤 {selectedUserDashboard.govt_id_filename ? 'Replace' : 'Upload'} Govt ID</>
                      )}
                      <input
                        type="file"
                        onChange={(e) => handleDocumentUpload(e, 'govt_id')}
                        disabled={govtUploading}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* 2. Insurance Document Upload / Download */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col justify-between min-h-[140px]">
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold block">Insurance Policy Doc</label>
                    {selectedUserDashboard.insurance_filename ? (
                      <div className="flex items-center gap-2 mb-3 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                        <span className="text-amber-600 text-sm">📄</span>
                        <span className="text-gray-700 text-xs truncate max-w-[200px]" title={selectedUserDashboard.insurance_filename}>
                          {selectedUserDashboard.insurance_filename}
                        </span>
                      </div>
                    ) : (
                      <p className="text-stone-500 text-xs italic mb-4">⚠️ No Insurance Document uploaded yet</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 mt-auto">
                    {selectedUserDashboard.insurance_filename && (
                      <button
                        onClick={() => handleDocumentDownload('insurance', selectedUserDashboard.insurance_filename)}
                        className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95"
                      >
                        📥 Download Policy
                      </button>
                    )}
                    
                    <label className="w-full py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 hover:border-gray-400 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 text-center">
                      {insUploading ? (
                        <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Uploading...</>
                      ) : (
                        <>📤 {selectedUserDashboard.insurance_filename ? 'Replace' : 'Upload'} Policy</>
                      )}
                      <input
                        type="file"
                        onChange={(e) => handleDocumentUpload(e, 'insurance')}
                        disabled={insUploading}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* Roles Modal */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-gray-200 rounded-3xl shadow-2xl p-8 w-full max-w-md relative overflow-y-auto max-h-[90vh]">
            <button
              onClick={() => setIsRoleModalOpen(false)}
              className="absolute top-6 right-6 text-gray-500 hover:text-gray-900 bg-gray-100 rounded-full p-1 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              🔑 {editingRole ? 'Edit Role' : 'Add New Role'}
            </h3>

            <form onSubmit={handleRoleSubmit} className="space-y-5 text-gray-900">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Role Code *</label>
                <input
                  type="text"
                  required
                  value={editingRole ? roleForm.RoleCode : 'AUTO-GENERATED'}
                  className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-xl text-gray-500 focus:ring-2 focus:ring-amber-500 outline-none transition-all cursor-not-allowed"
                  disabled={true}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Role Name *</label>
                <input
                  type="text"
                  required
                  value={roleForm.Rolename}
                  onChange={(e) => setRoleForm({ ...roleForm, Rolename: e.target.value })}
                  placeholder="e.g. Sales Manager"
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Grant Admin Privilege</label>
                    <p className="text-xs text-gray-500">Gives administrative read/write settings rights</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={roleForm.GantAdminPrevillage}
                      onChange={(e) => setRoleForm({ ...roleForm, GantAdminPrevillage: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-xl text-gray-700 font-bold transition-all active:scale-95 text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-stone-900 font-bold rounded-xl shadow-lg transition-all active:scale-95 text-center"
                >
                  {editingRole ? 'Save Changes' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
