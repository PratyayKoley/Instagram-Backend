const mongoose = require("mongoose");

const storiesSchema = new mongoose.Schema({
  story_url: { type: String, required: true },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  createdAt: { type: String },
});

mongoose.model("Stories", storiesSchema);
