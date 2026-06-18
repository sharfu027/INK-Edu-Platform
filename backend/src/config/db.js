import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const seedDefaultRoles = async () => {
  try {
    const Role = (await import('../models/Role.js')).default;
    const count = await Role.countDocuments();
    if (count === 0) {
      const defaults = [
        { roleCode: 'ROLE-00001', roleName: 'Teacher', grantAdminPrivilege: false, createdBy: 'System' },
        { roleCode: 'ROLE-00002', roleName: 'Staff', grantAdminPrivilege: false, createdBy: 'System' },
        { roleCode: 'ROLE-00003', roleName: 'HOD', grantAdminPrivilege: true, createdBy: 'System' },
        { roleCode: 'ROLE-00004', roleName: 'Principal', grantAdminPrivilege: true, createdBy: 'System' }
      ];
      await Role.insertMany(defaults);
      console.log('Default roles seeded successfully');
    }
  } catch (error) {
    console.error('Role seeding error:', error.message);
  }
};

const seedAdminUser = async () => {
  try {
    const User = (await import('../models/User.js')).default;
    const email = 'srakesh@gmail.com';
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      await User.create({
        name: 'Rakesh Admin',
        email: email,
        password_hash: 'Rakesh@2005',
        role: 'admin',
        isActive: true,
        skip_face: true,
        skip_location: true
      });
      console.log(`Admin user ${email} seeded successfully`);
    } else {
      existingUser.role = 'admin';
      existingUser.isActive = true;
      existingUser.password_hash = 'Rakesh@2005';
      existingUser.skip_face = true;
      existingUser.skip_location = true;
      await existingUser.save();
      console.log(`Admin user ${email} verified/updated successfully`);
    }
  } catch (error) {
    console.error('Admin user seeding error:', error.message);
  }
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URL || 'mongodb://localhost:27017/face_auth_db', {
      dbName: process.env.MONGODB_DB_NAME || 'face_auth_db'
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    await seedDefaultRoles();
    await seedAdminUser();
  } catch (error) {
    console.error(`Database Connection Error: ${error.message}`);
    console.warn('[Warning] Database connection failed. The server will continue to run, but database features will be unavailable.');
  }
};

export default connectDB;

