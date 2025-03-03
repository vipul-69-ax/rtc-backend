const { Router } = require("express");
const authMiddleware = require("../middleware/auth");
const { createProfile, checkProfileExists, getProfile } = require("../controllers/profile");

const ProfileRouter = Router()

ProfileRouter.post("/create", authMiddleware, createProfile);
ProfileRouter.post("/exists", authMiddleware, checkProfileExists);
ProfileRouter.get("/", authMiddleware, getProfile);

module.exports = ProfileRouter