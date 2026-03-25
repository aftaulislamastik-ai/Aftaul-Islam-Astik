import React from 'react';
import { User } from '../types';
import { X, Calendar, Fingerprint, FileText, QrCode, Hash, Shield, Activity, Clock, ArrowLeft, ShieldBan } from 'lucide-react';
import { dbService } from '../services/dbService';
import { auth } from '../firebaseConfig';
import QRCode from 'react-qr-code';

interface UserProfileProps {
  user: User;
  currentUser: User;
  onClose: () => void;
  onAction?: (user: User) => void;
  actionLabel?: string;
  isCurrentUser?: boolean;
}

export const UserProfile: React.FC<UserProfileProps> = ({ user, currentUser, onClose, onAction, actionLabel, isCurrentUser }) => {
  const isBlocked = currentUser.blockedIds?.includes(user.id);
  // Format date of birth if available
  const formattedDob = user.dob ? new Date(user.dob).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'Classified';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-cyber-dark border border-cyan-500/30 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.2)] animate-scale-in">
        
        {/* Header / Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black/40 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-full transition-all border border-white/5"
        >
          <X size={20} />
        </button>

        {/* Profile Banner/Avatar Area */}
        <div className="relative h-32 bg-gradient-to-r from-cyan-900/40 to-violet-900/40 border-b border-white/10">
           <div className="absolute -bottom-12 left-6">
              <div className="relative">
                <img 
                  src={user.avatar} 
                  alt={user.name} 
                  className="w-24 h-24 rounded-xl border-2 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.4)] object-cover bg-slate-900"
                />
                <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-cyber-dark ${
                  user.status === 'online' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 
                  user.status === 'busy' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 
                  'bg-slate-500'
                }`} />
              </div>
           </div>
        </div>

        {/* Content Area */}
        <div className="pt-16 p-6 space-y-6">
          {/* Identity Header */}
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              {user.name}
              {user.isAi && <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/30 font-mono tracking-tighter">AI</span>}
            </h2>
            <div className="flex items-center gap-2 mt-1">
               <span className={`text-[10px] uppercase font-mono tracking-tighter ${
                 user.status === 'online' ? 'text-green-400' : 
                 user.status === 'busy' ? 'text-red-400' : 
                 'text-slate-500'
               }`}>
                 {user.status === 'online' ? 'Signal Active' : user.status === 'busy' ? 'Frequency Busy' : 'Signal Lost'}
               </span>
            </div>
          </div>

          {/* Bio Section */}
          <div className="bg-slate-900/40 border border-white/5 p-4 rounded-xl">
             <div className="flex items-center gap-2 text-slate-400 mb-2">
                <FileText size={14} className="text-cyan-400" />
                <span className="text-[10px] font-mono uppercase tracking-widest">Operative Directive</span>
             </div>
             <p className="text-sm text-slate-300 italic leading-relaxed">
                {user.bio || "No directive established for this operative."}
             </p>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-slate-900/40 border border-white/5 p-3 rounded-xl">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                   <Fingerprint size={12} className="text-violet-400" />
                   <span className="text-[9px] font-mono uppercase tracking-widest">Entity Type</span>
                </div>
                <span className="text-xs text-slate-200 capitalize font-medium">
                   {user.gender === 'unspecified' ? 'Classified' : user.gender || 'Classified'}
                </span>
             </div>
             <div className="bg-slate-900/40 border border-white/5 p-3 rounded-xl">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                   <Calendar size={12} className="text-cyan-400" />
                   <span className="text-[9px] font-mono uppercase tracking-widest">Inception</span>
                </div>
                <span className="text-xs text-slate-200 font-medium">
                   {formattedDob}
                </span>
             </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            {!isCurrentUser && actionLabel && (
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    if (onAction) {
                      onAction(user);
                      onClose();
                    }
                  }}
                  disabled={!onAction}
                  className={`flex-1 py-3 font-bold rounded-xl shadow-lg transition-all transform flex items-center justify-center gap-2 uppercase tracking-widest font-mono text-sm ${
                    onAction 
                      ? 'bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white hover:scale-[1.02]' 
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                  }`}
                >
                  <Activity size={18} />
                  {actionLabel}
                </button>
                <button 
                  onClick={async () => {
                    if (!user) return;
                    await dbService.toggleBlockUser(currentUser.id, user.id, !isBlocked);
                    // No need to reload, App.tsx has a listener for currentUser
                    if (!isBlocked) {
                      onClose();
                    }
                  }}
                  title={isBlocked ? "Unblock Neural Signal" : "Block Neural Signal"}
                  className={`px-4 py-3 border rounded-xl transition-all flex items-center justify-center ${
                    isBlocked 
                      ? 'bg-cyan-900/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-800/20' 
                      : 'bg-red-900/20 text-red-400 border-red-500/30 hover:bg-red-800/20'
                  }`}
                >
                  <ShieldBan size={18} />
                </button>
              </div>
            )}
            
            <button 
              onClick={onClose}
              className="w-full py-3 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 border border-white/5 rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest font-mono text-xs"
            >
              <ArrowLeft size={14} />
              Return to Terminal
            </button>
          </div>

          {/* Footer Info */}
          <div className="flex items-center justify-between text-[9px] font-mono text-slate-600 pt-2">
             <div className="flex items-center gap-1">
                <Shield size={10} />
                <span>SECURE PROTOCOL V2.5</span>
             </div>
             {user.lastSeen && (
                <div className="flex items-center gap-1">
                   <Clock size={10} />
                   <span>LAST SYNC: {new Date(user.lastSeen).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};
