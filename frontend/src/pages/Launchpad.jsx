import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Rocket, ChevronUp, Plus, X, Users, TrendingUp, 
  Activity, Code, Cpu, Blocks, ArrowRight, Sparkles, Layers, Image as ImageIcon,
  Check, Map, Send, Briefcase, Target, Zap, Trophy, Crown, MessageSquare, ShieldAlert
} from 'lucide-react';

import API from '../api/axios';
import { useUser } from '../contexts/UserContext';

const PROJECT_STAGES = ['Idea', 'Building MVP', 'Beta Testing', 'Live'];

export default function Launchpad() {
  const { user } = useUser() || {}; 
  
  // --- Intro States ---
  const [showIntro, setShowIntro] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  
  // --- Data States ---
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- Modal States ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [investAmount, setInvestAmount] = useState('');
  const [showPitchModal, setShowPitchModal] = useState(false);
  const [pitchMessage, setPitchMessage] = useState('');
  const [commentText, setCommentText] = useState('');

  const [newProject, setNewProject] = useState({
    title: '', tagline: '', description: '', category: 'Web', tags: '', github: '', hiring: ''
  });

  const handleEnterLaunchpad = () => {
    setIsExiting(true);
    setTimeout(() => setShowIntro(false), 800);
  };

  // ==========================================
  // 🔗 1. FETCH PROJECTS
  // ==========================================
  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await API.get('/launchpad');
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      setError("Failed to sync campus nodes. Please check connection.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // ==========================================
  // 🚀 2. DEPLOY PROJECT
  // ==========================================
  const handleLaunch = async (e) => {
    e.preventDefault();
    try {
      const { data } = await API.post('/launchpad', newProject);
      setProjects([data, ...projects]); 
      setIsModalOpen(false);
      setNewProject({ title: '', tagline: '', description: '', category: 'Web', tags: '', github: '', hiring: '' });
      alert("Node Deployed to Campus! 🚀");
    } catch (err) {
      alert(err.response?.data?.message || "Deployment failed.");
    }
  };

  // ==========================================
  // 🔥 3. UPVOTE
  // ==========================================
  const handleUpvote = async (id, e) => {
    e.stopPropagation();
    try {
      const { data } = await API.patch(`/launchpad/${id}/upvote`);
      setProjects(projects.map(p => 
        p._id === id ? { ...p, hasUpvoted: data.hasUpvoted, upvotes: Array(data.upvotes || data.upvotesCount).fill(0) } : p
      ));
    } catch (err) {
      console.error("Upvote failed", err);
    }
  };

  // ==========================================
  // 💎 4. INVEST
  // ==========================================
  const handleInvest = async (e) => {
    e.preventDefault();
    const amount = Number(investAmount);
    if (!amount || amount <= 0) return;
    try {
      const { data } = await API.post(`/launchpad/${selectedProject._id}/invest`, { amount });
      const newTokensRaised = data.totalRaised || selectedProject.tokensRaised + amount;
      
      setProjects(projects.map(p => 
        p._id === selectedProject._id ? { ...p, tokensRaised: newTokensRaised } : p
      ));
      setSelectedProject({ ...selectedProject, tokensRaised: newTokensRaised });
      setInvestAmount('');
      
      window.dispatchEvent(new Event('profileUpdated'));
      alert(`Transaction Successful! 💎`);
    } catch (err) {
      alert(err.response?.data?.message || "Transaction failed. Insufficient balance?");
    }
  };

  // ==========================================
  // 🗺️ 5. ROADMAP & Q&A ACTIONS (Optimistic UI)
  // ==========================================
  const handleAdvanceStage = async (newStage) => {
    // 👉 BUG FIX: Check if the logged-in user is part of the founder team
    const isFounder = selectedProject?.team?.some(
      (member) => member.user?._id === user?._id && member.role?.toLowerCase().includes('founder')
    ) || selectedProject?.founder === user?._id || selectedProject?.userId === user?._id;

    if (!isFounder) {
      alert("Only the project founder can update the roadmap!");
      return;
    }

    try {
      // Uncomment this line when your backend API is ready
      // await API.patch(`/launchpad/${selectedProject._id}/stage`, { stage: newStage });
      
      const updatedProject = { ...selectedProject, stage: newStage };
      setProjects(projects.map(p => p._id === selectedProject._id ? updatedProject : p));
      setSelectedProject(updatedProject);
      alert(`🚀 Milestone Reached! Phase updated to ${PROJECT_STAGES[newStage]}.`);
    } catch (err) {
      console.error("Failed to update stage");
    }
  };
  
  const handlePitchSubmit = (e) => {
    e.preventDefault();
    if(!pitchMessage.trim()) return;
    alert(`Your pitch for "${selectedProject.hiring}" has been sent to the founders! 🚀`);
    setShowPitchModal(false);
    setPitchMessage('');
  };

  const handleAddComment = (e) => {
    e.preventDefault();
    if(!commentText.trim()) return;

    const newComment = {
      id: Date.now(),
      user: { name: user?.name || 'You', avatar: user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=You` },
      text: commentText,
      time: 'Just now',
      isFounder: false 
    };

    const updatedProject = { 
      ...selectedProject, 
      comments: [...(selectedProject.comments || []), newComment] 
    };

    setProjects(projects.map(p => p._id === selectedProject._id ? updatedProject : p));
    setSelectedProject(updatedProject);
    setCommentText('');
  };

  // ==========================================
  // 🎨 UI HELPERS
  // ==========================================
  const getCategoryIcon = (category) => {
    switch(category) {
      case 'AI': return <Cpu size={14} className="opacity-70" />;
      case 'Web3': return <Blocks size={14} className="opacity-70" />;
      case 'Hardware': return <Activity size={14} className="opacity-70" />;
      default: return <Code size={14} className="opacity-70" />;
    }
  };

  const getFundingTier = (tokens) => {
    if (tokens < 10000) return { 
        name: 'Pre-Seed', icon: <Target size={12} />, 
        color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-white/5', border: 'border-gray-200 dark:border-white/10',
        bar: 'bg-gray-400', glowColor: 'bg-gray-500', nextGoal: 10000 
    };
    if (tokens < 50000) return { 
        name: 'Seed Stage', icon: <Zap size={12} />, 
        color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/20',
        bar: 'bg-emerald-500', glowColor: 'bg-emerald-500', nextGoal: 50000 
    };
    if (tokens < 100000) return { 
        name: 'Series A', icon: <Trophy size={12} />, 
        color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/20',
        bar: 'bg-blue-500', glowColor: 'bg-blue-500', nextGoal: 100000 
    };
    return { 
        name: 'Unicorn 🦄', icon: <Crown size={12} />, 
        color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10', border: 'border-purple-200 dark:border-purple-500/20',
        bar: 'bg-gradient-to-r from-purple-500 to-pink-500', glowColor: 'bg-purple-500', nextGoal: 500000 
    };
  };

  const getCoverImage = (project) => {
    if (project.coverImage) return project.coverImage;
    switch(project.category) {
      case 'AI': return 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800'; 
      case 'Web3': return 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&q=80&w=800'; 
      case 'Hardware': return 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=800'; 
      default: return 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&q=80&w=800'; 
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#fafafa] dark:bg-[#000000] relative overflow-x-hidden selection:bg-blue-500/30 font-sans text-gray-900 dark:text-white">
      
      {/* 🎬 1. APPLE-STYLE CINEMATIC INTRO SCREEN */}
      {showIntro && createPortal(
        <div className={`fixed inset-0 z-[999999] bg-[#000] flex flex-col items-center justify-center text-white transition-all duration-700 ease-in-out ${isExiting ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'}`}>
          <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-3xl">
            <div className="mb-8 opacity-0 animate-[fadeSlideUp_1s_ease-out_0.2s_forwards]">
              <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center shadow-2xl backdrop-blur-md relative overflow-hidden">
                 <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 to-purple-500/20"></div>
                 <Rocket size={32} className="text-white relative z-10" strokeWidth={1.5} />
              </div>
            </div>
            <h1 className="text-5xl md:text-8xl font-bold tracking-tighter mb-6 opacity-0 animate-[fadeSlideUp_1s_ease-out_0.6s_forwards] text-transparent bg-clip-text bg-gradient-to-b from-white via-white/90 to-white/40">
              The Future is Built Here.
            </h1>
            <p className="text-lg md:text-2xl text-gray-400 font-medium mb-12 opacity-0 animate-[fadeSlideUp_1s_ease-out_1s_forwards] max-w-xl leading-relaxed tracking-tight">
              Discover, fund, and scale the next generation of campus startups.
            </p>
            <button
              onClick={handleEnterLaunchpad}
              className="cursor-pointer group relative px-8 py-4 bg-white text-black rounded-full font-semibold text-lg flex items-center gap-3 hover:scale-105 active:scale-95 transition-all duration-300 opacity-0 animate-[fadeSlideUp_1s_ease-out_1.4s_forwards] overflow-hidden"
            >
              <span className="relative z-10 flex items-center gap-2">
                Enter Launchpad <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
          </div>
          <style dangerouslySetInnerHTML={{__html: `@keyframes fadeSlideUp { 0% { opacity: 0; transform: translateY(30px); } 100% { opacity: 1; transform: translateY(0); } }`}} />
        </div>,
        document.body
      )}

      {/* 💻 2. MAIN LAUNCHPAD UI (Fades in after Intro) */}
      <div className={`p-4 md:p-8 lg:p-12 pb-32 transition-opacity duration-1000 ${showIntro ? 'opacity-0 h-screen overflow-hidden' : 'opacity-100'} max-w-[1400px] mx-auto`}>
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-16 relative z-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-widest mb-4 ring-1 ring-blue-500/20 shadow-sm">
              <Sparkles size={12} /> Campus Incubator
            </div>
            <h2 className="text-4xl md:text-6xl font-extrabold tracking-tighter text-gray-900 dark:text-white mb-4 leading-tight">
              Launchpad
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg md:text-xl font-medium tracking-tight">
              Deploy your vision. Raise virtual capital. Build your legacy.
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5 bg-white dark:bg-[#0a0a0a] ring-1 ring-gray-200 dark:ring-white/10 px-5 py-3 rounded-full text-gray-900 dark:text-white font-mono font-semibold shadow-sm">
               <Layers size={16} className="text-blue-500" />
               {user?.vTokens?.toLocaleString() || 0} <span className="text-gray-400 text-sm">VT</span>
            </div>
            <button onClick={() => setIsModalOpen(true)} className="bg-black dark:bg-white text-white dark:text-black px-6 py-3 rounded-full font-semibold text-sm flex items-center gap-2 hover:opacity-80 transition-all shadow-xl dark:shadow-[0_0_30px_rgba(255,255,255,0.15)] active:scale-95 cursor-pointer">
              <Plus size={18} strokeWidth={2.5} /> Deploy
            </button>
          </div>
        </div>

        {/* PROJECTS GRID */}
        {loading ? (
          <div className="w-full flex justify-center py-32">
            <div className="w-8 h-8 border-2 border-gray-200 dark:border-gray-800 border-t-black dark:border-t-white rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6 relative z-10">
            {projects.length === 0 && !error && (
              <div className="col-span-full flex flex-col items-center justify-center py-32 border border-dashed border-gray-200 dark:border-white/10 rounded-[2rem] bg-transparent">
                <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                   <Rocket size={32} className="text-gray-400" />
                </div>
                <p className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No active nodes.</p>
                <p className="text-gray-500">Be the pioneer. Deploy the first campus project.</p>
              </div>
            )}

            {projects.map((project) => {
              const tier = getFundingTier(project.tokensRaised || 0);

              return (
              <div 
                key={project._id} 
                onClick={() => setSelectedProject(project)} 
                className={`group bg-white dark:bg-[#0a0a0a] ring-1 ring-gray-900/5 dark:ring-white/10 rounded-[2rem] cursor-pointer transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-gray-200 dark:hover:shadow-[0_0_40px_rgba(255,255,255,0.05)] dark:hover:ring-white/20 flex flex-col h-full relative overflow-hidden ${project.tokensRaised >= 500000 ? 'dark:hover:shadow-[0_0_40px_rgba(168,85,247,0.2)]' : ''}`}
              >
                {/* HERO IMAGE FLUSH WITH EDGES */}
                <div className="w-full h-48 shrink-0 relative overflow-hidden border-b border-gray-100 dark:border-white/5 bg-gray-100 dark:bg-gray-900">
                  <img src={getCoverImage(project)} alt={project.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-500"></div>
                  
                  {/* Top Badges */}
                  <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1 bg-black/60 backdrop-blur-md ring-1 ring-white/20 rounded-full text-[9px] font-bold tracking-widest uppercase text-white shadow-lg">
                    {getCategoryIcon(project.category)} {project.category}
                  </div>
                  <button onClick={(e) => handleUpvote(project._id, e)} className={`absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all duration-300 cursor-pointer backdrop-blur-md shadow-lg ${project.hasUpvoted ? 'bg-blue-500 text-white ring-1 ring-blue-400/50' : 'bg-black/60 text-white hover:bg-black/80 ring-1 ring-white/20'}`}>
                    <ChevronUp size={14} strokeWidth={3} className={project.hasUpvoted ? '-mt-0.5' : ''} /> {project.upvotes?.length || 0}
                  </button>
                  
                  {/* Bottom Badges */}
                  <div className="absolute bottom-4 left-4 flex flex-wrap gap-2 pr-4">
                      <div className="text-[9px] font-bold uppercase tracking-widest text-blue-300 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full ring-1 ring-blue-500/40 shadow-sm">
                      Phase: {PROJECT_STAGES[project.stage || 0]}
                      </div>
                      {project.hiring && (
                          <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-300 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full ring-1 ring-emerald-500/40 animate-pulse shadow-sm">
                          Hiring
                          </div>
                      )}
                  </div>
                </div>
                
                {/* CONTENT & FOOTER */}
                <div className="p-5 md:p-6 flex flex-col flex-1">
                  <h3 className="text-xl md:text-2xl font-extrabold text-gray-900 dark:text-white mb-2 tracking-tight group-hover:text-blue-600 dark:group-hover:text-gray-300 transition-colors">
                    {project.title}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 leading-relaxed font-medium">
                    {project.tagline}
                  </p>

                  <div className="flex justify-between items-end pt-5 mt-auto border-t border-gray-100 dark:border-white/5 relative z-10">
                    <div className="flex -space-x-2">
                      {project.team?.slice(0, 3).map((member, i) => (
                        <img key={i} src={member.user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.user?.name || 'U'}`} className="w-9 h-9 rounded-full ring-2 ring-white dark:ring-[#0a0a0a] bg-gray-100 dark:bg-[#111] object-cover" alt="team" title={member.user?.name} />
                      ))}
                      {project.team?.length > 3 && (
                        <div className="w-9 h-9 rounded-full ring-2 ring-white dark:ring-[#0a0a0a] bg-gray-50 dark:bg-[#111] flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-400">
                          +{project.team.length - 3}
                        </div>
                      )}
                    </div>
                    
                    <div className="text-right flex flex-col items-end">
                      <div className={`inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest mb-1.5 px-2 py-0.5 rounded border shadow-sm ${tier.bg} ${tier.color} ${tier.border}`}>
                         {tier.icon} {tier.name}
                      </div>
                      <p className="text-gray-900 dark:text-white font-mono font-bold text-lg flex items-center gap-1.5 justify-end tracking-tight">
                         {project.tokensRaised?.toLocaleString() || 0} <span className="text-[10px] text-gray-400 uppercase font-sans">VT</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )})}
          </div>
        )}

        {/* 💎 3. PREMIUM DETAIL DRAWER WITH HERO IMAGE, ROADMAP, HIRING & Q&A */}
        {selectedProject && createPortal(
          <div className="fixed inset-0 z-[99999] flex justify-end">
            <div className="absolute inset-0 bg-white/80 dark:bg-black/80 backdrop-blur-md transition-opacity cursor-pointer" onClick={() => setSelectedProject(null)} />
            <div className="w-full max-w-2xl bg-white dark:bg-[#050505] border-l border-gray-200 dark:border-white/10 h-full relative z-10 p-6 md:p-10 overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col scrollbar-hide">
              
              <button onClick={() => setSelectedProject(null)} className="absolute top-6 right-6 z-50 p-2.5 text-gray-900 dark:text-white bg-white/50 hover:bg-white/80 dark:bg-black/50 dark:hover:bg-black/80 ring-1 ring-gray-200 dark:ring-white/20 rounded-full transition-all cursor-pointer backdrop-blur-md shadow-xl">
                <X size={18} strokeWidth={2.5}/>
              </button>
              
              <div className="w-full h-64 md:h-80 rounded-[2rem] overflow-hidden relative mb-8 border border-gray-200 dark:border-white/10 shadow-lg flex-shrink-0">
                <img src={getCoverImage(selectedProject)} alt={selectedProject.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-md ring-1 ring-white/20 rounded-lg text-xs font-bold tracking-widest uppercase text-white mb-3 shadow-md">
                    {getCategoryIcon(selectedProject.category)} {selectedProject.category} Node
                  </div>
                  <h2 className="text-3xl md:text-5xl font-extrabold tracking-tighter text-white leading-tight">
                    {selectedProject.title}
                  </h2>
                </div>
              </div>
              
              <div className="px-2">
                <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-10 leading-relaxed font-medium">
                  {selectedProject.description}
                </p>

                {/* THE HIRING BANNER */}
                {selectedProject.hiring && (
                  <div className="mb-10 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-500/10 dark:to-green-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-[2rem] p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden shadow-sm dark:shadow-[0_0_30px_rgba(16,185,129,0.05)]">
                    <div className="absolute -right-10 -top-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="relative z-10">
                      <h4 className="text-emerald-700 dark:text-emerald-400 font-bold text-xs uppercase tracking-widest mb-1.5 flex items-center gap-2">
                         <Sparkles size={14} /> Open Opportunity
                      </h4>
                      <p className="text-gray-900 dark:text-gray-200 font-medium">
                        This squad is looking for a <span className="font-black text-emerald-600 dark:text-emerald-400 underline decoration-emerald-500/30 underline-offset-4">{selectedProject.hiring}</span>.
                      </p>
                    </div>
                    <button onClick={() => setShowPitchModal(true)} className="cursor-pointer relative z-10 w-full md:w-auto bg-emerald-500 hover:bg-emerald-400 text-white dark:text-black px-6 py-3.5 rounded-xl font-bold transition-all active:scale-95 whitespace-nowrap shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2">
                      <Briefcase size={16}/> Pitch Yourself
                    </button>
                  </div>
                )}

                {/* LIVE ROADMAP */}
                <div className="mb-12 bg-gray-50 dark:bg-[#0a0a0a] ring-1 ring-gray-200 dark:ring-white/10 rounded-[2rem] p-6 md:p-8">
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 tracking-tight">
                        <Map size={18} className="text-blue-500" /> Live Roadmap
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Building in public. Watch the journey unfold.</p>
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-500 bg-blue-100 dark:bg-blue-500/10 px-2.5 py-1 rounded-md">
                      Founder Controls Active
                    </div>
                  </div>

                  <div className="relative flex items-center justify-between w-full px-2 mt-4">
                    <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-1 bg-gray-200 dark:bg-gray-800 rounded-full z-0"></div>
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full z-0 transition-all duration-700 ease-in-out" style={{ width: `calc(${((selectedProject.stage || 0) / (PROJECT_STAGES.length - 1)) * 100}% - 2rem)` }}></div>

                    {PROJECT_STAGES.map((stageName, idx) => {
                      const currentStage = selectedProject.stage || 0;
                      const isCompleted = idx <= currentStage;
                      const isNext = idx === currentStage + 1;

                      return (
                        <div key={stageName} className="relative z-10 flex flex-col items-center gap-3">
                          <button
                            disabled={!isNext} 
                            onClick={() => handleAdvanceStage(idx)}
                            className={`w-8 h-8 rounded-full border-4 flex items-center justify-center transition-all duration-500 ${
                              isCompleted 
                                ? 'bg-blue-500 border-white dark:border-[#050505] shadow-[0_0_15px_rgba(59,130,246,0.5)] cursor-default'
                                : isNext
                                  ? 'bg-white dark:bg-[#050505] border-blue-500/50 hover:border-blue-500 hover:scale-110 cursor-pointer shadow-lg'
                                  : 'bg-gray-100 dark:bg-gray-900 border-white dark:border-[#050505] cursor-not-allowed opacity-50'
                            }`}
                          >
                            {isCompleted && <Check size={14} className="text-white" strokeWidth={3} />}
                          </button>
                          <span className={`text-[10px] md:text-xs font-bold uppercase tracking-widest whitespace-nowrap absolute top-10 transition-colors ${idx === currentStage ? 'text-blue-600 dark:text-blue-400' : isCompleted ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600'}`}>
                            {stageName}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="h-6"></div> 
                </div>

                {/* SQUAD LIST */}
                <div className="mb-12">
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 mb-6 flex items-center gap-2">
                    <Users size={16}/> The Core Squad
                  </h4>
                  <div className="grid grid-cols-1 gap-4">
                    {selectedProject.team?.map((member, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-gray-50 dark:bg-[#0a0a0a] ring-1 ring-gray-100 dark:ring-white/5 p-5 rounded-2xl hover:ring-gray-300 dark:hover:ring-white/20 transition-all relative overflow-hidden">
                        <img src={member.user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.user?.name || 'U'}`} className="w-14 h-14 rounded-full ring-2 ring-gray-200 dark:ring-white/10 bg-white dark:bg-[#111] object-cover flex-shrink-0" alt="member" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                             <p className="font-bold text-base text-gray-900 dark:text-white">{member.user?.name}</p>
                             <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold bg-blue-100 dark:bg-blue-500/10 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                {member.role || 'Contributor'}
                             </span>
                          </div>
                          {member.contribution ? (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-snug">↳ {member.contribution}</p>
                          ) : (
                            <p className="text-sm text-gray-400 dark:text-gray-600 mt-1 italic leading-snug">Helping build the vision.</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-auto"></div>

                {/* INVEST BOX */}
                {(() => {
                  const drawerTier = getFundingTier(selectedProject.tokensRaised || 0);
                  const progressPercentage = Math.min(((selectedProject.tokensRaised || 0) / drawerTier.nextGoal) * 100, 100);

                  return (
                    <div className="bg-white dark:bg-[#0a0a0a] ring-1 ring-gray-200 dark:ring-white/10 rounded-[2rem] p-8 mt-8 shadow-sm dark:shadow-2xl relative overflow-hidden">
                      <div className={`absolute -top-32 -right-32 w-64 h-64 rounded-full blur-[80px] opacity-10 dark:opacity-20 pointer-events-none ${drawerTier.glowColor}`}></div>
                      
                      <div className="relative z-10">
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <h4 className="font-bold text-gray-900 dark:text-white text-lg tracking-tight mb-2 flex items-center gap-2">
                              Funding Terminal
                            </h4>
                            <div className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded border ${drawerTier.bg} ${drawerTier.color} ${drawerTier.border}`}>
                               {drawerTier.icon} Level: {drawerTier.name}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-black text-3xl text-gray-900 dark:text-white tracking-tight">
                              {selectedProject.tokensRaised?.toLocaleString() || 0} <span className="text-sm text-gray-400">VT</span>
                            </p>
                          </div>
                        </div>

                        <div className="mb-8">
                           <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                              <span>Funded</span>
                              <span>Target: {drawerTier.nextGoal.toLocaleString()} VT</span>
                           </div>
                           <div className="w-full h-2 bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">
                              <div className={`h-full ${drawerTier.bar} transition-all duration-1000 ease-out`} style={{ width: `${progressPercentage}%` }}></div>
                           </div>
                        </div>
                        
                        <form onSubmit={handleInvest} className="flex flex-col sm:flex-row gap-3">
                          <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                              <span className="text-gray-400 font-mono font-bold">Pay:</span>
                            </div>
                            <input required type="number" value={investAmount} onChange={e => setInvestAmount(e.target.value)} placeholder="0" className="w-full bg-gray-50 dark:bg-[#111] ring-1 ring-gray-200 dark:ring-white/5 rounded-2xl pl-16 pr-6 py-4 outline-none font-mono text-gray-900 dark:text-white text-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-white transition-all placeholder:text-gray-400" />
                            <div className="absolute inset-y-0 right-0 pr-5 flex items-center pointer-events-none">
                              <span className="text-gray-400 font-mono font-bold text-xs uppercase">VT</span>
                            </div>
                          </div>
                          <button type="submit" className="cursor-pointer bg-black dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-black px-8 py-4 rounded-2xl font-bold text-base transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg">
                            Inject Capital <Activity size={16} />
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                })()}

                {/* Q&A / FEEDBACK WALL */}
                <div className="mt-16 pt-10 border-t border-gray-200 dark:border-white/10">
                  <h4 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-8 tracking-tight">
                    <MessageSquare size={20} className="text-blue-500" />
                    Community Feedback & Q&A
                  </h4>

                  <form onSubmit={handleAddComment} className="flex gap-4 mb-10">
                    <img 
                      src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=You`} 
                      className="w-12 h-12 rounded-full ring-2 ring-gray-200 dark:ring-white/10 bg-gray-100 dark:bg-[#111] flex-shrink-0" 
                      alt="Your Avatar" 
                    />
                    <div className="relative flex-1">
                      <input 
                        type="text" 
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Ask a question or share feedback..." 
                        className="w-full bg-gray-50 dark:bg-[#0a0a0a] ring-1 ring-gray-200 dark:ring-white/10 rounded-2xl pl-5 pr-14 py-3.5 outline-none text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all placeholder:text-gray-400" 
                      />
                      <button 
                        type="submit" 
                        disabled={!commentText.trim()}
                        className="absolute inset-y-2 right-2 p-2 bg-blue-500 text-white rounded-xl hover:bg-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  </form>

                  <div className="space-y-6">
                    {selectedProject.comments && selectedProject.comments.length > 0 ? (
                      selectedProject.comments.map((comment) => (
                        <div key={comment.id} className="flex gap-4">
                          <img 
                            src={comment.user.avatar} 
                            className="w-10 h-10 rounded-full ring-1 ring-gray-200 dark:ring-white/10 bg-gray-100 dark:bg-[#111] flex-shrink-0 mt-1" 
                            alt={comment.user.name} 
                          />
                          <div className="flex-1 bg-gray-50 dark:bg-[#0a0a0a] ring-1 ring-gray-100 dark:ring-white/5 p-4 rounded-2xl rounded-tl-sm">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="font-bold text-sm text-gray-900 dark:text-white">{comment.user.name}</span>
                              {comment.isFounder && (
                                <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md">
                                  Maker
                                </span>
                              )}
                              <span className="text-gray-400 dark:text-gray-500 text-xs ml-auto font-medium">{comment.time}</span>
                            </div>
                            <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                              {comment.text}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-10 bg-gray-50 dark:bg-[#0a0a0a] rounded-2xl ring-1 ring-gray-200 dark:ring-white/5 border border-dashed border-gray-300 dark:border-white/10">
                        <MessageSquare size={24} className="mx-auto text-gray-400 mb-3 opacity-50" />
                        <p className="text-gray-500 text-sm font-medium">No questions yet. Be the first to ask!</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* 🚀 PITCH MODAL */}
        {showPitchModal && createPortal(
          <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/40 dark:bg-black/80 backdrop-blur-md transition-opacity cursor-pointer" onClick={() => setShowPitchModal(false)} />
            <form onSubmit={handlePitchSubmit} className="w-full max-w-lg bg-white dark:bg-[#0a0a0a] ring-1 ring-gray-200 dark:ring-white/10 rounded-[2.5rem] relative z-10 p-8 md:p-10 shadow-2xl animate-in zoom-in-95 duration-200">
               <div className="flex justify-between items-start mb-6">
                 <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2 mb-1">
                       <Briefcase size={20} className="text-emerald-500" /> Pitch Yourself
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Apply for: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{selectedProject?.hiring}</span></p>
                 </div>
                 <button type="button" onClick={() => setShowPitchModal(false)} className="text-gray-400 hover:text-black dark:hover:text-white bg-gray-50 hover:bg-gray-100 dark:bg-[#111] dark:hover:bg-white/10 p-2.5 rounded-full transition-all cursor-pointer">
                   <X size={18} strokeWidth={2.5}/>
                 </button>
               </div>

               <div className="mb-8">
                 <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Why should they add you to the squad?</label>
                 <textarea 
                   required
                   autoFocus
                   value={pitchMessage} 
                   onChange={e => setPitchMessage(e.target.value)} 
                   placeholder="e.g. I have 2 years of experience in React Native and I love your vision. Check out my GitHub..." 
                   className="w-full h-36 bg-gray-50 dark:bg-[#111] ring-1 ring-transparent border-none rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 transition-all text-gray-900 dark:text-white font-medium resize-none placeholder:text-gray-400" 
                 />
               </div>

               <button type="submit" className="w-full cursor-pointer bg-emerald-500 hover:bg-emerald-400 text-white dark:text-black py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2">
                 Send Pitch <Send size={18} />
               </button>
            </form>
          </div>,
          document.body
        )}

        {/* 🚀 DEPLOYMENT MODAL */}
        {isModalOpen && createPortal(
          <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/20 dark:bg-black/80 backdrop-blur-md transition-opacity cursor-pointer" onClick={() => setIsModalOpen(false)} />
            <form 
              className="w-full max-w-2xl bg-white dark:bg-[#0a0a0a] ring-1 ring-gray-200 dark:ring-white/10 rounded-[2.5rem] relative z-10 p-8 md:p-12 shadow-2xl animate-in zoom-in-95 duration-200"
              onSubmit={handleLaunch}
            >
              <div className="flex justify-between items-center mb-8 pb-6 border-b border-gray-100 dark:border-white/5">
                <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
                   <div className="w-10 h-10 bg-gray-100 dark:bg-[#111] rounded-xl flex items-center justify-center">
                     <Rocket size={20} className="text-gray-900 dark:text-white" />
                   </div>
                   Initialize Node
                </h2>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="text-gray-400 hover:text-black dark:hover:text-white bg-gray-50 hover:bg-gray-100 dark:bg-[#111] dark:hover:bg-white/10 p-2.5 rounded-full transition-all cursor-pointer"
                >
                  <X size={18} strokeWidth={2.5}/>
                </button>
              </div>
              
              <div className="space-y-5 mb-10">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><ImageIcon size={18} className="text-gray-400" /></div>
                    <input type="text" placeholder="Cover Image URL (Optional - Auto assigned if blank)" className="w-full bg-gray-50 dark:bg-[#111] ring-1 ring-transparent border-none rounded-2xl pl-12 pr-6 py-4 outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-white transition-all text-gray-900 dark:text-white font-medium text-sm placeholder:text-gray-400" />
                  </div>
                  <input required type="text" value={newProject.title} onChange={e => setNewProject({...newProject, title: e.target.value})} placeholder="Project Name" className="w-full bg-gray-50 dark:bg-[#111] ring-1 ring-transparent border-none rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-white transition-all text-gray-900 dark:text-white font-bold text-lg placeholder:font-medium placeholder:text-gray-400" />
                  <input required type="text" value={newProject.tagline} onChange={e => setNewProject({...newProject, tagline: e.target.value})} placeholder="One-liner Tagline (Keep it brief)" className="w-full bg-gray-50 dark:bg-[#111] ring-1 ring-transparent border-none rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-white transition-all text-gray-900 dark:text-white font-medium placeholder:text-gray-400" />
                  <textarea required value={newProject.description} onChange={e => setNewProject({...newProject, description: e.target.value})} placeholder="Describe the core problem and your technical solution..." className="w-full h-32 bg-gray-50 dark:bg-[#111] ring-1 ring-transparent border-none rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-white transition-all text-gray-900 dark:text-white font-medium resize-none placeholder:text-gray-400" />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <select value={newProject.category} onChange={e => setNewProject({...newProject, category: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] ring-1 ring-transparent border-none rounded-2xl px-6 py-4 outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-white transition-all font-bold appearance-none cursor-pointer">
                      <option value="Web">🌐 Web / App</option>
                      <option value="AI">🤖 AI / ML</option>
                      <option value="Web3">⛓️ Web3 / Crypto</option>
                      <option value="Hardware">⚙️ Hardware</option>
                    </select>
                    <input type="text" value={newProject.hiring} onChange={e => setNewProject({...newProject, hiring: e.target.value})} placeholder="Hiring? (e.g. UX Designer)" className="w-full bg-blue-50 dark:bg-blue-500/5 ring-1 ring-transparent border-none rounded-2xl px-6 py-4 outline-none text-blue-600 dark:text-blue-400 placeholder:text-blue-400/60 dark:placeholder:text-blue-400/40 focus:ring-2 focus:ring-blue-500 transition-all font-bold" />
                  </div>
              </div>

              <button type="submit" className="w-full cursor-pointer bg-black dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-black py-5 rounded-2xl font-bold text-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg">
                Deploy to Production <ArrowRight size={18} />
              </button>
            </form>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}