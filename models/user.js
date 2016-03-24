var mongoose = require('mongoose');

var UserSchema = new mongoose.Schema({
    name: String,
    email: String,
    pendingTasks: [String], // The _id fields of the pending tasks that this user has
    dateCreated: Date
});

// Export the Mongoose model
module.exports = mongoose.model('User', UserSchema);
