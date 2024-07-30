const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  post_id: { type: mongoose.Schema.Types.ObjectId, ref: "posts", required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, red: "users", required: true },
  comment_desc: {type: String},
  createdAt: {type: String},
});

mongoose.model("Comments", commentSchema);
