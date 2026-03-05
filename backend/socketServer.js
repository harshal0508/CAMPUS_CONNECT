const { WebSocketServer } = require('ws'); 

// 🚀 CTO Fix: Map ko global scope mein banayein taaki dusre files se access kiya ja sake
const activeUsers = new Map(); 

// Ek helper function jo kisi bhi file se message bhejne ke kaam aayega
const sendToUser = (userId, type, payload) => {
  const receiverSockets = activeUsers.get(String(userId));
  if (receiverSockets) {
    receiverSockets.forEach(clientWs => {
      if (clientWs.readyState === 1) { // 1 = OPEN
        clientWs.send(JSON.stringify({ type, payload }));
      }
    });
  }
};

const setupWebSocket = (server) => {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    let currentUserId = null;

    ws.on('message', (messageAsString) => {
      try {
        const data = JSON.parse(messageAsString);

        // 1. SETUP: Jab user online aaye
        if (data.type === 'setup') {
          currentUserId = String(data.payload);
          
          if (!activeUsers.has(currentUserId)) {
            activeUsers.set(currentUserId, new Set());
          }
          activeUsers.get(currentUserId).add(ws);
          console.log(`👤 User ${currentUserId} is online (${activeUsers.get(currentUserId).size} devices)`);
        }

      } catch (error) {
        console.error("❌ WebSocket message parsing error:", error);
      }
    });

    ws.on('close', () => {
      if (currentUserId && activeUsers.has(currentUserId)) {
        const userSockets = activeUsers.get(currentUserId);
        userSockets.delete(ws);
        
        if (userSockets.size === 0) {
          activeUsers.delete(currentUserId);
          console.log(`📴 User ${currentUserId} offline`);
        }
      }
    });
  });
};

module.exports = { setupWebSocket, sendToUser };