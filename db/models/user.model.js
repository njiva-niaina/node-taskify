const mongoose = require('mongoose');
const _ = require('lodash');
const jwt = require('jsonwebtoken');

// JWT secret
const jwtSecret = "2021-11-15/9:53:57PM"

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        minLength: 1, 
        trim: true,
        unique: true
    },
    password: {
        type: String,
        required: true,
        minLength: 8
    },
    sessions: [{
        token: {
            type: String,
            required: true
        },
        expiresAt : {
            type: Number,
            required: true
        }
    }]
});

// Instance methods
UserSchema.methods.toJSON = function() {
    const user = this;
    const userObject = user.toObject();
    // Return document except password and session
    return _.omit(userObject, ['password', 'sessions']);
}

UserSchema.methods.generateAccessToken = function () {
    const user = this;
    return new Promise((resolve, reject) => {
        // Create and return JWT 
        jwt.sign({_id: user._id.toHexString()}, jwtSecret, {expiresIn: '15m'}, (err, token) => {
            if (!err) {
                resolve(token);
            }
            else {
                reject();
            }
        });
    });
}