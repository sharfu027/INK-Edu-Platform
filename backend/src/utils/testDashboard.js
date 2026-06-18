import dotenv from 'dotenv';
dotenv.config();

import connectDB from '../config/db.js';
import { getClassStatus, getMonitoringStats } from '../controllers/dashboardController.js';

async function test() {
  await connectDB();
  
  const req = {
    query: {
      date: '2026-06-17',
      classId: 'All',
      teacherId: 'All',
      subjectId: 'All'
    }
  };

  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      console.log('Response status code:', this.statusCode);
      console.log('Response body data length:', data.data?.length);
      if (data.data && data.data.length > 0) {
        console.log('Sample record:', JSON.stringify(data.data[0], null, 2));
      } else {
        console.log('Response data is empty. Response body:', JSON.stringify(data, null, 2));
      }
    }
  };

  console.log('Running getClassStatus test...');
  await getClassStatus(req, res);

  const statsRes = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      console.log('Stats Response:', JSON.stringify(data, null, 2));
    }
  };

  console.log('Running getMonitoringStats test...');
  await getMonitoringStats(req, statsRes);

  process.exit(0);
}
test();
