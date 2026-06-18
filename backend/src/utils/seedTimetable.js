import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Setup environment
dotenv.config();

import connectDB from '../config/db.js';
import User from '../models/User.js';
import Teacher from '../models/Teacher.js';
import Class from '../models/Class.js';
import Subject from '../models/Subject.js';
import TeacherClassSubjectMapping from '../models/TeacherClassSubjectMapping.js';
import Timetable from '../models/Timetable.js';
import ClassStatus from '../models/ClassStatus.js';
import AuditLogs from '../models/AuditLogs.js';

const TEACHERS_DATA = [
  { name: 'Amit Sharma', email: 'amit.sharma@school.com', department: 'Science', employeeId: 'TCH-001', qualification: 'B.Sc, B.Ed', experience: 5 },
  { name: 'Priya Patel', email: 'priya.patel@school.com', department: 'Mathematics', employeeId: 'TCH-002', qualification: 'M.Sc, B.Ed', experience: 8 },
  { name: 'Rajesh Verma', email: 'rajesh.verma@school.com', department: 'English', employeeId: 'TCH-003', qualification: 'M.A, English', experience: 6 },
  { name: 'Sunita Rao', email: 'sunita.rao@school.com', department: 'Social Studies', employeeId: 'TCH-004', qualification: 'M.A, B.Ed', experience: 10 },
  { name: 'Vikram Singh', email: 'vikram.singh@school.com', department: 'Science', employeeId: 'TCH-005', qualification: 'M.Sc, Physics', experience: 4 },
  { name: 'Deepa Nair', email: 'deepa.nair@school.com', department: 'Mathematics', employeeId: 'TCH-006', qualification: 'B.Sc, Mathematics', experience: 3 },
  { name: 'Anil Gupta', email: 'anil.gupta@school.com', department: 'Computer Science', employeeId: 'TCH-007', qualification: 'MCA', experience: 7 },
  { name: 'Kavita Joshi', email: 'kavita.joshi@school.com', department: 'Hindi', employeeId: 'TCH-008', qualification: 'B.A, Hindi Literature', experience: 5 },
  { name: 'Suresh Kumar', email: 'suresh.kumar@school.com', department: 'Physical Education', employeeId: 'TCH-009', qualification: 'B.P.Ed', experience: 9 },
  { name: 'Meera Deshmukh', email: 'meera.deshmukh@school.com', department: 'Art', employeeId: 'TCH-010', qualification: 'BFA', experience: 6 }
];

const SUBJECTS_DATA = [
  'Mathematics',
  'Science',
  'English',
  'Social Studies',
  'Computer Science',
  'Hindi'
];

const STANDARDS = ['6', '7', '8', '9', '10'];
const SECTIONS = ['A', 'B', 'C', 'D'];

const TIME_SLOTS = {
  1: { start: '09:00', end: '09:45' },
  2: { start: '09:45', end: '10:30' },
  3: { start: '10:45', end: '11:30' },
  4: { start: '11:30', end: '12:15' },
  5: { start: '13:00', end: '13:45' },
  6: { start: '13:45', end: '14:30' },
  7: { start: '14:45', end: '15:30' },
  8: { start: '15:30', end: '16:15' }
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function seed() {
  try {
    console.log('Connecting to database...');
    await connectDB();

    console.log('Cleaning up existing data...');
    // Delete existing teachers and associated users
    const teacherEmails = TEACHERS_DATA.map(t => t.email);
    await User.deleteMany({ email: { $in: teacherEmails } });
    await Teacher.deleteMany({ email: { $in: teacherEmails } });

    // Delete existing classes, subjects, mappings, and timetables
    await Class.deleteMany({});
    await Subject.deleteMany({});
    await TeacherClassSubjectMapping.deleteMany({});
    await Timetable.deleteMany({});
    await ClassStatus.deleteMany({});
    await AuditLogs.deleteMany({});

    console.log('Seeding subjects...');
    const subjectsMap = {};
    for (const subName of SUBJECTS_DATA) {
      const subject = await Subject.create({ name: subName });
      subjectsMap[subName] = subject;
    }
    console.log(`Seeded ${Object.keys(subjectsMap).length} subjects.`);

    console.log('Seeding teachers and users...');
    const teachersList = [];
    for (const tData of TEACHERS_DATA) {
      const user = await User.create({
        name: tData.name,
        email: tData.email,
        phone: '98765' + tData.employeeId.replace('TCH-', ''), // dummy phone number
        password_hash: 'Teacher123!',
        role: 'teacher',
        skip_face: true,
        skip_location: true,
        isActive: true
      });

      const teacher = await Teacher.create({
        user: user._id,
        employeeId: tData.employeeId,
        name: tData.name,
        email: tData.email,
        phone: user.phone,
        qualification: tData.qualification,
        experience: tData.experience,
        status: 'Active',
        department: tData.department
      });

      teachersList.push(teacher);
    }
    console.log(`Seeded ${teachersList.length} teachers.`);

    console.log('Seeding 20 classes...');
    const classesList = [];
    let teacherIdx = 0;
    for (const std of STANDARDS) {
      for (const sec of SECTIONS) {
        // Assign a class teacher sequentially
        const classTeacher = teachersList[teacherIdx % teachersList.length]._id;
        teacherIdx++;

        const cls = await Class.create({
          standard: std,
          section: sec,
          board: 'CBSE',
          classTeacher: classTeacher,
          strength: Math.floor(Math.random() * 10) + 35 // 35 to 45
        });
        classesList.push(cls);
      }
    }
    console.log(`Seeded ${classesList.length} classes.`);

    console.log('Seeding Teacher-Class-Subject Mappings...');
    // Create random mappings
    const mappingsList = [];
    for (const cls of classesList) {
      // Map at least 3 subjects to each class with different teachers
      const shuffledSubjects = Object.values(subjectsMap).sort(() => 0.5 - Math.random());
      const selectedSubjects = shuffledSubjects.slice(0, 4);

      for (let i = 0; i < selectedSubjects.length; i++) {
        const sub = selectedSubjects[i];
        // Select a teacher from department or general
        const teacher = teachersList[(cls.standard.charCodeAt(0) + i) % teachersList.length];

        const mapping = await TeacherClassSubjectMapping.create({
          teacher: teacher._id,
          class: cls._id,
          subject: sub._id
        });
        mappingsList.push(mapping);
      }
    }
    console.log(`Seeded ${mappingsList.length} teacher-class-subject mappings.`);

    console.log('Seeding weekly timetable entries...');
    // We will generate timetable entries for each class, day, and period
    let timetableEntriesCount = 0;

    for (const cls of classesList) {
      // Find mappings for this class to know which teachers teach which subjects
      const classMappings = mappingsList.filter(m => m.class.toString() === cls._id.toString());
      if (classMappings.length === 0) continue;

      for (const day of DAYS) {
        // Schedule 3-5 periods per day for this class
        const periodsToSchedule = [1, 2, 3, 4, 5, 6].sort(() => 0.5 - Math.random()).slice(0, 4);

        for (let i = 0; i < periodsToSchedule.length; i++) {
          const period = periodsToSchedule[i];
          const mapping = classMappings[i % classMappings.length];
          const timeSlotData = TIME_SLOTS[period];

          await Timetable.create({
            class: cls._id,
            day: day,
            period: period,
            startTime: timeSlotData.start,
            endTime: timeSlotData.end,
            teacher: mapping.teacher,
            subject: mapping.subject
          });
          timetableEntriesCount++;
        }
      }
    }

    console.log(`Seeded ${timetableEntriesCount} timetable entries.`);
    console.log('--- SEEDING COMPLETED SUCCESSFULY ---');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed with error:', error);
    process.exit(1);
  }
}

seed();
