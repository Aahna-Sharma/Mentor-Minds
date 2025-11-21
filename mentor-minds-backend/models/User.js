// models/User.js
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: { type: String, required: true },
  role: {
    type: String,
    enum: ["student", "teacher", "admin"],
    default: "student",
  },
  createdAt: { type: Date, default: Date.now },
  avatar: { type: String }, // optional, from social providers
});

module.exports = mongoose.model("User", UserSchema);
