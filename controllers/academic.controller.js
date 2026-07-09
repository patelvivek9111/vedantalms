const academicCalendarService = require('../services/academicCalendar.service');

exports.getAcademicSettings = async (req, res) => {
  try {
    const data = await academicCalendarService.getAcademicSettings();
    res.json({
      success: true,
      data: {
        ...data,
        calendarPresets: academicCalendarService.listCalendarPresets(),
        termOptions: academicCalendarService.getTermOptionsForMode(data.institutionMode),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateAcademicSettings = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }
    const data = await academicCalendarService.updateAcademicSettings(req.body || {});
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.applyInstitutionCalendar = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }
    const result = await academicCalendarService.applyInstitutionCalendarToAllFullYearCourses(
      req.user._id
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
