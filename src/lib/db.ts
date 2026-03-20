// src/lib/db.ts
// This file is now a central export hub for the modular database layer.
// New code should preferably import from @/lib/db/moduleName, 
// but existing imports will continue to work through this file.

export * from './db/constants';
export * from './db/teachers';
export * from './db/settings';
export * from './db/exams';
export * from './db/students';
export * from './db/materials';
export * from './db/notifications';
export * from './db/assignments';
export * from './db/storage';
export * from './db/stats';
export * from './db/calendar';
export * from './db/admin';
export * from './db/messages';
