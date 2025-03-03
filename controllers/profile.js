const {pool} = require("../config/db.pg")

const createProfile = async (req, res) => {
    const { name, age, gender } = req.body;
    const userId = req.user.userId; // Extracted from JWT middleware
  
    if (!name || !gender) return res.status(400).json({ message: "Name and gender are required" });
  
    try {
      let email = await pool.query("SELECT email from users WHERE id = $1", [userId])
      email = email.rows[0].email
      console.log(gender)
      // Check if the profile already exists
      const existingProfile = await pool.query("SELECT * FROM profiles WHERE email = $1", [email]);
      if (existingProfile.rows.length > 0) {
        return res.status(400).json({ message: "Profile already exists" });
      }
  
      // Insert profile into the database
      const result = await pool.query(
        "INSERT INTO profiles (email, name, age, gender) VALUES ($1, $2, $3, $4) RETURNING *",
        [email, name, age, gender == "male" ? "Male" : "Female"]
      );
  
      res.status(201).json({ message: "Profile created successfully", profile: result.rows[0] });
    } catch (err) {
      console.log(err)
      res.status(500).json({ message: "Error creating profile", error: err.message });
    }
};

const checkProfileExists = async (req, res) => {
  const userId = req.user.userId; // Extracted from JWT middleware

  try {
      // Get the user's email
      let emailResult = await pool.query("SELECT email FROM users WHERE id = $1", [userId]);
      if (emailResult.rows.length === 0) {
          return res.status(404).json({ message: "User not found" });
      }
      const email = emailResult.rows[0].email;

      // Check if the profile exists
      const profileResult = await pool.query("SELECT * FROM profiles WHERE email = $1", [email]);
      
      if (profileResult.rows.length > 0) {
          return res.status(200).json({ exists: true, profile: profileResult.rows[0] });
      } else {
          return res.status(200).json({ exists: false, message: "Profile does not exist" });
      }
  } catch (err) {
      res.status(500).json({ message: "Error checking profile", error: err.message });
  }
};

const getProfile = async (req, res) => {
  const userId = req.user.userId; // Extracted from JWT middleware

  try {
      // Get the user's email
      let emailResult = await pool.query("SELECT email FROM users WHERE id = $1", [userId]);
      if (emailResult.rows.length === 0) {
          return res.status(404).json({ message: "User not found" });
      }
      const email = emailResult.rows[0].email;

      // Retrieve profile data
      const profileResult = await pool.query("SELECT * FROM profiles WHERE email = $1", [email]);
      
      if (profileResult.rows.length > 0) {
          return res.status(200).json({ profile: profileResult.rows[0] });
      } else {
          return res.status(404).json({ message: "Profile not found" });
      }
  } catch (err) {
      res.status(500).json({ message: "Error fetching profile", error: err.message });
}
}
  
module.exports = {createProfile, checkProfileExists, getProfile}