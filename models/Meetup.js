
const mongoose = require("mongoose");

// ==========================================
// CAMPUS CONNECT — QUICKMEET MODEL
// ==========================================

const MEETUP_CATEGORIES = [
  "Coffee & Chat",
  "Study Group",
  "Sports",
  "Food & Hangout",
  "Gaming",
  "Project Collaboration",
  "Campus Walk",
  "Other"
];

const meetupSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 100
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },

    category: {
      type: String,
      enum: MEETUP_CATEGORIES,
      default: "Other"
    },

    // Public name shown to other students.
    // Verified student identity will be handled
    // by the authentication phase.
    organizerName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60
    },

    // Future authenticated account reference.
    // Do not use organizerName as authorization.
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    // Public meeting location, such as:
    // College Canteen, Library, Sports Ground.
    meetingPoint: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },

    // GeoJSON location of the public meeting point.
    // Coordinates must be [longitude, latitude].
    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
        default: "Point"
      },

      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator(value) {
            return (
              Array.isArray(value) &&
              value.length === 2 &&
              Number.isFinite(value[0]) &&
              Number.isFinite(value[1]) &&
              value[0] >= -180 &&
              value[0] <= 180 &&
              value[1] >= -90 &&
              value[1] <= 90
            );
          },
          message: "Invalid meetup coordinates"
        }
      }
    },

    startTime: {
      type: Date,
      required: true
    },

    endTime: {
      type: Date,
      required: true,
      validate: {
        validator(value) {
          return (
            !this.startTime ||
            value > this.startTime
          );
        },
        message: "End time must be after start time"
      }
    },

    maxParticipants: {
      type: Number,
      required: true,
      min: 2,
      max: 30,
      default: 5
    },

    // The organizer is included in participants
    // once an authenticated student account exists.
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    joinRequests: [
      {
        studentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true
        },

        requestedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],

    status: {
      type: String,
      enum: [
        "Open",
        "Full",
        "Completed",
        "Cancelled"
      ],
      default: "Open"
    }
  },
  {
    timestamps: true
  }
);

// ==========================================
// GEOLOCATION INDEX
// ==========================================

// Enables efficient nearby-meetup queries
// using MongoDB geospatial operations.

meetupSchema.index({
  location: "2dsphere"
});

// ==========================================
// HELPER METHODS
// ==========================================

meetupSchema.methods.getAvailableSpots = function () {
  return Math.max(
    0,
    this.maxParticipants - this.participants.length
  );
};

meetupSchema.methods.isFull = function () {
  return (
    this.participants.length >= this.maxParticipants
  );
};

meetupSchema.methods.hasStarted = function () {
  return new Date() >= this.startTime;
};

meetupSchema.methods.hasEnded = function () {
  return new Date() >= this.endTime;
};

module.exports = mongoose.model(
  "Meetup",
  meetupSchema
);
