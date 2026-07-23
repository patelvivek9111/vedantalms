const mongoose = require('mongoose');
const { courseChildTenantPlugin } = require('./plugins/courseChildTenant.plugin');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  start: { type: Date, required: true },
  end: { type: Date, required: true },
  type: { type: String, required: true },
  color: String,
  location: String,
  calendar: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});

eventSchema.plugin(courseChildTenantPlugin, { coursePath: 'course' });

module.exports = mongoose.model('Event', eventSchema); 