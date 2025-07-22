const mongoose = require('mongoose');

const groupSetSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    allowSelfSignup: {
        type: Boolean,
        default: false
    },
    groupStructure: {
        type: String,
        enum: ['manual', 'byGroupCount', 'byStudentsPerGroup'],
        default: 'manual'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Add index for faster queries
groupSetSchema.index({ course: 1, name: 1 }, { unique: true });

const GroupSet = mongoose.model('GroupSet', groupSetSchema);

module.exports = GroupSet; 