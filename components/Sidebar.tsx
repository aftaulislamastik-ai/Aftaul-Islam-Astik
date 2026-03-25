import React, { useState } from 'react';
import { MessageSquare, Settings, LogOut, Search, PlusCircle, Globe, Shield, UserPlus, Inbox, XCircle, ChevronDown } from 'lucide-react';
import { ChatSession, User } from '../types';
import { dbService } from '../services/dbService';

interface SidebarProps {
  currentUser: User;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onLogout: () => void;
  onViewChange: (view: 'chats' | 'discovery' | 'settings') => void;
  onShowProfile: (user: User) => void;
  currentView: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentUser, 
  sessions, 
  activeSessionId, 
  onSelectSession, 
  onLogout,
  onViewChange,
  onShowProfile,
  currentView
}) => {
  const [tab, setTab] = useState<'inbox' | 'requests'>('inbox');
  const [requestTab, setRequestTab] = useState<'received' | 'sent'>('received');
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  // Status mapping
  const statusConfig = {
    online: { label: 'Online', color: 'bg-green-500', text: 'text-green-400' },
    busy: { label: 'Busy', color: 'bg-red-500', text: 'text-red-400' },
    offline: { label: 'Offline', color: 'bg-slate-500', text: 'text-slate-500' }
  };

  const currentStatus = currentUser.status || 'online';
  const activeStatusConfig = statusConfig[currentStatus as keyof typeof statusConfig] || statusConfig.online;

  const handleStatusChange = (newStatus: keyof typeof statusConfig) => {
    localStorage.setItem('explicitStatus', newStatus);
    dbService.updateUserPresence(currentUser.id, newStatus);
    setShowStatusMenu(false);
  };

  // Filter Logic
  const inboxSessions = sessions.filter(s => {
    // Show if accepted AND not blocked
    const otherParticipant = s.participants.find(p => p.id !== currentUser.id);
    const isBlocked = currentUser.blockedIds?.includes(otherParticipant?.id || '');
    return s.status === 'accepted' && !isBlocked;
  });

  const receivedRequests = sessions.filter(s => {
    // Show if pending AND user did NOT initiate it AND not blocked
    const otherParticipant = s.participants.find(p => p.id !== currentUser.id);
    const isBlocked = currentUser.blockedIds?.includes(otherParticipant?.id || '');
    return s.status === 'pending' && s.initiatedBy !== currentUser.id && !isBlocked;
  });

  const sentRequests = sessions.filter(s => {
    // Show if pending AND user DID initiate it AND not blocked
    const otherParticipant = s.participants.find(p => p.id !== currentUser.id);
    const isBlocked = currentUser.blockedIds?.includes(otherParticipant?.id || '');
    return s.status === 'pending' && s.initiatedBy === currentUser.id && !isBlocked;
  });

  return (
    <div className="w-full md:w-80 h-full bg-cyber-panel/60 backdrop-blur-xl border-r border-white/5 flex flex-col">
      {/* User Profile Snippet */}
      <div className="p-6 flex items-center gap-4 border-b border-white/5">
        <div className="relative cursor-pointer group" onClick={() => onShowProfile(currentUser)}>
          <img 
            src={currentUser.avatar} 
            alt="Profile" 
            className="w-12 h-12 rounded-full border-2 border-cyan-400 object-cover group-hover:scale-110 transition-transform"
          />
          <div className={`absolute bottom-0 right-0 w-3 h-3 ${activeStatusConfig.color} rounded-full border border-slate-900`}></div>
        </div>
        <div className="min-w-0 flex-1 relative">
          <h3 className="font-bold text-white tracking-wide truncate cursor-pointer hover:text-cyan-400 transition-colors" onClick={() => onShowProfile(currentUser)}>{currentUser.name}</h3>
          
          <div 
            className="flex items-center gap-1 cursor-pointer hover:bg-white/5 w-fit pr-2 rounded transition-colors"
            onClick={() => setShowStatusMenu(!showStatusMenu)}
          >
            <p className={`text-xs ${activeStatusConfig.text}`}>{activeStatusConfig.label}</p>
            <ChevronDown size={12} className="text-slate-500" />
          </div>

          {showStatusMenu && (
            <div className="absolute top-full left-0 mt-1 w-36 bg-slate-900 border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
              {(Object.keys(statusConfig) as Array<keyof typeof statusConfig>).map((statusKey) => (
                <button
                  key={statusKey}
                  onClick={() => handleStatusChange(statusKey)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 flex items-center gap-2 transition-colors"
                >
                  <span className={`w-2 h-2 rounded-full ${statusConfig[statusKey].color}`}></span>
                  <span className={statusConfig[statusKey].text}>{statusConfig[statusKey].label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={onLogout} className="ml-auto text-slate-500 hover:text-red-400 transition-colors" title="Abort Session">
          <LogOut size={18} />
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex items-center justify-around p-4 border-b border-white/5">
        <button 
          onClick={() => onViewChange('chats')}
          className={`p-2 rounded-lg transition-all relative ${currentView === 'chats' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <MessageSquare size={20} />
          {receivedRequests.length > 0 && (
             <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
          )}
        </button>
        <button 
          onClick={() => onViewChange('discovery')}
          className={`p-2 rounded-lg transition-all ${currentView === 'discovery' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <Globe size={20} />
        </button>
        <button 
          onClick={() => onViewChange('settings')}
          className={`p-2 rounded-lg transition-all ${currentView === 'settings' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <Settings size={20} />
        </button>
      </nav>

      {/* Internal Tabs (Inbox vs Requests) - Only show if in 'chats' view */}
      {currentView === 'chats' && (
        <div className="flex text-xs font-bold border-b border-white/5">
           <button 
             onClick={() => setTab('inbox')}
             className={`flex-1 py-3 text-center transition-colors uppercase tracking-wider flex items-center justify-center gap-2 ${tab === 'inbox' ? 'text-cyan-400 border-b-2 border-cyan-400 bg-white/5' : 'text-slate-500 hover:text-slate-300'}`}
           >
             <Inbox size={14} /> Signals
           </button>
           <button 
             onClick={() => setTab('requests')}
             className={`flex-1 py-3 text-center transition-colors uppercase tracking-wider flex items-center justify-center gap-2 ${tab === 'requests' ? 'text-violet-400 border-b-2 border-violet-400 bg-white/5' : 'text-slate-500 hover:text-slate-300'}`}
           >
             <UserPlus size={14} /> Requests
             {receivedRequests.length > 0 && <span className="bg-red-500 text-white px-1.5 rounded-full text-[9px]">{receivedRequests.length}</span>}
           </button>
        </div>
      )}

      {/* Sub-tabs for Requests */}
      {currentView === 'chats' && tab === 'requests' && (
        <div className="flex text-[10px] font-bold border-b border-white/5 bg-black/20">
          <button 
            onClick={() => setRequestTab('received')}
            className={`flex-1 py-2 text-center transition-colors uppercase tracking-widest ${requestTab === 'received' ? 'text-cyan-400 bg-white/5' : 'text-slate-600 hover:text-slate-400'}`}
          >
            Received ({receivedRequests.length})
          </button>
          <button 
            onClick={() => setRequestTab('sent')}
            className={`flex-1 py-2 text-center transition-colors uppercase tracking-widest ${requestTab === 'sent' ? 'text-violet-400 bg-white/5' : 'text-slate-600 hover:text-slate-400'}`}
          >
            Sent ({sentRequests.length})
          </button>
        </div>
      )}

      {/* Search (Only in Inbox) */}
      {currentView === 'chats' && tab === 'inbox' && (
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search frequency..." 
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>
        </div>
      )}

      {/* Chat List Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-2 pb-4 space-y-0.5 mt-2">
          {currentView !== 'chats' ? (
             <div className="text-center text-slate-500 text-xs mt-10 font-mono uppercase tracking-widest">Navigation Active</div>
          ) : tab === 'inbox' ? (
             inboxSessions.length === 0 ? (
                <div className="text-center p-8 space-y-4">
                  <div className="text-slate-600 text-xs font-mono uppercase tracking-widest">No active signals.</div>
                  <button 
                    onClick={() => onViewChange('discovery')}
                    className="w-full py-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold hover:bg-cyan-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Globe size={14} /> SCAN FOR OPERATIVES
                  </button>
                </div>
             ) : (
                inboxSessions.map((session) => (
                   <SessionItem 
                      key={session.id} 
                      session={session} 
                      currentUser={currentUser} 
                      activeSessionId={activeSessionId} 
                      onSelect={onSelectSession} 
                      onShowProfile={onShowProfile}
                   />
                ))
             )
          ) : requestTab === 'received' ? (
             receivedRequests.length === 0 ? (
                <div className="text-center text-slate-600 mt-10 text-xs font-mono uppercase tracking-widest">No incoming requests.</div>
             ) : (
                receivedRequests.map((session) => (
                   <SessionItem 
                      key={session.id} 
                      session={session} 
                      currentUser={currentUser} 
                      activeSessionId={activeSessionId} 
                      onSelect={onSelectSession} 
                      onShowProfile={onShowProfile}
                      isRequest
                      requestType="received"
                   />
                ))
             )
          ) : (
             sentRequests.length === 0 ? (
                <div className="text-center text-slate-600 mt-10 text-xs font-mono uppercase tracking-widest">No sent requests.</div>
             ) : (
                sentRequests.map((session) => (
                   <SessionItem 
                      key={session.id} 
                      session={session} 
                      currentUser={currentUser} 
                      activeSessionId={activeSessionId} 
                      onSelect={onSelectSession} 
                      onShowProfile={onShowProfile}
                      isRequest
                      requestType="sent"
                   />
                ))
             )
          )}
        </div>
      </div>
    </div>
  );
};

// Helper Component for List Item
const SessionItem = ({ session, currentUser, activeSessionId, onSelect, onShowProfile, isRequest, requestType }: any) => {
  const participant = session.participants.find((p: User) => p.id !== currentUser.id) || session.participants[0];
  const isActive = activeSessionId === session.id;
  const isOwnLastMessage = session.lastMessage?.senderId === currentUser.id;
  const prefix = session.lastMessage ? (isOwnLastMessage ? 'You: ' : '') : '';
  const unreadCount = session.unreadCount?.[currentUser.id] || 0;
  const hasUnread = unreadCount > 0;

  const handleAccept = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await dbService.acceptChatRequest(session.id);
  };

  const handleDecline = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await dbService.deleteChat(session.id);
  };

  return (
    <div 
      onClick={() => onSelect(session.id)}
      className={`group relative py-2.5 px-3 cursor-pointer transition-all duration-200 border-l-2 ${
        isActive 
          ? 'bg-gradient-to-r from-cyan-500/10 to-transparent border-cyan-400' 
          : 'bg-transparent border-transparent hover:bg-white/5 hover:border-slate-600'
      }`}
    >
      {/* Background scanline effect for active state */}
      {isActive && (
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNCIgaGVpZ2h0PSI0IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-50 pointer-events-none"></div>
      )}

      <div className="flex items-center gap-3 relative z-10">
        <div className="relative shrink-0 cursor-pointer group/avatar" onClick={(e) => {
          e.stopPropagation();
          onShowProfile(participant);
        }}>
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 group-hover:border-cyan-500/50 transition-colors bg-slate-800">
            <img 
              src={participant.avatar} 
              alt={participant.name} 
              className={`w-full h-full object-cover transition-all duration-300 group-hover/avatar:scale-110 ${isActive ? 'ring-1 ring-cyan-400/50' : ''}`} 
            />
          </div>
          {participant.isAi && (
            <div className="absolute -top-1.5 -right-1.5 bg-violet-600 text-white text-[8px] font-bold px-1 py-0.5 rounded-sm border border-slate-900 shadow-[0_0_5px_rgba(124,58,237,0.5)]">AI</div>
          )}
          {hasUnread && !isActive && (
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full border-2 border-slate-900 animate-pulse"></div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-0.5">
            <h4 className={`text-sm font-semibold truncate tracking-wide transition-colors ${isActive ? 'text-cyan-300' : hasUnread ? 'text-white' : 'text-slate-300'}`}>
              {participant.name}
            </h4>
            <span className={`text-[9px] font-mono tracking-wider ${hasUnread ? 'text-cyan-400' : 'text-slate-500'}`}>
              {session.lastMessage ? new Date(session.lastMessage.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
            </span>
          </div>
          
          {isRequest ? (
             <div className="flex flex-col gap-2">
                <p className={`text-[11px] font-bold flex items-center gap-1.5 uppercase tracking-wider ${requestType === 'received' ? 'text-cyan-400' : 'text-violet-400'}`}>
                   {requestType === 'received' ? <Inbox size={10} /> : <UserPlus size={10} />}
                   {requestType === 'received' ? 'Incoming Request' : 'Outgoing Request'}
                </p>
                <div className="flex gap-2">
                   {requestType === 'received' && (
                     <button 
                       onClick={handleAccept}
                       className="flex-1 py-1 bg-cyan-600/20 hover:bg-cyan-600 text-cyan-400 hover:text-white text-[9px] font-bold rounded border border-cyan-500/30 transition-all uppercase tracking-widest"
                     >
                       Accept
                     </button>
                   )}
                   <button 
                     onClick={handleDecline}
                     className="flex-1 py-1 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white text-[9px] font-bold rounded border border-red-500/30 transition-all uppercase tracking-widest"
                   >
                     {requestType === 'received' ? 'Decline' : 'Cancel'}
                   </button>
                </div>
             </div>
          ) : (
             <div className="flex items-center justify-between gap-2">
               <p className={`text-[11px] truncate flex items-center gap-1.5 ${hasUnread ? 'text-cyan-100 font-medium' : 'text-slate-500'}`}>
                 {session.status === 'pending' ? (
                    <span className="text-yellow-500/80 italic">Waiting for acceptance...</span>
                 ) : (
                    <>
                      {session.lastMessage?.type === 'stealth' && <Shield size={10} className={hasUnread ? 'text-cyan-400' : 'text-violet-500/70'} />}
                      <span className="opacity-70">{prefix}</span>
                      <span className="truncate">
                        {session.lastMessage?.type === 'image' ? 'Image Sent' : 
                        session.lastMessage?.type === 'draw' ? 'Drawing Sent' :
                        session.lastMessage?.type === 'lock' ? 'Locked Message' :
                        session.lastMessage?.content || 'New Connection'}
                      </span>
                    </>
                 )}
               </p>
               {hasUnread && (
                 <span className="shrink-0 text-[9px] font-mono font-bold text-cyan-400 bg-cyan-400/10 px-1.5 py-0.5 rounded border border-cyan-400/20">
                   {unreadCount} NEW
                 </span>
               )}
             </div>
          )}
        </div>
      </div>
    </div>
  );
};