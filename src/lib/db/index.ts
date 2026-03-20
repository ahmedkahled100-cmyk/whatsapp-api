// src/lib/db/index.ts
export * from './constants';
export * from './teachers';
export * from './settings';
export * from './exams';
export * from './students';
export * from './materials';
export * from './notifications';
export * from './assignments';
export * from './storage';
export * from './stats';
export * from './calendar';
export * from './admin';
export { 
  sendMessage, 
  subscribeToConversations, 
  subscribeToMessages, 
  markMessagesAsRead 
} from './messages';
export { getTeacherById, getSuperAdmin } from './teachers';
