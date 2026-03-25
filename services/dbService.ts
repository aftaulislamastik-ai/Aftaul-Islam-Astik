import { 
  doc, updateDoc, collection, getDocs, query, limit, setDoc, 
  where, onSnapshot, addDoc, orderBy, serverTimestamp, getDoc, Timestamp, arrayUnion, deleteDoc,
  increment, writeBatch, arrayRemove, getDocFromServer
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { User, Message, ChatSession, Call } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();

export const dbService = {
  // --- PRESENCE & TYPING ---
  updateUserPresence: async (userId: string, status: 'online' | 'busy' | 'offline') => {
    try {
      const userRef = doc(db, "users", userId);
      const profileRef = doc(db, "profiles", userId);
      
      // Use setDoc with merge: true instead of updateDoc to handle cases where 
      // the document might not exist yet (e.g. race condition or deleted profile)
      try {
        await setDoc(userRef, {
          status,
          lastSeen: Date.now()
        }, { merge: true });
      } catch (e: any) {
        if (e.code === 'permission-denied') {
          handleFirestoreError(e, OperationType.UPDATE, `users/${userId}`);
        } else {
          console.warn("User presence update failed:", e.message);
        }
      }

      try {
        await setDoc(profileRef, {
          status
        }, { merge: true });
      } catch (e: any) {
        if (e.code === 'permission-denied') {
          handleFirestoreError(e, OperationType.UPDATE, `profiles/${userId}`);
        } else {
          console.warn("Profile presence update failed:", e.message);
        }
      }
    } catch (error: any) {
      console.error("Error updating presence:", error);
    }
  },

  updateTypingStatus: async (chatId: string, userId: string, isTyping: boolean) => {
    const path = `chats/${chatId}`;
    try {
      const chatRef = doc(db, "chats", chatId);
      await updateDoc(chatRef, {
        [`typing.${userId}`]: isTyping
      });
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
      console.error("Error updating typing status:", error);
    }
  },

  // --- USER MANAGEMENT ---

  updateProfile: async (userId: string, data: Partial<User>) => {
    try {
      const userRef = doc(db, "users", userId);
      const profileRef = doc(db, "profiles", userId);
      
      // Filter data for public profile
      const publicFields = ['name', 'avatar', 'status', 'bio', 'isAi'];
      const profileData: any = {};
      publicFields.forEach(field => {
        if ((data as any)[field] !== undefined) {
          profileData[field] = (data as any)[field];
        }
      });
      
      // Use setDoc with merge: true to ensure the document is created if it doesn't exist
      await setDoc(userRef, data, { merge: true });
      if (Object.keys(profileData).length > 0) {
        await setDoc(profileRef, profileData, { merge: true });
      }
      
      return { success: true, message: "Profile updated successfully." };
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.UPDATE, `users/${userId} or profiles/${userId}`);
      }
      console.error("Profile Update Error:", error);
      return { success: false, message: "Failed to update profile. " + (error.message || "") };
    }
  },

  getAllUsers: async (): Promise<User[]> => {
    const path = "profiles";
    try {
      const profilesRef = collection(db, "profiles");
      const q = query(profilesRef, orderBy("name"), limit(200));
      const querySnapshot = await getDocs(q);
      
      const users: User[] = [];
      querySnapshot.forEach((doc) => {
        const profileData = doc.data() as User;
        const userId = profileData.id || doc.id;
        if (auth.currentUser?.uid !== userId) {
          users.push({ ...profileData, id: userId });
        }
      });
      return users;
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.LIST, path);
      }
      console.error("Error fetching users:", error);
      // Fallback: try without orderBy in case index is missing
      try {
        const qFallback = query(collection(db, "profiles"), limit(200));
        const querySnapshot = await getDocs(qFallback);
        const users: User[] = [];
        querySnapshot.forEach((doc) => {
          const profileData = doc.data() as User;
          const userId = profileData.id || doc.id;
          if (auth.currentUser?.uid !== userId) {
            users.push({ ...profileData, id: userId });
          }
        });
        return users;
      } catch (e) {
        return [];
      }
    }
  },

  getUserById: async (userId: string): Promise<User | null> => {
    const path = `profiles/${userId}`;
    try {
      const profileRef = doc(db, "profiles", userId);
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        return { ...profileSnap.data(), id: profileSnap.id } as User;
      }
      return null;
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.GET, path);
      }
      console.error("Error fetching user by ID:", error);
      return null;
    }
  },

  toggleBlockUser: async (currentUserId: string, targetUserId: string, isBlocking: boolean) => {
     const path = `users/${currentUserId}`;
     try {
       const userRef = doc(db, "users", currentUserId);
       if (isBlocking) {
          await updateDoc(userRef, {
             blockedIds: arrayUnion(targetUserId)
          });
       } else {
          await updateDoc(userRef, {
             blockedIds: arrayRemove(targetUserId)
          });
       }
       return true;
     } catch (e: any) {
       if (e.code === 'permission-denied') {
         handleFirestoreError(e, OperationType.UPDATE, path);
       }
       console.error("Block error", e);
       return false;
     }
  },

  // --- CALL MANAGEMENT ---
  initiateCall: async (callerId: string, receiverId: string, type: 'audio' | 'video', peerId: string): Promise<string> => {
    const callId = `${callerId}_${receiverId}_${Date.now()}`;
    const callRef = doc(db, "calls", callId);
    const path = `calls/${callId}`;

    try {
      await setDoc(callRef, {
        id: callId,
        callerId,
        receiverId,
        type,
        status: 'ringing',
        timestamp: serverTimestamp(),
        peerId
      });
      return callId;
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
      throw error;
    }
  },

  updateCallStatus: async (callId: string, status: Call['status']) => {
    const path = `calls/${callId}`;
    try {
      const callRef = doc(db, "calls", callId);
      await updateDoc(callRef, { status });
      
      // If the call is ending, rejecting, or missed, log it as a message
      if (['ended', 'rejected', 'missed'].includes(status)) {
        const callSnap = await getDoc(callRef);
        if (callSnap.exists()) {
          const callData = callSnap.data() as Call;
          await dbService.logCallAsMessage(callData);
        }
      }
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
      console.error("Error updating call status:", error);
    }
  },

  logCallAsMessage: async (call: Call) => {
    const sortedIds = [call.callerId, call.receiverId].sort();
    const chatId = `${sortedIds[0]}_${sortedIds[1]}`;
    
    let content = "";
    switch (call.status) {
      case 'ended':
        content = `Call ended`;
        break;
      case 'rejected':
        content = `Call declined`;
        break;
      case 'missed':
        content = `Missed call`;
        break;
      default:
        return;
    }

    const message: Partial<Message> = {
      senderId: 'system',
      content: `${call.type === 'video' ? 'Video' : 'Voice'} ${content}`,
      type: 'system',
      timestamp: new Date()
    };

    try {
      await dbService.sendMessage(chatId, message, call.receiverId === 'system' ? call.callerId : call.receiverId);
    } catch (e) {
      console.error("Failed to log call as message", e);
    }
  },

  subscribeToIncomingCalls: (userId: string, callback: (call: Call | null) => void) => {
    const callsRef = collection(db, "calls");
    const q = query(
      callsRef, 
      where("receiverId", "==", userId),
      where("status", "==", "ringing"),
      orderBy("timestamp", "desc"),
      limit(1)
    );

    return onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        callback({
          ...data,
          id: snapshot.docs[0].id,
          timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date()
        } as Call);
      } else {
        callback(null);
      }
    }, (error: any) => {
       if (error.code === 'permission-denied') {
         handleFirestoreError(error, OperationType.LIST, "calls");
       }
       console.error("Call Subscription Error:", error);
    });
  },

  subscribeToCallStatus: (callId: string, callback: (status: Call['status']) => void) => {
    const callRef = doc(db, "calls", callId);
    return onSnapshot(callRef, (doc) => {
      if (doc.exists()) {
        callback(doc.data().status);
      }
    });
  },

  // --- CHAT MANAGEMENT ---

  createChat: async (currentUser: User, targetUser: User): Promise<string> => {
    const sortedIds = [currentUser.id, targetUser.id].sort();
    const chatId = `${sortedIds[0]}_${sortedIds[1]}`;
    const chatRef = doc(db, "chats", chatId);
    const path = `chats/${chatId}`;

    try {
      let chatSnap;
      try {
        chatSnap = await getDoc(chatRef);
      } catch (e: any) {
        if (e.code === 'permission-denied') {
          handleFirestoreError(e, OperationType.GET, path);
        }
        throw e;
      }

      if (!chatSnap.exists()) {
        try {
          await setDoc(chatRef, {
            id: chatId,
            participantIds: [currentUser.id, targetUser.id],
            participantsData: {
              [currentUser.id]: { name: currentUser.name, avatar: currentUser.avatar, id: currentUser.id, isAi: !!currentUser.isAi },
              [targetUser.id]: { name: targetUser.name, avatar: targetUser.avatar, id: targetUser.id, isAi: !!targetUser.isAi }
            },
            createdAt: serverTimestamp(),
            lastMessage: null,
            updatedAt: serverTimestamp(),
            status: 'pending', // Default status
            initiatedBy: currentUser.id, // Who started it
            unreadCount: {
              [currentUser.id]: 0,
              [targetUser.id]: 0
            }
          });
        } catch (e: any) {
          if (e.code === 'permission-denied') {
            handleFirestoreError(e, OperationType.CREATE, path);
          }
          throw e;
        }
      }
      return chatId;
    } catch (error: any) {
      console.error("Error in createChat:", error);
      throw error;
    }
  },

  acceptChatRequest: async (chatId: string) => {
    const path = `chats/${chatId}`;
    try {
      const chatRef = doc(db, "chats", chatId);
      await updateDoc(chatRef, { status: 'accepted' });
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
      throw error;
    }
  },

  deleteChat: async (chatId: string) => {
    const path = `chats/${chatId}`;
    try {
      const chatRef = doc(db, "chats", chatId);
      await deleteDoc(chatRef);
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
      throw error;
    }
  },

  sendMessage: async (chatId: string, message: Partial<Message>, receiverId: string) => {
    const messagesPath = `chats/${chatId}/messages`;
    const chatPath = `chats/${chatId}`;
    try {
      const messagesRef = collection(db, "chats", chatId, "messages");
      
      const cleanMessage: any = {};
      Object.keys(message).forEach(key => {
        if ((message as any)[key] !== undefined) {
          cleanMessage[key] = (message as any)[key];
        }
      });

      const newMessage = {
        ...cleanMessage,
        status: 'pushed',
        timestamp: serverTimestamp(),
      };
      
      try {
        const docRef = await addDoc(messagesRef, newMessage);
        // If it's a reply, we might want to store the ID
        // But it's already in cleanMessage if passed
      } catch (e: any) {
        if (e.code === 'permission-denied') {
          handleFirestoreError(e, OperationType.CREATE, messagesPath);
        }
        throw e;
      }

      const chatRef = doc(db, "chats", chatId);
      try {
        const updateData: any = {
          lastMessage: { ...newMessage, timestamp: new Date() },
          updatedAt: serverTimestamp(),
        };
        
        // Don't increment unread count for system messages
        if (message.type !== 'system' && receiverId) {
          updateData[`unreadCount.${receiverId}`] = increment(1);
        }

        await updateDoc(chatRef, updateData);
      } catch (e: any) {
        if (e.code === 'permission-denied') {
          handleFirestoreError(e, OperationType.UPDATE, chatPath);
        }
        throw e;
      }
    } catch (error: any) {
      console.error("Error sending message:", error);
      throw error;
    }
  },

  deleteMessage: async (chatId: string, messageId: string, forEveryone: boolean = false) => {
    const path = `chats/${chatId}/messages/${messageId}`;
    try {
      const messageRef = doc(db, "chats", chatId, "messages", messageId);
      
      if (forEveryone) {
        // Instead of deleting, mark as deleted and clear content
        await updateDoc(messageRef, {
          status: 'deleted',
          content: 'This signal was redacted',
          type: 'text',
          editedAt: Date.now()
        });
        
        // Update the chat's lastMessage to reflect the deletion
        const chatRef = doc(db, "chats", chatId);
        const chatSnap = await getDoc(chatRef);
        if (chatSnap.exists()) {
          const chatData = chatSnap.data();
          if (chatData.lastMessage?.id === messageId) {
             await updateDoc(chatRef, {
               "lastMessage.status": 'deleted',
               "lastMessage.content": 'This signal was redacted',
               "lastMessage.type": 'text'
             });
          }
        }
      } else {
        // Delete for me: mark as deleted only for the current user
        await updateDoc(messageRef, {
          [`deletedFor.${auth.currentUser?.uid}`]: true
        });
      }
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
      throw error;
    }
  },

  editMessage: async (chatId: string, messageId: string, newContent: string) => {
    const path = `chats/${chatId}/messages/${messageId}`;
    try {
      const messageRef = doc(db, "chats", chatId, "messages", messageId);
      await updateDoc(messageRef, {
        content: newContent,
        editedAt: Date.now()
      });
      
      // Also update lastMessage in the chat if this was the last message
      const chatRef = doc(db, "chats", chatId);
      const chatSnap = await getDoc(chatRef);
      if (chatSnap.exists()) {
        const chatData = chatSnap.data();
        if (chatData.lastMessage?.id === messageId) {
          await updateDoc(chatRef, {
            "lastMessage.content": newContent,
            "lastMessage.editedAt": Date.now()
          });
        }
      }
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      throw error;
    }
  },

  updateFcmToken: async (userId: string, token: string | null) => {
    const userRef = doc(db, "users", userId);
    try {
      await updateDoc(userRef, {
        fcmToken: token
      });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
      throw error;
    }
  },

  addReaction: async (chatId: string, messageId: string, userId: string, emoji: string) => {
    const path = `chats/${chatId}/messages/${messageId}`;
    try {
      const messageRef = doc(db, "chats", chatId, "messages", messageId);
      // Use dot notation to update nested field in map
      await updateDoc(messageRef, {
        [`reactions.${emoji}`]: arrayUnion(userId)
      });
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
      throw error;
    }
  },

  removeReaction: async (chatId: string, messageId: string, userId: string, emoji: string) => {
    const path = `chats/${chatId}/messages/${messageId}`;
    try {
      const messageRef = doc(db, "chats", chatId, "messages", messageId);
      // Use dot notation to update nested field in map
      await updateDoc(messageRef, {
        [`reactions.${emoji}`]: arrayRemove(userId)
      });
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
      throw error;
    }
  },

  markMessagesAsRead: async (chatId: string, userId: string) => {
    const path = `chats/${chatId}`;
    try {
      const chatRef = doc(db, "chats", chatId);
      await updateDoc(chatRef, {
        [`unreadCount.${userId}`]: 0
      });

      const messagesRef = collection(db, "chats", chatId, "messages");
      const q = query(
        messagesRef, 
        where("status", "in", ["pushed", "ignored"])
      );
      
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      snapshot.docs.forEach((doc) => {
        if (doc.data().senderId !== userId) {
          batch.update(doc.ref, { status: 'decrypted' });
        }
      });
      
      if (!snapshot.empty) {
        await batch.commit();
      }
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
      console.error("Error marking messages as read:", error);
    }
  },

  markMessagesAsIgnored: async (chatId: string, userId: string) => {
    const path = `chats/${chatId}/messages`;
    try {
      const messagesRef = collection(db, "chats", chatId, "messages");
      const q = query(
        messagesRef, 
        where("status", "==", "pushed")
      );
      
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      snapshot.docs.forEach((doc) => {
        if (doc.data().senderId !== userId) {
          batch.update(doc.ref, { status: 'ignored' });
        }
      });
      
      if (!snapshot.empty) {
        await batch.commit();
      }
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
      console.error("Error marking messages as ignored:", error);
    }
  },

  subscribeToUserChats: (userId: string, callback: (sessions: ChatSession[]) => void) => {
    const chatsRef = collection(db, "chats");
    const q = query(
      chatsRef, 
      where("participantIds", "array-contains", userId)
    );

    return onSnapshot(q, (snapshot) => {
      const sessions: ChatSession[] = snapshot.docs.map(doc => {
        const data = doc.data();
        const participants: User[] = Object.values(data.participantsData || {});
        
        let lastMsg = data.lastMessage;
        if (lastMsg && lastMsg.timestamp instanceof Timestamp) {
           lastMsg.timestamp = lastMsg.timestamp.toDate();
        } else if (lastMsg && lastMsg.timestamp && !(lastMsg.timestamp instanceof Date)) {
           lastMsg.timestamp = new Date(lastMsg.timestamp);
        }

        return {
          id: doc.id,
          participants: participants,
          messages: [], 
          lastMessage: lastMsg,
          unreadCount: data.unreadCount || {},
          status: data.status || 'accepted',
          initiatedBy: data.initiatedBy || '',
          typing: data.typing || {}
        };
      });
      
      sessions.sort((a, b) => {
        const tA = a.lastMessage?.timestamp?.getTime() || 0;
        const tB = b.lastMessage?.timestamp?.getTime() || 0;
        return tB - tA;
      });
      
      callback(sessions);
    }, (error: any) => {
       if (error.code === 'permission-denied') {
         handleFirestoreError(error, OperationType.LIST, "chats");
       }
       console.error("Chat Subscription Error:", error);
    });
  },

  subscribeToChatMessages: (chatId: string, limitCount: number, callback: (messages: Message[]) => void) => {
    const path = `chats/${chatId}/messages`;
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "desc"), limit(limitCount));

    return onSnapshot(q, (snapshot) => {
      const currentUserId = auth.currentUser?.uid;
      const messages: Message[] = snapshot.docs
        .map(doc => {
          const data = doc.data();
          
          // Skip messages deleted for the current user
          if (currentUserId && data.deletedFor?.[currentUserId]) {
            return null;
          }

          let meta = data.meta;
        if (meta && typeof meta === 'object') {
          Object.keys(meta).forEach(key => {
            if (meta[key] instanceof Timestamp) {
              meta[key] = meta[key].toDate();
            }
          });
        }

        return {
          id: doc.id,
          senderId: data.senderId,
          content: data.content,
          type: data.type,
          status: data.status,
          meta: meta,
          timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date()
        } as Message;
      })
      .filter((m): m is Message => m !== null)
      .reverse();
      callback(messages);
    }, (error: any) => {
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.LIST, path);
      }
      console.error("Message Subscription Error:", error);
    });
  },

  deleteUserAccount: async (userId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const userRef = doc(db, "users", userId);
      const profileRef = doc(db, "profiles", userId);
      
      console.log(`Initiating full identity purge for: ${userId}`);
      
      // 1. Find and delete all chats this user is part of
      const chatsRef = collection(db, "chats");
      const q = query(chatsRef, where("participantIds", "array-contains", userId));
      const chatSnaps = await getDocs(q);
      
      const deleteChatPromises = chatSnaps.docs.map(chatDoc => deleteDoc(chatDoc.ref));
      await Promise.all(deleteChatPromises);
      console.log(`Purged ${chatSnaps.size} chat sessions.`);

      // 2. Delete private and public profile
      try {
        await deleteDoc(userRef);
      } catch (e: any) {
        if (e.code === 'permission-denied') {
          handleFirestoreError(e, OperationType.DELETE, `users/${userId}`);
        }
        throw e;
      }

      try {
        await deleteDoc(profileRef);
      } catch (e: any) {
        if (e.code === 'permission-denied') {
          handleFirestoreError(e, OperationType.DELETE, `profiles/${userId}`);
        }
        throw e;
      }
      
      return { success: true, message: "Identity and all neural data purged from network." };
    } catch (error: any) {
      console.error("Delete User Data Error:", error);
      return { success: false, message: "Failed to purge identity. " + (error.message || "") };
    }
  }
};
