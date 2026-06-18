import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

import connectDB from '../config/db.js';
import Class from '../models/Class.js';
import TeacherClassSubjectMapping from '../models/TeacherClassSubjectMapping.js';
import ClassSession from '../models/ClassSession.js';

async function test() {
  await connectDB();
  const classes = await Class.find().lean();
  const mappings = await TeacherClassSubjectMapping.find().lean();
  const sessions = await ClassSession.find().lean();

  console.log('Total Classes in DB:', classes.length);
  console.log('Total Mappings in DB:', mappings.length);
  console.log('Total Class Sessions in DB:', sessions.length);
  process.exit(0);
}
test();
