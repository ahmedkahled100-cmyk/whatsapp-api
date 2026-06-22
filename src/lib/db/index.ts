// src/lib/db/index.ts
export * from './constants';

export { 
  getTeachers, getSuperAdmin, getTeacherByUsername, getTeacherByCode, 
  getTeacherById, getTeacherByPhone, saveTeacher, updateSuperAdminCredentials, 
  deleteTeacher, subscribeToTeachers, subscribeToTeacherProfile 
} from './supabase/teachers';

export {
  getSettings,
  saveSettings,
  subscribeToSettings,
  getAllSettings
} from './supabase/settings';

export { 
  getExams, getPublishedExams, getExam, saveExam, deleteExam, 
  toggleExamPublish, subscribeToExams, getAttemptsByStudent, 
  getAttemptsByExam, getAllAttempts, saveAttempt, deleteAttempt, 
  subscribeToAttempts, getQBank, addToQBank, deleteFromQBank 
} from './supabase/exams';

export { 
  getStudents, getAllStudents, getStudentByCode, getStudentByParentPhone, 
  getEnrollmentsByParentPhone, getEnrollmentsByPhone, getStudentByPhoneAnywhere,
  getRegistrationRequestsByPhone, saveStudent, deleteStudent, 
  subscribeToStudents, subscribeToAllStudents, subscribeToStudent,
  subscribeToStudentByPhone, subscribeToRegistrationRequestByPhone,
  getGroups, saveGroup, deleteGroup, subscribeToGroups, getRegistrationRequests, 
  saveRegistrationRequest, deleteRegistrationRequest, subscribeToRegistrationRequests,
  getTopStudents
} from './supabase/students';

export { 
  getMaterials, saveMaterial, deleteMaterial, subscribeToMaterials 
} from './supabase/materials';

export { 
  addNotification, dispatchNotification, markNotificationRead, markNotificationsAsReadBulk,
  markAllNotificationsRead, subscribeToNotifications, saveNotificationLog, 
  getNotificationLogs, subscribeToNotificationLogs, updateNotificationLog 
} from './supabase/notifications';

export { 
  getAssignments, saveAssignment, deleteAssignment, subscribeToAssignments, 
  getAssignmentSubmissions, submitAssignment, gradeSubmission, 
  getStudentSubmissions, saveAssignmentSubmission 
} from './supabase/assignments';

export { uploadFileToStorage } from './storage';

export { getDashboardStats, getPlatformStats } from './supabase/stats';

export { getCalendarEvents, saveCalendarEvent, deleteCalendarEvent } from './supabase/calendar';

export { 
  sendMessage, subscribeToConversations, subscribeToMessages, 
  markMessagesAsRead, setUserOnlineStatus, subscribeToUserOnlineStatus,
  heartbeatUserOnlineStatus, setUserOfflineBeacon, loadOlderMessages,
  broadcastTyping, subscribeToTyping, deleteConversation,
  toggleConversationPin, toggleConversationArchive
} from './supabase/messages';

export { 
  saveGame, getGamesByTeacher, getGamesForStudent, saveGameResult, 
  getGameResultsByGame, getGameById, deleteGame, getGameResultsByTeacher
} from './supabase/games';

export { 
  getAppHomeSettings, updateAppHomeSettings, APP_HOME_SETTINGS_KEY, APP_HOME_DOC 
} from './app-settings';

export { wipeAllData, wipeStudentInteraction } from './admin';

export {
  getAttendanceSessions, createAttendanceSession, updateAttendanceSessionStatus,
  getAttendanceRecords, saveAttendanceRecord, getStudentAttendanceHistory,
  deleteAttendanceSession
} from './supabase/attendance';

export {
  getTransactions, saveTransaction, deleteTransaction
} from './supabase/finances';

export {
  getAssistants, saveAssistant, deleteAssistant,
  updateAssistantLinkStatus,
  saveAssistantLink, deleteAssistantLink, saveAssistantProfile,
  getAssistantProfileByCode, getAssistantProfileByUsername,
  getAllAssistantProfiles, getTeachersForAssistant,
  saveAssistantJob, getAssistantJobs, getJobsByTeacher, 
  saveJobApplication, getApplicationsForJob, getApplicationsForAssistant,
  deleteAssistantJob,
  updateApplicationStatus, updateAssistantProfile
} from './supabase/hr';
