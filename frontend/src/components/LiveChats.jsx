import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MessageCircle, X, Send, ArrowLeft, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import axios from 'axios';
// 👉 Path fix: 'context' se 'contexts' kiya gaya hai
import { useUser } from '../contexts/UserContext'; 

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
  
  // 🔥 PERFORMANCE AUR HISTORY STATES
  const [chatCache, setChatCache] = useState({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isFetchingOld, setIsFetchingOld] = useState(false);
  const [chatError, setChatError] = useState(null);
  
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const chatBodyRef = useRef(null);
  const prevScrollHeightRef = useRef(0);
  
  const activeChatRef = useRef(null);
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // 1️⃣ WebSocket Logic (Auto-Reconnect ke saath)
  const connectSocket = useCallback(() => {
    if (!user || !user._id) return;
    const ws = new WebSocket(WS_URL);
    socketRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'setup', payload: user._id }));
    };

    ws.onmessage = (event) => {
      try {
        const parsedData = JSON.parse(event.data);
        if (parsedData.type === 'receive_message') {
          const incomingMsg = parsedData.payload;
          const currentChat = activeChatRef.current;
          
          const senderIdStr = String(incomingMsg.sender._id || incomingMsg.sender);
          const receiverIdStr = String(incomingMsg.receiver._id || incomingMsg.receiver);
          
          // Agar wahi chat khuli hai toh messages dikhao
          if (currentChat && (senderIdStr === String(currentChat._id) || receiverIdStr === String(currentChat._id))) {
            setMessages(prev => {
              if (prev.find(m => m._id === incomingMsg._id)) return prev;
              return [...prev, incomingMsg];
            });
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
          }

          // Background mein cache update karo
          const friendIdStr = senderIdStr === String(user._id) ? receiverIdStr : senderIdStr;
          setChatCache(prevCache => {
            const existing = prevCache[friendIdStr] || [];
            if (existing.find(m => m._id === incomingMsg._id)) return prevCache;
            return { ...prevCache, [friendIdStr]: [...existing, incomingMsg] };
          });
        }
      } catch (error) {
        console.error('WebSocket error:', error);
      }
    };

    ws.onclose = () => setTimeout(connectSocket, 3000);
  }, [user]);

  useEffect(() => {
    connectSocket();
    return () => socketRef.current?.close();
  }, [connectSocket]);

  // 2️⃣ Fetch Messages (Database History aur Pagination)
  const fetchMessages = useCallback(async (friendId, pageNum = 1) => {
    if (!friendId) return;
    setChatError(null);

    if (pageNum === 1) {
      if (chatCache[friendId]) {
        setMessages(chatCache[friendId]); 
      } else {
        setLoadingHistory(true);
      }
    } else {
      setIsFetchingOld(true);
      if (chatBodyRef.current) prevScrollHeightRef.current = chatBodyRef.current.scrollHeight;
    }

    try {
      const { data } = await API.get(`/messages/${friendId}?page=${pageNum}&limit=50`);
      const safeData = Array.isArray(data) ? data : [];
      setHasMore(safeData.length === 50);

      if (pageNum === 1) {
        setMessages(safeData);
        setChatCache(prev => ({ ...prev, [friendId]: safeData }));
      } else {
        setMessages(prev => [...safeData, ...prev]);
        setChatCache(prev => ({ ...prev, [friendId]: [...safeData, ...(prev[friendId] || [])] }));
      }
    } catch (err) {
      console.error("Fetch Error:", err);
      setChatError("History load nahi ho saki.");
      if (pageNum === 1 && !chatCache[friendId]) setMessages([]);
    } finally {
      setLoadingHistory(false);
      setIsFetchingOld(false);
    }
  }, [chatCache]);

  // Jab chat khule toh fetch trigger karein
  useEffect(() => {
    if (activeChat) {
      setPage(1);
      setHasMore(true);
      fetchMessages(activeChat._id, 1);
    }
  }, [activeChat, fetchMessages]);

  // 3️⃣ Scroll Management
  const handleScroll = (e) => {
    if (e.target.scrollTop === 0 && !isFetchingOld && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchMessages(activeChat._id, nextPage);
    }
  };

  useEffect(() => {
    if (page === 1) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight - prevScrollHeightRef.current;
    }
  }, [messages, page, isOpen]);

  // 4️⃣ Send Message
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    const msgContent = newMessage;
    setNewMessage(''); 

    const temporaryMessage = {
      _id: `temp-${Date.now()}`,
      sender: user._id,
      content: msgContent,
      createdAt: new Date().toISOString(),
      isSending: true
    };

    setMessages(prev => [...prev, temporaryMessage]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

    try {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'send_message', payload: temporaryMessage }));
      }
      const { data } = await API.post('/messages', { receiverId: activeChat._id, content: msgContent });
      
      setMessages(prev => prev.map(msg => msg._id === temporaryMessage._id ? data : msg));
      setChatCache(prev => ({
        ...prev, 
        [activeChat._id]: (prev[activeChat._id] || []).map(msg => msg._id === temporaryMessage._id ? data : msg)
      }));
    } catch (err) {
      console.error("Send Error:", err);
    }
  };

  const openChatWith = (e, friend) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveChat(friend);
  };

  if (!user) return null;

  // 👉 Duplicate connections hatane ke liye filter
  const uniqueFriends = useMemo(() => {
    if (!user.connections) return [];
    const seen = new Set();
    const unique = [];
    user.connections.forEach(friend => {
      if (!friend) return;
      const friendObj = typeof friend === 'object' ? friend : { _id: friend, name: 'User' };
      if (friendObj._id && !seen.has(friendObj._id)) {
        seen.add(friendObj._id);
        unique.push(friendObj);
      }
    });
    return unique;
  }, [user.connections]);

  return (
    <div className="fixed bottom-6 right-6 z-[100] font-sans">
      {!isOpen && (
        <div className="relative group cursor-pointer select-none" onClick={() => setIsOpen(true)}>
          <div className="absolute -inset-1 bg-gradient-to-r from-[#FF0080] via-[#7928CA] to-[#0070F3] rounded-full blur-lg opacity-70 group-hover:opacity-100 transition duration-1000 animate-pulse"></div>
          <div className="relative flex items-center justify-center bg-gray-900 dark:bg-[#0a0a0a] p-4 rounded-full text-white shadow-2xl border border-white/10">
            <MessageCircle size={30} className="group-hover:rotate-12 transition-transform duration-500" />
            <span className="absolute top-0 right-0 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-pink-500 border-2 border-gray-900 dark:border-black"></span>
            </span>
          </div>
        </div>
      )}

      {isOpen && (
        <div className="w-[350px] sm:w-[380px] h-[520px] bg-white/95 dark:bg-[#0d0d0d]/95 backdrop-blur-2xl border border-gray-200 dark:border-white/10 rounded-[2.5rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden relative z-50 animate-in zoom-in-95 duration-300">
          <div className="bg-gradient-to-r from-[#FF0080] via-[#7928CA] to-[#0070F3] text-white p-5 flex items-center justify-between shadow-xl relative z-10 select-none">
            <Sparkles size={100} className="absolute -top-6 -right-6 opacity-10 rotate-45 pointer-events-none" />
            <div className="flex items-center gap-3 relative z-10">
              {activeChat && (
                <button onClick={() => setActiveChat(null)} className="hover:bg-white/20 p-2 rounded-full cursor-pointer relative z-50">
                  <ArrowLeft size={20} />
                </button>
              )}
              <h3 className="font-black text-[19px] tracking-tight">{activeChat ? activeChat.name : 'Vibe Check 💬'}</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-2 rounded-full cursor-pointer relative z-50">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-transparent relative z-20">
            {!activeChat && (
              <div className="p-4 space-y-3 relative z-30">
                {uniqueFriends.length === 0 ? (
                  <div className="text-center py-16 select-none">
                    <div className="bg-gradient-to-tr from-gray-100 to-gray-200 dark:from-white/5 dark:to-white/10 p-7 rounded-[2rem] mb-4 rotate-6 shadow-inner border border-white/5 inline-block">
                      <MessageCircle size={45} className="text-gray-400 dark:text-gray-600" />
                    </div>
                    <p className="text-[17px] font-black dark:text-gray-200 mt-2">Abhi koi connections nahi hain.</p>
                  </div>
                ) : (
                  uniqueFriends.map((friendObj) => {
                    const avatar = friendObj.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friendObj._id}`;
                    return (
                      <div 
                        key={friendObj._id} 
                        onClick={(e) => openChatWith(e, friendObj)}
                        className="select-none flex items-center gap-4 p-4 hover:bg-gray-100 dark:hover:bg-white/5 rounded-[2rem] cursor-pointer transition-all border border-transparent hover:border-gray-200 dark:border-white/10 relative z-40"
                      >
                        <div className="relative pointer-events-none">
                          <img src={avatar} className="w-14 h-14 rounded-2xl object-cover shadow-lg" alt="" />
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-4 border-white dark:border-[#0d0d0d] rounded-full"></div>
                        </div>
                        <div className="flex-1 text-left pointer-events-none">
                          <h4 className="font-black text-[16px] dark:text-white">{friendObj.name}</h4>
                          <p className="text-[13px] text-gray-500 font-bold truncate">@vibe_{friendObj.handle || 'user'}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeChat && (
              <div className="flex flex-col h-full relative z-30">
                <div ref={chatBodyRef} onScroll={handleScroll} className="flex-1 p-5 overflow-y-auto space-y-4 pb-28 scrollbar-hide">
                  {chatError && (
                    <div className="p-3 bg-red-100 text-red-700 rounded-xl text-xs font-bold flex gap-2 justify-center">
                       <AlertTriangle size={16}/> {chatError}
                    </div>
                  )}
                  {isFetchingOld && <div className="flex justify-center py-2"><Loader2 className="animate-spin text-purple-500" size={24} /></div>}
                  {loadingHistory && messages.length === 0 ? (
                    <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-purple-600" size={35} /></div>
                  ) : messages.length === 0 ? (
                    <div className="text-center mt-12 select-none"><p className="text-[18px] font-black italic dark:text-gray-200">Say hi to {activeChat.name}! 🔥</p></div>
                  ) : (
                    messages.map((msg, idx) => (
                      <div key={msg._id || idx} className={`flex ${String(msg.sender._id || msg.sender) === String(user._id) ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                        <div className={`max-w-[80%] px-5 py-3 text-[15px] font-bold shadow-lg rounded-[1.8rem] transition-all ${
                          String(msg.sender._id || msg.sender) === String(user._id) ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-br-sm' 
                               : 'bg-white dark:bg-[#1a1a1a] dark:text-gray-100 border border-gray-100 dark:border-white/5 rounded-bl-sm'
                        } ${msg.isSending ? 'opacity-60' : 'opacity-100'}`}>
                          {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} className="h-4" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-5 bg-white/80 dark:bg-[#0d0d0d]/80 backdrop-blur-xl border-t border-gray-100 dark:border-white/5">
                  <form onSubmit={sendMessage} className="flex items-center gap-3 bg-gray-100 dark:bg-[#1a1a1a] p-2 rounded-full border border-gray-200 dark:border-white/10 focus-within:ring-2 ring-purple-500/50">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Kuch likhein..."
                      className="flex-1 bg-transparent px-5 py-2 outline-none text-[15px] font-bold dark:text-white"
                      autoComplete="off"
                    />
                    <button type="submit" disabled={!newMessage.trim()} className="bg-gradient-to-r from-[#FF0080] to-[#7928CA] text-white p-3.5 rounded-full disabled:opacity-30 active:scale-90 transition-all cursor-pointer">
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