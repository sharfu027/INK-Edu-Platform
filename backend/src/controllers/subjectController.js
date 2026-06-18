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
  const { name } = req.body;
  try {
    const exists = await Subject.findOne({ name });
    if (exists) {
      return res.status(400).json({ status: false, message: 'Subject already exists' });
    }

    const subject = await Subject.create({ name });
    return res.status(201).json({ status: true, message: 'Subject created successfully', data: subject });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Delete a subject
 */
export const deleteSubject = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Subject.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ status: false, message: 'Subject not found' });
    }
    // Also delete any mappings associated with this subject
    await TeacherClassSubjectMapping.deleteMany({ subject: id });
    return res.status(200).json({ status: true, message: 'Subject and associated mappings deleted successfully' });
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
      .populate('teacher', 'name employeeId')
      .populate('class', 'standard section')
      .populate('subject', 'name');

    // Filter out mappings where referenced documents no longer exist
    const validMappings = mappings.filter(m => m.teacher && m.class && m.subject);

    // Proactively clean up orphan mappings from the database
    const orphanIds = mappings.filter(m => !m.teacher || !m.class || !m.subject).map(m => m._id);
    if (orphanIds.length > 0) {
      await TeacherClassSubjectMapping.deleteMany({ _id: { $in: orphanIds } });
    }

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
    // Validate referenced models exist
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) return res.status(404).json({ status: false, message: 'Teacher not found' });

    const cls = await Class.findById(classId);
    if (!cls) return res.status(404).json({ status: false, message: 'Class not found' });

    const subject = await Subject.findById(subjectId);
    if (!subject) return res.status(404).json({ status: false, message: 'Subject not found' });

    // Check if mapping exists
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
