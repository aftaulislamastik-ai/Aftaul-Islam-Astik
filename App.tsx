import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Auth } from './components/Auth';
import { Sidebar } from './components/Sidebar';
import { ErrorBoundary } from './components/ErrorBoundary';
const ChatArea = React.lazy(() => import('./components/ChatArea').then(module => ({ default: module.ChatArea })));
const FriendDiscovery = React.lazy(() => import('./components/FriendDiscovery').then(module => ({ default: module.FriendDiscovery })));
const Settings = React.lazy(() => import('./components/Settings').then(module => ({ default: module.Settings })));
import { EmailVerification } from './components/EmailVerification';
import { UserProfile } from './components/UserProfile';
import { CallOverlay } from './components/CallOverlay';
import { ChatSession, Message, User, Call as CallType } from './types';
import { Activity } from 'lucide-react';
import { authService, mapFirebaseUser } from './services/authService';
import { dbService } from './services/dbService'; 
import { auth, messaging } from './firebaseConfig';
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from './firebaseConfig';
import { getToken, onMessage } from "firebase/messaging";
import Peer from 'peerjs';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]); 
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'chats' | 'discovery' | 'settings'>('chats');
  
  // Controls visibility of "Main Content" vs "Sidebar" on mobile
  // True = Main Content Visible, False = Sidebar Visible
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [viewingProfileUser, setViewingProfileUser] = useState<User | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Call States
  const [activeCall, setActiveCall] = useState<CallType | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peer, setPeer] = useState<Peer | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const currentCallRef = useRef<any>(null);

  // 1. Auth & User Listener
  useEffect(() => {
    let userUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let user = mapFirebaseUser(firebaseUser);
        
        // Initial set
        setCurrentUser(user);

        // Ensure profile exists for discovery and is up to date
        const profileRef = doc(db, 'profiles', user.id);
        getDoc(profileRef).then(profileSnap => {
          if (!profileSnap.exists()) {
            setDoc(profileRef, {
              id: user.id,
              name: user.name,
              avatar: user.avatar,
              status: 'online',
              bio: ''
            });
          } else {
            const data = profileSnap.data();
            // If name or avatar is missing or "Anonymous", try to update it from Auth
            if (!data?.name || data?.name === 'Anonymous' || !data?.avatar) {
              setDoc(profileRef, {
                name: user.name,
                avatar: user.avatar
              }, { merge: true });
            }
          }
        });

        // Initialize Peer
        const newPeer = new Peer(user.id, {
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
              { urls: 'stun:stun3.l.google.com:19302' },
              { urls: 'stun:stun4.l.google.com:19302' },
            ]
          }
        });
        peerRef.current = newPeer;
        setPeer(newPeer);

        newPeer.on('call', (incomingCall) => {
          currentCallRef.current = incomingCall;
        });

        // Setup FCM
        const setupFCM = async () => {
          try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
              // NOTE: Replace 'YOUR_VAPID_KEY' with your actual VAPID key from Firebase Console -> Project Settings -> Cloud Messaging -> Web Push certificates
              const token = await getToken(messaging, { vapidKey: 'BF5U6rV4DQIdsXXAc1MEKWazy6f36nkSjpAHYwKnSa9vqqB4WWTBLzg6cJ5L9_-RyV9J-_VX9Ri9AddO4otKYWg' });
              if (token) {
                await dbService.updateFcmToken(user.id, token);
              }
            }
          } catch (error) {
            console.error("FCM Setup Error:", error);
          }
        };
        setupFCM();

      } else {
        setCurrentUser(null);
        setSessions([]); 
        if (peerRef.current) {
          peerRef.current.destroy();
          peerRef.current = null;
          setPeer(null);
        }
      }
      setIsLoading(false);
    });

    return () => {
      authUnsubscribe();
      if (userUnsubscribe) userUnsubscribe();
    };
  }, []);

  // 1.6 Call Signaling Listener
  useEffect(() => {
    if (!currentUser?.id || !peer) return;

    const unsubscribe = dbService.subscribeToIncomingCalls(currentUser.id, (call) => {
      if (call && !activeCall) {
        setActiveCall(call);
      }
    });

    return () => unsubscribe();
  }, [currentUser?.id, peer, activeCall]);

  // 1.6.5 FCM Foreground Listener
  useEffect(() => {
    if (!messaging) return;
    const unsubscribe = onMessage(messaging, (payload) => {
      if (payload.notification) {
        setToastMessage(`${payload.notification.title}: ${payload.notification.body}`);
      }
    });
    return () => unsubscribe();
  }, []);

  // 1.7 Active Call Status Listener
  useEffect(() => {
    if (!activeCall?.id) return;

    const unsubscribe = dbService.subscribeToCallStatus(activeCall.id, (status) => {
      if (status === 'ended' || status === 'rejected' || status === 'missed') {
        handleCleanupCall();
      } else if (status === 'accepted') {
        // If we are the caller, we now start the PeerJS call
        if (activeCall.callerId === currentUser?.id) {
          startPeerCall(activeCall.receiverId);
        }
      }
    });

    return () => unsubscribe();
  }, [activeCall?.id]);

  const handleCleanupCall = () => {
    if (currentCallRef.current) {
      currentCallRef.current.close();
      currentCallRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);
    setActiveCall(null);
  };

  const startPeerCall = async (receiverId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setLocalStream(stream);
      
      if (peerRef.current) {
        const call = peerRef.current.call(receiverId, stream);
        currentCallRef.current = call;
        call.on('stream', (remoteStream) => {
          setRemoteStream(remoteStream);
        });
        call.on('close', handleCleanupCall);
        call.on('error', handleCleanupCall);
      }
    } catch (err) {
      console.error("Failed to get local stream", err);
      handleEndCall();
    }
  };

  const handleInitiateCall = async (receiverId: string, type: 'audio' | 'video') => {
    if (!currentUser || !peer || activeCall) return;
    
    try {
      const callId = await dbService.initiateCall(currentUser.id, receiverId, type, peer.id);
      setActiveCall({
        id: callId,
        callerId: currentUser.id,
        receiverId,
        type,
        status: 'ringing',
        timestamp: new Date(),
        peerId: peer.id
      });
    } catch (err) {
      console.error("Failed to initiate call", err);
    }
  };

  const handleAcceptCall = async () => {
    if (!activeCall) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setLocalStream(stream);
      
      // Answer the PeerJS call if it has arrived
      if (currentCallRef.current) {
        const call = currentCallRef.current;
        call.answer(stream);
        call.on('stream', (remoteStream: MediaStream) => {
          setRemoteStream(remoteStream);
        });
        call.on('close', handleCleanupCall);
        call.on('error', handleCleanupCall);
      }
      
      await dbService.updateCallStatus(activeCall.id, 'accepted');
    } catch (err) {
      console.error("Failed to accept call", err);
      handleEndCall();
    }
  };

  const handleRejectCall = async () => {
    if (!activeCall) return;
    await dbService.updateCallStatus(activeCall.id, 'rejected');
    handleCleanupCall();
  };

  const handleEndCall = async () => {
    if (!activeCall) return;
    
    // If the caller cancels while ringing, it's a missed call for the receiver
    const newStatus = (activeCall.status === 'ringing' && activeCall.callerId === currentUser?.id) 
      ? 'missed' 
      : 'ended';
      
    await dbService.updateCallStatus(activeCall.id, newStatus);
    handleCleanupCall();
  };

  // 1.5 Real-time User Document Listener
  useEffect(() => {
    if (!currentUser?.id) return;
    
    const unsubscribe = onSnapshot(doc(db, "users", currentUser.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCurrentUser(prev => {
          if (!prev) return prev;
          // Only update if there's a change to avoid infinite loops
          const prevBlockedIds = prev.blockedIds?.join(',') || '';
          const newBlockedIds = data.blockedIds?.join(',') || '';
          
          if (prev.status !== data.status || prev.avatar !== data.avatar || prev.name !== data.name || prev.bio !== data.bio || prevBlockedIds !== newBlockedIds) {
             return { ...prev, ...data };
          }
          return prev;
        });
      }
    }, (error) => {
      console.error("Error listening to user document:", error);
    });

    return () => unsubscribe();
  }, [currentUser?.id]);

  const activeSessionIdRef = useRef(activeSessionId);
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  // 2. Real-time Chat List Listener
  useEffect(() => {
    if (!currentUser) return;

    // Load from localStorage first
    const cachedSessions = localStorage.getItem(`sessions_${currentUser.id}`);
    if (cachedSessions) {
      try {
        const parsedSessions = JSON.parse(cachedSessions, (key, value) => {
          if (key === 'timestamp' && typeof value === 'string') {
            return new Date(value);
          }
          return value;
        });
        setSessions(parsedSessions);
      } catch (e) {
        console.error("Error parsing cached sessions", e);
      }
    }

    const unsubscribe = dbService.subscribeToUserChats(currentUser.id, (updatedSessions) => {
      setSessions(prevSessions => {
        // If we receive new messages in any session, and the app is visible, 
        // but we are NOT actively looking at that session, mark them as 'ignored'
        if (document.visibilityState === 'visible') {
          updatedSessions.forEach(session => {
            if (session.id !== activeSessionIdRef.current && session.unreadCount?.[currentUser.id] > 0) {
              const prevSession = prevSessions.find(s => s.id === session.id);
              const prevUnread = prevSession?.unreadCount?.[currentUser.id] || 0;
              // Only mark as ignored if the unread count actually increased
              if (session.unreadCount[currentUser.id] > prevUnread) {
                dbService.markMessagesAsIgnored(session.id, currentUser.id);
              }
            }
          });
        }
        return updatedSessions;
      });
      
      // Save to localStorage
      localStorage.setItem(`sessions_${currentUser.id}`, JSON.stringify(updatedSessions, (key, value) => {
        if (key === 'timestamp' && value instanceof Date) {
          return value.toISOString();
        }
        return value;
      }));
    });
    return () => unsubscribe();
  }, [currentUser?.id]);

  // 3. Presence Management
  useEffect(() => {
    if (!currentUser) return;

    const explicitStatus = localStorage.getItem('explicitStatus') as 'online' | 'busy' | 'offline' | null;

    const updateStatus = (status: 'online' | 'busy' | 'offline') => {
      dbService.updateUserPresence(currentUser.id, status);
    };

    // Set status on mount based on explicit preference, default to online
    if (explicitStatus) {
       updateStatus(explicitStatus);
    } else {
       updateStatus('online');
    }

    // Periodically update lastSeen
    const interval = setInterval(() => {
      const currentExplicit = localStorage.getItem('explicitStatus') || 'online';
      if (currentExplicit !== 'offline') {
         dbService.updateUserPresence(currentUser.id, currentExplicit as any);
      }
    }, 60000); // Every minute

    const handleVisibilityChange = () => {
      const currentExplicit = localStorage.getItem('explicitStatus') || 'online';
      if (document.visibilityState === 'visible') {
        if (currentExplicit !== 'offline') {
           updateStatus(currentExplicit as any);
        }
      }
    };

    const handleBeforeUnload = () => {
      // Always set offline on unload to show they left the app
      dbService.updateUserPresence(currentUser.id, 'offline');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(interval);
    };
  }, [currentUser?.id]);

  const handleLogin = (user: User) => {
    // Handled by onAuthStateChanged
  };

  const handleLogout = async () => {
    if (currentUser) {
      try {
        await dbService.updateUserPresence(currentUser.id, 'offline');
      } catch (error) {
        console.error("Error updating presence on logout", error);
      }
    }
    localStorage.removeItem('explicitStatus');
    await authService.logout();
    
    // Synchronously clear all state to immediately show Auth screen and prevent any back-navigation glitches
    setCurrentUser(null);
    setActiveSessionId(null);
    setIsMobileChatOpen(false);
    setSessions([]);
    setCurrentView('chats');
    setViewingProfileUser(null);
    setActiveCall(null);
    
    // Optional: clear history state so that if they press back, it doesn't try to load a chat
    window.history.replaceState({ view: 'home' }, '');
  };

  const handleVerificationCheck = async (): Promise<boolean> => {
    if (auth.currentUser) {
      try {
        await auth.currentUser.reload(); 
        const refreshedUser = mapFirebaseUser(auth.currentUser);
        setCurrentUser(prev => prev ? { ...prev, emailVerified: refreshedUser.emailVerified } : null);
        return refreshedUser.emailVerified || false;
      } catch (e) {
        console.error("Verification check failed", e);
        return false;
      }
    }
    return false;
  };

  const activeSession = sessions.find(s => s.id === activeSessionId) || null;

  const handleSendMessage = async (sessionId: string, messageData: Partial<Message>) => {
    if (!currentUser) return;
    const session = sessions.find(s => s.id === sessionId);
    const receiver = session?.participants.find(p => p.id !== currentUser.id);
    const receiverId = receiver?.id || '';
    
    const messageToSend: any = {
      senderId: currentUser.id,
      content: messageData.content || '',
      type: messageData.type || 'text',
    };

    if (messageData.meta) {
      messageToSend.meta = messageData.meta;
    }
    if (messageData.replyToId) {
      messageToSend.replyToId = messageData.replyToId;
    }
    if (messageData.repliedMessage) {
      messageToSend.repliedMessage = messageData.repliedMessage;
    }

    try {
      await dbService.sendMessage(sessionId, messageToSend, receiverId);
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message. Please try again.");
    }
  };

  // 4. Mobile Navigation & History Management
  useEffect(() => {
    // Push a base state so the first back press doesn't close the app
    if (!window.history.state || window.history.state.view !== 'home') {
       window.history.replaceState({ view: 'home' }, '');
    }

    let backPressCount = 0;
    let backPressTimer: NodeJS.Timeout;

    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      
      // If user is not logged in, we must prevent them from navigating back into the app's history
      if (!auth.currentUser) {
        // If we are unwinding the stack from a previous logged-in session (e.g. they were in a chat)
        if (state && state.view && state.view !== 'home') {
          // Automatically go back again to skip this history entry
          window.history.back();
          return;
        }
        
        // If we reached the base state ('home') while logged out, show the exit warning
        backPressCount++;
        if (backPressCount === 1) {
          window.history.pushState({ view: 'home' }, '');
          setToastMessage("Press back again to exit");
          
          backPressTimer = setTimeout(() => {
            backPressCount = 0;
            setToastMessage(null);
          }, 2000);
        } else {
          setToastMessage(null);
          window.history.back();
        }
        return;
      }

      if (!state || state.view === 'home') {
        // No state means we are back at the start (inbox list on mobile)
        setIsMobileChatOpen(false);
        setActiveSessionId(null);
        setViewingProfileUser(null);
        
        // Prevent app exit on first back press from home
        backPressCount++;
        if (backPressCount === 1) {
          window.history.pushState({ view: 'home' }, '');
          setToastMessage("Press back again to exit");
          
          backPressTimer = setTimeout(() => {
            backPressCount = 0;
            setToastMessage(null);
          }, 2000);
        } else {
          // Allow exit
          setToastMessage(null);
          window.history.back();
        }
        return;
      }

      if (state.view === 'chat') {
        setActiveSessionId(state.id);
        setIsMobileChatOpen(true);
        setCurrentView('chats');
        setViewingProfileUser(null);
      } else if (state.view === 'discovery' || state.view === 'settings') {
        setActiveSessionId(null);
        setCurrentView(state.view);
        setIsMobileChatOpen(true);
        setViewingProfileUser(null);
      } else if (state.view === 'profile') {
        // If we were in a profile, going back should close it
        setViewingProfileUser(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      clearTimeout(backPressTimer);
    };
  }, []); // Remove isMobileChatOpen dependency to avoid loops

  const handleSessionSelect = (id: string) => {
    setActiveSessionId(id);
    setIsMobileChatOpen(true);
    setCurrentView('chats');
    // Push state so back button works on mobile
    if (window.innerWidth < 768) {
      window.history.pushState({ view: 'chat', id }, '');
    }
  };

  const handleViewChange = (view: 'chats' | 'discovery' | 'settings') => {
    // If we are on mobile and moving from a content view (discovery/settings/chat) back to chats (list)
    if (view === 'chats' && window.innerWidth < 768 && isMobileChatOpen) {
      window.history.back();
      return;
    }

    if (view === currentView && (window.innerWidth >= 768 || isMobileChatOpen)) return;

    setActiveSessionId(null);
    setCurrentView(view);
    
    // If we are switching to non-chat pages, we want to SHOW the content area on mobile
    if (view === 'discovery' || view === 'settings') {
      setIsMobileChatOpen(true); 
      if (window.innerWidth < 768) {
        window.history.pushState({ view }, '');
      }
    } else {
      setIsMobileChatOpen(false); // Go back to list
    }
  };

  const handleStartChat = async (targetUser: User) => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const chatId = await dbService.createChat(currentUser, targetUser);
      setActiveSessionId(chatId);
      setIsMobileChatOpen(true);
      setCurrentView('chats');
      if (window.innerWidth < 768) {
        window.history.pushState({ view: 'chat', id: chatId }, '');
      }
    } catch (error) {
      console.error("Error starting chat:", error);
      alert("Failed to establish link. Please check your signal strength.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateUser = (updatedUser: User) => {
    setCurrentUser(updatedUser);
  };

  const handleShowProfile = async (user: User) => {
    // If it's the current user, we already have the full profile
    if (user.id === currentUser?.id) {
      setViewingProfileUser(currentUser);
      if (window.innerWidth < 768) {
        window.history.pushState({ view: 'profile', id: currentUser.id }, '');
      }
      return;
    }

    // Fetch full user profile from Firestore to ensure we have all fields (bio, dob, etc.)
    const fullUser = await dbService.getUserById(user.id);
    const userToView = fullUser || user;
    setViewingProfileUser(userToView);
    
    if (window.innerWidth < 768) {
      window.history.pushState({ view: 'profile', id: userToView.id }, '');
    }
  };

  if (isLoading) {
     return <div className="h-[100dvh] bg-cyber-dark flex items-center justify-center text-cyan-400 animate-pulse">Initializing System...</div>;
  }

  if (!currentUser) {
    return <Auth onLogin={handleLogin} />;
  }

  if (!currentUser.emailVerified) {
    return <EmailVerification user={currentUser} onCheckVerification={handleVerificationCheck} />;
  }

  return (
    <div className="flex h-[100dvh] bg-cyber-dark text-white overflow-hidden">
      {/* Sidebar */}
      <div className={`${isMobileChatOpen ? 'hidden' : 'block'} md:block w-full md:w-auto h-full z-20`}>
         <Sidebar 
            currentUser={currentUser} 
            sessions={sessions} 
            activeSessionId={activeSessionId}
            onSelectSession={handleSessionSelect}
            onLogout={handleLogout}
            onViewChange={handleViewChange} 
            onShowProfile={handleShowProfile}
            currentView={currentView}
         />
      </div>

      {/* Main Content Area Logic */}
      <div className={`flex-1 h-full relative flex flex-col ${!isMobileChatOpen && 'hidden md:flex'}`}>
        <ErrorBoundary>
          {currentView === 'chats' && activeSessionId ? (
            <Suspense fallback={<div className="flex-1 flex items-center justify-center text-cyan-400">Loading Chat...</div>}>
              <ChatArea 
                session={activeSession} 
                currentUser={currentUser}
                onSendMessage={handleSendMessage}
                onShowProfile={handleShowProfile}
                onInitiateCall={handleInitiateCall}
                onBack={() => {
                   if (isMobileChatOpen && window.innerWidth < 768) {
                     window.history.back();
                   } else {
                     setIsMobileChatOpen(false);
                     setActiveSessionId(null); 
                   }
                }}
                isMobile={true}
              />
            </Suspense>
          ) : currentView === 'discovery' ? (
            <Suspense fallback={<div className="flex-1 flex items-center justify-center text-cyan-400">Loading Discovery...</div>}>
              <FriendDiscovery 
                onStartChat={handleStartChat} 
                onShowProfile={handleShowProfile}
                onBack={() => {
                  if (isMobileChatOpen && window.innerWidth < 768) {
                    window.history.back();
                  } else {
                    setIsMobileChatOpen(false);
                  }
                }} 
                sessions={sessions}
                currentUser={currentUser}
              />
            </Suspense>
          ) : currentView === 'settings' ? (
            <Suspense fallback={<div className="flex-1 flex items-center justify-center text-cyan-400">Loading Settings...</div>}>
              <Settings 
                currentUser={currentUser} 
                onUpdateUser={handleUpdateUser} 
                onBack={() => {
                  if (isMobileChatOpen && window.innerWidth < 768) {
                    window.history.back();
                  } else {
                    setIsMobileChatOpen(false);
                  }
                }}
              />
            </Suspense>
          ) : (
             <div className="flex-1 flex flex-col items-center justify-center bg-cyber-dark text-slate-500">
               <div className="w-24 h-24 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(6,182,212,0.1)]">
                  <span className="text-4xl">👋</span>
               </div>
               <p>Select a frequency or scan for new signals.</p>
             </div>
          )}
        </ErrorBoundary>
      </div>

      {/* Profile Modal */}
      {viewingProfileUser && (() => {
        const existingSession = sessions.find(s => 
          s.participants.some(p => p.id === viewingProfileUser.id)
        );
        
        let actionLabel = "Send Signal Request";
        let onAction: ((user: User) => void) | undefined = handleStartChat;
        let actionIcon = <Activity size={18} />;

        if (existingSession) {
          if (existingSession.status === 'accepted') {
            actionLabel = "Open Frequency";
            actionIcon = <Activity size={18} />;
          } else if (existingSession.status === 'pending') {
            if (existingSession.initiatedBy === currentUser.id) {
              actionLabel = "Request Pending";
              onAction = undefined; // Disable button
              actionIcon = <Activity size={18} className="animate-pulse" />;
            } else {
              actionLabel = "Accept Signal";
              onAction = async (user) => {
                try {
                  await dbService.acceptChatRequest(existingSession.id);
                  handleSessionSelect(existingSession.id);
                } catch (error) {
                  console.error("Error accepting request:", error);
                  alert("Failed to sync signal.");
                }
              };
              actionIcon = <Activity size={18} />;
            }
          }
        }

        return (
          <UserProfile 
            user={viewingProfileUser} 
            currentUser={currentUser}
            isCurrentUser={viewingProfileUser.id === currentUser.id}
            onAction={onAction}
            actionLabel={actionLabel}
            onClose={() => {
              if (window.innerWidth < 768 && window.history.state?.view === 'profile') {
                window.history.back();
              } else {
                setViewingProfileUser(null);
              }
            }} 
          />
        );
      })()}

      {/* Call Overlay */}
      {activeCall && (
        <CallOverlay
          call={activeCall}
          currentUser={currentUser}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
          onEnd={handleEndCall}
          localStream={localStream}
          remoteStream={remoteStream}
        />
      )}

      {/* Toast Message */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-4 py-2 rounded-full shadow-lg text-sm z-50 animate-fade-in">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

export default App;