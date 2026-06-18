import mongoose from 'mongoose';

const MONGODB_URL = 'mongodb://localhost:27017/face_auth_db';

const checkDb = async () => {
  try {
    await mongoose.connect(MONGODB_URL);
    console.log('Connected to MongoDB');

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections in database:');
    for (const coll of collections) {
      const count = await mongoose.connection.db.collection(coll.name).countDocuments();
      console.log(` - ${coll.name}: ${count} documents`);
    }

    const Timetable = mongoose.model('Timetable', new mongoose.Schema({}, { strict: false }));
    const classCount = await mongoose.model('Class', new mongoose.Schema({}, { strict: false })).countDocuments();
    const timetableCount = await Timetable.countDocuments();
    const teacherCount = await mongoose.model('Teacher', new mongoose.Schema({}, { strict: false })).countDocuments();
    console.log(`Classes: ${classCount}, Timetable: ${timetableCount}, Teachers: ${teacherCount}`);

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
};

checkDb();
