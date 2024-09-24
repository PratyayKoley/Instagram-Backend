const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { default: mongoose, model, mongo } = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const { createServer } = require("http");
const { OAuth2Client } = require("google-auth-library");

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
const messages = require("./models/messages.js");

const userData = mongoose.model("User", users.userSchema);
const profileData = mongoose.model("Profile", profile.profileSchema);
const postData = mongoose.model("Posts", posts.postSchema);
const storiesData = mongoose.model("Stories", stories.storiesSchema);
const likesData = mongoose.model("Likes", likes.likesSchema);
const commentsData = mongoose.model("Comments", comments.commentsSchema);
const notificationsData = mongoose.model("Notifications", notifications.notificationsSchema);
const messagesData = mongoose.model("Messages", messages.messageSchema);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
});
require("dotenv").config();
app.use(cors());
app.use(bodyParser.json());
const activeUsers = {};
const oauth2Client = new OAuth2Client();

const salt = bcrypt.genSaltSync(saltRounds);
const port = process.env.PORT || 5000;
console.log("Server is running on port : ", port);

app.get("/", function (req, res) {
  res.send("Hello");
});

io.on("connection", (socket) => {
  console.log("User Connected", socket.id);

  socket.on("user-connect", (userName) => {
    activeUsers[userName] = socket.id;
    console.log(`${userName} is connected to ${socket.id}`);
  });

  socket.on("send-message", async (data) => {
    const {from, to, message} = data;

    try {
      // Ensure 'from' and 'to' are valid ObjectIds
      const fromUser = await userData.findOne({ username: from });
      const toUser = await userData.findOne({ username: to });

      if (!fromUser) {
        throw new Error("Invalid 'from' user");
      }
      if(!toUser){
        throw new Error("Invalid 'to' user");
      }

      const isRecepientOnline = !!activeUsers[to];    //converts the value to boolean value

      // Store the message in the database
      await messagesData.create({
        from: fromUser._id,  // Use the ObjectId
        to: toUser._id,      // Use the ObjectId
        message: message,
        createdAt: new Date(),
        isRead: isRecepientOnline,
      })

      // If user is online, send the message
      if (activeUsers[to]) {
        const recSocketID = activeUsers[to];
        io.to(recSocketID).emit("receive_message", {
          senderID: socket.id,
          recepientID: recSocketID,
          message: message,
          from: from,
        });
        console.log(`Message sent to online user ${to}`);
      } else {
        console.log(
          `User ${to} is offline. Message stored for later delivery.`
        );
      }
    } catch (error) {
      console.error(
        `Failed to process message for user ${to}:`,
        error
      );
      socket.emit("message_error", { error: "Failed to send message" });
    }
  });

  socket.on("disconnect", () => {
    for (let username in activeUsers) {
      if (activeUsers[username] === socket.id) {
        delete activeUsers[username];
        console.log("User Disconnected", username, socket.id);
        break;
      }
    }
  });
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
      const userdata = await userData.findOne({ _id: decoded.user_id });

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
      num_followers: userProfile.num_following,
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

    if (searchedProfile) {
      res.send({
        search_success: true,
        message: "User found.",
        profiles: searchedProfile,
      });
    } else {
      res.send({
        search_success: false,
        message: "User not found.",
      });
    }
  } catch (err) {
    res.send({
      search_success: false,
      message: "Request Error",
    });
  }
});

app.get("/get-all-users", async (req, res) => {
  try {
    const allUsers = await userData.find();
    if (allUsers) {
      res.send({
        status: true,
        data: allUsers,
      });
    } else {
      res.send({
        status: false,
        data: null,
      });
    }
  } catch (err) {
    res.send({
      status: false,
      message: "Request Error",
    });
  }
});

app.post("/is-user-online", (req, res) => {
  const { recuserName } = req.body;

  if (activeUsers[recuserName]) {
    res.send({
      online: true,
      socket_id: activeUsers[recuserName],
    });
  } else {
    res.send({
      online: false,
    });
  }
});

app.post("/auth", async (req, res) => {
  try {
    // get the code from frontend
    const code = req.headers.authorization;
    console.log("Authorization Code:", code);

    // Exchange the authorization code for an access token
    const response = await axios.post("https://oauth2.googleapis.com/token", {
      code,
      client_id:
        process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      redirect_uri: "http://localhost:3000/main",
      grant_type: "authorization_code",
    });
    const accessToken = response.data.access_token;
    console.log("Access Token:", accessToken);

    // Fetch user details using the access token
    const userResponse = await axios.get(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    const userDetails = userResponse.data;
    console.log("User Details:", userDetails);

    // Process user details and perform necessary actions

    res.status(200).json({ message: "Authentication successful" });
  } catch (error) {
    console.error("Error saving code:", error);
    res.status(500).json({ message: "Failed to save code" });
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

server.listen(port);
