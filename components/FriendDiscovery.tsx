import React, { useEffect, useState } from 'react';
import { Search, MapPin, UserPlus, RefreshCw, WifiOff, X, User as UserIcon, ArrowLeft, MessageSquare, Clock, ShieldBan } from 'lucide-react';
import { dbService } from '../services/dbService';
import { auth } from '../firebaseConfig';
import { User, ChatSession } from '../types';

interface FriendDiscoveryProps {
  onStartChat?: (user: User) => void;
  onShowProfile?: (user: User) => void;
  onBack?: () => void;
  sessions: ChatSession[];
  currentUser: User;
}

export const FriendDiscovery: React.FC<FriendDiscoveryProps> = ({ onStartChat, onShowProfile, onBack, sessions, currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchUsers = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const realUsers = await dbService.getAllUsers();
      // Filter out current user and blocked users
      const filtered = realUsers.filter(u => 
        u.id !== currentUser.id && 
        !(currentUser.blockedIds || []).includes(u.id)
      );
      setUsers(filtered);
      setFilteredUsers(filtered);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentUser?.id, currentUser?.blockedIds]);

  // Search Logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
    } else {
      const lowerQ = searchQuery.toLowerCase();
      const filtered = users.filter(u => {
        const name = u.name?.toLowerCase() || "";
        const bio = u.bio?.toLowerCase() || "";
        return name.includes(lowerQ) || bio.includes(lowerQ);
      });
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  const handleUserClick = (user: User) => {
    if (onShowProfile) {
      onShowProfile(user);
    } else {
      setSelectedUser(user);
    }
  };

  const handleConnect = () => {
    if (selectedUser && onStartChat) {
        onStartChat(selectedUser);
        setSelectedUser(null);
    }
  };

  return (
    <div className="flex-1 bg-cyber-dark overflow-y-auto p-6 animate-fade-in relative flex flex-col h-full">
       <div className="flex flex-col gap-4 mb-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
               {onBack && (
                 <button onClick={onBack} className="md:hidden text-slate-400 hover:text-white">
                   <ArrowLeft size={24} />
                 </button>
               )}
               <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-500">
                 GLOBAL SCAN
               </h2>
            </div>
            <button 
              onClick={fetchUsers} 
              className="p-2 bg-slate-800 rounded-lg hover:text-cyan-400 transition-colors"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
             <input 
               type="text" 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               placeholder="Search neural signals..."
               className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition-all placeholder-slate-600"
             />
          </div>
       </div>
       
       {/* Map Visual */}
       <div className="relative mb-8 h-48 rounded-2xl overflow-hidden border border-cyan-500/30 group shadow-[0_0_20px_rgba(6,182,212,0.1)] flex-shrink-0">
         <img src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop" className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-700" alt="Map" />
         <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
         <div className="absolute bottom-4 left-4">
            <h3 className="text-white text-lg font-bold">Network Proximity</h3>
            <p className="text-cyan-400 text-xs">Showing only active neural nodes</p>
         </div>
       </div>

       {loading ? (
         <div className="flex justify-center items-center py-20">
            <div className="flex gap-2">
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce delay-200"></div>
            </div>
         </div>
       ) : filteredUsers.length === 0 ? (
         <div className="text-center text-slate-500 py-10 border border-white/5 rounded-xl bg-slate-900/50">
            <WifiOff size={40} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg font-bold text-slate-400">No active signals detected.</p>
            <p className="text-xs mt-2">You might be the only operative in this sector. Try again later or check your search parameters.</p>
             <button 
               onClick={fetchUsers}
               className="mt-6 px-6 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all text-sm font-bold"
             >
               RESCAN SECTOR
             </button>
         </div>
       ) : (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {filteredUsers.map(user => {
                const existingSession = sessions.find(s => 
                  s.participants.some(p => p.id === user.id)
                );
                
                let statusText = user.bio || 'No status data available.';
                let actionIcon = <UserPlus size={18} />;
                let isPending = false;
                let isAccepted = false;
                let isInitiator = false;

                if (existingSession) {
                  isPending = existingSession.status === 'pending';
                  isAccepted = existingSession.status === 'accepted';
                  isInitiator = existingSession.initiatedBy === currentUser.id;
                  
                  if (isAccepted) {
                    actionIcon = <MessageSquare size={18} />;
                    statusText = "Node Connection Established";
                  } else if (isPending) {
                    statusText = isInitiator ? "Request Sent - Waiting for Sync" : "Incoming Signal Request";
                    actionIcon = isInitiator ? <Clock size={18} /> : <UserPlus size={18} />;
                  }
                }

                return (
                  <div 
                    key={user.id} 
                    className="bg-slate-800/40 border border-white/5 p-4 rounded-xl flex items-center gap-4 hover:border-cyan-500/50 hover:bg-slate-800/60 transition-all group animate-slide-up hover:shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                  >
                    <div className="relative cursor-pointer" onClick={() => handleUserClick(user)}>
                      <img src={user.avatar} className="w-12 h-12 rounded-full object-cover border-2 border-slate-700 group-hover:border-cyan-400" alt={user.name} />
                      <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border border-slate-800 ${
                          user.status === 'online' ? 'bg-green-500' : 
                          user.status === 'busy' ? 'bg-red-500' : 'bg-slate-500'
                      }`}></div>
                    </div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleUserClick(user)}>
                       <h4 className="text-white font-bold truncate">{user.name || 'Anonymous Operative'}</h4>
                       <p className={`text-xs truncate ${isPending ? 'text-cyan-400 italic' : isAccepted ? 'text-violet-400' : 'text-slate-500'}`}>
                         {statusText}
                       </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUserClick(user);
                        }}
                        className="p-2 bg-slate-700/50 text-slate-400 rounded-lg hover:bg-slate-700 hover:text-white transition-all"
                        title="View Profile"
                      >
                         <UserIcon size={18} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isPending && isInitiator) return;
                          onStartChat && onStartChat(user);
                        }}
                        disabled={isPending && isInitiator}
                        className={`p-2 rounded-lg transition-all ${
                          isAccepted 
                            ? 'bg-violet-600/20 text-violet-400 hover:bg-violet-600 hover:text-white' 
                            : isPending && isInitiator
                              ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                              : 'bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600 hover:text-white'
                        }`}
                        title={isAccepted ? "Open Chat" : isPending ? (isInitiator ? "Request Pending" : "Accept Request") : "Send Request"}
                      >
                         {actionIcon}
                      </button>
                    </div>
                  </div>
                );
             })}
         </div>
       )}

       {/* User Profile Modal */}
       {selectedUser && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="w-full max-w-md bg-cyber-panel border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.2)] overflow-hidden flex flex-col relative">
                
                {/* Modal Header/Cover */}
                <div className="h-32 bg-gradient-to-r from-violet-900 to-slate-900 relative">
                   <button 
                     onClick={() => setSelectedUser(null)} 
                     className="absolute top-4 right-4 p-2 bg-black/30 hover:bg-red-500/20 text-white rounded-full transition-colors"
                   >
                      <X size={20} />
                   </button>
                </div>

                {/* Content */}
                <div className="px-8 pb-8 -mt-16 flex flex-col items-center text-center">
                   <img src={selectedUser.avatar} className="w-32 h-32 rounded-full border-4 border-cyber-panel ring-2 ring-cyan-500 shadow-lg mb-4 bg-slate-800" alt={selectedUser.name} />
                   
                   <h2 className="text-2xl font-bold text-white mb-1">{selectedUser.name}</h2>
                   <div className="flex items-center gap-2 mb-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full border border-opacity-30 bg-opacity-10 ${
                         selectedUser.status === 'online' ? 'border-green-500 text-green-400 bg-green-500' :
                         selectedUser.status === 'busy' ? 'border-red-500 text-red-400 bg-red-500' :
                         'border-slate-500 text-slate-400 bg-slate-500'
                      }`}>
                         {selectedUser.status?.toUpperCase() || 'OFFLINE'}
                      </span>
                      {selectedUser.gender && (
                        <span className="text-xs px-2 py-0.5 rounded-full border border-violet-500/30 text-violet-400 bg-violet-500/10">
                          {selectedUser.gender}
                        </span>
                      )}
                   </div>

                   <div className="w-full bg-slate-900/50 p-4 rounded-xl border border-white/5 mb-6 text-left">
                      <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                        <UserIcon size={12}/> Bio Data
                      </h4>
                      <p className="text-slate-300 text-sm leading-relaxed">
                        {selectedUser.bio || "This user has not uploaded any biological data description."}
                      </p>
                   </div>

                   <button 
                     onClick={handleConnect}
                     className="w-full py-3 bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white font-bold rounded-xl shadow-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
                   >
                      <UserPlus size={20} />
                      ESTABLISH CONNECTION
                   </button>
                   <button 
                     onClick={async () => {
                       if (!selectedUser) return;
                       await dbService.toggleBlockUser(auth.currentUser?.uid || '', selectedUser.id, true);
                       setSelectedUser(null);
                     }}
                     className="w-full mt-3 py-3 bg-red-900/20 hover:bg-red-800/20 text-red-400 border border-red-500/30 rounded-xl transition-all flex items-center justify-center gap-2"
                   >
                      <ShieldBan size={20} />
                      BLOCK USER
                   </button>
                </div>

            </div>
         </div>
       )}
    </div>
  );
};