import Role from '../models/Role.js';

/**
 * Helper to normalize a Role document object
 */
const normalizeRole = (r) => {
  if (!r) return null;
  const obj = r.toObject ? r.toObject() : r;
  return {
    _id: obj._id,
    roleCode: obj.roleCode || obj.RoleCode || '',
    RoleCode: obj.roleCode || obj.RoleCode || '',
    roleName: obj.roleName || obj.Rolename || '',
    Rolename: obj.roleName || obj.Rolename || '',
    grantAdminPrivilege: obj.grantAdminPrivilege !== undefined ? obj.grantAdminPrivilege : (obj.GantAdminPrevillage !== undefined ? obj.GantAdminPrevillage : false),
    GantAdminPrevillage: obj.grantAdminPrivilege !== undefined ? obj.grantAdminPrivilege : (obj.GantAdminPrevillage !== undefined ? obj.GantAdminPrevillage : false),
    createdBy: obj.createdBy || obj.CreatedBy || 'System',
    CreatedBy: obj.createdBy || obj.CreatedBy || 'System'
  };
};

/**
 * Get all roles
 */
export const getRoles = async (req, res) => {
  try {
    const roles = await Role.find().sort({ createdAt: 1 });
    const normalized = roles.map(normalizeRole);
    return res.status(200).json({ status: true, data: normalized });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Create a new role
 */
export const createRole = async (req, res) => {
  const { roleName, Rolename, grantAdminPrivilege, GantAdminPrevillage } = req.body;
  const finalRoleName = roleName || Rolename;
  const finalGrantAdminPrivilege = grantAdminPrivilege !== undefined ? grantAdminPrivilege : (GantAdminPrevillage !== undefined ? GantAdminPrevillage : false);

  try {
    if (!finalRoleName) {
      return res.status(400).json({ status: false, message: 'Role name is required' });
    }

    const exists = await Role.findOne({
      $or: [
        { roleName: { $regex: new RegExp(`^${finalRoleName}$`, 'i') } },
        { Rolename: { $regex: new RegExp(`^${finalRoleName}$`, 'i') } }
      ]
    });
    if (exists) {
      return res.status(400).json({ status: false, message: `Role "${finalRoleName}" already exists` });
    }

    // Auto-generate role code
    const lastRole = await Role.findOne().sort({ createdAt: -1 });
    let nextNum = 1;
    const lastRoleCode = lastRole ? (lastRole.roleCode || lastRole.RoleCode) : null;
    if (lastRoleCode) {
      const match = lastRoleCode.match(/ROLE-(\d+)/);
      if (match) nextNum = parseInt(match[1]) + 1;
    }
    const roleCode = `ROLE-${String(nextNum).padStart(5, '0')}`;

    const role = await Role.create({
      roleCode,
      RoleCode: roleCode,
      roleName: finalRoleName,
      Rolename: finalRoleName,
      grantAdminPrivilege: finalGrantAdminPrivilege,
      GantAdminPrevillage: finalGrantAdminPrivilege,
      createdBy: req.user?.name || 'Admin',
      CreatedBy: req.user?.name || 'Admin'
    });

    return res.status(201).json({ status: true, message: 'Role created successfully', data: normalizeRole(role) });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Update a role
 */
export const updateRole = async (req, res) => {
  const { id } = req.params;
  const { roleName, Rolename, grantAdminPrivilege, GantAdminPrevillage } = req.body;
  const finalRoleName = roleName || Rolename;
  const finalGrantAdminPrivilege = grantAdminPrivilege !== undefined ? grantAdminPrivilege : (GantAdminPrevillage !== undefined ? GantAdminPrevillage : undefined);

  try {
    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ status: false, message: 'Role not found' });
    }

    if (finalRoleName) {
      role.roleName = finalRoleName;
      role.Rolename = finalRoleName;
    }
    if (finalGrantAdminPrivilege !== undefined) {
      role.grantAdminPrivilege = finalGrantAdminPrivilege;
      role.GantAdminPrevillage = finalGrantAdminPrivilege;
    }

    await role.save();
    return res.status(200).json({ status: true, message: 'Role updated successfully', data: normalizeRole(role) });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Delete a role
 */
export const deleteRole = async (req, res) => {
  const { id } = req.params;
  try {
    const role = await Role.findByIdAndDelete(id);
    if (!role) {
      return res.status(404).json({ status: false, message: 'Role not found' });
    }
    return res.status(200).json({ status: true, message: 'Role deleted successfully' });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};
