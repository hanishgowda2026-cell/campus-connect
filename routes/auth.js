
const express = require("express");
const rateLimit = require("express-rate-limit");

const User = require("../models/User");

const router = express.Router();

// ==========================================
// CAMPUS CONNECT — AUTHENTICATION API
// ==========================================

// Limit repeated login and registration requests.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message: "Too many attempts. Please try again later."
  }
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function isValidEmail(email) {
  return (
    typeof email === "string" &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function isValidText(value, min, max) {
  return (
    typeof value === "string" &&
    value.trim().length >= min &&
    value.trim().length <= max
  );
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) return reject(error);
      resolve();
    });
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) return reject(error);
      resolve();
    });
  });
}

function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => {
      if (error) return reject(error);
      resolve();
    });
  });
}

// ==========================================
// AUTHENTICATION MIDDLEWARE
// ==========================================

// Other routes can import this middleware
// to require an authenticated student.

async function requireAuth(req, res, next) {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({
        message: "Please log in to continue."
      });
    }

    const user = await User.findById(
      req.session.userId
    );

    if (!user || !user.isActive) {
      return res.status(401).json({
        message: "Your session is no longer valid."
      });
    }

    req.user = user;
    next();

  } catch (error) {
    console.error("Authentication error:", error);

    res.status(500).json({
      message: "Authentication failed."
    });
  }
}

// ==========================================
// POST /api/auth/register
// Register a student account
// ==========================================

router.post("/register", authLimiter, async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      college,
      studentId
    } = req.body || {};

    const normalizedEmail =
      typeof email === "string"
        ? email.trim().toLowerCase()
        : "";

    if (!isValidText(name, 2, 60)) {
      return res.status(400).json({
        message: "Name must contain 2–60 characters."
      });
    }

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        message: "Please enter a valid email address."
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 128
    ) {
      return res.status(400).json({
        message: "Password must contain 8–128 characters."
      });
    }

    if (!isValidText(college, 2, 120)) {
      return res.status(400).json({
        message: "Please enter your college name."
      });
    }

    if (
      studentId !== undefined &&
      (
        typeof studentId !== "string" ||
        studentId.trim().length > 40
      )
    ) {
      return res.status(400).json({
        message: "Invalid student ID."
      });
    }

    const existingUser = await User.exists({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists."
      });
    }

    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      college: college.trim(),
      studentId:
        typeof studentId === "string"
          ? studentId.trim()
          : "",
      role: "student",
      isVerified: false
    });

    await user.setPassword(password);
    await user.save();

    // Rotate the session ID before login.
    await regenerateSession(req);

    req.session.userId = user._id.toString();

    await saveSession(req);

    return res.status(201).json({
      success: true,
      message: "Account created successfully!",
      user: user.toAccountProfile()
    });

  } catch (error) {
    console.error("Registration error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists."
      });
    }

    return res.status(500).json({
      message: "Unable to register. Please try again."
    });
  }
});

// ==========================================
// POST /api/auth/login
// Log in an existing student
// ==========================================

router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const normalizedEmail =
      typeof email === "string"
        ? email.trim().toLowerCase()
        : "";

    if (
      !isValidEmail(normalizedEmail) ||
      typeof password !== "string" ||
      password.length > 128
    ) {
      return res.status(400).json({
        message: "Invalid email or password."
      });
    }

    // Password fields are excluded by default
    // in the User model, so select them explicitly.
    const user = await User.findOne({
      email: normalizedEmail
    }).select("+passwordHash +passwordSalt");

    if (!user || !user.isActive) {
      return res.status(401).json({
        message: "Invalid email or password."
      });
    }

    const passwordCorrect =
      await user.verifyPassword(password);

    if (!passwordCorrect) {
      return res.status(401).json({
        message: "Invalid email or password."
      });
    }

    await regenerateSession(req);

    req.session.userId = user._id.toString();

    await saveSession(req);

    await User.updateOne(
      { _id: user._id },
      { $set: { lastLogin: new Date() } }
    );

    return res.json({
      success: true,
      message: "Login successful!",
      user: user.toAccountProfile()
    });

  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Unable to log in. Please try again."
    });
  }
});

// ==========================================
// GET /api/auth/me
// Get current logged-in student
// ==========================================

router.get("/me", requireAuth, (req, res) => {
  res.json({
    success: true,
    user: req.user.toAccountProfile()
  });
});

// ==========================================
// POST /api/auth/logout
// End the current session
// ==========================================

router.post("/logout", async (req, res) => {
  try {
    if (req.session) {
      await destroySession(req);
    }

    res.clearCookie("campus.sid", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });

    return res.json({
      success: true,
      message: "Logged out successfully."
    });

  } catch (error) {
    console.error("Logout error:", error);

    return res.status(500).json({
      message: "Unable to log out."
    });
  }
});

// ==========================================
// EXPORTS
// ==========================================

module.exports = router;
module.exports.requireAuth = requireAuth;
