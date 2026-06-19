import SchoolSettings from '../models/SchoolSettings.js';
import User from '../models/User.js';

/**
 * Get school settings
 */
export const getSettings = async (req, res) => {
  try {
    let settings = await SchoolSettings.findOne();
    if (!settings) {
      // Create a default settings document
      settings = await SchoolSettings.create({
        schoolName: 'Golden Valley Academy',
        schoolType: 'Co-Educational',
        board: 'CBSE',
        face_auth_enabled: true,
        location_auth_enabled: true,
        academicYear: '2026-2027',
        timings: {
          start: '08:30',
          end: '16:00',
          gracePeriod: 15
        },
        hours_per_subject: 1,
        game_period_mins: 45,
        lunch_break_mins: 45,
        small_break_mins: 15,
        hours_per_day: 8,
        hours_per_week: 40,
        hours_per_month: 160,
        hours_per_year: 1920,
        weekly_off: 'Sunday',
        standardsConfig: [
          { standard: '8', sections: ['A', 'B'] },
          { standard: '9', sections: ['A', 'B', 'C'] },
          { standard: '10', sections: ['A', 'B'] }
        ]
      });
    }

    // Return with frontend-compatible field names alongside raw data
    const obj = settings.toObject();
    obj.office_start_time = obj.timings?.start || '08:30';
    obj.office_end_time = obj.timings?.end || '16:00';
    obj.grace_period_mins = obj.timings?.gracePeriod || 15;
    obj.hours_per_subject = obj.hours_per_subject !== undefined ? obj.hours_per_subject : 1;
    obj.game_period_mins = obj.game_period_mins !== undefined ? obj.game_period_mins : 45;
    obj.lunch_break_mins = obj.lunch_break_mins !== undefined ? obj.lunch_break_mins : 45;
    obj.small_break_mins = obj.small_break_mins !== undefined ? obj.small_break_mins : 15;
    obj.face_auth_enabled = obj.face_auth_enabled !== undefined ? obj.face_auth_enabled : true;
    obj.location_auth_enabled = obj.location_auth_enabled !== undefined ? obj.location_auth_enabled : true;
    obj.boardsList = obj.boardsList && obj.boardsList.length > 0 ? obj.boardsList : ['CBSE', 'STATE', 'ICSE'];
    obj.standardsList = obj.standardsList && obj.standardsList.length > 0 ? obj.standardsList : ['Nursery', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];

    return res.status(200).json({ status: true, data: obj });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

/**
 * Update school settings
 */
export const updateSettings = async (req, res) => {
  try {
    let settings = await SchoolSettings.findOne();
    if (!settings) {
      settings = new SchoolSettings();
    }

    const { schoolName, schoolType, board, academicYear, timings, standardsConfig,
            hours_per_day, hours_per_week, hours_per_month, hours_per_year, weekly_off,
            office_start_time, office_end_time, grace_period_mins,
            hours_per_subject, game_period_mins, lunch_break_mins, small_break_mins,
            face_auth_enabled, location_auth_enabled, boardsList, standardsList } = req.body;

    if (schoolName) settings.schoolName = schoolName;
    if (schoolType) settings.schoolType = schoolType;
    if (board) settings.board = board;
    if (academicYear) settings.academicYear = academicYear;

    // Handle nested timings from direct timings object
    if (timings) {
      if (timings.start) settings.timings.start = timings.start;
      if (timings.end) settings.timings.end = timings.end;
      if (timings.gracePeriod !== undefined) settings.timings.gracePeriod = timings.gracePeriod;
    }

    // Handle flat field names from frontend
    if (office_start_time) settings.timings.start = office_start_time;
    if (office_end_time) settings.timings.end = office_end_time;
    if (grace_period_mins !== undefined) settings.timings.gracePeriod = grace_period_mins;

    if (hours_per_day !== undefined) settings.hours_per_day = hours_per_day;
    if (hours_per_week !== undefined) settings.hours_per_week = hours_per_week;
    if (hours_per_month !== undefined) settings.hours_per_month = hours_per_month;
    if (hours_per_year !== undefined) settings.hours_per_year = hours_per_year;
    if (weekly_off) settings.weekly_off = weekly_off;
    if (standardsConfig) settings.standardsConfig = standardsConfig;

    if (hours_per_subject !== undefined) settings.hours_per_subject = hours_per_subject;
    if (game_period_mins !== undefined) settings.game_period_mins = game_period_mins;
    if (lunch_break_mins !== undefined) settings.lunch_break_mins = lunch_break_mins;
    if (small_break_mins !== undefined) settings.small_break_mins = small_break_mins;
    if (face_auth_enabled !== undefined) {
      settings.face_auth_enabled = face_auth_enabled;
      if (!face_auth_enabled) {
        await User.updateMany({}, { skip_face: false });
      }
    }
    if (location_auth_enabled !== undefined) {
      settings.location_auth_enabled = location_auth_enabled;
      if (!location_auth_enabled) {
        await User.updateMany({}, { skip_location: false });
      }
    }
    if (boardsList) settings.boardsList = boardsList;
    if (standardsList) settings.standardsList = standardsList;

    await settings.save();

    // Return with frontend-compatible field names
    const obj = settings.toObject();
    obj.office_start_time = obj.timings?.start || '08:30';
    obj.office_end_time = obj.timings?.end || '16:00';
    obj.grace_period_mins = obj.timings?.gracePeriod || 15;
    obj.hours_per_subject = obj.hours_per_subject !== undefined ? obj.hours_per_subject : 1;
    obj.game_period_mins = obj.game_period_mins !== undefined ? obj.game_period_mins : 45;
    obj.lunch_break_mins = obj.lunch_break_mins !== undefined ? obj.lunch_break_mins : 45;
    obj.small_break_mins = obj.small_break_mins !== undefined ? obj.small_break_mins : 15;
    obj.face_auth_enabled = obj.face_auth_enabled !== undefined ? obj.face_auth_enabled : true;
    obj.location_auth_enabled = obj.location_auth_enabled !== undefined ? obj.location_auth_enabled : true;
    obj.boardsList = obj.boardsList && obj.boardsList.length > 0 ? obj.boardsList : ['CBSE', 'STATE', 'ICSE'];
    obj.standardsList = obj.standardsList && obj.standardsList.length > 0 ? obj.standardsList : ['Nursery', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];

    return res.status(200).json({ status: true, message: 'Settings updated successfully', data: obj });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};
