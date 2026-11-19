
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const session = require("express-session");
const MongoStore = require("connect-mongo");

const app = express();

const PORT = process.env.PORT || 5000;
const IS_PRODUCTION =
  process.env.NODE_ENV === "production";

// ==========================================
// CAMPUS CONNECT — SERVER CONFIGURATION
// ==========================================

// Render uses a reverse proxy.
// This is needed for secure cookies on HTTPS.
if (IS_PRODUCTION) {
  app.set("trust proxy", 1);
}

// Disable Express identification header
app.disable("x-powered-by");

// ==========================================
// ENVIRONMENT VALIDATION
// ==========================================

if (!process.env.MONGODB_URI) {
  console.error("Missing MONGODB_URI in .env");
  process.exit(1);
}

if (
  !process.env.SESSION_SECRET ||
  process.env.SESSION_SECRET.length < 32
) {
  console.error(
    "SESSION_SECRET must contain at least 32 characters."
  );
  process.exit(1);
}

// ==========================================
// BASIC MIDDLEWARE
// ==========================================

app.use(express.json({ limit: "100kb" }));

// Serve existing frontend
app.use(
  express.static(path.join(__dirname, "public"))
);

// ==========================================
// LOGIN SESSION CONFIGURATION
// ==========================================

app.use(
  session({
    name: "campus.sid",

    secret: process.env.SESSION_SECRET,

    resave: false,

    saveUninitialized: false,

    rolling: false,

    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,

      collectionName: "userSessions",

      ttl: 7 * 24 * 60 * 60,

      autoRemove: "native"
    }),

    cookie: {
      httpOnly: true,

      secure: IS_PRODUCTION,

      sameSite: "lax",

      maxAge: 7 * 24 * 60 * 60 * 1000,

      path: "/"
    }
  })
);

// ==========================================
// SAME-ORIGIN REQUEST PROTECTION
// ==========================================

// Protect state-changing API requests from
// being submitted by unrelated websites.

function requireSameOrigin(req, res, next) {
  const safeMethods = ["GET", "HEAD", "OPTIONS"];

  if (safeMethods.includes(req.method)) {
    return next();
  }

  const origin = req.get("origin");

  const fetchSite = req.get("sec-fetch-site");

  if (
    fetchSite &&
    !["same-origin", "none"].includes(fetchSite)
  ) {
    return res.status(403).json({
      message: "Cross-site requests are not allowed."
    });
  }

  if (origin) {
    let parsedOrigin;

    try {
      parsedOrigin = new URL(origin);
    } catch {
      return res.status(403).json({
        message: "Invalid request origin."
      });
    }

    const expectedOrigin =
      `${req.protocol}://${req.get("host")}`;

    if (parsedOrigin.origin !== expectedOrigin) {
      return res.status(403).json({
        message: "Request origin is not allowed."
      });
    }
  } else if (fetchSite !== "same-origin") {
    // Browsers normally send Origin and/or
    // Sec-Fetch-Site on state-changing requests.
    // Reject requests without either signal.
    return res.status(403).json({
      message: "Request origin is required."
    });
  }

  next();
}

app.use("/api", requireSameOrigin);

// ==========================================
// REQUEST LOGGING
// ==========================================

app.use("/api", (req, res, next) => {
  console.log(
    `[API] ${req.method} ${req.originalUrl}`
  );

  next();
});

// ==========================================
// IMPORT API ROUTES
// ==========================================

const postRoutes = require("./routes/posts");
const meetupRoutes = require("./routes/meetups");
const authRoutes = require("./routes/auth");

// ==========================================
// REGISTER API ROUTES
// ==========================================

// Existing AI-powered campus posts
app.use("/api/posts", postRoutes);

// QuickMeet discovery
app.use("/api/meetups", meetupRoutes);

// Student registration and login
app.use("/api/auth", authRoutes);

// ==========================================
// SERVER TEST
// ==========================================

app.get("/api/test-quickmeet", (req, res) => {
  res.json({
    success: true,
    message: "QuickMeet server is working!",
    server: "Campus Connect"
  });
});

// ==========================================
// DATABASE HEALTH CHECK
// ==========================================

app.get("/api/health", (req, res) => {
  const connected =
    mongoose.connection.readyState === 1;

  res.status(connected ? 200 : 503).json({
    status: connected
      ? "OK"
      : "Database unavailable",

    application: "Campus Connect",

    database: connected
      ? "Connected"
      : "Disconnected",

    features: [
      "AI Campus Posts",
      "Category Filters",
      "Campus Dashboard",
      "Post Likes",
      "QuickMeet Discovery",
      "Student Authentication"
    ],

    timestamp: new Date().toISOString()
  });
});

// ==========================================
// FRONTEND
// ==========================================

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

// ==========================================
// API 404 HANDLER
// ==========================================

app.use("/api", (req, res) => {
  res.status(404).json({
    message: "API endpoint not found",
    path: req.originalUrl
  });
});

// ==========================================
// GLOBAL ERROR HANDLER
// ==========================================

app.use((error, req, res, next) => {
  console.error("Server error:", error);

  if (error.type === "entity.too.large") {
    return res.status(413).json({
      message: "Request body is too large."
    });
  }

  if (
    error instanceof SyntaxError &&
    "body" in error
  ) {
    return res.status(400).json({
      message: "Invalid JSON request."
    });
  }

  res.status(500).json({
    message: "Internal server error."
  });
});

// ==========================================
// CONNECT DATABASE AND START SERVER
// ==========================================

async function startServer() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI
    );

    console.log(
      "MongoDB connected successfully!"
    );

    const server = app.listen(PORT, () => {
      console.log("==============================");
      console.log("CAMPUS CONNECT SERVER STARTED");
      console.log("==============================");
      console.log(`Port: ${PORT}`);
      console.log(
        `Local URL: http://localhost:${PORT}`
      );
      console.log(
        "Campus Connect AI Posts: Enabled"
      );
      console.log(
        "QuickMeet API: Enabled"
      );
      console.log(
        "Student Authentication: Enabled"
      );
      console.log("==============================");
    });

    server.on("error", (error) => {
      console.error(
        "Server listening error:",
        error.message
      );

      process.exit(1);
    });

  } catch (error) {
    console.error(
      "Failed to start Campus Connect:",
      error.message
    );

    process.exit(1);
  }
}

startServer();
