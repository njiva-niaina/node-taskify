const express = require('express');
const app = express();

const { mongoose } = require('./db/mongoose');

const bodyParser = require('body-parser');

const { User, Project } = require('./db/models');

// Load middleware
app.use(bodyParser.json());

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
app.get('/projects', (req, res) => {
    // Return an array of all the projects in database
    Project.find({}).then((projects) => {
        res.send(projects);
    });
});

app.post('/projects', (req, res) => {
    // Create a new project and return the new project document back to the user
    let title = req.body.title;
    let newProject = new Project({
        title
    });
    newProject.save().then((projectDoc) => {
        // Return the new project
        res.send(projectDoc);
    });
});

app.patch('/projects/:id', (req, res) => {
    // Update the specified project with the new values specified in the JSON body of the request
    Project.findOneAndUpdate({ _id: req.params.id }, {
        $set: req.body
    }).then(() => {
        res.sendStatus(200);
    });
});

app.delete('/projects/:id', (req, res) => {
    // Delete a specified project
    Project.findOneAndRemove({
        _id: req.params.id
    }).then((removedProjectDoc) => {
        res.send(removedProjectDoc);
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

app.listen(3000, () => {
    console.log('Server listening on port 3000');
});