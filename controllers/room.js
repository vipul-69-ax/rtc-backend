const waitingUsers = new Map(); // Efficient lookup for matchmaking
const activeRooms = new Map(); // Stores active video call rooms
const MAX_WAIT_TIME = 30000; // 30 seconds timeout for waiting users

const roomController = (io) => {
  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle user matchmaking
    socket.on("findMatch", () => {
      let matchedSocket = null;

      // Find an available match
      for (const [otherSocketId, otherSocket] of waitingUsers.entries()) {
        if (io.sockets.sockets.get(otherSocketId)) { // Ensure user is still connected
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
        // Add user to waiting queue with a timeout
        waitingUsers.set(socket.id, socket);

        const timeoutId = setTimeout(() => {
          if (waitingUsers.has(socket.id)) {
            waitingUsers.delete(socket.id);
            socket.emit("matchTimeout", { message: "No match found. Try again." });
          }
        }, MAX_WAIT_TIME);

        socket.on("disconnect", () => {
          clearTimeout(timeoutId);
          waitingUsers.delete(socket.id);
        });
      }
    });

    // WebRTC signaling - Fix signal relay
    socket.on("signal", ({ roomId, data }) => {
      if (activeRooms.has(roomId)) {
        const { users } = activeRooms.get(roomId);
        const otherUser = users.find((user) => user !== socket.id);
        if (otherUser) {
          io.to(otherUser).emit("signal", { sender: socket.id, data });
        }
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
      waitingUsers.delete(socket.id);

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
