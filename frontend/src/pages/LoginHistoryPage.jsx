/**
 * Login History Page — shows login/logout records with search.
 * Admin can search by employee name or ID. Regular users see only their own.
 * White background with Golden UI cards.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { getLoginHistory } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/ui/Spinner';
import toast from 'react-hot-toast';
import Sidebar from '../components/ui/Sidebar';

const LoginHistoryPage = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'principal' || user?.isAdmin;

  const fetchHistory = useCallback(async (query = '') => {
    setLoading(true);
    try {
      const res = await getLoginHistory(query);
      if (res?.status && Array.isArray(res.data)) {
        setHistory(res.data);
      } else {
        setHistory([]);
      }
    } catch (err) {
      toast.error('Failed to load login history');
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory('');
  }, [fetchHistory]);

  const handleSearch = (e) => {
    e.preventDefault();
    setAppliedSearch(searchQuery);
    fetchHistory(searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setAppliedSearch('');
    fetchHistory('');
  };

  const formatTime = (iso) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return iso;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

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

  const formatWorkedHours = (hrs) => {
    if (hrs == null) return '—';
    const h = Math.floor(hrs);
    const m = Math.round((hrs - h) * 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col md:flex-row animate-fadeIn font-sans">
      <Sidebar />
      <div className="flex-1 bg-white flex flex-col min-w-0">
        <div className="min-h-[calc(100vh-4rem)] bg-white py-6 px-4 sm:px-6 lg:px-8 overflow-y-auto">
          <div className="w-full mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 flex items-center gap-2">
            🕐 Login History
          </h1>
          <p className="text-stone-500 text-sm mt-1">
            {isAdmin
              ? 'All employee login & logout records — search by name or Employee ID'
              : <>Your attendance login & logout records — <strong className="text-stone-700">{user?.name || 'User'}</strong> ({user?.employee_id || 'N/A'})</>
            }
          </p>
        </div>

        {/* Search Bar + Refresh */}
        <div className="mb-5 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAdmin ? 'Search by employee name or ID...' : 'Search by date...'}
                className="w-full pl-10 pr-4 py-2.5 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-stone-900 placeholder-stone-400 bg-white"
              />
              {appliedSearch && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 text-stone-900 rounded-xl hover:from-amber-600 hover:to-yellow-700 transition-all text-sm font-bold shadow-md shadow-amber-500/20"
            >
              Search
            </button>
          </form>
          <button
            onClick={() => fetchHistory(appliedSearch)}
            disabled={loading}
            className="px-4 py-2.5 bg-stone-100 border border-stone-300 text-stone-700 rounded-xl hover:bg-stone-200 transition-all text-sm font-bold flex items-center gap-2 disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Applied search tag */}
        {appliedSearch && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm text-stone-500">Showing results for:</span>
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium border border-amber-300">
              "{appliedSearch}"
              <button onClick={handleClearSearch} className="ml-1 text-amber-600 hover:text-amber-900">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : history.length === 0 ? (
          /* Empty State */
          <div className="bg-stone-50 rounded-2xl p-12 text-center border border-stone-200">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-lg font-semibold text-stone-700 mb-2">
              {appliedSearch ? 'No Records Found' : 'No Login History Yet'}
            </h3>
            <p className="text-stone-500 text-sm">
              {appliedSearch
                ? `No attendance records match "${appliedSearch}". Try a different search.`
                : 'Login/logout records will appear here once the attendance system is used.'
              }
            </p>
          </div>
        ) : (
          /* History Table */
          <div className="bg-stone-900/90 backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden border border-amber-600/15 golden-glow">
            <div className="px-4 sm:px-6 py-4 border-b border-amber-700/20 flex items-center justify-between">
              <h2 className="text-lg font-bold text-amber-50">📋 {history.length} Record{history.length !== 1 ? 's' : ''} Found</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-stone-800/80">
                    <th className="px-3 py-3 text-left text-xs font-bold text-amber-400 uppercase tracking-wider">#</th>
                    {isAdmin && <th className="px-3 py-3 text-left text-xs font-bold text-amber-400 uppercase tracking-wider">Employee</th>}
                    <th className="px-3 py-3 text-left text-xs font-bold text-amber-400 uppercase tracking-wider">Date</th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-amber-400 uppercase tracking-wider">Login</th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-amber-400 uppercase tracking-wider">Logout</th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-amber-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-700/50">
                  {history.map((rec, i) => {
                    const loginLoc = formatLocation(rec.login_location);
                    const isActive = rec.punch_in && !rec.punch_out;
                    return (
                      <tr key={i} className={`transition-colors ${isActive ? 'bg-green-500/10' : 'hover:bg-stone-800/50'}`}>
                        <td className="px-3 py-3 text-sm text-stone-400 font-mono">{i + 1}</td>
                        {isAdmin && (
                          <td className="px-3 py-3 text-sm whitespace-nowrap">
                            <div className="text-amber-50 font-semibold">{rec.employee_name || 'Unknown'}</div>
                            <div className="text-xs text-stone-400 font-mono">{rec.employee_id || '—'}</div>
                          </td>
                        )}
                        <td className="px-3 py-3 text-sm text-amber-50 font-medium whitespace-nowrap">{formatDate(rec.date)}</td>
                        <td className="px-3 py-3 text-sm">
                          {rec.punch_in ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-green-400 font-semibold whitespace-nowrap">📥 {formatTime(rec.punch_in)}</span>
                              {loginLoc && (
                                <a
                                  href={`https://www.google.com/maps?q=${typeof rec.login_location === 'object' ? `${rec.login_location.latitude},${rec.login_location.longitude}` : loginLoc}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-stone-400 font-mono leading-tight hover:text-blue-400 hover:underline max-w-[180px] truncate block"
                                  title={loginLoc}
                                >
                                  📍 {loginLoc}
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-stone-500">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm">
                          {rec.punch_out ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-red-400 font-semibold whitespace-nowrap">📤 {formatTime(rec.punch_out)}</span>
                              {rec.logout_location && (() => {
                                const logoutLoc = formatLocation(rec.logout_location);
                                return (
                                  <a
                                    href={`https://www.google.com/maps?q=${typeof rec.logout_location === 'object' ? `${rec.logout_location.latitude},${rec.logout_location.longitude}` : logoutLoc}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-stone-400 font-mono leading-tight hover:text-pink-400 hover:underline max-w-[180px] truncate block"
                                    title={logoutLoc}
                                  >
                                    📍 {logoutLoc}
                                  </a>
                                );
                              })()}
                            </div>
                          ) : isActive ? (
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex items-center gap-1 text-green-400 font-semibold">
                                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                Active
                              </span>
                            </div>
                          ) : (
                            <span className="text-stone-500">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm">
                          {isActive ? (
                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-400">In Office</span>
                          ) : rec.punch_out ? (
                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-stone-700 text-stone-300">Completed</span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-400">Incomplete</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginHistoryPage;
