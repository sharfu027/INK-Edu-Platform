import PeriodConfiguration from '../models/PeriodConfiguration.js';

// Helper to convert time string "HH:MM" to minutes from midnight
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const seedDefaultPeriods = async () => {
  const count = await PeriodConfiguration.countDocuments();
  if (count === 0) {
    const defaults = [
      { periodNumber: 1, periodName: 'P1', startTime: '09:00', endTime: '09:45', isBreak: false },
      { periodNumber: 2, periodName: 'P2', startTime: '09:45', endTime: '10:30', isBreak: false },
      { periodNumber: 3, periodName: 'P3', startTime: '10:45', endTime: '11:30', isBreak: false },
      { periodNumber: 4, periodName: 'P4', startTime: '11:30', endTime: '12:15', isBreak: false },
      { periodNumber: 5, periodName: 'P5', startTime: '13:00', endTime: '13:45', isBreak: false },
      { periodNumber: 6, periodName: 'P6', startTime: '13:45', endTime: '14:30', isBreak: false },
      { periodNumber: 7, periodName: 'P7', startTime: '14:30', endTime: '15:15', isBreak: false },
      { periodNumber: 8, periodName: 'P8', startTime: '15:15', endTime: '16:00', isBreak: false }
    ];
    await PeriodConfiguration.insertMany(defaults);
    console.log('Seeded 8 default periods.');
  }
};

/**
 * GET /api/periods
 */
export const getPeriods = async (req, res) => {
  try {
    await seedDefaultPeriods();
    const periods = await PeriodConfiguration.find().lean();
    
    // Sort chronologically by start time
    periods.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    
    return res.status(200).json({ status: true, data: periods });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * POST /api/periods
 */
export const createPeriod = async (req, res) => {
  const { periodNumber, periodName, startTime, endTime, isBreak, schoolId } = req.body;
  try {
    if (!periodName || !startTime || !endTime) {
      return res.status(400).json({ status: false, message: 'periodName, startTime, and endTime are required' });
    }

    const newPeriod = new PeriodConfiguration({
      periodNumber: isBreak ? null : periodNumber,
      periodName,
      startTime,
      endTime,
      isBreak: !!isBreak,
      schoolId: schoolId || 'default'
    });

    await newPeriod.save();
    return res.status(201).json({ status: true, data: newPeriod });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * PUT /api/periods/:id
 */
export const updatePeriod = async (req, res) => {
  const { id } = req.params;
  const { periodNumber, periodName, startTime, endTime, isBreak, schoolId } = req.body;
  try {
    const updated = await PeriodConfiguration.findByIdAndUpdate(
      id,
      {
        periodNumber: isBreak ? null : periodNumber,
        periodName,
        startTime,
        endTime,
        isBreak: !!isBreak,
        schoolId: schoolId || 'default'
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ status: false, message: 'Period not found' });
    }

    return res.status(200).json({ status: true, data: updated });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * DELETE /api/periods/:id
 */
export const deletePeriod = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await PeriodConfiguration.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ status: false, message: 'Period not found' });
    }
    return res.status(200).json({ status: true, message: 'Period deleted successfully' });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};
