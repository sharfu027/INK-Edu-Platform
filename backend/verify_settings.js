import mongoose from 'mongoose';

const API_BASE = 'http://localhost:8000/api';
const MONGODB_URL = 'mongodb://localhost:27017/face_auth_db';

const runVerification = async () => {
  try {
    console.log('--- Step 1: Connecting to MongoDB directly to check srakesh@gmail.com ---');
    await mongoose.connect(MONGODB_URL);
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false, collection: 'users' }));
    const adminUser = await User.findOne({ email: 'srakesh@gmail.com' });
    if (adminUser) {
      console.log('Admin user found in DB:', {
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        skip_location: adminUser.skip_location,
        skip_face: adminUser.skip_face,
        registeredLocation: adminUser.registeredLocation
      });
    } else {
      console.log('Admin user not found in DB!');
    }

    console.log('\n--- Step 2: Logging in as Admin (sending dummy location) ---');
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'srakesh@gmail.com',
        password: 'Rakesh@2005',
        location: { latitude: 12.9716, longitude: 77.5946 }
      })
    });
    const loginData = await loginRes.json();
    
    if (!loginRes.ok) {
      throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
    }

    const token = loginData.access_token;
    console.log('Admin logged in successfully. Token acquired.');

    // Helper fetch wrapper with Auth header
    const authFetch = async (url, options = {}) => {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      };
      const res = await fetch(`${API_BASE}${url}`, { ...options, headers });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(`Request to ${url} failed with status ${res.status}: ${JSON.stringify(data)}`);
      }
      return data;
    };

    console.log('\n--- Step 3: Fetch current settings ---');
    const settingsBefore = await authFetch('/auth/settings');
    console.log('Current settings:', {
      face_auth_enabled: settingsBefore.data.face_auth_enabled,
      location_auth_enabled: settingsBefore.data.location_auth_enabled
    });

    console.log('\n--- Step 4: Disable Face & Location Auth globally ---');
    const updateRes = await authFetch('/auth/settings', {
      method: 'POST',
      body: JSON.stringify({
        face_auth_enabled: false,
        location_auth_enabled: false
      })
    });
    console.log('Update settings API response:', {
      status: updateRes.status,
      message: updateRes.message,
      face_auth_enabled: updateRes.data.face_auth_enabled,
      location_auth_enabled: updateRes.data.location_auth_enabled
    });

    console.log('\n--- Step 5: Verify settings values in database directly ---');
    const SchoolSettings = mongoose.model('SchoolSettings', new mongoose.Schema({}, { strict: false, collection: 'schoolsettings' }));
    const dbSettings = await SchoolSettings.findOne();
    console.log('DB SchoolSettings face_auth_enabled:', dbSettings.toObject().face_auth_enabled);
    console.log('DB SchoolSettings location_auth_enabled:', dbSettings.toObject().location_auth_enabled);

    console.log('\n--- Step 6: Verify User.updateMany executed successfully in DB ---');
    const users = await User.find({ role: { $ne: 'admin' } });
    console.log(`Checking bypass settings for all non-admin users (${users.length} total):`);
    let allReset = true;
    users.forEach(u => {
      console.log(` - User: ${u.name} | skip_face: ${u.skip_face} | skip_location: ${u.skip_location}`);
      if (u.skip_face !== false || u.skip_location !== false) {
        allReset = false;
      }
    });
    console.log(`All users' skip settings forced to false? -> ${allReset ? '✅ YES' : '❌ NO'}`);

    console.log('\n--- Step 7: Verify Teacher Management API returns updated values ---');
    const employeesRes = await authFetch('/auth/admin/employees');
    const teachersList = employeesRes.data.teachers || [];
    const nonTeachingList = employeesRes.data.nonTeaching || [];
    const allFaculty = [...teachersList, ...nonTeachingList];
    console.log(`Checking bypass settings returned by Faculty API for all faculty members (${allFaculty.length} total):`);
    let allApiReset = true;
    allFaculty.forEach(f => {
      const skipFace = f.user?.skip_face;
      const skipLocation = f.user?.skip_location;
      console.log(` - Faculty: ${f.name} | skip_face: ${skipFace} | skip_location: ${skipLocation}`);
      if (skipFace !== false || skipLocation !== false) {
        allApiReset = false;
      }
    });
    console.log(`Faculty API reports all skip settings as false? -> ${allApiReset ? '✅ YES' : '❌ NO'}`);

    console.log('\n--- Step 8: Restore settings back to enabled (true) globally ---');
    const restoreRes = await authFetch('/auth/settings', {
      method: 'POST',
      body: JSON.stringify({
        face_auth_enabled: true,
        location_auth_enabled: true
      })
    });
    console.log('Restore settings API response:', {
      status: restoreRes.status,
      face_auth_enabled: restoreRes.data.face_auth_enabled,
      location_auth_enabled: restoreRes.data.location_auth_enabled
    });

    console.log('\n--- Step 9: Verify user bypass settings remain unchanged (false) after enabling globally ---');
    const usersAfterRestore = await User.find({ role: { $ne: 'admin' } });
    let remainsUnchanged = true;
    usersAfterRestore.forEach(u => {
      if (u.skip_face !== false || u.skip_location !== false) {
        remainsUnchanged = false;
      }
    });
    console.log(`Users' skip settings remained false (exceptions not auto-created)? -> ${remainsUnchanged ? '✅ YES' : '❌ NO'}`);

    await mongoose.disconnect();
    console.log('\nVerification complete successfully!');
  } catch (err) {
    console.error('Verification failed with error:', err.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
};

runVerification();
