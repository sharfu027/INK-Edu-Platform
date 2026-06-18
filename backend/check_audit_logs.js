import mongoose from 'mongoose';

const MONGODB_URL = 'mongodb://localhost:27017/face_auth_db';

const checkLogs = async () => {
  try {
    await mongoose.connect(MONGODB_URL);
    console.log('Connected to MongoDB');

    const AuditLogs = mongoose.model('AuditLogs', new mongoose.Schema({}, { strict: false }), 'AuditLogs');
    const ClassAuditLog = mongoose.model('ClassAuditLog', new mongoose.Schema({}, { strict: false }), 'classauditlogs');

    const logs = await AuditLogs.find().sort({ createdAt: -1 }).limit(10);
    console.log('Last 10 Audit Logs (from AuditLogs):');
    console.log(JSON.stringify(logs, null, 2));

    const classLogs = await ClassAuditLog.find().sort({ createdAt: -1 }).limit(10);
    console.log('\nLast 10 ClassAuditLog:');
    console.log(JSON.stringify(classLogs, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};

checkLogs();
