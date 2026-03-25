import { USE_SUPABASE } from './db/constants';

import * as fbTeachers from './db/teachers';
import * as sbTeachers from './db/supabase/teachers';
export const {
  getTeachers, getSuperAdmin, getTeacherByUsername, getTeacherByCode, getTeacherById,
  saveTeacher, updateSuperAdminCredentials, deleteTeacher, subscribeToTeachers, subscribeToTeacherProfile,
  getTeacherByPhone
} = USE_SUPABASE ? sbTeachers : fbTeachers;

import * as fbSettings from './db/settings';
import * as sbSettings from './db/supabase/settings';
export const { getSettings, saveSettings } = USE_SUPABASE ? sbSettings : fbSettings;

import * as fbExams from './db/exams';
import * as sbExams from './db/supabase/exams';
export const {
  getExams, getPublishedExams, getExam, saveExam, deleteExam, toggleExamPublish, subscribeToExams,
  getAttemptsByStudent, getAttemptsByExam, getAllAttempts, saveAttempt, deleteAttempt, subscribeToAttempts,
  getQBank, addToQBank, deleteFromQBank
} = USE_SUPABASE ? sbExams : fbExams;

import * as fbStudents from './db/students';
import * as sbStudents from './db/supabase/students';
export const {
  getStudents, getAllStudents, getStudentByCode, getStudentByParentPhone, saveStudent, deleteStudent,
  subscribeToStudents, subscribeToAllStudents, getGroups, saveGroup, deleteGroup, subscribeToGroups,
  getRegistrationRequests, saveRegistrationRequest, deleteRegistrationRequest, subscribeToRegistrationRequests
} = USE_SUPABASE ? sbStudents : fbStudents;

import * as fbMaterials from './db/materials';
import * as sbMaterials from './db/supabase/materials';
export const { getMaterials, saveMaterial, deleteMaterial, subscribeToMaterials } = USE_SUPABASE ? sbMaterials : fbMaterials;

import * as fbNotifications from './db/notifications';
import * as sbNotifications from './db/supabase/notifications';
export const {
  addNotification, markAllNotificationsRead, subscribeToNotifications,
  saveNotificationLog, getNotificationLogs, subscribeToNotificationLogs, updateNotificationLog,
  dispatchNotification
} = USE_SUPABASE ? { ...sbNotifications, dispatchNotification: fbNotifications.dispatchNotification } : fbNotifications;

import * as fbAssignments from './db/assignments';
import * as sbAssignments from './db/supabase/assignments';
export const {
  getAssignments, saveAssignment, deleteAssignment, subscribeToAssignments,
  getAssignmentSubmissions, submitAssignment, gradeSubmission, getStudentSubmissions, saveAssignmentSubmission
} = USE_SUPABASE ? sbAssignments : fbAssignments;

import * as fbStats from './db/stats';
import * as sbStats from './db/supabase/stats';
export const { getDashboardStats, getPlatformStats } = USE_SUPABASE ? sbStats : fbStats;

import * as fbCalendar from './db/calendar';
import * as sbCalendar from './db/supabase/calendar';
export const { getCalendarEvents, saveCalendarEvent, deleteCalendarEvent, subscribeToCalendarEvents } = USE_SUPABASE ? sbCalendar : fbCalendar;

import * as fbMessages from './db/messages';
import * as sbMessages from './db/supabase/messages';

// Special Handling for common functions that might need orchestration
export const {
  sendMessage, subscribeToConversations, subscribeToMessages, markMessagesAsRead,
  setUserOnlineStatus, subscribeToUserOnlineStatus
} = USE_SUPABASE ? sbMessages : fbMessages;

export * from './db/constants';
export * from './db/storage';
export * from './db/admin';
export * from './db/app-settings';
