/**
 * LocationPage — Full-screen live location map with real-time GPS tracking.
 *
 * Shows the user's current position on an interactive OpenStreetMap.
 * If the user is logged in and has a registered location, it also shows
 * that location, the distance between them, and area names via reverse geocoding.
 */
import React, { useMemo, useState, useEffect } from 'react';
import useGeolocation from '../hooks/useGeolocation';
import LocationMap from '../components/map/LocationMap';
import { useAuth } from '../context/AuthContext';
import { geocodeLocation } from '../services/authService';
import { reverseGeocodeClient } from '../utils/geocodeClient';
import Sidebar from '../components/ui/Sidebar';

/**
 * Haversine distance in metres.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const LocationPage = () => {
  const { position, error, loading, permissionDenied, refresh } = useGeolocation({ watch: true });
  const { user } = useAuth();

  const registeredLocation = user?.registered_location || null;
  const registeredAddress = user?.registered_address || null;

  // Reverse-geocoded address for current live location
  const [currentAddress, setCurrentAddress] = useState(null);
  const [addressLoading, setAddressLoading] = useState(false);

  // Fetch address when position changes significantly
  useEffect(() => {
    if (!position) return;
    let cancelled = false;
    const fetchAddress = async () => {
      setAddressLoading(true);
      try {
        // Try backend first
        const result = await geocodeLocation(position.latitude, position.longitude);
        if (!cancelled && result?.data && (result.data.area || result.data.road || result.data.display_name)) {
          setCurrentAddress(result.data);
          setAddressLoading(false);
          return;
        }
      } catch { /* backend failed */ }

      // Fallback: client-side Nominatim
      try {
        const clientResult = await reverseGeocodeClient(position.latitude, position.longitude);
        if (!cancelled) setCurrentAddress(clientResult);
      } catch { /* both failed */ }
      finally { if (!cancelled) setAddressLoading(false); }
    };
    fetchAddress();
    return () => { cancelled = true; };
  }, [
    // Only re-fetch when position changes by ~0.001° (~100m)
    position ? Math.round(position.latitude * 1000) : null,
    position ? Math.round(position.longitude * 1000) : null,
  ]);

  const distance = useMemo(() => {
    if (!position || !registeredLocation) return null;
    return haversineDistance(
      position.latitude,
      position.longitude,
      registeredLocation.latitude,
      registeredLocation.longitude
    );
  }, [position, registeredLocation]);

  const isWithinRange = distance !== null ? distance <= 100 : null;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col md:flex-row animate-fadeIn font-sans">
      <Sidebar />
      <div className="flex-1 bg-white flex flex-col min-w-0">
        <div className="min-h-[calc(100vh-4rem)] bg-white overflow-y-auto">
          {/* Header */}
      <div className="bg-stone-900 border-b border-amber-700/20">
        <div className="w-full mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <svg className="w-5 h-5 sm:w-7 sm:h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Live Location
            </h1>
            <p className="text-xs sm:text-sm text-amber-300/60 mt-0.5">Real-time GPS tracking • OpenStreetMap</p>
          </div>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-stone-900 rounded-lg hover:from-amber-600 hover:to-yellow-700 transition-all text-sm font-bold flex items-center gap-2 shadow-md shadow-amber-500/20"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <div className="w-full mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* ── Permission Denied Banner ── */}
        {permissionDenied && (
          <div className="mb-6 bg-yellow-50 border border-yellow-300 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="text-yellow-600 text-2xl mt-0.5">⚠️</div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">Location Permission Required</h3>
                <p className="text-yellow-700 text-sm mb-3">
                  You denied location access. To use the live map and location-based login, please enable it:
                </p>
                <div className="bg-yellow-100 rounded-lg p-4 mb-3">
                  <p className="text-yellow-900 text-sm font-medium mb-2">How to enable location:</p>
                  <ol className="text-yellow-800 text-sm space-y-1 list-decimal list-inside">
                    <li>Click the <strong>🔒 lock icon</strong> (or ⓘ icon) in your browser's address bar</li>
                    <li>Find <strong>"Location"</strong> and change it to <strong>"Allow"</strong></li>
                    <li>Reload this page or click <strong>"Try Again"</strong> below</li>
                  </ol>
                </div>
                <button
                  onClick={refresh}
                  className="px-5 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 transition-colors text-sm font-semibold"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Info cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          {/* Current location */}
          <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${position ? 'bg-amber-500 animate-pulse' : error ? 'bg-red-500' : 'bg-gray-400 animate-pulse'}`} />
              <span className="text-sm font-medium text-amber-700">Current Location</span>
            </div>
            {loading && !position && !error ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-stone-500 text-sm">Getting location...</p>
              </div>
            ) : error && !position ? (
              <div>
                <p className="text-red-400 text-sm mb-2">{error}</p>
                <button onClick={refresh} className="text-xs text-amber-400 hover:text-amber-300 underline">
                  Retry
                </button>
              </div>
            ) : position ? (
              <div className="text-stone-900">
                <p className="text-sm sm:text-lg font-mono font-bold">{position.latitude.toFixed(6)}</p>
                <p className="text-sm sm:text-lg font-mono font-bold">{position.longitude.toFixed(6)}</p>
                {position.accuracy && (
                  <p className="text-xs text-stone-400 mt-1">Accuracy: ±{position.accuracy.toFixed(0)}m</p>
                )}
                {/* Area name */}
                {addressLoading ? (
                  <p className="text-xs text-amber-300 mt-2 flex items-center gap-1">
                    <span className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin inline-block" />
                    Detecting area...
                  </p>
                ) : currentAddress?.display_name || currentAddress?.area || currentAddress?.road ? (
                  <div className="mt-2 pt-2 border-t border-stone-200">
                    {currentAddress.road && (
                      <p className="text-sm text-amber-700 font-medium">📍 {currentAddress.road}</p>
                    )}
                    <p className="text-xs text-stone-600">
                      {currentAddress.area || currentAddress.road ? (
                        [
                          currentAddress.area || currentAddress.suburb,
                          currentAddress.city,
                          currentAddress.state,
                          currentAddress.country
                        ]
                          .filter(Boolean)
                          .reduce((acc, curr) => acc.includes(curr) ? acc : [...acc, curr], [])
                          .join(', ')
                      ) : (
                        currentAddress.display_name
                      )}
                    </p>
                    {currentAddress.pincode && (
                      <p className="text-xs text-stone-400 mt-1 font-medium">PIN: {currentAddress.pincode}</p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Registered location */}
          <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${registeredLocation ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className="text-sm font-medium text-green-700">Registered Location</span>
            </div>
            {registeredLocation ? (
              <div className="text-stone-900">
                <p className="text-sm sm:text-lg font-mono font-bold">{registeredLocation.latitude.toFixed(6)}</p>
                <p className="text-sm sm:text-lg font-mono font-bold">{registeredLocation.longitude.toFixed(6)}</p>
                <p className="text-xs text-stone-400 mt-1">Login locked to this area (100m radius)</p>
                {/* Registered area name */}
                {registeredAddress?.area || registeredAddress?.road ? (
                  <div className="mt-2 pt-2 border-t border-stone-200">
                    {registeredAddress.road && (
                      <p className="text-sm text-green-700 font-medium">📍 {registeredAddress.road}</p>
                    )}
                    <p className="text-xs text-stone-600">
                      {[
                        registeredAddress.area || registeredAddress.suburb,
                        registeredAddress.city,
                        registeredAddress.state,
                        registeredAddress.country
                      ]
                        .filter(Boolean)
                        .reduce((acc, curr) => acc.includes(curr) ? acc : [...acc, curr], [])
                        .join(', ')}
                    </p>
                    {registeredAddress.pincode && (
                      <p className="text-xs text-stone-400 mt-1 font-medium">PIN: {registeredAddress.pincode}</p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-stone-500 text-sm">No registered location yet. Register a new account to lock your location.</p>
            )}
          </div>

          {/* Distance / Status */}
          <div className={`backdrop-blur-md rounded-xl p-4 border ${
            isWithinRange === null
              ? 'bg-white/10 border-white/10'
              : isWithinRange
              ? 'bg-green-500/10 border-green-500/20'
              : 'bg-red-500/10 border-red-500/20'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${
                isWithinRange === null ? 'bg-gray-400' : isWithinRange ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className={`text-sm font-medium ${
                isWithinRange === null ? 'text-stone-500' : isWithinRange ? 'text-green-700' : 'text-red-700'
              }`}>Login Status</span>
            </div>
            {distance !== null ? (
              <div>
                <p className={`text-2xl font-bold ${isWithinRange ? 'text-green-600' : 'text-red-600'}`}>
                  {distance < 1000 ? `${distance.toFixed(0)}m` : `${(distance / 1000).toFixed(2)}km`}
                </p>
                <p className={`text-sm mt-1 ${isWithinRange ? 'text-green-600' : 'text-red-600'}`}>
                  {isWithinRange ? '✓ Within login range' : '✗ Outside login range (max 100m)'}
                </p>
              </div>
            ) : (
              <p className="text-stone-500 text-sm">
                {permissionDenied
                  ? 'Enable location to check login eligibility'
                  : !position
                  ? 'Waiting for location...'
                  : 'No registered location to compare'}
              </p>
            )}
          </div>
        </div>

        {/* Map or error */}
        {!position && (error || permissionDenied) ? (
          <div className="bg-stone-50 rounded-2xl p-12 text-center border border-stone-200">
            <div className="text-6xl mb-4">{permissionDenied ? '📍' : '🗺️'}</div>
            <h3 className="text-lg font-semibold text-stone-900 mb-2">
              {permissionDenied ? 'Location Access Needed' : 'Location Unavailable'}
            </h3>
            <p className="text-stone-500 mb-4 max-w-md mx-auto">
              {permissionDenied
                ? 'Allow location access to see your position on the map. Check the banner above for instructions.'
                : error}
            </p>
            <button
              onClick={refresh}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 text-stone-900 rounded-lg hover:from-amber-600 hover:to-yellow-700 transition-all font-bold shadow-md shadow-amber-500/20"
            >
              Try Again
            </button>
          </div>
        ) : (
          <LocationMap
            position={position}
            registeredLocation={registeredLocation}
            showAccuracy={true}
            followUser={true}
            height={typeof window !== 'undefined' && window.innerWidth < 640 ? 300 : 500}
            className="border border-white/10"
          />
        )}

        {/* Info footer */}
        <div className="mt-4 text-center text-sm text-white/40">
          <p>
            Location data is used for authentication security only.
            You can only login from within 100m of your registered location.
          </p>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationPage;
