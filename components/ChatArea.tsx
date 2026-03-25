import React, { useEffect, useRef, useState } from 'react';
import { ChatSession, User, Message } from '../types';
import { MessageBubble } from './MessageBubble';
import { Toolbox } from './Toolbox';
import { Phone, Video, MoreHorizontal, ArrowLeft, ShieldBan, CheckCircle, XCircle, ChevronDown, User as UserIcon } from 'lucide-react';
import { generateAiResponse } from '../services/geminiService';
import { dbService } from '../services/dbService';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

interface ChatAreaProps {
  session: ChatSession | null;
  currentUser: User;
  onSendMessage: (sessionId: string, message: Partial<Message>) => void;
  onShowProfile: (user: User) => void;
  onInitiateCall: (receiverId: string, type: 'audio' | 'video') => void;
  onBack: () => void;
  isMobile: boolean;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ session, currentUser, onSendMessage, onShowProfile, onInitiateCall, onBack, isMobile }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]); 
  const [isNudged, setIsNudged] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [otherUserRealtime, setOtherUserRealtime] = useState<User | null>(null);
  const [messageLimit, setMessageLimit] = useState(15);
  const [isFetchingOlder, setIsFetchingOlder] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const prevScrollHeightRef = useRef<number>(0);

  const menuRef = useRef<HTMLDivElement>(null);

  const otherUser = session?.participants?.find(p => p.id !== currentUser.id) || session?.participants?.[0];

  // Reset limit when changing chats
  useEffect(() => {
    setMessageLimit(15);
  }, [session?.id]);

  // 0. Listen to Other User's Real-time Status
  useEffect(() => {
    if (otherUser?.id && !otherUser.isAi) {
      const unsubscribe = onSnapshot(doc(db, 'users', otherUser.id), (doc) => {
        if (doc.exists()) {
          setOtherUserRealtime(doc.data() as User);
        }
      });
      return () => unsubscribe();
    } else if (otherUser?.isAi) {
      setOtherUserRealtime({ ...otherUser, status: 'online' });
    }
  }, [otherUser?.id, otherUser?.isAi]);

  const currentUserStatusRef = useRef(currentUser.status);
  useEffect(() => {
    const previousStatus = currentUserStatusRef.current;
    currentUserStatusRef.current = currentUser.status;
    
    // If user just came online/busy while chat is open, mark messages as read
    if (previousStatus === 'offline' && currentUser.status !== 'offline' && session?.id && document.visibilityState === 'visible') {
      dbService.markMessagesAsRead(session.id, currentUser.id);
    }
  }, [currentUser.status, session?.id, currentUser.id]);

  // 1. Listen to Real-time Messages
  useEffect(() => {
    if (session?.id) {
       const unsubscribe = dbService.subscribeToChatMessages(session.id, messageLimit, (newMessages) => {
         setMessages(newMessages);
         
         // If chat is active and user is NOT offline, mark unread messages as decrypted
         if (document.visibilityState === 'visible' && currentUserStatusRef.current !== 'offline') {
           dbService.markMessagesAsRead(session.id, currentUser.id);
         }
       });
       return () => unsubscribe();
    } else {
      setMessages([]);
    }
  }, [session?.id, currentUser.id, messageLimit]);

  // Handle visibility change to mark as read when user comes back
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && session?.id && currentUserStatusRef.current !== 'offline') {
        dbService.markMessagesAsRead(session.id, currentUser.id);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [session?.id, currentUser.id]);

  // 2. Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      if (isFetchingOlder) {
        // Restore scroll position so it doesn't jump to the top
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevScrollHeightRef.current;
        setIsFetchingOlder(false);
      } else {
        // Scroll to bottom for new messages or initial load
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, [messages]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    
    // Show/hide scroll to bottom button
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
    setShowScrollBottom(!isAtBottom);

    if (target.scrollTop === 0 && messages.length >= messageLimit) {
      setIsFetchingOlder(true);
      prevScrollHeightRef.current = target.scrollHeight;
      setMessageLimit(prev => prev + 15);
    }
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  // Handle Nudge
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.type === 'nudge' && lastMsg.timestamp.getTime() > Date.now() - 1000) {
      setIsNudged(true);
      const timer = setTimeout(() => setIsNudged(false), 500);
      return () => clearTimeout(timer);
    }
  }, [messages]);

  // AI Response Handler
  useEffect(() => {
    if (session && messages.length > 0 && session.status === 'accepted') {
       const lastMsg = messages[messages.length - 1];
       const otherParticipant = session.participants?.find(p => p.id !== currentUser.id);
       
       if (otherParticipant?.isAi && lastMsg.senderId === currentUser.id && lastMsg.type === 'text') {
         setIsTyping(true);
         const history = messages
          .filter(m => m.type === 'text')
          .slice(-10) 
          .map(m => ({
             role: m.senderId === currentUser.id ? 'user' : 'model',
             parts: [{ text: m.content }]
          }));
         const prompt = history.pop()?.parts[0].text || "";

         generateAiResponse(prompt, history).then(text => {
             onSendMessage(session.id, {
                 type: 'text',
                 content: text,
                 senderId: otherParticipant.id 
             });
             setIsTyping(false);
         });
       }
    }
  }, [messages, currentUser.id, session?.participants, session?.id, session?.status]);

  if (!session || !otherUser) {
    return (
      <div className="flex-1 flex items-center justify-center bg-cyber-dark text-slate-500">
        <div className="animate-pulse">Establishing secure link...</div>
      </div>
    );
  }

  const isPending = session.status === 'pending';
  const isInitiator = session.initiatedBy === currentUser.id;
  const isBlocked = currentUser.blockedIds?.includes(otherUser?.id || '');
  const isOtherUserTyping = session.typing?.[otherUser?.id || ''] || isTyping; // isTyping is for AI

  // Format real-time status
  let statusDisplay = <span className="text-slate-500">Offline</span>;
  if (isOtherUserTyping) {
    statusDisplay = <span className="text-cyan-400 animate-pulse">Typing... █</span>;
  } else if (otherUserRealtime?.status === 'online') {
    statusDisplay = (
      <span className="text-cyan-400 flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4] animate-pulse"></span>
        Online
      </span>
    );
  } else if (otherUserRealtime?.status === 'busy') {
    statusDisplay = <span className="text-red-400">Busy</span>;
  } else if (otherUserRealtime?.lastSeen) {
    const mins = Math.floor((Date.now() - otherUserRealtime.lastSeen) / 60000);
    if (mins < 1) statusDisplay = <span className="text-slate-500">Last seen: Just now</span>;
    else if (mins < 60) statusDisplay = <span className="text-slate-500">Last seen: {mins}m ago</span>;
    else if (mins < 1440) statusDisplay = <span className="text-slate-500">Last seen: {Math.floor(mins / 60)}h ago</span>;
    else statusDisplay = <span className="text-slate-500">Offline</span>;
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleBlock = async () => {
    if (!otherUser) return;
    const isCurrentlyBlocked = currentUser.blockedIds?.includes(otherUser.id);
    
    try {
      await dbService.toggleBlockUser(currentUser.id, otherUser.id, !isCurrentlyBlocked);
      setShowMenu(false);
      // Don't call onBack() automatically, let the UI show the blocked state
      // unless it's mobile and we want to go back
      if (window.innerWidth < 768 && !isCurrentlyBlocked) {
        onBack();
      }
    } catch (e) {
      console.error("Block failed", e);
    }
  };

  const handleAccept = async () => {
     await dbService.acceptChatRequest(session.id);
  };

  const handleDecline = async () => {
     await dbService.deleteChat(session.id);
     onBack();
  };

  const handleSendMessageWithReply = async (sessionId: string, messageData: Partial<Message>) => {
    if (otherUserRealtime?.status === 'busy') {
      alert("SIGNAL BLOCKED: This operative is currently in BUSY mode. Communication is restricted.");
      return;
    }

    if (replyingTo) {
      messageData.replyToId = replyingTo.id;
      messageData.repliedMessage = {
        content: replyingTo.content,
        senderId: replyingTo.senderId,
        type: replyingTo.type
      };
      setReplyingTo(null);
    }
    onSendMessage(sessionId, { ...messageData, senderId: currentUser.id });
  };

  const handleDeleteMessage = async (messageId: string, forEveryone: boolean) => {
    if (!session) return;
    try {
      await dbService.deleteMessage(session.id, messageId, forEveryone);
    } catch (e) {
      console.error("Failed to delete message", e);
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!session) return;
    try {
      await dbService.editMessage(session.id, messageId, newContent);
    } catch (e) {
      console.error("Failed to edit message", e);
    }
  };

  const handleReactToMessage = async (messageId: string, emoji: string) => {
    if (!session) return;
    try {
      const message = messages.find(m => m.id === messageId);
      const alreadyReacted = message?.reactions?.[emoji]?.includes(currentUser.id);
      
      if (alreadyReacted) {
        await dbService.removeReaction(session.id, messageId, currentUser.id, emoji);
      } else {
        await dbService.addReaction(session.id, messageId, currentUser.id, emoji);
      }
    } catch (e) {
      console.error("Failed to react to message", e);
    }
  };

  return (
    <div className={`flex-1 flex flex-col bg-cyber-dark relative overflow-hidden ${isNudged ? 'animate-shake' : ''}`}>
       {/* Background Grid */}
       <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

       {/* Header */}
       <div className="relative z-10 p-4 border-b border-white/5 bg-cyber-panel/80 backdrop-blur-md flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
             {isMobile && (
               <button onClick={onBack} className="md:hidden text-slate-400 hover:text-white">
                 <ArrowLeft />
               </button>
             )}
             <img 
               src={otherUser.avatar} 
               className="w-10 h-10 rounded-full border border-cyan-500 cursor-pointer hover:scale-110 transition-transform" 
               alt={otherUser.name} 
               onClick={() => onShowProfile(otherUserRealtime || otherUser)}
             />
             <div className="cursor-pointer" onClick={() => onShowProfile(otherUserRealtime || otherUser)}>
               <h3 className="font-bold text-white flex items-center gap-2">
                 {otherUser.name}
                 {otherUser.isAi && <span className="bg-violet-600 text-[10px] px-1 rounded">AI</span>}
               </h3>
               <div className="text-xs">
                 {isBlocked ? <span className="text-red-400">BLOCKED</span> : statusDisplay}
               </div>
             </div>
          </div>
          <div className="flex gap-4 text-slate-400 relative" ref={menuRef}>
             {!isPending && !isBlocked && (
               <>
                 <button 
                  onClick={() => onInitiateCall(otherUser.id, 'audio')}
                  className="hover:text-cyan-400 transition-colors"
                 >
                   <Phone size={20} />
                 </button>
                 <button 
                  onClick={() => onInitiateCall(otherUser.id, 'video')}
                  className="hover:text-cyan-400 transition-colors"
                 >
                   <Video size={20} />
                 </button>
               </>
             )}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }} 
                className={`hover:text-cyan-400 transition-colors p-2 rounded-full ${showMenu ? 'bg-white/10 text-cyan-400' : ''}`}
              >
                <MoreHorizontal size={20} />
              </button>
             
             {/* Dropdown Menu */}
             {showMenu && (
               <div className="absolute top-10 right-0 bg-slate-900 border border-white/10 rounded-lg shadow-xl py-2 w-40 z-50 animate-fade-in">
                  <button 
                    onClick={() => {
                      onShowProfile(otherUserRealtime || otherUser);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-white/5 flex items-center gap-2"
                  >
                    <UserIcon size={14} /> View Profile
                  </button>
                  <button 
                    onClick={handleBlock}
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/5 flex items-center gap-2"
                  >
                    <ShieldBan size={14} /> {currentUser.blockedIds?.includes(otherUser.id) ? 'Unblock User' : 'Block User'}
                  </button>
               </div>
             )}
          </div>
       </div>

       {/* Messages */}
       <div className="flex-1 overflow-y-auto p-4 space-y-2 relative z-10" ref={scrollRef} onScroll={handleScroll}>
          {/* Request Warning */}
          {isPending && !isInitiator && (
             <div className="bg-slate-800/80 border border-violet-500/50 p-4 rounded-xl text-center mb-4">
                <p className="text-white font-bold mb-2">Incoming Neural Link Request</p>
                <p className="text-slate-400 text-xs mb-4">{otherUser.name} wants to connect with you.</p>
                <div className="flex justify-center gap-4">
                   <button onClick={handleAccept} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
                      <CheckCircle size={16} /> Accept
                   </button>
                   <button onClick={handleDecline} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
                      <XCircle size={16} /> Decline
                   </button>
                   <button onClick={handleBlock} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
                      <ShieldBan size={16} /> Block
                   </button>
                </div>
             </div>
          )}

          {isPending && isInitiator && (
             <div className="text-center py-10 opacity-50">
                <p className="text-slate-400">Request sent. Waiting for signal acknowledgment...</p>
             </div>
          )}

          {isBlocked && (
             <div className="text-center py-10 opacity-50">
                <ShieldBan className="mx-auto text-red-500 mb-2" size={32} />
                <p className="text-red-400 font-bold">User Blocked</p>
                <p className="text-slate-500 text-xs">Communication protocols terminated.</p>
             </div>
          )}

          {/* Regular Messages (Hide if pending incoming request) */}
          {(!isPending || isInitiator) && messages.map((msg) => (
             <MessageBubble 
               key={msg.id} 
               message={msg} 
               isOwn={msg.senderId === currentUser.id} 
               onReply={() => setReplyingTo(msg)}
               onDelete={(forEveryone) => handleDeleteMessage(msg.id, forEveryone)}
               onEdit={(newContent) => handleEditMessage(msg.id, newContent)}
               onReact={(emoji) => handleReactToMessage(msg.id, emoji)}
               currentUser={currentUser}
             />
          ))}
          
          {isOtherUserTyping && (
             <div className="max-w-[200px] bg-slate-800/80 border border-cyan-500/30 p-3 rounded-2xl rounded-tl-none flex items-center gap-2 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
                <div className="text-cyan-400 text-xs font-mono animate-pulse">Receiving data stream... █</div>
             </div>
          )}
       </div>

       {/* Scroll to Bottom Button */}
       {showScrollBottom && (
         <button 
           onClick={scrollToBottom}
           className="absolute bottom-24 right-6 z-30 p-3 bg-cyan-600/80 backdrop-blur-md text-white rounded-full shadow-lg border border-cyan-400/50 hover:bg-cyan-500 transition-all animate-bounce"
         >
           <ChevronDown size={20} />
         </button>
       )}

       {/* Composer - Hide if blocked or pending incoming request */}
       {(!isPending || isInitiator) && !isBlocked ? (
         <Toolbox 
           onSend={(msg) => handleSendMessageWithReply(session.id, msg)} 
           onTyping={(typing) => dbService.updateTypingStatus(session.id, currentUser.id, typing)}
           replyingTo={replyingTo}
           onCancelReply={() => setReplyingTo(null)}
         />
       ) : null}
    </div>
  );
};