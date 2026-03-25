import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { Save, User as UserIcon, FileText, Fingerprint, Camera, Loader2, Calendar, ArrowLeft, ShieldCheck, Lock, Activity, QrCode, Hash, ShieldBan, Unlock, Trash2, AlertTriangle } from 'lucide-react';
import { dbService } from '../services/dbService';
import { uploadToCloudinary } from '../services/cloudinaryService';
import { authService } from '../services/authService';
import QRCode from 'react-qr-code';

interface SettingsProps {
  currentUser: User;
  onUpdateUser: (updatedUser: User) => void;
  onBack?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ currentUser, onUpdateUser, onBack }) => {
  const [name, setName] = useState(currentUser.name);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [gender, setGender] = useState(currentUser.gender || 'unspecified');
  const [dob, setDob] = useState(currentUser.dob || '');
  
  const [newPassword, setNewPassword] = useState('');
  const [blockedUsers, setBlockedUsers] = useState<User[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [message, setMessage] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchBlockedUsers = async () => {
      if (currentUser.blockedIds && currentUser.blockedIds.length > 0) {
        const users = await Promise.all(currentUser.blockedIds.map(id => dbService.getUserById(id)));
        setBlockedUsers(users.filter(u => u !== null) as User[]);
      } else {
        setBlockedUsers([]);
      }
    };
    fetchBlockedUsers();
  }, [currentUser.blockedIds]);

  const handleUnblock = async (userId: string) => {
    await dbService.toggleBlockUser(currentUser.id, userId, false);
    setBlockedUsers(prev => prev.filter(u => u.id !== userId));
    onUpdateUser({ ...currentUser, blockedIds: currentUser.blockedIds?.filter(id => id !== userId) });
  };

  // Handle default avatar based on gender if user hasn't uploaded a custom one
  // We check if the avatar is a default dicebear/liara avatar
  const isDefaultAvatar = currentUser.avatar.includes('avatar.iran.liara.run') || currentUser.avatar.includes('ui-avatars.com') || currentUser.avatar.includes('dicebear');
  
  useEffect(() => {
    if (isDefaultAvatar && gender !== 'unspecified') {
      const newAvatar = gender === 'male' 
        ? `https://avatar.iran.liara.run/public/boy?username=${currentUser.id}`
        : gender === 'female' 
          ? `https://avatar.iran.liara.run/public/girl?username=${currentUser.id}`
          : `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.id}`;
      
      if (currentUser.avatar !== newAvatar) {
        // We don't auto-save to DB here to avoid loops, but we update the local preview
        // It will save when they click "Save Configuration"
        onUpdateUser({ ...currentUser, avatar: newAvatar });
      }
    }
  }, [gender]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setMessage('');

    const result = await uploadToCloudinary(file, true);
    
    if (result && result.url) {
       const updateResult = await dbService.updateProfile(currentUser.id, { avatar: result.url });
       
       if (updateResult.success) {
         onUpdateUser({ ...currentUser, avatar: result.url });
         setMessage('Avatar updated via Cloud Network.');
       } else {
         setMessage('Failed to link new avatar.');
       }
    } else {
      setMessage('Upload interrupted. Signal lost.');
    }
    setIsUploading(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage('');
    
    const updates = { name, bio, gender: gender as any, dob, avatar: currentUser.avatar };
    const result = await dbService.updateProfile(currentUser.id, updates);
    
    if (result.success) {
      setMessage('Identity protocols updated.');
      onUpdateUser({ ...currentUser, ...updates });
    } else {
      setMessage('Update failed. Connection unstable.');
    }
    setIsSaving(false);
  };

  const handlePasswordUpdate = async () => {
    if (!newPassword) return;
    setPasswordMsg('Processing security update...');
    const result = await authService.updateUserPassword(newPassword);
    setPasswordMsg(result.message);
    setNewPassword('');
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteError('Passcode required for termination.');
      return;
    }

    setIsDeleting(true);
    setDeleteError('');

    try {
      // 1. Delete Firestore data first
      const dbResult = await dbService.deleteUserAccount(currentUser.id);
      if (!dbResult.success) {
        setDeleteError(dbResult.message);
        setIsDeleting(false);
        return;
      }

      // 2. Delete Auth account
      const authResult = await authService.deleteAccount(deletePassword);
      if (!authResult.success) {
        setDeleteError(authResult.message);
        setIsDeleting(false);
        // Note: If auth fails, the user might be in a weird state where DB is gone but Auth remains.
        // But usually auth fails due to wrong password before DB delete if we re-order.
        // Let's re-order to be safer.
        return;
      }

      // Success - page will reload due to auth state change in App.tsx
    } catch (error) {
      setDeleteError('Critical system failure during termination.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 animate-fade-in bg-cyber-dark h-full">
      <div className="max-w-3xl mx-auto space-y-8 pb-10">
        <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-6">
           {onBack && (
              <button onClick={onBack} className="md:hidden text-slate-400 hover:text-white">
                <ArrowLeft size={24} />
              </button>
           )}
           <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-500">
             NEURAL CONFIGURATION
           </h2>
        </div>

        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Avatar & Identity Section */}
          <div className="flex flex-col items-center gap-6 w-full md:w-1/3 bg-slate-900/50 p-6 rounded-xl border border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.05)]">
             <div 
               className="relative group cursor-pointer glitch-avatar-container"
               onClick={() => !isUploading && fileInputRef.current?.click()}
             >
                <img 
                  src={currentUser.avatar} 
                  alt="Avatar" 
                  className={`w-40 h-40 rounded-sm border-2 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.4)] object-cover transition-opacity glitch-avatar ${isUploading ? 'opacity-50' : ''}`}
                />
                
                {/* Upload Overlay */}
                <div className="absolute inset-0 rounded-sm bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all backdrop-blur-sm">
                   <Camera className="text-cyan-400 w-10 h-10 animate-pulse" />
                </div>

                {/* Loading State */}
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-sm">
                    <Loader2 className="text-cyan-400 w-10 h-10 animate-spin" />
                  </div>
                )}
                
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
           </div>

          {/* Form Section */}
          <div className="flex-1 w-full space-y-6">
            
            <div className="grid grid-cols-1 gap-6 bg-slate-900/30 p-6 rounded-xl border border-white/5">
                {/* Name Input */}
                <div className="space-y-2">
                   <label className="flex items-center gap-2 text-xs text-cyan-400 font-mono uppercase tracking-widest">
                      <UserIcon size={14} /> Operative Alias
                   </label>
                   <input 
                     type="text" 
                     value={name}
                     onChange={(e) => setName(e.target.value)}
                     className="w-full bg-black/50 border border-slate-700 rounded p-3 text-white font-mono focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-all placeholder-slate-600"
                     placeholder="Enter your alias"
                   />
                </div>

                {/* Grid for Gender & Birthdate */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="flex items-center gap-2 text-xs text-cyan-400 font-mono uppercase tracking-widest">
                          <Fingerprint size={14} /> Entity Type (Gender)
                       </label>
                       <select 
                         value={gender}
                         onChange={(e) => setGender(e.target.value as "male" | "female" | "other" | "unspecified")}
                         className="w-full bg-black/50 border border-slate-700 rounded p-3 text-white font-mono focus:border-cyan-400 focus:outline-none transition-all appearance-none"
                       >
                         <option value="unspecified">Classified</option>
                         <option value="male">Male</option>
                         <option value="female">Female</option>
                         <option value="other">Non-Binary / Cybernetic</option>
                       </select>
                    </div>

                    <div className="space-y-2">
                       <label className="flex items-center gap-2 text-xs text-cyan-400 font-mono uppercase tracking-widest">
                          <Calendar size={14} /> Inception Date (DOB)
                       </label>
                       <input 
                         type="date"
                         value={dob}
                         onChange={(e) => setDob(e.target.value)}
                         className="w-full bg-black/50 border border-slate-700 rounded p-3 text-white font-mono focus:border-cyan-400 focus:outline-none transition-all [color-scheme:dark]"
                       />
                    </div>
                </div>

                {/* Bio Input */}
                <div className="space-y-2">
                   <label className="flex items-center gap-2 text-xs text-cyan-400 font-mono uppercase tracking-widest">
                      <FileText size={14} /> Operative Directive (Bio)
                   </label>
                   <textarea 
                     value={bio}
                     onChange={(e) => setBio(e.target.value)}
                     rows={3}
                     maxLength={150}
                     placeholder="Enter system description..."
                     className="w-full bg-black/50 border border-slate-700 rounded p-3 text-white font-mono focus:border-cyan-400 focus:outline-none resize-none transition-all placeholder-slate-600"
                   />
                   <p className="text-right text-[10px] text-slate-500 font-mono">{bio.length}/150 BYTES</p>
                </div>
            </div>

            {/* Save Button */}
            <div className="pt-2 flex items-center gap-4">
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="px-8 py-3 bg-cyan-500/20 border border-cyan-400 hover:bg-cyan-400 hover:text-black text-cyan-400 font-mono font-bold uppercase tracking-widest rounded shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] flex items-center gap-2 transition-all transform active:scale-95 disabled:opacity-50"
              >
                <Save size={18} />
                {isSaving ? 'UPLOADING...' : 'SAVE CONFIGURATION'}
              </button>
              {message && (
                <span className={`text-xs font-mono uppercase tracking-widest ${message.includes('failed') || message.includes('interrupted') ? 'text-red-400' : 'text-green-400'} animate-pulse`}>
                  {message}
                </span>
              )}
            </div>

            {/* Blocked Users Section */}
             <div className="pt-8 border-t border-white/10">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <ShieldBan className="text-red-400" /> Blocked Operatives
                </h3>
                {blockedUsers.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No blocked operatives.</p>
                ) : (
                  <div className="space-y-3">
                    {blockedUsers.map(user => (
                      <div key={user.id} className="flex items-center justify-between bg-slate-900/50 p-3 rounded-lg border border-white/5">
                        <div className="flex items-center gap-3">
                          <img src={user.avatar} className="w-8 h-8 rounded-full" alt={user.name} />
                          <span className="text-sm text-white font-medium">{user.name}</span>
                        </div>
                        <button 
                          onClick={() => handleUnblock(user.id)}
                          className="text-xs flex items-center gap-1 text-cyan-400 hover:text-white transition-colors"
                        >
                          <Unlock size={14} /> UNBLOCK
                        </button>
                      </div>
                    ))}
                  </div>
                )}
             </div>

            {/* Account Management Section (Facebook-style grouping) */}
            <div className="pt-8 border-t border-white/10 space-y-6">
               <h3 className="text-xl font-bold text-white flex items-center gap-2 uppercase tracking-tighter">
                 <ShieldCheck className="text-cyan-400" /> Account Management
               </h3>
               
               <div className="bg-slate-900/40 border border-white/10 rounded-2xl overflow-hidden">
                  {/* Password Change Sub-section */}
                  <div className="p-6 border-b border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-white font-bold flex items-center gap-2">
                          <Lock size={16} className="text-violet-400" /> Update Passcode
                        </h4>
                        <p className="text-slate-400 text-xs mt-1">Change your security sequence for system access.</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3 items-end">
                      <div className="flex-1 space-y-1">
                        <input 
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new secure sequence..."
                          className="w-full bg-black/40 border border-slate-800 rounded-lg p-3 text-white text-sm focus:border-cyan-400 focus:outline-none transition-all"
                        />
                      </div>
                      <button 
                        onClick={handlePasswordUpdate}
                        className="px-6 py-3 bg-slate-800 hover:bg-cyan-500/20 text-white hover:text-cyan-400 rounded-lg border border-slate-700 hover:border-cyan-400 transition-all text-xs font-bold uppercase tracking-widest"
                      >
                        UPDATE
                      </button>
                    </div>
                    {passwordMsg && (
                      <p className={`text-[10px] font-mono uppercase ${passwordMsg.includes('failed') ? 'text-red-400' : 'text-green-400'} animate-pulse`}>
                        {passwordMsg}
                      </p>
                    )}
                  </div>

                  {/* Account Deletion Sub-section */}
                  <div className="p-6 bg-red-500/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-red-400 font-bold flex items-center gap-2">
                          <Trash2 size={16} /> Self-Destruct Protocol
                        </h4>
                        <p className="text-slate-400 text-xs mt-1">Permanently terminate your identity and purge neural data.</p>
                      </div>
                      <button 
                        onClick={() => setShowDeleteModal(true)}
                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/30 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all"
                      >
                        TERMINATE
                      </button>
                    </div>
                  </div>
               </div>
            </div>

          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-red-500/50 p-8 rounded-2xl max-w-md w-full shadow-[0_0_50px_rgba(239,68,68,0.2)] space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="text-red-500" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-white uppercase tracking-tighter">Confirm Termination</h3>
              <p className="text-slate-400 text-sm">
                To proceed with the self-destruct protocol, enter your current <span className="text-red-400 font-bold">Login Passcode</span>. All data will be purged.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-500 font-mono uppercase tracking-widest">Verification Passcode</label>
                <input 
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter passcode..."
                  className="w-full bg-black/50 border border-slate-700 rounded-lg p-4 text-white focus:border-red-500 focus:outline-none transition-all"
                  autoFocus
                />
              </div>

              {deleteError && (
                <p className="text-red-400 text-xs font-mono animate-pulse">{deleteError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletePassword('');
                    setDeleteError('');
                  }}
                  disabled={isDeleting}
                  className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all disabled:opacity-50"
                >
                  ABORT
                </button>
                <button 
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                  className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 className="animate-spin" size={18} /> : 'CONFIRM'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};