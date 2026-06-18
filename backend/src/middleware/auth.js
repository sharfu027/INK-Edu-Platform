import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Role from '../models/Role.js';

/**
 * Protect routes - authenticate JWT
 */
export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // Decode token
      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY || 'dev-secret-key-change-in-production-2024');

      // Get user from DB
      req.user = await User.findById(decoded.id).select('-face_embeddings -password_hash');
      if (!req.user) {
        return res.status(401).json({ status: false, message: 'Not authorized, user not found' });
      }

      next();
    } catch (error) {
      console.error('JWT verification error:', error);
      return res.status(401).json({ status: false, message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ status: false, message: 'Not authorized, no token provided' });
  }
};

/**
 * Authorize specific roles.
 * Always allows 'admin' and 'principal' roles.
 * Also checks the Role collection for grantAdminPrivilege flag.
 */
export const authorize = (...roles) => {
  return async (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ status: false, message: 'Not authorized' });
    }

    const userRole = req.user.role.toLowerCase();
    const normalizedRoles = roles.map(r => r.toLowerCase());

    // Direct match against provided roles
    if (normalizedRoles.includes(userRole)) {
      return next();
    }

    // Principal always has super-admin access
    if (userRole === 'principal') {
      return next();
    }

    // Check if user's dynamic role has admin privilege
    try {
      const dynamicRole = await Role.findOne({ roleName: { $regex: new RegExp(`^${userRole}$`, 'i') } });
      if (dynamicRole && dynamicRole.grantAdminPrivilege) {
        return next();
      }
    } catch (err) {
      // Ignore lookup errors and fall through to denial
    }

    return res.status(403).json({
      status: false,
      message: `User role '${req.user.role}' is not authorized to access this resource`
    });
  };
};

