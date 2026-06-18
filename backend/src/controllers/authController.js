import User from '../models/User.js';
import Teacher from '../models/Teacher.js';
import NonTeachingStaff from '../models/NonTeachingStaff.js';
import jwt from 'jsonwebtoken';
import { runFaceCLI } from '../utils/faceBridge.js';
import SchoolSettings from '../models/SchoolSettings.js';

// Helper for distance check (Haversine formula)
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // metres
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
};

// Helper to generate JWT tokens
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET_KEY || 'dev-secret-key-change-in-production-2024', {
    expiresIn: '30m'
  });
};

const generateRefreshToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET_KEY || 'dev-secret-key-change-in-production-2024', {
    expiresIn: '7d'
  });
};

/**
 * Check if email or phone is already registered
 */
export const checkUser = async (req, res) => {
  const { email, phone } = req.body;
  try {
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(200).json({ status: false, message: 'Email is already registered' });
    }
    if (phone) {
      const phoneExists = await User.findOne({ phone });
      if (phoneExists) {
        return res.status(200).json({ status: false, message: 'Phone number is already registered' });
      }
    }
    return res.status(200).json({ status: true, message: 'Available' });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Register a new user
 */
export const register = async (req, res) => {
  const { name, email, phone, password, role, face_images, location } = req.body;
  try {
    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ status: false, message: 'User already exists' });
    }

    let encryptedEmbeddings = [];

    // If face images are provided, extract embeddings and encrypt them via Python CLI
    if (face_images && face_images.length >= 4) {
      const cliResult = await runFaceCLI('extract_multiple', { images: face_images });
      if (!cliResult.status) {
        return res.status(400).json({ status: false, message: cliResult.message });
      }
      
      // Perform liveness check
      const livenessResult = await runFaceCLI('liveness_check', { images: face_images });
      if (!livenessResult.status || !livenessResult.isLive) {
        return res.status(400).json({ status: false, message: livenessResult.message || 'Liveness check failed' });
      }

      // Encrypt the extracted embeddings
      const encryptResult = await runFaceCLI('encrypt', { embeddings: cliResult.embeddings });
      if (!encryptResult.status) {
        return res.status(400).json({ status: false, message: encryptResult.message });
      }
      encryptedEmbeddings = encryptResult.encrypted_embeddings;
    }

    // Create user in DB
    const user = await User.create({
      name,
      email,
      phone,
      password_hash: password, // pre-save hook will hash this
      role: role || 'teacher',
      face_embeddings: encryptedEmbeddings,
      registeredLocation: location
    });

    // If role is teacher, automatically create a Teacher profile
    if (user.role === 'teacher') {
      const employeeId = 'TCH-' + Math.floor(100000 + Math.random() * 900000);
      await Teacher.create({
        user: user._id,
        employeeId,
        name: user.name,
        email: user.email,
        phone: user.phone || 'N/A',
        qualification: 'Not Configured Yet',
        experience: 0,
        status: 'Active'
      });
    }

    return res.status(201).json({
      status: true,
      message: 'User registered successfully',
      user_id: user._id
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Login with email & password (Step 1)
 */
export const login = async (req, res) => {
  const { email, password, location } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ status: false, message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ status: false, message: 'Account is disabled. Contact your administrator.' });
    }

    const settings = await SchoolSettings.findOne();
    const isLocationAuthEnabled = settings ? settings.location_auth_enabled !== false : true;
    const skipLocation = user.skip_location || !isLocationAuthEnabled;

    // GPS location boundary check
    if (!skipLocation) {
      if (user.registeredLocation && location) {
        const distance = getDistance(
          user.registeredLocation.latitude,
          user.registeredLocation.longitude,
          location.latitude,
          location.longitude
        );
        if (distance > 100) {
          return res.status(403).json({
            status: false,
            detail: `Location Mismatch: you are ${Math.round(distance)}m away. Max allowed: 100m. Registered: (${user.registeredLocation.latitude}, ${user.registeredLocation.longitude}), Current: (${location.latitude}, ${location.longitude})`
          });
        }
      } else if (!user.registeredLocation && location) {
        user.registeredLocation = location;
        await user.save();
      } else if (!location) {
        return res.status(403).json({
          status: false,
          detail: 'Location is required for login. Please enable GPS/location services.'
        });
      }
    }

    // Determine if face verification is required
    const isFaceAuthEnabled = settings ? settings.face_auth_enabled !== false : true;
    const requiresFace = isFaceAuthEnabled && user.face_embeddings && user.face_embeddings.length > 0;

    if (!requiresFace) {
      // Direct login if no face data registered
      const access_token = generateToken(user._id, user.role);
      const refresh_token = generateRefreshToken(user._id, user.role);
      return res.status(200).json({
        status: true,
        access_token,
        refresh_token,
        user_id: user._id,
        requires_face_verification: false
      });
    }

    // Returns user_id so frontend can proceed to verify-face step
    return res.status(200).json({
      status: true,
      user_id: user._id,
      requires_face_verification: true,
      message: 'Password verified. Face verification required.'
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Verify face (Step 2)
 */
export const verifyFace = async (req, res) => {
  const { user_id, face_image, challenge_frame, location } = req.body;
  try {
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found' });
    }

    const settings = await SchoolSettings.findOne();
    const isLocationAuthEnabled = settings ? settings.location_auth_enabled !== false : true;
    const skipLocation = user.skip_location || !isLocationAuthEnabled;

    // GPS location check for face verify
    if (!skipLocation) {
      if (user.registeredLocation && location) {
        const distance = getDistance(
          user.registeredLocation.latitude,
          user.registeredLocation.longitude,
          location.latitude,
          location.longitude
        );
        if (distance > 100) {
          return res.status(403).json({
            status: false,
            detail: `Location Mismatch: you are ${Math.round(distance)}m away. Max allowed: 100m. Registered: (${user.registeredLocation.latitude}, ${user.registeredLocation.longitude}), Current: (${location.latitude}, ${location.longitude})`
          });
        }
      } else if (!user.registeredLocation && location) {
        user.registeredLocation = location;
        await user.save();
      } else if (!location) {
        return res.status(403).json({
          status: false,
          detail: 'Location is required for login. Please enable GPS/location services.'
        });
      }
    }

    // Extract live embedding
    const cliResult = await runFaceCLI('extract_embedding', { image: face_image, strict: true });
    if (!cliResult.status) {
      return res.status(400).json({ status: false, message: cliResult.message });
    }

    // Compare with stored embeddings (CLI does decryption under the hood)
    const compareResult = await runFaceCLI('compare', {
      live_embedding: cliResult.embedding,
      stored_embeddings: user.face_embeddings
    });

    if (!compareResult.status || !compareResult.isMatch) {
      return res.status(400).json({
        status: false,
        message: 'Face mismatch. Please scan again.'
      });
    }

    // Optionally check liveness with challenge frame
    if (challenge_frame) {
      const temporalResult = await runFaceCLI('temporal_liveness', {
        frame1: face_image,
        frame2: challenge_frame
      });
      if (!temporalResult.status || !temporalResult.isLive) {
        return res.status(400).json({ status: false, message: temporalResult.reason || 'Liveness check failed' });
      }
    }

    // Issue tokens
    const access_token = generateToken(user._id, user.role);
    const refresh_token = generateRefreshToken(user._id, user.role);

    return res.status(200).json({
      status: true,
      access_token,
      refresh_token,
      user_id: user._id,
      message: 'Verification successful'
    });
  } catch (error) {
    console.error('Face verify error:', error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Direct login via face (no password)
 */
export const faceLogin = async (req, res) => {
  const { user_id, face_image, location, challenge_frame } = req.body;
  try {
    const settings = await SchoolSettings.findOne();
    const isFaceAuthEnabled = settings ? settings.face_auth_enabled !== false : true;
    if (!isFaceAuthEnabled) {
      return res.status(403).json({ status: false, message: 'Face login is disabled at the school level.' });
    }

    // user_id can be email or ID
    let user = await User.findById(user_id).catch(() => null);
    if (!user) {
      user = await User.findOne({ email: user_id });
    }

    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(403).json({ status: false, message: 'Account is disabled.' });
    }

    const isLocationAuthEnabled = settings ? settings.location_auth_enabled !== false : true;
    const skipLocation = user.skip_location || !isLocationAuthEnabled;

    // GPS location check for direct face login
    if (!skipLocation) {
      if (user.registeredLocation && location) {
        const distance = getDistance(
          user.registeredLocation.latitude,
          user.registeredLocation.longitude,
          location.latitude,
          location.longitude
        );
        if (distance > 500) {
          return res.status(403).json({
            status: false,
            detail: `Location Mismatch: you are ${Math.round(distance)}m away. Max allowed: 500m. Registered: (${user.registeredLocation.latitude}, ${user.registeredLocation.longitude}), Current: (${location.latitude}, ${location.longitude})`
          });
        }
      } else if (!user.registeredLocation && location) {
        user.registeredLocation = location;
        await user.save();
      } else if (!location) {
        return res.status(403).json({
          status: false,
          detail: 'Location is required for login. Please enable GPS/location services.'
        });
      }
    }

    if (!user.face_embeddings || user.face_embeddings.length === 0) {
      return res.status(400).json({ status: false, message: 'No registered face data found. Please sign in with password first.' });
    }

    // Extract live embedding
    const cliResult = await runFaceCLI('extract_embedding', { image: face_image, strict: true });
    if (!cliResult.status) {
      return res.status(400).json({ status: false, message: cliResult.message });
    }

    // Compare
    const compareResult = await runFaceCLI('compare', {
      live_embedding: cliResult.embedding,
      stored_embeddings: user.face_embeddings
    });

    if (!compareResult.status || !compareResult.isMatch) {
      return res.status(400).json({ status: false, message: 'Face verification failed' });
    }

    if (challenge_frame) {
      const temporalResult = await runFaceCLI('temporal_liveness', {
        frame1: face_image,
        frame2: challenge_frame
      });
      if (!temporalResult.status || !temporalResult.isLive) {
        return res.status(400).json({ status: false, message: temporalResult.reason || 'Liveness check failed' });
      }
    }

    const access_token = generateToken(user._id, user.role);
    const refresh_token = generateRefreshToken(user._id, user.role);

    return res.status(200).json({
      status: true,
      access_token,
      refresh_token,
      user_id: user._id,
      message: 'Welcome back!'
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Get profile details
 */
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password_hash -face_embeddings');
    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found' });
    }

    let detail = {};
    if (user.role === 'teacher') {
      const teacher = await Teacher.findOne({ user: user._id });
      if (teacher) {
        detail = {
          employeeId: teacher.employeeId,
          qualification: teacher.qualification,
          experience: teacher.experience,
          status: teacher.status
        };
      }
    }

    // Determine admin privilege dynamically
    let isAdmin = user.role === 'admin' || user.role === 'principal';
    if (!isAdmin) {
      try {
        const { default: Role } = await import('../models/Role.js');
        const dynRole = await Role.findOne({ roleName: { $regex: new RegExp(`^${user.role}$`, 'i') } });
        if (dynRole && dynRole.grantAdminPrivilege) {
          isAdmin = true;
        }
      } catch (e) { /* ignore */ }
    }

    return res.status(200).json({
      status: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        isAdmin,
        ...detail
      }
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Logout user
 */
export const logout = async (req, res) => {
  return res.status(200).json({ status: true, message: 'Logged out successfully' });
};

/**
 * Geocode - reverse geocode lat/lng to address
 */
export const geocode = async (req, res) => {
  const { latitude, longitude } = req.body;
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'FaceAuthSchoolSystem/1.0 (schoolattendance@example.com)'
        }
      }
    );
    const data = await response.json();
    
    if (data && data.address) {
      const address = data.address;
      const road = address.road || address.pedestrian || address.highway || '';
      const area = address.suburb || address.neighbourhood || address.residential || '';
      const city = address.city || address.town || address.village || address.county || '';
      const state = address.state || '';
      const country = address.country || '';
      const pincode = address.postcode || '';

      return res.status(200).json({
        status: true,
        data: {
          road,
          area,
          city,
          state,
          country,
          pincode,
          display_name: data.display_name || ''
        }
      });
    }

    return res.status(200).json({
      status: true,
      data: {
        display_name: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
      }
    });
  } catch (error) {
    return res.status(200).json({
      status: true,
      data: {
        display_name: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
      }
    });
  }
};
