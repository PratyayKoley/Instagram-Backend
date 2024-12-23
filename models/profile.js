const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema({
  num_posts: { type: Number, default: 0 },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Users', default: [] }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Users', default: [] }],
  bio: { type: String, default: "" },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Users' },
  createdAt: String,
});

mongoose.model("Profile", profileSchema); 