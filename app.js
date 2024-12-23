const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { default: mongoose, model, mongo } = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const { createServer } = require("http");
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
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

const userData = mongoose.model("Users", users.userSchema);
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
    origin: process.env.FRONTEND_LINK,
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
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET
})
const uploadsPath = path.join(__dirname, "./uploads");
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

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
    const { from, to, message } = data;

    try {
      // Ensure 'from' and 'to' are valid ObjectIds
      const fromUser = await userData.findOne({ username: from });
      const toUser = await userData.findOne({ username: to });

      if (!fromUser) {
        throw new Error("Invalid 'from' user");
      }
      if (!toUser) {
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

    console.log(profileData);
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
      user_id: data._id,
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

app.post("/get-user-data-by-id", async (req, res) => {
  const { user_id } = req.body;

  try {
    const data = await userData.findById(user_id);
    res.send({
      userData: true,
      data: data,
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
      id: user._id,
      num_posts: userProfile.num_posts,
      followers: userProfile.followers,
      following: userProfile.following,
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

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueName}${path.extname(file.originalname)}`);
  }
})

const upload = multer({ storage: storage });

const cloudinaryUpload = async (localFilePath) => {
  try {
    if (!localFilePath) {
      return null;
    }
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto"
    })
    fs.unlinkSync(localFilePath);
    return response.secure_url;
  } catch (error) {
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    throw error;
  }
}

app.post("/uploads", upload.array("file", 10), async (req, res) => {
  try {
    const { description, userName } = req.body;

    const response = await fetch(`${process.env.BACKEND_LINK}/get-user-data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userName }),
    })

    const responseData = await response.json();

    if (responseData.userData) {
      user_id = responseData.user_id;
    }

    const files = req.files;

    if (!files || files.length === 0) {
      return res.send({
        success: false,
        message: "No files were uploaded."
      })
    }

    const cloudinaryURLs = [];

    for (const file of files) {
      const format = Math.random() < 0.5 ? "avif" : "webp";
      const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const formattedFilePath = `./uploads/${uniqueName}.${format}`;

      await sharp(file.path).toFormat(format).toFile(formattedFilePath);
      fs.unlink(file.path, (err) => {
        if (err) {
          console.error('Error deleting file:', err.message);
        }
      });

      const uploadedURL = await cloudinaryUpload(formattedFilePath);
      cloudinaryURLs.push(uploadedURL);
    }

    const newPost = postData.create({
      post_url: cloudinaryURLs.join(", "),
      post_desc: description,
      user_id: user_id,
    })

    const profilePostsUpdate = await profileData.updateOne({ user_id: user_id }, { $inc: { num_posts: 1 } });
    if (newPost && profilePostsUpdate) {
      res.send({
        success: true,
        postData: newPost,
        message: "Posts uploaded successfully and incremented",
      })
    }
  } catch (error) {
    console.error(error);
    return res.send({
      success: false,
      message: "Internal Server Error",
    })
  }
});

app.get("/posts/:id", async (req, res) => {
  try {
    const userId = req.params.id;

    const posts = await postData.find({ user_id: userId })
      .sort({ createdAt: -1 });

    if (!posts || posts.length === 0) {
      return res.send({
        success: false,
        message: "No posts found",
      })
    }

    return res.send({
      success: true,
      posts: posts,
      message: "Posts successfully found",
    })
  }
  catch (err) {
    return res.send({
      success: false,
      message: "Internal Server Error",
    })
  }
})

app.post("/post-comment", async (req, res) => {
  try {
    const { comment, commentor_name, post_id } = req.body;

    if (!comment || !commentor_name || !post_id) {
      return;
    }

    const newComment = await commentsData.create({
      post_id: post_id,
      user_name: commentor_name,
      comment_desc: comment
    });

    if (!newComment) {
      return res.send({
        success: false,
        message: "No comments were found",
      })
    }

    res.send({
      success: true,
      commentData: newComment,
      message: "Comment was added",
    })
  } catch (err) {
    console.error("Error: ", err.message);
    return res.send({
      success: false,
      message: "Internal Server Error",
    })
  }
});

app.post("/get-comments", async (req, res) => {
  try {
    const { post_id } = req.body;

    if (!post_id) {
      return;
    }

    const allComments = await commentsData.find({ post_id: post_id });

    if (!allComments) {
      return res.send({
        success: false,
        message: "No comments were found",
      })
    }

    res.send({
      success: true,
      commentData: allComments,
      message: "Comments found successfully",
    })
  } catch (error) {
    console.error("Error: ", error);
    res.send({
      success: false,
      message: "Internal Server Error",
    })
  }
});

app.post("/post-likes", async (req, res) => {
  try {
    const { post_id, liker_name } = req.body;

    if (!post_id || !liker_name) {
      return;
    }

    const postLikes = await likesData.create({
      post_id: post_id,
      user_name: liker_name,
    });

    if (!postLikes) {
      return res.send({
        success: false,
        message: "Invalid post id or username",
      })
    }

    res.send({
      success: true,
      likeData: postLikes,
      message: "Likes were successfully posted",
    })
  } catch (error) {
    console.error("Error: ", error);
    res.send({
      success: false,
      message: "Internal Server Error",
    })
  }
});

app.delete("/post-likes", async (req, res) => {
  try {
    const { post_id, liker_name } = req.body;

    if (!post_id || !liker_name) {
      return;
    }

    const postLikes = await likesData.deleteOne({
      post_id: post_id,
      user_name: liker_name,
    });

    if (!postLikes) {
      return res.send({
        success: false,
        message: "Invalid post id or username",
      })
    }

    res.send({
      success: true,
      likeData: postLikes,
      message: "Likes were successfully deleted.",
    })
  } catch (error) {
    console.error("Error: ", error);
    res.send({
      success: false,
      message: "Internal Server Error",
    })
  }
})

app.post("/get-post-like", async (req, res) => {
  try {
    const { post_id, liker_name } = req.body;

    if (!post_id || !liker_name) {
      return;
    }

    const isLiked = await likesData.findOne({
      post_id: post_id,
      user_name: liker_name,
    });

    if (!isLiked) {
      return res.send({
        success: false,
        message: "No likes found",
      })
    }

    res.send({
      success: true,
      message: "Likes found",
    })
  } catch (error) {
    console.error("Error: ", error);
    res.send({
      success: false,
      message: "Internal Server Error",
    })
  }
})

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

app.post("/follow", async (req, res) => {
  try {
    const { userToFollowID, currentUserID } = req.body;

    if (!userToFollowID || !currentUserID) {
      return res.send({
        success: false,
        message: "User not found",
      })
    }


    const userToFollowProfile = await profileData.findOne({ user_id: userToFollowID });
    const currentUserProfile = await profileData.findOne({ user_id: currentUserID });

    if (!currentUserProfile.following.includes(userToFollowID)) {
      currentUserProfile.following.push(userToFollowID);
      userToFollowProfile.followers.push(currentUserID);

      await currentUserProfile.save();
      await userToFollowProfile.save();

      res.send({
        success: true,
        message: "Successfully followed the user.",
      })
    } else {
      res.send({
        success: false,
        message: "You are already following the user.",
      })
    }
  } catch (error) {
    console.error("Error: ", error);
    res.send({
      success: false,
      message: "Internal Server Error",
    })
  }
});

app.post("/unfollow", async (req, res) => {
  try {
    const { userToUnfollowID, currentUserID } = req.body;

    if (!userToUnfollowID || !currentUserID) {
      return res.send({
        success: false,
        message: "No user Found.",
      })
    }

    const userToUnfollowProfile = await profileData.findOne({ user_id: userToUnfollowID });
    const currentUserProfile = await profileData.findOne({ user_id: currentUserID });

    if (currentUserProfile.following.includes(userToUnfollowID)) {
      currentUserProfile.following = currentUserProfile.following.filter((id) => {
        id.toString() !== userToUnfollowID.toString();
      });
      userToUnfollowProfile.followers = userToUnfollowProfile.followers.filter((id) => {
        id.toString() !== currentUserID.toString();
      });

      await currentUserProfile.save();
      await userToUnfollowProfile.save();

      res.send({
        success: true,
        message: "Successfully unfollowed the user",
      })
    } else {
      res.send({
        success: false,
        message: "You are not following this user.",
      })
    }
  } catch (error) {
    console.error("Error: ", error);
    res.send({
      success: false,
      message: "Internal Server Error",
    })
  }
})

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

// storiesData.create({
//   story_url: String,
//   user_id: '669c0dec7406d0e13fc36a54',
//   createdAt: new Date(),
// });

// notificationsData.create({
//   user_id: '669c0dec7406d0e13fc36a54',
//   createdAt: new Date(),
// });

server.listen(port);
