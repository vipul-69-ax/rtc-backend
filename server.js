const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const AuthRouter = require("./routes/auth");
const ProfileRouter = require("./routes/profile");
const roomController = require("./controllers/room");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // Replace with frontend URL in production
    methods: ["GET", "POST"],
  },
  pingTimeout: 10000, // Drop inactive connections
  pingInterval: 5000,
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/auth", AuthRouter);
app.use("/profile", ProfileRouter);

// WebRTC Room Controller
roomController(io);

// Start the server
const PORT = process.env.PORT || 6969;
server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
