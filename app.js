const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { default: mongoose, model, mongo } = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const saltRounds = 10;
let DB_Data = null;
const DB = require("./database.js"); //loading the database and its connection
const users = require("./models/users.js");
const profile = require("./models/profile.js");
const posts = require("./models/posts.js");
const stories = require("./models/stories.js");
const likes = require("./models/likes.js");
const comments = require("./models/comments.js");
const notifications = require("./models/notifications.js");

const userData = mongoose.model("User", users.userSchema);
const profileData = mongoose.model("Profile", profile.profileSchema);
const postData = mongoose.model("Posts", posts.postSchema);
const storiesData = mongoose.model("Stories", stories.storiesSchema);
const likesData = mongoose.model("Likes", likes.likesSchema);
const commentsData = mongoose.model("Comments", comments.commentsSchema);
const notificationsData = mongoose.model(
  "Notifications",
  notifications.notificationsSchema
);

const app = express();
// const server = new Server(app);
// const io = new Server(server);
require("dotenv").config();
app.use(cors());
app.use(bodyParser.json());

const salt = bcrypt.genSaltSync(saltRounds);
const port = process.env.PORT || 5000;
console.log("Server is running on port : ", port);

app.get("/", function (req, res) {
  res.send("Hello");
});

app.post("/register", async (req, res) => {
  const { email, realname, username, pass } = req.body;
  const hash = bcrypt.hashSync(pass, salt);

  if (email === "" || realname === "" || pass === "" || username === "") {
    res.send("Invalid request");
  } else if (!email.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+.[a-zA-Z]{2,}$/)) {
    res.send("Invalid email");
  } else {
    const newUser = await userData.create({
      realname: realname,
      email: email,
      username: username,
      password: hash,
      createdAt: new Date(),
    });

    await profileData.create({
      realname: realname,
      username: username,
      user_id: newUser._id,
      createdAt: new Date(),
    });
    res.send("Signup Successful");
  }
});

app.post("/login", async (req, res) => {
  const { login_Username, pass } = req.body;
  if (login_Username.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+.[a-zA-Z]{2,}$/)) {
    DB_Data = await userData.findOne({ email: login_Username });
  } else {
    DB_Data = await userData.findOne({ username: login_Username });
  }
  if (DB_Data === null) {
    res.send({
      success: false,
      message: "User does not exist",
    });
    return;
  }
  const isMatch = await bcrypt.compare(pass, DB_Data.password);

  var token = await jwt.sign({ user_id: DB_Data._id }, process.env.JWT_SECRET);

  if (isMatch) {
    res.send({
      success: true,
      token: token,
      username: DB_Data.username,
      realname: DB_Data.realname,
      userID: DB_Data._id,
    });
    return;
  } else {
    res.send({
      success: false,
      message: "Not a valid password",
    });
  }
});

app.post("/verify-token", async (req, res) => {
  const token = req.headers.authorization.split(" ")[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);      
      const userdata = await userData.findOne({_id: decoded.user_id})      

      res.send({
        valid: true,
        message: "Successfully Validated",
        username: userdata.username,

      });
    } catch (err) {
      res.send({
        valid: false,
        message: "Invalid Token",
      });
    }
  } else {
    res.send({
      valid: false,
      message: "Token not found",
    });
  }
});

app.post("/get-user-data", async (req, res) => {
  const { userName } = req.body;

  try {
    const data = await userData.findOne({ username: userName });
    res.send({
      userData: true,
      realname: data.realname,
      username: data.username,
      message: "User Found",
    });
  } catch (err) {
    res.send({
      userData: false,
      message: "User Data null",
    });
  }
});

app.post("/get-profile-data", async (req, res) => {
  const { username } = req.body;

  try {
    const user = await userData.findOne({ username: username });
    const userProfile = await profileData.findOne({ user_id: user._id });
    

    res.send({
      success: true,
      realname: user.realname,
      username: user.username,
      num_posts: userProfile.num_posts,
      num_followers: userProfile.num_followers,
      num_following: userProfile.num_following,
      bio: userProfile.bio,
      message: "Profile Data found",
    });
  } catch (err) {
    res.send({
      success: false,
      message: "Profile Data is null",
    });
  }
});

app.post("/search-user", async (req, res) => {
  const { nameOfUser } = req.body;

  try {
    const searchedProfile = await userData.find({
      $or: [{ realname: nameOfUser }, { username: nameOfUser }],
    });

    if(searchedProfile)
    {
      res.send({
        search_success: true,
        message: "User found.",
        profiles: searchedProfile
      });
    }
    else{
      res.send({
        search_success: false,
        message: "User not found."
      })
    }
  } catch (err) {
    res.send({
      search_success: false,
      message: "Request Error"
    });
  }
});

// Find
// app.get("/users", async (req, res) => {
//   try {
//     const result = await userData.find().lean();
//     console.log(JSON.stringify(result));
//     res.send(result); // Send the result as response
//   } catch (err) {
//     console.error(err);
//     res.status(500).send(err);
//   }
// });

// Update
// app.get("/update", async (req,res) => {
//   try{
//     const result = await userData.findOne({realname: "Pratyay"});
//     console.log(result._id);
//     const updatedResult = await userData.updateOne({_id: result._id}, {realname: "Hello"});
//     console.log(updatedResult);
//   }
//   catch(error){
//     console.error(error);
//   }
// });

// Delete
// app.get("/delete", async (req,res) => {
//   const result = await userData.deleteOne({realname: "shfuhid"});
//   res.send("Success");
// })

// postData.create({
//   post_url: String,
//   num_likes: 0,
//   num_comments: 0,
//   post_desc: String,
//   user_id: '669c0dec7406d0e13fc36a54',
//   createdAt: new Date(),
// });

// storiesData.create({
//   story_url: String,
//   user_id: '669c0dec7406d0e13fc36a54',
//   createdAt: new Date(),
// });

// likesData.create({
//   post_id: '669c0dec7406d0e13fc36a54',
//   user_id: '669c0dec7406d0e13fc36a54',
//   createdAt: new Date(),
// });

// commentsData.create({
//   post_id: '669c0dec7406d0e13fc36a54',
//   user_id: '669c0dec7406d0e13fc36a54',
//   comment_desc: String,
//   createdAt: new Date(),
// });

// notificationsData.create({
//   user_id: '669c0dec7406d0e13fc36a54',
//   createdAt: new Date(),
// });

app.listen(port);
