
const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
    },

    author: {
      type: String,
      default: "Student",
    },

    category: {
      type: String,
      enum: [
        "Academics",
        "Test & Exam",
        "Placement",
        "Workshop",
        "Party",
        "Concert",
        "Cultural Event",
        "Sports",
        "Seminar",
        "Competition",
        "Announcement",
        "General",
        "Event",
      ],
      default: "General",
    },

    likes: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Post", postSchema);
