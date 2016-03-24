var mongoose = require('mongoose');

var TaskSchema = new mongoose.Schema({
    name: String,
    description: String,
    deadline: Date,
    completed: Boolean,
    assignedUser: String, // The _id field of the user this task is assigned to - default “”
    assignedUserName: String, // The name field of the user this task is assigned to - default “unassigned”
    dateCreated: Date
});

// Export the Mongoose model
module.exports = mongoose.model('Task', TaskSchema);
