const mongoose = require("mongoose");

const notificationsSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: "users",
    required: true,
  },
  createdAt: { type: String },
});

mongoose.model("Notifications", notificationsSchema);
