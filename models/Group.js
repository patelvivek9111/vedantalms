const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    groupSet: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GroupSet',
        required: true
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    leader: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    groupId: {
        type: String,
        required: true,
        unique: true
    },
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
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

// Add index for faster queries (only for groupSet + name combination)
groupSchema.index({ groupSet: 1, name: 1 }, { unique: true });

// Generate a unique group ID before saving
// Temporarily disabled to fix query issues
/*
groupSchema.pre('save', async function(next) {
    try {
        if (!this.groupId) {
            const groupSet = await mongoose.model('GroupSet').findById(this.groupSet).populate('course');
            if (groupSet && groupSet.course) {
                const timestamp = Date.now().toString().slice(-6);
                const random = Math.random().toString(36).substring(2, 5).toUpperCase();
                // Use course title or ID as fallback since there's no code field
                const courseIdentifier = groupSet.course.title ? 
                    groupSet.course.title.replace(/\s+/g, '-').substring(0, 10) : 
                    groupSet.course._id.toString().slice(-6);
                this.groupId = `${courseIdentifier}-${timestamp}-${random}`;
            } else {
                // Fallback if no course info available
                const timestamp = Date.now().toString().slice(-6);
                const random = Math.random().toString(36).substring(2, 5).toUpperCase();
                this.groupId = `GROUP-${timestamp}-${random}`;
            }
        }
        next();
    } catch (error) {
        console.error('Error in Group pre-save hook:', error);
        // Continue with save even if groupId generation fails
        next();
    }
});
*/

const Group = mongoose.model('Group', groupSchema);

module.exports = Group; 