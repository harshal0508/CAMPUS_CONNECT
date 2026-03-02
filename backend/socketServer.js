const { WebSocketServer } = require('ws'); 

// Ek function banate hain jo 'server' object receive karega
const setupWebSocket = (server) => {
  // Naya WebSocket server banaya jo humare HTTP port par chalega
  const wss = new WebSocketServer({ server });

  // Kaunsa user online hai, uski socket ID track karne ke liye Map
  const activeUsers = new Map(); 

  wss.on('connection', (ws) => {
    console.log('🔗 New WebSocket Connection Established');

    // Jab frontend se koi message aaye
    ws.on('message', (messageAsString) => {
      try {
        // String data ko wapas Object mein convert kiya
        const data = JSON.parse(messageAsString);

        // 1. SETUP: Frontend ne bataya ki "Main online aa gaya"
        if (data.type === 'setup') {
          const userId = data.payload;
          activeUsers.set(userId, ws);
          console.log(`👤 User ${userId} is online`);
        }

        // 2. SEND MESSAGE: Frontend ne kisi ko message bheja
        if (data.type === 'send_message') {
          const messageData = data.payload;
          // Check karein receiver ki ID
          const receiverId = messageData.receiver || messageData.receiverId;

          // Check karein ki kya dost currently online hai?
          const receiverSocket = activeUsers.get(String(receiverId));
          
          // Agar dost online hai (readyState 1 = OPEN)
          if (receiverSocket && receiverSocket.readyState === 1) { 
            // Dost ki screen par live message push kar do
            receiverSocket.send(JSON.stringify({
              type: 'receive_message',
              payload: messageData
            }));
          }
        }
      } catch (error) {
        console.error("❌ WebSocket message parsing error:", error);
      }
    });

    // Jab user browser/tab close kare
    ws.on('close', () => {
      // Us user ko active list se hata do
      for (let [userId, socket] of activeUsers.entries()) {
        if (socket === ws) {
          activeUsers.delete(userId);
          console.log(`📴 User ${userId} went offline`);
          break;
        }
      }
    });
  });
};

// Function ko export kiya taaki server.js mein use kar sakein
module.exports = setupWebSocket;