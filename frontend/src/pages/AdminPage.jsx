import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { loginWithPassword, getProfile, getCompanySettings, updateCompanySettings, getConsolidatedReport, getDetailsReport, getAdminEmployees, updateEmployeeSettings, deleteEmployee, exportAttendanceExcel, resetEmployeePassword, getDailyStatus, uploadEmployeeDocument, downloadEmployeeDocument, getRoles, createRole, updateRole, deleteRole, getClasses, createClass, deleteClass, getSubjects, createSubject, deleteSubject, getMappings, createMapping, deleteMapping, addTeacher, getTimetables, createTimetableEntry, updateTimetableEntry, deleteTimetableEntry } from '../services/authService';
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
    grace_period_mins: 30,
    boardsList: ['CBSE', 'STATE', 'ICSE'],
    standardsList: ['Nursery', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th']
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState('settings');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [window.location.search]);
  // Reports
  const [consolidated, setConsolidated] = useState(null);
  const [details, setDetails] = useState(null);
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [deptFilter, setDeptFilter] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  // Employee Management
  const [employees, setEmployees] = useState([]);
  const [originalEmployees, setOriginalEmployees] = useState([]);
  const [isSavingBulk, setIsSavingBulk] = useState(false);
  const [empLoading, setEmpLoading] = useState(false);
  const [empSearch, setEmpSearch] = useState('');
  const [savingEmpId, setSavingEmpId] = useState(null);
  const [exportingType, setExportingType] = useState(null);
  const [selectedUserDashboard, setSelectedUserDashboard] = useState(null);

  // Add/Edit Faculty Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddingFaculty, setIsAddingFaculty] = useState(false);
  const [addForm, setAddForm] = useState({
    employeeId: '',
    name: '',
    email: '',
    phone: '',
    qualification: '',
    experience: 0,
    status: 'Active',
    createLogin: true,
    password: '',
    role: 'teacher'
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingFaculty, setIsSavingFaculty] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    qualification: '',
    experience: 0,
    status: 'Active',
    role: 'teacher',
    skip_face: false,
    skip_location: false,
    isActive: true
  });

  // Class Management States
  const [classes, setClasses] = useState([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [isSavingClass, setIsSavingClass] = useState(false);
  const [classStandard, setClassStandard] = useState('1st');
  const [classSection, setClassSection] = useState('A');
  const [classBoard, setClassBoard] = useState('CBSE');
  const [classTeacherId, setClassTeacherId] = useState('');
  const [classStrength, setClassStrength] = useState(0);

  // Subject Management States
  const [subjects, setSubjects] = useState([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [isSavingSubject, setIsSavingSubject] = useState(false);
  const [subjectName, setSubjectName] = useState('');

  // Mapping Management States
  const [mappings, setMappings] = useState([]);
  const [mappingsLoading, setMappingsLoading] = useState(false);
  const [isSavingMapping, setIsSavingMapping] = useState(false);
  const [mapTeacherId, setMapTeacherId] = useState('');
  const [mapClassId, setMapClassId] = useState('');
  const [mapSubjectId, setMapSubjectId] = useState('');

  // Timetable Management States
  const [timetableEntries, setTimetableEntries] = useState([]);
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [isSavingTimetable, setIsSavingTimetable] = useState(false);
  const [isTimetableModalOpen, setIsTimetableModalOpen] = useState(false);
  const [editingTimetableEntry, setEditingTimetableEntry] = useState(null);
  const [selectedTimetableClass, setSelectedTimetableClass] = useState('All');
  const [timetableViewMode, setTimetableViewMode] = useState('weekly_grid'); // 'weekly_grid' or 'class_grid' or 'list'
  const [timetableForm, setTimetableForm] = useState({
    classId: '',
    day: 'Monday',
    period: 1,
    startTime: '09:00',
    endTime: '09:45',
    teacherId: '',
    subjectId: ''
  });

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

  const processEmployeeData = useCallback((data) => {
    if (!data) return [];
    let rawList = [];
    if (Array.isArray(data)) {
      rawList = data;
    } else if (data.teachers && Array.isArray(data.teachers)) {
      rawList = data.teachers;
    } else if (data.employees && Array.isArray(data.employees)) {
      rawList = data.employees;
    }
    return rawList.map(t => ({
      _id: t._id,
      employeeId: t.employeeId || t.employee_id || '',
      employee_id: t.employeeId || t.employee_id || '',
      name: t.name || '',
      email: t.email || '',
      phone: t.phone || '',
      qualification: t.qualification || 'N/A',
      experience: t.experience || 0,
      status: t.status || 'Active',
      skip_face: t.skip_face !== undefined ? t.skip_face : (t.user?.skip_face || false),
      skip_location: t.skip_location !== undefined ? t.skip_location : (t.user?.skip_location || false),
      is_enabled: t.is_enabled !== undefined ? t.is_enabled : (t.user?.isActive !== false),
      role: t.role || (t.user?.role || 'teacher'),
      is_super_admin: t.is_super_admin || t.user?.role === 'super_admin' || t.user?.role === 'admin (permanent)' || t.email?.toLowerCase() === 'rajabhaxa@gmail.com',
      user: t.user
    }));
  }, []);

  const handleUserClick = async (db_id) => {
    let empList = employees;
    if (!empList || empList.length === 0) {
      try {
        const res = await getAdminEmployees();
        empList = processEmployeeData(res?.data);
        setEmployees(empList);
        setOriginalEmployees(JSON.parse(JSON.stringify(empList)));
      } catch (err) {
        toast.error('Failed to load user details');
        return;
      }
    }
    const fullEmp = empList.find(e => e._id === db_id || e.employeeId === db_id || e.employee_id === db_id || e.name === db_id);
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
      if (res?.data) {
        const processed = processEmployeeData(res.data);
        setEmployees(processed);
        setOriginalEmployees(JSON.parse(JSON.stringify(processed)));
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to load employees');
    } finally {
      setEmpLoading(false);
    }
  }, [processEmployeeData]);

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

  // School Entities Loaders
  const fetchClasses = useCallback(async () => {
    try {
      setClassesLoading(true);
      const res = await getClasses();
      if (res?.status && res?.data) {
        setClasses(res.data);
      } else if (Array.isArray(res)) {
        setClasses(res);
      } else if (res?.data && Array.isArray(res.data)) {
        setClasses(res.data);
      }
    } catch (err) {
      toast.error('Failed to load classes');
    } finally {
      setClassesLoading(false);
    }
  }, []);

  const fetchSubjects = useCallback(async () => {
    try {
      setSubjectsLoading(true);
      const res = await getSubjects();
      if (res?.status && res?.data) {
        setSubjects(res.data);
      } else if (Array.isArray(res)) {
        setSubjects(res);
      } else if (res?.data && Array.isArray(res.data)) {
        setSubjects(res.data);
      }
    } catch (err) {
      toast.error('Failed to load subjects');
    } finally {
      setSubjectsLoading(false);
    }
  }, []);

  const fetchMappings = useCallback(async () => {
    try {
      setMappingsLoading(true);
      const res = await getMappings();
      if (res?.status && res?.data) {
        setMappings(res.data);
      } else if (Array.isArray(res)) {
        setMappings(res);
      } else if (res?.data && Array.isArray(res.data)) {
        setMappings(res.data);
      }
    } catch (err) {
      toast.error('Failed to load mappings');
    } finally {
      setMappingsLoading(false);
    }
  }, []);

  const fetchTimetableEntries = useCallback(async () => {
    try {
      setTimetableLoading(true);
      const res = await getTimetables();
      if (res?.status && res?.data) {
        setTimetableEntries(res.data);
      } else if (Array.isArray(res)) {
        setTimetableEntries(res);
      } else if (res?.data && Array.isArray(res.data)) {
        setTimetableEntries(res.data);
      }
    } catch (err) {
      toast.error('Failed to load timetable entries');
    } finally {
      setTimetableLoading(false);
    }
  }, []);

  useEffect(() => { 
    if (activeTab === 'settings') fetchEmployees();
    if (activeTab === 'consolidated') fetchConsolidated(); 
    if (activeTab === 'details' || activeTab === 'individual_details') fetchDetails(); 
    if (activeTab === 'employees') {
      fetchEmployees();
      fetchRoles();
    }
    if (activeTab === 'roles') fetchRoles(); 
    if (activeTab === 'daily_status') fetchDailyStatus(dailyStatusDate);
    if (activeTab === 'classes') {
      fetchClasses();
      fetchEmployees();
    }
    if (activeTab === 'subjects') fetchSubjects();
    if (activeTab === 'mappings') {
      fetchMappings();
      fetchClasses();
      fetchSubjects();
      fetchEmployees();
    }
    if (activeTab === 'timetable') {
      fetchTimetableEntries();
      fetchClasses();
      fetchEmployees();
      fetchSubjects();
    }
  }, [activeTab, reportMonth, reportYear, deptFilter, dailyStatusDate, fetchDailyStatus, fetchRoles, fetchEmployees, fetchClasses, fetchSubjects, fetchMappings, fetchTimetableEntries]);

  // Real-time polling every 15 seconds
  useEffect(() => {
    const pollInterval = setInterval(() => {
      if (activeTab === 'consolidated') fetchConsolidatedSilent();
      else if (activeTab === 'details' || activeTab === 'individual_details') fetchDetailsSilent();
      else if (activeTab === 'employees') {
        getAdminEmployees().then(res => { if (res?.data) setEmployees(processEmployeeData(res.data)); }).catch(() => {});
      } else if (activeTab === 'daily_status') {
        getDailyStatus(dailyStatusDate).then(res => { if (res?.status && Array.isArray(res.data)) setDailyStatusData(res.data); }).catch(() => {});
      }
    }, 15000);
    return () => clearInterval(pollInterval);
  }, [activeTab, reportMonth, reportYear, deptFilter, dailyStatusDate, processEmployeeData]);

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

  const handleTimetableSubmit = async (e) => {
    e.preventDefault();
    if (!timetableForm.classId || !timetableForm.day || !timetableForm.period || !timetableForm.startTime || !timetableForm.endTime || !timetableForm.teacherId || !timetableForm.subjectId) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    setIsSavingTimetable(true);
    try {
      if (editingTimetableEntry) {
        const res = await updateTimetableEntry(editingTimetableEntry._id, timetableForm);
        if (res?.status) {
          toast.success("Timetable entry updated successfully");
          setIsTimetableModalOpen(false);
          setEditingTimetableEntry(null);
          fetchTimetableEntries();
        } else {
          toast.error(res?.message || "Failed to update timetable entry");
        }
      } else {
        const res = await createTimetableEntry(timetableForm);
        if (res?.status) {
          toast.success("Timetable entry created successfully");
          setIsTimetableModalOpen(false);
          fetchTimetableEntries();
        } else {
          toast.error(res?.message || "Failed to create timetable entry");
        }
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.detail || "Failed to save timetable entry");
    } finally {
      setIsSavingTimetable(false);
    }
  };

  const handleTimetableDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this timetable entry?")) return;
    try {
      const res = await deleteTimetableEntry(id);
      if (res?.status) {
        toast.success("Timetable entry deleted successfully");
        fetchTimetableEntries();
      } else {
        toast.error(res?.message || "Failed to delete timetable entry");
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to delete timetable entry");
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

  const exportTimetableToCSV = () => {
    let filename = 'timetable.csv';
    let headers = [];
    let rows = [];

    if (timetableViewMode === 'class_grid' && selectedTimetableClass !== 'All') {
      const clsDoc = classes.find(c => c._id === selectedTimetableClass);
      const className = clsDoc ? `${clsDoc.standard}-${clsDoc.section}` : '';
      filename = `timetable_class_${className}.csv`;
      headers = ['Day', 'Period', 'Time Slot', 'Subject', 'Teacher'];
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      days.forEach(day => {
        const entries = timetableEntries.filter(e => 
          e.day === day && 
          (e.class?._id || e.class)?.toString() === selectedTimetableClass
        );
        if (entries.length === 0) {
          rows.push([day, '-', '-', '-', '-'].map(escapeCSV));
        } else {
          entries.forEach(e => {
            rows.push([
              day,
              `Period ${e.period}`,
              e.timeSlot,
              e.subject?.name || '',
              e.teacher?.name || ''
            ].map(escapeCSV));
          });
        }
      });
    } else if (timetableViewMode === 'weekly_grid') {
      filename = 'weekly_timetable_all_classes.csv';
      headers = ['Day', 'Period', 'Time Slot', 'Class', 'Subject', 'Teacher'];
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      days.forEach(day => {
        const entries = timetableEntries
          .filter(e => e.day === day)
          .sort((a, b) => a.period - b.period);
        
        if (entries.length === 0) {
          rows.push([day, '-', '-', '-', '-', '-'].map(escapeCSV));
        } else {
          entries.forEach(e => {
            rows.push([
              day,
              `Period ${e.period}`,
              e.timeSlot,
              e.class ? `${e.class.standard}-${e.class.section}` : '',
              e.subject?.name || '',
              e.teacher?.name || ''
            ].map(escapeCSV));
          });
        }
      });
    } else {
      filename = 'timetable_registry.csv';
      headers = ['Class', 'Day', 'Period', 'Time Slot', 'Subject', 'Teacher'];
      
      timetableEntries.forEach(e => {
        rows.push([
          e.class ? `${e.class.standard}-${e.class.section}` : '',
          e.day,
          `Period ${e.period}`,
          e.timeSlot,
          e.subject?.name || '',
          e.teacher?.name || ''
        ].map(escapeCSV));
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

  const printTimetable = () => {
    if (timetableViewMode === 'class_grid' && selectedTimetableClass !== 'All') {
      window.print();
    } else {
      const printWindow = window.open('', '_blank');
      let title = 'School Timetable';
      let contentHtml = '';
      
      if (timetableViewMode === 'weekly_grid') {
        title = 'Weekly Schedule Grid (All Classes)';
        contentHtml = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(dayName => {
          const dayEntries = timetableEntries
            .filter(e => e.day === dayName)
            .sort((a, b) => a.period - b.period);
          return `
            <div style="margin-bottom: 20px; break-inside: avoid;">
              <h3 style="border-bottom: 2px solid #f59e0b; padding-bottom: 5px; color: #1e293b; text-transform: uppercase;">📅 ${dayName}</h3>
              ${dayEntries.length === 0 ? '<p style="font-style: italic; color: #64748b;">No scheduled classes</p>' : `
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px;">
                  <thead>
                    <tr>
                      <th style="border: 1px solid #e2e8f0; padding: 8px 10px; background-color: #f8fafc; font-weight: 750; text-transform: uppercase; font-size: 10px; color: #64748b; width: 15%;">Period</th>
                      <th style="border: 1px solid #e2e8f0; padding: 8px 10px; background-color: #f8fafc; font-weight: 750; text-transform: uppercase; font-size: 10px; color: #64748b; width: 25%;">Class</th>
                      <th style="border: 1px solid #e2e8f0; padding: 8px 10px; background-color: #f8fafc; font-weight: 750; text-transform: uppercase; font-size: 10px; color: #64748b; width: 30%;">Subject</th>
                      <th style="border: 1px solid #e2e8f0; padding: 8px 10px; background-color: #f8fafc; font-weight: 750; text-transform: uppercase; font-size: 10px; color: #64748b; width: 30%;">Teacher</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${dayEntries.map(e => `
                      <tr>
                        <td style="border: 1px solid #e2e8f0; padding: 8px 10px; font-weight: 600; color: #d97706; font-family: monospace;">P${e.period} (${e.timeSlot})</td>
                        <td style="border: 1px solid #e2e8f0; padding: 8px 10px; font-weight: bold;">Class ${e.class ? `${e.class.standard}-${e.class.section} (${e.class.board})` : 'Unknown'}</td>
                        <td style="border: 1px solid #e2e8f0; padding: 8px 10px;">${e.subject?.name || 'Unknown'}</td>
                        <td style="border: 1px solid #e2e8f0; padding: 8px 10px;">👤 ${e.teacher?.name || 'Unknown'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              `}
            </div>
          `;
        }).join('');
      } else {
        title = 'Timetable Registry List';
        contentHtml = `
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px;">
            <thead>
              <tr>
                <th style="border: 1px solid #e2e8f0; padding: 8px 10px; background-color: #f8fafc; font-weight: 750; text-transform: uppercase; font-size: 10px; color: #64748b;">Class</th>
                <th style="border: 1px solid #e2e8f0; padding: 8px 10px; background-color: #f8fafc; font-weight: 750; text-transform: uppercase; font-size: 10px; color: #64748b;">Day</th>
                <th style="border: 1px solid #e2e8f0; padding: 8px 10px; background-color: #f8fafc; font-weight: 750; text-transform: uppercase; font-size: 10px; color: #64748b;">Period (Time)</th>
                <th style="border: 1px solid #e2e8f0; padding: 8px 10px; background-color: #f8fafc; font-weight: 750; text-transform: uppercase; font-size: 10px; color: #64748b;">Subject</th>
                <th style="border: 1px solid #e2e8f0; padding: 8px 10px; background-color: #f8fafc; font-weight: 750; text-transform: uppercase; font-size: 10px; color: #64748b;">Teacher</th>
              </tr>
            </thead>
            <tbody>
              ${timetableEntries.map(e => `
                <tr>
                  <td style="border: 1px solid #e2e8f0; padding: 8px 10px; font-weight: bold;">Class ${e.class ? `${e.class.standard}-${e.class.section} (${e.class.board})` : 'Unknown'}</td>
                  <td style="border: 1px solid #e2e8f0; padding: 8px 10px;">${e.day}</td>
                  <td style="border: 1px solid #e2e8f0; padding: 8px 10px; font-weight: 600; color: #d97706; font-family: monospace;">P${e.period} (${e.timeSlot})</td>
                  <td style="border: 1px solid #e2e8f0; padding: 8px 10px;">${e.subject?.name || 'Unknown'}</td>
                  <td style="border: 1px solid #e2e8f0; padding: 8px 10px;">👤 ${e.teacher?.name || 'Unknown'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }

      printWindow.document.write(`
        <html>
          <head>
            <title>\${title}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; color: #1e293b; }
              h1 { text-align: center; font-size: 20px; margin-bottom: 25px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
              @media print {
                body { padding: 0; }
                @page { size: A4; margin: 1.5cm; }
              }
            </style>
          </head>
          <body>
            <h1>\${title}</h1>
            \${contentHtml}
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

  const handleAddClick = () => {
    setAddForm({
      employeeId: '',
      name: '',
      email: '',
      phone: '',
      qualification: '',
      experience: 0,
      status: 'Active',
      createLogin: true,
      password: '',
      role: 'teacher'
    });
    setIsAddModalOpen(true);
  };

  const handleEditClick = (emp) => {
    setEditingFaculty(emp);
    setEditForm({
      name: emp.name || '',
      email: emp.email || '',
      phone: emp.phone || '',
      qualification: emp.qualification || '',
      experience: emp.experience || 0,
      status: emp.status || 'Active',
      role: emp.role || 'teacher',
      skip_face: !!emp.skip_face,
      skip_location: !!emp.skip_location,
      isActive: emp.is_enabled !== false
    });
    setIsEditModalOpen(true);
  };

  const handleAddTeacher = async (e) => {
    e.preventDefault();
    if (!addForm.name || !addForm.email) {
      return toast.error("Name and email are required");
    }
    setIsAddingFaculty(true);
    try {
      const res = await addTeacher(addForm);
      if (res?.status) {
        toast.success("Teacher added successfully!");
        setIsAddModalOpen(false);
        fetchEmployees();
      } else {
        toast.error(res?.message || "Failed to add teacher");
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.detail || "Failed to add teacher");
    } finally {
      setIsAddingFaculty(false);
    }
  };

  const handleEditTeacher = async (e) => {
    e.preventDefault();
    if (!editingFaculty) return;
    setIsSavingFaculty(true);
    try {
      const res = await updateEmployeeSettings(editingFaculty._id, {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        qualification: editForm.qualification,
        experience: editForm.experience,
        status: editForm.status,
        role: editForm.role,
        skip_face: editForm.skip_face,
        skip_location: editForm.skip_location,
        isActive: editForm.isActive
      });
      if (res?.status) {
        toast.success("Teacher profile updated!");
        setIsEditModalOpen(false);
        setEditingFaculty(null);
        fetchEmployees();
      } else {
        toast.error(res?.message || "Failed to update teacher");
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.detail || "Failed to update teacher");
    } finally {
      setIsSavingFaculty(false);
    }
  };

  const handleSaveAllChanges = async () => {
    setIsSavingBulk(true);
    const changedEmps = (Array.isArray(employees) ? employees : []).filter((emp, idx) => {
      const orig = originalEmployees[idx];
      if (!orig) return false;
      return orig.skip_face !== emp.skip_face ||
             orig.skip_location !== emp.skip_location ||
             orig.is_enabled !== emp.is_enabled ||
             orig.role !== emp.role;
    });
    let successCount = 0;
    for (const emp of changedEmps) {
      try {
        await updateEmployeeSettings(emp._id, {
          skip_face: emp.skip_face,
          skip_location: emp.skip_location,
          is_enabled: emp.is_enabled,
          role: emp.role
        });
        successCount++;
      } catch (err) {
        toast.error(`Failed to save ${emp.name}`);
      }
    }
    if (successCount > 0) {
      toast.success(`${successCount} teacher(s) updated successfully!`);
      setOriginalEmployees(JSON.parse(JSON.stringify(employees)));
    }
    setIsSavingBulk(false);
  };

  const hasChanges = (Array.isArray(employees) ? employees : []).some((emp, idx) => {
    const orig = originalEmployees[idx];
    if (!orig) return false;
    return orig.skip_face !== emp.skip_face ||
           orig.skip_location !== emp.skip_location ||
           orig.is_enabled !== emp.is_enabled ||
           orig.role !== emp.role;
  });

  // Load current settings
  useEffect(() => {
    const loadSettings = async () => {
      if (user?.role !== 'admin') return;
      try {
        const res = await getCompanySettings();
        if (res?.data) {
          setSettings({
            schoolName: res.data.schoolName || 'Golden Valley Academy',
            board: res.data.board || 'CBSE',
            boardsList: res.data.boardsList || ['CBSE', 'STATE', 'ICSE'],
            standardsList: res.data.standardsList || ['Nursery', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'],
            face_auth_enabled: res.data.face_auth_enabled !== undefined ? res.data.face_auth_enabled : true,
            location_auth_enabled: res.data.location_auth_enabled !== undefined ? res.data.location_auth_enabled : true,
            hours_per_day: res.data.hours_per_day || 8.0,
            hours_per_week: res.data.hours_per_week || 40.0,
            hours_per_month: res.data.hours_per_month || 160.0,
            hours_per_year: res.data.hours_per_year || 1920.0,
            weekly_off: res.data.weekly_off || 'Sunday',
            office_start_time: res.data.office_start_time || '08:30',
            office_end_time: res.data.office_end_time || '16:00',
            grace_period_mins: res.data.grace_period_mins || 15,
            hours_per_subject: res.data.hours_per_subject !== undefined ? res.data.hours_per_subject : 1.0,
            game_period_mins: res.data.game_period_mins !== undefined ? res.data.game_period_mins : 45,
            lunch_break_mins: res.data.lunch_break_mins !== undefined ? res.data.lunch_break_mins : 45,
            small_break_mins: res.data.small_break_mins !== undefined ? res.data.small_break_mins : 15
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

  const handleToggleSetting = async (field, val) => {
    const updatedSettings = { ...settings, [field]: val };
    setSettings(updatedSettings);
    
    // Optimistically update the UI list for immediate feedback
    const employeeField = field === 'face_auth_enabled' ? 'skip_face' : 'skip_location';
    setEmployees(prev => (Array.isArray(prev) ? prev : []).map(emp => ({ ...emp, [employeeField]: val })));
    
    try {
      const settingsPayload = {
        schoolName: updatedSettings.schoolName || 'Golden Valley Academy',
        board: updatedSettings.board || 'CBSE',
        boardsList: updatedSettings.boardsList || ['CBSE', 'STATE', 'ICSE'],
        standardsList: updatedSettings.standardsList || ['Nursery', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'],
        face_auth_enabled: !!updatedSettings.face_auth_enabled,
        location_auth_enabled: !!updatedSettings.location_auth_enabled,
        hours_per_day: parseFloat(updatedSettings.hours_per_day) || 8.0,
        hours_per_week: parseFloat(updatedSettings.hours_per_week) || 40.0,
        hours_per_month: parseFloat(updatedSettings.hours_per_month) || 160.0,
        hours_per_year: parseFloat(updatedSettings.hours_per_year) || 1920.0,
        weekly_off: (updatedSettings.weekly_off || 'Sunday').trim(),
        office_start_time: updatedSettings.office_start_time || '08:30',
        office_end_time: updatedSettings.office_end_time || '16:00',
        grace_period_mins: parseInt(updatedSettings.grace_period_mins) || 15,
        hours_per_subject: parseFloat(updatedSettings.hours_per_subject) || 1.0,
        game_period_mins: parseInt(updatedSettings.game_period_mins) || 45,
        lunch_break_mins: parseInt(updatedSettings.lunch_break_mins) || 45,
        small_break_mins: parseInt(updatedSettings.small_break_mins) || 15
      };
      
      await updateCompanySettings(settingsPayload);
      
      // Reload from backend to make sure everything is completely in sync and update originalEmployees
      const empRes = await getAdminEmployees();
      if (empRes?.data) {
        const processed = processEmployeeData(empRes.data);
        setEmployees(processed);
        setOriginalEmployees(JSON.parse(JSON.stringify(processed)));
      }
      toast.success(`${field === 'face_auth_enabled' ? 'Face' : 'Location'} authentication setting updated globally!`);
    } catch (err) {
      toast.error("Failed to update setting");
      // Revert states on error
      setSettings(settings);
      fetchEmployees();
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
    if (!settings.weekly_off || !settings.weekly_off.trim()) {
      return toast.error("Weekly off is required");
    }

    const grace = parseInt(settings.grace_period_mins);
    if (isNaN(grace) || grace < 0) return toast.error("Grace period must be >= 0");

    setIsSaving(true);
    try {
      const settingsPayload = {
        schoolName: settings.schoolName || 'Golden Valley Academy',
        board: settings.board || 'CBSE',
        boardsList: settings.boardsList || ['CBSE', 'STATE', 'ICSE'],
        standardsList: settings.standardsList || ['Nursery', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'],
        face_auth_enabled: !!settings.face_auth_enabled,
        location_auth_enabled: !!settings.location_auth_enabled,
        hours_per_day: hrsD,
        hours_per_week: hrsW,
        hours_per_month: hrsM,
        hours_per_year: hrsY,
        weekly_off: settings.weekly_off.trim(),
        office_start_time: settings.office_start_time || '08:30',
        office_end_time: settings.office_end_time || '16:00',
        grace_period_mins: grace,
        hours_per_subject: parseFloat(settings.hours_per_subject) || 1.0,
        game_period_mins: parseInt(settings.game_period_mins) || 45,
        lunch_break_mins: parseInt(settings.lunch_break_mins) || 45,
        small_break_mins: parseInt(settings.small_break_mins) || 15
      };
      
      await updateCompanySettings(settingsPayload);
      toast.success("School configuration saved successfully!");
      
      // Also automatically save any teacher skip settings that were updated in bulk
      const changedEmps = (Array.isArray(employees) ? employees : []).filter((emp, idx) => {
        const orig = originalEmployees[idx];
        if (!orig) return false;
        return orig.skip_face !== emp.skip_face ||
               orig.skip_location !== emp.skip_location ||
               orig.is_enabled !== emp.is_enabled ||
               orig.role !== emp.role;
      });
      if (changedEmps.length > 0) {
        let successCount = 0;
        for (const emp of changedEmps) {
          try {
            await updateEmployeeSettings(emp._id, {
              skip_face: emp.skip_face,
              skip_location: emp.skip_location,
              is_enabled: emp.is_enabled,
              role: emp.role
            });
            successCount++;
          } catch (err) {
            console.error(`Failed to auto-save settings for ${emp.name}`, err);
          }
        }
        if (successCount > 0) {
          setOriginalEmployees(JSON.parse(JSON.stringify(employees)));
        }
      }
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
            {id:'settings',label:'🏫 School Settings'},
            {id:'employees',label:'👥 Teacher Management'},
            {id:'classes',label:'🏫 Class Management'},
            {id:'subjects',label:'📚 Subject Management'},
            {id:'mappings',label:'🔗 Mappings'},
            {id:'roles',label:'🔑 Role'},
            {id:'timetable',label:'📅 Timetable Grid'}
          ].map(tObj => (
            <button key={tObj.id} onClick={() => setActiveTab(tObj.id)} className={`px-5 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${activeTab===tObj.id ? 'bg-amber-500 text-stone-900 shadow-lg scale-105' : 'bg-stone-100 text-stone-700 border border-stone-200 hover:bg-stone-200'}`}>{tObj.label}</button>
          ))}
        </div>

        {activeTab === 'settings' && (
          <>
          {/* School Settings Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-8 text-gray-900">
            <div className="bg-gray-50 border-b border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                🏫 School Configuration & Settings
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                Configure school level details, board affiliation, authentication policies, and operational hours.
              </p>
            </div>

            <div className="p-6 sm:p-8">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <span className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></span>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* General Details & Auth Options */}
                  <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200 space-y-6">
                    <h3 className="text-sm font-bold text-amber-600 uppercase tracking-wider">General Configuration</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">School Name</label>
                        <input
                          type="text"
                          value={settings.schoolName || ''}
                          onChange={(e) => setSettings({ ...settings, schoolName: e.target.value })}
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-amber-400 outline-none transition-all font-semibold"
                          placeholder="e.g. Golden Valley Academy"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Affiliated Board</label>
                        <div className="flex gap-2">
                          <select
                            value={settings.board || 'CBSE'}
                            onChange={(e) => setSettings({ ...settings, board: e.target.value })}
                            className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 font-semibold focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                          >
                            {(settings.boardsList || ['CBSE', 'STATE', 'ICSE']).map(boardOpt => (
                              <option key={boardOpt} value={boardOpt}>{boardOpt}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              const newBoard = window.prompt("Enter new Affiliated Board name:");
                              if (newBoard && newBoard.trim()) {
                                const trimmed = newBoard.trim().toUpperCase();
                                const currentList = settings.boardsList || ['CBSE', 'STATE', 'ICSE'];
                                if (currentList.includes(trimmed)) {
                                  toast.error("Board already exists");
                                  return;
                                }
                                const updatedList = [...currentList, trimmed];
                                setSettings({ ...settings, boardsList: updatedList, board: trimmed });
                                toast.success(`Board "${trimmed}" added! Click save to apply.`);
                              }
                            }}
                            className="px-4 bg-amber-500 hover:bg-amber-600 text-stone-900 font-bold rounded-xl text-xs flex items-center justify-center transition-all"
                            title="Add Custom Board"
                          >
                            ➕ Add
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-stone-200">
                      {/* Face Auth Level Toggle */}
                      <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-stone-200 shadow-sm">
                        <div>
                          <span className="block text-sm font-bold text-gray-800">Face Authentication</span>
                          <span className="text-xs text-gray-500">Require face scanning at school level</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!settings.face_auth_enabled}
                            onChange={(e) => handleToggleSetting('face_auth_enabled', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                      </div>

                      {/* Location Auth Level Toggle */}
                      <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-stone-200 shadow-sm">
                        <div>
                          <span className="block text-sm font-bold text-gray-800">Location Authentication</span>
                          <span className="text-xs text-gray-500">Enforce GPS boundary restrictions (max 500m)</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!settings.location_auth_enabled}
                            onChange={(e) => handleToggleSetting('location_auth_enabled', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* School Timings & Breaks */}
                  <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200 space-y-6">
                    <h3 className="text-sm font-bold text-amber-600 uppercase tracking-wider">School Hours & Timings</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">School Starts Time</label>
                        <input
                          type="time"
                          value={settings.office_start_time || '08:30'}
                          onChange={(e) => setSettings({ ...settings, office_start_time: e.target.value })}
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 font-bold focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">School Ends Time</label>
                        <input
                          type="time"
                          value={settings.office_end_time || '16:00'}
                          onChange={(e) => setSettings({ ...settings, office_end_time: e.target.value })}
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 font-bold focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Grace Period (Mins)</label>
                        <input
                          type="number"
                          min="0"
                          value={settings.grace_period_mins || 0}
                          onChange={(e) => setSettings({ ...settings, grace_period_mins: e.target.value })}
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 font-bold focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 pt-4 border-t border-stone-200">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Hours Per Subject</label>
                        <input
                          type="number" step="0.1" min="0.1"
                          value={settings.hours_per_subject || 1}
                          onChange={(e) => setSettings({ ...settings, hours_per_subject: e.target.value })}
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 font-bold focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Game Period (Mins)</label>
                        <input
                          type="number" min="0"
                          value={settings.game_period_mins || 45}
                          onChange={(e) => setSettings({ ...settings, game_period_mins: e.target.value })}
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 font-bold focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Lunch Break (Mins)</label>
                        <input
                          type="number" min="0"
                          value={settings.lunch_break_mins || 45}
                          onChange={(e) => setSettings({ ...settings, lunch_break_mins: e.target.value })}
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 font-bold focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Small Break (Mins)</label>
                        <input
                          type="number" min="0"
                          value={settings.small_break_mins || 15}
                          onChange={(e) => setSettings({ ...settings, small_break_mins: e.target.value })}
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 font-bold focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Standard Operations Configurations */}
                  <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200 space-y-6">
                    <h3 className="text-sm font-bold text-amber-600 uppercase tracking-wider">Operational Statistics</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Hours Per Day</label>
                        <input
                          type="number" step="0.5" min="1" max="24"
                          value={settings.hours_per_day || 8}
                          onChange={(e) => setSettings({ ...settings, hours_per_day: e.target.value })}
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 font-bold focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Hours Per Week</label>
                        <input
                          type="number" step="0.5" min="1"
                          value={settings.hours_per_week || 40}
                          onChange={(e) => setSettings({ ...settings, hours_per_week: e.target.value })}
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 font-bold focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Hours Per Month</label>
                        <input
                          type="number" step="0.5" min="1"
                          value={settings.hours_per_month || 160}
                          onChange={(e) => setSettings({ ...settings, hours_per_month: e.target.value })}
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 font-bold focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Weekly Off Days</label>
                        <input
                          type="text"
                          value={settings.weekly_off || 'Sunday'}
                          onChange={(e) => setSettings({ ...settings, weekly_off: e.target.value })}
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 font-semibold focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                          placeholder="e.g. Sunday"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Warning Banner */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 mb-8 flex items-start gap-3">
            <svg className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <p className="text-amber-800 font-bold text-sm">⚠️ Cascade Settings Warning</p>
              <p className="text-amber-700/80 text-xs mt-1">
                Saving will update the global school configuration. These metrics are used for class timetables, attendance tracking, and audit reports.
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
              <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Saving changes...</>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save School Configuration
              </>
            )}
          </button>
          </>
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

        {activeTab === 'employees' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-8 text-gray-900">
            <div className="bg-gray-50 border-b border-gray-200 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                  👥 Teacher Management
                </h2>
                <p className="text-gray-500 text-sm mt-1">Manage teacher profiles, access credentials, and authentication preferences.</p>
              </div>
              <button
                onClick={handleAddClick}
                className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-stone-900 font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <span>➕ Add Teacher</span>
              </button>
            </div>

            <div className="p-4 sm:p-6">
              {/* Search Bar */}
              <div className="mb-6">
                <input
                  type="text"
                  placeholder="Search teachers..."
                  value={empSearch}
                  onChange={e => setEmpSearch(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                />
              </div>

              {empLoading ? (
                <div className="text-center py-12"><Spinner size="lg" /></div>
              ) : (
                <div>
                  {/* Desktop View Table */}
                  <div className="overflow-x-auto hidden lg:block">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-gray-500 font-bold text-xs uppercase">
                          <th className="px-4 py-3 text-left">Employee</th>
                          <th className="px-4 py-3 text-left">ID</th>
                          <th className="px-4 py-3 text-center">Skip Face</th>
                          <th className="px-4 py-3 text-center">Skip Location</th>
                          <th className="px-4 py-3 text-center">Account Status</th>
                          <th className="px-4 py-3 text-center">Role</th>
                          <th className="px-4 py-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(Array.isArray(employees) ? employees : [])
                          .filter(e => 
                            !empSearch || 
                            e.name?.toLowerCase().includes(empSearch.toLowerCase()) || 
                            e.employeeId?.toLowerCase().includes(empSearch.toLowerCase()) || 
                            e.email?.toLowerCase().includes(empSearch.toLowerCase())
                          )
                          .map((emp) => {
                            const realIdx = (Array.isArray(employees) ? employees : []).findIndex(e => e._id === emp._id);
                            const isDirty = originalEmployees.some(o => o._id === emp._id && (
                              o.skip_face !== emp.skip_face ||
                              o.skip_location !== emp.skip_location ||
                              o.is_enabled !== emp.is_enabled ||
                              o.role !== emp.role
                            ));

                            return (
                              <tr key={emp._id} className={`hover:bg-gray-50 transition-colors ${isDirty ? 'bg-amber-50/20' : ''}`}>
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-3">
                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm ${
                                      emp.is_super_admin 
                                        ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-400 font-black' 
                                        : emp.role === 'admin' 
                                          ? 'bg-amber-100 text-amber-700' 
                                          : 'bg-gray-100 text-gray-600'
                                    }`}>
                                      {emp.name?.charAt(0)?.toUpperCase()}
                                    </div>
                                    <div>
                                      <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                                        <span 
                                          onClick={() => handleUserClick(emp._id)}
                                          className="cursor-pointer hover:underline text-amber-600 hover:text-amber-700 font-bold"
                                        >
                                          {emp.name}
                                        </span> 
                                        {emp.is_super_admin && (
                                          <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">
                                            Super Admin
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {emp.email} • <span className="capitalize">{emp.role === 'user' ? 'Employee' : emp.role}</span>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                
                                <td className="px-4 py-3.5 font-mono text-xs text-gray-500 font-semibold">
                                  {emp.employeeId || 'N/A'}
                                </td>

                                <td className="px-4 py-3.5 text-center">
                                  <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      checked={emp.skip_face} 
                                      onChange={() => handleEmpToggle(realIdx, 'skip_face')} 
                                      className="sr-only peer" 
                                    />
                                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                  </label>
                                </td>

                                <td className="px-4 py-3.5 text-center">
                                  <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      checked={emp.skip_location} 
                                      onChange={() => handleEmpToggle(realIdx, 'skip_location')} 
                                      className="sr-only peer" 
                                    />
                                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                  </label>
                                </td>

                                <td className="px-4 py-3.5 text-center">
                                  <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      checked={emp.is_enabled} 
                                      onChange={() => handleEmpToggle(realIdx, 'is_enabled')} 
                                      className="sr-only peer" 
                                    />
                                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                                  </label>
                                  <div className={`text-[10px] font-bold mt-1 ${emp.is_enabled ? 'text-blue-600' : 'text-gray-400'}`}>
                                    {emp.is_enabled ? 'ENABLED' : 'DISABLED'}
                                  </div>
                                </td>

                                <td className="px-4 py-3.5 text-center">
                                  {emp.is_super_admin ? (
                                    <span className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold border border-amber-300">
                                      Admin (Permanent)
                                    </span>
                                  ) : (
                                    <select 
                                      value={emp.role} 
                                      onChange={e => handleEmpRole(realIdx, e.target.value)} 
                                      className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-gray-900 text-xs font-semibold focus:ring-2 focus:ring-amber-400 outline-none"
                                    >
                                      <option value="teacher">Teacher</option>
                                      <option value="admin">Admin</option>
                                      <option value="user">Employee</option>
                                      {roles.map(r => {
                                        const val = r.Rolename;
                                        if (val === 'admin' || val === 'user' || val === 'teacher' || val === 'Employee' || val === 'Admin') return null;
                                        return (
                                          <option key={r._id} value={val}>
                                            {r.Rolename}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  )}
                                </td>

                                <td className="px-4 py-3.5 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    {/* Edit button (Green) */}
                                    <button
                                      onClick={() => handleEditClick(emp)}
                                      className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white border border-emerald-200 transition-all flex items-center justify-center"
                                      title="Edit Profile"
                                    >
                                      ✏️
                                    </button>

                                    {/* Reset Password button (Yellow) */}
                                    <button
                                      onClick={() => handleResetPassword(emp._id, emp.name)}
                                      className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white border border-amber-200 transition-all flex items-center justify-center"
                                      title="Reset Password"
                                    >
                                      🔑
                                    </button>

                                    {/* Delete button (Red) */}
                                    {!emp.is_super_admin && (
                                      <button
                                        onClick={() => handleDeleteEmployee(emp._id, emp.name)}
                                        className="w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white border border-red-200 transition-all flex items-center justify-center"
                                        title="Delete Teacher"
                                      >
                                        🗑️
                                      </button>
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
                    {(Array.isArray(employees) ? employees : [])
                      .filter(e => 
                        !empSearch || 
                        e.name?.toLowerCase().includes(empSearch.toLowerCase()) || 
                        e.employeeId?.toLowerCase().includes(empSearch.toLowerCase()) || 
                        e.email?.toLowerCase().includes(empSearch.toLowerCase())
                      )
                      .map((emp) => {
                        const realIdx = (Array.isArray(employees) ? employees : []).findIndex(e => e._id === emp._id);
                        return (
                          <div 
                            key={emp._id} 
                            className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col gap-4 transition-all hover:border-amber-300"
                          >
                            <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
                              <div className="flex items-center gap-3">
                                <div className={`h-11 w-11 rounded-full flex items-center justify-center font-bold text-sm ${
                                  emp.is_super_admin 
                                    ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-400' 
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {emp.name?.charAt(0)?.toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                                    <span 
                                      onClick={() => handleUserClick(emp._id)}
                                      className="cursor-pointer hover:underline text-amber-600 hover:text-amber-700 font-bold"
                                    >
                                      {emp.name}
                                    </span>
                                    {emp.is_super_admin && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">Super Admin</span>}
                                  </div>
                                  <div className="text-xs text-gray-500">{emp.email}</div>
                                  <div className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {emp.employeeId || 'N/A'}</div>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div className="flex flex-col gap-1 p-3 bg-gray-50 rounded-xl border border-gray-200">
                                <span className="text-gray-500 font-bold">Skip Face</span>
                                <label className="relative inline-flex items-center cursor-pointer mt-1">
                                  <input 
                                    type="checkbox" 
                                    checked={emp.skip_face} 
                                    onChange={() => handleEmpToggle(realIdx, 'skip_face')} 
                                    className="sr-only peer" 
                                  />
                                  <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                                </label>
                              </div>

                              <div className="flex flex-col gap-1 p-3 bg-gray-50 rounded-xl border border-gray-200">
                                <span className="text-gray-500 font-bold">Skip Location</span>
                                <label className="relative inline-flex items-center cursor-pointer mt-1">
                                  <input 
                                    type="checkbox" 
                                    checked={emp.skip_location} 
                                    onChange={() => handleEmpToggle(realIdx, 'skip_location')} 
                                    className="sr-only peer" 
                                  />
                                  <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                                </label>
                              </div>

                              <div className="flex flex-col gap-1 p-3 bg-gray-50 rounded-xl border border-gray-200">
                                <span className="text-gray-500 font-bold">Status</span>
                                <div className="flex items-center justify-between mt-1">
                                  <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      checked={emp.is_enabled} 
                                      onChange={() => handleEmpToggle(realIdx, 'is_enabled')} 
                                      className="sr-only peer" 
                                    />
                                    <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                                  </label>
                                  <span className={`text-[9px] font-bold ${emp.is_enabled ? 'text-blue-600' : 'text-gray-400'}`}>
                                    {emp.is_enabled ? 'ENABLED' : 'DISABLED'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-col gap-1 p-3 bg-gray-50 rounded-xl border border-gray-200">
                                <span className="text-gray-500 font-bold">Role</span>
                                {emp.is_super_admin ? (
                                  <span className="text-[10px] text-amber-700 font-bold mt-1">Super Admin</span>
                                ) : (
                                  <select 
                                    value={emp.role} 
                                    onChange={e => handleEmpRole(realIdx, e.target.value)} 
                                    className="w-full mt-0.5 px-2 py-1 bg-white border border-gray-300 rounded-lg text-gray-900 text-[10px] font-semibold focus:ring-1 focus:ring-amber-400 outline-none"
                                  >
                                    <option value="teacher">Teacher</option>
                                    <option value="admin">Admin</option>
                                    <option value="user">Employee</option>
                                    {roles.map(r => {
                                      const val = r.Rolename;
                                      if (val === 'admin' || val === 'user' || val === 'teacher' || val === 'Employee' || val === 'Admin') return null;
                                      return (
                                        <option key={r._id} value={val}>
                                          {r.Rolename}
                                        </option>
                                      );
                                    })}
                                  </select>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-center gap-4 border-t border-gray-100 pt-3">
                              <button
                                onClick={() => handleEditClick(emp)}
                                className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-500 text-emerald-700 hover:text-white border border-emerald-200 rounded-lg text-xs font-bold transition-all text-center"
                              >
                                Edit Profile
                              </button>
                              <button
                                onClick={() => handleResetPassword(emp._id, emp.name)}
                                className="flex-1 py-2 bg-amber-50 hover:bg-amber-500 text-amber-700 hover:text-white border border-amber-200 rounded-lg text-xs font-bold transition-all text-center"
                              >
                                Reset Pass
                              </button>
                              {!emp.is_super_admin && (
                                <button
                                  onClick={() => handleDeleteEmployee(emp._id, emp.name)}
                                  className="flex-1 py-2 bg-red-50 hover:bg-red-500 text-red-700 hover:text-white border border-red-200 rounded-lg text-xs font-bold transition-all text-center"
                                >
                                  Delete
                                </button>
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

        {/* Class Management Tab */}
        {activeTab === 'classes' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-8 text-gray-900">
            <div className="bg-gray-50 border-b border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                🏫 Class & Section Management
              </h2>
              <p className="text-gray-500 text-sm mt-1">Configure classes (Nursery to 10th), map sections, and assign class teachers.</p>
            </div>
            
            <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Add Class Form */}
              <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200 h-fit space-y-5">
                <h3 className="text-base font-bold text-stone-800">➕ Add New Class</h3>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!classSection.trim()) return toast.error("Section name is required");
                  setIsSavingClass(true);
                  try {
                    await createClass({
                      standard: classStandard,
                      section: classSection.trim().toUpperCase(),
                      board: settings.board || 'CBSE',
                      classTeacher: classTeacherId || undefined,
                      strength: parseInt(classStrength) || 0
                    });
                    toast.success(`Class ${classStandard}-${classSection.trim().toUpperCase()} created!`);
                    setClassSection('A');
                    setClassTeacherId('');
                    setClassStrength(0);
                    fetchClasses();
                  } catch (err) {
                    toast.error(err?.response?.data?.message || err?.response?.data?.detail || "Failed to create class");
                  } finally {
                    setIsSavingClass(false);
                  }
                }} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Standard *</label>
                    <div className="flex gap-2">
                      <select
                        value={classStandard}
                        onChange={(e) => setClassStandard(e.target.value)}
                        className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-amber-400 outline-none font-semibold"
                      >
                        {(settings.standardsList || ['Nursery', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th']).map(std => (
                          <option key={std} value={std}>{std}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={async () => {
                          const newStd = window.prompt("Enter new Standard name (e.g. PUC, Degree):");
                          if (newStd && newStd.trim()) {
                            const trimmed = newStd.trim();
                            const currentList = settings.standardsList || ['Nursery', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
                            if (currentList.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
                              toast.error("Standard already exists");
                              return;
                            }
                            const updatedList = [...currentList, trimmed];
                            
                            // Optimistically update settings state and select it
                            const newSettings = { ...settings, standardsList: updatedList };
                            setSettings(newSettings);
                            setClassStandard(trimmed);
                            
                            // Save to backend immediately
                            try {
                              const settingsPayload = {
                                schoolName: newSettings.schoolName || 'Golden Valley Academy',
                                board: newSettings.board || 'CBSE',
                                boardsList: newSettings.boardsList || ['CBSE', 'STATE', 'ICSE'],
                                standardsList: updatedList,
                                face_auth_enabled: !!newSettings.face_auth_enabled,
                                location_auth_enabled: !!newSettings.location_auth_enabled,
                                hours_per_day: parseFloat(newSettings.hours_per_day) || 8.0,
                                hours_per_week: parseFloat(newSettings.hours_per_week) || 40.0,
                                hours_per_month: parseFloat(newSettings.hours_per_month) || 160.0,
                                hours_per_year: parseFloat(newSettings.hours_per_year) || 1920.0,
                                weekly_off: (newSettings.weekly_off || 'Sunday').trim(),
                                office_start_time: newSettings.office_start_time || '08:30',
                                office_end_time: newSettings.office_end_time || '16:00',
                                grace_period_mins: parseInt(newSettings.grace_period_mins) || 15,
                                hours_per_subject: parseFloat(newSettings.hours_per_subject) || 1.0,
                                game_period_mins: parseInt(newSettings.game_period_mins) || 45,
                                lunch_break_mins: parseInt(newSettings.lunch_break_mins) || 45,
                                small_break_mins: parseInt(newSettings.small_break_mins) || 15
                              };
                              await updateCompanySettings(settingsPayload);
                              toast.success(`Standard "${trimmed}" added and saved successfully!`);
                            } catch (err) {
                              toast.error("Failed to save new standard to database");
                            }
                          }
                        }}
                        className="px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-1 whitespace-nowrap"
                        title="Add Custom Standard"
                      >
                        ➕ Add
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Section *</label>
                    <input
                      type="text"
                      maxLength="3"
                      placeholder="e.g. A"
                      value={classSection}
                      onChange={(e) => setClassSection(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-amber-400 outline-none font-semibold uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Class Teacher (Optional)</label>
                    <select
                      value={classTeacherId}
                      onChange={(e) => setClassTeacherId(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-amber-400 outline-none font-semibold"
                    >
                      <option value="">-- Select Teacher --</option>
                      {(Array.isArray(employees) ? employees : []).filter(emp => emp.role === 'teacher').map(tch => (
                        <option key={tch._id} value={tch._id}>{tch.name} ({tch.employeeId})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Class Strength</label>
                    <input
                      type="number"
                      min="0"
                      value={classStrength}
                      onChange={(e) => setClassStrength(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-amber-400 outline-none font-semibold"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingClass}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-stone-900 font-bold rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {isSavingClass ? <span className="w-4 h-4 border-2 border-stone-900 border-t-transparent rounded-full animate-spin"></span> : 'Create Class'}
                  </button>
                </form>
              </div>

              {/* Class List Table */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-base font-bold text-stone-800">🏫 Registered Classes</h3>
                {classesLoading ? (
                  <div className="text-center py-12"><Spinner size="md" /></div>
                ) : classes.length === 0 ? (
                  <p className="text-center text-gray-400 py-12 bg-gray-50 rounded-2xl border border-gray-200">No classes registered yet.</p>
                ) : (
                  <div className="overflow-x-auto border border-gray-200 rounded-2xl shadow-sm">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold text-xs uppercase">
                          <th className="px-4 py-3 text-left">Class Name</th>
                          <th className="px-4 py-3 text-left">Board</th>
                          <th className="px-4 py-3 text-left">Class Teacher</th>
                          <th className="px-4 py-3 text-center">Strength</th>
                          <th className="px-4 py-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {classes.map((cls) => (
                          <tr key={cls._id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3.5 font-bold text-stone-800">
                              {cls.standard} - {cls.section}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                cls.board === 'CBSE' 
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                                  : cls.board === 'ICSE'
                                    ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                    : 'bg-orange-50 text-orange-700 border border-orange-200'
                              }`}>
                                {cls.board}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 font-medium">
                              {cls.classTeacher?.name || <span className="text-gray-400 italic">Not Assigned</span>}
                            </td>
                            <td className="px-4 py-3.5 text-center font-mono font-semibold">
                              {cls.strength || 0}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <button
                                onClick={async () => {
                                  if (!window.confirm(`Delete class ${cls.standard}-${cls.section}?`)) return;
                                  try {
                                    await deleteClass(cls._id);
                                    toast.success("Class deleted successfully");
                                    fetchClasses();
                                  } catch (err) {
                                    toast.error("Failed to delete class");
                                  }
                                }}
                                className="w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white border border-red-200 transition-all flex items-center justify-center mx-auto"
                                title="Delete Class"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Subject Management Tab */}
        {activeTab === 'subjects' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-8 text-gray-900">
            <div className="bg-gray-50 border-b border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                📚 Subject Management
              </h2>
              <p className="text-gray-500 text-sm mt-1">Manage the global subject catalogue for the school curriculum.</p>
            </div>

            <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Add Subject Form */}
              <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200 h-fit space-y-5">
                <h3 className="text-base font-bold text-stone-800">📚 Add New Subject</h3>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!subjectName.trim()) return toast.error("Subject name is required");
                  setIsSavingSubject(true);
                  try {
                    await createSubject({ name: subjectName.trim() });
                    toast.success(`Subject "${subjectName.trim()}" created successfully!`);
                    setSubjectName('');
                    fetchSubjects();
                  } catch (err) {
                    toast.error(err?.response?.data?.message || err?.response?.data?.detail || "Failed to create subject");
                  } finally {
                    setIsSavingSubject(false);
                  }
                }} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Subject Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Mathematics"
                      value={subjectName}
                      onChange={(e) => setSubjectName(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-amber-400 outline-none font-semibold"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingSubject}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-stone-900 font-bold rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {isSavingSubject ? <span className="w-4 h-4 border-2 border-stone-900 border-t-transparent rounded-full animate-spin"></span> : 'Add Subject'}
                  </button>
                </form>
              </div>

              {/* Subject List Table */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-base font-bold text-stone-800">📚 Subject Catalogue</h3>
                {subjectsLoading ? (
                  <div className="text-center py-12"><Spinner size="md" /></div>
                ) : subjects.length === 0 ? (
                  <p className="text-center text-gray-400 py-12 bg-gray-50 rounded-2xl border border-gray-200">No subjects registered yet.</p>
                ) : (
                  <div className="overflow-x-auto border border-gray-200 rounded-2xl shadow-sm">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold text-xs uppercase">
                          <th className="px-4 py-3 text-left">Subject Name</th>
                          <th className="px-4 py-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {subjects.map((sub) => (
                          <tr key={sub._id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3.5 font-bold text-stone-800">
                              {sub.name}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <button
                                onClick={async () => {
                                  if (!window.confirm(`Delete subject "${sub.name}"? This will also delete any teacher assignments to this subject.`)) return;
                                  try {
                                    await deleteSubject(sub._id);
                                    toast.success("Subject deleted successfully");
                                    fetchSubjects();
                                  } catch (err) {
                                    toast.error("Failed to delete subject");
                                  }
                                }}
                                className="w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white border border-red-200 transition-all flex items-center justify-center mx-auto"
                                title="Delete Subject"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mapping Management Tab */}
        {activeTab === 'mappings' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-8 text-gray-900">
            <div className="bg-gray-50 border-b border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                🔗 Teacher, Class & Subject Mappings
              </h2>
              <p className="text-gray-500 text-sm mt-1">Assign teachers to specific subjects and classes (linked by sections).</p>
            </div>

            <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Add Mapping Form */}
              <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200 h-fit space-y-5">
                <h3 className="text-base font-bold text-stone-800">🔗 Assign Subject Teacher</h3>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!mapTeacherId || !mapClassId || !mapSubjectId) {
                    return toast.error("Teacher, Class, and Subject are all required");
                  }
                  setIsSavingMapping(true);
                  try {
                    await createMapping({
                      teacherId: mapTeacherId,
                      classId: mapClassId,
                      subjectId: mapSubjectId
                    });
                    toast.success("Teacher mapped successfully!");
                    setMapTeacherId('');
                    setMapClassId('');
                    setMapSubjectId('');
                    fetchMappings();
                  } catch (err) {
                    toast.error(err?.response?.data?.message || err?.response?.data?.detail || "Failed to create mapping");
                  } finally {
                    setIsSavingMapping(false);
                  }
                }} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Teacher *</label>
                    <select
                      value={mapTeacherId}
                      onChange={(e) => setMapTeacherId(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-amber-400 outline-none font-semibold"
                    >
                      <option value="">-- Select Teacher --</option>
                      {(Array.isArray(employees) ? employees : []).filter(emp => emp.role === 'teacher').map(tch => (
                        <option key={tch._id} value={tch._id}>{tch.name} ({tch.employeeId})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Class *</label>
                    <select
                      value={mapClassId}
                      onChange={(e) => setMapClassId(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-amber-400 outline-none font-semibold"
                    >
                      <option value="">-- Select Class --</option>
                      {classes.map(cls => (
                        <option key={cls._id} value={cls._id}>{cls.standard} - {cls.section} ({cls.board})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Subject *</label>
                    <select
                      value={mapSubjectId}
                      onChange={(e) => setMapSubjectId(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-amber-400 outline-none font-semibold"
                    >
                      <option value="">-- Select Subject --</option>
                      {subjects.map(sub => (
                        <option key={sub._id} value={sub._id}>{sub.name}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingMapping}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-stone-900 font-bold rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {isSavingMapping ? <span className="w-4 h-4 border-2 border-stone-900 border-t-transparent rounded-full animate-spin"></span> : 'Create Assignment'}
                  </button>
                </form>
              </div>

              {/* Mapping List Table */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-base font-bold text-stone-800">🔗 Active Assignments List</h3>
                {mappingsLoading ? (
                  <div className="text-center py-12"><Spinner size="md" /></div>
                ) : mappings.length === 0 ? (
                  <p className="text-center text-gray-400 py-12 bg-gray-50 rounded-2xl border border-gray-200">No teacher assignments mapped yet.</p>
                ) : (
                  <div className="overflow-x-auto border border-gray-200 rounded-2xl shadow-sm">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold text-xs uppercase">
                          <th className="px-4 py-3 text-left">Teacher</th>
                          <th className="px-4 py-3 text-left">Class</th>
                          <th className="px-4 py-3 text-left">Subject</th>
                          <th className="px-4 py-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {mappings.map((map) => (
                          <tr key={map._id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3.5">
                              <div className="font-bold text-stone-800">{map.teacher?.name || <span className="text-red-500 italic">Deleted Teacher</span>}</div>
                              <div className="text-xs text-gray-400 font-mono">{map.teacher?.employeeId || ''}</div>
                            </td>
                            <td className="px-4 py-3.5 font-semibold">
                              {map.class ? `${map.class.standard} - ${map.class.section}` : <span className="text-red-500 italic">Deleted Class</span>}
                            </td>
                            <td className="px-4 py-3.5 font-semibold text-amber-600">
                              {map.subject?.name || <span className="text-red-500 italic">Deleted Subject</span>}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <button
                                onClick={async () => {
                                  if (!window.confirm("Remove this class/subject teacher assignment?")) return;
                                  try {
                                    await deleteMapping(map._id);
                                    toast.success("Assignment removed successfully");
                                    fetchMappings();
                                  } catch (err) {
                                    toast.error("Failed to delete mapping");
                                  }
                                }}
                                className="w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white border border-red-200 transition-all flex items-center justify-center mx-auto"
                                title="Delete Assignment"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Timetable Management Tab */}
        {activeTab === 'timetable' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-8 text-gray-900">
            <div className="bg-gray-50 border-b border-gray-200 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                  📅 Timetable & Weekly Schedule Grid
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  Manage weekly scheduled classes, start/end times, subjects, and teacher assignments.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setEditingTimetableEntry(null);
                    setTimetableForm({
                      classId: classes[0]?._id || '',
                      day: 'Monday',
                      period: 1,
                      startTime: '09:00',
                      endTime: '09:45',
                      teacherId: employees.filter(emp => emp.role === 'teacher')[0]?._id || '',
                      subjectId: subjects[0]?._id || ''
                    });
                    setIsTimetableModalOpen(true);
                  }}
                  className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-stone-900 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  ➕ Add Entry
                </button>
                <button
                  onClick={printTimetable}
                  className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-xl text-xs font-bold text-stone-700 transition-all flex items-center gap-1.5 active:scale-95"
                >
                  🖨️ Export PDF / Print
                </button>
                <button
                  onClick={exportTimetableToCSV}
                  className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-xl text-xs font-bold text-stone-700 transition-all flex items-center gap-1.5 active:scale-95"
                >
                  📊 Export Excel (CSV)
                </button>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              
              {/* View Mode Toggle Switcher */}
              <div className="flex gap-2 bg-stone-50 p-2 rounded-xl border border-stone-200/60 no-print max-w-md">
                <button
                  type="button"
                  onClick={() => {
                    setTimetableViewMode('weekly_grid');
                    setSelectedTimetableClass('All');
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    timetableViewMode === 'weekly_grid'
                      ? 'bg-amber-500 text-stone-900 shadow-sm'
                      : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
                  }`}
                >
                  📅 Weekly Grid
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTimetableViewMode('class_grid');
                    if (classes.length > 0) {
                      setSelectedTimetableClass(classes[0]._id);
                    }
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    timetableViewMode === 'class_grid'
                      ? 'bg-amber-500 text-stone-900 shadow-sm'
                      : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
                  }`}
                >
                  🏫 Class Matrix View
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTimetableViewMode('list');
                    setSelectedTimetableClass('All');
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    timetableViewMode === 'list'
                      ? 'bg-amber-500 text-stone-900 shadow-sm'
                      : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
                  }`}
                >
                  📋 All Entries List
                </button>
              </div>

              {/* Class Matrix View Filters */}
              {timetableViewMode === 'class_grid' && (
                <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 flex flex-col sm:flex-row items-center gap-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-500 whitespace-nowrap">
                    View Timetable for Class:
                  </span>
                  <select
                    value={selectedTimetableClass}
                    onChange={(e) => setSelectedTimetableClass(e.target.value)}
                    className="w-full sm:w-64 px-4 py-2 bg-white border border-gray-300 rounded-xl text-gray-900 font-semibold focus:ring-2 focus:ring-amber-400 outline-none"
                  >
                    {classes.map(cls => (
                      <option key={cls._id} value={cls._id}>
                        Class {cls.standard} - {cls.section} ({cls.board})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {timetableLoading ? (
                <div className="flex justify-center py-12"><Spinner size="lg" /></div>
              ) : (
                <>
                  {/* 1. Weekly Grid View (Monday to Saturday, Columns: Time Slot, Class, Subject, Teacher) */}
                  {timetableViewMode === 'weekly_grid' && (
                    <div className="space-y-6 animate-fadeIn">
                      <div className="border-b border-stone-200 pb-3 flex justify-between items-center">
                        <h3 className="text-sm font-bold text-stone-700 uppercase tracking-wider">
                          Weekly Schedule Grid (Monday to Saturday)
                        </h3>
                        <span className="text-xs text-stone-400 italic">Click "Class Matrix View" to schedule directly</span>
                      </div>

                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((dayName) => {
                        const dayEntries = timetableEntries
                          .filter(e => e.day === dayName)
                          .sort((a, b) => a.period - b.period);

                        return (
                          <div key={dayName} className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3">
                            <h4 className="text-stone-900 font-extrabold text-sm flex items-center gap-2 border-b border-stone-100 pb-2">
                              <span>📅</span> {dayName}
                            </h4>
                            
                            {dayEntries.length === 0 ? (
                              <p className="text-stone-400 text-xs italic py-4 pl-2">No scheduled classes on this day.</p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-xs text-left border-collapse">
                                  <thead>
                                    <tr className="border-b border-stone-200 text-stone-450 font-bold uppercase tracking-wider">
                                      <th className="py-2.5 px-3">Time Slot</th>
                                      <th className="py-2.5 px-3">Class</th>
                                      <th className="py-2.5 px-3">Subject</th>
                                      <th className="py-2.5 px-3">Teacher</th>
                                      <th className="py-2.5 px-3 text-center no-print">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {dayEntries.map((e) => (
                                      <tr key={e._id} className="border-b border-stone-100 hover:bg-stone-50/50">
                                        <td className="py-3 px-3 font-mono font-bold text-amber-600">
                                          P{e.period} ({e.timeSlot})
                                        </td>
                                        <td className="py-3 px-3 font-bold text-stone-900">
                                          {e.class ? `${e.class.standard} - ${e.class.section} (${e.class.board})` : 'Unknown'}
                                        </td>
                                        <td className="py-3 px-3 font-bold text-stone-800">
                                          {e.subject?.name || 'Unknown'}
                                        </td>
                                        <td className="py-3 px-3 font-semibold text-stone-600">
                                          {e.teacher?.name || 'Unknown'}
                                        </td>
                                        <td className="py-3 px-3 text-center no-print">
                                          <div className="flex justify-center gap-2">
                                            <button
                                              onClick={() => {
                                                setEditingTimetableEntry(e);
                                                setTimetableForm({
                                                  classId: e.class?._id || '',
                                                  day: e.day,
                                                  period: e.period,
                                                  startTime: e.startTime || e.timeSlot.split('-')[0],
                                                  endTime: e.endTime || e.timeSlot.split('-')[1],
                                                  teacherId: e.teacher?._id || '',
                                                  subjectId: e.subject?._id || ''
                                                });
                                                setIsTimetableModalOpen(true);
                                              }}
                                              className="text-[10px] bg-blue-550 hover:bg-blue-600 text-white px-2 py-1 rounded transition-all"
                                              title="Edit"
                                            >
                                              ✏️ Edit
                                            </button>
                                            <button
                                              onClick={() => handleTimetableDelete(e._id)}
                                              className="text-[10px] bg-red-500 hover:bg-red-650 text-white px-2 py-1 rounded transition-all"
                                              title="Delete"
                                            >
                                              🗑️ Delete
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 2. Class Matrix View (Period 1 to 8 grid) */}
                  {timetableViewMode === 'class_grid' && selectedTimetableClass !== 'All' && (
                    <div id="print-section" className="space-y-4">
                      {/* Style tag for print layout formatting */}
                      <style>{`
                        @media print {
                          body * {
                            visibility: hidden;
                          }
                          #print-section, #print-section * {
                            visibility: visible;
                          }
                          #print-section {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100%;
                            background: white;
                            color: black;
                          }
                          .no-print {
                            display: none !important;
                          }
                        }
                      `}</style>
                      <div className="border-b border-stone-200 pb-3 flex justify-between items-center">
                        <h3 className="text-sm font-bold text-stone-700 uppercase tracking-wider">
                          Weekly Schedule Grid: Class {classes.find(c => c._id === selectedTimetableClass)?.standard} - {classes.find(c => c._id === selectedTimetableClass)?.section}
                        </h3>
                        <span className="no-print text-xs text-stone-400 italic">Click empty slots to schedule directly</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-gray-300 text-xs table-fixed min-w-[800px]">
                          <thead>
                            <tr className="bg-gray-150">
                              <th className="border border-gray-300 p-3 w-24 bg-gray-50 text-stone-700 font-extrabold uppercase text-center">Day / Period</th>
                              {[1, 2, 3, 4, 5, 6, 7, 8].map(pNum => (
                                <th key={pNum} className="border border-gray-300 p-3 text-stone-700 font-extrabold uppercase text-center">
                                  Period {pNum}
                                  {(() => {
                                    const found = timetableEntries.find(e => e.period === pNum);
                                    return found ? <span className="block text-[10px] font-mono font-medium text-gray-500 mt-1">({found.timeSlot})</span> : null;
                                  })()}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(dayName => (
                              <tr key={dayName} className="hover:bg-gray-50/20">
                                <td className="border border-gray-300 p-3 font-extrabold text-stone-900 bg-gray-50 text-center">{dayName}</td>
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(pNum => {
                                  const slot = timetableEntries.find(
                                    e => e.class?._id === selectedTimetableClass && e.day === dayName && e.period === pNum
                                  );

                                  if (slot) {
                                    return (
                                      <td key={pNum} className="border border-gray-300 p-3 relative bg-stone-50/70 hover:bg-stone-100/80 transition-colors group">
                                        <div className="space-y-1">
                                          <p className="font-extrabold text-stone-900 text-sm line-clamp-1">{slot.subject?.name}</p>
                                          <p className="text-stone-500 font-bold line-clamp-1">{slot.teacher?.name}</p>
                                          <p className="text-[10px] font-mono font-semibold text-amber-605">{slot.timeSlot}</p>
                                        </div>
                                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 no-print transition-all duration-200">
                                          <button
                                            onClick={() => {
                                              setEditingTimetableEntry(slot);
                                              setTimetableForm({
                                                classId: slot.class?._id || '',
                                                day: slot.day,
                                                period: slot.period,
                                                startTime: slot.startTime || slot.timeSlot.split('-')[0],
                                                endTime: slot.endTime || slot.timeSlot.split('-')[1],
                                                teacherId: slot.teacher?._id || '',
                                                subjectId: slot.subject?._id || ''
                                              });
                                              setIsTimetableModalOpen(true);
                                            }}
                                            className="w-6 h-6 rounded-full bg-blue-555 text-white flex items-center justify-center text-[10px] shadow"
                                            title="Edit"
                                          >
                                            ✏️
                                          </button>
                                          <button
                                            onClick={() => handleTimetableDelete(slot._id)}
                                            className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] shadow"
                                            title="Delete"
                                          >
                                            🗑️
                                          </button>
                                        </div>
                                      </td>
                                    );
                                  } else {
                                    return (
                                      <td key={pNum} className="border border-gray-300 p-3 text-center text-gray-350 bg-white no-print">
                                        <button
                                          onClick={() => {
                                            setEditingTimetableEntry(null);
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
                                            const dSlot = defaultSlots[pNum] || { s: '09:00', e: '09:45' };
                                            setTimetableForm({
                                              classId: selectedTimetableClass,
                                              day: dayName,
                                              period: pNum,
                                              startTime: dSlot.s,
                                              endTime: dSlot.e,
                                              teacherId: employees.filter(emp => emp.role === 'teacher')[0]?._id || '',
                                              subjectId: subjects[0]?._id || ''
                                            });
                                            setIsTimetableModalOpen(true);
                                          }}
                                          className="w-full py-4 text-center hover:bg-stone-50 text-gray-300 hover:text-amber-500 border border-dashed border-gray-200 rounded-lg transition-all"
                                          title="Add Schedule"
                                        >
                                          ➕ Add
                                        </button>
                                      </td>
                                    );
                                  }
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 3. List View of all entries */}
                  {timetableViewMode === 'list' && (
                    <div className="space-y-4">
                      {timetableEntries.length === 0 ? (
                        <p className="text-center text-gray-400 py-12 bg-gray-50 rounded-2xl border border-gray-200">No timetable entries registered yet.</p>
                      ) : (
                        <div className="overflow-x-auto border border-gray-200 rounded-2xl shadow-sm">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold text-xs uppercase">
                                <th className="px-4 py-3 text-left">Class</th>
                                <th className="px-4 py-3 text-left">Day</th>
                                <th className="px-4 py-3 text-center">Period</th>
                                <th className="px-4 py-3 text-center">Time Slot</th>
                                <th className="px-4 py-3 text-left">Subject</th>
                                <th className="px-4 py-3 text-left">Teacher</th>
                                <th className="px-4 py-3 text-center">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white font-medium">
                              {timetableEntries.map((e) => (
                                <tr key={e._id} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-4 py-3.5 font-bold">
                                    {e.class ? `Class ${e.class.standard} - ${e.class.section} (${e.class.board})` : <span className="text-red-500 italic">Deleted Class</span>}
                                  </td>
                                  <td className="px-4 py-3.5 font-bold text-stone-700">{e.day}</td>
                                  <td className="px-4 py-3.5 text-center font-mono font-bold">P{e.period}</td>
                                  <td className="px-4 py-3.5 text-center font-mono text-amber-600 font-semibold">{e.timeSlot}</td>
                                  <td className="px-4 py-3.5 text-stone-900 font-bold">{e.subject?.name || <span className="text-red-500 italic">Deleted Subject</span>}</td>
                                  <td className="px-4 py-3.5 text-stone-700 font-bold">{e.teacher?.name || <span className="text-red-500 italic">Deleted Teacher</span>}</td>
                                  <td className="px-4 py-3.5 text-center">
                                    <div className="flex gap-2 justify-center">
                                      <button
                                        onClick={() => {
                                          setEditingTimetableEntry(e);
                                          setTimetableForm({
                                            classId: e.class?._id || '',
                                            day: e.day,
                                            period: e.period,
                                            startTime: e.startTime || e.timeSlot.split('-')[0],
                                            endTime: e.endTime || e.timeSlot.split('-')[1],
                                            teacherId: e.teacher?._id || '',
                                            subjectId: e.subject?._id || ''
                                          });
                                          setIsTimetableModalOpen(true);
                                        }}
                                        className="w-8 h-8 rounded-full bg-blue-550 text-white hover:bg-blue-600 transition-all flex items-center justify-center shadow"
                                        title="Edit"
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        onClick={() => handleTimetableDelete(e._id)}
                                        className="w-8 h-8 rounded-full bg-red-500 text-white hover:bg-red-650 transition-all flex items-center justify-center shadow"
                                        title="Delete"
                                      >
                                        🗑️
                                      </button>
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
                </>
              )}
            </div>
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

      {/* Add Teacher Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-gray-200 rounded-3xl shadow-2xl p-8 w-full max-w-lg relative overflow-y-auto max-h-[90vh]">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-6 right-6 text-gray-500 hover:text-gray-900 bg-gray-100 rounded-full p-1 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              ➕ Add New Teacher
            </h3>

            <form onSubmit={handleAddTeacher} className="space-y-5 text-gray-900">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    placeholder="e.g. John Doe"
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Email *</label>
                  <input
                    type="email"
                    required
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    placeholder="e.g. teacher@school.com"
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Phone</label>
                  <input
                    type="text"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    placeholder="e.g. 9876543210"
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Employee ID</label>
                  <input
                    type="text"
                    value={addForm.employeeId}
                    onChange={(e) => setAddForm({ ...addForm, employeeId: e.target.value })}
                    placeholder="Auto-generated if blank"
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Qualification</label>
                  <input
                    type="text"
                    value={addForm.qualification}
                    onChange={(e) => setAddForm({ ...addForm, qualification: e.target.value })}
                    placeholder="e.g. M.Sc Mathematics"
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Experience (Years)</label>
                  <input
                    type="number"
                    min="0"
                    value={addForm.experience}
                    onChange={(e) => setAddForm({ ...addForm, experience: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Role</label>
                  <select
                    value={addForm.role}
                    onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all font-semibold"
                  >
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                    <option value="user">Employee</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Password</label>
                  <input
                    type="text"
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    placeholder="Default: Welcome@123"
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Create Login Account</label>
                    <p className="text-xs text-gray-500">Allow this teacher to login to the platform</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addForm.createLogin}
                      onChange={(e) => setAddForm({ ...addForm, createLogin: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-xl text-gray-700 font-bold transition-all active:scale-95 text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingFaculty}
                  className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-stone-900 font-bold rounded-xl shadow-lg transition-all active:scale-95 text-center disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isAddingFaculty ? <><span className="w-4 h-4 border-2 border-stone-900 border-t-transparent rounded-full animate-spin"></span> Adding...</> : 'Add Teacher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Teacher Modal */}
      {isEditModalOpen && editingFaculty && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-gray-200 rounded-3xl shadow-2xl p-8 w-full max-w-lg relative overflow-y-auto max-h-[90vh]">
            <button
              onClick={() => { setIsEditModalOpen(false); setEditingFaculty(null); }}
              className="absolute top-6 right-6 text-gray-500 hover:text-gray-900 bg-gray-100 rounded-full p-1 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              ✏️ Edit Teacher — {editingFaculty.name}
            </h3>

            <form onSubmit={handleEditTeacher} className="space-y-5 text-gray-900">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Email *</label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Phone</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Qualification</label>
                  <input
                    type="text"
                    value={editForm.qualification}
                    onChange={(e) => setEditForm({ ...editForm, qualification: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Experience (Years)</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.experience}
                    onChange={(e) => setEditForm({ ...editForm, experience: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Role</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all font-semibold"
                  >
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                    <option value="user">Employee</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div>
                    <span className="block text-xs font-bold text-gray-700">Skip Face</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={editForm.skip_face} onChange={(e) => setEditForm({ ...editForm, skip_face: e.target.checked })} className="sr-only peer" />
                    <div className="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div>
                    <span className="block text-xs font-bold text-gray-700">Skip Location</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={editForm.skip_location} onChange={(e) => setEditForm({ ...editForm, skip_location: e.target.checked })} className="sr-only peer" />
                    <div className="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div>
                    <span className="block text-xs font-bold text-gray-700">Active</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} className="sr-only peer" />
                    <div className="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => { setIsEditModalOpen(false); setEditingFaculty(null); }}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-xl text-gray-700 font-bold transition-all active:scale-95 text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingFaculty}
                  className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-stone-900 font-bold rounded-xl shadow-lg transition-all active:scale-95 text-center disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSavingFaculty ? <><span className="w-4 h-4 border-2 border-stone-900 border-t-transparent rounded-full animate-spin"></span> Saving...</> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Timetable Modal */}
      {isTimetableModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-gray-200 rounded-3xl shadow-2xl p-8 w-full max-w-md relative overflow-y-auto max-h-[90vh]">
            <button
              onClick={() => {
                setIsTimetableModalOpen(false);
                setEditingTimetableEntry(null);
              }}
              className="absolute top-6 right-6 text-gray-500 hover:text-gray-900 bg-gray-100 rounded-full p-1 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              📅 {editingTimetableEntry ? 'Edit Timetable Entry' : 'Add Timetable Entry'}
            </h3>

            <form onSubmit={handleTimetableSubmit} className="space-y-5 text-gray-900">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Class *</label>
                <select
                  required
                  value={timetableForm.classId}
                  onChange={(e) => setTimetableForm({ ...timetableForm, classId: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                >
                  <option value="">-- Select Class --</option>
                  {(Array.isArray(classes) ? classes : []).map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.standard} - {c.section}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Day *</label>
                <select
                  required
                  value={timetableForm.day}
                  onChange={(e) => setTimetableForm({ ...timetableForm, day: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                >
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Period *</label>
                <select
                  required
                  value={timetableForm.period}
                  onChange={(e) => setTimetableForm({ ...timetableForm, period: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                    <option key={p} value={p}>
                      Period {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Start Time *</label>
                  <input
                    type="time"
                    required
                    value={timetableForm.startTime}
                    onChange={(e) => setTimetableForm({ ...timetableForm, startTime: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">End Time *</label>
                  <input
                    type="time"
                    required
                    value={timetableForm.endTime}
                    onChange={(e) => setTimetableForm({ ...timetableForm, endTime: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Subject *</label>
                <select
                  required
                  value={timetableForm.subjectId}
                  onChange={(e) => setTimetableForm({ ...timetableForm, subjectId: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                >
                  <option value="">-- Select Subject --</option>
                  {(Array.isArray(subjects) ? subjects : []).map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Teacher *</label>
                <select
                  required
                  value={timetableForm.teacherId}
                  onChange={(e) => setTimetableForm({ ...timetableForm, teacherId: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                >
                  <option value="">-- Select Teacher --</option>
                  {(Array.isArray(employees) ? employees : []).filter(emp => emp.role === 'teacher').map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsTimetableModalOpen(false);
                    setEditingTimetableEntry(null);
                  }}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-xl text-gray-700 font-bold transition-all active:scale-95 text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingTimetable}
                  className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-stone-900 font-bold rounded-xl shadow-lg transition-all active:scale-95 text-center disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSavingTimetable ? (
                    <>
                      <span className="w-4 h-4 border-2 border-stone-900 border-t-transparent rounded-full animate-spin"></span>
                      Saving...
                    </>
                  ) : (
                    'Save Entry'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Save Changes Bar */}
      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-stone-900/90 text-white px-6 py-4 rounded-2xl shadow-2xl border border-amber-500/20 backdrop-blur-md flex items-center gap-6 z-[100]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
            <span className="text-sm font-medium text-amber-200">You have unsaved changes</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setEmployees(JSON.parse(JSON.stringify(originalEmployees)));
              }}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm font-bold transition-all active:scale-95"
            >
              Discard
            </button>
            <button
              onClick={handleSaveAllChanges}
              disabled={isSavingBulk}
              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-stone-900 font-bold rounded-lg shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              {isSavingBulk ? <><span className="w-4 h-4 border-2 border-stone-900 border-t-transparent rounded-full animate-spin"></span> Saving...</> : '💾 Save All Changes'}
            </button>
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
