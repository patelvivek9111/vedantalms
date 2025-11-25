const mongoose = require('mongoose');

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

// Add validation to ensure end date is after start date
eventSchema.pre('validate', function(next) {
  if (this.start && this.end) {
    if (new Date(this.end) <= new Date(this.start)) {
      this.invalidate('end', 'End date must be after start date');
    }
  }
  next();
});

module.exports = mongoose.model('Event', eventSchema); 