import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import Sidebar from '../components/ui/Sidebar';
import { 
  getOrders, 
  createOrder, 
  updateOrder, 
  deleteOrder, 
  getCustomers, 
  getInventory, 
  getAdminEmployees,
  createInventory
} from '../services/authService';
import toast from 'react-hot-toast';

const SearchableProductDropdown = ({ value, onChange, products, onOpenQuickAdd }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = React.useRef(null);

  React.useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const selectedProduct = products.find(p => p._id === value);
  const selectedLabel = selectedProduct 
    ? `${selectedProduct.Brand ? selectedProduct.Brand + ' - ' : ''}${selectedProduct.ProductName} (${selectedProduct.ProductCode})` 
    : 'Select a product...';

  const filtered = products.filter(p => {
    const brand = (p.Brand || '').toLowerCase();
    const name = (p.ProductName || '').toLowerCase();
    const code = (p.ProductCode || '').toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || brand.includes(q) || code.includes(q);
  });

  return (
    <div ref={dropdownRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-amber-500 text-sm bg-white text-left font-medium flex justify-between items-center shadow-sm"
      >
        <span className="truncate">{selectedLabel}</span>
        <span className="text-gray-400 ml-1 text-xs">▼</span>
      </button>

      {isOpen && (
        <div 
          style={{ top: 'calc(100% + 6px)' }}
          className="absolute left-0 w-full min-w-[280px] sm:min-w-[320px] bg-stone-900 border border-amber-500/30 rounded-xl shadow-2xl z-[150] p-2 animate-fadeIn max-h-72 overflow-hidden flex flex-col"
        >
          <input
            type="text"
            placeholder="Search brand, name, code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-amber-100 text-xs sm:text-sm outline-none focus:border-amber-500 mb-2"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
          <div className="overflow-y-auto flex-1 max-h-48 text-left space-y-0.5">
            {filtered.length === 0 ? (
              <div className="text-center py-4 text-stone-400 text-xs sm:text-sm">
                No matching products
              </div>
            ) : (
              filtered.map(p => (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => {
                    onChange(p._id);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all block ${
                    value === p._id
                      ? 'text-amber-400 bg-amber-500/15 font-bold'
                      : 'text-amber-200/70 hover:text-amber-400 hover:bg-stone-800'
                  }`}
                >
                  {p.Brand ? <span className="text-amber-500 text-[10px] font-bold block uppercase tracking-wider mb-0.5">{p.Brand}</span> : null}
                  <span className="block truncate">{p.ProductName} <span className="text-stone-400 font-mono text-[11px] sm:text-xs">({p.ProductCode})</span></span>
                </button>
              ))
            )}
          </div>
          <div className="border-t border-stone-800/80 pt-2 mt-1 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenQuickAdd();
              }}
              className="w-full py-1.5 px-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-stone-950 font-bold hover:from-amber-600 hover:to-yellow-600 rounded-lg text-xs flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all"
            >
              ➕ Quick Add Product
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const OrderPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'principal' || user?.isAdmin;

  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [employees, setEmployees] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState('');

  // Handle auto-filtering based on URL search params when clicked from dashboard
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusParam = params.get('status');
    const dateRangeParam = params.get('dateRange');

    if (statusParam) {
      setStatusFilter(statusParam);
    } else {
      setStatusFilter('');
    }

    if (dateRangeParam) {
      setDateRangeFilter(dateRangeParam);
    } else {
      setDateRangeFilter('');
    }
  }, [location.search]);

  const [formData, setFormData] = useState({
    OrderNumber: 'AUTO-GENERATED',
    CustomerId: '',
    SalesmanId: '',
    OrderDate: '',
    TotalAmount: 0,
    DiscountAmount: 0,
    TaxAmount: 0,
    FinalAmount: 0,
    OrderStatus: 'Pending',
    Remarks: '',
    OrderItems: []
  });

  // Quick-Add Product states
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickAddRowIndex, setQuickAddRowIndex] = useState(null);
  const [quickProductForm, setQuickProductForm] = useState({
    ProductName: '',
    Brand: '',
    Quantity: '1',
    Unit: 'pcs',
    Pricing: 0,
    HSNNumber: '',
    TaxPercentage: 18
  });
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false);

  const handleQuickAddSubmit = async (e) => {
    e.preventDefault();
    if (!quickProductForm.ProductName.trim()) {
      toast.error('Product Name is required');
      return;
    }

    setQuickAddSubmitting(true);
    try {
      const payload = {
        ProductId: 'AUTO-GENERATED',
        ProductCode: 'AUTO-GENERATED',
        ProductName: quickProductForm.ProductName.trim(),
        Brand: quickProductForm.Brand.trim(),
        Quantity: quickProductForm.Quantity || '1',
        Unit: quickProductForm.Unit || 'pcs',
        Pricing: Number(quickProductForm.Pricing) || 0,
        HSNNumber: quickProductForm.HSNNumber.trim() || 'AUTO-GENERATED',
        TaxPercentage: Number(quickProductForm.TaxPercentage) || 0
      };

      const res = await createInventory(payload);
      if (res.status) {
        toast.success('Product added successfully!');
        
        // Refetch inventory to get latest products list
        const prodRes = await getInventory();
        let newProdList = [];
        if (prodRes.status) {
          newProdList = prodRes.data;
          setProducts(prodRes.data);
        }

        // Find the newly created product in the new list to select it
        const newlyCreated = newProdList.find(p => 
          p.ProductName === payload.ProductName && 
          p.Brand === payload.Brand && 
          p.Pricing === payload.Pricing
        );

        if (newlyCreated && quickAddRowIndex !== null) {
          // Select this product in the active row
          handleItemChange(quickAddRowIndex, 'ProductId', newlyCreated._id);
        }

        // Reset form and close modal
        setQuickProductForm({
          ProductName: '',
          Brand: '',
          Quantity: '1',
          Unit: 'pcs',
          Pricing: 0,
          HSNNumber: '',
          TaxPercentage: 18
        });
        setShowQuickAddModal(false);
        setQuickAddRowIndex(null);
      } else {
        toast.error(res.message || 'Failed to create product');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Error creating product');
    } finally {
      setQuickAddSubmitting(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch Orders
      const orderRes = await getOrders();
      if (orderRes.status) setOrders(orderRes.data);

      // Fetch Customers
      const custRes = await getCustomers();
      if (custRes.status) setCustomers(custRes.data);

      // Fetch Products
      const prodRes = await getInventory();
      if (prodRes.status) setProducts(prodRes.data);

      // Fetch Employees (Admin only)
      if (isAdmin) {
        try {
          const empRes = await getAdminEmployees();
          if (empRes.status) setEmployees(empRes.data);
        } catch (e) {
          console.error("Failed to load employees:", e);
        }
      }
    } catch (err) {
      toast.error('Failed to load initial data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const calculateTotals = (items, discount = 0) => {
    let subtotal = 0;
    let taxTotal = 0;
    items.forEach(item => {
      const qty = Number(item.Quantity) || 0;
      const price = Number(item.Price) || 0;
      const taxPercent = Number(item.TaxPercentage) || 0;
      
      const itemSubtotal = qty * price;
      const itemTax = itemSubtotal * (taxPercent / 100);
      
      subtotal += itemSubtotal;
      taxTotal += itemTax;
    });
    
    const final = subtotal - (Number(discount) || 0) + taxTotal;
    return {
      TotalAmount: Number(subtotal.toFixed(2)),
      TaxAmount: Number(taxTotal.toFixed(2)),
      FinalAmount: Number(final.toFixed(2))
    };
  };

  const handleOpenModal = (order = null) => {
    if (!isAdmin) {
      toast.error("Access Denied: Only Admins can modify orders");
      return;
    }

    if (order) {
      setEditingId(order._id);
      
      // Map OrderItems to preserve local TaxPercentage for calculations
      const mappedItems = order.OrderItems.map(item => {
        const matchingProduct = products.find(p => p._id === item.ProductId || p.ProductId === item.ProductId);
        return {
          Id: item.Id || '',
          OrderId: item.OrderId || '',
          ProductId: item.ProductId,
          Quantity: item.Quantity,
          Price: item.Price,
          Tax: item.Tax,
          Total: item.Total,
          TaxPercentage: matchingProduct ? matchingProduct.TaxPercentage : 0,
          Brand: item.Brand || (matchingProduct ? matchingProduct.Brand : '')
        };
      });

      // Format ISO datetime string for datetime-local input (YYYY-MM-DDTHH:MM)
      let formattedDate = '';
      if (order.OrderDate) {
        const d = new Date(order.OrderDate);
        // Correct timezone offset
        const tzoffset = d.getTimezoneOffset() * 60000; 
        formattedDate = new Date(d.getTime() - tzoffset).toISOString().slice(0, 16);
      }

      setFormData({
        OrderNumber: order.OrderNumber,
        CustomerId: order.CustomerId,
        SalesmanId: order.SalesmanId,
        OrderDate: formattedDate,
        TotalAmount: order.TotalAmount,
        DiscountAmount: order.DiscountAmount,
        TaxAmount: order.TaxAmount,
        FinalAmount: order.FinalAmount,
        OrderStatus: order.OrderStatus || 'Pending',
        Remarks: order.Remarks || '',
        OrderItems: mappedItems
      });
    } else {
      setEditingId(null);
      // Format current date for datetime-local
      const now = new Date();
      const tzoffset = now.getTimezoneOffset() * 60000;
      const localISOTime = new Date(now.getTime() - tzoffset).toISOString().slice(0, 16);

      setFormData({
        OrderNumber: 'AUTO-GENERATED',
        CustomerId: customers[0]?._id || '',
        SalesmanId: user?.name || '',
        OrderDate: localISOTime,
        TotalAmount: 0,
        DiscountAmount: 0,
        TaxAmount: 0,
        FinalAmount: 0,
        OrderStatus: 'Pending',
        Remarks: '',
        OrderItems: []
      });
    }
    setShowModal(true);
  };

  const handleAddItem = () => {
    const defaultProduct = products[0];
    const newItem = {
      ProductId: defaultProduct?._id || '',
      TaxPercentage: defaultProduct?.TaxPercentage || 0,
      Quantity: 1,
      Price: defaultProduct?.Pricing || 0,
      Tax: 0,
      Total: 0,
      Brand: defaultProduct?.Brand || ''
    };
    
    // Auto calculations for the new row
    const qty = Number(newItem.Quantity) || 0;
    const price = Number(newItem.Price) || 0;
    const taxPercent = Number(newItem.TaxPercentage) || 0;
    const itemSubtotal = qty * price;
    newItem.Tax = Number((itemSubtotal * (taxPercent / 100)).toFixed(2));
    newItem.Total = Number((itemSubtotal + newItem.Tax).toFixed(2));

    const updatedItems = [...formData.OrderItems, newItem];
    const totals = calculateTotals(updatedItems, formData.DiscountAmount);
    setFormData({
      ...formData,
      OrderItems: updatedItems,
      ...totals
    });
  };

  const handleRemoveItem = (index) => {
    const updatedItems = formData.OrderItems.filter((_, i) => i !== index);
    const totals = calculateTotals(updatedItems, formData.DiscountAmount);
    setFormData({
      ...formData,
      OrderItems: updatedItems,
      ...totals
    });
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...formData.OrderItems];
    const item = { ...updatedItems[index] };
    
    if (field === 'ProductId') {
      const selectedProd = products.find(p => p._id === value || p.ProductId === value);
      if (selectedProd) {
        item.ProductId = selectedProd._id;
        item.TaxPercentage = selectedProd.TaxPercentage || 0;
        item.Price = selectedProd.Pricing || 0;
        item.Brand = selectedProd.Brand || '';
      } else {
        item.ProductId = '';
        item.TaxPercentage = 0;
        item.Price = 0;
        item.Brand = '';
      }
    } else {
      item[field] = value;
    }
    
    // Auto calculations for the row
    const qty = Number(item.Quantity) || 0;
    const price = Number(item.Price) || 0;
    const taxPercent = Number(item.TaxPercentage) || 0;
    
    const itemSubtotal = qty * price;
    item.Tax = Number((itemSubtotal * (taxPercent / 100)).toFixed(2));
    item.Total = Number((itemSubtotal + item.Tax).toFixed(2));
    
    updatedItems[index] = item;
    
    const totals = calculateTotals(updatedItems, formData.DiscountAmount);
    setFormData({
      ...formData,
      OrderItems: updatedItems,
      ...totals
    });
  };

  const handleDiscountChange = (val) => {
    const discount = Number(val) || 0;
    const totals = calculateTotals(formData.OrderItems, discount);
    setFormData({
      ...formData,
      DiscountAmount: discount,
      ...totals
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error("Unauthorized: Only Admins can save changes");
      return;
    }

    if (formData.OrderItems.length === 0) {
      toast.error("Please add at least one item to the order");
      return;
    }

    // Clean dates to UTC for database storage
    const cleanFormData = {
      ...formData,
      OrderDate: new Date(formData.OrderDate).toISOString()
    };

    // Clean local UI fields from order items before sending to backend
    cleanFormData.OrderItems = cleanFormData.OrderItems.map(({ TaxPercentage, ...rest }) => rest);

    try {
      if (editingId) {
        const res = await updateOrder(editingId, cleanFormData);
        if (res.status) {
          toast.success(res.message || 'Order updated successfully');
          fetchData();
          setShowModal(false);
        } else {
          toast.error(res.message);
        }
      } else {
        const res = await createOrder(cleanFormData);
        if (res.status) {
          toast.success(res.message || 'Order created successfully');
          fetchData();
          setShowModal(false);
        } else {
          toast.error(res.message);
        }
      }
    } catch (err) {
      toast.error('Error saving order');
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    if (!isAdmin) {
      toast.error("Unauthorized: Only Admins can change order status");
      return;
    }

    try {
      const orderToUpdate = orders.find(o => o._id === orderId);
      if (!orderToUpdate) return;
      
      const updatedPayload = {
        ...orderToUpdate,
        OrderStatus: newStatus
      };

      // Clean local UI fields from order items before sending to backend
      updatedPayload.OrderItems = updatedPayload.OrderItems.map(({ TaxPercentage, ...rest }) => rest);

      const res = await updateOrder(orderId, updatedPayload);
      if (res.status) {
        toast.success(`Order status updated to ${newStatus}`);
        fetchData();
      } else {
        toast.error(res.message || 'Failed to update order status');
      }
    } catch (err) {
      toast.error('Error updating order status');
    }
  };

  const handleDelete = async (id) => {
    if (!isAdmin) {
      toast.error("Unauthorized: Only Admins can delete orders");
      return;
    }

    if (!window.confirm('Are you sure you want to delete this order?')) return;
    
    try {
      const res = await deleteOrder(id);
      if (res.status) {
        toast.success(res.message || 'Order deleted successfully');
        fetchData();
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error('Error deleting order');
    }
  };

  const getCustomerLabel = (custId) => {
    const c = customers.find(cust => cust._id === custId || cust.CustomerCode === custId);
    return c ? `${c.CustomerName} (${c.ShopName})` : 'Unknown Customer';
  };

  const getProductLabel = (prodId) => {
    const p = products.find(prod => prod._id === prodId || prod.ProductId === prodId);
    return p ? p.ProductName : 'Unknown Product';
  };

  const numberToWords = (num) => {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    let rounded = Math.round(num);
    if (rounded === 0) return 'Zero Rupees Only';
    
    let n = ('000000000' + rounded).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return ''; 
    let str = '';
    str += (Number(n[1]) != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
    str += (Number(n[2]) != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
    str += (Number(n[3]) != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
    str += (Number(n[4]) != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
    str += (Number(n[5]) != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'Rupees Only' : 'Rupees Only';
    return str;
  };

  const downloadOrderPDF = (order) => {
    const customer = customers.find(c => c._id === order.CustomerId || c.CustomerCode === order.CustomerId) || {};
    
    // Create hidden iframe for high-fidelity print
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow.document;
    doc.open();
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Order Confirmation - ${order.OrderNumber}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap');
          body {
            font-family: 'Outfit', sans-serif;
            color: #1c1917;
            margin: 0;
            padding: 30px;
            background-color: #ffffff;
            font-size: 13px;
            line-height: 1.5;
          }
          .container {
            border: 2px solid #b45309;
            padding: 30px;
            border-radius: 20px;
            background-color: #fafaf9;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #e7e5e4;
            padding-bottom: 20px;
            margin-bottom: 25px;
          }
          .company-logo {
            font-size: 24px;
            font-weight: 800;
            color: #1c1917;
            letter-spacing: 1px;
          }
          .company-logo span {
            color: #b45309;
          }
          .document-title {
            text-align: right;
          }
          .document-title h1 {
            margin: 0;
            font-size: 20px;
            color: #b45309;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .document-title p {
            margin: 4px 0 0 0;
            color: #78716c;
            font-weight: 600;
            font-size: 11px;
          }
          .meta-grid {
            display: grid;
            grid-template-cols: 1fr 1fr;
            gap: 25px;
            margin-bottom: 25px;
          }
          .card {
            background-color: #ffffff;
            border: 1px solid #e7e5e4;
            padding: 15px;
            border-radius: 12px;
          }
          .card h3 {
            margin-top: 0;
            margin-bottom: 10px;
            font-size: 12px;
            text-transform: uppercase;
            color: #b45309;
            border-bottom: 1px solid #f5f5f4;
            padding-bottom: 6px;
            font-weight: 800;
            letter-spacing: 0.5px;
          }
          .info-line {
            margin-bottom: 6px;
            display: flex;
          }
          .info-line strong {
            width: 110px;
            color: #44403c;
            flex-shrink: 0;
          }
          .info-line span {
            color: #1c1917;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
          }
          .items-table th {
            background-color: #1c1917;
            color: #f5f5f4;
            padding: 10px 12px;
            text-align: left;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
          }
          .items-table th:first-child {
            border-top-left-radius: 8px;
            border-bottom-left-radius: 8px;
          }
          .items-table th:last-child {
            border-top-right-radius: 8px;
            border-bottom-right-radius: 8px;
            text-align: right;
          }
          .items-table td {
            padding: 12px;
            border-bottom: 1px solid #e7e5e4;
            color: #44403c;
          }
          .items-table td:last-child {
            text-align: right;
            font-weight: 600;
          }
          .items-table tr:hover td {
            background-color: #f5f5f4;
          }
          .brand-badge {
            background-color: #f5f5f4;
            border: 1px solid #e7e5e4;
            color: #b45309;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            display: inline-block;
            margin-right: 6px;
          }
          .financials-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-top: 15px;
          }
          .remarks-card {
            width: 52%;
            background-color: #ffffff;
            border: 1px solid #e7e5e4;
            padding: 15px;
            border-radius: 12px;
            min-height: 80px;
          }
          .remarks-card h3 {
            margin-top: 0;
            margin-bottom: 8px;
            font-size: 11px;
            text-transform: uppercase;
            color: #78716c;
            font-weight: 800;
          }
          .remarks-card p {
            margin: 0;
            color: #44403c;
            font-style: italic;
          }
          .totals-box {
            width: 40%;
            background-color: #1c1917;
            color: #fafaf9;
            padding: 20px;
            border-radius: 15px;
            border: 1px solid #b45309;
          }
          .totals-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 12px;
          }
          .totals-row.grand-total {
            margin-top: 15px;
            border-top: 1px dashed rgba(180, 83, 9, 0.4);
            padding-top: 12px;
            font-size: 16px;
            font-weight: 800;
            color: #fbbf24;
          }
          .totals-row span.label {
            color: #a8a29e;
          }
          .footer {
            text-align: center;
            margin-top: 40px;
            font-size: 11px;
            color: #78716c;
            border-top: 1px solid #e7e5e4;
            padding-top: 15px;
          }
          @media print {
            body { padding: 0; }
            .container { border: none; background-color: transparent; padding: 0; box-shadow: none; }
            .totals-box { background-color: #1c1917 !important; color: #fafaf9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="company-logo">
              &nbsp;
            </div>
            <div class="document-title">
              <h1>Order Confirmation</h1>
              <p>REF NO: ${order.OrderNumber}</p>
            </div>
          </div>
          
          <div class="meta-grid">
            <div class="card">
              <h3>Customer Particulars</h3>
              <div class="info-line"><strong>Shop Name:</strong> <span>${customer.ShopName || 'N/A'}</span></div>
              <div class="info-line"><strong>Client Name:</strong> <span>${customer.CustomerName || 'N/A'}</span></div>
              <div class="info-line"><strong>GST Number:</strong> <span>${customer.GSTNumber || 'N/A'}</span></div>
              <div class="info-line"><strong>Contact:</strong> <span>${customer.MobileNumber || 'N/A'}</span></div>
              <div class="info-line"><strong>Location:</strong> <span>${customer.City || 'N/A'}, ${customer.State || 'N/A'}</span></div>
            </div>
            
            <div class="card">
              <h3>Order Specifications</h3>
              <div class="info-line"><strong>Order ID:</strong> <span>${order.OrderNumber}</span></div>
              <div class="info-line"><strong>Date / Time:</strong> <span>${order.OrderDate ? new Date(order.OrderDate).toLocaleString('en-IN') : 'N/A'}</span></div>
              <div class="info-line"><strong>Sales Executive:</strong> <span>${order.SalesmanId || 'N/A'}</span></div>
              <div class="info-line"><strong>Status:</strong> <span>${order.OrderStatus || 'Pending'}</span></div>
            </div>
          </div>
          
          <table class="items-table">
            <thead>
              <tr>
                <th>Product Description</th>
                <th>Qty</th>
                <th>Rate (₹)</th>
                <th>Tax Rate</th>
                <th>Total Value (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${order.OrderItems.map(item => {
                const brand = item.Brand ? `<span class="brand-badge">${item.Brand}</span>` : '';
                const rate = typeof item.Price === 'number' ? item.Price : 0;
                const total = typeof item.Total === 'number' ? item.Total : 0;
                return `
                  <tr>
                    <td>
                      ${brand}
                      <strong>${getProductLabel(item.ProductId)}</strong>
                    </td>
                    <td style="font-family: monospace;">${item.Quantity}</td>
                    <td style="font-family: monospace;">₹${rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td style="font-family: monospace; color: #78716c;">${item.TaxPercentage !== undefined ? item.TaxPercentage : (products.find(p => p._id === item.ProductId)?.TaxPercentage || 0)}%</td>
                    <td style="font-family: monospace;">₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          
          <div class="financials-section">
            <div class="remarks-card">
              <h3>Order Remarks</h3>
              <p>${order.Remarks || 'No specific remarks or delivery instructions provided for this order.'}</p>
            </div>
            
            <div class="totals-box">
              <div class="totals-row">
                <span class="label">Items Subtotal:</span>
                <span style="font-family: monospace;">₹${order.TotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div class="totals-row">
                <span class="label">Discount:</span>
                <span style="font-family: monospace; color: #f87171;">- ₹${order.DiscountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div class="totals-row">
                <span class="label">GST (Taxes):</span>
                <span style="font-family: monospace;">₹${order.TaxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div class="totals-row grand-total">
                <span>Grand Total:</span>
                <span style="font-family: monospace;">₹${order.FinalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
          
          <div class="footer">
            <p>Thank you for your business! If you have any questions regarding this order, please contact support.</p>
            <p style="font-size: 9px; color: #a8a29e; margin-top: 5px;">This is an electronically generated document. No physical signature is required.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    doc.write(htmlContent);
    doc.close();
    
    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
      document.body.removeChild(iframe);
    }, 500);
  };

  const downloadInvoicePDF = (order) => {
    const customer = customers.find(c => c._id === order.CustomerId || c.CustomerCode === order.CustomerId) || {};
    
    // Determine CGST, SGST, IGST split based on state matching (Company state is Maharashtra)
    const companyState = "maharashtra";
    const customerStateStr = (customer.State || '').trim().toLowerCase();
    const isInterState = customerStateStr !== "" && customerStateStr !== companyState;
    
    // Create print window using iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow.document;
    doc.open();
    
    // Elegant Tax Invoice CSS styling
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Tax Invoice - ${order.OrderNumber}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&display=swap');
          body {
            font-family: 'Outfit', sans-serif;
            color: #1c1917;
            margin: 0;
            padding: 30px;
            background-color: #ffffff;
            font-size: 12px;
            line-height: 1.4;
          }
          .invoice-box {
            border: 3px double #b45309;
            padding: 25px;
            border-radius: 12px;
            background-color: #ffffff;
          }
          .title-header {
            text-align: center;
            border-bottom: 2px solid #1c1917;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          .title-header h1 {
            margin: 0;
            font-size: 26px;
            color: #1c1917;
            text-transform: uppercase;
            font-weight: 800;
            letter-spacing: 2px;
          }
          .title-header p {
            margin: 5px 0 0 0;
            font-size: 11px;
            color: #b45309;
            font-weight: 800;
            letter-spacing: 1px;
          }
          .parties-grid {
            display: grid;
            grid-template-cols: 1fr 1fr;
            gap: 30px;
            margin-bottom: 20px;
            border-bottom: 1px solid #e7e5e4;
            padding-bottom: 15px;
          }
          .party-card h3 {
            margin-top: 0;
            margin-bottom: 8px;
            font-size: 12px;
            text-transform: uppercase;
            color: #b45309;
            font-weight: 800;
            letter-spacing: 0.5px;
          }
          .party-name {
            font-size: 14px;
            font-weight: 700;
            color: #1c1917;
            margin-bottom: 6px;
          }
          .party-details {
            color: #44403c;
            line-height: 1.5;
          }
          .invoice-meta-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            background-color: #fcfbfb;
            border: 1px solid #e7e5e4;
            padding: 10px 15px;
            border-radius: 8px;
            font-size: 11px;
          }
          .invoice-meta-item strong {
            color: #78716c;
            text-transform: uppercase;
          }
          .invoice-meta-item span {
            color: #1c1917;
            font-weight: 700;
            margin-left: 5px;
          }
          .invoice-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .invoice-table th {
            border-top: 1px solid #1c1917;
            border-bottom: 1px solid #1c1917;
            padding: 8px 10px;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 10px;
            color: #1c1917;
            background-color: #fafaf9;
            text-align: left;
          }
          .invoice-table td {
            padding: 10px;
            border-bottom: 1px dashed #e7e5e4;
            color: #292524;
          }
          .invoice-table td.num-cell {
            font-family: monospace;
            text-align: right;
          }
          .tax-breakdown-row td {
            padding-top: 6px;
            padding-bottom: 6px;
            font-size: 11px;
            color: #57534e;
          }
          .summary-container {
            display: flex;
            justify-content: space-between;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #1c1917;
          }
          .words-block {
            width: 55%;
            font-style: italic;
            color: #44403c;
          }
          .words-block strong {
            display: block;
            font-style: normal;
            font-size: 10px;
            text-transform: uppercase;
            color: #78716c;
            margin-bottom: 4px;
            font-weight: 850;
          }
          .totals-block {
            width: 40%;
          }
          .totals-table {
            width: 100%;
            border-collapse: collapse;
          }
          .totals-table td {
            padding: 5px 0;
            font-size: 12px;
          }
          .totals-table td.val {
            text-align: right;
            font-family: monospace;
            font-weight: 600;
          }
          .totals-table tr.final-due-row td {
            border-top: 2px double #1c1917;
            padding-top: 8px;
            font-size: 15px;
            font-weight: 800;
            color: #1c1917;
          }
          .totals-table tr.final-due-row td.val {
            color: #b45309;
          }
          .signature-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 45px;
          }
          .terms-block {
            width: 50%;
            font-size: 10px;
            color: #78716c;
            line-height: 1.5;
          }
          .terms-block strong {
            color: #44403c;
            text-transform: uppercase;
            font-size: 10px;
          }
          .sign-block {
            text-align: right;
            font-size: 11px;
          }
          .sign-block p {
            margin: 0;
          }
          .sign-line {
            margin-top: 50px;
            border-top: 1px solid #1c1917;
            display: inline-block;
            width: 180px;
            padding-top: 5px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="invoice-box">
          <div class="title-header">
            <h1>Tax Invoice</h1>
            <p>ORIGINAL FOR RECIPIENT</p>
          </div>
          
          <div class="parties-grid" style="display: block;">
            <div class="party-card">
              <h3>Billing Address (Recipient)</h3>
              <div class="party-name">${customer.ShopName || 'N/A'}</div>
              <div class="party-details">
                <strong>Contact Person:</strong> ${customer.CustomerName || 'N/A'}<br/>
                ${customer.Address || 'No billing address provided.'}<br/>
                ${customer.City || ''}, ${customer.State || ''}<br/>
                <strong>Mobile:</strong> ${customer.MobileNumber || 'N/A'}<br/>
                <strong>GSTIN:</strong> ${customer.GSTNumber || 'N/A'}<br/>
                <strong>State:</strong> ${customer.State || 'N/A'}
              </div>
            </div>
          </div>
          
          <div class="invoice-meta-row">
            <div class="invoice-meta-item"><strong>Invoice No:</strong><span>${order.OrderNumber}</span></div>
            <div class="invoice-meta-item"><strong>Date of Issue:</strong><span>${order.OrderDate ? new Date(order.OrderDate).toLocaleDateString('en-IN') : 'N/A'}</span></div>
            <div class="invoice-meta-item"><strong>Payment Mode:</strong><span>Cash/Credit</span></div>
            <div class="invoice-meta-item"><strong>Place of Supply:</strong><span>${customer.State || 'N/A'}</span></div>
          </div>
          
          <table class="invoice-table">
            <thead>
              <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 35%;">Product Description</th>
                <th style="width: 10%; text-align: right;">Qty</th>
                <th style="width: 15%; text-align: right;">Rate (₹)</th>
                <th style="width: 15%; text-align: right;">Taxable Val (₹)</th>
                <th style="width: 20%; text-align: right;">GST Breakup (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${order.OrderItems.map((item, idx) => {
                const rate = typeof item.Price === 'number' ? item.Price : 0;
                const qty = typeof item.Quantity === 'number' ? item.Quantity : 0;
                const taxPercent = item.TaxPercentage !== undefined ? item.TaxPercentage : (products.find(p => p._id === item.ProductId)?.TaxPercentage || 0);
                const taxableVal = rate * qty;
                const taxVal = typeof item.Tax === 'number' ? item.Tax : 0;
                
                // GST Breakdown representation
                let gstLabel = "";
                if (isInterState) {
                  gstLabel = `IGST @ ${taxPercent}%: ₹${taxVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
                } else {
                  gstLabel = `
                    CGST @ ${(taxPercent / 2)}%: ₹${(taxVal / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}<br/>
                    SGST @ ${(taxPercent / 2)}%: ₹${(taxVal / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  `;
                }
                
                return `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>
                      <strong>${getProductLabel(item.ProductId)}</strong>
                      ${item.Brand ? `<span style="font-size:9px; color:#b45309; display:block;">Brand: ${item.Brand}</span>` : ''}
                    </td>
                    <td class="num-cell">${qty}</td>
                    <td class="num-cell">₹${rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td class="num-cell">₹${taxableVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td class="num-cell" style="font-size: 10px; color: #57534e;">${gstLabel}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          
          <div class="summary-container">
            <div class="words-block">
              <strong>Amount Chargeable (in words):</strong>
              ₹ ${numberToWords(order.FinalAmount)}
            </div>
            
            <div class="totals-block">
              <table class="totals-row">
                <tr class="totals-row">
                  <td style="color:#57534e;">Total Taxable Value:</td>
                  <td class="val">₹${order.TotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr class="totals-row">
                  <td style="color:#57534e;">Total Discount Value:</td>
                  <td class="val" style="color: #ef4444;">- ₹${order.DiscountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr class="totals-row">
                  <td style="color:#57534e;">Total GST Tax Value:</td>
                  <td class="val">₹${order.TaxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr class="final-due-row">
                  <td>Grand Total Due:</td>
                  <td class="val">₹${order.FinalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              </table>
            </div>
          </div>
          
          <div class="signature-section">
            <div class="terms-block">
              <strong>Terms and Conditions:</strong><br/>
              1. Goods once sold will not be taken back or exchanged.<br/>
              2. Interest at 18% per annum will be charged if payment is not settled within 15 days.<br/>
              3. All disputes are subject to Mumbai, Maharashtra Jurisdiction only.
            </div>
            
            <div class="sign-block">
              <p>&nbsp;</p>
              <span class="sign-line">Authorized Signatory</span>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    
    doc.write(htmlContent);
    doc.close();
    
    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
      document.body.removeChild(iframe);
    }, 500);
  };

  const filteredOrders = orders.filter(order => {
    const customerLabel = getCustomerLabel(order.CustomerId).toLowerCase();
    const orderNum = (order.OrderNumber || '').toLowerCase();
    const salesman = (order.SalesmanId || '').toLowerCase();
    const query = searchQuery.toLowerCase();

    const matchesSearch = customerLabel.includes(query) || orderNum.includes(query) || salesman.includes(query);
    const matchesStatus = statusFilter === '' || order.OrderStatus === statusFilter;

    // Date range filtering
    let matchesDateRange = true;
    if (order.OrderDate) {
      const orderDate = new Date(order.OrderDate);
      const today = new Date();
      if (dateRangeFilter === 'today') {
        matchesDateRange = orderDate.toDateString() === today.toDateString();
      } else if (dateRangeFilter === 'month') {
        matchesDateRange = orderDate.getMonth() === today.getMonth() && orderDate.getFullYear() === today.getFullYear();
      }
    } else if (dateRangeFilter !== '') {
      matchesDateRange = false;
    }

    return matchesSearch && matchesStatus && matchesDateRange;
  });

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col md:flex-row animate-fadeIn font-sans">
      <Sidebar />
      <div className="flex-1 bg-white flex flex-col min-w-0">
        <div className="min-h-[calc(100vh-4rem)] bg-white p-4 sm:p-6 overflow-y-auto">
          <div className="w-full">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            📊 {t('orders', 'Orders')}
          </h1>
          {isAdmin && (
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-stone-900 font-bold rounded-lg shadow-md hover:from-amber-600 hover:to-yellow-700 transition-colors"
            >
              + Add Order
            </button>
          )}
        </div>

        {/* Filters and Search */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Search Orders</label>
            <input 
              type="text"
              placeholder="Search by customer, order number, salesman..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Filter by Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Processing">Processing</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Filter by Date Range</label>
            <select
              value={dateRangeFilter}
              onChange={e => setDateRangeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">All Dates</option>
              <option value="today">Today's Orders</option>
              <option value="month">Current Month's Orders</option>
            </select>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading orders...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">Order Number</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">Salesman</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">Order Date</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase font-mono">Total Items</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">Final Amount</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="px-4 py-8 text-center text-gray-500">
                        No orders found.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((o) => (
                      <tr key={o._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono font-bold text-stone-700">{o.OrderNumber}</td>
                        <td className="px-4 py-3">{getCustomerLabel(o.CustomerId)}</td>
                        <td className="px-4 py-3">{o.SalesmanId}</td>
                        <td className="px-4 py-3">
                          {o.OrderDate ? new Date(o.OrderDate).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-4 py-3 font-mono">{o.OrderItems?.length || 0}</td>
                        <td className="px-4 py-3 font-mono font-bold text-stone-900">₹{(o.FinalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3">
                          <select
                            disabled={!isAdmin}
                            value={o.OrderStatus || 'Pending'}
                            onChange={e => handleStatusChange(o._id, e.target.value)}
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg outline-none border cursor-pointer transition-all shadow-sm ${
                              o.OrderStatus === 'Completed' ? 'bg-green-50 text-green-800 border-green-300 focus:ring-2 focus:ring-green-400' :
                              o.OrderStatus === 'Processing' ? 'bg-blue-50 text-blue-800 border-blue-300 focus:ring-2 focus:ring-blue-400' :
                              o.OrderStatus === 'Cancelled' ? 'bg-red-50 text-red-800 border-red-300 focus:ring-2 focus:ring-red-400' :
                              'bg-amber-50 text-amber-850 border-amber-300 focus:ring-2 focus:ring-amber-400'
                            }`}
                          >
                            <option value="Pending" className="bg-white text-stone-900">Pending</option>
                            <option value="Processing" className="bg-white text-stone-900">Processing</option>
                            <option value="Completed" className="bg-white text-stone-900">Completed</option>
                            <option value="Cancelled" className="bg-white text-stone-900">Cancelled</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <button 
                              onClick={() => downloadOrderPDF(o)} 
                              className="bg-amber-500 hover:bg-amber-600 text-stone-900 text-xs px-2.5 py-1.5 rounded font-bold shadow transition-all flex items-center gap-1 active:scale-95"
                              title="Download Order Details PDF"
                            >
                              📄 Order
                            </button>
                            <button 
                              onClick={() => downloadInvoicePDF(o)} 
                              className="bg-stone-900 hover:bg-stone-800 text-amber-400 border border-amber-500/50 text-xs px-2.5 py-1.5 rounded font-bold shadow transition-all flex items-center gap-1 active:scale-95"
                              title="Download Tax Invoice PDF"
                            >
                              🧾 Invoice
                            </button>
                            {isAdmin && (
                              <div className="inline-flex gap-2 ml-1">
                                <button 
                                  onClick={() => handleOpenModal(o)} 
                                  className="text-blue-600 hover:underline font-bold text-xs"
                                >
                                  Edit
                                </button>
                                <button 
                                  onClick={() => handleDelete(o._id)} 
                                  className="text-red-600 hover:underline font-bold text-xs"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── ADD/EDIT ORDER MODAL ── */}
      {showModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-900">{editingId ? 'Edit Order' : 'Add Order'}</h2>
              <button 
                onClick={() => setShowModal(false)} 
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-6">
              
              {/* Order Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Order Number</label>
                  <input 
                    type="text" 
                    placeholder="AUTO-GENERATED"
                    value={formData.OrderNumber === 'AUTO-GENERATED' ? '' : formData.OrderNumber} 
                    onChange={e => setFormData({ ...formData, OrderNumber: e.target.value || 'AUTO-GENERATED' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 font-mono text-sm bg-white" 
                  />
                  <p className="text-[10px] text-amber-600 font-medium mt-1">
                    Leave blank to auto-generate sequentially.
                  </p>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Customer</label>
                  <select
                    required
                    value={formData.CustomerId}
                    onChange={e => setFormData({ ...formData, CustomerId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                  >
                    {customers.map(c => (
                      <option key={c._id} value={c._id}>
                        {c.CustomerName} ({c.ShopName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Salesperson</label>
                  {employees.length > 0 ? (
                    <select
                      value={formData.SalesmanId}
                      onChange={e => setFormData({ ...formData, SalesmanId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                    >
                      {employees.map(emp => (
                        <option key={emp._id} value={emp.name}>
                          {emp.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input 
                      type="text"
                      required
                      value={formData.SalesmanId}
                      onChange={e => setFormData({ ...formData, SalesmanId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Order Date</label>
                  <input 
                    type="datetime-local" 
                    required
                    value={formData.OrderDate} 
                    onChange={e => setFormData({ ...formData, OrderDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 text-sm" 
                  />
                </div>
              </div>

              {/* Order Items Section */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                    📦 Order Items
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-3 py-1 text-xs bg-stone-900 hover:bg-stone-800 text-amber-400 font-bold rounded shadow transition-all border border-amber-500"
                  >
                    + Add Item Row
                  </button>
                </div>

                {formData.OrderItems.length === 0 ? (
                  <div className="p-8 border-2 border-dashed border-gray-200 rounded-xl text-center text-gray-500">
                    No items added. Click "+ Add Item Row" above to add products.
                  </div>
                ) : (
                  <div className="border rounded-xl overflow-visible shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200 text-sm bg-white overflow-visible">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-bold text-gray-500 uppercase text-xs w-[38%]">Product</th>
                          <th className="px-3 py-2 text-left font-bold text-gray-500 uppercase text-xs w-[12%]">Quantity</th>
                          <th className="px-3 py-2 text-left font-bold text-gray-500 uppercase text-xs w-[18%]">Price (₹)</th>
                          <th className="px-3 py-2 text-left font-bold text-gray-500 uppercase text-xs w-[10%]">Tax Rate</th>
                          <th className="px-3 py-2 text-left font-bold text-gray-500 uppercase text-xs w-[15%]">Total (₹)</th>
                          <th className="px-3 py-2 text-center font-bold text-gray-500 uppercase text-xs w-[7%]">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 overflow-visible">
                        {formData.OrderItems.map((item, index) => (
                          <tr key={index} className="overflow-visible">
                            <td className="px-3 py-2 overflow-visible relative">
                              <div className="flex flex-col gap-1">
                                <SearchableProductDropdown
                                  value={item.ProductId}
                                  onChange={val => handleItemChange(index, 'ProductId', val)}
                                  products={products}
                                  onOpenQuickAdd={() => {
                                    setQuickAddRowIndex(index);
                                    setShowQuickAddModal(true);
                                  }}
                                />
                                {item.Brand && (
                                  <div>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-stone-900 text-amber-400 border border-amber-500/30">
                                      Brand: {item.Brand}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <input 
                                type="number" 
                                min="1" 
                                required
                                value={item.Quantity}
                                onChange={e => handleItemChange(index, 'Quantity', parseInt(e.target.value) || 0)}
                                className="w-full p-1.5 border rounded outline-none focus:ring-1 focus:ring-amber-500 text-sm font-mono"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input 
                                type="number" 
                                min="0" 
                                step="0.01" 
                                required
                                value={item.Price}
                                onChange={e => handleItemChange(index, 'Price', parseFloat(e.target.value) || 0)}
                                className="w-full p-1.5 border rounded outline-none focus:ring-1 focus:ring-amber-500 text-sm font-mono"
                              />
                            </td>
                            <td className="px-3 py-2 font-mono text-gray-600 text-xs">
                              {item.TaxPercentage}%
                            </td>
                            <td className="px-3 py-2 font-mono font-bold text-stone-850">
                              ₹{item.Total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(index)}
                                className="text-red-500 hover:text-red-700 font-bold"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Remarks, Status & Summary Calculation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Remarks</label>
                  <textarea
                    rows="3"
                    value={formData.Remarks}
                    onChange={e => setFormData({ ...formData, Remarks: e.target.value })}
                    placeholder="Add special delivery remarks, payment terms..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 text-sm bg-white"
                  />
                  
                  <div className="mt-4">
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Order Status</label>
                    <select
                      value={formData.OrderStatus}
                      onChange={e => setFormData({ ...formData, OrderStatus: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Processing">Processing</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="bg-stone-900 rounded-xl p-4 text-amber-400 space-y-3 font-semibold border border-amber-500/20">
                  <h4 className="text-xs uppercase tracking-wider text-amber-500 font-bold mb-1">
                    💲 Order Financials Summary
                  </h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-400">Total Items Subtotal (Pre-tax):</span>
                    <span className="font-mono text-white">₹{formData.TotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-stone-400">Discount Amount (₹):</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.DiscountAmount}
                      onChange={e => handleDiscountChange(e.target.value)}
                      className="w-32 p-1 border border-amber-500 bg-stone-800 text-amber-400 rounded text-right font-mono focus:ring-1 focus:ring-amber-400 outline-none text-sm"
                    />
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-stone-400">Total Combined Tax Amount:</span>
                    <span className="font-mono text-white">₹{formData.TaxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div className="h-px bg-amber-500/20 my-2"></div>

                  <div className="flex justify-between text-base font-bold items-center">
                    <span className="text-amber-500 text-sm">Final Amount Due:</span>
                    <span className="font-mono text-amber-400 text-lg bg-stone-850 px-2 py-0.5 rounded border border-amber-500/30">
                      ₹{formData.FinalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-4 flex justify-end gap-3 border-t">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="px-4 py-2 text-gray-600 bg-gray-150 hover:bg-gray-200 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-stone-900 font-bold rounded-lg shadow-md hover:from-amber-600 hover:to-yellow-700 transition-colors"
                >
                  {editingId ? 'Save Changes' : 'Place Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── INLINE QUICK-ADD PRODUCT MODAL ── */}
      {showQuickAddModal && isAdmin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-stone-900 border border-amber-500/30 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            {/* Header */}
            <div className="bg-stone-950 px-6 py-4 border-b border-amber-500/20 flex justify-between items-center">
              <h3 className="text-base sm:text-lg font-bold text-amber-100 flex items-center gap-2">
                <span>➕</span> Quick Add Product
              </h3>
              <button 
                type="button"
                onClick={() => {
                  setShowQuickAddModal(false);
                  setQuickAddRowIndex(null);
                }}
                className="text-amber-200/50 hover:text-amber-400 transition-colors text-xl font-bold focus:outline-none"
              >
                &times;
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleQuickAddSubmit}>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-amber-200/60 uppercase tracking-wider block text-left">Product Name *</label>
                  <input 
                    type="text"
                    required
                    value={quickProductForm.ProductName}
                    onChange={(e) => setQuickProductForm({ ...quickProductForm, ProductName: e.target.value })}
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-amber-100 text-sm outline-none focus:border-amber-500"
                    placeholder="e.g. Earl Grey Tea"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-amber-200/60 uppercase tracking-wider block text-left">Brand</label>
                    <input 
                      type="text"
                      value={quickProductForm.Brand}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, Brand: e.target.value })}
                      className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-amber-100 text-sm outline-none focus:border-amber-500"
                      placeholder="e.g. Twinings"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-amber-200/60 uppercase tracking-wider block text-left">Pricing (₹) *</label>
                    <input 
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={quickProductForm.Pricing}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, Pricing: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-amber-100 text-sm outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-amber-200/60 uppercase tracking-wider block text-left">Quantity</label>
                    <input 
                      type="text"
                      value={quickProductForm.Quantity}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, Quantity: e.target.value })}
                      className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-amber-100 text-sm outline-none focus:border-amber-500 font-mono"
                      placeholder="e.g. 100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-amber-200/60 uppercase tracking-wider block text-left">Unit</label>
                    <select
                      value={quickProductForm.Unit}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, Unit: e.target.value })}
                      className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-amber-100 text-sm outline-none focus:border-amber-500"
                    >
                      <option value="pcs" className="bg-stone-900 text-amber-105">pcs</option>
                      <option value="ml" className="bg-stone-900 text-amber-105">ml</option>
                      <option value="ltr" className="bg-stone-900 text-amber-105">ltr</option>
                      <option value="kg" className="bg-stone-900 text-amber-105">kg</option>
                      <option value="grams" className="bg-stone-900 text-amber-105">grams</option>
                      <option value="box" className="bg-stone-900 text-amber-105">box</option>
                      <option value="pack" className="bg-stone-900 text-amber-105">pack</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-amber-200/60 uppercase tracking-wider block text-left">HSN Number</label>
                    <input 
                      type="text"
                      value={quickProductForm.HSNNumber}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, HSNNumber: e.target.value })}
                      className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-amber-100 text-sm outline-none focus:border-amber-500 font-mono"
                      placeholder="e.g. 09024020"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-amber-200/60 uppercase tracking-wider block text-left">Tax Percentage (%)</label>
                    <input 
                      type="number"
                      min="0"
                      max="100"
                      value={quickProductForm.TaxPercentage}
                      onChange={(e) => setQuickProductForm({ ...quickProductForm, TaxPercentage: parseInt(e.target.value) || 0 })}
                      className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-amber-100 text-sm outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-stone-950 px-6 py-4 border-t border-amber-500/20 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    setShowQuickAddModal(false);
                    setQuickAddRowIndex(null);
                  }}
                  className="px-4 py-2 border border-stone-800 text-amber-200/70 hover:bg-stone-800 rounded-lg text-sm transition-colors focus:outline-none"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={quickAddSubmitting}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-stone-950 font-bold hover:from-amber-600 hover:to-yellow-600 transition-colors rounded-lg text-sm flex items-center gap-1.5 focus:outline-none"
                >
                  {quickAddSubmitting ? (
                    <span className="w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin"></span>
                  ) : 'Save Product'}
                </button>
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

export default OrderPage;
