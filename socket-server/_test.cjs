process.env.PORT = "3998";
require("./server.js");
const { io } = require("socket.io-client");
const URL = "http://localhost:3998";
const mk = () => io(URL, { transports: ["websocket"] });

(async () => {
  const a = mk();
  const b = mk();
  let bGotContent = null;
  let aGotPeerJoined = null;
  a.on("peer-joined", (p) => (aGotPeerJoined = p));
  b.on("content-update", (d) => (bGotContent = d));

  await new Promise((r) => a.on("connect", r));
  a.emit("join-room", { noteId: "n1", user: { name: "Alice", color: "#f00" } });
  await new Promise((r) => setTimeout(r, 150));
  await new Promise((r) => b.on("connect", r));
  b.emit("join-room", { noteId: "n1", user: { name: "Bob", color: "#00f" } });
  await new Promise((r) => setTimeout(r, 200));

  a.emit("content-update", { elements: [{ id: "x" }] });
  await new Promise((r) => setTimeout(r, 150));

  const c = mk();
  let cGot = false;
  c.on("content-update", () => (cGot = true));
  await new Promise((r) => c.on("connect", r));
  c.emit("join-room", { noteId: "n2", user: { name: "Carol", color: "#0f0" } });
  await new Promise((r) => setTimeout(r, 100));
  a.emit("content-update", { elements: [{ id: "y" }] });
  await new Promise((r) => setTimeout(r, 150));

  console.log(
    "RESULT presence=" +
      (!!aGotPeerJoined && aGotPeerJoined.name === "Bob") +
      " relay=" +
      (!!bGotContent && bGotContent.elements[0].id === "x") +
      " isolation=" +
      (cGot === false),
  );
  a.close();
  b.close();
  c.close();
  process.exit(0);
})().catch((e) => {
  console.error("RESULT FAIL " + (e && e.message));
  process.exit(1);
});
