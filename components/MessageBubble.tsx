import React, { useState, useRef, useEffect } from 'react';
import { Message, User } from '../types';
import { Lock, Eye, Eraser, Clock, Shield, Play, Pause, FileVideo, CheckCircle2, Check, CheckCheck, Reply, Trash2, Smile, MoreVertical, CornerDownRight, Edit2, X, Send } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  onReply?: () => void;
  onDelete?: (forEveryone: boolean) => void;
  onEdit?: (newContent: string) => void;
  onReact?: (emoji: string) => void;
  currentUser: User;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '💯', '🚀', '✨', '👀', '✅', '🤔', '😎', '😡', '😴', '🎉', '🙌'];

export const MessageBubble = React.memo(({ message, isOwn, onReply, onDelete, onEdit, onReact, currentUser }: MessageBubbleProps) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [unlockError, setUnlockError] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(event.target as Node)) {
        setShowActions(false);
        setShowReactionPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scratch card refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratchContainerRef = useRef<HTMLDivElement>(null);
  const [isScratched, setIsScratched] = useState(false);

  // Time capsule effect
  useEffect(() => {
    if (message.type === 'capsule' && message.meta?.unlockTime) {
      const interval = setInterval(() => {
        const now = new Date().getTime();
        const unlock = new Date(message.meta!.unlockTime!).getTime();
        const diff = unlock - now;

        if (diff <= 0) {
          setIsUnlocked(true);
          clearInterval(interval);
        } else {
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [message]);

  // Scratch card setup
  useEffect(() => {
    if (message.type === 'scratch' && canvasRef.current && scratchContainerRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = scratchContainerRef.current.clientWidth;
      canvas.height = scratchContainerRef.current.clientHeight;

      // Fill with scratch layer
      ctx.fillStyle = '#475569'; // Slate-600
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add text/pattern
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Rajdhani';
      ctx.fillText("SCRATCH TO REVEAL", 20, canvas.height / 2);

      const handleMove = (e: MouseEvent | TouchEvent) => {
        const rect = canvas.getBoundingClientRect();
        let x, y;
        if ('touches' in e) {
          x = e.touches[0].clientX - rect.left;
          y = e.touches[0].clientY - rect.top;
        } else {
          x = (e as MouseEvent).clientX - rect.left;
          y = (e as MouseEvent).clientY - rect.top;
        }

        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, 2 * Math.PI);
        ctx.fill();

        // Check completion (simplified)
        // In real app, check pixel data
      };

      canvas.addEventListener('mousemove', handleMove);
      canvas.addEventListener('touchmove', handleMove);
      
      return () => {
        canvas.removeEventListener('mousemove', handleMove);
        canvas.removeEventListener('touchmove', handleMove);
      };
    }
  }, [message.type]);

  const handleUnlock = () => {
    if (passwordInput === (message.meta?.password || '1234')) {
      setIsUnlocked(true);
      setUnlockError(false);
    } else {
      setUnlockError(true);
    }
  };

  const isVideoUrl = (url: string) => {
    return url.match(/\.(mp4|webm|ogg|mov)$/i) || url.includes('/video/');
  };

  const isDeleted = message.status === 'deleted';

  const baseClasses = message.type === 'system' 
    ? 'w-full flex justify-center my-4'
    : `group w-fit max-w-[85%] sm:max-w-[75%] rounded-lg px-3 py-1.5 mb-1 relative transition-all duration-300 shadow-sm ${
        isOwn 
          ? 'bg-cyan-900/30 border border-cyan-500/30 text-cyan-50 ml-auto rounded-tr-none' 
          : 'bg-slate-800/50 border border-slate-600/40 text-slate-200 rounded-tl-none'
      } ${isDeleted ? 'opacity-50 italic' : ''}`;

  // Content Rendering Logic
  const handleSaveEdit = () => {
    if (editValue.trim() && editValue !== message.content) {
      onEdit?.(editValue);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditValue(message.content);
    setIsEditing(false);
  };

  const renderContent = () => {
    if (isDeleted) {
      return (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Shield size={12} />
          <span>{message.content}</span>
        </div>
      );
    }

    switch (message.type) {
      case 'system':
        return (
          <div className="bg-white/5 border border-white/10 rounded-full px-4 py-1 flex items-center gap-2 text-[11px] text-slate-400 font-mono uppercase tracking-widest backdrop-blur-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-cyber-accent animate-pulse" />
            {message.content}
            <span className="ml-2 opacity-50">
              {new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>
          </div>
        );
      case 'stealth':
        return (
          <div className="group relative cursor-help">
            <div className="absolute inset-0 bg-black/50 blur-sm group-hover:opacity-0 transition-opacity duration-500 rounded-lg flex items-center justify-center">
               <Shield size={16} className="text-slate-400" />
            </div>
            <p className={`opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${isOwn ? 'text-white' : 'text-slate-200'} blur-md group-hover:blur-0`}>
              {message.content}
            </p>
          </div>
        );

      case 'scratch':
        return (
          <div ref={scratchContainerRef} className="relative min-h-[60px] min-w-[200px] flex items-center justify-center overflow-hidden rounded-lg">
             <div className="select-none font-bold text-lg">{message.content}</div>
             <canvas 
              ref={canvasRef} 
              className="absolute inset-0 touch-none cursor-crosshair"
             />
          </div>
        );

      case 'capsule':
        if (isUnlocked) {
          return (
            <div className="animate-fade-in">
               <div className="flex items-center gap-2 text-xs text-green-300 mb-1">
                 <Clock size={12} /> UNLOCKED
               </div>
               <p>{message.content}</p>
            </div>
          );
        }
        return (
          <div className="flex flex-col items-center justify-center p-2 min-w-[150px]">
            <Clock className="animate-pulse text-cyan-400 mb-2" />
            <span className="font-mono text-xl font-bold tracking-widest">{timeLeft}</span>
            <span className="text-[10px] uppercase text-slate-400 mt-1">LOCKED UNTIL REVEAL</span>
          </div>
        );

      case 'lock':
        if (isUnlocked) {
           return <p>{message.content}</p>;
        }
        return (
          <div className="flex flex-col gap-2 min-w-[200px]">
            <div className="flex items-center gap-2 text-yellow-500 mb-1">
              <Lock size={16} />
              <span className="text-xs uppercase font-bold">Encrypted Message</span>
            </div>
            <input 
              type="password" 
              placeholder="Enter Key" 
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="bg-black/30 border border-white/10 rounded px-2 py-1 text-sm focus:border-cyan-400 outline-none w-full"
            />
            <button 
              onClick={handleUnlock}
              className="bg-white/10 hover:bg-white/20 text-xs py-1 rounded transition-colors"
            >
              DECRYPT
            </button>
            {unlockError && <span className="text-[10px] text-red-400">Invalid Key Code</span>}
          </div>
        );
      
      case 'draw':
        return (
          <div className="rounded-lg overflow-hidden border border-white/10 bg-white/5">
            <img src={message.content} alt="Drawing" className="max-w-full h-auto" />
          </div>
        );

      case 'image':
        const isVideo = isVideoUrl(message.content);
        return (
          <div className="rounded-lg overflow-hidden border border-white/10">
             {isVideo ? (
               <div className="relative">
                  <div className="absolute top-2 left-2 z-10 bg-black/50 px-2 py-1 rounded text-[10px] text-white flex items-center gap-1">
                     <FileVideo size={10} /> VIDEO
                  </div>
                  <video controls className="max-w-full h-auto max-h-[300px]" src={message.content} />
               </div>
             ) : (
               <img src={message.content} alt="User sent" className="max-w-full h-auto max-h-[300px] object-cover" />
             )}
          </div>
        );

      default:
        if (isEditing) {
          return (
            <div className="flex flex-col gap-2 min-w-[200px]">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="bg-black/30 border border-cyan-500/50 rounded px-2 py-1 text-sm focus:border-cyan-400 outline-none w-full min-h-[60px] resize-none"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button 
                  onClick={handleCancelEdit}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 transition-colors"
                >
                  <X size={14} />
                </button>
                <button 
                  onClick={handleSaveEdit}
                  className="p-1.5 bg-cyan-600 hover:bg-cyan-500 rounded text-white transition-colors"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          );
        }
        return (
          <div className="flex flex-col">
            <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed">{message.content}</p>
            {message.editedAt && (
              <span className="text-[9px] opacity-50 italic mt-0.5">redacted/edited</span>
            )}
          </div>
        );
    }
  };

  return (
    <div className={baseClasses} ref={bubbleRef}>
      {/* Reply Preview in Bubble */}
      {message.repliedMessage && !isDeleted && (
        <div className="mb-2 p-2 bg-cyan-900/40 border-l-4 border-cyan-400 rounded-lg text-[12px] font-medium text-cyan-100 flex items-center gap-2 max-w-full overflow-hidden shadow-inner">
          <CornerDownRight size={14} className="text-cyan-400 flex-shrink-0" />
          <div className="truncate">
            <div className="text-[10px] uppercase tracking-widest text-cyan-400/70 font-bold mb-0.5">
              Replying to {message.repliedMessage.senderId === currentUser.id ? 'yourself' : 'operative'}
            </div>
            <div className="opacity-80 italic">
              {message.repliedMessage.type === 'image' ? 'Media File' : message.repliedMessage.content}
            </div>
          </div>
        </div>
      )}

      {renderContent()}

      {/* Reactions Display */}
      {message.reactions && Object.keys(message.reactions).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {Object.entries(message.reactions as Record<string, string[]>).map(([emoji, uids]) => (
            uids.length > 0 && (
              <button 
                key={emoji}
                onClick={() => onReact?.(emoji)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-colors ${
                  uids.includes(currentUser.id) 
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300' 
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                <span>{emoji}</span>
                <span>{uids.length}</span>
              </button>
            )
          ))}
        </div>
      )}

      {message.type !== 'system' && (
        <div className={`text-[9px] mt-0.5 flex justify-end items-center gap-1 opacity-80 ${isOwn ? 'text-cyan-200' : 'text-slate-400'}`}>
          <span className="font-mono tracking-wider">{new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
          {isOwn && (
            <span className="flex items-center gap-1 ml-1 font-mono tracking-wider text-[8px]">
              {message.status === 'pushed' && <span className="text-yellow-400/80">[ PUSHED ]</span>}
              {message.status === 'ignored' && <span className="text-slate-400/80">[ IGNORED ]</span>}
              {message.status === 'decrypted' && <span className="text-cyan-400 animate-pulse">[ DECRYPTED ]</span>}
              {!message.status && <span className="text-yellow-400/80">[ PUSHED ]</span>}
            </span>
          )}
        </div>
      )}

      {/* Action Menu Trigger */}
      {!isDeleted && message.type !== 'system' && (
        <div className={`absolute top-0 ${isOwn ? '-left-12 pr-4' : '-right-12 pl-4'} ${showActions || showReactionPicker ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity flex flex-col gap-1.5 z-20`}>
          <button 
            onClick={(e) => { e.stopPropagation(); setShowReactionPicker(!showReactionPicker); }}
            className={`p-2 bg-slate-900 border rounded-full transition-all shadow-lg ${showReactionPicker ? 'text-cyan-400 border-cyan-500' : 'text-slate-400 border-white/10 hover:text-cyan-400 hover:border-cyan-500/50'}`}
          >
            <Smile size={16} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onReply?.(); }}
            className="p-2 bg-slate-900 border border-white/10 rounded-full text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-all shadow-lg"
          >
            <Reply size={16} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setShowActions(!showActions); }}
            className={`p-2 bg-slate-900 border rounded-full transition-all shadow-lg ${showActions ? 'text-cyan-400 border-cyan-500' : 'text-slate-400 border-white/10 hover:text-cyan-400 hover:border-cyan-500/50'}`}
          >
            <MoreVertical size={16} />
          </button>
        </div>
      )}

      {/* Reaction Picker */}
      {showReactionPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setShowReactionPicker(false)}>
          <div className="bg-slate-900 border border-white/10 rounded-xl p-2 grid grid-cols-6 gap-2 shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
            {REACTION_EMOJIS.map(emoji => (
              <button 
                key={emoji}
                onClick={() => { onReact?.(emoji); setShowReactionPicker(false); }}
                className="p-2 hover:bg-white/10 rounded-lg text-xl transition-transform hover:scale-125"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions Dropdown */}
      {showActions && (
        <div className={`absolute top-8 ${isOwn ? 'right-0' : 'left-0'} bg-slate-900 border border-white/10 rounded-lg shadow-2xl py-1 w-32 z-30 animate-fade-in`}>
          {isOwn && (
            <button 
              onClick={() => { setIsEditing(true); setShowActions(false); }}
              className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 flex items-center gap-2"
            >
              <Edit2 size={12} /> Edit Signal
            </button>
          )}
          <button 
            onClick={() => { onDelete?.(false); setShowActions(false); }}
            className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 flex items-center gap-2"
          >
            <Trash2 size={12} /> Delete for me
          </button>
          {isOwn && (
            <button 
              onClick={() => { onDelete?.(true); setShowActions(false); }}
              className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-white/5 flex items-center gap-2"
            >
              <Shield size={12} /> Unsend Signal
            </button>
          )}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.message === nextProps.message && prevProps.isOwn === nextProps.isOwn;
});