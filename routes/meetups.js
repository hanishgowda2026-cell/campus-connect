
const express = require("express");
const mongoose = require("mongoose");

const Meetup = require("../models/Meetup");
const User = require("../models/User");

const { requireAuth } = require("./auth");

const router = express.Router();

// ==========================================
// CAMPUS CONNECT — QUICKMEET API
// ==========================================

const CATEGORIES = [
  "Coffee & Chat",
  "Study Group",
  "Sports",
  "Food & Hangout",
  "Gaming",
  "Project Collaboration",
  "Campus Walk",
  "Other"
];

const MAX_RADIUS = 5000;
const DEFAULT_RADIUS = 2000;
const MAX_DURATION = 12 * 60 * 60 * 1000;
const MAX_ADVANCE = 30 * 24 * 60 * 60 * 1000;

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function validText(value, min, max) {
  return (
    typeof value === "string" &&
    value.trim().length >= min &&
    value.trim().length <= max
  );
}

function validCoordinates(lng, lat) {
  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

function sameId(a, b) {
  return String(a) === String(b);
}

function publicMeetup(meetup, currentUserId = null) {
  const data = meetup.toObject();

  delete data.organizerId;
  delete data.participants;
  delete data.joinRequests;

  const participants = meetup.participants || [];
  const requests = meetup.joinRequests || [];

  const isOrganizer =
    currentUserId &&
    sameId(meetup.organizerId, currentUserId);

  const isParticipant =
    currentUserId &&
    participants.some((id) => sameId(id, currentUserId));

  const hasRequested =
    currentUserId &&
    requests.some((request) =>
      sameId(request.studentId, currentUserId)
    );

  return {
    ...data,
    participantCount: participants.length,
    availableSpots: Math.max(
      0,
      meetup.maxParticipants - participants.length
    ),
    isOrganizer: Boolean(isOrganizer),
    isParticipant: Boolean(isParticipant),
    hasRequested: Boolean(hasRequested),
    pendingRequestCount: isOrganizer
      ? requests.length
      : undefined
  };
}

function getCurrentUserId(req) {
  return req.session?.userId || null;
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const earthRadius = 6371000;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return Math.round(
    2 * earthRadius *
      Math.asin(Math.min(1, Math.sqrt(a)))
  );
}

function isValidId(id) {
  return mongoose.isValidObjectId(id);
}

function isActiveMeetup(meetup) {
  return (
    meetup.status === "Open" &&
    meetup.endTime > new Date()
  );
}

// ==========================================
// GET /api/meetups
// View upcoming meetups
// ==========================================

router.get("/", async (req, res) => {
  try {
    const filter = {
      status: "Open",
      endTime: { $gt: new Date() }
    };

    if (req.query.category) {
      if (!CATEGORIES.includes(req.query.category)) {
        return res.status(400).json({
          message: "Invalid meetup category."
        });
      }

      filter.category = req.query.category;
    }

    const meetups = await Meetup.find(filter)
      .sort({ startTime: 1 })
      .limit(50);

    res.json(
      meetups.map((meetup) =>
        publicMeetup(meetup, getCurrentUserId(req))
      )
    );

  } catch (error) {
    console.error("Get meetups error:", error);

    res.status(500).json({
      message: "Failed to load meetups."
    });
  }
});

// ==========================================
// GET /api/meetups/nearby
// Discover nearby public meeting points
// ==========================================

router.get("/nearby", async (req, res) => {
  try {
    if (
      req.query.lat === undefined ||
      req.query.lng === undefined
    ) {
      return res.status(400).json({
        message: "Latitude and longitude are required."
      });
    }

    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);

    if (!validCoordinates(lng, lat)) {
      return res.status(400).json({
        message: "Invalid GPS coordinates."
      });
    }

    const radius =
      req.query.radius === undefined
        ? DEFAULT_RADIUS
        : Number(req.query.radius);

    if (
      !Number.isFinite(radius) ||
      radius < 100 ||
      radius > MAX_RADIUS
    ) {
      return res.status(400).json({
        message: "Radius must be between 100 and 5000 meters."
      });
    }

    const filter = {
      status: "Open",
      endTime: { $gt: new Date() }
    };

    if (req.query.category) {
      if (!CATEGORIES.includes(req.query.category)) {
        return res.status(400).json({
          message: "Invalid meetup category."
        });
      }

      filter.category = req.query.category;
    }

    const meetups = await Meetup.find({
      ...filter,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat]
          },
          $maxDistance: radius
        }
      }
    }).limit(50);

    const results = meetups.map((meetup) => {
      const [meetupLng, meetupLat] =
        meetup.location.coordinates;

      return {
        ...publicMeetup(
          meetup,
          getCurrentUserId(req)
        ),
        distanceMeters: calculateDistance(
          lat,
          lng,
          meetupLat,
          meetupLng
        )
      };
    });

    res.json(results);

  } catch (error) {
    console.error("Nearby meetups error:", error);

    res.status(500).json({
      message: "Failed to find nearby meetups."
    });
  }
});

// ==========================================
// GET /api/meetups/mine
// My created and joined meetups
// ==========================================

router.get("/mine", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;

    const meetups = await Meetup.find({
      $or: [
        { organizerId: userId },
        { participants: userId },
        { "joinRequests.studentId": userId }
      ]
    })
      .sort({ startTime: 1 })
      .limit(100);

    res.json(
      meetups.map((meetup) =>
        publicMeetup(meetup, userId)
      )
    );

  } catch (error) {
    console.error("My meetups error:", error);

    res.status(500).json({
      message: "Failed to load your meetups."
    });
  }
});

// ==========================================
// GET /api/meetups/:id
// View a single meetup
// ==========================================

router.get("/:id", async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid meetup ID."
      });
    }

    const meetup = await Meetup.findById(
      req.params.id
    );

    if (!meetup) {
      return res.status(404).json({
        message: "Meetup not found."
      });
    }

    res.json(
      publicMeetup(meetup, getCurrentUserId(req))
    );

  } catch (error) {
    console.error("Meetup details error:", error);

    res.status(500).json({
      message: "Failed to load meetup."
    });
  }
});

// ==========================================
// POST /api/meetups
// Create a meetup
// ==========================================

router.post("/", requireAuth, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      meetingPoint,
      longitude,
      latitude,
      startTime,
      endTime,
      maxParticipants
    } = req.body || {};

    if (!validText(title, 3, 100)) {
      return res.status(400).json({
        message: "Title must contain 3–100 characters."
      });
    }

    if (!validText(description, 3, 500)) {
      return res.status(400).json({
        message: "Description must contain 3–500 characters."
      });
    }

    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({
        message: "Please select a valid category."
      });
    }

    if (!validText(meetingPoint, 3, 120)) {
      return res.status(400).json({
        message: "Enter a public campus meeting point."
      });
    }

    const lng = Number(longitude);
    const lat = Number(latitude);

    if (
      longitude === undefined ||
      latitude === undefined ||
      !validCoordinates(lng, lat)
    ) {
      return res.status(400).json({
        message: "Valid meeting-point coordinates are required."
      });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    const now = new Date();

    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime())
    ) {
      return res.status(400).json({
        message: "Enter valid meetup dates and times."
      });
    }

    if (
      start <= now ||
      start.getTime() - now.getTime() > MAX_ADVANCE
    ) {
      return res.status(400).json({
        message: "Meetup must start within the next 30 days."
      });
    }

    if (
      end <= start ||
      end.getTime() - start.getTime() > MAX_DURATION
    ) {
      return res.status(400).json({
        message: "Meetup duration must be 12 hours or less."
      });
    }

    const capacity = Number(maxParticipants);

    if (
      !Number.isInteger(capacity) ||
      capacity < 2 ||
      capacity > 30
    ) {
      return res.status(400).json({
        message: "Participant limit must be between 2 and 30."
      });
    }

    // The location must be a public meeting point.
    // GPS coordinates are never used for live tracking.
    // Public-place verification will be added later.

    const meetup = await Meetup.create({
      title: title.trim(),
      description: description.trim(),
      category,
      organizerName: req.user.name,
      organizerId: req.user._id,
      meetingPoint: meetingPoint.trim(),
      location: {
        type: "Point",
        coordinates: [lng, lat]
      },
      startTime: start,
      endTime: end,
      maxParticipants: capacity,
      participants: [req.user._id],
      joinRequests: [],
      status: "Open"
    });

    await User.updateOne(
      { _id: req.user._id },
      { $inc: { meetupsCreated: 1 } }
    );

    res.status(201).json({
      success: true,
      message: "Meetup created successfully!",
      meetup: publicMeetup(
        meetup,
        req.user._id
      )
    });

  } catch (error) {
    console.error("Create meetup error:", error);

    res.status(500).json({
      message: "Failed to create meetup."
    });
  }
});

// ==========================================
// POST /api/meetups/:id/join
// Request to join a meetup
// ==========================================

router.post("/:id/join", requireAuth, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid meetup ID."
      });
    }

    const userId = req.user._id;

    const meetup = await Meetup.findOneAndUpdate(
      {
        _id: req.params.id,
        status: "Open",
        endTime: { $gt: new Date() },
        organizerId: { $ne: userId },
        participants: { $ne: userId },
        "joinRequests.studentId": { $ne: userId },
        $expr: {
          $lt: [
            { $size: "$participants" },
            "$maxParticipants"
          ]
        }
      },
      {
        $push: {
          joinRequests: {
            studentId: userId,
            requestedAt: new Date()
          }
        }
      },
      { new: true, runValidators: true }
    );

    if (!meetup) {
      return res.status(409).json({
        message:
          "Unable to join. The meetup may be full, unavailable, or you have already requested to join."
      });
    }

    res.json({
      success: true,
      message: "Join request sent to the organizer!",
      meetup: publicMeetup(meetup, userId)
    });

  } catch (error) {
    console.error("Join request error:", error);

    res.status(500).json({
      message: "Failed to request joining."
    });
  }
});

// ==========================================
// GET /api/meetups/:id/requests
// Organizer views pending requests
// ==========================================

router.get(
  "/:id/requests",
  requireAuth,
  async (req, res) => {
    try {
      if (!isValidId(req.params.id)) {
        return res.status(400).json({
          message: "Invalid meetup ID."
        });
      }

      const meetup = await Meetup.findOne({
        _id: req.params.id,
        organizerId: req.user._id
      });

      if (!meetup) {
        return res.status(404).json({
          message: "Meetup not found or access denied."
        });
      }

      const ids = meetup.joinRequests.map(
        (request) => request.studentId
      );

      const users = await User.find({
        _id: { $in: ids },
        isActive: true
      });

      const userMap = new Map(
        users.map((user) => [
          String(user._id),
          user.toPublicProfile()
        ])
      );

      const requests = meetup.joinRequests
        .map((request) => ({
          student: userMap.get(
            String(request.studentId)
          ),
          requestedAt: request.requestedAt
        }))
        .filter((request) => request.student);

      res.json(requests);

    } catch (error) {
      console.error("Get join requests error:", error);

      res.status(500).json({
        message: "Failed to load join requests."
      });
    }
  }
);

// ==========================================
// POST /api/meetups/:id/requests/:studentId
// Organizer approves or rejects a request
//
// Body: { "action": "approve" }
// or    { "action": "reject" }
// ==========================================

router.post(
  "/:id/requests/:studentId",
  requireAuth,
  async (req, res) => {
    try {
      const { id, studentId } = req.params;
      const { action } = req.body || {};

      if (
        !isValidId(id) ||
        !isValidId(studentId)
      ) {
        return res.status(400).json({
          message: "Invalid meetup or student ID."
        });
      }

      if (!["approve", "reject"].includes(action)) {
        return res.status(400).json({
          message: "Action must be approve or reject."
        });
      }

      const filter = {
        _id: id,
        organizerId: req.user._id,
        "joinRequests.studentId":
          new mongoose.Types.ObjectId(studentId)
      };

      if (action === "approve") {
        filter.status = "Open";
        filter.endTime = { $gt: new Date() };
        filter.participants = {
          $ne: new mongoose.Types.ObjectId(studentId)
        };
        filter.$expr = {
          $lt: [
            { $size: "$participants" },
            "$maxParticipants"
          ]
        };
      }

      const update =
        action === "approve"
          ? {
              $pull: {
                joinRequests: {
                  studentId:
                    new mongoose.Types.ObjectId(studentId)
                }
              },
              $addToSet: {
                participants:
                  new mongoose.Types.ObjectId(studentId)
              }
            }
          : {
              $pull: {
                joinRequests: {
                  studentId:
                    new mongoose.Types.ObjectId(studentId)
                }
              }
            };

      const meetup = await Meetup.findOneAndUpdate(
        filter,
        update,
        {
          new: true,
          runValidators: true
        }
      );

      if (!meetup) {
        return res.status(409).json({
          message:
            "Request not found, meetup unavailable, or participant limit reached."
        });
      }

      res.json({
        success: true,
        message:
          action === "approve"
            ? "Student approved successfully!"
            : "Join request rejected.",
        meetup: publicMeetup(
          meetup,
          req.user._id
        )
      });

    } catch (error) {
      console.error("Review request error:", error);

      res.status(500).json({
        message: "Failed to process join request."
      });
    }
  }
);

// ==========================================
// PATCH /api/meetups/:id/cancel
// Organizer cancels a meetup
// ==========================================

router.patch(
  "/:id/cancel",
  requireAuth,
  async (req, res) => {
    try {
      if (!isValidId(req.params.id)) {
        return res.status(400).json({
          message: "Invalid meetup ID."
        });
      }

      const meetup = await Meetup.findOneAndUpdate(
        {
          _id: req.params.id,
          organizerId: req.user._id,
          status: "Open"
        },
        {
          $set: {
            status: "Cancelled"
          }
        },
        {
          new: true
        }
      );

      if (!meetup) {
        return res.status(404).json({
          message: "Active meetup not found or access denied."
        });
      }

      res.json({
        success: true,
        message: "Meetup cancelled successfully.",
        meetup: publicMeetup(
          meetup,
          req.user._id
        )
      });

    } catch (error) {
      console.error("Cancel meetup error:", error);

      res.status(500).json({
        message: "Failed to cancel meetup."
      });
    }
  }
);

// ==========================================
// EXPORT ROUTER
// ==========================================

module.exports = router;
