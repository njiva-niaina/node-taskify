const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        minLength: 1,
        trim: true
    }
});

const Project = mongoose.model('Project', ProjectSchema);

module.exports = { Project }