
const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();

app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({ message: "Campus Connect server is running!" });
});

// Posts API
app.use("/api/posts", require("./routes/posts"));

// Serve frontend files later from the public folder
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected successfully!");

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });
