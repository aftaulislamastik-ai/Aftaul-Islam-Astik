import { User, ChatSession } from './types';

export const MOCK_USER: User = {
  id: 'u1',
  name: 'Neo_01',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop',
  status: 'online'
};

export const MOCK_SESSIONS: ChatSession[] = [
  {
    id: 's1',
    participants: [MOCK_USER, {
      id: 'ai_bot',
      name: 'Commune AI',
      avatar: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=150&h=150&fit=crop',
      status: 'online',
      isAi: true
    }],
    messages: [
      { id: 'm1', senderId: 'ai_bot', type: 'text', content: 'Welcome to Commune. I am your AI assistant. Try sending me a stealth message.', timestamp: new Date(Date.now() - 100000) }
    ],
    unreadCount: { [MOCK_USER.id]: 0, 'ai_bot': 0 },
    lastMessage: { id: 'm1', senderId: 'ai_bot', type: 'text', content: 'Welcome to Commune...', timestamp: new Date(Date.now() - 100000) },
    status: 'accepted',
    initiatedBy: 'u1'
  },
  {
    id: 's2',
    participants: [MOCK_USER, {
      id: 'u3',
      name: 'Cyber_Punk',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
      status: 'offline'
    }],
    messages: [
       { id: 'm2', senderId: 'u3', type: 'stealth', content: 'The coordinates are hidden here.', timestamp: new Date(Date.now() - 500000) },
       { id: 'm3', senderId: 'u3', type: 'scratch', content: 'SECRET_CODE_5521', timestamp: new Date(Date.now() - 400000) }
    ],
    unreadCount: { [MOCK_USER.id]: 2, 'u3': 0 },
    lastMessage: { id: 'm3', senderId: 'u3', type: 'scratch', content: 'SECRET_CODE...', timestamp: new Date(Date.now() - 400000) },
    status: 'accepted',
    initiatedBy: 'u3'
  }
];