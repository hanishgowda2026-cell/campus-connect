
const mongoose = require("mongoose");
const crypto = require("crypto");

// ==========================================
// CAMPUS CONNECT — STUDENT USER MODEL
// ==========================================

const userSchema = new mongoose.Schema(
  {
    // Student's display name
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60
    },

    // Student's email address
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please enter a valid email address"
      ]
    },

    // Password hash only.
    // Never store the original password.
    passwordHash: {
      type: String,
      required: true,
      select: false
    },

    // Salt used to hash the password
    passwordSalt: {
      type: String,
      required: true,
      select: false
    },

    // Student's college name
    college: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },

    // Optional student USN / roll number
    studentId: {
      type: String,
      trim: true,
      maxlength: 40,
      default: ""
    },

    // Profile picture can be added later
    avatarUrl: {
      type: String,
      default: ""
    },

    // Verification will be implemented later.
    // Registration alone does not verify college identity.
    isVerified: {
      type: Boolean,
      default: false
    },

    // Account status
    isActive: {
      type: Boolean,
      default: true
    },

    // Role-based access
    role: {
      type: String,
      enum: ["student", "admin"],
      default: "student"
    },

    // Number of meetups created
    meetupsCreated: {
      type: Number,
      default: 0,
      min: 0
    },

    // Last successful login
    lastLogin: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// ==========================================
// PASSWORD SECURITY
// ==========================================

// Hash passwords using Node.js built-in scrypt.
// This avoids storing plaintext passwords.

userSchema.methods.setPassword = async function (
  password
) {
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  ) {
    throw new Error(
      "Password must be between 8 and 128 characters"
    );
  }

  const salt = crypto.randomBytes(16).toString("hex");

  const hash = await new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      64,
      (error, derivedKey) => {
        if (error) {
          return reject(error);
        }

        resolve(derivedKey.toString("hex"));
      }
    );
  });

  this.passwordSalt = salt;
  this.passwordHash = hash;
};

// ==========================================
// VERIFY PASSWORD
// ==========================================

userSchema.methods.verifyPassword = async function (
  password
) {
  if (
    typeof password !== "string" ||
    !this.passwordSalt ||
    !this.passwordHash
  ) {
    return false;
  }

  const storedHash = Buffer.from(
    this.passwordHash,
    "hex"
  );

  if (storedHash.length !== 64) {
    return false;
  }

  const suppliedHash = await new Promise(
    (resolve, reject) => {
      crypto.scrypt(
        password,
        this.passwordSalt,
        64,
        (error, derivedKey) => {
          if (error) {
            return reject(error);
          }

          resolve(derivedKey);
        }
      );
    }
  );

  return crypto.timingSafeEqual(
    storedHash,
    suppliedHash
  );
};

// ==========================================
// SAFE PUBLIC PROFILE
// ==========================================

userSchema.methods.toPublicProfile = function () {
  return {
    id: this._id,
    name: this.name,
    college: this.college,
    avatarUrl: this.avatarUrl,
    isVerified: this.isVerified
  };
};

// ==========================================
// SAFE ACCOUNT PROFILE
// ==========================================

userSchema.methods.toAccountProfile = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    college: this.college,
    studentId: this.studentId,
    avatarUrl: this.avatarUrl,
    isVerified: this.isVerified,
    role: this.role,
    meetupsCreated: this.meetupsCreated,
    createdAt: this.createdAt
  };
};

// ==========================================
// EXPORT MODEL
// ==========================================

module.exports = mongoose.model(
  "User",
  userSchema
);

