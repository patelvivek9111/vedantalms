const mongoose = require('mongoose');
const Attendance = require('../models/attendance.model');
const Course = require('../models/course.model');
const User = require('../models/user.model');

// Get attendance for a specific course and date
exports.getAttendance = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { date } = req.query;

    // Validate courseId
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: 'Invalid course ID format' });
    }

    if (!date) {
      return res.status(400).json({ message: 'Date parameter is required' });
    }

    // Validate date format
    const attendanceDate = new Date(date);
    if (isNaN(attendanceDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    // Get all students enrolled in the course
    const course = await Course.findById(courseId).populate('students');
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Parse the date properly (already validated above)
    attendanceDate.setHours(0, 0, 0, 0);
    const nextDate = new Date(attendanceDate);
    nextDate.setDate(nextDate.getDate() + 1);
    
    // Get attendance records for the specified date
    const attendanceRecords = await Attendance.find({
      course: courseId,
      date: {
        $gte: attendanceDate,
        $lt: nextDate
      }
    }).populate('student', 'firstName lastName email');

    // Create a map of existing attendance records
    const attendanceMap = {};
    attendanceRecords.forEach(record => {
      attendanceMap[record.student._id.toString()] = record;
    });

    // Create attendance data for all enrolled students
    const attendanceData = course.students.map(student => {
      if (!student || !student._id) return null;
      const existingRecord = attendanceMap[student._id.toString()];
      return {
        studentId: student._id,
        studentName: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
        email: student.email || '',
        status: existingRecord ? existingRecord.status : 'unmarked',
        date: date,
        timestamp: existingRecord ? existingRecord.timestamp : null,
        reason: existingRecord ? existingRecord.reason : '',
        notes: existingRecord ? existingRecord.notes : ''
      };
    }).filter(item => item !== null);

    res.json(attendanceData);
  } catch (error) {
    console.error('Error getting attendance:', error);
    res.status(500).json({ message: 'Error fetching attendance data' });
  }
};

// Save attendance for a course
exports.saveAttendance = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { date, attendanceData } = req.body;
    const userId = req.user._id || req.user.id;

    // Validate courseId
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: 'Invalid course ID format' });
    }

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    if (!date || !attendanceData || !Array.isArray(attendanceData)) {
      return res.status(400).json({ message: 'Date and attendance data are required' });
    }

    // Validate date format
    const attendanceDate = new Date(date);
    if (isNaN(attendanceDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    // Verify the course exists and user is instructor
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (course.instructor.toString() !== userId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only instructors can mark attendance' });
    }

    // Validate attendance data
    const validStatuses = ['present', 'absent', 'late', 'excused', 'unmarked'];
    for (const record of attendanceData) {
      if (!record.studentId) {
        return res.status(400).json({ message: 'Student ID is required for each attendance record' });
      }
      if (!mongoose.Types.ObjectId.isValid(record.studentId)) {
        return res.status(400).json({ message: `Invalid student ID format: ${record.studentId}` });
      }
      if (record.status && !validStatuses.includes(record.status)) {
        return res.status(400).json({ message: `Invalid status: ${record.status}. Must be one of: ${validStatuses.join(', ')}` });
      }
      // Verify student is enrolled in course
      const isEnrolled = course.students.some(s => s.toString() === record.studentId.toString());
      if (!isEnrolled) {
        return res.status(400).json({ message: `Student ${record.studentId} is not enrolled in this course` });
      }
    }

    const results = [];

    // Parse the date properly (already validated above)
    attendanceDate.setHours(0, 0, 0, 0);
    const nextDate = new Date(attendanceDate);
    nextDate.setDate(nextDate.getDate() + 1);
    
    const existingRecords = await Attendance.find({
      course: courseId,
      date: {
        $gte: attendanceDate,
        $lt: nextDate
      }
    });
    
    for (const record of attendanceData) {
      if (record.status === 'unmarked') {
        // Remove attendance record if status is unmarked
        const deleteResult = await Attendance.findOneAndDelete({
          course: courseId,
          student: record.studentId,
          date: attendanceDate
        });
        results.push({ studentId: record.studentId, status: 'unmarked' });
      } else {
        try {
          // Upsert attendance record
          const attendanceRecord = await Attendance.findOneAndUpdate(
            {
              course: courseId,
              student: record.studentId,
              date: attendanceDate
            },
            {
              status: record.status,
              timestamp: new Date(),
              markedBy: userId,
              reason: record.reason || '',
              notes: record.notes || ''
            },
            {
              upsert: true,
              new: true
            }
          );
          results.push({ studentId: record.studentId, status: attendanceRecord.status });
        } catch (upsertError) {
          console.error('Error upserting attendance record:', upsertError);
          throw upsertError;
        }
      }
    }

    res.json({ 
      message: 'Attendance saved successfully',
      results 
    });
  } catch (error) {
    console.error('Error saving attendance:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Error saving attendance data',
      error: error.message 
    });
  }
};

// Get attendance statistics for a course
exports.getAttendanceStats = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { startDate, endDate } = req.query;

    // Validate courseId
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: 'Invalid course ID format' });
    }

    const query = { course: courseId };
    if (startDate && endDate) {
      const start = new Date(startDate + 'T00:00:00.000Z');
      const end = new Date(endDate + 'T23:59:59.999Z');
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: 'Invalid date format' });
      }
      
      if (end < start) {
        return res.status(400).json({ message: 'End date must be after start date' });
      }
      
      query.date = {
        $gte: start,
        $lte: end
      };
    }

    const attendanceRecords = await Attendance.find(query).populate('student', 'firstName lastName');

    // Calculate statistics
    const stats = {
      totalRecords: attendanceRecords.length,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      unmarked: 0,
      byStudent: {}
    };

    attendanceRecords.forEach(record => {
      if (!record || !record.status) return;
      
      // Validate status is valid
      const validStatuses = ['present', 'absent', 'late', 'excused', 'unmarked'];
      if (!validStatuses.includes(record.status)) {
        return; // Skip invalid statuses
      }
      
      if (stats[record.status] !== undefined) {
        stats[record.status]++;
      }
      
      if (!record.student || !record.student._id) return;
      
      const studentId = record.student._id.toString();
      if (!stats.byStudent[studentId]) {
        stats.byStudent[studentId] = {
          name: `${record.student.firstName || ''} ${record.student.lastName || ''}`.trim(),
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          total: 0
        };
      }
      if (stats.byStudent[studentId][record.status] !== undefined) {
        stats.byStudent[studentId][record.status]++;
      }
      stats.byStudent[studentId].total++;
    });

    res.json(stats);
  } catch (error) {
    console.error('Error getting attendance stats:', error);
    res.status(500).json({ message: 'Error fetching attendance statistics' });
  }
};

// Get student's own attendance
exports.getStudentAttendance = async (req, res) => {
  try {
    const { courseId } = req.params;
    const studentId = req.user._id || req.user.id;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: 'Invalid course ID format' });
    }

    if (!studentId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Verify student is enrolled in the course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    
    const isEnrolled = course.students.some(s => s.toString() === studentId.toString());
    if (!isEnrolled) {
      return res.status(403).json({ message: 'Student not enrolled in this course' });
    }

    const attendanceRecords = await Attendance.find({
      course: courseId,
      student: studentId
    }).sort({ date: -1 });

    const attendanceData = attendanceRecords.map(record => ({
      date: record.date,
      status: record.status,
      timestamp: record.timestamp,
      reason: record.reason,
      notes: record.notes
    }));

    res.json(attendanceData);
  } catch (error) {
    console.error('Error getting student attendance:', error);
    res.status(500).json({ message: 'Error fetching student attendance' });
  }
};

// Get attendance percentages for all students in a course
exports.getAttendancePercentages = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { startDate, endDate } = req.query;

    // Validate courseId
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: 'Invalid course ID format' });
    }

    // Verify the course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Build date range query
    const dateQuery = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: 'Invalid date format' });
      }
      
      if (end < start) {
        return res.status(400).json({ message: 'End date must be after start date' });
      }
      
      dateQuery.date = {
        $gte: start,
        $lte: end
      };
    }

    // Get all attendance records for the course
    const attendanceRecords = await Attendance.find({
      course: courseId,
      ...dateQuery
    });

    // Calculate attendance percentages for each student
    const studentAttendance = {};
    
    // Initialize student data
    course.students.forEach(studentId => {
      studentAttendance[studentId.toString()] = {
        totalDays: 0,
        presentDays: 0,
        lateDays: 0,
        excusedDays: 0,
        absentDays: 0,
        percentage: 0
      };
    });

    // Count attendance by student
    attendanceRecords.forEach(record => {
      if (!record || !record.student) return;
      
      const studentId = record.student.toString();
      if (studentAttendance[studentId]) {
        studentAttendance[studentId].totalDays++;
        
        // Validate status before counting
        const validStatuses = ['present', 'absent', 'late', 'excused'];
        if (validStatuses.includes(record.status)) {
          switch (record.status) {
            case 'present':
              studentAttendance[studentId].presentDays++;
              break;
            case 'late':
              studentAttendance[studentId].lateDays++;
              break;
            case 'excused':
              studentAttendance[studentId].excusedDays++;
              break;
            case 'absent':
              studentAttendance[studentId].absentDays++;
              break;
          }
        }
      }
    });

    // Calculate percentages
    Object.keys(studentAttendance).forEach(studentId => {
      const student = studentAttendance[studentId];
      const attendedDays = student.presentDays + student.lateDays + student.excusedDays;
      // Prevent division by zero and validate result
      if (student.totalDays > 0) {
        const percentage = (attendedDays / student.totalDays) * 100;
        student.percentage = isFinite(percentage) ? Math.round(percentage) : 0;
      } else {
        student.percentage = 0;
      }
    });

    res.json(studentAttendance);
  } catch (error) {
    console.error('Error getting attendance percentages:', error);
    res.status(500).json({ message: 'Error calculating attendance percentages' });
  }
};

// Aggressive cleanup endpoint to fix database issues
exports.cleanupAttendance = async (req, res) => {
  try {
    // First, let's see what indexes exist
    const indexes = await Attendance.collection.indexes();
    
    // Remove ALL attendance records to start fresh
    const deleteResult = await Attendance.deleteMany({});
    
    // Also try to remove any records that might have null values
    const nullDeleteResult = await Attendance.deleteMany({
      $or: [
        { course: null },
        { student: null },
        { course: { $exists: false } },
        { student: { $exists: false } }
      ]
    });
    
    // Drop ALL indexes except the default _id index
    for (const index of indexes) {
      if (index.name !== '_id_') {
        try {
          await Attendance.collection.dropIndex(index.name);
        } catch (error) {
          // Silently handle index drop errors
        }
      }
    }
    
    // Also try to drop the specific problematic index
    try {
      await Attendance.collection.dropIndex('courseId_1_studentId_1_date_1');
    } catch (error) {
      // Silently handle index drop errors
    }
    
    // Try to drop any index with courseId in the name
    try {
      await Attendance.collection.dropIndex('courseId_1_studentId_1_date_1');
    } catch (error) {
      // Silently handle index drop errors
    }
    
    // Force drop all indexes and recreate
    try {
      await Attendance.collection.dropIndexes();
    } catch (error) {
      // Silently handle index drop errors
    }
    
    // Create the correct index
    await Attendance.collection.createIndex(
      { course: 1, student: 1, date: 1 }, 
      { unique: true, name: 'course_1_student_1_date_1' }
    );
    
    // Verify the new index
    const newIndexes = await Attendance.collection.indexes();
    
    res.json({
      message: 'Cleanup completed',
      deletedRecords: deleteResult.deletedCount,
      indexRecreated: true,
      oldIndexes: indexes.length,
      newIndexes: newIndexes.length
    });
  } catch (error) {
    console.error('Error in cleanup:', error);
    res.status(500).json({ message: 'Error during cleanup', error: error.message });
  }
};

// Complete collection drop and recreate endpoint
exports.fixDatabase = async (req, res) => {
  try {
    // Connect directly to the database
    const db = Attendance.db;
    const collection = db.collection('attendances');
    
    // List all indexes before dropping
    const indexes = await collection.indexes();
    
    // Drop the ENTIRE collection
    try {
      await collection.drop();
    } catch (error) {
      return res.status(500).json({ 
        message: 'Error dropping collection', 
        error: error.message 
      });
    }
    
    // Force recreate the collection with a test document
    try {
      const testDoc = {
        course: 'test',
        student: 'test',
        date: new Date(),
        status: 'test',
        timestamp: new Date(),
        markedBy: 'test',
        reason: '',
        notes: ''
      };
      
      await collection.insertOne(testDoc);
      
      // Now delete the test document
      await collection.deleteOne({ course: 'test' });
      
    } catch (error) {
      return res.status(500).json({ 
        message: 'Error recreating collection', 
        error: error.message 
      });
    }
    
    // Verify the collection is clean
    try {
      const count = await collection.countDocuments({});
      const newIndexes = await collection.indexes();
    } catch (error) {
      // Silently handle verification errors
    }
    
    res.json({
      message: 'Attendances collection completely dropped and recreated',
      indexesBefore: indexes.length,
      collectionDropped: true,
      collectionRecreated: true
    });
  } catch (error) {
    console.error('Error in direct database fix:', error);
    res.status(500).json({ message: 'Error fixing database', error: error.message });
  }
};

// Test endpoint to try saving a single attendance record
exports.testSaveAttendance = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { studentId, status, date } = req.body;
    const userId = req.user._id || req.user.id;
    
    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: 'Invalid course ID format' });
    }
    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ message: 'Invalid student ID format' });
    }
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }
    
    // Validate date format
    const attendanceDate = new Date(date);
    if (isNaN(attendanceDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }
    
    // Validate status
    const validStatuses = ['present', 'absent', 'late', 'excused', 'unmarked'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }
    
    attendanceDate.setHours(0, 0, 0, 0);
    
    // Try to save a single attendance record
    const attendanceRecord = await Attendance.findOneAndUpdate(
      {
        course: courseId,
        student: studentId,
        date: attendanceDate
      },
      {
        status: status || 'present',
        timestamp: new Date(),
        markedBy: userId,
        reason: '',
        notes: ''
      },
      {
        upsert: true,
        new: true
      }
    );
    
    res.json({
      success: true,
      record: attendanceRecord
    });
  } catch (error) {
    console.error('Error in test save:', error);
    res.status(500).json({ message: 'Error testing save', error: error.message });
  }
};

// Deep database inspection endpoint
exports.inspectDatabase = async (req, res) => {
  try {
    // Connect directly to the database
    const db = Attendance.db;
    const collection = db.collection('attendances');
    
    // List all indexes
    const indexes = await collection.indexes();
    
    // Count all documents
    const totalDocs = await collection.countDocuments({});
    
    // Find all documents
    const allDocs = await collection.find({}).toArray();
    
    // Find documents with null values
    const nullDocs = await collection.find({
      $or: [
        { course: null },
        { student: null },
        { course: { $exists: false } },
        { student: { $exists: false } }
      ]
    }).toArray();
    
    // Find documents with the old field names
    const oldFieldDocs = await collection.find({
      $or: [
        { courseId: { $exists: true } },
        { studentId: { $exists: true } }
      ]
    }).toArray();
    
    res.json({
      totalDocuments: totalDocs,
      allDocuments: allDocs,
      nullDocuments: nullDocs,
      oldFieldDocuments: oldFieldDocs,
      indexes: indexes
    });
  } catch (error) {
    console.error('Error in database inspection:', error);
    res.status(500).json({ message: 'Error inspecting database', error: error.message });
  }
};

// Test endpoint to check database state
exports.testAttendance = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { date } = req.query;
    
    // Parse the date properly
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);
    const nextDate = new Date(attendanceDate);
    nextDate.setDate(nextDate.getDate() + 1);
    
    // Get all attendance records for this course and date
    const records = await Attendance.find({
      course: courseId,
      date: {
        $gte: attendanceDate,
        $lt: nextDate
      }
    }).populate('student', 'firstName lastName email');
    
    // Also check for any problematic records with null values
    const problematicRecords = await Attendance.find({
      $or: [
        { course: null },
        { student: null }
      ]
    });
    
    res.json({
      totalRecords: records.length,
      records: records.map(record => ({
        id: record._id,
        student: record.student ? `${record.student.firstName} ${record.student.lastName}` : 'Unknown',
        status: record.status,
        date: record.date
      })),
      problematicRecords: problematicRecords.length
    });
  } catch (error) {
    console.error('Error in test attendance:', error);
    res.status(500).json({ message: 'Error testing attendance', error: error.message });
  }
}; 