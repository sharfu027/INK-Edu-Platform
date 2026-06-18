import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Sidebar = () => {
  const { user } = useAuth();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const tab = params.get('tab');

  const [isTeacherOpen, setIsTeacherOpen] = React.useState(
    location.pathname === '/vidya-ai' || location.pathname === '/summary'
  );

  const isDashboardActive = location.pathname === '/dashboard';

  const getLinkClass = (path, isSpecialActive = false) => {
    const base = "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all";
    const currentPath = location.pathname + location.search;
    if (isSpecialActive || ((currentPath === path || location.pathname === path) && !isDashboardActive)) {
      return `${base} text-stone-900 bg-stone-100/80 border border-stone-200/50 shadow-sm`;
    }
    return `${base} text-stone-600 hover:bg-stone-50 hover:text-stone-900`;
  };

  return (
    <div className="w-64 bg-white text-stone-800 min-h-[calc(100vh-4rem)] border-r border-stone-200 flex-shrink-0 flex-col justify-between hidden md:flex">
      <div className="p-6 space-y-8">
        
        {/* Navigation Section */}
        <div className="space-y-3">
          <span className="text-[10px] text-stone-450 font-extrabold uppercase tracking-widest block px-3">
            Navigation
          </span>
          <div className="space-y-1">
            <Link
              to="/dashboard"
              className={getLinkClass('/dashboard', isDashboardActive)}
            >
              <span>📊</span>
              <span>Dashboard</span>
            </Link>

            <Link
              to="/attendance"
              className={getLinkClass('/attendance')}
            >
              <span>📋</span>
              <span>Attendance System</span>
            </Link>

            {(user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'principal' || user?.role?.toLowerCase() === 'teacher' || user?.isAdmin) && (
              <Link
                to="/admin"
                className={getLinkClass('/admin')}
              >
                <span>⚙️</span>
                <span>Admin Panel</span>
              </Link>
            )}

            <Link
              to="/logout-kiosk"
              className={getLinkClass('/logout-kiosk')}
            >
              <span>🚪</span>
              <span>Logout Kiosk</span>
            </Link>

            <button
              onClick={() => setIsTeacherOpen(!isTeacherOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-all text-stone-600 hover:bg-stone-50 hover:text-stone-900"
            >
              <div className="flex items-center gap-2.5">
                <span>👨‍🏫</span>
                <span>Teacher Section</span>
              </div>
              <svg className={`w-3.5 h-3.5 text-stone-500 transition-transform duration-200 ${isTeacherOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isTeacherOpen && (
              <div className="pl-4 space-y-1 mt-1 transition-all duration-200">
                <Link
                  to="/vidya-ai"
                  className={getLinkClass('/vidya-ai')}
                >
                  <span>📝</span>
                  <span>Question Paper</span>
                </Link>

                <Link
                  to="/summary"
                  className={getLinkClass('/summary')}
                >
                  <span>📖</span>
                  <span>Summary</span>
                </Link>

                {(user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'principal' || user?.role?.toLowerCase() === 'hod' || user?.role?.toLowerCase() === 'teacher' || user?.isAdmin) && (
                  <Link
                    to="/admin?tab=timetable"
                    className={getLinkClass('/admin?tab=timetable')}
                  >
                    <span>📅</span>
                    <span>Timetable Management</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
