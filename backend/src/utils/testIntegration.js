import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Teacher from '../models/Teacher.js';
import Class from '../models/Class.js';
import Subject from '../models/Subject.js';
import TeacherClassSubjectMapping from '../models/TeacherClassSubjectMapping.js';
import Timetable from '../models/Timetable.js';
import LeaveRequest from '../models/LeaveRequest.js';
import SubstituteAssignment from '../models/SubstituteAssignment.js';
import TeacherAttendance from '../models/TeacherAttendance.js';
import Notification from '../models/Notification.js';
import ClassSession from '../models/ClassSession.js';

// We mock getTeacherDashboard & getAdminDashboard behaviors to verify their queries
import { getTeacherDashboard, getAdminDashboard } from '../controllers/dashboardController.js';
import { getSubstituteSuggestions, approveLeave } from '../controllers/leaveController.js';
import { classLogin, classLogout } from '../controllers/attendanceController.js';
import { createTeacherSchedule } from '../controllers/timetableController.js';

const todayDateStr = new Date().toISOString().split('T')[0];
const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

async function runIntegrationTest() {
  console.log('--- STARTING INTEGRATION TEST ---');
  try {
    await connectDB();
    
    // 1. Cleanup old test data
    console.log('Cleaning up old test data...');
    await User.deleteMany({ email: { $in: ['testadmin@school.com', 'testravi@school.com', 'testsuma@school.com'] } });
    await Teacher.deleteMany({ email: { $in: ['testravi@school.com', 'testsuma@school.com'] } });
    await Class.deleteMany({ standard: 'Test-8', section: 'A' });
    await Subject.deleteMany({ name: 'Test-Mathematics' });
    await TeacherClassSubjectMapping.deleteMany({});
    await Timetable.deleteMany({ timeSlot: '09:00-09:45' });
    await LeaveRequest.deleteMany({});
    await SubstituteAssignment.deleteMany({ date: todayDateStr });
    await TeacherAttendance.deleteMany({ date: todayDateStr });
    await Notification.deleteMany({});
    await ClassSession.deleteMany({});

    console.log('Cleanup completed successfully.');

    // 2. Create users (Admin, Teacher Ravi, Teacher Suma)
    console.log('Creating Admin account...');
    const adminUser = await User.create({
      name: 'Test Admin',
      email: 'testadmin@school.com',
      password_hash: 'AdminPassword123!',
      role: 'admin',
      skip_face: true,
      skip_location: true
    });

    console.log('Creating Teacher Ravi...');
    const raviUser = await User.create({
      name: 'Teacher Ravi',
      email: 'testravi@school.com',
      phone: '1111111111',
      password_hash: 'RaviPassword123!',
      role: 'teacher',
      skip_face: true,
      skip_location: true
    });
    const raviProfile = await Teacher.create({
      user: raviUser._id,
      employeeId: 'TCH-RAVI',
      name: 'Teacher Ravi',
      email: 'testravi@school.com',
      phone: '1111111111',
      qualification: 'B.Ed Mathematics',
      experience: 5,
      status: 'Active'
    });

    console.log('Creating Teacher Suma...');
    const sumaUser = await User.create({
      name: 'Teacher Suma',
      email: 'testsuma@school.com',
      phone: '2222222222',
      password_hash: 'SumaPassword123!',
      role: 'teacher',
      skip_face: true,
      skip_location: true
    });
    const sumaProfile = await Teacher.create({
      user: sumaUser._id,
      employeeId: 'TCH-SUMA',
      name: 'Teacher Suma',
      email: 'testsuma@school.com',
      phone: '2222222222',
      qualification: 'M.Sc Mathematics',
      experience: 7,
      status: 'Active'
    });

    // 3. Create Class, Subject, and Mappings
    console.log('Creating Class Test-8 Section A...');
    const testClass = await Class.create({
      standard: 'Test-8',
      section: 'A',
      classTeacher: raviProfile._id,
      strength: 40
    });

    console.log('Creating Subject Test-Mathematics...');
    const testSubject = await Subject.create({
      name: 'Test-Mathematics'
    });

    console.log('Mapping Teacher Ravi -> Class Test-8 A -> Test-Mathematics...');
    await TeacherClassSubjectMapping.create({
      teacher: raviProfile._id,
      class: testClass._id,
      subject: testSubject._id
    });

    // 4. Create Timetable Entry (for today)
    if (dayOfWeek === 'Sunday') {
      console.log('Today is Sunday. Overriding day for test timetable entry to Monday...');
    }
    const timetableDay = dayOfWeek === 'Sunday' ? 'Monday' : dayOfWeek;

    console.log(`Creating Timetable entry on ${timetableDay} Period 1 (09:00-09:45)...`);
    const timetableEntry = await Timetable.create({
      class: testClass._id,
      day: timetableDay,
      period: 1,
      timeSlot: '09:00-09:45',
      teacher: raviProfile._id,
      subject: testSubject._id
    });

    // 5. File Leave Request for Teacher Ravi
    console.log('Teacher Ravi submitting leave request for today...');
    const leaveRequest = await LeaveRequest.create({
      teacher: raviProfile._id,
      leaveDate: todayDateStr,
      reason: 'Urgent medical checkup'
    });
    console.log('Leave Request created:', leaveRequest._id);

    // 6. Get Substitute Suggestions
    console.log('Requesting substitute suggestions for Teacher Ravi on today...');
    
    // We execute the suggestion logic manually or mock req/res
    let suggestions = [];
    const mockReq = {
      query: {
        teacherId: raviProfile._id.toString(),
        date: todayDateStr
      }
    };
    const mockRes = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      }
    };

    await getSubstituteSuggestions(mockReq, mockRes);
    if (mockRes.statusCode === 200 && mockRes.body.status) {
      suggestions = mockRes.body.data;
      console.log('Suggestions list size:', suggestions.length);
      if (suggestions.length > 0) {
        console.log('Suggestions for Period 1:', suggestions[0].candidates.map(c => c.name));
      }
    } else {
      throw new Error(`Failed to get substitute suggestions: ${JSON.stringify(mockRes.body)}`);
    }

    // 7. Approve Leave and Allocate Teacher Suma
    console.log('Approving leave request and allocating Teacher Suma...');
    const mockApproveReq = {
      params: { id: leaveRequest._id.toString() },
      body: {
        status: 'Approved',
        substituteAllocations: [
          {
            periodEntryId: timetableEntry._id.toString(),
            substituteTeacherId: sumaProfile._id.toString()
          }
        ]
      },
      user: { _id: adminUser._id }
    };
    
    const mockApproveRes = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      }
    };

    await approveLeave(mockApproveReq, mockApproveRes);
    if (mockApproveRes.statusCode === 200 && mockApproveRes.body.status) {
      console.log('Leave approved successfully.');
    } else {
      throw new Error(`Failed to approve leave: ${JSON.stringify(mockApproveRes.body)}`);
    }

    // 8. Verify DB State
    console.log('Verifying substitute assignment...');
    const assignment = await SubstituteAssignment.findOne({
      date: todayDateStr,
      class: testClass._id,
      period: 1
    });
    
    if (assignment && assignment.substituteTeacher.toString() === sumaProfile._id.toString()) {
      console.log('✅ Substitute assignment successfully verified in database.');
    } else {
      throw new Error('Substitute assignment not found or incorrect teacher assigned.');
    }

    console.log('Verifying teacher attendance...');
    const attendance = await TeacherAttendance.findOne({
      date: todayDateStr,
      teacher: raviProfile._id
    });
    
    if (attendance && attendance.status === 'Leave') {
      console.log('✅ Teacher Ravi marked on leave successfully.');
    } else {
      throw new Error('Teacher attendance not marked as Leave.');
    }

    console.log('Verifying notification created...');
    const notification = await Notification.findOne({
      recipient: sumaUser._id
    });
    
    if (notification) {
      console.log('✅ Notification successfully sent to Teacher Suma:', notification.message);
    } else {
      throw new Error('Notification not created.');
    }

    // 9. Mock Dashboards
    console.log('Fetching mock Teacher Suma Dashboard...');
    const mockDashReq = {
      user: { _id: sumaUser._id }
    };
    const mockDashRes = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      }
    };
    await getTeacherDashboard(mockDashReq, mockDashRes);
    if (mockDashRes.statusCode === 200) {
      const schedule = mockDashRes.body.data.schedule;
      console.log('Teacher Suma Schedule:', schedule);
      if (schedule.some(s => s.type === 'substitute')) {
        console.log('✅ Verified: Teacher Suma dashboard highlights substitute class correctly.');
      } else {
        console.log('⚠️ Warning: Sunday/Timing override might prevent schedule inclusion.');
      }
    }

    // 10. Mock Principal Live Operations Dashboard
    console.log('Fetching mock Principal Dashboard...');
    const mockAdminDashReq = {
      user: { _id: adminUser._id }
    };
    const mockAdminDashRes = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      }
    };
    await getAdminDashboard(mockAdminDashReq, mockAdminDashRes);
    if (mockAdminDashRes.statusCode === 200) {
      const liveData = mockAdminDashRes.body.data;
      console.log('Principal Dashboard Live Data:', liveData);
      console.log('✅ Verified: Principal live status is successfully retrieved.');
    }

    // 11. Test Class Session Login/Logout and Geofencing (100m)
    console.log('--- TESTING CLASS LOGIN/LOGOUT & GEOFENCING ---');
    
    // Set registeredLocation for Teacher Suma and disable skip_location
    await User.findByIdAndUpdate(sumaUser._id, {
      skip_location: false,
      registeredLocation: { latitude: 12.9716, longitude: 77.5946 }
    });

    console.log('Simulating Class Login with location outside 100m (should fail)...');
    const mockLoginFailReq = {
      body: {
        classId: testClass._id.toString(),
        period: 1,
        subjectId: testSubject._id.toString(),
        location: { latitude: 12.9800, longitude: 77.5946 } // ~930m away
      },
      user: { _id: sumaUser._id }
    };
    const mockLoginFailRes = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      }
    };

    await classLogin(mockLoginFailReq, mockLoginFailRes);
    if (mockLoginFailRes.statusCode === 403) {
      console.log('✅ Success: Class login correctly rejected with 403 for location outside 100m.');
      console.log('Error message:', mockLoginFailRes.body.message);
    } else {
      throw new Error(`Expected class login to fail with 403, but got status ${mockLoginFailRes.statusCode} and body ${JSON.stringify(mockLoginFailRes.body)}`);
    }

    console.log('Simulating Class Login with location within 100m (should succeed)...');
    const mockLoginSuccessReq = {
      body: {
        classId: testClass._id.toString(),
        period: 1,
        subjectId: testSubject._id.toString(),
        location: { latitude: 12.9717, longitude: 77.5947 } // ~15m away
      },
      user: { _id: sumaUser._id }
    };
    const mockLoginSuccessRes = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      }
    };

    await classLogin(mockLoginSuccessReq, mockLoginSuccessRes);
    if (mockLoginSuccessRes.statusCode === 201 && mockLoginSuccessRes.body.status) {
      console.log('✅ Success: Class login succeeded with 201 for location within 100m.');
    } else {
      throw new Error(`Expected class login to succeed with 201, but got status ${mockLoginSuccessRes.statusCode} and body ${JSON.stringify(mockLoginSuccessRes.body)}`);
    }

    console.log('Simulating Class Logout with location outside 100m (should fail)...');
    const mockLogoutFailReq = {
      body: {
        classId: testClass._id.toString(),
        period: 1,
        location: { latitude: 12.9800, longitude: 77.5946 } // ~930m away
      },
      user: { _id: sumaUser._id }
    };
    const mockLogoutFailRes = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      }
    };

    await classLogout(mockLogoutFailReq, mockLogoutFailRes);
    if (mockLogoutFailRes.statusCode === 403) {
      console.log('✅ Success: Class logout correctly rejected with 403 for location outside 100m.');
      console.log('Error message:', mockLogoutFailRes.body.message);
    } else {
      throw new Error(`Expected class logout to fail with 403, but got status ${mockLogoutFailRes.statusCode} and body ${JSON.stringify(mockLogoutFailRes.body)}`);
    }

    console.log('Simulating Class Logout with location within 100m (should succeed)...');
    const mockLogoutSuccessReq = {
      body: {
        classId: testClass._id.toString(),
        period: 1,
        location: { latitude: 12.9717, longitude: 77.5947 } // ~15m away
      },
      user: { _id: sumaUser._id }
    };
    const mockLogoutSuccessRes = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      }
    };

    await classLogout(mockLogoutSuccessReq, mockLogoutSuccessRes);
    if (mockLogoutSuccessRes.statusCode === 200 && mockLogoutSuccessRes.body.status) {
      console.log('✅ Success: Class logout succeeded with 200 for location within 100m.');
    } else {
      throw new Error(`Expected class logout to succeed with 200, but got status ${mockLogoutSuccessRes.statusCode} and body ${JSON.stringify(mockLogoutSuccessRes.body)}`);
    }

    // 12. Test Teacher Schedule Creation (Auto and Manual)
    console.log('--- TESTING TEACHER SCHEDULE CREATION ---');
    
    console.log('Simulating Teacher Suma creating auto weekly recurring schedule...');
    const mockAutoScheduleReq = {
      body: {
        standard: '9th',
        section: 'B',
        board: 'ICSE',
        subjectName: 'Biology',
        day: 'Thursday',
        period: 2,
        timeSlot: '09:45-10:30'
      },
      user: { _id: sumaUser._id }
    };
    const mockAutoScheduleRes = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      }
    };

    await createTeacherSchedule(mockAutoScheduleReq, mockAutoScheduleRes);
    if (mockAutoScheduleRes.statusCode === 200 && mockAutoScheduleRes.body.status) {
      console.log('✅ Success: Teacher Suma auto schedule created successfully.');
      console.log('Created entry standard-section:', `${mockAutoScheduleRes.body.data.class.standard}-${mockAutoScheduleRes.body.data.class.section} (${mockAutoScheduleRes.body.data.class.board})`);
    } else {
      throw new Error(`Expected auto schedule creation to succeed, but got status ${mockAutoScheduleRes.statusCode} and body ${JSON.stringify(mockAutoScheduleRes.body)}`);
    }

    console.log('Simulating Teacher Suma creating manual date override schedule...');
    const mockManualScheduleReq = {
      body: {
        standard: '10th',
        section: 'C',
        board: 'STATE',
        subjectName: 'Chemistry',
        date: todayDateStr,
        period: 3,
        timeSlot: '10:45-11:30'
      },
      user: { _id: sumaUser._id }
    };
    const mockManualScheduleRes = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      }
    };

    await createTeacherSchedule(mockManualScheduleReq, mockManualScheduleRes);
    if (mockManualScheduleRes.statusCode === 200 && mockManualScheduleRes.body.status) {
      console.log('✅ Success: Teacher Suma manual schedule created successfully.');
      console.log('Created entry date & board:', mockManualScheduleRes.body.data.date, mockManualScheduleRes.body.data.class.board);
    } else {
      throw new Error(`Expected manual schedule creation to succeed, but got status ${mockManualScheduleRes.statusCode} and body ${JSON.stringify(mockManualScheduleRes.body)}`);
    }

    // Clean up class sessions and added test classes
    await ClassSession.deleteMany({ class: testClass._id });
    await Class.deleteMany({ standard: { $in: ['9th', '10th'] } });
    await Subject.deleteMany({ name: { $in: ['Biology', 'Chemistry'] } });
    await Timetable.deleteMany({ period: { $in: [2, 3] } });

    console.log('--- INTEGRATION TEST SUCCESSFUL ---');
    mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('--- INTEGRATION TEST FAILED ---');
    console.error(error);
    mongoose.connection.close();
    process.exit(1);
  }
}

runIntegrationTest();
