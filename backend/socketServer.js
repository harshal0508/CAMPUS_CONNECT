const { WebSocketServer } = require('ws'); 

const setupWebSocket = (server) => {
  const wss = new WebSocketServer({ server });

  // 🚀 PRO-TIP: Ab ek user ki multiple sockets (tabs/devices) store hongi Set() ke andar
  const activeUsers = new Map(); 

  wss.on('connection', (ws) => {
    console.log('🔗 New WebSocket Connection Established');
    
    // Is specific connection ka user ID track karne ke liye variable
    let currentUserId = null;

    ws.on('message', (messageAsString) => {
      try {
        const data = JSON.parse(messageAsString);

        // 1. SETUP: Frontend ne bataya ki "Main online aa gaya"
        if (data.type === 'setup') {
          // IDs ko hamesha String mein convert karein taaki Map lookup fail na ho
          currentUserId = String(data.payload);
          
          if (!activeUsers.has(currentUserId)) {
            activeUsers.set(currentUserId, new Set()); // Naya Set banaya
          }
          // Is user ke Set mein current socket (tab/device) add kar do
          activeUsers.get(currentUserId).add(ws);
          
          console.log(`👤 User ${currentUserId} is online (Active Tabs/Devices: ${activeUsers.get(currentUserId).size})`);
        }

        // 2. SEND MESSAGE: Frontend ne kisi ko message bheja
        if (data.type === 'send_message') {
          const messageData = data.payload;
          const receiverId = String(messageData.receiver || messageData.receiverId);

          // Check karein ki receiver ke kitne devices/tabs online hain
          const receiverSockets = activeUsers.get(receiverId);
          
          if (receiverSockets) {
            // Dost ke har open tab/device par loop karke message push karo
            receiverSockets.forEach(clientWs => {
              if (clientWs.readyState === 1) { // 1 = OPEN
                clientWs.send(JSON.stringify({
                  type: 'receive_message',
                  payload: messageData
                }));
              }
            });
          }
        }
      } catch (error) {
        console.error("❌ WebSocket message parsing error:", error);
      }
    });

    // Jab user browser/tab close kare
    ws.on('close', () => {
      if (currentUserId && activeUsers.has(currentUserId)) {
        const userSockets = activeUsers.get(currentUserId);
        
        // Is tab ki socket ko list se hatao
        userSockets.delete(ws);
        
        // Agar uske saare tabs band ho gaye, toh user ko completely offline mark karo
        if (userSockets.size === 0) {
          activeUsers.delete(currentUserId);
          console.log(`📴 User ${currentUserId} went completely offline`);
        } else {
          console.log(`📉 User ${currentUserId} closed a tab (Remaining active: ${userSockets.size})`);
        }
      }
    });
  });
};

module.exports = setupWebSocket;