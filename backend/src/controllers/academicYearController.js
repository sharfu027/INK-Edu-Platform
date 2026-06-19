import AcademicYear from '../models/AcademicYear.js';
import SchoolSettings from '../models/SchoolSettings.js';

/**
 * Get all academic years
 */
export const getAcademicYears = async (req, res) => {
  try {
    const years = await AcademicYear.find().sort({ name: -1 });
    return res.status(200).json({ status: true, data: years });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Create a new academic year
 */
export const createAcademicYear = async (req, res) => {
  const { name } = req.body;
  try {
    if (!name || !name.trim()) {
      return res.status(400).json({ status: false, message: 'Name is required' });
    }
    const trimmed = name.trim();
    const exists = await AcademicYear.findOne({ name: trimmed });
    if (exists) {
      return res.status(400).json({ status: false, message: `Academic Year ${trimmed} already exists` });
    }

    const newYear = await AcademicYear.create({
      name: trimmed,
      status: 'upcoming',
      isActive: false
    });

    return res.status(201).json({ status: true, message: 'Academic Year created successfully', data: newYear });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Update academic year details
 */
export const updateAcademicYear = async (req, res) => {
  const { id } = req.params;
  const { name, status } = req.body;
  try {
    const year = await AcademicYear.findById(id);
    if (!year) {
      return res.status(404).json({ status: false, message: 'Academic Year not found' });
    }

    if (name) year.name = name.trim();
    if (status) year.status = status;

    await year.save();
    return res.status(200).json({ status: true, message: 'Academic Year updated successfully', data: year });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Activate academic year
 */
export const activateAcademicYear = async (req, res) => {
  const { id } = req.params;
  try {
    const year = await AcademicYear.findById(id);
    if (!year) {
      return res.status(404).json({ status: false, message: 'Academic Year not found' });
    }

    // Set all other academic years to inactive and archived
    await AcademicYear.updateMany({ _id: { $ne: id } }, { isActive: false, status: 'archived' });

    // Set this academic year to active
    year.isActive = true;
    year.status = 'active';
    await year.save();

    // Update the school settings with this active academic year
    await SchoolSettings.findOneAndUpdate({}, { academicYear: year.name }, { upsert: true });

    return res.status(200).json({ status: true, message: `Academic Year ${year.name} activated successfully`, data: year });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Delete academic year (only if not active)
 */
export const deleteAcademicYear = async (req, res) => {
  const { id } = req.params;
  try {
    const year = await AcademicYear.findById(id);
    if (!year) {
      return res.status(404).json({ status: false, message: 'Academic Year not found' });
    }
    if (year.isActive) {
      return res.status(400).json({ status: false, message: 'Cannot delete the active academic year' });
    }
    await AcademicYear.findByIdAndDelete(id);
    return res.status(200).json({ status: true, message: 'Academic Year deleted successfully' });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};
