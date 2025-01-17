// const bcrypt = require("bcrypt");
const Student = require("../models/studentSchema.js");
const Subject = require("../models/subjectSchema.js");
const Admin = require("../models/adminSchema.js");
const Sclass = require("../models/sclassSchema.js");
const { ApiError } = require("../utils/ApiError.js");
const { ApiResponse } = require("../utils/ApiResponse.js");
const Teacher = require("../models/teacherSchema.js");
const markAttendanceService = require("../service/markAttendanceService.js");
const AccessKey = require("../models/accessKeySchema.js");
const newStudent = require("../models/newStudentSchema.js");
const School = require("../models/schoolSchema.js")
const studentRegister = async (req, res, next) => {
  try {
    const {
      name,
      rollNum,
      gender,
      address,
      phoneNo,
      adharNo,
      sclassName,
      section,
      extraActivity,
      fatherName,
      motherName,
      fatherPhoneNo,
      motherPhoneNo,
      occupation,
      achievements,
    } = req.body;

    const admin = await Admin.findById(req.params.id)
      .select("-password -refreshToken");

    if (!admin) {
      throw new ApiError(404, "No admin found");
    }
    // Fetch the associated school
    const school = await School.findById(admin.school);
    console.log(school._id);
    //console.log("Request Body:", req.body);

    // Find the class based on sclassName and section
    const sclass = await Sclass.findOne({
      sclassName: sclassName,
      section: section,
      school: school._id,
    });

    if (!sclass) {
      throw new ApiError(404, "Class not found");
    }

    // Check if the student already exists
    const existedstudent = await Student.findOne({ adharNo: adharNo });
    if (!existedstudent) {
      // Create the student object
      const student = new Student({
        name,
        rollNum,
        gender,
        address,
        phoneNo,
        adharNo,
        sclassName: sclass._id,
        school: school._id,
        parentDetails: {
          fatherName,
          motherName,
          fatherPhoneNo,
          motherPhoneNo,
          occupation,
        },
        extraActivity,
        achievements,
      });

      // Save the student to the database
      await student.save();

      // Populate the response
      const populatedStudent = await Student.findById(student._id)
        .populate("sclassName")
        .populate("school")
        .exec();

      res
        .status(201)
        .json(
          new ApiResponse(
            201,
            populatedStudent,
            "Student registered successfully"
          )
        );
    } else {
      throw new ApiError(400, "Student already registered");
    }
  } catch (err) {
    console.error("Error in student registration:", err); // Log error details
    return res
      .status(err.statusCode || 500)
      .json(
        new ApiResponse(
          err.statusCode || 500,
          null,
          err.message || "Server error"
        )
      );
  }
};

const getStudentById = async (req, res, next) => {
  try {
    const studentId = req.params.id;

    // Find student by ID and populate relevant fields
    const student = await Student.findById(studentId)
      .populate({
        path: "sclassName",
        populate: {
          path: "subjects",
        },
      })
      .populate({
        path: "school",
      })
      .populate({
        path: "examResult.subName",
        select: "subName subCode",
      })
      .populate({
        path: "attendance.subName",
        select: "subName subCode",
      })
      .exec();

    if (!student) {
      // return res.status(404).json({ message: "Student not found" });
      throw new ApiError(404, "Student not found");
    }

    // Respond with student details
    // res.status(200).json({
    //   message: "Student details retrieved successfully",
    //   student,
    // });
    res
      .status(200)
      .json(
        new ApiResponse(200, student, "Student details retrieved successfully ")
      );
  } catch (error) {
    return res
      .status(500)
      .json(
        new ApiResponse(
          error.statusCode || 500,
          null,
          error.message || "Internal Server Error"
        )
      );
  }
};

const getStudentsByClassAndSection = async (req, res, next) => {
  try {
    const { sclassName, section } = req.body;
    const schoolId = req.params.schoolid; // Assuming the school ID is passed as a query parameter

    // Find the class by sclassName and section
    const sclass = await Sclass.findOne({
      sclassName: sclassName,
      section: section,
      school: schoolId,
    });

    if (!sclass) {
      // return res.status(404).json({ message: "Class not found" });
      throw new ApiError(404, "Class not found");
    }

    // Find all students in the found class
    const students = await Student.find({
      sclassName: sclass._id,
    })
      .populate({
        path: "sclassName",
        select: "sclassName section",
      })
      .populate({
        path: "school",
      });

    if (students.length === 0) {
      // return res
      //   .status(404)
      //   .json({ message: "No students found for this class and section" });
      throw new ApiResponse(
        404,
        "No students found for this class and section"
      );
    }

    // Respond with the list of students
    // res.status(200).json({
    //   message: "Students retrieved successfully",
    //   students,
    // });

    res
      .status(200)
      .json(new ApiResponse(200, students, "Students retrieve successfully"));
  } catch (error) {
    return res
      .status(500)
      .json(
        new ApiResponse(
          error.statusCode || 500,
          null,
          error.message || "Internal Server Error"
        )
      );
  }
};
const addStudentAchievement = async (req, res, next) => {
  try {
    const studentId = req.params.studentId; // Retrieve studentId from params
    const { achievement } = req.body; // Expect a single achievement object

    if (!achievement) {
      // return res.status(400).json({ message: "Achievement is required" });
      throw new ApiError(400, "Achievement is required");
    }

    const { achievementsField, competitionName, position } = achievement;

    // Find the student by ID
    const student = await Student.findById(studentId);

    if (!student) {
      // return res.status(404).json({ message: "Student not found" });
      throw new ApiError(404, "Student not found");
    }

    // Check for existing achievements
    const existingAchievements = student.achievements.map(
      (ach) => `${ach.achievementsField}-${ach.competitionName}-${ach.position}` // Unique key for comparison
    );

    // Check if the new achievement already exists
    const newAchievementKey = `${achievementsField}-${competitionName}-${position}`;
    if (existingAchievements.includes(newAchievementKey)) {
      // return res.status(400).json({ message: "Achievement already exists" });
      throw new ApiError(400, "Achievement already exists");
    }

    // Add the new achievement to the student
    student.achievements.push({
      achievementsField,
      competitionName,
      position,
    });

    await student.save();

    // Respond with the updated student details
    // res.status(200).json({
    //   message: "Achievement added successfully",
    //   student: {
    //     _id: student._id,
    //     name: student.name,
    //     rollNum: student.rollNum,
    //     achievements: student.achievements,
    //   },
    // });

    res.status(200).json(
      new ApiResponse(
        200,
        {
          _id: student._id,
          name: student.name,
          rollNum: student.rollNum,
          achievements: student.achievements,
        },
        "Achievement added successfully"
      )
    );
  } catch (error) {
    return res
      .status(500)
      .json(
        new ApiResponse(
          error.statusCode || 500,
          null,
          error.message || "Internal Server Error"
        )
      );
  }
};

const markAttendance = async (req, res, next) => {
  try {
    const { teacherId, presentStudentIds, className, section, date } = req.body;

    // Validate input
    if (!teacherId || !presentStudentIds || !className || !section || !date) {
      // return res.status(400).json({ message: "All fields are required" });
      throw new ApiError(400, "All field are required");
    }

    // Validate presentStudentIds as an array
    if (!Array.isArray(presentStudentIds)) {
      // return res
      //   .status(400)
      //   .json({ message: "Present student IDs must be an array" });
      throw new ApiError(400, "Present student IDs must be an array");
    }

    // Find the teacher and ensure they have the correct role
    const teacher = await Teacher.findById(teacherId)
      .populate("teachSclass")
      .populate("teachSubject");
    // if (!teacher || teacher.positionrole !== "Class Teacher") {
    //   // return res.status(403).json({ message: "Unauthorized" });
    //   throw new ApiError(403, "Unauthorized");
    // }

    // Find the class
    const studentClass = await Sclass.findOne({
      sclassName: className,
      section: section,
    });

    if (!studentClass) {
      // return res.status(404).json({ message: "Class not found" });
      throw new ApiError(404, "Class not found");
    }

    // Check if teacher's class matches
    console.log(teacher);
    console.log(teacher.teachSclass.sclassName);
    console.log(teacher.teachSclass.section);

    if (
      teacher.teachSclass.sclassName !== className ||
      teacher.teachSclass.section != section
    ) {
      // return res
      //   .status(403)
      //   .json({ message: "Teacher does not teach this class" });
      throw new ApiError(403, "Teacher does not teach this class");
    }

    // Find students in the specified class and section
    console.log(studentClass._id.toString());
    const students = await Student.find({
      sclassName: studentClass._id.toString(),
    });

    if (students.length === 0) {
      // return res
      // .status(404)
      // .json({ message: "No students found for this class and section" });
      throw new ApiError(404, "No students found for this class and section ");
    }

    // Create a map for quick lookup of present students
    const presentStudentMap = new Set(presentStudentIds);

    // Update attendance records for each student
    for (const student of students) {
      const status = presentStudentMap.has(student._id.toString())
        ? "Present"
        : "Absent";

      // Check if attendance for the same date and subject already exists
      const existingAttendance = student.attendance.find(
        (att) =>
          att.date.toISOString() === new Date(date).toISOString() &&
          att.subName.toString() === teacher.teachSubject._id.toString()
      );

      if (!existingAttendance) {
        student.attendance.push({
          date: new Date(date),
          status,
          subName: teacher.teachSubject._id, // Assuming teacher.teachSubject is used to record subject attendance
        });
        await student.save();
      }
    }

    // Respond with success message
    // res.status(200).json({
    //   message: "Attendance marked successfully",
    // });
    res
      .status(200)
      .json(new ApiResponse(200, null, "Attendance marked successfully"));
  } catch (error) {
    return res
      .status(500)
      .json(
        new ApiResponse(
          error.statusCode || 500,
          null,
          error.message || "Internal Server Error"
        )
      );
  }
};
const getStudentAttendance = async (req, res, next) => {
  try {
    const { studentId, month, year } = req.query;

    // Validate input
    if (!studentId || !month || !year) {
      // return res
      //   .status(400)
      //   .json({ message: "Student ID, month, and year are required" });

      throw new ApiError(400, "Status ID, month and year are required");
    }

    // Validate month and year as numbers
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    if (
      isNaN(monthNum) ||
      isNaN(yearNum) ||
      monthNum < 1 ||
      monthNum > 12 ||
      yearNum < 1900
    ) {
      // return res.status(400).json({ message: "Invalid month or year" });
      throw new ApiError(400, "Invalid month or year");
    }

    // Find the student
    const student = await Student.findById(studentId).populate(
      "attendance.subName"
    );
    if (!student) {
      // return res.status(404).json({ message: "Student not found" });
      throw new ApiError(404, "Student not found");
    }

    // Filter attendance records by the given month and year
    const attendanceRecords = student.attendance.filter((att) => {
      const attDate = new Date(att.date);
      return (
        attDate.getMonth() + 1 === monthNum && attDate.getFullYear() === yearNum
      );
    });

    // Respond with the attendance records
    // res.status(200).json({
    //   message: "Attendance records fetched successfully",
    //   attendanceRecords,
    // });
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          attendanceRecords,
          "Attendance records fetched successfully"
        )
      );
  } catch (error) {
    return res
      .status(500)
      .json(
        new ApiResponse(
          error.statusCode || 500,
          null,
          error.message || "Internal Server Error"
        )
      );
  }
};

const markAttendanceWithAccessKey = async (req, res, next) => {
  try {
    const { accessKey, presentStudentIds, date } = req.body;

    // Validate input
    if (!accessKey || !presentStudentIds || !date) {
      // return res.status(400).json({ message: "All fields are required" });
      throw new ApiError(400, "All fields are required");
    }

    // Validate presentStudentIds as an array
    if (!Array.isArray(presentStudentIds)) {
      // return res
      //   .status(400)
      //   .json({ message: "Present student IDs must be an array" });
      throw new ApiError(400, "Present student IDs must be an array");
    }

    // Find the teacher with the access key
    const teacher = await Teacher.findOne({
      "tempSchedule.accessKey": accessKey,
    })
      .populate("tempSchedule.className")
      .populate("tempSchedule.subject");

    if (!teacher) {
      // return res.status(404).json({ message: "Invalid access key" });
      throw new ApiError(404, "Invalid access key");
    }

    const tempSchedule = teacher.tempSchedule.find(
      (ts) => ts.accessKey === accessKey
    );

    // Compare only the date part (ignore time)
    const scheduleDate = new Date(tempSchedule.date)
      .toISOString()
      .split("T")[0];
    const requestDate = new Date(date).toISOString().split("T")[0];

    if (scheduleDate !== requestDate) {
      console.log("Scheduled Date:", scheduleDate);
      console.log("Request Date:", requestDate);
      // return res.status(400).json({ message: "Invalid date" });
      throw new ApiError(400, "Invalid date");
    }

    // Find the class
    const studentClass = await Sclass.findById(tempSchedule.className._id);

    if (!studentClass) {
      // return res.status(404).json({ message: "Class not found" });
      throw new ApiError(404, "Class not found");
    }
    console.log(`Class id is ${tempSchedule.className._id}`);
    console.log(`school id is ${tempSchedule.className.school}`);
    // Find students in the specified class and section
    const students = await Student.find({
      sclassName: tempSchedule.className._id.toString(),
      school: tempSchedule.className.school.toString(), // Ensure section is included
    });

    if (students.length === 0) {
      // return res
      //   .status(404)
      //   .json({ message: "No students found for this class and section" });
      throw new ApiError(404, "No students found for this class and section");
    }

    // Create a map for quick lookup of present students
    const presentStudentMap = new Set(presentStudentIds);

    // Update attendance records for each student
    for (const student of students) {
      const status = presentStudentMap.has(student._id.toString())
        ? "Present"
        : "Absent";

      // Check if attendance for the same date and subject already exists
      const existingAttendance = student.attendance.find(
        (att) =>
          att.date.toISOString().split("T")[0] === requestDate &&
          att.subName.toString() === tempSchedule.subject.toString()
      );

      if (!existingAttendance) {
        student.attendance.push({
          date: new Date(date),
          status,
          subName: tempSchedule.subject,
        });
        await student.save();
      }
    }

    // res.status(200).json({ message: "Attendance marked successfully" });
    res
      .status(200)
      .json(new ApiResponse(200, null, "Attendance marked successfully"));
  } catch (error) {
    // res.status(500).json({ message: "Server error", error: error.message });
    return res
      .status(500)
      .json(
        new ApiResponse(
          error.statusCode || 500,
          null,
          error.message || "Internal Server Error"
        )
      );
  }
};

// const markAttendanceWithAccessKey = async (req, res) => {
//   try {
//     const { accessKey, presentStudentIds, date } = req.body;

//     // Validate input
//     if (!accessKey || !presentStudentIds || !date) {
//       return res.status(400).json({ message: "All fields are required" });
//     }

//     // Validate presentStudentIds as an array
//     if (!Array.isArray(presentStudentIds)) {
//       return res
//         .status(400)
//         .json({ message: "Present student IDs must be an array" });
//     }

//     // Find the teacher with the access key
//     const teacher = await Teacher.findOne({
//       "tempSchedule.accessKey": accessKey,
//     })
//       .populate("tempSchedule.className")
//       .populate("tempSchedule.subject");

//     if (!teacher) {
//       return res.status(404).json({ message: "Invalid access key" });
//     }

//     const tempSchedule = teacher.tempSchedule.find(
//       (ts) => ts.accessKey === accessKey
//     );

//     // Check if the date matches
//     if (
//       new Date(tempSchedule.date).toISOString() !== new Date(date).toISOString()
//     ) {
//       return res.status(400).json({ message: "Invalid date" });
//     }

//     // Find the class
//     const studentClass = await Sclass.findById(tempSchedule.className);

//     if (!studentClass) {
//       return res.status(404).json({ message: "Class not found" });
//     }

//     // Find students in the specified class and section
//     const students = await Student.find({
//       sclassName: studentClass._id.toString(),
//     });

//     if (students.length === 0) {
//       return res
//         .status(404)
//         .json({ message: "No students found for this class and section" });
//     }

//     // Create a map for quick lookup of present students
//     const presentStudentMap = new Set(presentStudentIds);

//     // Update attendance records for each student
//     for (const student of students) {
//       const status = presentStudentMap.has(student._id.toString())
//         ? "Present"
//         : "Absent";

//       // Check if attendance for the same date and subject already exists
//       const existingAttendance = student.attendance.find(
//         (att) =>
//           att.date.toISOString() === new Date(date).toISOString() &&
//           att.subName.toString() === tempSchedule.subject.toString()
//       );

//       if (!existingAttendance) {
//         student.attendance.push({
//           date: new Date(date),
//           status,
//           subName: tempSchedule.subject,
//         });
//         await student.save();
//       }
//     }

//     res.status(200).json({
//       message: "Attendance marked successfully",
//     });
//   } catch (error) {
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };

// const markAttendanceWithAccessKey = async (req, res) => {
//   try {
//     const {
//       teacherId,
//       presentStudentIds,
//       className,
//       section,
//       date,
//       accessKey,
//     } = req.body;

//     // Validate input
//     if (
//       !teacherId ||
//       !presentStudentIds ||
//       !className ||
//       !section ||
//       !date ||
//       !accessKey
//     ) {
//       return res.status(400).json({ message: "All fields are required" });
//     }

//     // Validate access key
//     const accessKeyEntry = await AccessKey.findOne({
//       teacher: teacherId,
//       className,
//       section,
//       accessKey,
//       validUntil: { $gte: new Date() }, // Check if access key is still valid
//     });

//     if (!accessKeyEntry) {
//       return res.status(403).json({ message: "Invalid or expired access key" });
//     }

//     // Find the teacher
//     const teacher = await Teacher.findById(teacherId)
//       .populate("teachSclass")
//       .populate("teachSubject");

//     if (!teacher) {
//       return res.status(404).json({ message: "Teacher not found" });
//     }

//     // Mark attendance using the service
//     const result = await markAttendanceService({
//       teacher,
//       presentStudentIds,
//       className,
//       section,
//       date,
//     });

//     // Respond with success message
//     res.status(200).json(result);
//   } catch (error) {
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };

const updateCompletionStatus = async (req, res) => {
  try {
    const { accessKey } = req.body;

    // Validate input
    if (!accessKey) {
      // return res.status(400).json({ message: "Access key is required" });
      throw new ApiError(400, "Access key is required");
    }

    // Find the teacher with the access key
    const teacher = await Teacher.findOne({
      "tempSchedule.accessKey": accessKey,
    });

    if (!teacher) {
      // return res.status(404).json({ message: "Invalid access key" });
      throw new ApiError(400, "Invalid access key");
    }

    // Find the specific temporary schedule
    const tempScheduleIndex = teacher.tempSchedule.findIndex(
      (ts) => ts.accessKey === accessKey
    );

    if (tempScheduleIndex === -1) {
      // return res.status(404).json({ message: "Temporary schedule not found" });
      throw new ApiError(404, "Temporary schedule not found");
    }

    // Update the completion status
    teacher.tempSchedule[tempScheduleIndex].completeStatus = true;
    await teacher.save();

    // res.status(200).json({
    //   message: "Temporary schedule marked as completed",
    // });
    res
      .status(200)
      .json(
        new ApiResponse(200, null, "Temporary schedule marked as completed ")
      );
  } catch (error) {
    return res
      .status(500)
      .json(
        new ApiResponse(
          error.statusCode || 500,
          null,
          error.message || "Internal Server Error"
        )
      );
  }
};

const getStudentAchievement = async (req, res) => {
  try {
    const studentId = req.params.id;

    const student = await Student.findById(studentId);

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res
      .status(200)
      .json({
        message: "Achievements fetched successfully",
        achievements: student.achievements,
      });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

const academicPerformance = async (req, res) => {
  try {
    const studentId = req.params.id;

    const student = await Student.findById(studentId);

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res
      .status(200)
      .json({
        message: "Academic performance fetched successfully",
        academicPerformance: student.academicPerformance,
      });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

const newStudentRegistration = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingstudent = await newStudent.findOne({ email });
    if (student) {
      return res.status(400).json({ message: "Student already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newStudent = await newStudent.create({
      name,
      email,
      password: hashedPassword,
    });
    res.status(201).json({ message: "Student created successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const newstudentLogIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    const student = await newStudent.findOne({ email });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const isMatch = await bcrypt.compare(password, student.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const payload = {
      student: {
        id: student.id,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: 3600 },
      (err, token) => {
        if (err) throw err;
        res.status(200).json({ token });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

const getAllStudents = async (req, res) => {
  try {
    const students = await Student.find()
      .populate("sclassName")
      .populate("school")
      .populate("examResult.subName")
      .populate("attendance.subName")
      .populate("academicPerformance.exam")
      .exec();

    res.status(200).json({
      success: true,
      data: students,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch students",
      error: error.message,
    });
  }
};




const filterStudents = async (req, res) => {
  const { sclassName, section } = req.query;

  try {
    // Find the class by name
    const sclass = await Sclass.findOne({ sclassName }).exec();

    if (!sclass) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    // Build the query based on the class ObjectId and section
    let query = { sclassName: sclass._id };

    if (section) {
      // Check if the section matches the found Sclass section
      if (sclass.section !== section) {
        return res.status(404).json({
          success: false,
          message: "No students found for the given section",
        });
      }
      // If section is provided and matches, proceed with the query
    }

    const students = await Student.find(query)
      .populate("sclassName") // Populate related Sclass model
      .populate("school") // Populate related Admin model
      .populate("examResult.subName") // Populate related Subject model in examResult
      .populate("attendance.subName") // Populate related Subject model in attendance
      .populate("academicPerformance.exam") // Populate related Exam model in academicPerformance
      .exec();

    res.status(200).json({
      success: true,
      data: students,
    });
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch students",
      error: error.message,
    });
  }
};

module.exports = {
  studentRegister,

  getStudentById,

  getStudentsByClassAndSection,

  addStudentAchievement,

  markAttendance,

  getStudentAttendance,

  markAttendanceWithAccessKey,

  updateCompletionStatus,

  getStudentAchievement,

  academicPerformance,

  newStudentRegistration,

  newstudentLogIn,
  getAllStudents,
  filterStudents,
  // studentLogIn,
  // getStudents,
  // getStudentDetail,
  // deleteStudents,
  // deleteStudent,
  // updateStudent,
  // studentAttendance,
  // deleteStudentsByClass,
  // updateExamResult,

  // clearAllStudentsAttendanceBySubject,
  // clearAllStudentsAttendance,
  // removeStudentAttendanceBySubject,
  // removeStudentAttendance,
};

// const deleteStudent = async (req, res) => {
//   try {
//     const result = await Student.findByIdAndDelete(req.params.id);
//     res.send(result);
//   } catch (error) {
//     res.status(500).json(err);
//   }
// };

// const deleteStudents = async (req, res) => {
//   try {
//     const result = await Student.deleteMany({ school: req.params.id });
//     if (result.deletedCount === 0) {
//       res.send({ message: "No students found to delete" });
//     } else {
//       res.send(result);
//     }
//   } catch (error) {
//     res.status(500).json(err);
//   }
// };

// const deleteStudentsByClass = async (req, res) => {
//   try {
//     const result = await Student.deleteMany({ sclassName: req.params.id });
//     if (result.deletedCount === 0) {
//       res.send({ message: "No students found to delete" });
//     } else {
//       res.send(result);
//     }
//   } catch (error) {
//     res.status(500).json(err);
//   }
// };

// const updateStudent = async (req, res) => {
//   try {
//     if (req.body.password) {
//       const salt = await bcrypt.genSalt(10);
//       res.body.password = await bcrypt.hash(res.body.password, salt);
//     }
//     let result = await Student.findByIdAndUpdate(
//       req.params.id,
//       { $set: req.body },
//       { new: true }
//     );

//     result.password = undefined;
//     res.send(result);
//   } catch (error) {
//     res.status(500).json(error);
//   }
// };

// const updateExamResult = async (req, res) => {
//   const { subName, marksObtained } = req.body;

//   try {
//     const student = await Student.findById(req.params.id);

//     if (!student) {
//       return res.send({ message: "Student not found" });
//     }

//     const existingResult = student.examResult.find(
//       (result) => result.subName.toString() === subName
//     );

//     if (existingResult) {
//       existingResult.marksObtained = marksObtained;
//     } else {
//       student.examResult.push({ subName, marksObtained });
//     }

//     const result = await student.save();
//     return res.send(result);
//   } catch (error) {
//     res.status(500).json(error);
//   }
// };

// const studentAttendance = async (req, res) => {
//   const { subName, status, date } = req.body;

//   try {
//     const student = await Student.findById(req.params.id);

//     if (!student) {
//       return res.send({ message: "Student not found" });
//     }

//     const subject = await Subject.findById(subName);

//     const existingAttendance = student.attendance.find(
//       (a) =>
//         a.date.toDateString() === new Date(date).toDateString() &&
//         a.subName.toString() === subName
//     );

//     if (existingAttendance) {
//       existingAttendance.status = status;
//     } else {
//       // Check if the student has already attended the maximum number of sessions
//       const attendedSessions = student.attendance.filter(
//         (a) => a.subName.toString() === subName
//       ).length;

//       if (attendedSessions >= subject.sessions) {
//         return res.send({ message: "Maximum attendance limit reached" });
//       }

//       student.attendance.push({ date, status, subName });
//     }

//     const result = await student.save();
//     return res.send(result);
//   } catch (error) {
//     res.status(500).json(error);
//   }
// };

// const clearAllStudentsAttendanceBySubject = async (req, res) => {
//   const subName = req.params.id;

//   try {
//     const result = await Student.updateMany(
//       { "attendance.subName": subName },
//       { $pull: { attendance: { subName } } }
//     );
//     return res.send(result);
//   } catch (error) {
//     res.status(500).json(error);
//   }
// };

// const clearAllStudentsAttendance = async (req, res) => {
//   const schoolId = req.params.id;

//   try {
//     const result = await Student.updateMany(
//       { school: schoolId },
//       { $set: { attendance: [] } }
//     );

//     return res.send(result);
//   } catch (error) {
//     res.status(500).json(error);
//   }
// };

// const removeStudentAttendanceBySubject = async (req, res) => {
//   const studentId = req.params.id;
//   const subName = req.body.subId;

//   try {
//     const result = await Student.updateOne(
//       { _id: studentId },
//       { $pull: { attendance: { subName: subName } } }
//     );

//     return res.send(result);
//   } catch (error) {
//     res.status(500).json(error);
//   }
// };

// const removeStudentAttendance = async (req, res) => {
//   const studentId = req.params.id;

//   try {
//     const result = await Student.updateOne(
//       { _id: studentId },
//       { $set: { attendance: [] } }
//     );

//     return res.send(result);
//   } catch (error) {
//     res.status(500).json(error);
//   }
// };
