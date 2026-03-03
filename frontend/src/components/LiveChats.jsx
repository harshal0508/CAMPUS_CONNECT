import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MessageCircle, X, Send, ArrowLeft, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import axios from 'axios';
// 👉 Path fix: 'context' se 'contexts' kiya gaya hai resolution error theek karne ke liye
import { useUser } from '../contexts/UserContext'; 

const API_URL = 'http://localhost:5000/api';
const WS_URL = 'ws://localhost:5000'; 

const API = axios.create({
  baseURL: API_URL,
  withCredentials: true 
});

export default function LiveChat() {
  // fetchFreshProfile ko destructure kiya taaki connection list hamesha sync rahe
  const { user, fetchFreshProfile } = useUser(); 
  
  const [isOpen, setIsOpen] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isFetchingOld, setIsFetchingOld] = useState(false);
  const [chatError, setChatError] = useState(null);

  // 🧠 Memory Cache & Refs (No-Lag Architecture)
  const chatCacheRef = useRef({}); 
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const chatBodyRef = useRef(null);
  const prevScrollHeightRef = useRef(0);
  
  // Preview trigger state: Jab background mein previews load hon toh list refresh ho
  const [previewSync, setPreviewSync] = useState(0);

  const myId = useMemo(() => user?._id?.toString(), [user?._id]);
  const activeChatId = useMemo(() => activeChat?._id?.toString(), [activeChat?._id]);

  const activeChatIdRef = useRef(null);
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  // Connections dependency taaki list hamesha updated rahe
  const uniqueFriends = useMemo(() => {
    if (!user || !user.connections) return [];
    const seen = new Set();
    const unique = [];
    user.connections.forEach(f => {
      if (!f) return;
      // Object ya ID dono cases handle kiye gaye hain
      const fObj = typeof f === 'object' ? f : { _id: f, name: 'User' };
      const fIdStr = fObj._id?.toString();
      if (fIdStr && !seen.has(fIdStr)) {
        seen.add(fIdStr);
        unique.push(fObj);
      }
    });
    return unique;
  }, [user, user?.connections]);

  // 1️⃣ WebSocket Engine
  const connectSocket = useCallback(() => {
    if (!myId) return;
    const ws = new WebSocket(WS_URL);
    socketRef.current = ws;

    ws.onopen = () => ws.send(JSON.stringify({ type: 'setup', payload: myId }));

    ws.onmessage = (event) => {
      try {
        const parsedData = JSON.parse(event.data);
        if (parsedData.type === 'receive_message') {
          const msg = parsedData.payload;
          const sId = (msg.sender?._id || msg.sender)?.toString();
          const rId = (msg.receiver?._id || msg.receiver)?.toString();
          const currentOpenId = activeChatIdRef.current;

          const isRelevant = (sId === currentOpenId && rId === myId) || (sId === myId && rId === currentOpenId);

          if (isRelevant) {
            setMessages(prev => {
              if (prev.find(m => m._id === msg._id || (msg.tempId && m._id === msg.tempId))) return prev;
              return [...prev, msg];
            });
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
          }

          // Background Sync & Last Message preview update
          const friendId = (sId === myId) ? rId : sId;
          if (friendId) {
            const cached = chatCacheRef.current[friendId] || [];
            if (!cached.find(m => m._id === msg._id)) {
              chatCacheRef.current[friendId] = [...cached, msg];
              setPreviewSync(prev => prev + 1);
            }
          }
        }
      } catch (error) { console.error('WS Error:', error); }
    };

    ws.onclose = () => setTimeout(connectSocket, 2500);
  }, [myId]);

  useEffect(() => {
    connectSocket();
    return () => socketRef.current?.close();
  }, [connectSocket]);

  // 2️⃣ History & Preview Logic
  const fetchMessages = useCallback(async (friendId, pageNum = 1, isPreviewOnly = false) => {
    if (!friendId) return;
    try {
      const { data } = await API.get(`/messages/${friendId}?page=${pageNum}&limit=${isPreviewOnly ? 1 : 50}`);
      const safeData = Array.isArray(data) ? data : [];
      
      if (isPreviewOnly) {
        if (safeData.length > 0) {
          chatCacheRef.current[friendId] = safeData;
          setPreviewSync(prev => prev + 1);
        }
        return;
      }

      setHasMore(safeData.length === 50);
      if (pageNum === 1) {
        setMessages(safeData);
        chatCacheRef.current[friendId] = safeData;
      } else {
        setMessages(prev => [...safeData, ...prev]);
        chatCacheRef.current[friendId] = [...safeData, ...(chatCacheRef.current[friendId] || [])];
      }
    } catch (err) {
      if (!isPreviewOnly) setChatError("History load nahi ho paayi.");
    } finally {
      if (!isPreviewOnly) {
        setLoadingHistory(false);
        setIsFetchingOld(false);
      }
    }
  }, []);

  // Sync: Jab widget khule, fresh profile mangwao
  useEffect(() => {
    if (isOpen) {
      fetchFreshProfile();
    }
  }, [isOpen, fetchFreshProfile]);

  // Jab widget khule, sabhi connections ke previews mangwao
  useEffect(() => {
    if (isOpen && !activeChatId && uniqueFriends.length > 0) {
      uniqueFriends.forEach(f => {
        const fId = f._id?.toString();
        if (fId && !chatCacheRef.current[fId]) {
          fetchMessages(fId, 1, true);
        }
      });
    }
  }, [isOpen, activeChatId, uniqueFriends, fetchMessages]);

  useEffect(() => {
    if (activeChatId) {
      setPage(1);
      setHasMore(true);
      setMessages(chatCacheRef.current[activeChatId] || []);
      fetchMessages(activeChatId, 1);
    }
  }, [activeChatId, fetchMessages]);

  // 3️⃣ Instant Send (Optimistic UI)
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChatId || !myId) return;

    const content = newMessage;
    setNewMessage(''); 
    const tempId = `temp-${Date.now()}`;
    const tempMsg = { _id: tempId, tempId, sender: myId, receiver: activeChatId, content, createdAt: new Date().toISOString(), isSending: true };

    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'send_message', payload: tempMsg }));
    }

    try {
      const { data } = await API.post('/messages', { receiverId: activeChatId, content });
      setMessages(prev => prev.map(m => (m._id === tempId || m.tempId === tempId) ? data : m));
      const cached = chatCacheRef.current[activeChatId] || [];
      chatCacheRef.current[activeChatId] = cached.map(m => (m._id === tempId || m.tempId === tempId) ? data : m);
      setPreviewSync(prev => prev + 1);
    } catch (err) {
      setMessages(prev => prev.filter(m => m._id !== tempId));
      setChatError("Bhejne mein fail.");
    }
  };

  const handleScroll = (e) => {
    if (e.target.scrollTop === 0 && !isFetchingOld && hasMore && activeChatId) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchMessages(activeChatId, nextPage);
    }
  };

  useEffect(() => {
    if (page === 1) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    else if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight - prevScrollHeightRef.current;
    }
  }, [messages.length, page, isOpen]);

  if (!user) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] font-sans text-gray-900">
      {!isOpen ? (
        <div className="relative group cursor-pointer active:scale-95 transition-all" onClick={() => setIsOpen(true)}>
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000 animate-pulse"></div>
          <div className="relative flex items-center justify-center bg-black p-4 rounded-full text-white shadow-2xl border border-white/10">
            <MessageCircle size={28} />
          </div>
        </div>
      ) : (
        <div className="w-[350px] sm:w-[380px] h-[550px] bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 origin-bottom-right">
          
          <div className="bg-[#111] text-white p-5 flex items-center justify-between border-b border-white/5 relative z-10">
            <div className="flex items-center gap-3">
              {activeChat && <button onClick={() => setActiveChat(null)} className="hover:bg-white/10 p-2 rounded-full transition-colors"><ArrowLeft size={20} /></button>}
              <h3 className="font-bold text-[18px] tracking-tight truncate max-w-[150px]">{activeChat ? activeChat.name : 'Vibe Direct'}</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 p-2 rounded-full transition-colors"><X size={18} /></button>
          </div>

          <div className="flex-1 overflow-hidden relative">
            {!activeChat ? (
              <div className="p-4 space-y-2 overflow-y-auto h-full scrollbar-hide">
                {uniqueFriends.length === 0 ? (
                  <div className="text-center py-20 opacity-40"><p className="font-black italic">No connections yet.</p></div>
                ) : (
                  uniqueFriends.map(f => {
                    const fId = f._id?.toString();
                    const lastMsg = chatCacheRef.current[fId]?.slice(-1)[0];
                    return (
                      <div key={f._id} onClick={() => setActiveChat(f)} className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-white/[0.03] rounded-2xl cursor-pointer transition-all active:scale-[0.98]">
                        <img src={f.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${f.name || 'U'}`} className="w-12 h-12 rounded-xl object-cover bg-gray-100" alt="" />
                        <div className="flex-1 text-left overflow-hidden">
                          <h4 className="font-bold dark:text-white truncate">{f.name}</h4>
                          <p className="text-[12px] text-gray-500 dark:text-gray-400 truncate font-medium">
                            {lastMsg ? lastMsg.content : 'New conversation ✨'}
                          </p>
                        </div>
                        {lastMsg && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="flex flex-col h-full bg-gray-50/50 dark:bg-black/20">
                <div ref={chatBodyRef} onScroll={handleScroll} className="flex-1 p-5 overflow-y-auto space-y-4 pb-24 scrollbar-hide">
                  {isFetchingOld && <div className="flex justify-center py-2"><Loader2 className="animate-spin text-blue-500" size={20} /></div>}
                  {loadingHistory && messages.length === 0 ? (
                    <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-blue-600" size={30} /></div>
                  ) : (
                    messages.map((msg, idx) => {
                      const sId = (msg.sender?._id || msg.sender)?.toString();
                      const isMe = sId === myId;
                      return (
                        <div key={msg._id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-1`}>
                          <div className={`max-w-[85%] px-4 py-2.5 text-[14.5px] font-medium shadow-sm rounded-2xl transition-all ${
                            isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white dark:bg-[#1a1a1a] dark:text-gray-100 border border-gray-100 dark:border-white/5 rounded-bl-none'
                          } ${msg.isSending ? 'opacity-50' : ''}`}>{msg.content}</div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} className="h-1" />
                </div>
                
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-black/60 backdrop-blur-xl border-t border-gray-100 dark:border-white/5">
                  <form onSubmit={sendMessage} className="flex items-center gap-2 bg-gray-100 dark:bg-white/[0.05] p-1.5 rounded-2xl border border-gray-200 dark:border-white/10 focus-within:ring-2 ring-blue-500/30">
                    <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." className="flex-1 bg-transparent px-3 py-2 outline-none dark:text-white text-sm" autoComplete="off" />
                    <button type="submit" disabled={!newMessage.trim()} className="bg-blue-600 text-white p-2.5 rounded-xl shadow-lg active:scale-90 transition-transform"><Send size={18} /></button>
                  </form>
                  {chatError && <p className="text-[10px] text-red-500 text-center mt-1 font-bold">{chatError}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}