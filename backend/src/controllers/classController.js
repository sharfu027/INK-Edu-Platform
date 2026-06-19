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
  const { standard, className, section, board, classTeacher, strength } = req.body;
  try {
    const targetStandard = (standard || className || '').trim();
    if (!targetStandard) {
      return res.status(400).json({ status: false, message: 'Standard/className is required' });
    }
    const trimmedStandard = targetStandard;
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
      const teacher = await Teacher.findById(classTeacher);
      if (!teacher) {
        return res.status(404).json({ status: false, message: 'Class teacher not found' });
      }

      // Check if this teacher is already assigned to another active class as class teacher
      const teacherAssigned = await Class.findOne({ classTeacher: teacher._id, isActive: true });
      if (teacherAssigned) {
        return res.status(400).json({ status: false, message: `Teacher "${teacher.name}" is already assigned as a class teacher for class ${teacherAssigned.standard}-${teacherAssigned.section}` });
      }
      classTeacherId = teacher._id;
    }

    const newClass = await Class.create({
      standard: trimmedStandard,
      className: trimmedStandard,
      section: trimmedSection,
      board: targetBoard,
      classTeacher: classTeacherId,
      strength: strength || 0,
      isActive: true
    });

    const populatedClass = await newClass.populate('classTeacher', 'name employeeId');
    return res.status(201).json({ status: true, message: 'Class created successfully', data: populatedClass });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Update class details
 */
export const updateClass = async (req, res) => {
  const { id } = req.params;
  const { standard, className, section, board, classTeacher, strength, isActive } = req.body;
  try {
    const classObj = await Class.findById(id);
    if (!classObj) {
      return res.status(404).json({ status: false, message: 'Class not found' });
    }

    const newStandard = (standard || className || classObj.standard).trim();
    const newSection = (section || classObj.section).trim().toUpperCase();
    const newBoard = (board || classObj.board).trim().toUpperCase();

    // Check duplicate if standard/section/board changed
    if (newStandard.toLowerCase() !== classObj.standard.toLowerCase() || 
        newSection.toLowerCase() !== classObj.section.toLowerCase() || 
        newBoard.toLowerCase() !== classObj.board.toLowerCase()) {
      const exists = await Class.findOne({
        _id: { $ne: id },
        standard: { $regex: new RegExp(`^${newStandard}$`, 'i') },
        section: { $regex: new RegExp(`^${newSection}$`, 'i') },
        board: { $regex: new RegExp(`^${newBoard}$`, 'i') }
      });
      if (exists) {
        return res.status(400).json({ status: false, message: `Class ${newStandard}-${newSection} (${newBoard}) already exists` });
      }
    }

    classObj.standard = newStandard;
    classObj.className = newStandard;
    classObj.section = newSection;
    classObj.board = newBoard;
    classObj.strength = strength !== undefined ? parseInt(strength) : classObj.strength;
    
    if (isActive !== undefined) {
      classObj.isActive = isActive;
    }

    if (classTeacher !== undefined) {
      if (classTeacher === '' || classTeacher === null) {
        classObj.classTeacher = null;
      } else {
        const teacher = await Teacher.findById(classTeacher);
        if (!teacher) {
          return res.status(404).json({ status: false, message: 'Class teacher not found' });
        }
        // Check if teacher is already class teacher for another active class
        const teacherAssigned = await Class.findOne({ _id: { $ne: id }, classTeacher: teacher._id, isActive: true });
        if (teacherAssigned) {
          return res.status(400).json({ status: false, message: `Teacher "${teacher.name}" is already class teacher for class ${teacherAssigned.standard}-${teacherAssigned.section}` });
        }
        classObj.classTeacher = teacher._id;
      }
    }

    await classObj.save();
    const populated = await classObj.populate('classTeacher', 'name employeeId email');
    return res.status(200).json({ status: true, message: 'Class updated successfully', data: populated });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Delete a class (Soft delete by setting isActive = false)
 */
export const deleteClass = async (req, res) => {
  const { id } = req.params;
  try {
    const classObj = await Class.findById(id);
    if (!classObj) {
      return res.status(404).json({ status: false, message: 'Class not found' });
    }
    
    classObj.isActive = false;
    await classObj.save();
    
    return res.status(200).json({ status: true, message: 'Class deactivated successfully', data: classObj });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Bulk Import Classes
 */
export const importClasses = async (req, res) => {
  const classesList = req.body;
  if (!Array.isArray(classesList)) {
    return res.status(400).json({ status: false, message: 'Expected an array of class objects' });
  }

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const errors = [];

  try {
    for (let index = 0; index < classesList.length; index++) {
      const row = classesList[index];
      const rawStandard = row.className || row.standard;
      const rawSection = row.section;
      const rawBoard = row.board || 'CBSE';
      const rawStrength = row.strength;
      const teacherKey = row.classTeacherEmployeeId || row.classTeacherEmail;

      if (!rawStandard || !rawSection) {
        errors.push(`Row ${index + 1}: Missing standard/className or section`);
        continue;
      }

      const standard = rawStandard.trim();
      const section = rawSection.trim().toUpperCase();
      const board = rawBoard.trim().toUpperCase();
      const strength = parseInt(rawStrength) || 0;

      // Look up teacher if specified
      let teacherId = null;
      if (teacherKey && teacherKey.trim()) {
        const key = teacherKey.trim();
        const teacher = await Teacher.findOne({
          $or: [
            { employeeId: { $regex: new RegExp(`^${key}$`, 'i') } },
            { email: { $regex: new RegExp(`^${key}$`, 'i') } }
          ]
        });
        if (teacher) {
          teacherId = teacher._id;
        } else {
          errors.push(`Row ${index + 1}: Teacher with ID/Email "${key}" not found (skipped teacher assignment)`);
        }
      }

      // Check duplicates
      let existingClass = await Class.findOne({
        standard: { $regex: new RegExp(`^${standard}$`, 'i') },
        section: { $regex: new RegExp(`^${section}$`, 'i') },
        board: { $regex: new RegExp(`^${board}$`, 'i') }
      });

      if (existingClass) {
        existingClass.strength = strength;
        if (teacherId) {
          existingClass.classTeacher = teacherId;
        }
        existingClass.isActive = true; // reactivate if disabled
        await existingClass.save();
        updatedCount++;
      } else {
        await Class.create({
          standard,
          className: standard,
          section,
          board,
          strength,
          classTeacher: teacherId,
          isActive: true
        });
        createdCount++;
      }
    }

    return res.status(200).json({
      status: true,
      message: 'Classes import completed',
      data: { createdCount, updatedCount, skippedCount, errors }
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Bulk Export Classes
 */
export const exportClasses = async (req, res) => {
  try {
    const classes = await Class.find().populate('classTeacher', 'name employeeId');
    let csv = 'className,section,board,strength,classTeacherName,classTeacherEmployeeId,isActive\n';
    
    classes.forEach(c => {
      const clsName = `"${c.standard.replace(/"/g, '""')}"`;
      const sect = `"${c.section.replace(/"/g, '""')}"`;
      const brd = `"${c.board.replace(/"/g, '""')}"`;
      const strength = c.strength || 0;
      const teacherName = c.classTeacher ? `"${c.classTeacher.name.replace(/"/g, '""')}"` : '""';
      const teacherId = c.classTeacher ? `"${c.classTeacher.employeeId.replace(/"/g, '""')}"` : '""';
      const active = c.isActive !== false ? 'true' : 'false';
      
      csv += `${clsName},${sect},${brd},${strength},${teacherName},${teacherId},${active}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=classes_export.csv');
    return res.status(200).send(csv);
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};
