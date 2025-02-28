const { Router } = require("express");
const authMiddleware = require("../middleware/auth");
const { createProfile } = require("../controllers/profile");

const ProfileRouter = Router()

ProfileRouter.post("/create", authMiddleware, createProfile);

module.exports = ProfileRouter