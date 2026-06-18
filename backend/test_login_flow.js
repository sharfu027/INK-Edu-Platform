import mongoose from 'mongoose';
import ClassSession from './src/models/ClassSession.js';
import Class from './src/models/Class.js';
import TeacherClassSubjectMapping from './src/models/TeacherClassSubjectMapping.js';
import Teacher from './src/models/Teacher.js';
import Subject from './src/models/Subject.js';
import { getClassStatus } from './src/controllers/dashboardController.js';

const MONGODB_URL = 'mongodb://localhost:27017/face_auth_db';

const testFlow = async () => {
  try {
    await mongoose.connect(MONGODB_URL);
    console.log('Connected to MongoDB');

    // 1. Get a class and its mapping
    const cls = await Class.findOne().lean();
    if (!cls) {
      console.log('No classes found');
      return;
    }
    console.log('Found Class:', cls.standard, cls.section, 'ID:', cls._id);

    const mapping = await TeacherClassSubjectMapping.findOne({ class: cls._id })
      .populate('teacher')
      .populate('subject')
      .lean();
    if (!mapping) {
      console.log('No mappings found for class');
      return;
    }
    console.log('Found Mapping:', mapping.subject?.name, 'Teacher:', mapping.teacher?.name);

    // 2. Clear any existing sessions for today for this class
    const todayStr = new Date().toISOString().split('T')[0];
    await ClassSession.deleteMany({ class: cls._id, date: todayStr });
    console.log('Cleared existing sessions for today');

    // 3. Create active session (simulating login)
    const session = await ClassSession.create({
      class: cls._id,
      period: 1,
      teacher: mapping.teacher._id,
      subject: mapping.subject._id,
      date: todayStr,
      loginTime: new Date(),
      status: 'active'
    });
    console.log('Created active class session:', session._id);

    // 4. Test getClassStatus controller output
    const req = {
      query: { date: todayStr, classId: 'All', teacherId: 'All', subjectId: 'All' }
    };
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        console.log('\n--- getClassStatus Result ---');
        const item = data.data.find(c => c.classId === cls._id.toString());
        console.log(JSON.stringify(item, null, 2));
      }
    };

    await getClassStatus(req, res);

    await mongoose.disconnect();
    console.log('Disconnected');
  } catch (err) {
    console.error('Error:', err);
  }
};

testFlow();
