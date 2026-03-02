import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import axios from 'axios';
// Aapke App.jsx ke mutabiq path 'contexts' (plural) hona chahiye
import { useUser } from '../contexts/UserContext';

/**
 * 🚀 GEN-Z LIVE CHAT COMPONENT
 * Features: Native WebSockets, Glowing UI, Smooth Animations, Optimized for Local Project.
 */

const API_URL = 'http://localhost:5000/api';
const WS_URL = 'ws://localhost:5000'; 

const API = axios.create({
  baseURL: API_URL,
  withCredentials: true 
});

export default function LiveChat() {
  const { user } = useUser(); 
  
  const [isOpen, setIsOpen] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const [socket, setSocket] = useState(null);
  const messagesEndRef = useRef(null);

  // 1️⃣ WebSocket connection logic
  useEffect(() => {
    if (!user || !user._id) return;

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('✅ Connected to Live Chat Server');
      ws.send(JSON.stringify({ type: 'setup', payload: user._id }));
    };

    ws.onmessage = (event) => {
      try {
        const parsedData = JSON.parse(event.data);
        if (parsedData.type === 'receive_message') {
          setMessages((prev) => [...prev, parsedData.payload]);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => console.log('❌ Disconnected from Live Chat Server');

    setSocket(ws);

    return () => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, [user]);

  // 2️⃣ Scroll handling
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, activeChat]);

  // 3️⃣ Database history loading
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

  // 4️⃣ Sending messages logic
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    const temporaryMessage = {
      _id: Date.now().toString(),
      sender: user._id,
      content: newMessage,
      createdAt: new Date().toISOString()
    };

    // Optimistic Update: Turant screen par dikhao
    setMessages((prev) => [...prev, temporaryMessage]);
    setNewMessage('');

    try {
      // Save in DB
      const { data } = await API.post('/messages', {
        receiverId: activeChat._id,
        content: temporaryMessage.content
      });

      // Send to Socket
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'send_message', payload: data }));
      }
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  const openChatWith = (friend) => {
    setActiveChat(friend);
    fetchMessages(friend._id);
  };

  if (!user) return null;

  const friends = user.connections || [];

  return (
    <div className="fixed bottom-6 right-6 z-[100] font-sans">
      {/* 🚀 ANIMATED FLOATING ACTION BUTTON */}
      {!isOpen && (
        <div className="relative group cursor-pointer" onClick={() => setIsOpen(true)}>
          {/* Glowing Gradient Aura */}
          <div className="absolute -inset-1 bg-gradient-to-r from-[#FF0080] via-[#7928CA] to-[#0070F3] rounded-full blur-lg opacity-70 group-hover:opacity-100 transition duration-1000 animate-pulse"></div>
          
          {/* Main Icon Body */}
          <div className="relative flex items-center justify-center bg-gray-900 dark:bg-[#0a0a0a] p-4 rounded-full text-white transition-all duration-500 group-hover:scale-110 active:scale-90 shadow-2xl border border-white/10">
            <MessageCircle size={30} className="group-hover:rotate-12 transition-transform duration-500" />
            
            {/* Live Status Pinger */}
            <span className="absolute top-0 right-0 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-pink-500 border-2 border-gray-900 dark:border-black"></span>
            </span>
          </div>
        </div>
      )}

      {/* 📱 CHAT WINDOW (GenZ Glassmorphism Redesign) */}
      {isOpen && (
        <div className="w-[350px] sm:w-[380px] h-[520px] bg-white/95 dark:bg-[#0d0d0d]/95 backdrop-blur-2xl border border-gray-200 dark:border-white/10 rounded-[2.5rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 origin-bottom-right">
          
          {/* HEADER (Cyber-Vibe Gradient) */}
          <div className="bg-gradient-to-r from-[#FF0080] via-[#7928CA] to-[#0070F3] text-white p-5 flex items-center justify-between shadow-xl z-10 relative">
            <Sparkles size={100} className="absolute -top-6 -right-6 opacity-10 rotate-45 pointer-events-none" />
            
            <div className="flex items-center gap-3 relative z-10">
              {activeChat && (
                <button onClick={() => setActiveChat(null)} className="hover:bg-white/20 p-2 rounded-full transition-all active:scale-75 cursor-pointer">
                  <ArrowLeft size={20} />
                </button>
              )}
              <h3 className="font-black text-[19px] tracking-tight">
                {activeChat ? activeChat.name : 'Vibe Check 💬'}
              </h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-2 rounded-full transition-all active:scale-75 relative z-10 bg-black/10 cursor-pointer">
              <X size={18} />
            </button>
          </div>

          {/* CHAT BODY */}
          <div className="flex-1 overflow-y-auto bg-transparent">
            
            {/* CONTACT LIST VIEW */}
            {!activeChat && (
              <div className="p-4 space-y-3">
                {friends.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                    <div className="bg-gradient-to-tr from-gray-100 to-gray-200 dark:from-white/5 dark:to-white/10 p-7 rounded-[2rem] mb-4 rotate-6 shadow-inner border border-white/5">
                      <MessageCircle size={45} className="text-gray-400 dark:text-gray-600" />
                    </div>
                    <p className="text-[17px] font-black text-gray-800 dark:text-gray-200">Silence is boring.</p>
                    <p className="text-sm mt-1 text-gray-500 font-bold">Start the wave! 🌊</p>
                  </div>
                ) : (
                  friends.map((friend) => {
                    const friendObj = typeof friend === 'object' ? friend : { _id: friend, name: 'User' };
                    const avatar = friendObj.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friendObj._id}`;

                    return (
                      <div 
                        key={friendObj._id} 
                        onClick={() => openChatWith(friendObj)}
                        className="flex items-center gap-4 p-4 hover:bg-gray-100 dark:hover:bg-white/5 rounded-[2rem] cursor-pointer transition-all active:scale-[0.96] group border border-transparent hover:border-gray-200 dark:hover:border-white/10"
                      >
                        <div className="relative">
                          <img 
                            src={avatar} 
                            className="w-14 h-14 rounded-2xl object-cover border border-white/10 group-hover:rotate-6 transition-transform duration-300 shadow-lg" 
                            alt={friendObj.name} 
                          />
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-4 border-white dark:border-[#0d0d0d] rounded-full"></div>
                        </div>
                        <div className="flex-1 text-left">
                          <h4 className="font-black text-gray-900 dark:text-white text-[16px]">{friendObj.name}</h4>
                          <p className="text-[13px] text-gray-500 font-bold group-hover:text-purple-500 transition-colors italic truncate">@vibe_{friendObj.handle || friendObj.name.split(' ')[0].toLowerCase()}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* MESSAGES VIEW */}
            {activeChat && (
              <div className="flex flex-col h-full relative">
                <div className="flex-1 p-5 overflow-y-auto space-y-4 pb-28 scrollbar-hide">
                  {loadingHistory ? (
                    <div className="flex justify-center items-center h-full">
                      <Loader2 className="animate-spin text-purple-600" size={35} />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center mt-12 animate-in fade-in zoom-in duration-1000">
                      <div className="bg-purple-100 dark:bg-purple-500/10 p-5 rounded-full mb-4 animate-bounce">
                        <Sparkles size={38} className="text-purple-500" />
                      </div>
                      <p className="text-center text-gray-800 dark:text-gray-100 text-[18px] font-black italic tracking-tight underline decoration-pink-500 decoration-4">Slide into the DMs! 🔥</p>
                    </div>
                  ) : (
                    messages.map((msg, idx) => {
                      const isMe = String(msg.sender) === String(user._id) || String(msg.sender?._id) === String(user._id);
                      return (
                        <div key={msg._id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
                          <div className={`max-w-[80%] px-5 py-3 text-[15px] font-bold leading-snug shadow-lg ${
                            isMe 
                              ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-[1.8rem] rounded-br-sm' 
                              : 'bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/5 text-gray-900 dark:text-gray-100 rounded-[1.8rem] rounded-bl-sm'
                          }`}>
                            {msg.content}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} className="h-4" />
                </div>

                {/* Cyberpunk Input Bar */}
                <div className="absolute bottom-0 left-0 right-0 p-5 bg-white/80 dark:bg-[#0d0d0d]/80 backdrop-blur-xl border-t border-gray-100 dark:border-white/5">
                  <form onSubmit={sendMessage} className="flex items-center gap-3 bg-gray-100 dark:bg-[#1a1a1a] p-2 rounded-full border border-gray-200 dark:border-white/10 focus-within:ring-2 ring-purple-500/50 transition-all duration-300">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Spill the tea..."
                      className="flex-1 bg-transparent px-5 py-2 outline-none text-gray-900 dark:text-white text-[15px] font-bold placeholder-gray-400"
                      autoComplete="off"
                    />
                    <button 
                      type="submit" 
                      disabled={!newMessage.trim()}
                      className="bg-gradient-to-r from-[#FF0080] to-[#7928CA] text-white p-3.5 rounded-full hover:opacity-90 disabled:opacity-30 transition-all duration-300 active:scale-75 flex items-center justify-center shadow-xl shadow-pink-500/20 cursor-pointer"
                    >
                      <Send size={20} />
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