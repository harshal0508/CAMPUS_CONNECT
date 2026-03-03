import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MessageCircle, X, Send, ArrowLeft, Loader2, Sparkles, Zap, Flame } from 'lucide-react';
import axios from 'axios';

// 👉 FIX: Path ko theek kiya gaya hai
import { useUser } from '../contexts/UserContext'; 

const API_URL = 'http://localhost:5000/api';
const WS_URL = 'ws://localhost:5000'; 

const API = axios.create({
  baseURL: API_URL,
  withCredentials: true 
});

export default function LiveChat() {
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

  const chatCacheRef = useRef({}); 
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const chatBodyRef = useRef(null);
  const prevScrollHeightRef = useRef(0);
  
  const [loadingPreviews, setLoadingPreviews] = useState(false);
  // ⚡ UI ko re-render karne ke liye trigger
  const [, setPreviewSync] = useState(0); 

  const myId = useMemo(() => user?._id?.toString(), [user?._id]);
  const activeChatId = useMemo(() => activeChat?._id?.toString(), [activeChat?._id]);

  const activeChatIdRef = useRef(null);
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  const uniqueFriends = useMemo(() => {
    if (!user || !user.connections) return [];
    const seen = new Set();
    const unique = [];
    user.connections.forEach(f => {
      if (!f) return;
      const fObj = typeof f === 'object' ? f : { _id: f, name: 'User' };
      const fIdStr = fObj._id?.toString();
      if (fIdStr && !seen.has(fIdStr)) {
        seen.add(fIdStr);
        unique.push(fObj);
      }
    });
    return unique;
  }, [user, user?.connections]);

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

          if ((sId === currentOpenId && rId === myId) || (sId === myId && rId === currentOpenId)) {
            setMessages(prev => {
              if (prev.find(m => m._id === msg._id || (msg.tempId && m._id === msg.tempId))) return prev;
              return [...prev, msg];
            });
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
          }

          const friendId = (sId === myId) ? rId : sId;
          if (friendId) {
            const cached = chatCacheRef.current[friendId] || [];
            if (!cached.find(m => m._id === msg._id)) {
              chatCacheRef.current[friendId] = [...cached, msg];
              setPreviewSync(p => p + 1);
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

  const syncAllPreviews = useCallback(async (friends) => {
    if (!friends || friends.length === 0) return;
    setLoadingPreviews(true);
    try {
      await Promise.all(friends.map(async (f) => {
        const fId = f._id?.toString();
        if (fId && !chatCacheRef.current[fId]) {
          try {
            const { data } = await API.get(`/messages/${fId}?page=1&limit=1`);
            if (Array.isArray(data) && data.length > 0) {
              chatCacheRef.current[fId] = data;
            }
          } catch (e) { /* errors ko silently handle karna */ }
        }
      }));
      setPreviewSync(p => p + 1);
    } catch (err) { console.error(err); } finally {
      setLoadingPreviews(false);
    }
  }, []);

  const fetchMessages = useCallback(async (friendId, pageNum = 1) => {
    if (!friendId) return;
    setChatError(null);
    if (pageNum === 1) setLoadingHistory(true);
    else setIsFetchingOld(true);

    try {
      const { data } = await API.get(`/messages/${friendId}?page=${pageNum}&limit=50`);
      const safeData = Array.isArray(data) ? data : [];
      setHasMore(safeData.length === 50);

      if (pageNum === 1) {
        setMessages(safeData);
        chatCacheRef.current[friendId] = safeData;
        setPreviewSync(p => p + 1); 
      } else {
        setMessages(prev => [...safeData, ...prev]);
        chatCacheRef.current[friendId] = [...safeData, ...(chatCacheRef.current[friendId] || [])];
      }
    } catch (err) { setChatError("Messages sync karne mein fail hue."); } finally {
      setLoadingHistory(false);
      setIsFetchingOld(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && uniqueFriends.length > 0) { 
      fetchFreshProfile(); 
      syncAllPreviews(uniqueFriends);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, fetchFreshProfile, syncAllPreviews, uniqueFriends.length]); 

  useEffect(() => {
    if (activeChatId) {
      setPage(1);
      setHasMore(true);
      setMessages(chatCacheRef.current[activeChatId] || []);
      fetchMessages(activeChatId, 1);
    }
  }, [activeChatId, fetchMessages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChatId || !myId) return;

    const content = newMessage;
    setNewMessage(''); 
    const tempId = `temp-${Date.now()}`;
    const tempMsg = { _id: tempId, tempId, sender: myId, receiver: activeChatId, content, createdAt: new Date().toISOString(), isSending: true };

    setMessages(prev => [...prev, tempMsg]);
    const currentCached = chatCacheRef.current[activeChatId] || [];
    chatCacheRef.current[activeChatId] = [...currentCached, tempMsg];
    setPreviewSync(p => p + 1);

    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'send_message', payload: tempMsg }));
    }

    try {
      const { data } = await API.post('/messages', { receiverId: activeChatId, content });
      setMessages(prev => prev.map(m => (m._id === tempId || m.tempId === tempId) ? data : m));
      const cached = chatCacheRef.current[activeChatId] || [];
      chatCacheRef.current[activeChatId] = cached.map(m => (m._id === tempId || m.tempId === tempId) ? data : m);
      setPreviewSync(p => p + 1);
    } catch (err) {
      setMessages(prev => prev.filter(m => m._id !== tempId));
      const cached = chatCacheRef.current[activeChatId] || [];
      chatCacheRef.current[activeChatId] = cached.filter(m => m._id !== tempId);
      setPreviewSync(p => p + 1);
      setChatError("Message bhejne mein fail hue.");
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
    <div className="fixed bottom-6 right-6 z-[100] font-sans selection:bg-[#1d9bf0]/30">
      {!isOpen ? (
        <div className="relative group cursor-pointer" onClick={() => setIsOpen(true)}>
          <div className="absolute -inset-1.5 bg-gradient-to-r from-[#1d9bf0] via-purple-600 to-[#FF0080] rounded-full blur-md opacity-60 group-hover:opacity-100 transition duration-500 animate-pulse"></div>
          <button className="relative flex items-center justify-center bg-black p-5 rounded-full text-white shadow-2xl border border-white/10 active:scale-90 transition-all cursor-pointer">
            <MessageCircle size={32} />
          </button>
        </div>
      ) : (
        <div className="w-[360px] sm:w-[390px] h-[580px] bg-white/95 dark:bg-[#050505]/95 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 origin-bottom-right">
          <div className="bg-gradient-to-r from-[#1d9bf0] via-purple-600 to-pink-600 text-white p-6 flex items-center justify-between shadow-xl">
             <div className="flex items-center gap-3 relative z-10">
              {activeChat && (
                <button onClick={() => setActiveChat(null)} className="hover:bg-white/20 p-2.5 rounded-full transition-all active:scale-75 cursor-pointer">
                  <ArrowLeft size={22} />
                </button>
              )}
              <div className="flex flex-col">
                <h3 className="font-black text-xl tracking-tight truncate max-w-[160px]">
                  {activeChat ? activeChat.name : 'VIBE DIRECT'}
                </h3>
                {!activeChat && (
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-80 flex items-center gap-1">
                    {loadingPreviews ? 'Syncing Vibes...' : 'Online Squad'} <Zap size={10} fill="currentColor" className={loadingPreviews ? 'animate-spin' : ''} />
                  </span>
                )}
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-2.5 rounded-full transition-all active:scale-75 cursor-pointer">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-hidden relative bg-transparent">
            {!activeChat ? (
              <div className="p-4 space-y-3 overflow-y-auto h-full scrollbar-hide">
                {uniqueFriends.length === 0 ? (
                  <div className="text-center py-24 px-6 animate-in fade-in duration-700">
                    <Flame size={48} className="text-gray-600 mx-auto mb-4" />
                    <p className="font-black text-xl text-gray-400 italic tracking-tighter">Abhi tak koi connection nahi.</p>
                  </div>
                ) : (
                  uniqueFriends.map(f => {
                    const fId = f._id?.toString();
                    const lastMsg = chatCacheRef.current[fId]?.slice(-1)[0];
                    return (
                      <div 
                        key={f._id} 
                        onClick={() => setActiveChat(f)} 
                        className="flex items-center gap-4 p-4 hover:bg-gray-100 dark:hover:bg-white/[0.04] rounded-3xl cursor-pointer transition-all active:scale-[0.97] group border border-transparent hover:border-gray-200 dark:hover:border-white/5"
                      >
                        <div className="relative flex-shrink-0">
                          <img src={f.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${f.name || 'U'}`} className="w-14 h-14 rounded-2xl object-cover bg-gray-100 shadow-sm" alt="" />
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-4 border-white dark:border-[#0a0a0a] rounded-full" />
                        </div>
                        <div className="flex-1 text-left overflow-hidden">
                          <h4 className="font-black dark:text-white truncate group-hover:text-[#1d9bf0] transition-colors">{f.name}</h4>
                          <p className={`text-[13px] truncate font-semibold ${lastMsg ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400 italic animate-pulse'}`}>
                            {lastMsg ? lastMsg.content : 'Ek vibe bhejein... ✨'}
                          </p>
                        </div>
                        {lastMsg && <div className="w-2 h-2 bg-[#1d9bf0] rounded-full shadow-[0_0_10px_#1d9bf0]" />}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="flex flex-col h-full bg-gray-50/40 dark:bg-black/40 backdrop-blur-md">
                <div ref={chatBodyRef} onScroll={handleScroll} className="flex-1 p-6 overflow-y-auto space-y-5 pb-28 scrollbar-hide">
                  {isFetchingOld && <div className="flex justify-center py-2"><Loader2 className="animate-spin text-[#1d9bf0]" size={20} /></div>}
                  {loadingHistory && messages.length === 0 ? (
                    <div className="flex justify-center items-center h-full flex-col gap-4">
                      <div className="animate-spin h-10 w-10 border-4 border-[#1d9bf0] border-t-transparent rounded-full shadow-[0_0_20px_rgba(29,155,240,0.4)]" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">DM khol raha hai...</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center mt-16 px-10">
                       <Sparkles className="mx-auto text-yellow-500 mb-4 animate-bounce" size={40} />
                       <p className="font-black text-lg italic dark:text-white">{activeChat.name} ko hi bolein!</p>
                    </div>
                  ) : (
                    messages.map((msg, idx) => {
                      const sId = (msg.sender?._id || msg.sender)?.toString();
                      const isMe = sId === myId;
                      return (
                        <div key={msg._id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                          <div className={`max-w-[85%] px-5 py-3 text-[15px] font-bold shadow-xl rounded-3xl transition-all ${
                            isMe 
                              ? 'bg-gradient-to-br from-[#1d9bf0] to-indigo-600 text-white rounded-br-sm' 
                              : 'bg-white dark:bg-[#151515] dark:text-gray-100 border border-gray-100 dark:border-white/5 rounded-bl-sm'
                          } ${msg.isSending ? 'opacity-50 blur-[1px]' : ''}`}>
                            {msg.content}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} className="h-1" />
                </div>
                
                <div className="absolute bottom-0 left-0 right-0 p-5 bg-white/70 dark:bg-black/60 backdrop-blur-2xl border-t border-gray-100 dark:border-white/5 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
                  <form onSubmit={sendMessage} className="flex items-center gap-3 bg-gray-100 dark:bg-white/[0.04] p-2 rounded-[2rem] border border-gray-200 dark:border-white/10 focus-within:ring-2 ring-[#1d9bf0]/50 focus-within:bg-white dark:focus-within:bg-[#0a0a0a] transition-all duration-300">
                    <input 
                      type="text" 
                      value={newMessage} 
                      onChange={(e) => setNewMessage(e.target.value)} 
                      placeholder="Apna vibe type karein..." 
                      className="flex-1 bg-transparent px-5 py-3 outline-none dark:text-white text-[15px] font-bold" 
                      autoComplete="off" 
                    />
                    <button 
                      type="submit" 
                      disabled={!newMessage.trim()} 
                      className="bg-[#1d9bf0] text-white p-3.5 rounded-full shadow-lg shadow-[#1d9bf0]/30 active:scale-75 transition-all cursor-pointer"
                    >
                      <Send size={20} />
                    </button>
                  </form>
                  {chatError && <p className="text-[10px] text-red-500 text-center mt-2 font-black uppercase tracking-widest">{chatError}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}