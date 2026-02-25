const WebSocket = require("ws");

let wss = null;
let clients = new Set();

function startWss(server) {
  wss = new WebSocket.Server({ server, path: "/times" });
  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => {
      clients.delete(ws);
    });
  });
  return wss;
}

function broadcast(obj) {
  const message = JSON.stringify(obj);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

module.exports = {
  startWss,
  broadcast,
};
