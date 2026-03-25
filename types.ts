
export type MessageType = 'text' | 'stealth' | 'scratch' | 'capsule' | 'lock' | 'nudge' | 'draw' | 'image' | 'voice' | 'system';

export interface User {
  id: string;
  name: string; // Used as Alias
  avatar: string;
  status: 'online' | 'busy' | 'offline';
  lastSeen?: number;
  isAi?: boolean;
  email?: string; 
  emailVerified?: boolean;
  bio?: string;
  gender?: 'male' | 'female' | 'other' | 'unspecified';
  dob?: string;
  blockedIds?: string[]; // Added: List of users blocked by this user
  fcmToken?: string; // Added for push notifications
}

export interface Message {
  id: string;
  senderId: string;
  content: string; 
  type: MessageType;
  timestamp: Date;
  status?: 'pushed' | 'ignored' | 'decrypted' | 'deleted';
  replyToId?: string;
  repliedMessage?: {
    content: string;
    senderId: string;
    type: MessageType;
  };
  reactions?: Record<string, string[]>; // emoji -> list of userIds
  deletedFor?: Record<string, boolean>; // userId -> true
  editedAt?: number; // Added for message editing
  meta?: {
    unlockTime?: Date;
    password?: string;
    isOpened?: boolean; 
  };
}

export interface ChatSession {
  id: string;
  participants: User[]; 
  messages: Message[];
  lastMessage?: Message;
  unreadCount?: Record<string, number>; // Map of userId to unread count
  status: 'pending' | 'accepted' | 'blocked'; // Added
  initiatedBy: string; // Added: User ID who started the chat
  typing?: Record<string, boolean>; // Added: Typing indicators
}

export interface Call {
  id: string;
  callerId: string;
  receiverId: string;
  type: 'audio' | 'video';
  status: 'ringing' | 'accepted' | 'rejected' | 'ended' | 'missed';
  timestamp: Date;
  peerId: string; // The PeerJS ID of the caller
}
