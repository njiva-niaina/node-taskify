const mongoose = require('mongoose');
const _ = require('lodash');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// JWT secret
const jwtSecret = "2021-11-15/9:53:57PM";

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
};

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
};

UserSchema.methods.generateRefreshAuthToken = function () {
    // Generate 64 bytes hex string
    return new Promise((resolve, reject) => {
        crypto.randomBytes(64, (err, buffer) => {
            if (!err) {
                let token = buffer.toString('hex');
                return resolve(token);
            }
        });
    });
};

UserSchema.methods.createSession = function () {
    let user = this;
    return user.generateRefreshAuthToken().then((refreshToken) => {
        return saveSessionToDatabase(user, refreshToken);
    }).then((refreshToken) => {
        return refreshToken;
    }).catch((e) => {
        return Promise.reject('Failed to save session to database' + e);
    });
};

// Model method (static method)
UserSchema.statics.findByIdAndToken = function(_id, token) {
    const User = this;
    return User.findOne({ 
        _id,
        'sessions.token': token
    });
};

UserSchema.statics.findByCredentials = function(email, password) {
    let User = this;
    return User.findOne({ email }).then((user) => {
        if (!user) return Promise.reject();
        return new Promise((resolve, reject) => {
            bcrypt.compare(password, user.password, (err, res) => {
                if (res) resolve(user);
                else {
                    reject();
                }
            });
        });
    });
};

UserSchema.statics.hasRefreshTokenExpired = function (expiresAt) {
    let secondsSinceEpoch = Date.now() / 1000;
    return (secondsSinceEpoch > expiresAt) ? false : true;
};

// Hash password before saving
UserSchema.pre('save', function(next){
    let user = this;
    let costFactor = 10;
    if (user.isModified('password')){
        bcrypt.genSalt(costFactor, (err, salt) => {
            bcrypt.hash(user.password, salt, (err, hash) => {
                user.password = hash;
                next();
            });
        });
    }
    else {
        next();
    }
});

// Helper methods
let saveSessionToDatabase = (user, refreshToken) => {
    return new Promise((resolve, reject) => {
        let expiresAt = generateRefreshTokenExpiryTime;
        user.sessions.push({'token': refreshToken, expiresAt});
        user.save().then(() => {
            return resolve(refreshToken);
        }).catch((e) => {
            reject(e);
        });
    });
};

let generateRefreshTokenExpiryTime = () => {
    let daysUntilExpire = '10';
    let secondUntilExpire = ((daysUntilExpire * 24) * 60) * 60;
    return ((Date.now()/1000) * secondUntilExpire);
};

const User = mongoose.model('User', UserSchema);

module.exports = { User };