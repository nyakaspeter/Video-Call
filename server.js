const path = require("path");
const express = require("express");

const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server);

const isDev = process.env.NODE_ENV !== "production";
const PORT = process.env.PORT || 8000;

const rooms = {};
const userRooms = {};

io.on("connection", (user) => {
  user.on("joinRoom", (roomId) => {
    if (rooms[roomId]) {
      rooms[roomId].push(user.id);
    } else {
      rooms[roomId] = [user.id];
      console.log(roomId + ": room created");
    }

    userRooms[user.id] = roomId;

    const otherUsersInRoom = rooms[roomId].filter((id) => id !== user.id);
    user.emit("otherUsersInRoom", otherUsersInRoom);

    console.log(roomId + ": user joined (" + user.id + ")");
  });

  user.on("sending signal", (payload) => {
    io.to(payload.userToSignal).emit("userJoined", {
      signal: payload.signal,
      callerID: payload.callerID,
    });
  });

  user.on("returning signal", (payload) => {
    io.to(payload.callerID).emit("receiving returned signal", {
      signal: payload.signal,
      id: user.id,
    });
  });

  user.on("disconnect", () => {
    const roomId = userRooms[user.id];
    let room = rooms[roomId];
    if (room) {
      room = room.filter((id) => id !== user.id);
      rooms[roomId] = room;
      console.log(roomId + ": user left (" + user.id + ")");

      room.forEach((userId) => {
        io.to(userId).emit("userLeft", user.id);
      });

      if (room.length === 0) {
        delete rooms[roomId];
        console.log(roomId + ": room closed");
      }
    }
  });
});

app.use(express.static(path.resolve(__dirname, "./client/build")));

app.get("*", function (request, response) {
  response.sendFile(path.resolve(__dirname, "./client/build", "index.html"));
});

server.listen(PORT, () => console.log("Server is running on port " + PORT));
