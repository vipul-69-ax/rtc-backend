const waitingUsers = new Map(); // Efficient lookup for matchmaking
const activeRooms = new Map(); // Stores active video call rooms
const MAX_WAIT_TIME = 30000; // 30 seconds timeout for waiting users

const roomController = (io) => {
  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle user matchmaking
    socket.on("findMatch", () => {
      let matchedSocket = null;

      // Iterate through waiting users to find an active connection
      for (const [otherSocketId, otherSocket] of waitingUsers.entries()) {
        if (io.sockets.sockets.get(otherSocketId)) {
          matchedSocket = otherSocket;
          waitingUsers.delete(otherSocketId);
          break;
        } else {
          waitingUsers.delete(otherSocketId); // Remove stale entries
        }
      }

      if (matchedSocket) {
        // Create a unique room ID
        const roomId = `room-${socket.id}-${matchedSocket.id}`;

        // Join both users to the room
        socket.join(roomId);
        matchedSocket.join(roomId);

        activeRooms.set(roomId, { users: [socket.id, matchedSocket.id] });

        io.to(roomId).emit("matchFound", { roomId, users: [socket.id, matchedSocket.id] });
        console.log(`Matched ${socket.id} with ${matchedSocket.id} in ${roomId}`);
      } else {
        // No match found, add user to waiting queue
        waitingUsers.set(socket.id, socket);

        // Set a timeout for matchmaking
        setTimeout(() => {
          if (waitingUsers.has(socket.id)) {
            waitingUsers.delete(socket.id);
            socket.emit("matchTimeout", { message: "No match found. Try again." });
          }
        }, MAX_WAIT_TIME);
      }
    });

    // WebRTC signaling
    socket.on("signal", ({ roomId, data }) => {
      if (activeRooms.has(roomId)) {
        socket.to(roomId).emit("signal", { sender: socket.id, data });
      }
    });

    // Handle call ending
    socket.on("leaveRoom", ({ roomId }) => {
      if (activeRooms.has(roomId)) {
        const { users } = activeRooms.get(roomId);
        users.forEach((user) => io.to(user).emit("callEnded"));
        activeRooms.delete(roomId);
      }
      socket.leave(roomId);
      console.log(`User ${socket.id} left room ${roomId}`);
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      if (waitingUsers.has(socket.id)) {
        waitingUsers.delete(socket.id);
      }

      for (const [roomId, { users }] of activeRooms.entries()) {
        if (users.includes(socket.id)) {
          users.forEach((user) => io.to(user).emit("callEnded"));
          activeRooms.delete(roomId);
          break;
        }
      }
      console.log(`User disconnected: ${socket.id}`);
    });
  });
};

module.exports = roomController;
