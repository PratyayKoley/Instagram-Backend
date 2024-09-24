var mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    from: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true,
    },
    to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    createdAt: {
        type: String,
    },
    isRead: {
        type: Boolean,
    }
})

mongoose.model("Messages", messageSchema);