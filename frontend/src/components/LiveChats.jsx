import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MessageCircle, X, Send, ArrowLeft, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import axios from 'axios';
// 👉 FIX: Path ko singular 'context' kar diya gaya hai resolution error theek karne ke liye
import { useUser } from '../contexts/UserContext'; 

const API_URL = 'http://localhost:5000/api';
const WS_URL = 'ws://localhost:5000'; 

const API = axios.create({
  baseURL: API_URL,
  withCredentials: true 
});

export default function LiveChat() {
  // 1. Saare Hooks top level par (Strict Order)
  const { user } = useUser(); 
  
  const [isOpen, setIsOpen] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isFetchingOld, setIsFetchingOld] = useState(false);
  const [chatError, setChatError] = useState(null);

  // Cache ke liye Ref (Infinite Loop se bachne ke liye)
  const chatCacheRef = useRef({}); 
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const chatBodyRef = useRef(null);
  const prevScrollHeightRef = useRef(0);
  
  const activeChatRef = useRef(null);

  // Active chat ko ref mein update karna
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // 👉 FIX: useMemo ko early return se pehle move kiya (Rules of Hooks)
  const uniqueFriends = useMemo(() => {
    if (!user || !user.connections) return [];
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
  }, [user?.connections]); 

  // fetchMessages definition (Stable Identity)
  const fetchMessages = useCallback(async (friendId, pageNum = 1) => {
    if (!friendId) return;
    setChatError(null);

    if (pageNum === 1) {
      if (chatCacheRef.current[friendId]) {
        setMessages(chatCacheRef.current[friendId]); 
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
        chatCacheRef.current[friendId] = safeData;
      } else {
        setMessages(prev => [...safeData, ...prev]);
        chatCacheRef.current[friendId] = [...safeData, ...(chatCacheRef.current[friendId] || [])];
      }
    } catch (err) {
      setChatError("Sync error.");
    } finally {
      setLoadingHistory(false);
      setIsFetchingOld(false);
    }
  }, []);

  // WebSocket connection logic
  const connectSocket = useCallback(() => {
    if (!user?._id) return;
    const ws = new WebSocket(WS_URL);
    socketRef.current = ws;

    ws.onopen = () => ws.send(JSON.stringify({ type: 'setup', payload: user._id }));

    ws.onmessage = (event) => {
      try {
        const parsedData = JSON.parse(event.data);
        if (parsedData.type === 'receive_message') {
          const incomingMsg = parsedData.payload;
          const currentChat = activeChatRef.current;
          const senderIdStr = String(incomingMsg.sender._id || incomingMsg.sender);
          const receiverIdStr = String(incomingMsg.receiver._id || incomingMsg.receiver);
          
          if (currentChat && (senderIdStr === String(currentChat._id) || receiverIdStr === String(currentChat._id))) {
            setMessages(prev => (prev.find(m => m._id === incomingMsg._id) ? prev : [...prev, incomingMsg]));
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
          }

          const friendIdStr = senderIdStr === String(user._id) ? receiverIdStr : senderIdStr;
          const existing = chatCacheRef.current[friendIdStr] || [];
          if (!existing.find(m => m._id === incomingMsg._id)) {
            chatCacheRef.current[friendIdStr] = [...existing, incomingMsg];
          }
        }
      } catch (error) { console.error('WS error:', error); }
    };

    ws.onclose = () => setTimeout(connectSocket, 3000);
  }, [user?._id]);

  useEffect(() => {
    connectSocket();
    return () => socketRef.current?.close();
  }, [connectSocket]);

  useEffect(() => {
    if (activeChat) {
      setPage(1);
      setHasMore(true);
      if (!chatCacheRef.current[activeChat._id]) setMessages([]);
      fetchMessages(activeChat._id, 1);
    }
  }, [activeChat?._id, fetchMessages]);

  const handleScroll = (e) => {
    if (e.target.scrollTop === 0 && !isFetchingOld && hasMore && activeChat) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchMessages(activeChat._id, nextPage);
    }
  };

  useEffect(() => {
    if (page === 1) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    else if (chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight - prevScrollHeightRef.current;
  }, [messages, page, isOpen]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    const msgContent = newMessage;
    setNewMessage(''); 
    const tempId = `temp-${Date.now()}`;
    const temporaryMessage = { _id: tempId, sender: user._id, content: msgContent, createdAt: new Date().toISOString(), isSending: true };

    setMessages(prev => [...prev, temporaryMessage]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

    try {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'send_message', payload: temporaryMessage }));
      }
      const { data } = await API.post('/messages', { receiverId: activeChat._id, content: msgContent });
      setMessages(prev => prev.map(msg => msg._id === tempId ? data : msg));
      chatCacheRef.current[activeChat._id] = (chatCacheRef.current[activeChat._id] || []).map(msg => msg._id === tempId ? data : msg);
    } catch (err) { console.error("Send fail:", err); }
  };

  const openChatWith = (e, friend) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveChat(friend);
  };

  // 2. Early return hooks ke baad hona chahiye
  if (!user) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] font-sans text-gray-900">
      {!isOpen && (
        <div className="relative group cursor-pointer" onClick={() => setIsOpen(true)}>
          <div className="absolute -inset-1 bg-gradient-to-r from-[#FF0080] via-[#7928CA] to-[#0070F3] rounded-full blur-lg opacity-70 group-hover:opacity-100 transition duration-1000 animate-pulse"></div>
          <div className="relative flex items-center justify-center bg-gray-900 p-4 rounded-full text-white shadow-2xl border border-white/10">
            <MessageCircle size={30} className="group-hover:rotate-12 transition-transform" />
            <span className="absolute top-0 right-0 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-pink-500 border-2 border-gray-900"></span>
            </span>
          </div>
        </div>
      )}

      {isOpen && (
        <div className="w-[350px] sm:w-[380px] h-[520px] bg-white/95 dark:bg-[#0d0d0d]/95 backdrop-blur-2xl border border-gray-200 dark:border-white/10 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
          <div className="bg-gradient-to-r from-[#FF0080] via-[#7928CA] to-[#0070F3] text-white p-5 flex items-center justify-between shadow-xl relative z-10">
            <div className="flex items-center gap-3">
              {activeChat && <button onClick={() => setActiveChat(null)} className="hover:bg-white/20 p-2 rounded-full"><ArrowLeft size={20} /></button>}
              <h3 className="font-black text-[19px] tracking-tight">{activeChat ? activeChat.name : 'Vibe Check 💬'}</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-2 rounded-full"><X size={18} /></button>
          </div>

          <div className="flex-1 overflow-y-auto relative z-20">
            {!activeChat ? (
              <div className="p-4 space-y-3">
                {uniqueFriends.length === 0 ? (
                  <div className="text-center py-16"><p className="text-[17px] font-black dark:text-gray-400">No connections.</p></div>
                ) : (
                  uniqueFriends.map(f => (
                    <div key={f._id} onClick={(e) => openChatWith(e, f)} className="flex items-center gap-4 p-4 hover:bg-gray-100 dark:hover:bg-white/5 rounded-[2rem] cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-white/10 transition-all">
                      <img src={f.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${f._id}`} className="w-14 h-14 rounded-2xl object-cover" alt="" />
                      <div className="flex-1"><h4 className="font-black dark:text-white">{f.name}</h4><p className="text-[13px] text-gray-500 truncate">@vibe_{f.handle || 'user'}</p></div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div ref={chatBodyRef} onScroll={handleScroll} className="flex-1 p-5 overflow-y-auto space-y-4 pb-28 scrollbar-hide">
                  {chatError && <div className="p-2 bg-red-100 text-red-700 rounded-xl text-xs flex justify-center"><AlertTriangle size={14}/> {chatError}</div>}
                  {isFetchingOld && <div className="flex justify-center"><Loader2 className="animate-spin text-purple-500" size={20} /></div>}
                  {loadingHistory && messages.length === 0 ? (
                    <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-purple-600" size={30} /></div>
                  ) : (
                    messages.map((msg, idx) => (
                      <div key={msg._id || idx} className={`flex ${String(msg.sender._id || msg.sender) === String(user._id) ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-5 py-3 text-[15px] font-bold shadow-lg rounded-[1.8rem] transition-all ${
                          String(msg.sender._id || msg.sender) === String(user._id) ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-br-sm' : 'bg-white dark:bg-[#1a1a1a] dark:text-white border border-gray-100 dark:border-white/5 rounded-bl-sm'
                        } ${msg.isSending ? 'opacity-60' : ''}`}>{msg.content}</div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} className="h-2" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-5 bg-white/80 dark:bg-[#0d0d0d]/80 backdrop-blur-xl border-t border-gray-100 dark:border-white/5">
                  <form onSubmit={sendMessage} className="flex items-center gap-3 bg-gray-100 dark:bg-[#1a1a1a] p-2 rounded-full border border-gray-200 dark:border-white/10 focus-within:ring-2 ring-purple-500/50">
                    <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Kuch likhein..." className="flex-1 bg-transparent px-5 py-2 outline-none dark:text-white font-bold" />
                    <button type="submit" disabled={!newMessage.trim()} className="bg-gradient-to-r from-[#FF0080] to-[#7928CA] text-white p-3.5 rounded-full transition-all active:scale-90"><Send size={20} /></button>
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