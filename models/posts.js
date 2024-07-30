var mongoose = require("mongoose");

const postSchema = new mongoose.Schema({
  post_url: { type: String, required: true },
  num_likes: { type: Number, default: 0 },
  num_comments: { type: Number, default: 0 },
  post_desc: { type: String, default: "" },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  createdAt: {type: String},
});

mongoose.model("Posts", postSchema);
