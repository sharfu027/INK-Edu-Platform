/**
 * Registration Page — Full user registration flow.
 *
 * Step 1: Fill in personal details (name, email, phone, password).
 * Step 2: Face capture in 4 directions with liveness detection.
 * Step 3: Submit registration with face images.
 */
import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import FaceCaptureRegistration from '../components/face/FaceCaptureRegistration';
import Spinner from '../components/ui/Spinner';
import { registerUser, checkUser } from '../services/authService';
import useGeolocation from '../hooks/useGeolocation';
import { QRCodeSVG } from 'qrcode.react';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { position: geoPosition, loading: geoLoading, permissionDenied: geoDenied, error: geoErrorFromHook, refresh: geoRefresh } = useGeolocation({ watch: false });

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    designation: '',
    role: 'teacher',
    joiningDate: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [step, setStep] = useState(1); // 1 = form, 2 = face capture, 3 = submitting, 4 = success QR
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [spoofError, setSpoofError] = useState(null);
  const [registeredEmpId, setRegisteredEmpId] = useState(null);

  /**
   * Handle form field changes.
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  /**
   * Validate form fields before proceeding.
   */
  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      newErrors.name = 'Full name is required (at least 2 characters)';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Valid email address is required';
    }

    const phoneRegex = /^\+?\d{10,15}$/;
    const cleanedPhone = formData.phone.replace(/[\s\-()]/g, '');
    if (!phoneRegex.test(cleanedPhone)) {
      newErrors.phone = 'Valid phone number is required (10-15 digits)';
    }

    if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else {
      if (!/[A-Z]/.test(formData.password)) newErrors.password = 'Must contain uppercase letter';
      if (!/[a-z]/.test(formData.password)) newErrors.password = 'Must contain lowercase letter';
      if (!/\d/.test(formData.password)) newErrors.password = 'Must contain a digit';
      if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) newErrors.password = 'Must contain a special character';
    }

    if (!formData.designation.trim() || formData.designation.trim().length < 2) {
      newErrors.designation = 'Designation is required';
    }

    if (!formData.joiningDate) {
      newErrors.joiningDate = 'Joining date is required';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Proceed to face capture step.
   */
  const handleNext = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      // ── MANDATORY GPS CHECK ──
      if (!geoPosition || !geoPosition.latitude || !geoPosition.longitude) {
        if (geoDenied) {
          toast.error('Location permission denied. Please enable GPS in your browser settings and refresh the page.');
        } else if (geoErrorFromHook) {
          toast.error('GPS location not available. Please enable Location Services and try again.');
        } else {
          toast.error('Acquiring your GPS location... Please wait a moment and try again.');
          geoRefresh();
        }
        return;
      }

      setIsSubmitting(true);
      const emailToCheck = formData.email.trim().toLowerCase();
      const phoneToCheck = formData.phone.replace(/[\s\-()]/g, '');
      const result = await checkUser(emailToCheck, phoneToCheck);
      setIsSubmitting(false);
      
      if (result.status) {
        setStep(2);
      } else {
        const errorMsg = result.message || 'User already registered';
        if (errorMsg.toLowerCase().includes('email') && errorMsg.toLowerCase().includes('phone')) {
          setErrors(prev => ({ ...prev, email: errorMsg, phone: errorMsg }));
          toast.error(errorMsg);
        } else if (errorMsg.toLowerCase().includes('email')) {
          setErrors(prev => ({ ...prev, email: errorMsg }));
          toast.error(errorMsg);
        } else if (errorMsg.toLowerCase().includes('phone')) {
          setErrors(prev => ({ ...prev, phone: errorMsg }));
          toast.error(errorMsg);
        } else {
          toast.error(errorMsg);
        }
      }
    }
  };

  /**
   * Handle face capture completion — submit the full registration.
   */
  const handleFaceCaptureComplete = useCallback(
    async (faceImages) => {
      setStep(3);
      setIsSubmitting(true);

      try {
        const payload = {
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.replace(/[\s\-()]/g, ''),
          password: formData.password,
          designation: formData.designation.trim(),
          role: formData.role,
          profession: formData.role === 'admin' ? 'Admin' : formData.role === 'teacher' ? 'Teacher' : formData.role === 'principal' ? 'Principal' : formData.role === 'hod' ? 'HOD' : 'Staff',
          joining_date: formData.joiningDate,
          face_images: faceImages,
          location: {
            latitude: geoPosition.latitude,
            longitude: geoPosition.longitude,
          }
        };

        const result = await registerUser(payload);

        if (result.status) {
          toast.success('Registration successful!');
          setRegisteredEmpId(result.employee_id);
          setStep(4);
        } else {
          // If spoofing is detected, show the RED overlay on the camera stream
          if (result.message && result.message.toLowerCase().includes('spoof')) {
            setSpoofError(result.message);
          } else {
            toast.error(result.message || 'Registration failed');
          }
          setStep(2);
        }
      } catch (err) {
        if (err.isTimeout || err.friendlyMessage) {
          toast.error(err.friendlyMessage || 'Server is starting up — please try again in a few seconds.');
          setStep(2);
          return;
        }
        const detail = err.response?.data?.detail;
        const errorMsg = Array.isArray(detail) ? detail.map(e => e.msg).join(', ') : detail || 'Registration failed. Please try again.';
        
        if (typeof errorMsg === 'string' && errorMsg.toLowerCase().includes('spoof')) {
          setSpoofError(errorMsg);
        } else {
          toast.error(errorMsg);
        }
        setStep(2);
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, navigate]
  );

  /**
   * Skip face registration — register with password only.
   * Used when camera is not available.
   */
  const handleSkipFaceRegistration = useCallback(async () => {
    setStep(3);
    setIsSubmitting(true);

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.replace(/[\s\-()]/g, ''),
        password: formData.password,
        designation: formData.designation.trim(),
        role: formData.role,
        profession: formData.role === 'admin' ? 'Admin' : formData.role === 'teacher' ? 'Teacher' : formData.role === 'principal' ? 'Principal' : formData.role === 'hod' ? 'HOD' : 'Staff',
        joining_date: formData.joiningDate,
        face_images: [],
        location: {
          latitude: geoPosition.latitude,
          longitude: geoPosition.longitude,
        }
      };

      const result = await registerUser(payload);

      if (result.status) {
        toast.success('Registration successful (without face data).');
        setRegisteredEmpId(result.employee_id);
        setStep(4);
      } else {
        toast.error(result.message || 'Registration failed');
        setStep(2);
      }
    } catch (err) {
      if (err.isTimeout || err.friendlyMessage) {
        toast.error(err.friendlyMessage || 'Server is starting up — please try again in a few seconds.');
        setStep(2);
        return;
      }
      const detail = err.response?.data?.detail;
      const errorMsg = Array.isArray(detail) ? detail.map(e => e.msg).join(', ') : detail || 'Registration failed. Please try again.';
      toast.error(errorMsg);
      setStep(2);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, navigate]);

  const downloadQR = () => {
    const svg = document.getElementById("qr-code-svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width + 40;
      canvas.height = img.height + 40;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 20, 20);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `QR_${registeredEmpId || 'ID'}.png`;
      downloadLink.href = `${pngFile}`;
      downloadLink.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-white flex items-center justify-center px-3 py-6 sm:p-4">
      <div className="w-full max-w-xl">
        {/* Card */}
        <div className="bg-stone-900/80 backdrop-blur-xl rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 border border-amber-600/15 golden-glow">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl overflow-hidden p-1 border border-amber-500/20">
              <img src="/logo.png" alt="Ink Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-amber-50">Create Account</h1>
            <p className="text-amber-200/50 mt-1">
              {step === 1 && 'Fill in your details to get started'}
              {step === 2 && 'Capture your face for secure authentication'}
              {step === 3 && 'Completing registration...'}
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-amber-500' : 'bg-stone-700'}`} />
            <div className={`w-12 h-0.5 ${step >= 2 ? 'bg-amber-500' : 'bg-stone-700'}`} />
            <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-amber-500' : 'bg-stone-700'}`} />
            <div className={`w-12 h-0.5 ${step >= 3 ? 'bg-amber-500' : 'bg-stone-700'}`} />
            <div className={`w-3 h-3 rounded-full ${step >= 3 ? 'bg-amber-500' : 'bg-stone-700'}`} />
          </div>

          {/* Step 1: Form */}
          {step === 1 && (
            <form onSubmit={handleNext} className="space-y-4">
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-amber-200/80 mb-1">
                  Full Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors bg-stone-800/60 text-amber-50 placeholder-amber-200/30 ${
                    errors.name ? 'border-red-400' : 'border-amber-700/30'
                  }`}
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-amber-200/80 mb-1">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john@example.com"
                  className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors bg-stone-800/60 text-amber-50 placeholder-amber-200/30 ${
                    errors.email ? 'border-red-400' : 'border-amber-700/30'
                  }`}
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-amber-200/80 mb-1">
                  Phone Number
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1234567890"
                  className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors bg-stone-800/60 text-amber-50 placeholder-amber-200/30 ${
                    errors.phone ? 'border-red-400' : 'border-amber-700/30'
                  }`}
                />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
              </div>

              {/* Auto-Generated Employee ID */}
              <div>
                <label className="block text-sm font-medium text-amber-200/80 mb-1 flex items-center gap-1">
                  Faculty/Staff ID
                  <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-semibold">Auto</span>
                </label>
                <input
                  type="text"
                  disabled
                  value="Generated automatically upon registration"
                  className="w-full px-4 py-2.5 border border-amber-700/20 bg-stone-800/30 text-amber-200/40 rounded-lg outline-none cursor-not-allowed"
                />
              </div>

              {/* Role Selection */}
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-amber-200/80 mb-1">
                  Institution Role
                </label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-amber-700/30 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors bg-stone-800/60 text-amber-50"
                >
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                  <option value="principal">Principal</option>
                  <option value="hod">Head of Department (HOD)</option>
                  <option value="staff">Non-Teaching Staff</option>
                </select>
              </div>

              {/* Designation */}
              <div>
                <label htmlFor="designation" className="block text-sm font-medium text-amber-200/80 mb-1">
                  Designation
                </label>
                <input
                  id="designation"
                  name="designation"
                  type="text"
                  value={formData.designation}
                  onChange={handleChange}
                  placeholder="e.g. Mathematics Teacher, Physics HOD, Clerk"
                  className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors bg-stone-800/60 text-amber-50 placeholder-amber-200/30 ${
                    errors.designation ? 'border-red-400' : 'border-amber-700/30'
                  }`}
                />
                {errors.designation && <p className="text-red-500 text-xs mt-1">{errors.designation}</p>}
              </div>



              <div className="grid grid-cols-1 gap-4">
                {/* Joining Date */}
                <div>
                  <label htmlFor="joiningDate" className="block text-sm font-medium text-amber-200/80 mb-1">
                    Joining Date
                  </label>
                  <input
                    id="joiningDate"
                    name="joiningDate"
                    type="date"
                    value={formData.joiningDate}
                    onChange={handleChange}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors bg-stone-800/60 text-amber-50 ${
                      errors.joiningDate ? 'border-red-400' : 'border-amber-700/30'
                    }`}
                  />
                  {errors.joiningDate && <p className="text-red-500 text-xs mt-1">{errors.joiningDate}</p>}
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-amber-200/80 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Min 8 chars, uppercase, digit, special"
                  className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors bg-stone-800/60 text-amber-50 placeholder-amber-200/30 ${
                    errors.password ? 'border-red-400' : 'border-amber-700/30'
                  }`}
                />
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-amber-200/80 mb-1">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter your password"
                  className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors bg-stone-800/60 text-amber-50 placeholder-amber-200/30 ${
                    errors.confirmPassword ? 'border-red-400' : 'border-amber-700/30'
                  }`}
                />
                {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
              </div>

              {/* ── Registration Location Status ── */}
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm ${
                geoPosition
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : geoDenied
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}>
                {geoPosition ? (
                  <>
                    <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                    <div className="flex-1">
                      <span className="font-medium">📍 Registration location captured</span>
                      <p className="text-xs text-green-500 mt-0.5">You will only be able to login from this area (100m radius)</p>
                    </div>
                    <span className="text-xs text-green-500 font-mono">
                      {geoPosition.latitude.toFixed(4)}, {geoPosition.longitude.toFixed(4)}
                    </span>
                  </>
                ) : geoDenied ? (
                  <>
                    <div className="w-2.5 h-2.5 bg-red-500 rounded-full" />
                    <div className="flex-1">
                      <span className="font-medium">⚠️ Location denied</span>
                      <p className="text-xs text-red-500 mt-0.5">Click 🔒 in address bar → Allow location for login security</p>
                    </div>
                    <button onClick={geoRefresh} className="text-xs bg-red-100 hover:bg-red-200 px-2 py-1 rounded font-medium transition-colors">Retry</button>
                  </>
                ) : (
                  <>
                    <div className="w-2.5 h-2.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    <span className="font-medium">Detecting your location...</span>
                  </>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-600 text-stone-900 rounded-lg hover:from-amber-600 hover:to-yellow-700 font-bold transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                {isSubmitting ? 'Checking details...' : 'Next: Face Registration →'}
              </button>
            </form>
          )}

          {/* Step 2: Face Capture */}
          {step === 2 && (
            <div>
              <FaceCaptureRegistration
                onCaptureComplete={handleFaceCaptureComplete}
                onCancel={() => setStep(1)}
                spoofError={spoofError}
                onDismissSpoof={() => setSpoofError(null)}
              />
              {/* Skip option for users without camera */}
              <div className="mt-4 pt-4 border-t border-amber-700/20 text-center">
                <p className="text-sm text-amber-200/50 mb-2">
                  Camera not available?
                </p>
                <button
                  onClick={handleSkipFaceRegistration}
                  disabled={isSubmitting}
                  className="text-sm text-amber-400 hover:text-amber-300 underline font-medium transition-colors"
                >
                  Register without face data →
                </button>
                <p className="text-xs text-amber-200/30 mt-1">
                  You can add face data later. Login will use email + password only.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Submitting */}
          {step === 3 && (
            <div className="text-center py-12">
              <Spinner size="lg" className="mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-amber-50">Creating your account...</h3>
              <p className="text-amber-200/50 mt-2">Processing face data and securing your account.</p>
            </div>
          )}

          {/* Step 4: Success & QR Code */}
          {step === 4 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-amber-50 mb-2">Registration Complete!</h3>
              <p className="text-amber-200/50 mb-6">Your account has been created successfully. Download your ID card below to easily punch in and out using the scanner.</p>
              
              <div className="bg-stone-800/50 p-6 rounded-2xl flex flex-col items-center justify-center mb-6 border border-amber-600/20">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-amber-200/30 mb-3 relative">
                  <QRCodeSVG 
                    id="qr-code-svg"
                    value={JSON.stringify({ employee_id: registeredEmpId, name: formData.name })} 
                    size={200}
                    level={"H"}
                    includeMargin={false}
                  />
                </div>
                <div className="text-center">
                  <p className="font-bold text-amber-50 text-lg">{formData.name}</p>
                  <p className="text-amber-400 font-mono text-sm">{registeredEmpId}</p>
                  <p className="text-amber-200/40 text-xs mt-1">{formData.designation}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={downloadQR}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-stone-900 font-bold rounded-xl shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download ID Card
                </button>
                <button 
                  onClick={() => navigate('/login')}
                  className="flex-1 py-3 px-4 bg-stone-800 hover:bg-stone-700 text-amber-100 font-bold rounded-xl transition-colors border border-amber-700/20"
                >
                  Go to Login
                </button>
              </div>
            </div>
          )}

          {/* Footer link */}
          <div className="text-center mt-6 text-sm text-amber-200/40">
            Already have an account?{' '}
            <Link to="/login" className="text-amber-400 hover:underline font-medium">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
