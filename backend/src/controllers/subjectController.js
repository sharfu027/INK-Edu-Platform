import Subject from '../models/Subject.js';
import TeacherClassSubjectMapping from '../models/TeacherClassSubjectMapping.js';
import Teacher from '../models/Teacher.js';
import Class from '../models/Class.js';

/**
 * Get all subjects
 */
export const getSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find().sort({ name: 1 });
    return res.status(200).json({ status: true, data: subjects });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Create a new subject
 */
export const createSubject = async (req, res) => {
  const { name, subjectName, subjectCode, description } = req.body;
  try {
    const targetName = (name || subjectName || '').trim();
    if (!targetName) {
      return res.status(400).json({ status: false, message: 'Subject name is required' });
    }

    const code = subjectCode ? subjectCode.trim() : null;

    // Check duplicate by name
    const nameExists = await Subject.findOne({ name: { $regex: new RegExp(`^${targetName}$`, 'i') } });
    if (nameExists) {
      return res.status(400).json({ status: false, message: `Subject "${targetName}" already exists` });
    }

    // Check duplicate by code
    if (code) {
      const codeExists = await Subject.findOne({ subjectCode: { $regex: new RegExp(`^${code}$`, 'i') } });
      if (codeExists) {
        return res.status(400).json({ status: false, message: `Subject code "${code}" already exists` });
      }
    }

    const subject = await Subject.create({
      name: targetName,
      subjectName: targetName,
      subjectCode: code,
      description: description ? description.trim() : '',
      isActive: true
    });

    return res.status(201).json({ status: true, message: 'Subject created successfully', data: subject });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Update subject details
 */
export const updateSubject = async (req, res) => {
  const { id } = req.params;
  const { name, subjectName, subjectCode, description, isActive } = req.body;
  try {
    const subject = await Subject.findById(id);
    if (!subject) {
      return res.status(404).json({ status: false, message: 'Subject not found' });
    }

    const targetName = (name || subjectName || subject.name).trim();
    const code = subjectCode ? subjectCode.trim() : null;

    // Check duplicate name
    if (targetName.toLowerCase() !== subject.name.toLowerCase()) {
      const exists = await Subject.findOne({ _id: { $ne: id }, name: { $regex: new RegExp(`^${targetName}$`, 'i') } });
      if (exists) {
        return res.status(400).json({ status: false, message: `Subject "${targetName}" already exists` });
      }
    }

    // Check duplicate code
    if (code && (!subject.subjectCode || code.toLowerCase() !== subject.subjectCode.toLowerCase())) {
      const exists = await Subject.findOne({ _id: { $ne: id }, subjectCode: { $regex: new RegExp(`^${code}$`, 'i') } });
      if (exists) {
        return res.status(400).json({ status: false, message: `Subject code "${code}" already exists` });
      }
    }

    subject.name = targetName;
    subject.subjectName = targetName;
    subject.subjectCode = code;
    subject.description = description !== undefined ? description.trim() : subject.description;
    
    if (isActive !== undefined) {
      subject.isActive = isActive;
    }

    await subject.save();
    return res.status(200).json({ status: true, message: 'Subject updated successfully', data: subject });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Delete a subject (Soft delete by setting isActive = false)
 */
export const deleteSubject = async (req, res) => {
  const { id } = req.params;
  try {
    const subject = await Subject.findById(id);
    if (!subject) {
      return res.status(404).json({ status: false, message: 'Subject not found' });
    }
    
    subject.isActive = false;
    await subject.save();
    
    return res.status(200).json({ status: true, message: 'Subject deactivated successfully', data: subject });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Bulk Import Subjects
 */
export const importSubjects = async (req, res) => {
  const subjectsList = req.body;
  if (!Array.isArray(subjectsList)) {
    return res.status(400).json({ status: false, message: 'Expected an array of subject objects' });
  }

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const errors = [];

  try {
    for (let index = 0; index < subjectsList.length; index++) {
      const row = subjectsList[index];
      const rawName = row.subjectName || row.name;
      const rawCode = row.subjectCode;
      const rawDescription = row.description;

      if (!rawName) {
        errors.push(`Row ${index + 1}: Missing subjectName or name`);
        continue;
      }

      const name = rawName.trim();
      const code = rawCode ? rawCode.trim() : null;
      const description = rawDescription ? rawDescription.trim() : '';

      // Check duplicates by code (primary) or name (secondary)
      let existingSubject = null;
      if (code) {
        existingSubject = await Subject.findOne({ subjectCode: { $regex: new RegExp(`^${code}$`, 'i') } });
      }
      if (!existingSubject) {
        existingSubject = await Subject.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
      }

      if (existingSubject) {
        existingSubject.name = name;
        existingSubject.subjectName = name;
        if (code) {
          existingSubject.subjectCode = code;
        }
        if (description) {
          existingSubject.description = description;
        }
        existingSubject.isActive = true; // reactivate if disabled
        await existingSubject.save();
        updatedCount++;
      } else {
        await Subject.create({
          name,
          subjectName: name,
          subjectCode: code,
          description,
          isActive: true
        });
        createdCount++;
      }
    }

    return res.status(200).json({
      status: true,
      message: 'Subjects import completed',
      data: { createdCount, updatedCount, skippedCount, errors }
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Bulk Export Subjects
 */
export const exportSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find();
    let csv = 'subjectName,subjectCode,description,isActive\n';
    
    subjects.forEach(s => {
      const name = `"${s.name.replace(/"/g, '""')}"`;
      const code = s.subjectCode ? `"${s.subjectCode.replace(/"/g, '""')}"` : '""';
      const desc = s.description ? `"${s.description.replace(/"/g, '""')}"` : '""';
      const active = s.isActive !== false ? 'true' : 'false';
      
      csv += `${name},${code},${desc},${active}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=subjects_export.csv');
    return res.status(200).send(csv);
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Get all teacher-class-subject mappings
 */
export const getMappings = async (req, res) => {
  try {
    const mappings = await TeacherClassSubjectMapping.find()
      .populate('teacher')
      .populate('class')
      .populate('subject');

    // Filter out mappings where referenced documents no longer exist or are inactive
    const validMappings = mappings.filter(m => 
      m.teacher && m.teacher.status === 'Active' &&
      m.class && m.class.isActive !== false &&
      m.subject && m.subject.isActive !== false
    );

    return res.status(200).json({ status: true, data: validMappings });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Create a new teacher-class-subject mapping
 */
export const createMapping = async (req, res) => {
  const teacherId = req.body.teacher || req.body.teacherId;
  const classId = req.body.class || req.body.classId;
  const subjectId = req.body.subject || req.body.subjectId;
  try {
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) return res.status(404).json({ status: false, message: 'Teacher not found' });
    if (teacher.status !== 'Active') return res.status(400).json({ status: false, message: 'Teacher is not active' });

    const cls = await Class.findById(classId);
    if (!cls) return res.status(404).json({ status: false, message: 'Class not found' });
    if (cls.isActive === false) return res.status(400).json({ status: false, message: 'Class is deactivated' });

    const subject = await Subject.findById(subjectId);
    if (!subject) return res.status(404).json({ status: false, message: 'Subject not found' });
    if (subject.isActive === false) return res.status(400).json({ status: false, message: 'Subject is deactivated' });

    const exists = await TeacherClassSubjectMapping.findOne({
      teacher: teacherId,
      class: classId,
      subject: subjectId
    });
    if (exists) {
      return res.status(400).json({ status: false, message: 'Mapping already exists' });
    }

    const mapping = await TeacherClassSubjectMapping.create({
      teacher: teacherId,
      class: classId,
      subject: subjectId
    });

    const populated = await mapping.populate([
      { path: 'teacher', select: 'name employeeId' },
      { path: 'class', select: 'standard section' },
      { path: 'subject', select: 'name' }
    ]);

    return res.status(201).json({ status: true, message: 'Mapping created successfully', data: populated });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Delete a mapping
 */
export const deleteMapping = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await TeacherClassSubjectMapping.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ status: false, message: 'Mapping not found' });
    }
    return res.status(200).json({ status: true, message: 'Mapping deleted successfully' });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};
