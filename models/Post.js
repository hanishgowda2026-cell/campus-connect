
const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    author: {
      type: String,
      default: "Student"
    },
    likes: {
      type: Number,
      default: 0
    },
    category: {
      type: String,
      enum: [
        "Workshop",
        "Placement",
        "Academics",
        "Event",
        "General"
      ],
      default: "General"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Post", postSchema);
