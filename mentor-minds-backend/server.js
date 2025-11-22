// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const authRoutes = require("./routes/auth");

const app = express();

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// Use GitHub Pages URL as frontend default
const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN || "https://aahna-sharma.github.io";

app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: [
      "http://127.0.0.1:5500",
      "http://localhost:5500",
      "https://page-supermolten-tobias.ngrok-free.app", // ngrok
      FRONTEND_ORIGIN, // GitHub Pages
    ],
    credentials: true,
  })
);

app.use("/api/auth", authRoutes);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });
