var mongoose = require("mongoose");

const likesSchema = new mongoose.Schema({
  post_id: { type: mongoose.Schema.Types.ObjectId, ref: "posts", required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
  createdAt: { type: String },
});

mongoose.model("Likes", likesSchema);
