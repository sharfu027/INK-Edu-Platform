import Class from '../models/Class.js';
import Teacher from '../models/Teacher.js';
import TeacherClassSubjectMapping from '../models/TeacherClassSubjectMapping.js';

/**
 * Get all classes
 */
export const getClasses = async (req, res) => {
  try {
    const classes = await Class.find().populate('classTeacher', 'name employeeId email');
    return res.status(200).json({ status: true, data: classes });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Create a new class
 */
export const createClass = async (req, res) => {
  const { standard, section, board, classTeacher, strength } = req.body;
  try {
    const trimmedStandard = standard.trim();
    const trimmedSection = section.trim().toUpperCase();
    const targetBoard = board ? board.trim().toUpperCase() : 'CBSE';

    // Check if standard + section + board combination already exists (case-insensitive)
    const classExists = await Class.findOne({
      standard: { $regex: new RegExp(`^${trimmedStandard}$`, 'i') },
      section: { $regex: new RegExp(`^${trimmedSection}$`, 'i') },
      board: { $regex: new RegExp(`^${targetBoard}$`, 'i') }
    });
    if (classExists) {
      return res.status(400).json({ status: false, message: `Class ${trimmedStandard}-${trimmedSection} (${targetBoard}) already exists` });
    }

    let classTeacherId = null;
    if (classTeacher) {
      // Find teacher by id
      const teacher = await Teacher.findById(classTeacher);
      if (!teacher) {
        return res.status(404).json({ status: false, message: 'Class teacher not found' });
      }

      // Check if this teacher is already assigned to another class as class teacher
      const teacherAssigned = await Class.findOne({ classTeacher: teacher._id });
      if (teacherAssigned) {
        return res.status(400).json({ status: false, message: `Teacher "${teacher.name}" is already assigned as a class teacher for class ${teacherAssigned.standard}-${teacherAssigned.section}` });
      }
      classTeacherId = teacher._id;
    }

    const newClass = await Class.create({
      standard: trimmedStandard,
      section: trimmedSection,
      board: targetBoard,
      classTeacher: classTeacherId,
      strength: strength || 0
    });

    const populatedClass = await newClass.populate('classTeacher', 'name employeeId');

    return res.status(201).json({ status: true, message: 'Class created successfully', data: populatedClass });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Delete a class
 */
export const deleteClass = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Class.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ status: false, message: 'Class not found' });
    }
    
    // Also delete any mappings associated with this class
    await TeacherClassSubjectMapping.deleteMany({ class: id });
    
    return res.status(200).json({ status: true, message: 'Class deleted successfully' });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};
