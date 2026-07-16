"use strict";

/**
 * Timbre live-collaboration relay.
 *
 * Vercel's serverless functions can't hold long-lived WebSocket connections, so
 * this tiny always-on Socket.io server (deployed to Render) does one job: relay
 * messages between the clients in a note's room. It is deliberately stateless —
 * it never touches the database. Persistence stays in the Next app: whichever
 * client made a change autosaves it through the normal API route, so the relay
 * only has to fan changes out to the other people looking at the same note.
 *
 * Rooms are keyed by note id. Events:
 *   join-room     { noteId, user:{ name, color } }  → server assigns an id
 *   peers         Peer[]        (sent to the joiner)
 *   peer-joined   Peer          (sent to the room)
 *   peer-left     Peer
 *   content-update <opaque>     (canvas elements / document JSON — relayed as-is)
 *   cursor-move   { x, y }      (relayed with the sender's id + user)
 *   voice-changed (none)        (a voice note changed — peers refetch the list)
 */

const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3001;
// Comma-separated list of allowed origins (the Vercel URL + localhost). "*"
// during local dev; set ALLOWED_ORIGIN on Render to the real deploy origin.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN
  ? process.env.ALLOWED_ORIGIN.split(",").map((s) => s.trim())
  : "*";

const server = http.createServer((req, res) => {
  // Render pings this to check the service is up (and to wake it from sleep).
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Timbre socket server");
});

const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGIN, methods: ["GET", "POST"] },
});

/** The peers currently in a room, from their sockets' stored user data. */
function peersInRoom(noteId, exceptId) {
  const room = io.sockets.adapter.rooms.get(noteId);
  if (!room) return [];
  const peers = [];
  for (const socketId of room) {
    if (socketId === exceptId) continue;
    const s = io.sockets.sockets.get(socketId);
    if (s && s.data.user) peers.push(s.data.user);
  }
  return peers;
}

io.on("connection", (socket) => {
  let currentRoom = null;

  socket.on("join-room", (payload) => {
    const noteId = payload && payload.noteId;
    if (typeof noteId !== "string") return;
    const incoming = (payload && payload.user) || {};
    const user = {
      id: socket.id,
      name: typeof incoming.name === "string" ? incoming.name : "Someone",
      color: typeof incoming.color === "string" ? incoming.color : "#6366f1",
      photoURL:
        typeof incoming.photoURL === "string" ? incoming.photoURL : null,
    };

    currentRoom = noteId;
    socket.data.user = user;
    socket.join(noteId);

    // Tell the joiner who's already here; tell the room the joiner arrived.
    socket.emit("peers", peersInRoom(noteId, socket.id));
    socket.to(noteId).emit("peer-joined", user);
  });

  socket.on("content-update", (data) => {
    if (currentRoom) socket.to(currentRoom).emit("content-update", data);
  });

  socket.on("cursor-move", (data) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit("cursor-move", {
      id: socket.id,
      user: socket.data.user,
      x: data && data.x,
      y: data && data.y,
    });
  });

  // A voice note was added/moved/deleted — tell the room to refetch its list.
  socket.on("voice-changed", () => {
    if (currentRoom) socket.to(currentRoom).emit("voice-changed");
  });

  socket.on("disconnect", () => {
    if (currentRoom && socket.data.user) {
      socket.to(currentRoom).emit("peer-left", socket.data.user);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Timbre socket server listening on :${PORT}`);
});
