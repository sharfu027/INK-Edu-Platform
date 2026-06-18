import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer, geocodeLocation } from '../services/authService';
import toast from 'react-hot-toast';
import Sidebar from '../components/ui/Sidebar';

const CustomerPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'principal' || user?.isAdmin;

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [detectingLoc, setDetectingLoc] = useState(false);
  const [formData, setFormData] = useState({
    CustomerCode: 'AUTO-GENERATED', CustomerName: '', ShopName: '', MobileNumber: '',
    GSTNumber: '', Address: '', City: '', State: '', Pincode: '', CreditLimit: 0
  });

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await getCustomers();
      if (res.status) setCustomers(res.data);
    } catch (err) {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleDetectLocation = async () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setDetectingLoc(true);
    const toastId = toast.loading("Initializing high-precision GPS...");

    let bestCoords = null;
    let readingsCount = 0;

    // Watch the GPS for 5 seconds to warm up and find the absolute tightest satellite lock
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        readingsCount++;
        const coords = position.coords;
        if (!bestCoords || coords.accuracy < bestCoords.accuracy) {
          bestCoords = coords;
          toast.loading(`Acquiring GPS... Reading #${readingsCount} (Precision: ±${Math.round(coords.accuracy)}m)`, { id: toastId });
        }
      },
      (error) => {
        console.error("GPS reading error during watch:", error);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );

    // Stop tracking after 5 seconds and lock the best reading
    setTimeout(async () => {
      navigator.geolocation.clearWatch(watchId);

      if (!bestCoords) {
        toast.loading("Refining one-shot GPS lock...", { id: toastId });
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            await processCoords(pos.coords, toastId);
          },
          (err) => {
            console.error("One-shot GPS capture failed:", err);
            toast.error("Failed to acquire GPS. Please verify Location permissions and try again.", { id: toastId });
            setDetectingLoc(false);
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
      } else {
        await processCoords(bestCoords, toastId);
      }
    }, 5000);
  };

  const processCoords = async (coords, toastId) => {
    const { latitude, longitude, accuracy } = coords;
    try {
      toast.loading(`Reverse geocoding address... (Precision: ±${Math.round(accuracy)}m)`, { id: toastId });
      const res = await geocodeLocation(latitude, longitude);
      if (res && res.status) {
        const addrData = res.data;
        const roadInfo = [addrData.road, addrData.suburb, addrData.area].filter(Boolean).join(', ');
        const gpsInfo = `[GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${Math.round(accuracy)}m)]`;
        const addressString = roadInfo ? `${roadInfo} ${gpsInfo}` : `${addrData.display_name} ${gpsInfo}`;
        
        setFormData(prev => ({
          ...prev,
          Address: addressString,
          City: addrData.city || 'N/A',
          State: addrData.state || 'N/A',
          Pincode: addrData.pincode || 'N/A'
        }));
        toast.success(`Location locked with high precision (±${Math.round(accuracy)}m)!`, { id: toastId });
      } else {
        setFormData(prev => ({
          ...prev,
          Address: `[GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${Math.round(accuracy)}m)]`,
          City: 'Detected',
          State: 'Detected',
          Pincode: 'Detected'
        }));
        toast.success(`GPS coordinates captured! Accuracy: ±${Math.round(accuracy)}m`, { id: toastId });
      }
    } catch (err) {
      console.error("Geocoding failed:", err);
      setFormData(prev => ({
        ...prev,
        Address: `[GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${Math.round(accuracy)}m)]`,
        City: 'Detected',
        State: 'Detected',
        Pincode: 'Detected'
      }));
      toast.success(`GPS coordinates captured! Accuracy: ±${Math.round(accuracy)}m`, { id: toastId });
    } finally {
      setDetectingLoc(false);
    }
  };

  const handleOpenModal = (customer = null) => {
    if (customer) {
      setEditingId(customer._id);
      setFormData(customer);
    } else {
      setEditingId(null);
      setFormData({
        CustomerCode: 'AUTO-GENERATED', CustomerName: '', ShopName: '', MobileNumber: '',
        GSTNumber: '', Address: '', City: '', State: '', Pincode: '', CreditLimit: 0
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        const res = await updateCustomer(editingId, formData);
        if (res.status) {
          toast.success(res.message);
          fetchCustomers();
          setShowModal(false);
        } else {
          toast.error(res.message);
        }
      } else {
        const res = await createCustomer(formData);
        if (res.status) {
          toast.success(res.message);
          fetchCustomers();
          setShowModal(false);
        } else {
          toast.error(res.message);
        }
      }
    } catch (err) {
      toast.error('Error saving customer');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this customer? This action cannot be undone.")) return;
    try {
      const res = await deleteCustomer(id);
      if (res.status) {
        toast.success(res.message || "Customer deleted successfully");
        fetchCustomers();
      } else {
        toast.error(res.message || "Failed to delete customer");
      }
    } catch (err) {
      toast.error("Error deleting customer");
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col md:flex-row animate-fadeIn font-sans">
      <Sidebar />
      <div className="flex-1 bg-white flex flex-col min-w-0">
        <div className="min-h-[calc(100vh-4rem)] bg-white p-4 sm:p-6 overflow-y-auto">
          <div className="w-full">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            👥 {t('customers', 'Customers')}
          </h1>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-stone-900 font-bold rounded-lg shadow-md hover:from-amber-600 hover:to-yellow-700 transition-colors"
          >
            + Add Customer
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">Customer Code</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">Customer Name</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">Shop Name</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">Mobile</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">GST Number</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">City / State</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">Credit Limit</th>
                    {isAdmin && <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {customers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                        No customers found.
                      </td>
                    </tr>
                  ) : (
                    customers.map((c, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono">{c.CustomerCode}</td>
                        <td className="px-4 py-3">{c.CustomerName}</td>
                        <td className="px-4 py-3">{c.ShopName}</td>
                        <td className="px-4 py-3">{c.MobileNumber}</td>
                        <td className="px-4 py-3 font-mono">{c.GSTNumber}</td>
                        <td className="px-4 py-3">{c.City}, {c.State}</td>
                        <td className="px-4 py-3 font-mono">₹{c.CreditLimit ? c.CreditLimit.toLocaleString('en-IN') : '0'}</td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <button onClick={() => handleOpenModal(c)} className="text-blue-600 hover:underline mr-2 font-semibold">Edit</button>
                            <button onClick={() => handleDelete(c._id)} className="text-red-600 hover:underline font-semibold ml-2">Delete</button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-900">{editingId ? 'Edit Customer' : 'Add Customer'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Customer Code</label>
                  <input 
                    type="text" 
                    required 
                    disabled
                    value={formData.CustomerCode} 
                    className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed outline-none" 
                  />
                  <p className="text-[10px] text-amber-600 font-medium mt-0.5">
                    {!editingId ? '✨ Auto-generated on save' : 'System ID — Cannot be modified'}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Customer Name</label>
                  <input type="text" required value={formData.CustomerName} onChange={e => setFormData({...formData, CustomerName: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Shop Name</label>
                  <input type="text" required value={formData.ShopName} onChange={e => setFormData({...formData, ShopName: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Mobile Number</label>
                  <input type="text" required value={formData.MobileNumber} onChange={e => setFormData({...formData, MobileNumber: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">GST Number</label>
                  <input type="text" required value={formData.GSTNumber} onChange={e => setFormData({...formData, GSTNumber: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Credit Limit</label>
                  <input type="number" required value={formData.CreditLimit} onChange={e => setFormData({...formData, CreditLimit: parseFloat(e.target.value)})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" />
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-gray-700 uppercase">Address (Shop Location)</label>
                  <button
                    type="button"
                    disabled={detectingLoc}
                    onClick={handleDetectLocation}
                    className="text-xs bg-amber-500 hover:bg-amber-600 text-stone-900 px-2.5 py-1 rounded font-bold transition-all flex items-center gap-1 shadow disabled:opacity-50 animate-pulse"
                  >
                    {detectingLoc ? (
                      <>
                        <span className="w-3 h-3 border border-stone-900 border-t-transparent rounded-full animate-spin inline-block"></span>
                        Locating...
                      </>
                    ) : (
                      '📍 Auto-Detect Shop GPS'
                    )}
                  </button>
                </div>
                <input 
                  type="text" 
                  required 
                  disabled
                  placeholder="📍 Click 'Auto-Detect Shop GPS' above to lock live location"
                  value={formData.Address} 
                  className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed outline-none" 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">City</label>
                  <input 
                    type="text" 
                    required 
                    disabled 
                    placeholder="Locked"
                    value={formData.City} 
                    className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">State</label>
                  <input 
                    type="text" 
                    required 
                    disabled 
                    placeholder="Locked"
                    value={formData.State} 
                    className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Pincode</label>
                  <input 
                    type="text" 
                    required 
                    disabled 
                    placeholder="Locked"
                    value={formData.Pincode} 
                    className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed outline-none" 
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-stone-900 font-bold rounded-lg shadow-md hover:from-amber-600 hover:to-yellow-700">Save Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};

export default CustomerPage;
