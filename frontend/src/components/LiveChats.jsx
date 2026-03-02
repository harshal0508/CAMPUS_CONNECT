import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, ArrowLeft, Loader2 } from 'lucide-react';
import axios from 'axios';
import { useUser } from '../contexts/UserContext';

// 🛠️ API & WebSocket URLs (Apne backend ke hisaab se adjust kar lein)
const API_URL = 'http://localhost:5000/api';
const WS_URL = 'ws://localhost:5000'; 

const API = axios.create({
  baseURL: API_URL,
  withCredentials: true 
});

export default function LiveChat() {
  const { user } = useUser(); // Context se current logged-in user nikalna
  
  const [isOpen, setIsOpen] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const [socket, setSocket] = useState(null);
  const messagesEndRef = useRef(null);

  // 1️⃣ Initialize Native WebSocket Connection
  useEffect(() => {
    // Agar user logged in nahi hai, toh connect mat karo
    if (!user) return;

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('✅ Connected to Live Chat Server');
      // Connection open hote hi, server ko apna ID bhejo
      ws.send(JSON.stringify({ 
        type: 'setup', 
        payload: user._id 
      }));
    };

    ws.onmessage = (event) => {
      try {
        const parsedData = JSON.parse(event.data);
        
        // Jab server se naya message aaye
        if (parsedData.type === 'receive_message') {
          // Message ko existing list mein add kar do
          setMessages((prev) => [...prev, parsedData.payload]);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('❌ Disconnected from Live Chat Server');
    };

    setSocket(ws);

    // Cleanup function: Component unmount hone par connection close karo
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [user]);

  // 2️⃣ Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, activeChat]);

  // 3️⃣ Fetch Chat History from Database
  const fetchMessages = async (friendId) => {
    setLoadingHistory(true);
    try {
      const { data } = await API.get(`/messages/${friendId}`);
      setMessages(data);
    } catch (err) {
      console.error("Failed to load messages", err);
      setMessages([]); 
    } finally {
      setLoadingHistory(false);
    }
  };

  // 4️⃣ Send New Message
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    // Optimistic UI ke liye pehle local state banao
    const temporaryMessage = {
      _id: Date.now().toString(), // Temp ID
      sender: user, // Pura user object
      content: newMessage,
      createdAt: new Date().toISOString()
    };

    // Screen par turant dikhao
    setMessages((prev) => [...prev, temporaryMessage]);
    setNewMessage('');

    try {
      // API call to save in Database
      const { data } = await API.post('/messages', {
        receiverId: activeChat._id,
        content: temporaryMessage.content
      });

      // Database mein save hone ke baad, socket se dost ko bhejo
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ 
          type: 'send_message', 
          payload: data // Backend se aaya final message object
        }));
      }
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  // Chat window open karne ka function
  const openChatWith = (friend) => {
    setActiveChat(friend);
    fetchMessages(friend._id);
  };

  // Agar user login nahi hai toh widget mat dikhao
  if (!user) return null;

  // Sirf Connected friends ki list nikalna
  const friends = user.connections || [];

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {/* 🟢 FLOATING ACTION BUTTON */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-[#1d9bf0] hover:bg-blue-600 text-white p-4 rounded-full shadow-[0_10px_25px_rgba(29,155,240,0.4)] transition-transform hover:scale-105 active:scale-95 flex items-center justify-center"
        >
          <MessageCircle size={28} />
        </button>
      )}

      {/* 🟢 CHAT WINDOW */}
      {isOpen && (
        <div className="w-[350px] sm:w-[380px] h-[500px] bg-white dark:bg-[#15181c] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
          
          {/* HEADER */}
          <div className="bg-[#1d9bf0] text-white p-4 flex items-center justify-between shadow-md z-10">
            <div className="flex items-center gap-2">
              {activeChat && (
                <button onClick={() => setActiveChat(null)} className="hover:bg-white/20 p-1 rounded-full transition-colors active:scale-95">
                  <ArrowLeft size={20} />
                </button>
              )}
              <h3 className="font-bold text-[16px] tracking-wide">
                {activeChat ? activeChat.name : 'Messages'}
              </h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors active:scale-95">
              <X size={20} />
            </button>
          </div>

          {/* BODY */}
          <div className="flex-1 bg-gray-50 dark:bg-[#0a0a0a] overflow-y-auto">
            
            {/* VIEW 1: FRIENDS LIST */}
            {!activeChat && (
              <div className="p-2">
                {friends.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-8 text-center text-gray-500 mt-10">
                    <div className="bg-gray-100 dark:bg-white/5 p-4 rounded-full mb-3">
                      <MessageCircle size={32} className="text-gray-400" />
                    </div>
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300">No connections yet</p>
                    <p className="text-xs mt-1 text-gray-500">Add friends to start chatting!</p>
                  </div>
                ) : (
                  friends.map((friend) => {
                    const friendObj = typeof friend === 'object' ? friend : { _id: friend, name: 'Campus User' };
                    const avatarSrc = friendObj.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friendObj._id}`;

                    return (
                      <div 
                        key={friendObj._id} 
                        onClick={() => openChatWith(friendObj)}
                        className="flex items-center gap-3 p-3 hover:bg-white dark:hover:bg-white/5 rounded-xl cursor-pointer transition-all active:scale-[0.98] border border-transparent hover:shadow-sm"
                      >
                        <div className="relative">
                          <img 
                            src={avatarSrc} 
                            className="w-12 h-12 rounded-full object-cover bg-gray-200 border border-gray-100 dark:border-gray-800" 
                            alt={friendObj.name} 
                          />
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-[#15181c] rounded-full"></div>
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <h4 className="font-bold text-gray-900 dark:text-white text-[15px] truncate">{friendObj.name}</h4>
                          <p className="text-[13px] text-gray-500 truncate">Tap to open chat</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* VIEW 2: ACTIVE CHAT SCREEN */}
            {activeChat && (
              <div className="flex flex-col h-full relative">
                
                {/* Message List */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4 pb-20">
                  {loadingHistory ? (
                    <div className="flex justify-center items-center h-full">
                      <Loader2 className="animate-spin text-[#1d9bf0]" size={28} />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center mt-10">
                      <span className="text-4xl mb-2">👋</span>
                      <p className="text-center text-gray-500 text-sm font-medium">Say hi to {activeChat.name}!</p>
                    </div>
                  ) : (
                    messages.map((msg, index) => {
                      // Check karein sender id current user se match hoti hai ya nahi
                      const isMe = msg.sender === user._id || msg.sender?._id === user._id;
                      
                      return (
                        <div key={msg._id || index} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div 
                            className={`max-w-[75%] px-4 py-2 rounded-2xl text-[14px] font-medium leading-relaxed shadow-sm ${
                              isMe 
                                ? 'bg-[#1d9bf0] text-white rounded-br-sm' 
                                : 'bg-white dark:bg-white/10 border border-gray-100 dark:border-white/5 text-gray-900 dark:text-white rounded-bl-sm'
                            }`}
                          >
                            {msg.content}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} className="h-1" />
                </div>

                {/* Input Form Area */}
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-white dark:bg-[#15181c] border-t border-gray-100 dark:border-white/5">
                  <form onSubmit={sendMessage} className="flex items-center gap-2 bg-gray-50 dark:bg-black/50 p-1 rounded-full border border-gray-200 dark:border-white/10 focus-within:border-[#1d9bf0] dark:focus-within:border-[#1d9bf0] transition-colors">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 bg-transparent px-4 py-2 outline-none text-gray-900 dark:text-white text-[14px]"
                      autoComplete="off"
                    />
                    <button 
                      type="submit" 
                      disabled={!newMessage.trim()}
                      className="bg-[#1d9bf0] text-white p-2.5 rounded-full hover:bg-blue-600 disabled:opacity-50 transition-colors active:scale-95 flex items-center justify-center"
                    >
                      <Send size={16} className="ml-0.5" />
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}