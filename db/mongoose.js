const mongoose = require('mongoose');

mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost:2707/Taskify', { userNewUrlParser: true }).then(() => {
    console.log('Connected to MongoDB successfully');
}).catch((e) => {
    console.log('Error while connecting to MongoDB');
    console.log(e);
});

module.exports = {
    mongoose
};