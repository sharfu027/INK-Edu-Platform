import Teacher from '../models/Teacher.js';
import NonTeachingStaff from '../models/NonTeachingStaff.js';
import User from '../models/User.js';
import SchoolSettings from '../models/SchoolSettings.js';
import TeacherClassSubjectMapping from '../models/TeacherClassSubjectMapping.js';
import Class from '../models/Class.js';
import fs from 'fs';
import path from 'path';

/**
 * Get all teaching and non-teaching faculty
 */
export const getFaculty = async (req, res) => {
  try {
    const teachers = await Teacher.find().populate('user', 'email role isActive skip_face skip_location');
    const nonTeaching = await NonTeachingStaff.find().populate('user', 'email role isActive skip_face skip_location');
    
    return res.status(200).json({
      status: true,
      data: {
        teachers,
        nonTeaching
      }
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Add a new Teacher profile (and User login if requested)
 */
export const addTeacher = async (req, res) => {
  const { employeeId, name, email, phone, qualification, experience, status, createLogin, password, role } = req.body;
  try {
    const finalEmployeeId = employeeId || 'TCH-' + Math.floor(100000 + Math.random() * 900000);
    // Check duplicate employeeId
    const exists = await Teacher.findOne({ employeeId: finalEmployeeId });
    if (exists) {
      return res.status(400).json({ status: false, message: `Employee ID ${finalEmployeeId} already exists` });
    }

    let userId = null;
    if (createLogin !== false) {
      // Check User duplication
      const userExists = await User.findOne({ email });
      if (userExists) {
        return res.status(400).json({ status: false, message: `Login user with email ${email} already exists` });
      }

      const schoolSettings = await SchoolSettings.findOne();
      const defaultSkipFace = schoolSettings ? !schoolSettings.face_auth_enabled : false;
      const defaultSkipLocation = schoolSettings ? !schoolSettings.location_auth_enabled : false;

      const user = await User.create({
        name,
        email,
        phone,
        password_hash: password || 'Welcome@123',
        role: role || 'teacher',
        face_embeddings: [],
        skip_face: defaultSkipFace,
        skip_location: defaultSkipLocation
      });
      userId = user._id;
    }

    const teacher = await Teacher.create({
      user: userId,
      employeeId: finalEmployeeId,
      name,
      email,
      phone,
      qualification: qualification || 'N/A',
      experience: experience || 0,
      status: status || 'Active'
    });

    return res.status(201).json({ status: true, message: 'Teacher added successfully', data: teacher });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Add a new Non-Teaching Staff profile (and User login if requested)
 */
export const addNonTeachingStaff = async (req, res) => {
  const { employeeId, name, email, phone, staffRole, status, createLogin, password } = req.body;
  try {
    const finalEmployeeId = employeeId || 'STF-' + Math.floor(100000 + Math.random() * 900000);
    const exists = await NonTeachingStaff.findOne({ employeeId: finalEmployeeId });
    if (exists) {
      return res.status(400).json({ status: false, message: `Employee ID ${finalEmployeeId} already exists` });
    }

    let userId = null;
    if (createLogin !== false) {
      const userExists = await User.findOne({ email });
      if (userExists) {
        return res.status(400).json({ status: false, message: `Login user with email ${email} already exists` });
      }

      const schoolSettings = await SchoolSettings.findOne();
      const defaultSkipFace = schoolSettings ? !schoolSettings.face_auth_enabled : false;
      const defaultSkipLocation = schoolSettings ? !schoolSettings.location_auth_enabled : false;

      const user = await User.create({
        name,
        email,
        phone,
        password_hash: password || 'Welcome@123',
        role: staffRole || 'staff',
        face_embeddings: [],
        skip_face: defaultSkipFace,
        skip_location: defaultSkipLocation
      });
      userId = user._id;
    }

    const staff = await NonTeachingStaff.create({
      user: userId,
      employeeId: finalEmployeeId,
      name,
      email,
      phone,
      staffRole,
      status: status || 'Active'
    });

    return res.status(201).json({ status: true, message: 'Staff member added successfully', data: staff });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Update Teacher or Staff settings
 */
export const updateFacultySettings = async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, qualification, experience, status, staffRole, isActive, role, skip_face, skip_location } = req.body;
  try {
    let faculty = await Teacher.findById(id);
    let type = 'teacher';
    
    if (!faculty) {
      faculty = await NonTeachingStaff.findById(id);
      type = 'staff';
    }

    if (!faculty) {
      return res.status(404).json({ status: false, message: 'Faculty member not found' });
    }

    // Fetch school settings to validate skip overrides
    const schoolSettings = await SchoolSettings.findOne();
    const faceAuthEnabled = schoolSettings ? schoolSettings.face_auth_enabled !== false : true;
    const locationAuthEnabled = schoolSettings ? schoolSettings.location_auth_enabled !== false : true;

    if (!faceAuthEnabled && skip_face === true) {
      return res.status(400).json({ status: false, message: 'Cannot enable Skip Face because Face Authentication is globally disabled.' });
    }
    if (!locationAuthEnabled && skip_location === true) {
      return res.status(400).json({ status: false, message: 'Cannot enable Skip Location because Location Authentication is globally disabled.' });
    }

    // Update attributes
    if (name) faculty.name = name;
    if (email) faculty.email = email;
    if (phone) faculty.phone = phone;
    if (qualification && type === 'teacher') faculty.qualification = qualification;
    if (experience !== undefined && type === 'teacher') faculty.experience = experience;
    if (status) faculty.status = status;

    const targetRole = role || staffRole;
    if (targetRole && type === 'staff') {
      faculty.staffRole = targetRole;
    }

    await faculty.save();

    // Update linked User if present
    if (faculty.user) {
      const userUpdate = {};
      if (isActive !== undefined) userUpdate.isActive = isActive;
      
      // Enforce settings checks
      if (!faceAuthEnabled) {
        userUpdate.skip_face = false;
      } else if (skip_face !== undefined) {
        userUpdate.skip_face = skip_face;
      }

      if (!locationAuthEnabled) {
        userUpdate.skip_location = false;
      } else if (skip_location !== undefined) {
        userUpdate.skip_location = skip_location;
      }

      if (targetRole) userUpdate.role = targetRole.toLowerCase();
      
      if (Object.keys(userUpdate).length > 0) {
        await User.findByIdAndUpdate(faculty.user, userUpdate);
      }
    }

    return res.status(200).json({ status: true, message: 'Faculty updated successfully', data: faculty });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Reset password of linked user
 */
export const resetFacultyPassword = async (req, res) => {
  const { id } = req.params; // Faculty ID (Teacher or Staff)
  const { new_password } = req.body;
  try {
    let faculty = await Teacher.findById(id);
    if (!faculty) {
      faculty = await NonTeachingStaff.findById(id);
    }

    if (!faculty || !faculty.user) {
      return res.status(404).json({ status: false, message: 'Faculty has no linked login account' });
    }

    const user = await User.findById(faculty.user);
    if (!user) {
      return res.status(404).json({ status: false, message: 'Linked login account not found' });
    }

    user.password_hash = new_password; // password hook will hash it on save
    await user.save();

    return res.status(200).json({ status: true, message: 'Password reset successful' });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Delete Faculty member
 */
export const deleteFaculty = async (req, res) => {
  const { id } = req.params;
  try {
    let faculty = await Teacher.findByIdAndDelete(id);
    if (faculty) {
      if (faculty.user) {
        await User.findByIdAndDelete(faculty.user);
      }
      // Also delete any mappings associated with this teacher
      await TeacherClassSubjectMapping.deleteMany({ teacher: id });
      // Set classTeacher to null for any classes where this teacher was class teacher
      await Class.updateMany({ classTeacher: id }, { classTeacher: null });
    }

    if (!faculty) {
      faculty = await NonTeachingStaff.findByIdAndDelete(id);
      if (faculty && faculty.user) {
        await User.findByIdAndDelete(faculty.user);
      }
    }

    if (!faculty) {
      return res.status(404).json({ status: false, message: 'Faculty member not found' });
    }

    return res.status(200).json({ status: true, message: 'Faculty deleted successfully' });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * File upload document mock/simple controller
 */
export const uploadDocument = async (req, res) => {
  // Multer handles file parsing
  if (!req.file) {
    return res.status(400).json({ status: false, message: 'No file uploaded' });
  }
  return res.status(200).json({
    status: true,
    message: 'Document uploaded successfully',
    filename: req.file.filename
  });
};

/**
 * File download document mock/simple controller
 */
export const downloadDocument = async (req, res) => {
  const { filename } = req.params;
  const uploadsDir = path.resolve('uploads');
  const filePath = path.join(uploadsDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ status: false, message: 'Document not found' });
  }

  return res.download(filePath);
};

/**
 * Bulk Import Teachers
 */
export const importTeachers = async (req, res) => {
  const teachersList = req.body;
  if (!Array.isArray(teachersList)) {
    return res.status(400).json({ status: false, message: 'Expected an array of teacher objects' });
  }

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const errors = [];

  try {
    const settings = await SchoolSettings.findOne();
    const defaultSkipFace = settings ? !settings.face_auth_enabled : false;
    const defaultSkipLocation = settings ? !settings.location_auth_enabled : false;

    for (let index = 0; index < teachersList.length; index++) {
      const row = teachersList[index];
      const rawEmployeeId = row.employeeId;
      const rawName = row.name;
      const rawEmail = row.email;
      const rawPhone = row.phone || '';
      const rawQual = row.qualification || 'N/A';
      const rawExp = row.experience;
      const rawPassword = row.password || 'Welcome@123';
      const rawRole = row.role || 'teacher';

      if (!rawName || !rawEmail || !rawEmployeeId) {
        errors.push(`Row ${index + 1}: Missing name, email, or employeeId`);
        continue;
      }

      const name = rawName.trim();
      const email = rawEmail.trim().toLowerCase();
      const employeeId = rawEmployeeId.trim();
      const phone = rawPhone.trim();
      const qualification = rawQual.trim();
      const experience = parseInt(rawExp) || 0;

      // Check duplicate employeeId in Teacher
      let existingTeacher = await Teacher.findOne({ employeeId: { $regex: new RegExp(`^${employeeId}$`, 'i') } });
      
      // Check duplicate email in User
      let existingUser = await User.findOne({ email });

      if (existingTeacher) {
        // Update existing teacher profile
        existingTeacher.name = name;
        existingTeacher.email = email;
        existingTeacher.phone = phone;
        existingTeacher.qualification = qualification;
        existingTeacher.experience = experience;
        
        if (existingUser) {
          existingUser.name = name;
          existingUser.phone = phone;
          await existingUser.save();
        } else {
          // Create login if missing
          const newUser = await User.create({
            name,
            email,
            phone,
            password_hash: rawPassword,
            role: rawRole,
            face_embeddings: [],
            skip_face: defaultSkipFace,
            skip_location: defaultSkipLocation
          });
          existingTeacher.user = newUser._id;
        }
        
        await existingTeacher.save();
        updatedCount++;
      } else {
        // Create new User login first
        let userId = null;
        if (existingUser) {
          userId = existingUser._id;
          if (existingUser.role !== rawRole) {
            existingUser.role = rawRole;
            await existingUser.save();
          }
        } else {
          const newUser = await User.create({
            name,
            email,
            phone,
            password_hash: rawPassword,
            role: rawRole,
            face_embeddings: [],
            skip_face: defaultSkipFace,
            skip_location: defaultSkipLocation
          });
          userId = newUser._id;
        }

        // Create new Teacher
        await Teacher.create({
          user: userId,
          employeeId,
          name,
          email,
          phone,
          qualification,
          experience,
          status: 'Active'
        });
        createdCount++;
      }
    }

    return res.status(200).json({
      status: true,
      message: 'Teachers import completed',
      data: { createdCount, updatedCount, skippedCount, errors }
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Bulk Export Teachers
 */
export const exportTeachers = async (req, res) => {
  try {
    const teachers = await Teacher.find();
    let csv = 'employeeId,name,email,phone,qualification,experience,status\n';
    
    teachers.forEach(t => {
      const empId = `"${t.employeeId.replace(/"/g, '""')}"`;
      const name = `"${t.name.replace(/"/g, '""')}"`;
      const email = `"${t.email.replace(/"/g, '""')}"`;
      const phone = t.phone ? `"${t.phone.replace(/"/g, '""')}"` : '""';
      const qual = t.qualification ? `"${t.qualification.replace(/"/g, '""')}"` : '""';
      const exp = t.experience || 0;
      const status = `"${(t.status || 'Active').replace(/"/g, '""')}"`;
      
      csv += `${empId},${name},${email},${phone},${qual},${exp},${status}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=teachers_export.csv');
    return res.status(200).send(csv);
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};


