
const express = require("express");
const Post = require("../models/Post");

const router = express.Router();

// Get all posts
router.get("/", async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    console.error("Fetch posts error:", error.message);
    res.status(500).json({ message: "Failed to fetch posts" });
  }
});

// Create a new post
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

    const post = await Post.create({
      title: title.trim(),
      content: content.trim()
    });

    res.status(201).json(post);
  } catch (error) {
    console.error("Create post error:", error.message);
    res.status(500).json({ message: "Failed to create post" });
  }
});

module.exports = router;
