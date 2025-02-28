const { Router } = require("express");
const { register, login, protectedRoute, verifyEmail } = require("../controllers/auth");

const AuthRouter = Router()

AuthRouter.post("/register", register);
AuthRouter.post("/login", login);
AuthRouter.post("/verify-email", verifyEmail);


module.exports = AuthRouter