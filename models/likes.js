var mongoose = require("mongoose");

const likesSchema = new mongoose.Schema({
  post_id: { type: mongoose.Schema.Types.ObjectId, ref: "posts", required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
  createdAt: { type: Date, default: Date.now() },
});

mongoose.model("Likes", likesSchema);
