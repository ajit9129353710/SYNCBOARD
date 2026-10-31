import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import * as Y from "yjs";

const PORT = 3001;
const rooms = new Map();

function getRoom(roomName) {
  if (!rooms.has(roomName)) {
    rooms.set(roomName, {
      doc: new Y.Doc(),
      clients: new Set(),
    });
  }

  return rooms.get(roomName);
}

function getUserList(room) {
  const users = [];

  for (const client of room.clients) {
    if (client.readyState !== WebSocket.OPEN) {
      continue;
    }

    users.push({
      userId: client.userId || "guest",
      name: client.displayName || "Guest",
      color: client.userColor || "#2563eb",
      activity: client.activity || "Viewing",
      status: "Online",
    });
  }

  return users;
}

function broadcastUsers(room) {
  const message = JSON.stringify({
    type: "users",
    count: room.clients.size,
    users: getUserList(room),
  });

  for (const client of room.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function broadcastToOthers(room, sender, message) {
  const text = JSON.stringify(message);

  for (const client of room.clients) {
    if (
      client !== sender &&
      client.readyState === WebSocket.OPEN
    ) {
      client.send(text);
    }
  }
}

const server = createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.url === "/" && req.method === "GET") {
    res.writeHead(200);
    res.end(
      JSON.stringify({
        message: "SyncBoard server is running!",
        status: "OK",
      })
    );
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ message: "Not found" }));
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  let roomName = "";

  try {
    const url = new URL(
      req.url || "/",
      "http://localhost"
    );

    if (!url.pathname.startsWith("/sync/")) {
      ws.close(1008, "Invalid room");
      return;
    }

    roomName = decodeURIComponent(
      url.pathname.slice("/sync/".length)
    );
  } catch {
    ws.close(1008, "Invalid room");
    return;
  }

  if (!roomName) {
    ws.close(1008, "Room name required");
    return;
  }

  const room = getRoom(roomName);

  ws.userId = "";
  ws.displayName = "Guest";
  ws.userColor = "#2563eb";
  ws.activity = "Viewing";

  room.clients.add(ws);

  ws.send(
    JSON.stringify({
      type: "sync",
      update: Array.from(
        Y.encodeStateAsUpdate(room.doc)
      ),
    })
  );

  broadcastUsers(room);

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === "profile") {
        if (
          typeof data.userId === "string" &&
          data.userId.length > 0
        ) {
          ws.userId = data.userId.slice(0, 80);
        }

        if (typeof data.name === "string") {
          const cleanName = data.name.trim().slice(0, 30);
          ws.displayName = cleanName || "Guest";
        }

        if (
          typeof data.color === "string" &&
          /^#[0-9a-fA-F]{6}$/.test(data.color)
        ) {
          ws.userColor = data.color;
        }

        broadcastUsers(room);
      }


      if (
        data.type === "update" &&
        Array.isArray(data.update)
      ) {
        const update = new Uint8Array(data.update);

        Y.applyUpdate(room.doc, update);

        broadcastToOthers(room, ws, {
          type: "update",
          update: data.update,
        });
      }

      if (
        data.type === "cursor" &&
        Number.isFinite(data.x) &&
        Number.isFinite(data.y)
      ) {
        if (typeof data.userId === "string") {
          ws.userId = data.userId.slice(0, 80);
        }

        if (
          typeof data.color === "string" &&
          /^#[0-9a-fA-F]{6}$/.test(data.color)
        ) {
          ws.userColor = data.color;
        }

        broadcastToOthers(room, ws, {
          type: "cursor",
          userId: ws.userId,
          name: ws.displayName,
          x: data.x,
          y: data.y,
          color: ws.userColor,
        });
      }

      if (
        data.type === "activity" &&
        typeof data.activity === "string"
      ) {
        const allowedActivities = [
          "Viewing",
          "Drawing",
          "Idle",
        ];

        if (allowedActivities.includes(data.activity)) {
          ws.activity = data.activity;
          broadcastUsers(room);
        }
      }
    } catch (error) {
      console.error("Invalid message:", error.message);
    }
  });

  ws.on("close", () => {
    room.clients.delete(ws);

    if (ws.userId) {
      broadcastToOthers(room, ws, {
        type: "cursor-left",
        userId: ws.userId,
      });
    }

    broadcastUsers(room);

    if (room.clients.size === 0) {

    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error.message);
  });
});

server.listen(PORT, () => {
  console.log(
    `SyncBoard server running on http://localhost:${PORT}`
  );
});