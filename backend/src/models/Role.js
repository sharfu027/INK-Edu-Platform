import mongoose from 'mongoose';

const RoleSchema = new mongoose.Schema(
  {
    roleCode: {
      type: String,
      trim: true
    },
    RoleCode: {
      type: String,
      trim: true
    },
    roleName: {
      type: String,
      trim: true
    },
    Rolename: {
      type: String,
      trim: true
    },
    grantAdminPrivilege: {
      type: Boolean,
      default: false
    },
    GantAdminPrevillage: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: String,
      default: 'System'
    },
    CreatedBy: {
      type: String,
      default: 'System'
    }
  },
  {
    timestamps: true
  }
);

const Role = mongoose.model('Role', RoleSchema);
export default Role;
