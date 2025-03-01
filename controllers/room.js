const waitingUsers = new Map() // Efficient lookup for matchmaking
const activeRooms = new Map() // Stores active video call rooms
const MAX_WAIT_TIME = 30000 // 30 seconds timeout for waiting users

const roomController = (io) => {
  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`)

    // Handle user matchmaking with topic support
    socket.on("findMatch", ({ topic } = {}) => {
      let matchedSocket = null
      let matchedTopic = null

      // First try to find a match with the same topic if provided
      if (topic) {
        for (const [otherSocketId, data] of waitingUsers.entries()) {
          if (
            io.sockets.sockets.get(otherSocketId) && // Ensure user is still connected
            data.topic === topic // Match by topic
          ) {
            matchedSocket = data.socket
            matchedTopic = topic
            waitingUsers.delete(otherSocketId)
            break
          }
        }
      }

      // If no topic match found or no topic specified, find any available match
      if (!matchedSocket) {
        // If user specified a topic, wait for a bit before matching with anyone
        if (topic) {
          const topicTimeoutId = setTimeout(() => {
            // After timeout, if still waiting, find any match
            if (waitingUsers.has(socket.id)) {
              for (const [otherSocketId, data] of waitingUsers.entries()) {
                if (
                  otherSocketId !== socket.id && // Don't match with self
                  io.sockets.sockets.get(otherSocketId) // Ensure user is still connected
                ) {
                  matchedSocket = data.socket
                  matchedTopic = data.topic || topic // Use either topic
                  waitingUsers.delete(otherSocketId)
                  waitingUsers.delete(socket.id)

                  // Create a unique room ID
                  const roomId = `room-${socket.id}-${matchedSocket.id}`

                  // Join both users to the room
                  socket.join(roomId)
                  matchedSocket.join(roomId)

                  activeRooms.set(roomId, {
                    users: [socket.id, matchedSocket.id],
                    topic: matchedTopic,
                  })

                  io.to(roomId).emit("matchFound", {
                    roomId,
                    users: [socket.id, matchedSocket.id],
                    topic: matchedTopic,
                  })

                  console.log(`Matched ${socket.id} with ${matchedSocket.id} in ${roomId} (topic fallback)`)
                  return
                }
              }
            }
          }, 15000) // Wait 15 seconds before falling back to any match

          // Store the timeout ID to clear it if needed
          socket.topicTimeoutId = topicTimeoutId
        } else {
          // If no topic specified, find any match immediately
          for (const [otherSocketId, data] of waitingUsers.entries()) {
            if (
              otherSocketId !== socket.id && // Don't match with self
              io.sockets.sockets.get(otherSocketId) // Ensure user is still connected
            ) {
              matchedSocket = data.socket;
              matchedTopic = data.topic; // Use their topic if they have one
              waitingUsers.delete(otherSocketId);
              break;
            } else {
              waitingUsers.delete(otherSocketId); // Remove stale entries
            }
          }
        }
      }

      if (matchedSocket) {
        // Create a unique room ID
        const roomId = `room-${socket.id}-${matchedSocket.id}`

        // Join both users to the room
        socket.join(roomId)
        matchedSocket.join(roomId)

        activeRooms.set(roomId, {
          users: [socket.id, matchedSocket.id],
          topic: matchedTopic,
        })

        io.to(roomId).emit("matchFound", {
          roomId,
          users: [socket.id, matchedSocket.id],
          topic: matchedTopic,
        })

        console.log(
          `Matched ${socket.id} with ${matchedSocket.id} in ${roomId}${matchedTopic ? ` (topic: ${matchedTopic})` : ""}`,
        )
      } else {
        // Add user to waiting queue with a timeout
        waitingUsers.set(socket.id, {
          socket,
          topic,
          joinedAt: Date.now(),
        })

        const timeoutId = setTimeout(() => {
          if (waitingUsers.has(socket.id)) {
            waitingUsers.delete(socket.id)
            socket.emit("matchTimeout", { message: "No match found. Try again." })
          }
        }, MAX_WAIT_TIME)

        socket.on("disconnect", () => {
          clearTimeout(timeoutId)
          if (socket.topicTimeoutId) {
            clearTimeout(socket.topicTimeoutId)
          }
          waitingUsers.delete(socket.id)
        })
      }
    })

    // WebRTC signaling
    socket.on("signal", ({ roomId, data }) => {
      if (activeRooms.has(roomId)) {
        const { users } = activeRooms.get(roomId)
        const otherUser = users.find((user) => user !== socket.id)
        if (otherUser) {
          io.to(otherUser).emit("signal", { sender: socket.id, data })
        }
      }
    })

    // Handle chat messages
    socket.on("sendMessage", ({ roomId, text }) => {
      if (activeRooms.has(roomId)) {
        const { users } = activeRooms.get(roomId)

        // Send to all users in the room including sender (for confirmation)
        io.to(roomId).emit("chatMessage", {
          sender: socket.id,
          text,
        })

        console.log(`Message in ${roomId} from ${socket.id}: ${text.substring(0, 20)}${text.length > 20 ? "..." : ""}`)
      }
    })

    // Handle call ending
    socket.on("leaveRoom", ({ roomId }) => {
      if (activeRooms.has(roomId)) {
        const { users } = activeRooms.get(roomId)
        users.forEach((user) => io.to(user).emit("callEnded"))
        activeRooms.delete(roomId)
      }
      socket.leave(roomId)
      console.log(`User ${socket.id} left room ${roomId}`)
    })

    // Handle disconnect
    socket.on("disconnect", () => {
      waitingUsers.delete(socket.id)

      // Clear any pending timeouts
      if (socket.topicTimeoutId) {
        clearTimeout(socket.topicTimeoutId)
      }

      for (const [roomId, { users }] of activeRooms.entries()) {
        if (users.includes(socket.id)) {
          users.forEach((user) => io.to(user).emit("callEnded"))
          activeRooms.delete(roomId)
          break
        }
      }

      console.log(`User disconnected: ${socket.id}`)
    })
  })
}

module.exports = roomController

