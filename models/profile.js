const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema({
  username: {type: String, required: true},
  num_posts: {type: Number, default: 0},
  num_followers: {type: Number, default: 0},
  num_following: {type: Number, default: 0},
  bio: {type: String, default: ""},
  posts_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Posts'},
  createdAt: String,
});

mongoose.model("Profile", profileSchema);