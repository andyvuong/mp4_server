// Get the packages we need
var express = require('express');
var mongoose = require('mongoose');
var User = require('./models/user');
var Task = require('./models/task');
var bodyParser = require('body-parser');
var router = express.Router();
//var settings = require('./settings');

//mongoose.connect('mongodb://' + settings.mlab_user + ':' + settings.mlab_pass + '@ds043002.mlab.com:43002/' +  settings.mlab_db);

mongoose.connect('mongodb://' + 'tester' + ':' + 'test' + '@ds043002.mlab.com:43002/' +  'tasks');
// Create our Express application
var app = express();

// Use environment defined port or 4000
var port = process.env.PORT || 4000;

//Allow CORS so that backend and frontend could pe put on different servers
var allowCrossDomain = function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header("Access-Control-Allow-Headers", "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept");
    next();
};
app.use(allowCrossDomain);

// Use the body-parser package in our application
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(bodyParser.json());

// Specifies the middleware to use at the specified route
app.use('/api', router);

// Default route here
var homeRoute = router.route('/');

homeRoute.get(function(req, res) {
    res.status(200).json({ message: 'Valid api routes are /api/tasks and /api/users' });
});

/**
 * Define /users Route
 * @GET: Respond with a List of users
 * @POST: Create a new user. Respond with details of new user
 */
var usersRoute = router.route('/users')
    .options(function(req, res) {
        res.writeHead(200);
        res.end();
    })
    .get(function(req, res) { // Respond with a List of users
        queryOptions = parseQueryParams(req.query);

        getDocumentsFromDB(queryOptions, User, res);
    })
    .post(function(req, res) { // Create a new user. Respond with details of new user
        var name = req.body.name;
        var email = req.body.email;
        // simple email format validation handled on frontend
        if (name == null || email == null || name.length == 0 || email.length == 0) {
            return res.status(500).json({ message: 'Validation Error: A valid name and email is required.', 
                                          data: [] });
        }
        // check if email already exists before inserting into db.
        User.findOne({ 'email': email}, function(err, user) {
            if (user || err) {
                return res.status(500).json({ message: 'Error: This email already exists.',
                                              data: [] });
            }
            else {
                addUser(name, email, res);
            }
        });
    });

/**
 * Define /users/:id Route
 * @GET: Respond with details of specified user or 404 error
 * @PUT: Replace entire user with supplied user or 404 error
 * @DELETE: Delete specified user or 404 error
 */
var usersParamRoute = router.route('/users/:id')
    .get(function(req, res) { // Respond with details of specified user or 404 error
        var id = req.params.id;
        if (typeof id === 'undefined' || id.length == 0) {
            return res.status(500).json({ message: 'Validation Error: An id is required.', 
                                          data: [] });
        }
        
        User.findOne({ '_id': id}, function(err, user) {
            if (user) {
                res.status(200).json({ message: 'Returning user.',
                                       data: user });
            }
            else {
                res.status(404).json({ message: 'Error: User was not found.', 
                                       data: [] });            
            }
        });
    })
    .put(function(req, res) { // Replace entire user with supplied user or 404 error
        var id = req.params.id;
        if (typeof id === 'undefined' || id.length == 0) {
            res.status(500).json({ message: 'Validation Error: An id is required.', 
                                   data: [] });
        }
        else {
            var updateParam = {
                name: req.body.name,
                email: req.body.email,
                pendingTasks: req.body.pendingTasks
            }

            findAndUpdate(User, 'User', id, res, updateParam);
        }
    })
    .delete(function(req, res) { // Delete specified user or 404 error
        var id = req.params.id;
        if (typeof id === 'undefined' || id.length == 0) {
            res.status(500).json({ message: 'Validation Error: An id is required.', 
                                   data: [] });
        }
        else {
            findAndDelete(User, 'User', id, res);
        }
    });

// Adds a user to the database or sends an error if a new user cannot be added.
function addUser(name, email, res) {
    var date = new Date();
    var user = new User();
    user.name = name;
    user.email = email;
    user.pendingTasks = [];
    user.dateCreated = date.toJSON();

    user.save(function(err) {
        if (err) {
            res.status(500).json({ message: 'Error: There was a problem adding the user.',
                                   data: []});
        }
        else {
            res.status(201).json({ message: 'New user was added',
                                   data: user });
        }
    });
}

// updates a user document based on its model (spec)
function updateUser(doc, res, updateParams) {
    if (updateParams.name) {
        doc.name = updateParams.name;
    }
    if (updateParams.pendingTasks) {
        doc.pendingTasks = updateParams.pendingTasks;
    }
    if (updateParams.email && updateParams.email !== doc.email) {
        findEmailAndUpdate(updateParams.email, doc, res)
    }
    else {
        saveAndRespond(doc, 'User was updated.', res);
    }
}

// updates a task document based on its model (spec)
function updateTask(doc, res, updateParams) {
    if (updateParams.name) {
        doc.name = updateParams.name
    }
    if (updateParams.description) {
        doc.description = updateParams.description;
    }
    if (updateParams.deadline) {
        doc.deadline = updateParams.deadline;
    }
    if (typeof updateParams.completed !== 'undefined') {
        doc.completed = updateParams.completed;
    }
    if (updateParams.assignedUser || typeof updateParams.assignedUser !== 'undefined') {
        doc.assignedUser = updateParams.assignedUser;
    }
    if (updateParams.assignedUserName) {
        doc.assignedUserName = updateParams.assignedUserName;
    }
    
    saveAndRespond(doc, 'Task was updated.', res);
}

// queries the db to see if the email the document is being updated to, already exists. Updates and saves the doc if it doesn't.
function findEmailAndUpdate(email, doc, res) {
    User.findOne({ 'email' : email}, function(err, result) {
        if (result) {
            res.status(500).json({ message: 'Error: This email already exists.', 
                   data: [] });
        }
        else {
            doc.email = email;
            saveAndRespond(doc, 'User was updated.', res)
        }
    });
}

// Parses the request body for the query parameters and sets the appropriate defaults or client specified parameters encapsulated by an object
function parseQueryParams(reqQuery) {
    var skip = (typeof reqQuery.skip !== 'undefined' && typeof reqQuery.skip !== 'null') ? reqQuery.skip : 0;
    var limit = (typeof reqQuery.limit !== 'undefined' && typeof reqQuery.limit !== 'null') ? reqQuery.limit : 100;
    var count = (typeof reqQuery.count !== 'undefined' && typeof reqQuery.count !== 'null') ? reqQuery.count : false;
    
    var select = (typeof reqQuery.select !== 'undefined' && typeof reqQuery.select !== 'null') ? JSON.parse(reqQuery.select) : '';
    var sort = (typeof reqQuery.sort !== 'undefined' && typeof reqQuery.sort !== 'null') ? JSON.parse(reqQuery.sort) : '';
    var where = (typeof reqQuery.where !== 'undefined' && reqQuery.where !== 0) ? JSON.parse(reqQuery.where.trim()) : '';

    if (typeof where === 'string') {
        where = where.trim();
    }

    var queryOptions = {
        where: where,
        skip: skip,
        limit: limit,
        count: count,
        select: select,
        sort: sort
    }
    return queryOptions;
}

/**
 * Queries the MongoDB with the specified model and query options and returns a set of documents to the client.
 * @param queryOptions - an object containing the query parameters
 * @param model - the model type to query documents from
 * @res - the response object returned to the client
 */
function getDocumentsFromDB(queryOptions, model, res) {
    model.find(queryOptions.where)
         .limit(queryOptions.limit)
         .sort(queryOptions.sort)
         .select(queryOptions.select)
         .skip(queryOptions.skip)
         .exec(function(err, docs) {
            if (err) {
                return res.status(500).json({ message: 'Error: Unable to retrieve results from database.', 
                                              data: [] }); 
            }
            else {
                var dataObj = docs;
                var msg = 'Returning a list of documents.'
                if (queryOptions.count) {
                    dataObj = docs.length;
                    msg = 'Returning a count of documents'
                }
                return res.status(200).json({ message: msg,
                                              data: dataObj,
                                        opts: queryOptions }); //TODO
            }
        });
}

/**
 * Find a model of a particular type and id and update it. A new dateCreated value will be generated.
 *
 * For the User, the update options are: [name, email]
 * For the User, the update options are: [name] @TODO
 * 
 * @param model - the model to update
 * @param type - a string representation of the model
 * @param id - the id of the document being updated
 * @param res - the response object returned to the client
 * @param updateParams - an object containing the document fields to be updated
 */
function findAndUpdate(model, type, id, res, updateParams) {
    model.findOne({ '_id': id}, function(err, doc) {
        if (doc && !err) {
            if (type === 'User') {
                updateUser(doc, res, updateParams);
            }
            else if (type === 'Task') {
                updateTask(doc, res, updateParams);
            }
            else {
                res.status(500).json({ message: 'Error occured updating type',
                                       data: [] });
            }
        }
        else {
            res.status(404).json({ message: 'Error: ' +  type + ' was not found.', 
                                   data: [] });  
        }
    });
}

/**
 * Saves a document to the database.
 * @param doc - the document being saved to the DB
 * @param msg - the response message sent to the client
 * @param res - the response object returned to the client 
 */
function saveAndRespond(doc, msg, res) {
    doc.save();
    res.status(200).json({ message: msg, 
                           data: doc});
}

/** 
 * Finds a user or task by its id and deletes it
 *
 * @param model - the Mongoose Model object we're deleting from
 * @param type - a string representation of the model
 * @param id - the id of the document being removed
 * @param res - the response object returned to the client 
 */
function findAndDelete(model, type, id, res) {
    model.findOne({'_id': id}, function(err, doc) {
        if (doc) {
            doc.remove(function(err) {
                if (err) {
                    res.status(500).json({ message: 'could not delete: ' + err, 
                                   data: [] });     
                }
                else {
                    res.status(200).json({ message: 'Deleted ' + type + '.',
                                   data: [] });
                }
            });
        }
        else {
            res.status(404).json({ message: 'Error: ' +  type + ' was not found.', 
                                   data: [] });      
        }
    });
}

// Adds a task to the database or sends an error if a new user cannot be added.
function addTask(name, description, deadline, completed, assignedUser, assignedUserName, res) {
    var task = new Task();
    task.name = name;
    task.deadline = deadline;

    task.description = (typeof description !== 'undefined') ? description : '';
    task.completed = (typeof completed !== 'undefined' && (completed === true || completed === 'true')) ? true : false;
    //console.log('is actually ' + task.completed); // test the 498 helper script
    task.assignedUser = (typeof assignedUser !== 'undefined') ? assignedUser : '';
    task.assignedUserName = (typeof assignedUserName !== 'undefined') ? assignedUserName : 'unassigned';

    var date = new Date();
    task.dateCreated = date.toJSON();

    task.save(function(err) {
        if (err) {
            res.status(500).json({ message: 'Error: There was a problem adding the task.',
                                   data: []});
        }
        else {
            res.status(201).json({ message: 'New task was added',
                                   data: task });
        }
    });
}


/**
 * Define /tasks Route
 * @GET: Respond with a List of tasks
 * @POST: Create a new task. Respond with details of new task
 */
 var tasksRoute = router.route('/tasks')
    .options(function(req, res) {
        res.writeHead(200);
        res.end();
    })
    .get(function(req, res) {
        queryOptions = parseQueryParams(req.query);

        getDocumentsFromDB(queryOptions, Task, res);
    })
    .post(function(req, res) {
        var name = req.body.name;
        var description = req.body.description;
        var deadline = req.body.deadline;
        var completed = req.body.completed;
        var assignedUser = req.body.assignedUser;
        var assignedUserName = req.body.assignedUserName;

        if (typeof name === 'undefined' || typeof deadline === 'undefined') {
            return res.status(500).json({ message: 'Validation Error: A name and deadline for this task is required.', 
                                          data: [] });
        }

        addTask(name, description, deadline, completed, assignedUser, assignedUserName, res);
    });

/**
 * Define /tasks:/id Route
 * @GET: Respond with details of specified task or 404 error
 * @PUT: Replace entire user with supplied task or 404 error
 * @DELETE: Delete specified task or 404 error
 */
 var tasksParamRoute = router.route('/tasks/:id')
    .get(function(req, res) {
        var id = req.params.id;
        if (typeof id === 'undefined' || id.length == 0) {
            return res.status(500).json({ message: 'Validation Error: An id is required.', 
                                          data: [] });
        }
        
        Task.findOne({ '_id': id}, function(err, task) {
            if (task) {
                res.status(200).json({ message: 'Returning task.',
                                       data: task });
            }
            else {
                res.status(404).json({ message: 'Error: Task was not found.', 
                                       data: [] });            
            }
        });
    })
    .put(function(req, res) {
        var id = req.params.id;
        if (typeof id === 'undefined' || id.length == 0) {
            return res.status(500).json({ message: 'Validation Error: An id is required.', 
                                   data: [] });
        }
        
        var updateParam = {
            name: req.body.name,
            description: req.body.description,
            deadline: req.body.deadline,
            completed: req.body.completed,
            assignedUser: req.body.assignedUser,
            assignedUserName: req.body.assignedUserName
        }
        findAndUpdate(Task, 'Task', id, res, updateParam);
    })
    .delete(function(req, res) {
        var id = req.params.id;
        if (typeof id === 'undefined' || id.length == 0) {
            res.status(500).json({ message: 'Validation Error: An id is required.', 
                                   data: [] });
        }
        else {
            findAndDelete(Task, 'Task', id, res);
        }
    });


// Start the server
app.listen(port);
console.log('Server running on port ' + port);
