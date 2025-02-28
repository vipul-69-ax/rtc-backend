const {pool} = require("../config/db.pg")

const createProfile = async (req, res) => {
    const { name, age, gender } = req.body;
    const userId = req.user.userId; // Extracted from JWT middleware
  
    if (!name || !gender) return res.status(400).json({ message: "Name and gender are required" });
  
    try {
      let email = await pool.query("SELECT email from users WHERE id = $1", [userId])
      email = email.rows[0].email
      // Check if the profile already exists
      const existingProfile = await pool.query("SELECT * FROM profiles WHERE email = $1", [email]);
      if (existingProfile.rows.length > 0) {
        return res.status(400).json({ message: "Profile already exists" });
      }
  
      // Insert profile into the database
      const result = await pool.query(
        "INSERT INTO profiles (email, name, age, gender) VALUES ($1, $2, $3, $4) RETURNING *",
        [email, name, age, gender]
      );
  
      res.status(201).json({ message: "Profile created successfully", profile: result.rows[0] });
    } catch (err) {
      res.status(500).json({ message: "Error creating profile", error: err.message });
    }
};
  
module.exports = {createProfile}