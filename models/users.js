var mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  realname: { type: String, required: true },
  email: { type: String, unique: true },
  mob: {type: Number, default: 0},
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: String,
});

mongoose.model("User", userSchema);
