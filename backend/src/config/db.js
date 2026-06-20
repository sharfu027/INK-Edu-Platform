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

const runDatabaseMigration = async () => {
  try {
    const Class = (await import('../models/Class.js')).default;
    const Subject = (await import('../models/Subject.js')).default;
    const AcademicYear = (await import('../models/AcademicYear.js')).default;
    const SchoolSettings = (await import('../models/SchoolSettings.js')).default;

    // 1. Migrate Classes
    const classes = await Class.find();
    for (const cls of classes) {
      let updated = false;
      if (cls.isActive === undefined) {
        cls.isActive = true;
        updated = true;
      }
      if (!cls.className && cls.standard) {
        cls.className = cls.standard;
        updated = true;
      }
      if (updated) {
        await cls.save();
      }
    }

    // 2. Migrate Subjects
    const subjects = await Subject.find();
    let codeCounter = 1;
    for (const subj of subjects) {
      let updated = false;
      if (subj.isActive === undefined) {
        subj.isActive = true;
        updated = true;
      }
      if (!subj.subjectName && subj.name) {
        subj.subjectName = subj.name;
        updated = true;
      }
      if (!subj.subjectCode) {
        const cleanName = (subj.name || 'SUBJ').toUpperCase().replace(/[^A-Z]/g, '');
        const prefix = cleanName.substring(0, 4).padEnd(4, 'X');
        subj.subjectCode = `${prefix}${String(codeCounter++).padStart(3, '0')}`;
        updated = true;
      }
      if (updated) {
        await subj.save();
      }
    }

    // 3. Initialize default Academic Year
    const yearCount = await AcademicYear.countDocuments();
    if (yearCount === 0) {
      const activeYear = await AcademicYear.create({
        name: '2026-2027',
        status: 'active',
        isActive: true
      });
      console.log(`Default Academic Year ${activeYear.name} created and activated.`);
      await SchoolSettings.findOneAndUpdate({}, { academicYear: '2026-2027' }, { upsert: true });
    }

    console.log('Database migration (classes, subjects, academic years) completed.');
  } catch (error) {
    console.error('Database migration error:', error.message);
  }
};

const connectDB = async () => {
  const dbUrl = process.env.MONGODB_URL;
  try {
    if (!dbUrl && (process.env.ENVIRONMENT === 'production' || process.env.NODE_ENV === 'production')) {
      throw new Error('MONGODB_URL is required in production but was not set.');
    }
    const conn = await mongoose.connect(dbUrl || 'mongodb://localhost:27017/face_auth_db', {
      dbName: process.env.MONGODB_DB_NAME || 'face_auth_db'
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    await seedDefaultRoles();
    await seedAdminUser();
    await runDatabaseMigration();
  } catch (error) {
    console.error(`Database Connection Error: ${error.message}`);
    if (dbUrl && (process.env.ENVIRONMENT !== 'production' && process.env.NODE_ENV !== 'production')) {
      console.warn('[Warning] Falling back to local MongoDB for development...');
      try {
        const conn = await mongoose.connect('mongodb://localhost:27017/face_auth_db', {
          dbName: process.env.MONGODB_DB_NAME || 'face_auth_db'
        });
        console.log(`MongoDB Connected (Local Fallback): ${conn.connection.host}`);
        await seedDefaultRoles();
        await seedAdminUser();
        await runDatabaseMigration();
      } catch (fallbackError) {
        console.error(`Local Fallback Connection Error: ${fallbackError.message}`);
      }
    } else {
      console.warn('[Warning] Database connection failed. The server will continue to run, but database features will be unavailable.');
    }
  }
};

export default connectDB;

