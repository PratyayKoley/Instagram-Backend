const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema({
  realname: {type: String, required: true},
  username: {type: String, required: true},
  num_posts: {type: Number, default: 0},
  num_followers: {type: Number, default: 0},
  num_following: {type: Number, default: 0},
  bio: {type: String, default: ""},
  user_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Users'},
  createdAt: String,
});

mongoose.model("Profile", profileSchema);