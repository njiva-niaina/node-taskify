const express = require('express');
const app = express();

const { mongoose } = require('./db/mongoose');

const bodyParser = require('body-parser');

const { User, Project, Task } = require('./db/models');

const jwt = require('jsonwebtoken');

// Load middleware
app.use(bodyParser.json());

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, HEAD, OPTIONS, PUT, PATCH, DELETE");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, x-access-token, x-refresh-token, _id");

    res.header(
        'Access-Control-Expose-Headers',
        'x-access-token, x-refresh-token'
    );

    next();
});

let authenticate = (req, res, next) => {
    let token = req.header('x-access-token');
    jwt.verify(token, User.getJWTSecret(), (err, decoded) => {
        if (err) {
            res.status(401).send(err);
        } else {
            req.user_id = decoded._id;
            next();
        }
    });
}

// Verify refresh Token Middleware
let verifySession = (req, res, next) => {
    let refreshToken = req.header('x-refresh-token');
    let _id = req.header('_id');
    User.findByIdAndToken(_id, refreshToken).then((user) => {
        if (!user) {
            return Promise.reject({
                'error': 'User not found'
            });
        }
        
        req.user_id = user._id;
        req.userObject = user;
        req.refreshToken =  refreshToken;
        let isSessionValid = false;
        user.sessions.forEach((session) => {
            if (session.token === refreshToken) {
                if (User.hasRefreshTokenExpired(session.expiresAt) === false) {
                    isSessionValid = true;
                }
            }
        });
        if (isSessionValid) {
            next();
        }
        else {
            return Promise.reject({
                'error': 'Refresh token has expired or the session is invalid'
            });
        }
    }).catch((e) => {
        res.status(401).send(e);
    });
}

// Project routes
app.get('/projects', authenticate, (req, res) => {
    // Return an array of all the projects in database
    Project.find({
        _userId: req.user_id
    }).then((projects) => {
        res.send(projects);
    }).catch((e) => {
        res.send(e);
    });
});

app.post('/projects', authenticate, (req, res) => {
    // Create a new project and return the new project document back to the user
    let title = req.body.title;
    let newProject = new Project({
        title,
        _userId: req.user_id
    });
    newProject.save().then((projectDoc) => {
        // Return the new project
        res.send(projectDoc);
    });
});

app.patch('/projects/:id', authenticate, (req, res) => {
    // Update the specified project with the new values specified in the JSON body of the request
    Project.findOneAndUpdate({ _id: req.params.id, _userId: req.user_id }, {
        $set: req.body
    }).then(() => {
        res.sendStatus(200);
    });
});

app.delete('/projects/:id', authenticate, (req, res) => {
    // Delete a specified project
    Project.findOneAndRemove({
        _id: req.params.id, 
        _userId: req.user_id
    }).then((removedProjectDoc) => {
        res.send(removedProjectDoc);
        deleteTasksFromProject(removedProjectDoc._id);
    });
});

// Task routes
app.get('/projects/:projectId/tasks', authenticate, (req, res) => {
    // Return all tasks that belong to a specific project
    Task.find({
        _projectId: req.params.projectId
    }).then((tasks) => {
        res.send(tasks);
    });
});

app.get('/projects/:projectId/tasks/:taskId', (req, res) => {
     // Return a specific task in a project
     Task.findOne({
        _id: req.params.taskId,
        _projectId: req.params.projectId
    }).then((task) => {
        res.send(task);
    });
});

app.post('/projects/:projectId/tasks', authenticate, (req, res) => {
    Project.findOne({
        _id: req.params.projectId,
        _userId: req.user_id
    }).then((project) => {
        if (project) {
            return true;
        }
        return false;
    }).then((canCreateTask) => {
        if (canCreateTask) {
            let newTask = new Task({
                title: req.body.title,
                _projectId: req.params.projectId
            });
            newTask.save().then((newTaskDoc) => {
                res.send(newTaskDoc);
            })
        } else {
            res.sendStatus(404);
        }
    });
});

app.patch('/projects/:projectId/tasks/:taskId', authenticate, (req, res) => {
    Project.findOne({
        _id: req.params.projectId,
        _userId: req.user_id
    }).then((project) => {
        if (project) {
            return true;
        }
        return false;
    }).then((canUpdateTasks) => {
        if (canUpdateTasks) {
            Task.findOneAndUpdate({
                _id: req.params.taskId,
                _projectId: req.params.projectId
            }, {
                    $set: req.body
                }
            ).then(() => {
                res.send({ message: 'Updated successfully.' })
            })
        } else {
            res.sendStatus(404);
        }
    });
});

app.delete('/projects/:projectId/tasks/:taskId', authenticate, (req, res) => {
    Project.findOne({
        _id: req.params.projectId,
        _userId: req.user_id
    }).then((project) => {
        if (project) {
            return true;
        }
        return false;
    }).then((canDeleteTasks) => {
        if (canDeleteTasks) {
            Task.findOneAndRemove({
                _id: req.params.taskId,
                _projectId: req.params.projectId
            }).then((removedTaskDoc) => {
                res.send(removedTaskDoc);
            })
        } else {
            res.sendStatus(404);
        }
    });
});

// User routes
// Sign up
app.post('/sign-up', (req, res) => {
    let body = req.body;
    let newUser = new User(body);

    newUser.save().then(() => {
        return newUser.createSession();
    }).then((refreshToken) => {
        return newUser.generateAccessAuthToken().then((accessToken) => {
            return {accessToken, refreshToken};
        });
    }).then((authToken) => {
        res
            .header('x-refresh-token', authToken.refreshToken)
            .header('x-access-token', authToken.accessToken)
            .send(newUser);
    }).catch((e) => {
        res.status(400).send(e);
    });
});

// Sign in
app.post('/sign-in', (req, res) => {
    let email = req.body.email;
    let password = req.body.password;

    User.findByCredentials(email, password).then((user) => {
        return user.createSession().then((refreshToken) => {
            return user.generateAccessAuthToken().then((accessToken) => {
                return {accessToken, refreshToken};
            });
        }).then((authToken) => {
            res
            .header('x-refresh-token', authToken.refreshToken)
            .header('x-access-token', authToken.accessToken)
            .send(user);         
        });
    }).catch((e) => {
        res.status(400).send(e);
    });
});

app.get('/me/access-token', verifySession, (req,res) => {
    req.userObject .generateAccessAuthToken().then((accessToken) => {
        res.header('x-access-token', accessToken).send({ accessToken });
    }).catch((e) => {
        res.status(400).send(e);
    });
});

/* HELPER METHODS */
let deleteTasksFromList = (_projectId) => {
    Task.deleteMany({
        _projectId
    }).then(() => {
        console.log("Tasks from " + _projectId + " were deleted!");
    })
}

app.listen(3000, () => {
    console.log('Server listening on port 3000');
});