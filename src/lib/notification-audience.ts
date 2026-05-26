// Filters in-app notifications by audience (teacher / admin / student) to avoid
// cross-leaking and unnecessary client work.

import type { Notification } from '@/types';

const JOIN_MSG_MARKERS = ['طلب انضمام', 'تسجيل معلم'];

export function isAdminDirectedNotification(n: Notification): boolean {
  if (n.targetRoles?.includes('super_admin')) return true;
  if (n.targetRoles?.includes('admin')) return true; // Legacy support
  const m = (n.msg || '').toLowerCase();
  // Teacher registration belongs to Super Admin
  return m.includes('تسجيل معلم');
}

/** إشعارات لوحة المعلم: بدون ما يخص الإدارة فقط */
/** إشعارات لوحة المعلم: تشمل ما هو موجه له أو للطلاب عموماً */
export function filterNotificationsForTeacherInbox(notifs: Notification[]): Notification[] {
  return notifs.filter((n) => {
    // If specifically for super_admin, hide from teacher
    if (n.targetRoles?.includes('super_admin')) return false;
    if (n.targetRoles?.includes('assistant') && !n.targetRoles?.includes('teacher')) return false; // Hidden from teacher if explicitly only for assistants
    if (n.targetRoles?.includes('student') && !n.targetRoles?.includes('teacher')) return false; // Hide explicit student only messages
    
    // If specifically for teacher role, show
    if (n.targetRoles?.includes('teacher')) return true;

    // Default: side with not being an admin-only message, unless it explicitly has targets that do not match the teacher role
    return !isAdminDirectedNotification(n) && (!n.targetRoles || n.targetRoles.length === 0);
  });
}

/** إشعارات لوحة السوبر أدمن: طلبات انضمام وتنبيهات موجّهة للإدارة فقط */
export function filterNotificationsForAdminInbox(notifs: Notification[]): Notification[] {
  return notifs.filter((n) => isAdminDirectedNotification(n));
}

/** إشعارات الطالب ضمن أكاديمية معلّمه */
export function filterNotificationsForStudent(notifs: Notification[], student: { id: string, groupIds?: string[] }): Notification[] {
  return notifs.filter((n) => {
    if (isAdminDirectedNotification(n)) return false;
    const targets = n.targetUsers;
    const roles = n.targetRoles;
    const groups = n.targetGroups;
    
    const forStudentRole = roles?.includes('student');
    const forMyGroup = groups && groups.length > 0 && student.groupIds?.some(id => groups.includes(id));
    const forMeDirectly = targets && targets.length > 0 && targets.includes(student.id);
    const forAllStudents = (!targets || targets.length === 0) && (!groups || groups.length === 0) && forStudentRole;

    return forMeDirectly || forMyGroup || forAllStudents;
  });
}

/** إشعارات لوحة المساعد: تشمل الموجهة له بشكل صريح */
export function filterNotificationsForAssistant(notifs: Notification[], assistant: { id: string }): Notification[] {
  return notifs.filter((n) => {
    if (isAdminDirectedNotification(n)) return false;
    const targets = n.targetUsers;
    const roles = n.targetRoles;

    const forAssistantRole = roles?.includes('assistant');
    const forMeDirectly = targets && targets.length > 0 && targets.includes(assistant.id);
    const forAllAssistants = (!targets || targets.length === 0) && forAssistantRole;

    return forMeDirectly || forAllAssistants;
  });
}
