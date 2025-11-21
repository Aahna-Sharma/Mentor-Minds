// routes/auth.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const admin = require("../firebaseAdmin"); // Firebase Admin SDK
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;
const ACCESS_EXPIRES = process.env.JWT_EXPIRES || "15m";
const REFRESH_EXPIRES = process.env.REFRESH_EXPIRES || "30d";

// COOKIE_SECURE: set explicit env var 'COOKIE_SECURE' to 'true' when using HTTPS (ngrok or prod).
const COOKIE_SECURE =
  process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";

function createAccessToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, {
    expiresIn: ACCESS_EXPIRES,
  });
}
function createRefreshToken(user) {
  return jwt.sign({ id: user._id }, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES,
  });
}

// middleware to protect routes
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "email and password required" });
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: "User already exists" });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const user = new User({ name, email, passwordHash, role });
    await user.save();

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: "None",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      accessToken,
    });
  } catch (err) {
    console.error("register error", err);
    res.status(500).json({ error: "Server error" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "email and password required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: "None",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      accessToken,
    });
  } catch (err) {
    console.error("login error", err);
    res.status(500).json({ error: "Server error" });
  }
});

// REFRESH
router.post("/refresh", async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ error: "No refresh token" });
    const payload = jwt.verify(token, REFRESH_SECRET);
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ error: "User not found" });

    const accessToken = createAccessToken(user);
    return res.json({ accessToken });
  } catch (err) {
    console.error("refresh error", err);
    return res.status(401).json({ error: "Invalid refresh token" });
  }
});

// LOGOUT
router.post("/logout", (_req, res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "None",
  });
  return res.json({ ok: true });
});

// PROFILE
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-passwordHash");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) {
    console.error("me error", err);
    res.status(500).json({ error: "Server error" });
  }
});

// SOCIAL login via Firebase ID token
// body: { idToken }
router.post("/social", async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: "Missing idToken" });

    // verify idToken with Firebase Admin
    const decoded = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name, picture } = decoded;

    // Try to find user by email
    let user = null;
    if (email) user = await User.findOne({ email });

    if (!user) {
      user = new User({
        name: name || `User-${uid}`,
        email: email || `firebase_${uid}@no-email.firebase`,
        passwordHash: "__social__",
        avatar: picture || "",
      });
      await user.save();
    } else {
      // optional: update avatar/name if changed
      let changed = false;
      if (name && user.name !== name) {
        user.name = name;
        changed = true;
      }
      if (picture && user.avatar !== picture) {
        user.avatar = picture;
        changed = true;
      }
      if (changed) await user.save();
    }

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: "None",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
      accessToken,
    });
  } catch (err) {
    console.error("social auth error", err);
    return res.status(401).json({ error: "Invalid social auth token" });
  }
});

module.exports = router;
