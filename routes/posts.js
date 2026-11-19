

const express = require("express");
const router = express.Router();

const Post = require("../models/Post");
const { categorizePost } = require("../services/aiCategorizer");

const CATEGORIES = [
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
  "Event"
];

// GET all posts
router.get("/", async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);

    res.status(500).json({
      message: "Failed to load posts"
    });
  }
});

// CREATE post with automatic AI categorization
router.post("/", async (req, res) => {
  try {
    const { title, content } = req.body;

    if (
      typeof title !== "string" ||
      typeof content !== "string" ||
      !title.trim() ||
      !content.trim()
    ) {
      return res.status(400).json({
        message: "Title and content are required"
      });
    }

    const cleanTitle = title.trim();
    const cleanContent = content.trim();

    console.log("Starting AI categorization...");

    let category = "General";

    try {
      const predicted = await categorizePost(
        cleanTitle,
        cleanContent
      );

      if (CATEGORIES.includes(predicted)) {
        category = predicted;
      }

      console.log("Selected category:", category);
    } catch (error) {
      console.error(
        "AI categorization failed:",
        error.message
      );
    }

    const newPost = await Post.create({
      title: cleanTitle,
      content: cleanContent,
      category
    });

    res.status(201).json(newPost);
  } catch (error) {
    console.error("Error creating post:", error);

    res.status(500).json({
      message: "Failed to create post"
    });
  }
});

// LIKE a post
router.patch("/:id/like", async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        message: "Invalid post ID"
      });
    }

    const updatedPost = await Post.findByIdAndUpdate(
      id,
      { $inc: { likes: 1 } },
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedPost) {
      return res.status(404).json({
        message: "Post not found"
      });
    }

    res.json(updatedPost);
  } catch (error) {
    console.error("Error liking post:", error);

    res.status(500).json({
      message: "Failed to like post"
    });
  }
});

module.exports = router;
