import React, { useState, useRef, useEffect } from 'react';
import { Send, EyeOff, Eraser, Clock, Lock, PenTool, Mic, Gamepad2, X, Paperclip, Smile, Loader2, HelpCircle, Check, Image as ImageIcon, CornerDownRight } from 'lucide-react';
import { MessageType, Message } from '../types';
import { DrawModal } from './DrawModal';
import { uploadToCloudinary } from '../services/cloudinaryService';

interface ToolboxProps {
  onSend: (message: { content: string; type: MessageType; meta?: any }) => void;
  onTyping?: (isTyping: boolean) => void;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '💯', '🚀', '✨', '👀', '✅'];

export const Toolbox: React.FC<ToolboxProps> = ({ onSend, onTyping, replyingTo, onCancelReply }) => {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<MessageType>('text');
  const [showExtras, setShowExtras] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Specific modals states
  const [showDraw, setShowDraw] = useState(false);
  const [lockPassword, setLockPassword] = useState('');
  
  // New States for Preview & Guide
  const [previewMedia, setPreviewMedia] = useState<{url: string, type: 'image' | 'video'} | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    
    if (onTyping) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        onTyping(true);
      }
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        onTyping(false);
      }, 2000);
    }
  };

  const handleSend = () => {
    if (!text.trim() && mode !== 'draw' && mode !== 'nudge' && mode !== 'image') return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      isTypingRef.current = false;
      if (onTyping) onTyping(false);
    }

    let meta = {};
    if (mode === 'lock') {
      if (!lockPassword) {
         alert("Please set a password for the locked message.");
         return;
      }
      meta = { password: lockPassword };
    } else if (mode === 'capsule') {
       const future = new Date();
       future.setSeconds(future.getSeconds() + 30); 
       meta = { unlockTime: future };
    }

    onSend({
      content: text,
      type: mode,
      meta
    });

    // Reset
    setText('');
    setMode('text');
    setLockPassword('');
  };

  const handleConfirmMedia = () => {
    if (previewMedia) {
       onSend({
         content: previewMedia.url,
         type: 'image' // We generally use 'image' type for media, bubble handles video rendering by extension
       });
       setPreviewMedia(null);
    }
  };

  const handleDrawSave = (dataUrl: string) => {
    onSend({
      content: dataUrl,
      type: 'draw'
    });
    setShowDraw(false);
  };

  const handleNudge = () => {
     onSend({ content: 'NUDGE!', type: 'nudge' });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const result = await uploadToCloudinary(file);
    
    if (result) {
      // Instead of sending immediately, set Preview
      setPreviewMedia({
        url: result.url,
        type: result.type
      });
    } else {
      alert("Upload failed. Transmission intercepted.");
    }
    setIsUploading(false);
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleEmojiClick = (emoji: string) => {
    setText(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  return (
    <div className="relative p-4 bg-cyber-panel border-t border-white/5 z-20">
      {/* Reply Preview */}
      {replyingTo && (
        <div className="absolute -top-16 left-0 right-0 bg-slate-900/90 backdrop-blur-md border-t border-cyan-500/30 p-2 flex items-center justify-between animate-slide-up">
          <div className="flex items-center gap-2 overflow-hidden">
            <CornerDownRight size={16} className="text-cyan-400 flex-shrink-0" />
            <div className="text-xs border-l-2 border-cyan-500 pl-2 overflow-hidden">
              <div className="text-cyan-400 font-bold truncate">Replying to Signal</div>
              <div className="text-slate-400 truncate italic">
                {replyingTo.type === 'image' ? 'Media File' : replyingTo.content}
              </div>
            </div>
          </div>
          <button onClick={onCancelReply} className="p-1 text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Mode Indicators */}
      {mode !== 'text' && (
        <div className="absolute -top-10 left-4 bg-violet-600 text-white text-xs px-3 py-1 rounded-t-lg flex items-center gap-2 shadow-lg animate-slide-up">
           <span className="uppercase font-bold">{mode} MODE ACTIVE</span>
           <button onClick={() => setMode('text')}><X size={12} /></button>
        </div>
      )}

      {/* Uploading Indicator */}
      {isUploading && (
        <div className="absolute -top-10 right-4 bg-cyan-600 text-white text-xs px-3 py-1 rounded-t-lg flex items-center gap-2 shadow-lg animate-pulse">
           <Loader2 size={12} className="animate-spin" />
           <span>UPLOADING MEDIA...</span>
        </div>
      )}

      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
        accept="image/*,video/*"
      />

      {/* Inputs for specific modes */}
      {mode === 'lock' && (
        <div className="mb-2">
           <input 
             type="text" 
             placeholder="Set Lock Password..." 
             className="w-full bg-slate-900 border border-violet-500 rounded px-3 py-1 text-xs text-white focus:outline-none"
             value={lockPassword}
             onChange={e => setLockPassword(e.target.value)}
           />
        </div>
      )}

      <div className="flex items-end gap-2">
        <button 
          onClick={() => setShowExtras(!showExtras)}
          className={`p-3 rounded-xl transition-all ${showExtras ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
        >
          <Gamepad2 size={20} />
        </button>

        <div className="flex-1 bg-slate-800/50 border border-slate-700 rounded-xl flex items-center pr-2 focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500/50 transition-all">
          <input 
            type="text" 
            value={text}
            onChange={handleTextChange}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={mode === 'text' ? "Transmit message..." : `Type ${mode} content...`}
            className="w-full bg-transparent border-none text-white px-4 py-3 focus:outline-none placeholder-slate-500 text-base"
            disabled={isUploading}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
          <div className="relative">
            <button 
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-2 transition-colors ${showEmojiPicker ? 'text-cyan-400' : 'text-slate-400 hover:text-white'}`}
            >
              <Smile size={18} />
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-12 right-0 bg-slate-900 border border-white/10 rounded-xl p-2 shadow-2xl grid grid-cols-4 gap-1 z-50 animate-fade-in">
                {EMOJIS.map(emoji => (
                  <button 
                    key={emoji} 
                    onClick={() => handleEmojiClick(emoji)}
                    className="p-2 hover:bg-white/10 rounded-lg text-xl transition-transform hover:scale-125"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button 
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className="p-2 text-slate-400 hover:text-cyan-400 transition-colors"
            title="Attach Media"
          >
            <Paperclip size={18} />
          </button>
        </div>

        <button 
          onClick={handleSend}
          disabled={isUploading}
          className="p-3 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-xl text-white shadow-lg hover:shadow-cyan-500/30 transition-all transform hover:scale-105 disabled:opacity-50"
        >
          <Send size={20} />
        </button>
      </div>

      {/* Expanded Tools */}
      {showExtras && (
        <div className="mt-4 grid grid-cols-4 sm:grid-cols-8 gap-2 animate-fade-in-up">
           <ToolButton icon={<EyeOff size={18} />} label="Stealth" active={mode === 'stealth'} onClick={() => setMode('stealth')} />
           <ToolButton icon={<Eraser size={18} />} label="Scratch" active={mode === 'scratch'} onClick={() => setMode('scratch')} />
           <ToolButton icon={<Clock size={18} />} label="Capsule" active={mode === 'capsule'} onClick={() => setMode('capsule')} />
           <ToolButton icon={<Lock size={18} />} label="Lock" active={mode === 'lock'} onClick={() => setMode('lock')} />
           <ToolButton icon={<PenTool size={18} />} label="Draw" onClick={() => setShowDraw(true)} />
           <ToolButton icon={<Mic size={18} />} label="Voice" onClick={() => alert("Voice module offline")} />
           <ToolButton icon={<div className="font-bold">!</div>} label="Nudge" onClick={handleNudge} />
           <ToolButton icon={<HelpCircle size={18} />} label="Guide" onClick={() => setShowGuide(true)} />
        </div>
      )}

      {showDraw && <DrawModal onClose={() => setShowDraw(false)} onSave={handleDrawSave} />}

      {/* Media Preview Modal */}
      {previewMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
           <div className="bg-cyber-panel border border-cyan-500/30 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-white/5 flex justify-between items-center">
                 <h3 className="text-white font-bold flex items-center gap-2"><ImageIcon size={18} /> Confirm Upload</h3>
                 <button onClick={() => setPreviewMedia(null)} className="text-slate-400 hover:text-white"><X size={20}/></button>
              </div>
              <div className="p-4 bg-black/50 flex justify-center">
                 {previewMedia.type === 'video' ? (
                    <video src={previewMedia.url} controls className="max-h-[300px] rounded-lg" />
                 ) : (
                    <img src={previewMedia.url} alt="Preview" className="max-h-[300px] rounded-lg object-contain" />
                 )}
              </div>
              <div className="p-4 flex gap-3">
                 <button onClick={() => setPreviewMedia(null)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg">Cancel</button>
                 <button onClick={handleConfirmMedia} className="flex-1 py-3 bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white font-bold rounded-lg flex items-center justify-center gap-2">
                    <Send size={18} /> Send
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Feature Guide Modal */}
      {showGuide && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-cyber-panel border border-violet-500/30 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl h-[80vh] flex flex-col">
               <div className="p-5 border-b border-white/5 flex justify-between items-center bg-violet-600/10">
                  <h3 className="text-xl font-bold text-white tracking-widest flex items-center gap-2">
                     <Gamepad2 size={22} className="text-cyan-400" /> TOOLBOX GUIDE
                  </h3>
                  <button onClick={() => setShowGuide(false)} className="text-slate-400 hover:text-white"><X size={24}/></button>
               </div>
               
               <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  <GuideItem 
                     icon={<EyeOff className="text-slate-400" />} 
                     title="Stealth Mode" 
                     desc="Send hidden messages. The recipient must hover over the shield to reveal the text."
                  />
                  <GuideItem 
                     icon={<Eraser className="text-slate-400" />} 
                     title="Scratch Card" 
                     desc="Text is covered by a scratch-off layer. Users interactively rub the screen to read it."
                  />
                  <GuideItem 
                     icon={<Clock className="text-slate-400" />} 
                     title="Time Capsule" 
                     desc="Locked message that reveals itself only after a 30-second countdown."
                  />
                  <GuideItem 
                     icon={<Lock className="text-slate-400" />} 
                     title="Encrypted Lock" 
                     desc="Protect your message with a custom password. The recipient needs the key to decrypt."
                  />
                  <GuideItem 
                     icon={<PenTool className="text-slate-400" />} 
                     title="Digital Canvas" 
                     desc="Open a drawing board to sketch diagrams or art and send them as images."
                  />
                  <GuideItem 
                     icon={<div className="font-bold text-slate-400 px-2">!</div>} 
                     title="Nudge" 
                     desc="Shake the recipient's screen to get their attention immediately."
                  />
               </div>

               <div className="p-4 border-t border-white/5 bg-slate-900/50">
                  <button onClick={() => setShowGuide(false)} className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold">
                     ACKNOWLEDGED
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

const ToolButton = ({ icon, label, active, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${active ? 'bg-violet-600 text-white' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-cyan-400'}`}
  >
    <div className="mb-1">{icon}</div>
    <span className="text-[10px] uppercase tracking-wide">{label}</span>
  </button>
);

const GuideItem = ({icon, title, desc}: any) => (
   <div className="flex gap-4 p-4 bg-slate-800/50 rounded-xl border border-white/5 hover:border-cyan-500/30 transition-colors">
      <div className="mt-1 p-2 bg-slate-900 rounded-lg h-fit">{icon}</div>
      <div>
         <h4 className="text-cyan-400 font-bold mb-1">{title}</h4>
         <p className="text-slate-300 text-sm leading-relaxed">{desc}</p>
      </div>
   </div>
);