/**
 * Navbar component with authentication-aware navigation.
 * Fully responsive — hamburger menu on mobile, inline links on desktop.
 * Golden Theme Edition. Active page is highlighted.
 */
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { 
  changePassword, 
  updateProfilePhoto,
  getCompanySettings,
  updateCompanySettings,
  geocodeLocation
} from '../../services/authService';
import { QRCodeSVG } from 'qrcode.react';
import useGeolocation from '../../hooks/useGeolocation';
import { reverseGeocodeClient } from '../../utils/geocodeClient';
import toast from 'react-hot-toast';


const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const currentLang = i18n.language?.substring(0, 2) || 'en';
  
  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    i18n.changeLanguage(newLang);
    localStorage.setItem('i18nextLng', newLang);
    document.documentElement.lang = newLang;
    window.dispatchEvent(new Event('languageChanged'));
  };

  return (
    <select 
      className="text-xs sm:text-sm bg-stone-800 border border-amber-700/30 rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-amber-500 mr-2 text-amber-100 flex-shrink-0"
      value={currentLang} 
      onChange={handleLanguageChange}
    >
      <option value="en">English</option>
      <option value="kn">ಕನ್ನಡ</option>
      <option value="hi">हिंदी</option>
      <option value="bn">বাংলা</option>
      <option value="mr">मराठी</option>
      <option value="te">తెలుగు</option>
    </select>
  );
};

const Navbar = () => {
  const { isAuthenticated, isFaceVerified, user, logout, faceVerified } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Open profile modal via custom event from sidebar
  useEffect(() => {
    const handleOpenProfile = () => setProfileModalOpen(true);
    window.addEventListener('openProfileModal', handleOpenProfile);
    return () => window.removeEventListener('openProfileModal', handleOpenProfile);
  }, []);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [dropdownRect, setDropdownRect] = useState(null);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);

  // Profile and Modal States
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const profileDropdownRef = useRef(null);

  // Form states for password change
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwSubmitting, setPwSubmitting] = useState(false);

  // Profile Photo Upload state
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');

  // Live Geolocation and Address resolution states for Profile Modal
  const { position: geoPos } = useGeolocation({ watch: profileModalOpen });
  const [liveAddress, setLiveAddress] = useState(null);
  const [addressLoading, setAddressLoading] = useState(false);

  // Admin company configuration states inside profile details modal
  const [adminSettings, setAdminSettings] = useState({
    hours_per_day: 8.0,
    weekly_off: 'Sunday'
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Retrieve global settings if admin when modal is opened
  useEffect(() => {
    if (profileModalOpen && (user?.role?.toLowerCase() === 'admin' || user?.isAdmin)) {
      getCompanySettings().then(res => {
        if (res?.data) {
          setAdminSettings({
            hours_per_day: res.data.hours_per_day || 8.0,
            weekly_off: res.data.weekly_off || 'Sunday'
          });
        }
      }).catch(err => console.error("Failed to load settings in profile modal:", err));
    }
  }, [profileModalOpen, user]);

  const handleSaveSettings = async () => {
    try {
      setIsSavingSettings(true);
      await updateCompanySettings({
        hours_per_day: parseFloat(adminSettings.hours_per_day),
        hours_per_week: parseFloat(adminSettings.hours_per_day) * 5,
        hours_per_month: parseFloat(adminSettings.hours_per_day) * 20,
        hours_per_year: parseFloat(adminSettings.hours_per_day) * 240,
        weekly_off: adminSettings.weekly_off
      });
      toast.success("Global company settings updated successfully!");
    } catch (err) {
      toast.error(err.message || "Failed to update settings");
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Reverse geocode live coordinates when position changes
  useEffect(() => {
    if (!geoPos || !profileModalOpen) return;
    let cancelled = false;

    const timeoutId = setTimeout(() => {
      const fetchAddr = async () => {
        setAddressLoading(true);
        try {
          const res = await geocodeLocation(geoPos.latitude, geoPos.longitude);
          if (!cancelled && res?.data && (res.data.area || res.data.road || res.data.display_name)) {
            setLiveAddress(res.data);
            setAddressLoading(false);
            return;
          }
        } catch { /* backend failed */ }

        try {
          const clientResult = await reverseGeocodeClient(geoPos.latitude, geoPos.longitude);
          if (!cancelled) setLiveAddress(clientResult);
        } catch { /* both failed */ }
        finally { if (!cancelled) setAddressLoading(false); }
      };
      fetchAddr();
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [
    geoPos ? Math.round(geoPos.latitude * 1000) : null,
    geoPos ? Math.round(geoPos.longitude * 1000) : null,
    profileModalOpen
  ]);

  // QR Code download helper
  const downloadQR = () => {
    const svg = document.getElementById("navbar-employee-qr-code");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `QR_${user?.employee_id || 'employee'}.png`;
      downloadLink.href = `${pngFile}`;
      downloadLink.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target) &&
        (!document.getElementById('inventory-portal-dropdown') || 
         !document.getElementById('inventory-portal-dropdown').contains(event.target))
      ) {
        setInventoryOpen(false);
      }
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target)
      ) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => {
    if (inventoryOpen) {
      setInventoryOpen(false);
    } else {
      if (triggerRef.current) {
        setDropdownRect(triggerRef.current.getBoundingClientRect());
      }
      setInventoryOpen(true);
    }
  };

  useEffect(() => {
    if (inventoryOpen && triggerRef.current) {
      const updateRect = () => {
        setDropdownRect(triggerRef.current.getBoundingClientRect());
      };
      window.addEventListener('scroll', updateRect, true);
      window.addEventListener('resize', updateRect);
      return () => {
        window.removeEventListener('scroll', updateRect, true);
        window.removeEventListener('resize', updateRect);
      };
    }
  }, [inventoryOpen]);

  const handleLogout = async () => {
    let loc = null;
    try {
      if ("geolocation" in navigator) {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      }
    } catch (err) {
      console.warn("Location capture failed for logout:", err);
    }
    
    logout(loc);
    setMobileOpen(false);
    setProfileOpen(false);
    navigate('/login');
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPwError('All fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters long.');
      return;
    }

    setPwSubmitting(true);
    try {
      const res = await changePassword(oldPassword, newPassword);
      if (res.status) {
        setPwSuccess('Password changed successfully!');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setChangePasswordModalOpen(false), 2000);
      } else {
        setPwError(res.message || 'Failed to change password.');
      }
    } catch (err) {
      setPwError(err.response?.data?.detail || err.message || 'Error changing password.');
    } finally {
      setPwSubmitting(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please select an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError('Image size should be less than 2MB.');
      return;
    }

    setPhotoUploading(true);
    setPhotoError('');

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result;
      try {
        const res = await updateProfilePhoto(base64String);
        if (res.status) {
          faceVerified({ ...user, profile_photo: base64String });
        } else {
          setPhotoError(res.message || 'Failed to upload profile photo.');
        }
      } catch (err) {
        setPhotoError(err.message || 'Error uploading profile photo.');
      } finally {
        setPhotoUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const closeMobile = () => setMobileOpen(false);

  // Helper: check if current path matches this link
  const isActive = (path) => {
    if (path === '/inventory') {
      return location.pathname.startsWith('/inventory');
    }
    return location.pathname === path;
  };

  // Desktop link classes with active highlighting
  const desktopLink = (path, extra = '') => {
    const base = 'text-xs xl:text-sm transition-colors flex items-center gap-1 px-1.5 py-1 xl:px-2 rounded-md whitespace-nowrap flex-shrink-0';
    if (isActive(path)) {
      return `${base} text-amber-400 bg-amber-500/15 font-bold ${extra}`;
    }
    return `${base} text-amber-200/70 hover:text-amber-400 hover:bg-amber-500/10 ${extra}`;
  };

  // Mobile link classes with active highlighting
  const mobileLink = (path, extra = '') => {
    const base = 'block px-3 py-2.5 text-sm font-medium rounded-lg transition-colors';
    if (isActive(path)) {
      return `${base} text-amber-400 bg-amber-500/15 font-bold border-l-4 border-amber-400 ${extra}`;
    }
    return `${base} text-amber-100 hover:bg-amber-500/10 hover:text-amber-400 ${extra}`;
  };

  return (
    <nav className="bg-stone-950 shadow-lg border-b border-amber-700/20 sticky top-0 z-50">
      <style>{`
        .nav-scroll::-webkit-scrollbar {
          display: none;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out forwards;
        }
        .animate-scaleUp {
          animation: scaleUp 0.15s ease-out forwards;
        }
      `}</style>
      <div className="w-full mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between min-h-[3.5rem] sm:min-h-[4rem] py-2 items-center gap-4">
          
          {/* Logo and Brand */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-lg flex items-center justify-center shadow-md overflow-hidden p-0.5">
              <img src="/logo.png" alt="Ink Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-sm sm:text-lg font-bold text-amber-100 whitespace-nowrap">INK Edu Platform</span>
          </Link>

          {/* Desktop Navigation links - swipable overflow-x-auto container */}
          <div className="hidden md:flex items-center gap-1.5 sm:gap-2 md:gap-3 overflow-x-auto py-1 nav-scroll flex-1 justify-start min-w-0">
            {isAuthenticated && isFaceVerified && (
              <>
                <Link to="/location" className={desktopLink('/location')}>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {t('locations')}
                </Link>
                <Link to="/login-history" className={desktopLink('/login-history')}>
                  🕐 History
                </Link>
                <Link to="/logout-kiosk" className={desktopLink('/logout-kiosk', 'hover:text-red-400')}>
                  🚪 {t('kiosk')}
                </Link>
                <Link to="/vidya-ai" className={desktopLink('/vidya-ai')}>
                  📝 Question Paper
                </Link>
                <Link to="/summary" className={desktopLink('/summary')}>
                  📖 Summary
                </Link>
              </>
            )}
            {!isAuthenticated || !isFaceVerified ? (
              <>
                <Link 
                  to="/login" 
                  className={isActive('/login') 
                    ? "px-3 xl:px-4 py-1.5 xl:py-2 text-xs xl:text-sm font-medium text-stone-900 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-lg shadow-md shadow-amber-500/20 whitespace-nowrap" 
                    : desktopLink('/login')}
                >
                  {t('login')}
                </Link>
                <Link 
                  to="/register" 
                  className={isActive('/register') 
                    ? "px-3 xl:px-4 py-1.5 xl:py-2 text-xs xl:text-sm font-medium text-stone-900 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-lg shadow-md shadow-amber-500/20 whitespace-nowrap" 
                    : desktopLink('/register')}
                >
                  {t('register')}
                </Link>
              </>
            ) : null}
          </div>

          {/* Fixed Right Actions: Language Select + Profile Menu */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            <LanguageSwitcher />
            {isAuthenticated && isFaceVerified && (
              <div className="relative flex items-center">
                <button 
                  onClick={() => setProfileModalOpen(true)}
                  className="flex items-center gap-1.5 focus:outline-none bg-stone-900 border border-amber-500/20 hover:border-amber-500/50 rounded-full px-1.5 py-1 transition-all"
                >
                  {user?.profile_photo ? (
                    <img 
                      src={user.profile_photo} 
                      alt={user.name} 
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-amber-500/50 shadow-md"
                    />
                  ) : (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-stone-950 font-bold flex items-center justify-center text-xs shadow-md">
                      {user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U'}
                    </div>
                  )}
                  <svg className={`w-3.5 h-3.5 text-amber-200/70 hidden sm:block transition-transform duration-200 ${profileModalOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Mobile Navigation Controls - visible only on phones/tablets */}
          <div className="flex md:hidden items-center gap-2">
            <LanguageSwitcher />
            
            {isAuthenticated && isFaceVerified && (
              <>
                {/* Circular Profile Photo button directly opens profile details modal */}
                <button 
                  onClick={() => setProfileModalOpen(true)}
                  className="flex items-center focus:outline-none bg-stone-900 border border-amber-500/20 hover:border-amber-500/50 rounded-full p-0.5 transition-all"
                >
                  {user?.profile_photo ? (
                    <img 
                      src={user.profile_photo} 
                      alt={user.name} 
                      className="w-7 h-7 rounded-full object-cover border border-amber-500/50 shadow-md"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-stone-950 font-bold flex items-center justify-center text-[10px] shadow-md">
                      {user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U'}
                    </div>
                  )}
                </button>
              </>
            )}

            {/* Hamburger toggle button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-1.5 bg-stone-900 hover:bg-stone-800 text-amber-400 hover:text-amber-300 rounded-lg border border-amber-500/20 transition-all focus:outline-none active:scale-95"
              aria-label="Toggle menu"
            >
              <svg className="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu - slide down for phones/tablets */}
      {mobileOpen && (
        <div className="md:hidden bg-stone-900 border-t border-amber-500/10 px-4 py-3 space-y-1.5 animate-fadeIn">
          {isAuthenticated && isFaceVerified ? (
            <>
              <Link to="/dashboard" onClick={closeMobile} className={mobileLink('/dashboard')}>
                📊 {t('dashboard')}
              </Link>
              <Link to="/location" onClick={closeMobile} className={mobileLink('/location')}>
                📍 {t('locations')}
              </Link>
              {(user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'principal' || user?.role?.toLowerCase() === 'teacher' || user?.isAdmin) && (
                <Link to="/admin" onClick={closeMobile} className={mobileLink('/admin')}>
                  ⚙️ {t('admin')}
                </Link>
              )}
              <Link to="/attendance" onClick={closeMobile} className={mobileLink('/attendance')}>
                📋 {t('attendance')}
              </Link>
              <Link to="/login-history" onClick={closeMobile} className={mobileLink('/login-history')}>
                🕐 History
              </Link>
              <Link to="/logout-kiosk" onClick={closeMobile} className={mobileLink('/logout-kiosk', 'text-red-400 hover:text-red-300')}>
                🚪 {t('kiosk')}
              </Link>
              <Link to="/vidya-ai" onClick={closeMobile} className={mobileLink('/vidya-ai')}>
                📝 Question Paper
              </Link>
              <Link to="/summary" onClick={closeMobile} className={mobileLink('/summary')}>
                📖 Summary
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" onClick={closeMobile} className={mobileLink('/login')}>
                🔑 {t('login')}
              </Link>
              <Link to="/register" onClick={closeMobile} className={mobileLink('/register')}>
                📝 {t('register')}
              </Link>
            </>
          )}
        </div>
      )}

      {/* ── PROFILE DETAILS MODAL ── */}
      {profileModalOpen && (
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-amber-500/30 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-scaleUp">
            {/* Header */}
            <div className="bg-stone-950 px-6 py-4 border-b border-amber-500/20 flex justify-between items-center">
              <h3 className="text-base sm:text-lg font-bold text-amber-100 flex items-center gap-2">
                <span>👤</span> Profile Details
              </h3>
              <button 
                onClick={() => setProfileModalOpen(false)}
                className="text-amber-200/50 hover:text-amber-400 transition-colors text-xl font-bold focus:outline-none"
              >
                &times;
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto nav-scroll text-stone-100">
              
              {/* 1. Premium Welcome Banner / Welcome Card */}
              <div className="bg-stone-950/60 rounded-2xl p-6 border border-amber-500/20 flex flex-col sm:flex-row items-center gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                  <span className="text-8xl">👑</span>
                </div>
                
                {/* Avatar Upload */}
                <div className="relative group flex-shrink-0">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-amber-500/50 bg-stone-950 flex items-center justify-center shadow-lg relative">
                    {user?.profile_photo ? (
                      <img src={user.profile_photo} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl font-bold text-amber-400">
                        {user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U'}
                      </span>
                    )}
                    {photoUploading && (
                      <div className="absolute inset-0 bg-stone-950/70 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>
                  
                  <label className="absolute bottom-0 right-0 bg-amber-500 hover:bg-amber-600 text-stone-950 p-1.5 rounded-full cursor-pointer shadow-md transition-all group-hover:scale-110">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={photoUploading} />
                  </label>
                </div>

                <div className="flex-1 text-center sm:text-left space-y-2 min-w-0">
                  <h4 className="text-xl font-extrabold text-amber-100 tracking-tight">{user?.name}</h4>
                  <p className="text-sm text-amber-200/60 font-semibold">{user?.designation || 'Staff'} • {user?.profession || 'Employee'}</p>
                  <p className="text-xs text-amber-50 font-mono tracking-wider">{user?.employee_id}</p>
                  {photoError && <p className="text-xs text-red-400 mt-1">{photoError}</p>}
                  
                  <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Face Verified
                    </span>
                    <button 
                      onClick={() => {
                        setProfileModalOpen(false);
                        setChangePasswordModalOpen(true);
                      }}
                      className="text-xs text-amber-400 hover:text-amber-300 font-bold transition-all hover:underline"
                    >
                      🔑 Change Password
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. 12 Detailed Grid Fields */}
              <div>
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3">Faculty/Staff Information Profile</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  {/* Field 1: Full Name */}
                  <div className="bg-stone-950/40 border border-stone-800/60 rounded-xl p-3">
                    <span className="text-amber-200/40 text-[9px] block font-semibold uppercase tracking-wider mb-1">Full Name</span>
                    <span className="text-amber-100 font-medium truncate block">{user?.name || 'N/A'}</span>
                  </div>
                  {/* Field 2: Email Address */}
                  <div className="bg-stone-950/40 border border-stone-800/60 rounded-xl p-3">
                    <span className="text-amber-200/40 text-[9px] block font-semibold uppercase tracking-wider mb-1">Email Address</span>
                    <span className="text-amber-100 font-medium truncate block" title={user?.email}>{user?.email || 'N/A'}</span>
                  </div>
                  {/* Field 3: Phone Number */}
                  <div className="bg-stone-950/40 border border-stone-800/60 rounded-xl p-3">
                    <span className="text-amber-200/40 text-[9px] block font-semibold uppercase tracking-wider mb-1">Phone Number</span>
                    <span className="text-amber-100 font-medium block">{user?.phone || 'N/A'}</span>
                  </div>
                  {/* Field 4: Employee ID */}
                  <div className="bg-stone-950/40 border border-stone-800/60 rounded-xl p-3">
                    <span className="text-amber-200/40 text-[9px] block font-semibold uppercase tracking-wider mb-1">Faculty/Staff ID</span>
                    <span className="text-amber-400 font-bold block">{user?.employee_id || 'N/A'}</span>
                  </div>
                  {/* Field 5: Designation */}
                  <div className="bg-stone-950/40 border border-stone-800/60 rounded-xl p-3">
                    <span className="text-amber-200/40 text-[9px] block font-semibold uppercase tracking-wider mb-1">Designation</span>
                    <span className="text-amber-100 font-medium block truncate">{user?.designation || 'Staff'}</span>
                  </div>
                  {/* Field 6: Joining Date */}
                  <div className="bg-stone-950/40 border border-stone-800/60 rounded-xl p-3">
                    <span className="text-amber-200/40 text-[9px] block font-semibold uppercase tracking-wider mb-1">Joining Date</span>
                    <span className="text-amber-100 font-medium block">{user?.joining_date || 'N/A'}</span>
                  </div>
                  {/* Field 7: Work Hours / Day */}
                  <div className="bg-stone-950/40 border border-stone-800/60 rounded-xl p-3">
                    <span className="text-amber-200/40 text-[9px] block font-semibold uppercase tracking-wider mb-1">Work Hours / Day</span>
                    <span className="text-amber-100 font-medium block">{user?.hours_per_day || 8} hours</span>
                  </div>
                  {/* Field 8: Weekly Off */}
                  <div className="bg-stone-950/40 border border-stone-800/60 rounded-xl p-3">
                    <span className="text-amber-200/40 text-[9px] block font-semibold uppercase tracking-wider mb-1">Weekly Off</span>
                    <span className="text-amber-100 font-medium block">{user?.weekly_off || 'Sunday'}</span>
                  </div>
                  {/* Field 9: Insurance ID */}
                  <div className="bg-stone-950/40 border border-stone-800/60 rounded-xl p-3">
                    <span className="text-amber-200/40 text-[9px] block font-semibold uppercase tracking-wider mb-1">Insurance ID</span>
                    <span className="text-amber-400 font-bold block">{user?.insurance_id || 'Not Assigned'}</span>
                  </div>
                  {/* Field 10: Insurance Provider */}
                  <div className="bg-stone-950/40 border border-stone-800/60 rounded-xl p-3">
                    <span className="text-amber-200/40 text-[9px] block font-semibold uppercase tracking-wider mb-1">Insurance Provider</span>
                    <span className="text-amber-100 font-medium block truncate">{user?.insurance_provider || 'Not Assigned'}</span>
                  </div>
                  {/* Field 11: Member Since */}
                  <div className="bg-stone-950/40 border border-stone-800/60 rounded-xl p-3">
                    <span className="text-amber-200/40 text-[9px] block font-semibold uppercase tracking-wider mb-1">Member Since</span>
                    <span className="text-amber-100 font-medium block">
                      {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  {/* Field 12: Account Role */}
                  <div className="bg-stone-950/40 border border-stone-800/60 rounded-xl p-3">
                    <span className="text-amber-200/40 text-[9px] block font-semibold uppercase tracking-wider mb-1">Account Role</span>
                    <span className="text-amber-100 font-medium block truncate">
                      {user?.role?.toLowerCase() === 'admin' || user?.isAdmin
                        ? 'Admin (Full Access)'
                        : user?.role
                          ? user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase()
                          : 'Employee (Standard)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Downloadable Employee QR Code Card */}
              {user?.employee_id && (
                <div className="bg-amber-50/5 rounded-2xl p-5 border border-amber-500/20 text-center">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2">My ID QR Code</h4>
                  <p className="text-[11px] text-amber-200/50 mb-3">Scan this code at the school logout kiosk to complete your authentication</p>
                  <div className="inline-block bg-white p-3 rounded-xl shadow-lg">
                    <QRCodeSVG
                      id="navbar-employee-qr-code"
                      value={JSON.stringify({
                        employee_id: user.employee_id,
                        name: user.name,
                        email: user.email,
                        phone: user.phone,
                        profession: user.profession || user.designation || '',
                        designation: user.designation || '',
                      })}
                      size={140}
                      level="H"
                      includeMargin={true}
                      bgColor="#ffffff"
                      fgColor="#1c1917"
                    />
                  </div>
                  <div className="mt-3 flex flex-col items-center gap-1.5">
                    <span className="text-xs text-amber-400 font-mono">{user.employee_id}</span>
                    <button
                      type="button"
                      onClick={downloadQR}
                      className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-stone-950 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/10"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download My QR Code
                    </button>
                  </div>
                </div>
              )}

              {/* 4. Global Company Settings (Admin Only) */}
              {(user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'principal' || user?.role?.toLowerCase() === 'teacher' || user?.isAdmin) && (
                <div className="bg-stone-950/60 rounded-2xl p-5 border border-amber-500/20">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                    <span>⚙️</span> Global School Settings
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-amber-200/60 uppercase tracking-wider mb-1.5">Daily School Hours</label>
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        max="24"
                        value={adminSettings.hours_per_day}
                        onChange={(e) => setAdminSettings({ ...adminSettings, hours_per_day: e.target.value })}
                        className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-amber-50 text-xs outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-amber-200/60 uppercase tracking-wider mb-1.5">Weekly Off Days</label>
                      <input
                        type="text"
                        value={adminSettings.weekly_off}
                        onChange={(e) => setAdminSettings({ ...adminSettings, weekly_off: e.target.value })}
                        placeholder="e.g. Sunday"
                        className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-amber-50 text-xs outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveSettings}
                      disabled={isSavingSettings}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-bold rounded-lg transition-all disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isSavingSettings ? (
                        <><span className="w-3.5 h-3.5 border-2 border-stone-950 border-t-transparent rounded-full animate-spin"></span> Saving...</>
                      ) : (
                        'Save Global Configuration'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* 5. Session & Location Info */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest">Session & Location Intelligence</h4>
                
                {/* Login & Last Logout Times */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                    <span className="text-emerald-400 font-bold uppercase tracking-wider block mb-1">Login Time</span>
                    <span className="text-amber-50 font-semibold font-mono">
                      {user?.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                  <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
                    <span className="text-red-400 font-bold uppercase tracking-wider block mb-1">Last Logout Time</span>
                    <span className="text-amber-50 font-semibold font-mono">
                      {user?.last_logout_at ? new Date(user.last_logout_at).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* GPS Live & Registered Addresses */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Live Location */}
                  <div className="bg-stone-950/40 border border-stone-800/60 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2 h-2 rounded-full ${geoPos ? 'bg-blue-500 animate-pulse' : 'bg-stone-600'}`} />
                      <span className="font-bold text-amber-200/80 uppercase tracking-wider">Live Location address</span>
                    </div>
                    {addressLoading || !geoPos ? (
                      <div className="py-2 text-stone-500 italic text-[11px]">
                        {geoPos ? 'Resolving live coordinates...' : 'Acquiring GPS signal...'}
                      </div>
                    ) : liveAddress ? (
                      <div className="space-y-2">
                        <p className="text-amber-100 leading-snug">{liveAddress.display_name || 'Address Not Found'}</p>
                        <p className="text-[10px] text-amber-500/60 font-mono">
                          {geoPos.latitude.toFixed(6)}, {geoPos.longitude.toFixed(6)}
                          {geoPos.accuracy && ` (±${Math.round(geoPos.accuracy)}m)`}
                        </p>
                      </div>
                    ) : (
                      <p className="text-stone-500 italic text-[11px]">Live location details not available</p>
                    )}
                  </div>

                  {/* Registered Location */}
                  <div className="bg-stone-950/40 border border-stone-800/60 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="font-bold text-amber-200/80 uppercase tracking-wider">Registered School Location</span>
                    </div>
                    {user?.registered_location ? (
                      <div className="space-y-2">
                        <p className="text-amber-100 leading-snug">
                          {user.registered_address?.display_name || user.registered_address?.address || user.registered_location.address || 'Office Location'}
                        </p>
                        <p className="text-[10px] text-amber-500/60 font-mono">
                          {Number(user.registered_location.latitude).toFixed(6)}, {Number(user.registered_location.longitude).toFixed(6)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-stone-500 italic text-[11px]">No registered office location on file</p>
                    )}
                  </div>
                </div>

                {/* Range Boundary Check Status */}
                {(() => {
                  const reg = user?.registered_location;
                  const live = geoPos;
                  let dist = null;
                  let isOk = null;

                  if (reg && live && reg.latitude && live.latitude) {
                    const toRad = (d) => (d * Math.PI) / 180;
                    const R = 6371000;
                    const dLat = toRad(live.latitude - reg.latitude);
                    const dLon = toRad(live.longitude - reg.longitude);
                    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(reg.latitude)) * Math.cos(toRad(live.latitude)) * Math.sin(dLon / 2) ** 2;
                    dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    isOk = dist <= 500;
                  }

                  return (
                    <div className={`p-4 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isOk === null 
                        ? 'bg-stone-950/20 border-stone-800 text-stone-400' 
                        : isOk 
                          ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' 
                          : 'bg-red-500/5 border-red-500/20 text-red-400'
                    }`}>
                      <div>
                        <span className="font-bold uppercase tracking-wider block mb-1">Attendance Range Authorization Status</span>
                        {dist !== null ? (
                          <span className="font-mono text-amber-100">
                            Current Distance from School: <strong className="text-amber-400 font-extrabold">{dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(2)}km`}</strong>
                          </span>
                        ) : (
                          <span className="italic text-stone-500">Awaiting live geolocation input for range verification...</span>
                        )}
                      </div>
                      {isOk !== null && (
                        <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full font-bold text-[11px] border uppercase ${
                          isOk 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                            : 'bg-red-500/10 border-red-500/20 text-red-400'
                        }`}>
                          {isOk ? '✓ Within Login Range' : '✗ Outside Range (Max 500m)'}
                        </span>
                      )}
                    </div>
                  );
                })()}

              </div>
              
            </div>

            {/* Footer */}
            <div className="bg-stone-950 px-6 py-4 border-t border-amber-500/20 flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => {
                  setProfileModalOpen(false);
                  handleLogout();
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm transition-all flex items-center gap-1.5 shadow-md shadow-red-500/10 active:scale-95"
              >
                🚪 Logout
              </button>
              <button 
                type="button"
                onClick={() => setProfileModalOpen(false)}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-stone-950 hover:from-amber-600 hover:to-yellow-600 transition-colors font-bold rounded-lg text-sm active:scale-95"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CHANGE PASSWORD MODAL ── */}
      {changePasswordModalOpen && (
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <form onSubmit={handleChangePasswordSubmit} className="bg-stone-900 border border-amber-500/30 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            {/* Header */}
            <div className="bg-stone-950 px-6 py-4 border-b border-amber-500/20 flex justify-between items-center">
              <h3 className="text-base sm:text-lg font-bold text-amber-100 flex items-center gap-2">
                <span>🔑</span> Change Password
              </h3>
              <button 
                type="button"
                onClick={() => setChangePasswordModalOpen(false)}
                className="text-amber-200/50 hover:text-amber-400 transition-colors text-xl font-bold focus:outline-none"
              >
                &times;
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {pwError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-200 text-xs rounded-lg p-3 font-semibold">
                  ⚠️ {pwError}
                </div>
              )}
              {pwSuccess && (
                <div className="bg-green-500/10 border border-green-500/30 text-green-200 text-xs rounded-lg p-3 font-semibold">
                  ✅ {pwSuccess}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-amber-200/60 uppercase tracking-wider block">Current Password</label>
                <input 
                  type="password"
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-amber-100 text-sm outline-none focus:border-amber-500"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-amber-200/60 uppercase tracking-wider block">New Password</label>
                <input 
                  type="password"
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-amber-100 text-sm outline-none focus:border-amber-500"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-amber-200/60 uppercase tracking-wider block">Confirm New Password</label>
                <input 
                  type="password"
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-amber-100 text-sm outline-none focus:border-amber-500"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Footer */}
            <div className="bg-stone-950 px-6 py-4 border-t border-amber-500/20 flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => setChangePasswordModalOpen(false)}
                className="px-4 py-2 border border-stone-800 text-amber-200/70 hover:bg-stone-800 rounded-lg text-sm transition-colors focus:outline-none"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={pwSubmitting}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-stone-950 hover:from-amber-600 hover:to-yellow-600 transition-colors font-bold rounded-lg text-sm flex items-center gap-1.5 focus:outline-none"
              >
                {pwSubmitting ? (
                  <span className="w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin"></span>
                ) : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
