import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { 
  getInventory, createInventory, updateInventory, deleteInventory,
  getMeasurements, createMeasurement, updateMeasurement, deleteMeasurement
} from '../services/authService';
import toast from 'react-hot-toast';
import Sidebar from '../components/ui/Sidebar';

const DEFAULT_BRAND_CATEGORIES = {
  'Tea, Coffee & Beverages': [
    'Tata Tea', 'Taj Mahal', 'Red Label', 'Lipton', 'Nescafé', 'Bru', 'Starbucks', 'Tetley', 'Twinings', 'Wagh Bakri'
  ],
  'Dairy, Powders & Breakfast': [
    'Amul', 'Mother Dairy', 'Nandini', 'Nestlé', 'Britannia', 'Kellogg\'s', 'Kissan', 'Hershey\'s', 'Cadbury', 'MTR'
  ],
  'Grocery & Food Staples': [
    'Aashirvaad', 'Fortune', 'Daawat', 'Tata Salt', 'Maggi', 'Sunfeast', 'Haldiram\'s', 'Parle', 'ITC', 'Pillsbury'
  ],
  'Stationary': [
    'Spiril', 'Double A', 'JK Paper', 'Century Paper', 'Paperkraft', 'BILT'
  ],
  'Personal Care & Hygiene': [
    'Dettol', 'Dove', 'Colgate', 'Pears', 'Nivea', 'Lifebuoy', 'Gillette', 'Head & Shoulders', 'Panten', 'Sensodyne'
  ],
  'Household & Laundry': [
    'Surf Excel', 'Vim', 'Ariel', 'Rin', 'Harpic', 'Lizol', 'Comfort', 'Tide'
  ],
  'Electronics & Tech': [
    'Apple', 'Samsung', 'Sony', 'Dell', 'HP', 'LG', 'Bajaj', 'Philips', 'Panasonic', 'Lenovo', 'Xiaomi', 'OnePlus'
  ],
  'Other': [
    'Generic'
  ]
};

const PRESET_BRANDS = Object.values(DEFAULT_BRAND_CATEGORIES).flat();

const UNIT_OPTIONS = ['ml', 'ltr', 'kg', 'grams', 'pcs', 'box', 'pack', 'dozen', 'pair', 'set', 'meter', 'cm', 'inch', 'ft'];

const InventoryPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'principal' || user?.isAdmin;

  // Tabs: 'product', 'measurement', or 'brand-category' synced with search params
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') || 'product';
  const activeTab = tabParam === 'measurement' ? 'measurement' : tabParam === 'brand-category' ? 'brand-category' : 'product';
  const setActiveTab = (tab) => {
    setSearchParams({ tab });
  };

  // State for products
  const [products, setProducts] = useState([]);

  const [productsLoading, setProductsLoading] = useState(true);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [isCustomBrand, setIsCustomBrand] = useState(false);
  const [isCustomUnit, setIsCustomUnit] = useState(false);

  // Custom brand categorization state & mapping logic
  const [customBrandCategories, setCustomBrandCategories] = useState(() => {
    try {
      const saved = localStorage.getItem('customBrandCategories');
      const parsed = saved ? JSON.parse(saved) : {};
      return {
        'cococola': 'Tea, Coffee & Beverages',
        'coca-cola': 'Tea, Coffee & Beverages',
        'pepsi': 'Tea, Coffee & Beverages',
        'spiril': 'Stationary',
        ...parsed
      };
    } catch (e) {
      return {
        'cococola': 'Tea, Coffee & Beverages',
        'coca-cola': 'Tea, Coffee & Beverages',
        'pepsi': 'Tea, Coffee & Beverages',
        'spiril': 'Stationary'
      };
    }
  });

  const [customBrandCategory, setCustomBrandCategory] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');

  const [customCategories, setCustomCategories] = useState(() => {
    try {
      const saved = localStorage.getItem('customCategories');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [deletedCategories, setDeletedCategories] = useState(() => {
    try {
      const saved = localStorage.getItem('deletedCategories');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [deletedBrands, setDeletedBrands] = useState(() => {
    try {
      const saved = localStorage.getItem('deletedBrands');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const allCategories = React.useMemo(() => {
    const defaults = Object.keys(DEFAULT_BRAND_CATEGORIES);
    const combined = [...defaults, ...customCategories];
    const unique = [...new Set(combined)];
    return unique.filter(cat => !deletedCategories.includes(cat));
  }, [customCategories, deletedCategories]);

  const guessCategory = (brandName) => {
    if (!brandName) return 'Other';
    const name = brandName.toLowerCase().trim();
    if (name.includes('tea') || name.includes('coffee') || name.includes('cola') || name.includes('coca') || name.includes('pepsi') || name.includes('soda') || name.includes('drink') || name.includes('beverage') || name.includes('juice') || name.includes('water')) {
      return 'Tea, Coffee & Beverages';
    }
    if (name.includes('milk') || name.includes('dairy') || name.includes('butter') || name.includes('cheese') || name.includes('curd') || name.includes('paneer') || name.includes('cereal') || name.includes('breakfast') || name.includes('powder')) {
      return 'Dairy, Powders & Breakfast';
    }
    if (name.includes('rice') || name.includes('salt') || name.includes('oil') || name.includes('wheat') || name.includes('flour') || name.includes('dal') || name.includes('pulse') || name.includes('spice') || name.includes('grocery') || name.includes('staple')) {
      return 'Grocery & Food Staples';
    }
    if (name.includes('paper') || name.includes('pen') || name.includes('pencil') || name.includes('book') || name.includes('notebook') || name.includes('spiril') || name.includes('station') || name.includes('eraser') || name.includes('ruler')) {
      return 'Stationary';
    }
    if (name.includes('soap') || name.includes('shampoo') || name.includes('paste') || name.includes('brush') || name.includes('cream') || name.includes('lotion') || name.includes('perfume') || name.includes('deodorant') || name.includes('hygiene') || name.includes('care')) {
      return 'Personal Care & Hygiene';
    }
    if (name.includes('detergent') || name.includes('wash') || name.includes('clean') || name.includes('liquid') || name.includes('dish') || name.includes('harpic') || name.includes('lizol') || name.includes('laundry')) {
      return 'Household & Laundry';
    }
    if (name.includes('phone') || name.includes('laptop') || name.includes('tv') || name.includes('mobile') || name.includes('computer') || name.includes('tech') || name.includes('electron')) {
      return 'Electronics & Tech';
    }
    return 'Other';
  };

  const getBrandCategory = (brandName) => {
    if (!brandName) return 'Other';
    const lowerName = brandName.trim().toLowerCase();
    if (customBrandCategories[lowerName]) {
      return customBrandCategories[lowerName];
    }
    for (const [category, brands] of Object.entries(DEFAULT_BRAND_CATEGORIES)) {
      if (brands.some(b => b.toLowerCase() === lowerName)) {
        return category;
      }
    }
    return guessCategory(brandName);
  };

  const groupedBrands = React.useMemo(() => {
    const groups = {};
    for (const category of allCategories) {
      groups[category] = [];
    }
    
    // Add default brands
    for (const [category, brands] of Object.entries(DEFAULT_BRAND_CATEGORIES)) {
      if (allCategories.includes(category)) {
        for (const brand of brands) {
          if (!deletedBrands.some(db => db.toLowerCase() === brand.toLowerCase())) {
            groups[category].push(brand);
          }
        }
      }
    }
    
    // Add custom mapped brands
    for (const [brandLower, category] of Object.entries(customBrandCategories)) {
      if (allCategories.includes(category)) {
        if (!deletedBrands.some(db => db.toLowerCase() === brandLower)) {
          const matchingProduct = products.find(p => p.Brand && p.Brand.toLowerCase() === brandLower);
          const brandName = matchingProduct ? matchingProduct.Brand : (brandLower.charAt(0).toUpperCase() + brandLower.slice(1));
          if (!groups[category].some(b => b.toLowerCase() === brandLower)) {
            groups[category].push(brandName);
          }
        }
      }
    }

    const uniqueBrandsInProducts = products
      ? [...new Set(products.map(p => p.Brand).filter(b => b && b !== ''))]
      : [];
      
    for (const brand of uniqueBrandsInProducts) {
      if (deletedBrands.some(db => db.toLowerCase() === brand.toLowerCase())) {
        continue;
      }
      const cat = getBrandCategory(brand);
      if (allCategories.includes(cat)) {
        const exists = groups[cat].some(b => b.toLowerCase() === brand.toLowerCase());
        if (!exists) {
          groups[cat].push(brand);
        }
      }
    }
    
    for (const category of Object.keys(groups)) {
      groups[category].sort((a, b) => a.localeCompare(b));
    }
    
    return groups;
  }, [allCategories, customBrandCategories, deletedBrands, products]);

  const isBrandKnown = (brandName) => {
    if (!brandName) return false;
    return Object.values(groupedBrands).flat().some(b => b.toLowerCase() === brandName.toLowerCase());
  };

  const handleDeleteBrand = (brandName) => {
    if (window.confirm(`Are you sure you want to delete brand "${brandName}"?`)) {
      setDeletedBrands(prev => {
        const updated = [...prev, brandName];
        localStorage.setItem('deletedBrands', JSON.stringify(updated));
        return updated;
      });
      toast.success(`Brand "${brandName}" deleted`);
    }
  };

  const handleDeleteCategory = (categoryName) => {
    if (window.confirm(`Are you sure you want to delete category "${categoryName}" and all its brands?`)) {
      setDeletedCategories(prev => {
        const updated = [...prev, categoryName];
        localStorage.setItem('deletedCategories', JSON.stringify(updated));
        return updated;
      });
      toast.success(`Category "${categoryName}" deleted`);
    }
  };

  const handleAddCategoryInManage = (categoryName) => {
    const trimmed = categoryName.trim();
    if (!trimmed) {
      toast.error('Category name cannot be empty');
      return;
    }
    if (allCategories.includes(trimmed)) {
      toast.error('Category already exists');
      return;
    }
    
    if (deletedCategories.includes(trimmed)) {
      const updatedDel = deletedCategories.filter(c => c !== trimmed);
      setDeletedCategories(updatedDel);
      localStorage.setItem('deletedCategories', JSON.stringify(updatedDel));
      toast.success(`Category "${trimmed}" restored`);
      return;
    }
    
    const updatedCats = [...customCategories, trimmed];
    setCustomCategories(updatedCats);
    localStorage.setItem('customCategories', JSON.stringify(updatedCats));
    toast.success(`Category "${trimmed}" created`);
  };

  const handleAddBrandInManage = (categoryName, brandName) => {
    const trimmedBrand = brandName.trim();
    if (!trimmedBrand) {
      toast.error('Brand name cannot be empty');
      return;
    }
    
    const currentBrandsInCat = groupedBrands[categoryName] || [];
    if (currentBrandsInCat.some(b => b.toLowerCase() === trimmedBrand.toLowerCase())) {
      toast.error('Brand already exists in this category');
      return;
    }
    
    if (deletedBrands.some(db => db.toLowerCase() === trimmedBrand.toLowerCase())) {
      const updatedDelBrands = deletedBrands.filter(db => db.toLowerCase() !== trimmedBrand.toLowerCase());
      setDeletedBrands(updatedDelBrands);
      localStorage.setItem('deletedBrands', JSON.stringify(updatedDelBrands));
    }
    
    const isDefaultOfCat = (DEFAULT_BRAND_CATEGORIES[categoryName] || []).some(b => b.toLowerCase() === trimmedBrand.toLowerCase());
    if (isDefaultOfCat) {
      toast.success(`Brand "${trimmedBrand}" restored to "${categoryName}"`);
      return;
    }
    
    setCustomBrandCategories(prev => {
      const updated = {
        ...prev,
        [trimmedBrand.toLowerCase()]: categoryName
      };
      localStorage.setItem('customBrandCategories', JSON.stringify(updated));
      return updated;
    });
    
    toast.success(`Brand "${trimmedBrand}" added to "${categoryName}"`);
  };
  const [productFormData, setProductFormData] = useState({
    ProductId: 'AUTO-GENERATED',
    ProductCode: 'AUTO-GENERATED',
    ProductName: '',
    HSNNumber: '',
    TaxPercentage: 0,
    Brand: '',
    Quantity: '',
    Unit: '',
    Pricing: 0
  });

  // State for measurements
  const [measurements, setMeasurements] = useState([]);
  const [measurementsLoading, setMeasurementsLoading] = useState(true);
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [editingMeasurementId, setEditingMeasurementId] = useState(null);
  const [measurementFormData, setMeasurementFormData] = useState({
    ID: '', Code: 'AUTO-GENERATED', Name: ''
  });

  const fetchProducts = async () => {
    try {
      setProductsLoading(true);
      const res = await getInventory();
      if (res.status) setProducts(res.data);
    } catch (err) {
      toast.error('Failed to load inventory');
    } finally {
      setProductsLoading(false);
    }
  };

  const fetchMeasurements = async () => {
    try {
      setMeasurementsLoading(true);
      const res = await getMeasurements();
      if (res.status) setMeasurements(res.data);
    } catch (err) {
      toast.error('Failed to load measurements');
    } finally {
      setMeasurementsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchMeasurements();
  }, []);

  // Product modal open handler
  const handleOpenProductModal = (product = null) => {
    setNewCategoryName('');
    if (product) {
      setEditingProductId(product._id);
      setProductFormData({
        ProductId: product.ProductId || 'AUTO-GENERATED',
        ProductCode: product.ProductCode || 'AUTO-GENERATED',
        ProductName: product.ProductName || '',
        HSNNumber: product.HSNNumber || '',
        TaxPercentage: product.TaxPercentage || 0,
        Brand: product.Brand || '',
        Quantity: product.Quantity || '',
        Unit: product.Unit || '',
        Pricing: product.Pricing || 0
      });
      const known = isBrandKnown(product.Brand);
      const isCust = product.Brand ? (!known && product.Brand !== '') : false;
      setIsCustomBrand(isCust);
      if (isCust) {
        setCustomBrandCategory(getBrandCategory(product.Brand));
      } else {
        setCustomBrandCategory('');
      }
      const isCustUnit = product.Unit ? !UNIT_OPTIONS.includes(product.Unit) : false;
      setIsCustomUnit(isCustUnit);
    } else {
      setEditingProductId(null);
      setProductFormData({
        ProductId: 'AUTO-GENERATED',
        ProductCode: 'AUTO-GENERATED',
        ProductName: '',
        HSNNumber: '',
        TaxPercentage: 0,
        Brand: '',
        Quantity: '',
        Unit: '',
        Pricing: 0
      });
      setIsCustomBrand(false);
      setCustomBrandCategory('');
      setIsCustomUnit(false);
    }
    setShowProductModal(true);
  };

  // Measurement modal open handler
  const handleOpenMeasurementModal = (measurement = null) => {
    if (measurement) {
      setEditingMeasurementId(measurement._id);
      setMeasurementFormData({
        ID: measurement.ID,
        Code: measurement.Code,
        Name: measurement.Name
      });
    } else {
      setEditingMeasurementId(null);
      setMeasurementFormData({
        ID: '',
        Code: 'AUTO-GENERATED',
        Name: ''
      });
    }
    setShowMeasurementModal(true);
  };

  // Save product handler
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      let resolvedCategory = customBrandCategory;
      if (isCustomBrand && customBrandCategory === 'NEW_CATEGORY') {
        const catTrimmed = newCategoryName.trim();
        if (!catTrimmed) {
          toast.error('Please enter a category name');
          return;
        }
        
        // Add to customCategories
        if (!customCategories.includes(catTrimmed)) {
          const updatedCats = [...customCategories, catTrimmed];
          setCustomCategories(updatedCats);
          localStorage.setItem('customCategories', JSON.stringify(updatedCats));
          // If this category was previously deleted, remove it from deletedCategories
          if (deletedCategories.includes(catTrimmed)) {
            const updatedDelCats = deletedCategories.filter(c => c !== catTrimmed);
            setDeletedCategories(updatedDelCats);
            localStorage.setItem('deletedCategories', JSON.stringify(updatedDelCats));
          }
        }
        resolvedCategory = catTrimmed;
      }

      // Save custom brand mapping if applicable
      if (isCustomBrand && productFormData.Brand && resolvedCategory) {
        const cleanedBrand = productFormData.Brand.trim();
        if (cleanedBrand) {
          // Remove from deletedBrands if it was previously deleted
          if (deletedBrands.some(db => db.toLowerCase() === cleanedBrand.toLowerCase())) {
            const updatedDelBrands = deletedBrands.filter(db => db.toLowerCase() !== cleanedBrand.toLowerCase());
            setDeletedBrands(updatedDelBrands);
            localStorage.setItem('deletedBrands', JSON.stringify(updatedDelBrands));
          }
          setCustomBrandCategories(prev => {
            const updated = {
              ...prev,
              [cleanedBrand.toLowerCase()]: resolvedCategory
            };
            localStorage.setItem('customBrandCategories', JSON.stringify(updated));
            return updated;
          });
        }
      }

      if (editingProductId) {
        const res = await updateInventory(editingProductId, productFormData);
        if (res.status) {
          toast.success(res.message || 'Product updated successfully');
          fetchProducts();
          setShowProductModal(false);
        } else {
          toast.error(res.message);
        }
      } else {
        const res = await createInventory(productFormData);
        if (res.status) {
          toast.success(res.message || 'Product created successfully');
          fetchProducts();
          setShowProductModal(false);
        } else {
          toast.error(res.message);
        }
      }
    } catch (err) {
      toast.error('Error saving product');
    }
  };

  // Save measurement handler
  const handleSaveMeasurement = async (e) => {
    e.preventDefault();
    try {
      if (editingMeasurementId) {
        const res = await updateMeasurement(editingMeasurementId, measurementFormData);
        if (res.status) {
          toast.success(res.message || 'Measurement updated successfully');
          fetchMeasurements();
          setShowMeasurementModal(false);
        } else {
          toast.error(res.message);
        }
      } else {
        const res = await createMeasurement(measurementFormData);
        if (res.status) {
          toast.success(res.message || 'Measurement created successfully');
          fetchMeasurements();
          setShowMeasurementModal(false);
        } else {
          toast.error(res.message);
        }
      }
    } catch (err) {
      toast.error('Error saving measurement');
    }
  };

  // Delete product handler
  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product? This action cannot be undone.')) return;
    try {
      const res = await deleteInventory(id);
      if (res.status) {
        toast.success(res.message || 'Product deleted successfully');
        fetchProducts();
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error('Error deleting product');
    }
  };

  // Delete measurement handler
  const handleDeleteMeasurement = async (id) => {
    if (!window.confirm('Are you sure you want to delete this measurement?')) return;
    try {
      const res = await deleteMeasurement(id);
      if (res.status) {
        toast.success(res.message || 'Measurement deleted successfully');
        fetchMeasurements();
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error('Error deleting measurement');
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col md:flex-row animate-fadeIn font-sans">
      <Sidebar />
      <div className="flex-1 bg-white flex flex-col min-w-0">
        <div className="min-h-[calc(100vh-4rem)] bg-white p-4 sm:p-6 overflow-y-auto">
          <div className="w-full">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            {activeTab === 'product' ? '📦 Products' : activeTab === 'measurement' ? '📐 Measurements' : '🏷️ Brands & Categories'}
          </h1>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Action buttons */}
            {isAdmin && (
              activeTab === 'product' ? (
                <>
                  <button
                    onClick={() => setActiveTab('brand-category')}
                    className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-lg border border-stone-300 shadow-sm transition-colors flex items-center gap-2"
                  >
                    ⚙️ Manage Brands & Categories
                  </button>
                  <button
                    onClick={() => handleOpenProductModal()}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-stone-900 font-bold rounded-lg shadow-md hover:from-amber-600 hover:to-yellow-700 transition-colors"
                  >
                    + Add Product
                  </button>
                </>
              ) : activeTab === 'measurement' ? (
                <button
                  onClick={() => handleOpenMeasurementModal()}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-stone-900 font-bold rounded-lg shadow-md hover:from-amber-600 hover:to-yellow-700 transition-colors"
                >
                  + Add Measurement
                </button>
              ) : null
            )}
          </div>
        </div>

        {/* Premium Horizontal Navigation Tab Bar */}
        <div className="flex border-b border-gray-200 gap-1.5 mb-6 overflow-x-auto nav-scroll" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <button
            onClick={() => setActiveTab('product')}
            className={`px-4 py-2.5 font-bold text-sm rounded-t-xl transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'product'
                ? 'text-amber-600 border-amber-500 bg-amber-500/5'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            📦 Products
          </button>
          <button
            onClick={() => setActiveTab('measurement')}
            className={`px-4 py-2.5 font-bold text-sm rounded-t-xl transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'measurement'
                ? 'text-amber-600 border-amber-500 bg-amber-500/5'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            📐 Measurements
          </button>
          <button
            onClick={() => setActiveTab('brand-category')}
            className={`px-4 py-2.5 font-bold text-sm rounded-t-xl transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'brand-category'
                ? 'text-amber-600 border-amber-500 bg-amber-500/5'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            🏷️ Brands & Categories
          </button>
        </div>

        {/* Dynamic content rendering based on activeTab */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          {activeTab === 'product' ? (
            productsLoading ? (
              <div className="p-8 text-center text-gray-500">Loading Products...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">Product Id</th>
                      <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">Product Code</th>
                      <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">Brand</th>
                      <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">Product Name</th>
                      <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">Quantity</th>
                      <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">Unit</th>
                      <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">Pricing</th>
                      <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">HSN NUMBER</th>
                      <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">Tax Percentage</th>
                      {isAdmin && <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={isAdmin ? 11 : 10} className="px-4 py-8 text-center text-gray-500">
                          No products found.
                        </td>
                      </tr>
                    ) : (
                      products.map((p, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono">{p.ProductId}</td>
                          <td className="px-4 py-3 font-mono">{p.ProductCode}</td>
                          <td className="px-4 py-3">
                            {p.Brand ? (
                              <span className="px-2.5 py-1 bg-stone-900 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-bold shadow-sm">
                                {p.Brand}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic text-xs">N/A</span>
                            )}
                          </td>
                          <td className="px-4 py-3">{p.ProductName}</td>
                          <td className="px-4 py-3 font-medium">{p.Quantity || <span className="text-gray-400 italic text-xs">—</span>}</td>
                          <td className="px-4 py-3 font-medium">{p.Unit || <span className="text-gray-400 italic text-xs">—</span>}</td>
                          <td className="px-4 py-3 font-bold text-stone-950">₹{p.Pricing !== undefined && p.Pricing !== null ? p.Pricing.toLocaleString('en-IN') : '0'}</td>
                          <td className="px-4 py-3 font-mono">{p.HSNNumber}</td>
                          <td className="px-4 py-3">{p.TaxPercentage}%</td>
                          {isAdmin && (
                            <td className="px-4 py-3">
                              <button onClick={() => handleOpenProductModal(p)} className="text-blue-600 hover:underline font-bold mr-2">Edit</button>
                              <button onClick={() => handleDeleteProduct(p._id)} className="text-red-600 hover:underline font-bold">Delete</button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )
          ) : activeTab === 'measurement' ? (
            measurementsLoading ? (
              <div className="p-8 text-center text-gray-500">Loading Measurements...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">ID</th>
                      <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">Code</th>
                      <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">Name</th>
                      {isAdmin && <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {measurements.length === 0 ? (
                      <tr>
                        <td colSpan={isAdmin ? 4 : 3} className="px-4 py-8 text-center text-gray-500">
                          No measurements found.
                        </td>
                      </tr>
                    ) : (
                      measurements.map((m, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono font-bold text-gray-700">{m.ID}</td>
                          <td className="px-4 py-3 font-mono text-stone-600">{m.Code}</td>
                          <td className="px-4 py-3">{m.Name}</td>
                          {isAdmin && (
                            <td className="px-4 py-3">
                              <button onClick={() => handleOpenMeasurementModal(m)} className="text-blue-600 hover:underline font-bold mr-3">Edit</button>
                              <button onClick={() => handleDeleteMeasurement(m._id)} className="text-red-600 hover:underline font-bold">Delete</button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            /* Inline Brands & Categories Panel */
            <div className="p-6 space-y-6 animate-fadeIn">
              {/* Add Category Section */}
              {isAdmin && (
                <div className="bg-stone-50 p-4 border border-stone-200 rounded-xl">
                  <h3 className="text-xs font-bold text-stone-700 uppercase mb-2">Create New Category</h3>
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.target;
                      const input = form.elements.categoryName;
                      handleAddCategoryInManage(input.value);
                      form.reset();
                    }}
                    className="flex gap-2"
                  >
                    <input
                      name="categoryName"
                      type="text"
                      required
                      placeholder="e.g. Stationary, Groceries..."
                      className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white text-gray-800 font-medium"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-stone-900 font-bold rounded-lg shadow-sm hover:from-amber-600 hover:to-yellow-700 transition-colors"
                    >
                      + Create
                    </button>
                  </form>
                </div>
              )}
              
              {/* List of Categories & Brands */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase">Existing Categories & Brands</h3>
                {allCategories.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No categories found. Create one above.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {allCategories.map(category => {
                      const brands = groupedBrands[category] || [];
                      return (
                        <div key={category} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col justify-between">
                          <div>
                            {/* Category Header */}
                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                              <span className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                📁 {category}
                                <span className="text-xs font-normal text-gray-400 bg-gray-200/60 px-2 py-0.5 rounded-full">
                                  {brands.length} {brands.length === 1 ? 'brand' : 'brands'}
                                </span>
                              </span>
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCategory(category)}
                                  className="text-xs font-bold text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition-colors flex items-center gap-1"
                                >
                                  🗑️ Delete
                                </button>
                              )}
                            </div>
                            
                            {/* Brands under Category */}
                            <div className="p-4">
                              <div className="flex flex-wrap gap-2">
                                {brands.length === 0 ? (
                                  <span className="text-xs text-gray-400 italic">No brands in this category.</span>
                                ) : (
                                  brands.map(brand => (
                                    <span 
                                      key={brand}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-stone-900 text-amber-400 border border-amber-500/20 rounded-lg text-xs font-bold shadow-sm"
                                    >
                                      {brand}
                                      {isAdmin && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteBrand(brand)}
                                          className="text-[10px] text-amber-400/70 hover:text-red-400 font-bold ml-1 transition-colors"
                                          title="Delete Brand"
                                        >
                                          ✕
                                        </button>
                                      )}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Quick Add Brand Form */}
                          {isAdmin && (
                            <div className="p-4 pt-0 border-t border-gray-50 bg-gray-50/30">
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const form = e.target;
                                  const input = form.elements.brandName;
                                  handleAddBrandInManage(category, input.value);
                                  form.reset();
                                }}
                                className="flex gap-2 pt-3"
                              >
                                <input
                                  name="brandName"
                                  type="text"
                                  required
                                  placeholder={`Add new brand to ${category}...`}
                                  className="flex-1 px-3 py-1 text-xs border rounded-lg focus:ring-1 focus:ring-amber-500 outline-none bg-stone-50 text-gray-800"
                                />
                                <button
                                  type="submit"
                                  className="px-3 py-1 bg-stone-800 hover:bg-stone-950 text-amber-400 border border-amber-500/30 text-xs font-bold rounded-lg shadow-sm transition-colors whitespace-nowrap"
                                >
                                  + Add
                                </button>
                              </form>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── PRODUCT MODAL ── */}
      {showProductModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-900">{editingProductId ? 'Edit Product' : 'Add Product'}</h2>
              <button onClick={() => setShowProductModal(false)} className="text-gray-400 hover:text-gray-600 font-bold text-lg">✕</button>
            </div>
            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Product Id (Auto-Generated)</label>
                <input 
                  type="text" 
                  disabled 
                  required 
                  value={productFormData.ProductId} 
                  className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500 font-mono cursor-not-allowed outline-none" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Product Code (Auto-Generated)</label>
                <input 
                  type="text" 
                  disabled 
                  required 
                  value={productFormData.ProductCode} 
                  className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500 font-mono cursor-not-allowed outline-none" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Brand</label>
                <select 
                  value={isCustomBrand ? 'Custom' : (productFormData.Brand || '')}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === 'Custom') {
                      setIsCustomBrand(true);
                      setProductFormData({...productFormData, Brand: ''});
                      setCustomBrandCategory('Other');
                    } else {
                      setIsCustomBrand(false);
                      setProductFormData({...productFormData, Brand: val});
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none mb-2 bg-white text-gray-800 font-medium"
                >
                  <option value="">-- Select Brand --</option>
                  {Object.entries(groupedBrands).map(([category, brands]) => (
                    <optgroup key={category} label={category}>
                      {brands.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </optgroup>
                  ))}
                  <optgroup label="Add Custom">
                    <option value="Custom">Custom...</option>
                  </optgroup>
                </select>
                {isCustomBrand && (
                  <div className="space-y-2 mt-2 p-3 bg-stone-50 border border-amber-500/20 rounded-lg animate-fadeIn">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Custom Brand Name</label>
                      <input 
                        type="text" 
                        placeholder="Enter custom brand name"
                        required 
                        value={productFormData.Brand || ''} 
                        onChange={e => {
                          const val = e.target.value;
                          setProductFormData({...productFormData, Brand: val});
                          const guessed = guessCategory(val);
                          setCustomBrandCategory(guessed);
                        }} 
                        className="w-full px-3 py-2 border border-amber-500/50 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white text-gray-800" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Belongs To Category</label>
                      <select
                        value={customBrandCategory}
                        onChange={e => setCustomBrandCategory(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white text-gray-800"
                      >
                        <option value="">-- Select Category --</option>
                        {allCategories.map(category => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                        <option value="NEW_CATEGORY">[+ Create New Category...]</option>
                      </select>
                    </div>
                    {customBrandCategory === 'NEW_CATEGORY' && (
                      <div className="animate-fadeIn">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">New Category Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Stationary, Groceries..."
                          value={newCategoryName}
                          onChange={e => setNewCategoryName(e.target.value)}
                          className="w-full px-3 py-2 border border-amber-500/50 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white text-gray-800"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Product Name</label>
                <input 
                  type="text" 
                  required 
                  value={productFormData.ProductName} 
                  onChange={e => setProductFormData({...productFormData, ProductName: e.target.value})} 
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" 
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Quantity</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 100ml, 1ltr, 500g"
                    value={productFormData.Quantity} 
                    onChange={e => setProductFormData({...productFormData, Quantity: e.target.value})} 
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Unit</label>
                  <select 
                    value={isCustomUnit ? 'Custom' : (productFormData.Unit || '')} 
                    onChange={e => {
                      const val = e.target.value;
                      if (val === 'Custom') {
                        setIsCustomUnit(true);
                        setProductFormData({...productFormData, Unit: ''});
                      } else {
                        setIsCustomUnit(false);
                        setProductFormData({...productFormData, Unit: val});
                      }
                    }} 
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white text-gray-800 font-medium mb-2"
                  >
                    <option value="">-- Select Unit --</option>
                    {UNIT_OPTIONS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                    <option value="Custom">Custom...</option>
                  </select>
                  {isCustomUnit && (
                    <input 
                      type="text"
                      placeholder="Enter custom unit (e.g. box, pack, tray)"
                      required
                      value={productFormData.Unit || ''}
                      onChange={e => setProductFormData({...productFormData, Unit: e.target.value})}
                      className="w-full px-3 py-2 border border-amber-500/50 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none animate-fadeIn bg-white text-gray-800"
                    />
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Pricing (INR / ₹)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  placeholder="Enter price"
                  required 
                  value={productFormData.Pricing || ''} 
                  onChange={e => setProductFormData({...productFormData, Pricing: parseFloat(e.target.value) || 0})} 
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">HSN Number</label>
                <input 
                  type="text" 
                  required 
                  value={productFormData.HSNNumber} 
                  onChange={e => setProductFormData({...productFormData, HSNNumber: e.target.value})} 
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Tax Percentage (%)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  required 
                  value={productFormData.TaxPercentage} 
                  onChange={e => setProductFormData({...productFormData, TaxPercentage: parseFloat(e.target.value) || 0})} 
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" 
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowProductModal(false)} className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-stone-900 font-bold rounded-lg shadow-md hover:from-amber-600 hover:to-yellow-700">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MEASUREMENT MODAL ── */}
      {showMeasurementModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-900">{editingMeasurementId ? 'Edit Measurement' : 'Add Measurement'}</h2>
              <button onClick={() => setShowMeasurementModal(false)} className="text-gray-400 hover:text-gray-600 font-bold text-lg">✕</button>
            </div>
            <form onSubmit={handleSaveMeasurement} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Measurement ID (e.g. KG, PCS, LTR)</label>
                <input 
                  type="text" 
                  required 
                  placeholder="KG"
                  value={measurementFormData.ID} 
                  onChange={e => setMeasurementFormData({...measurementFormData, ID: e.target.value.toUpperCase()})} 
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none font-bold tracking-wider" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Measurement Code (Auto-Generated)</label>
                <input 
                  type="text" 
                  disabled 
                  required 
                  value={measurementFormData.Code} 
                  className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500 font-mono cursor-not-allowed outline-none" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Measurement Name</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Kilogram"
                  value={measurementFormData.Name} 
                  onChange={e => setMeasurementFormData({...measurementFormData, Name: e.target.value})} 
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" 
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowMeasurementModal(false)} className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-stone-900 font-bold rounded-lg shadow-md hover:from-amber-600 hover:to-yellow-700">Save Measurement</button>
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

export default InventoryPage;
