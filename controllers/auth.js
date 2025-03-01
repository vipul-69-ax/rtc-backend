require("dotenv").config()
const { pool } =  require("../config/db.pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;
const _crypto = require("crypto")
const {sendVerificationEmail} = require('../config/mailer')

const register = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email and password required" });

  try {
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate a 6-digit verification code
    const verificationCode = _crypto.randomInt(100000, 999999).toString();

    // Insert into DB
    const result = await pool.query(
      "INSERT INTO users (email, password, verification_code) VALUES ($1, $2, $3) RETURNING id, email",
      [email, hashedPassword, verificationCode]
    );

    // Send verification email
    await sendVerificationEmail(email, verificationCode);

    res.status(201).json({ message: "Verification email sent. Please verify your account." });
  } catch (err) {
    res.status(500).json({ message: "Error registering user", error: err.message });
  }
};

const login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password required" });
    try {
      const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
      if (result.rows.length === 0) return res.status(401).json({ message: "Invalid email or password" });
      const user = result.rows[0];
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) return res.status(401).json({ message: "Invalid email or password" });
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "1h" });
      res.json({ token });
    } catch (err) {
      res.status(500).json({ message: "Error logging in", error: err.message });
    }
};

const protectedRoute = (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.status(200).json({ message: "Access granted", userId: decoded.userId });
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

const verifyEmail = async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ message: "Email and code required" });

  try {
    // Find user
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });

    const user = result.rows[0];
    
    // Check verification code
    if (user.verification_code !== code) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    // Mark as verified
    await pool.query("UPDATE users SET is_verified = true, verification_code = NULL WHERE email = $1", [email]);

    res.json({ message: "Email verified successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error verifying email", error: err.message });
  }
};


module.exports = {register, login, protectedRoute, verifyEmail}