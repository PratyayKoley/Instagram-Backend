var mongoose = require("mongoose");

const likesSchema = new mongoose.Schema({
  post_id: { type: mongoose.Schema.Types.ObjectId, ref: "posts", required: true },
  user_name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now() },
});

mongoose.model("Likes", likesSchema);
