const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  post_id: { type: mongoose.Schema.Types.ObjectId, ref: "posts", required: true },
  user_name: { type: String, required: true },
  comment_desc: {type: String},
  createdAt: {type: Date, default: Date.now()},
});

mongoose.model("Comments", commentSchema);
