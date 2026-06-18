/**
 * Authentication API service functions.
 * Wraps all auth-related HTTP calls.
 */
import api from './api';

/**
 * Register a new user with face images.
 * @param {Object} data - { name, email, phone, password, face_images: [base64...] }
 * @returns {Promise} API response
 */
export const registerUser = async (data) => {
  const response = await api.post('/auth/register', data);
  return response.data;
};

/**
 * Check if a user is already registered.
 * @param {string} email
 * @param {string} phone
 * @returns {Promise} API response
 */
export const checkUser = async (email, phone) => {
  try {
    const response = await api.post('/auth/check-user', { email, phone });
    return response.data;
  } catch (err) {
    const detail = err.response?.data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((e) => e.msg).join(', ')
      : detail || err.response?.data?.message || 'Server connection error';
    return { status: false, message: message };
  }
};

/**
 * Login with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise} API response with tokens
 */
export const loginWithPassword = async (email, password, location) => {
  const payload = { email, password, location };
  const response = await api.post('/auth/login', payload);
  return response.data;
};

/**
 * Securely change password for the authenticated user.
 * @param {string} oldPassword
 * @param {string} newPassword
 * @returns {Promise} API response
 */
export const changePassword = async (oldPassword, newPassword) => {
  const response = await api.post('/auth/change-password', { old_password: oldPassword, new_password: newPassword });
  return response.data;
};

/**
 * Get login/logout history for the authenticated user.
 * Admin can pass search query to filter by employee name/id.
 * @param {string} search - optional search query
 * @returns {Promise} API response with history array
 */
export const getLoginHistory = async (search = '') => {
  const params = search ? { search } : {};
  const response = await api.get('/auth/login-history', { params });
  return response.data;
};

/**
 * Verify face against stored embeddings.
 * @param {string} userId
 * @param {string} faceImage - Base64-encoded face image
 * @returns {Promise} Verification result
 */
export const verifyFace = async (userId, faceImage, challengeFrame = null, location = null) => {
  const payload = {
    user_id: userId,
    face_image: faceImage,
    location: location,
  };
  if (challengeFrame) {
    payload.challenge_frame = challengeFrame;
  }
  const response = await api.post('/auth/verify-face', payload);
  return response.data;
};

/**
 * Login using face recognition.
 * @param {string} userId
 * @param {string} faceImage - Base64-encoded face image
 * @returns {Promise} API response with tokens
 */
export const faceLogin = async (userId, faceImage, location, challengeFrame = null) => {
  try {
    const payload = {
      user_id: userId,
      face_image: faceImage,
      location: location,
    };
    if (challengeFrame) {
      payload.challenge_frame = challengeFrame;
    }
    const response = await api.post('/auth/face-login', payload);
    return response.data;
  } catch (err) {
    const detail = err.response?.data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((e) => e.msg).join(', ')
      : detail || 'Face login failed';
    return { status: false, message, confidence: null };
  }
};

/**
 * Get current user's profile.
 * @returns {Promise} User profile data
 */
export const getProfile = async () => {
  const response = await api.get('/auth/profile');
  return response.data;
};

/**
 * Health check.
 * @returns {Promise}
 */
export const healthCheck = async () => {
  const response = await api.get('/auth/health');
  return response.data;
};

/**
 * Add or update face data for the authenticated user.
 * @param {string[]} faceImages - Array of 4 base64-encoded face images
 * @returns {Promise} API response
 */
export const updateFaceData = async (faceImages) => {
  const response = await api.put('/auth/update-face', { face_images: faceImages });
  return response.data;
};

/**
 * Update the profile photo for the authenticated user.
 * @param {string} profilePhoto - Base64 encoded image string
 * @returns {Promise} API response
 */
export const updateProfilePhoto = async (profilePhoto) => {
  const response = await api.put('/auth/profile-photo', { profile_photo: profilePhoto });
  return response.data;
};

/**
 * Logout — records logout time in the database.
 * @param {Object} location - { latitude, longitude }
 * @returns {Promise} API response
 */
export const logoutUser = async (location = null) => {
  try {
    const response = await api.post('/auth/logout', { location });
    return response.data;
  } catch {
    // Silently fail — user is logging out anyway
    return { status: false };
  }
};

/**
 * Reverse-geocode latitude/longitude to human-readable address.
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise} { area, city, state, country, pincode, display_name }
 */
export const geocodeLocation = async (latitude, longitude) => {
  const response = await api.post('/auth/geocode', { latitude, longitude });
  return response.data;
};

export const getCompanySettings = async () => {
  const response = await api.get('/auth/settings');
  return response.data;
};

export const updateCompanySettings = async (settings) => {
  try {
    const response = await api.post('/auth/settings', settings);
    return response.data;
  } catch (err) {
    const detail = err.response?.data?.detail;
    if (detail) throw new Error(Array.isArray(detail) ? detail.map(e => e.msg).join(', ') : detail);
    throw new Error(err.response?.data?.message || 'Failed to update company settings');
  }
};

export const getAttendanceLogs = async () => {
  const response = await api.get('/auth/attendance');
  return response.data;
};

export const punchIn = async (employee_id, face_image = null, challenge_frame = null, location = null) => {
  const response = await api.post('/auth/attendance/punch-in', { 
    employee_id,
    face_image,
    challenge_frame,
    location
  });
  return response.data;
};

export const punchOut = async (employee_id) => {
  const response = await api.post('/auth/attendance/punch-out', { employee_id });
  return response.data;
};

export const verifyLogout = async (employee_id, face_image = null, challenge_frame = null, location = null) => {
  const response = await api.post('/auth/attendance/verify-logout', {
    employee_id,
    face_image,
    challenge_frame,
    location
  });
  return response.data;
};

export const getAttendanceStatus = async (employee_id) => {
  const response = await api.get(`/auth/attendance/status/${employee_id}`);
  return response.data;
};

export const kioskGetEmployee = async (employee_id) => {
  const response = await api.get(`/auth/kiosk/${employee_id}`);
  return response.data;
};

export const kioskLogoutEmployee = async (employee_id, login_time, duration_minutes, face_image = null, challenge_frame = null, location = null) => {
  const response = await api.post('/auth/kiosk/logout', { 
    employee_id, 
    login_time, 
    duration_minutes,
    face_image,
    challenge_frame,
    location
  });
  return response.data;
};

export const getConsolidatedReport = async (month, year, department = '') => {
  const params = {};
  if (month) params.month = month;
  if (year) params.year = year;
  if (department) params.department = department;
  const response = await api.get('/auth/attendance/report/consolidated', { params });
  return response.data;
};

export const getDetailsReport = async (month, year, employee_id = '', department = '') => {
  const params = {};
  if (month) params.month = month;
  if (year) params.year = year;
  if (employee_id) params.employee_id = employee_id;
  if (department) params.department = department;
  const response = await api.get('/auth/attendance/report/details', { params });
  return response.data;
};

// ── Admin Employee Management ──

export const getAdminEmployees = async () => {
  const response = await api.get('/auth/admin/employees');
  return response.data;
};

export const updateEmployeeSettings = async (employeeId, settings) => {
  const response = await api.put(`/auth/admin/employee/${employeeId}/settings`, settings);
  return response.data;
};

export const deleteEmployee = async (employeeId) => {
  const response = await api.delete(`/auth/admin/employee/${employeeId}`);
  return response.data;
};

export const resetEmployeePassword = async (employeeId, newPassword) => {
  const response = await api.post(`/auth/admin/employee/${employeeId}/reset-password`, { new_password: newPassword });
  return response.data;
};

export const exportAttendanceExcel = async (reportType = 'consolidated', month, year, department = '', employeeId = '') => {
  const params = { report_type: reportType };
  if (month) params.month = month;
  if (year) params.year = year;
  if (department) params.department = department;
  if (employeeId) params.employee_id = employeeId;
  const response = await api.get('/auth/attendance/export', { params, responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `attendance_${reportType}_${year}_${String(month).padStart(2,'0')}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const getDailyStatus = async (dateStr = '') => {
  const params = dateStr ? { date_str: dateStr } : {};
  const response = await api.get('/auth/attendance/daily-status', { params });
  return response.data;
};

export const uploadEmployeeDocument = async (employeeId, documentType, file) => {
  const formData = new FormData();
  formData.append('document_type', documentType);
  formData.append('file', file);
  const response = await api.post(`/auth/admin/employee/${employeeId}/upload-document`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const downloadEmployeeDocument = async (employeeId, documentType, filename) => {
  const response = await api.get(`/auth/admin/employee/${employeeId}/download-document/${documentType}`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// ── Customers ──

export const getCustomers = async () => {
  const response = await api.get('/customers');
  return response.data;
};

export const createCustomer = async (data) => {
  const response = await api.post('/customers', data);
  return response.data;
};

export const updateCustomer = async (customerId, data) => {
  const response = await api.put(`/customers/${customerId}`, data);
  return response.data;
};

// ── Inventory ──

export const getInventory = async () => {
  const response = await api.get('/inventory');
  return response.data;
};

export const createInventory = async (data) => {
  const response = await api.post('/inventory', data);
  return response.data;
};

export const updateInventory = async (productId, data) => {
  const response = await api.put(`/inventory/${productId}`, data);
  return response.data;
};

// ── Measurements ──

export const getMeasurements = async () => {
  const response = await api.get('/measurements');
  return response.data;
};

export const createMeasurement = async (data) => {
  const response = await api.post('/measurements', data);
  return response.data;
};

export const updateMeasurement = async (id, data) => {
  const response = await api.put(`/measurements/${id}`, data);
  return response.data;
};

export const deleteMeasurement = async (id) => {
  const response = await api.delete(`/measurements/${id}`);
  return response.data;
};

// ── Orders ──

export const getOrders = async () => {
  const response = await api.get('/orders');
  return response.data;
};

export const createOrder = async (data) => {
  const response = await api.post('/orders', data);
  return response.data;
};

export const updateOrder = async (id, data) => {
  const response = await api.put(`/orders/${id}`, data);
  return response.data;
};

export const deleteOrder = async (id) => {
  const response = await api.delete(`/orders/${id}`);
  return response.data;
};

// ── Roles ──

export const getRoles = async () => {
  const response = await api.get('/roles');
  return response.data;
};

export const createRole = async (data) => {
  const response = await api.post('/roles', data);
  return response.data;
};

export const updateRole = async (id, data) => {
  const response = await api.put(`/roles/${id}`, data);
  return response.data;
};

export const deleteRole = async (id) => {
  const response = await api.delete(`/roles/${id}`);
  return response.data;
};

// ── Additional Deletions ──

export const deleteCustomer = async (id) => {
  const response = await api.delete(`/customers/${id}`);
  return response.data;
};

export const deleteInventory = async (id) => {
  const response = await api.delete(`/inventory/${id}`);
  return response.data;
};

// ── School Management APIs ──

// Classes
export const getClasses = async () => {
  const response = await api.get('/classes');
  return response.data;
};

export const createClass = async (data) => {
  const response = await api.post('/classes', data);
  return response.data;
};

export const deleteClass = async (id) => {
  const response = await api.delete(`/classes/${id}`);
  return response.data;
};

// Subjects
export const getSubjects = async () => {
  const response = await api.get('/subjects');
  return response.data;
};

export const createSubject = async (data) => {
  const response = await api.post('/subjects', data);
  return response.data;
};

export const deleteSubject = async (id) => {
  const response = await api.delete(`/subjects/${id}`);
  return response.data;
};

// Subject Teacher Mappings
export const getMappings = async () => {
  const response = await api.get('/subjects/mappings');
  return response.data;
};

export const createMapping = async (data) => {
  const response = await api.post('/subjects/mappings', data);
  return response.data;
};

export const deleteMapping = async (id) => {
  const response = await api.delete(`/subjects/mappings/${id}`);
  return response.data;
};

// Faculty Adding
export const addTeacher = async (data) => {
  const response = await api.post('/faculty/teacher', data);
  return response.data;
};

export const addNonTeachingStaff = async (data) => {
  const response = await api.post('/faculty/non-teaching', data);
  return response.data;
};

// Timetable
export const getTimetables = async () => {
  const response = await api.get('/timetables');
  return response.data;
};

export const createTimetableEntry = async (data) => {
  const response = await api.post('/timetables', data);
  return response.data;
};

export const deleteTimetableEntry = async (id) => {
  const response = await api.delete(`/timetables/${id}`);
  return response.data;
};

// Leaves & Substitutes
export const requestLeave = async (leaveDate, reason) => {
  const response = await api.post('/leaves/request', { leaveDate, reason });
  return response.data;
};

export const getLeaveRequests = async () => {
  const response = await api.get('/leaves/requests');
  return response.data;
};

export const getSubstituteSuggestions = async (teacherId, date) => {
  const response = await api.get('/leaves/substitute-suggestions', {
    params: { teacherId, date }
  });
  return response.data;
};

export const approveLeave = async (id, status, substituteAllocations) => {
  const response = await api.post(`/leaves/approve/${id}`, { status, substituteAllocations });
  return response.data;
};

export const assignSubstituteDirectly = async (data) => {
  const response = await api.post('/leaves/assign-substitute-directly', data);
  return response.data;
};

// Student Attendance
export const getStudentAttendance = async (standard, section, date) => {
  const response = await api.get('/attendance/students', {
    params: { standard, section, date }
  });
  return response.data;
};

export const markStudentAttendance = async (data) => {
  const response = await api.post('/attendance/students', data);
  return response.data;
};

// Dashboards
export const getTeacherDashboard = async () => {
  const response = await api.get('/dashboard/teacher');
  return response.data;
};

export const getAdminDashboard = async () => {
  const response = await api.get('/dashboard/admin');
  return response.data;
};

export const classLogin = async (classId, period, subjectId, location, teacherId = null) => {
  const response = await api.post('/attendance/class-login', { classId, period, subjectId, location, teacherId });
  return response.data;
};

export const classLogout = async (classId, period, location, teacherId = null) => {
  const response = await api.post('/attendance/class-logout', { classId, period, location, teacherId });
  return response.data;
};

export const createTeacherSchedule = async (data) => {
  const response = await api.post('/timetables/teacher-schedule', data);
  return response.data;
};

// ── Dashboard Stats ──

export const getConsolidatedDashboardStats = async () => {
  const response = await api.get('/dashboard/consolidated-stats');
  return response.data;
};

export const getIndividualDashboardStats = async (teacherId) => {
  const response = await api.get(`/dashboard/individual-stats/${teacherId}`);
  return response.data;
};

// ── Timetable & Dashboard Monitoring Module APIs ──

export const updateTimetableEntry = async (id, data) => {
  const response = await api.put(`/timetables/${id}`, data);
  return response.data;
};

export const getClassStatus = async (params = {}) => {
  const response = await api.get('/dashboard/class-status', { params });
  return response.data;
};

export const getMonitoringStats = async (date = '') => {
  const params = date ? { date } : {};
  const response = await api.get('/dashboard/monitoring-stats', { params });
  return response.data;
};

export const getAuditLogs = async () => {
  const response = await api.get('/dashboard/audit-logs');
  return response.data;
};

export const getClassHistory = async (classId) => {
  const response = await api.get(`/dashboard/class-history/${classId}`);
  return response.data;
};


