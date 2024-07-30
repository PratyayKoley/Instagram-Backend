const mongoose = require('mongoose')
require("dotenv").config();

const url = process.env.MONGODB_URI;

mongoose.connect(url)
    .then( () => {
        console.log('Connected to database ')
    })
    .catch( (err) => {
        console.error(`Error connecting to the database. \n${err}`);
    })