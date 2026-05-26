'use client';
// src/components/MobileStudentPortalWrapper.tsx
// Wraps the student portal dashboard with the MobileAppLayout

import { useState, useEffect } from 'react';
import { MobileAppLayout } from './MobileAppLayout';
import { AppHome } from './AppHome';
import { getAppHomeSettings } from '@/lib/db/app-settings';
import type { AppHomeSettings, CategoryItem } from '@/lib/db/app-settings';
import type { Student, Notification, Conversation, Exam, CourseMaterial, Assignment } from '@/types';

type TabId = 'home' | 'courses' | 'exams' | 'assignments' | 'results' | 'messages' | 'settings' | 'profile' | 'discover' | 'link' | 'games' | 'schedule';

interface Props {
  student: Student;
  notifications: Notification[];
  conversations: Conversation[];
  exams: Exam[];
  materials: CourseMaterial[];
  assignments: Assignment[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  onNotifClick: () => void;
  onLogout: () => void;
  onAcademySwitch: () => void;
  hasMultipleAcademies: boolean;
  children: React.ReactNode;
}

export function MobileStudentPortalWrapper({
  student,
  notifications,
  conversations,
  exams,
  materials,
  assignments,
  activeTab,
  onTabChange,
  onNotifClick,
  onLogout,
  onAcademySwitch,
  hasMultipleAcademies,
  children,
}: Props) {
  const [appSettings, setAppSettings] = useState<AppHomeSettings | null>(null);

  useEffect(() => {
    getAppHomeSettings().then(setAppSettings);
  }, []);

  const unreadNotifCount = notifications.filter(n => !n.read).length;
  const unreadMsgCount = conversations.reduce((acc, c) =>
    acc + (c.lastMessage && !c.lastMessage.isRead && c.lastMessage.receiverId === student.id ? 1 : 0), 0
  );

  const handleCategoryClick = (cat: CategoryItem) => {
    if (cat.targetTab === 'link' && cat.link) {
      window.open(cat.link, '_blank');
    } else {
      onTabChange(cat.targetTab);
    }
  };

  const currentTab = activeTab as TabId;

  return (
    <MobileAppLayout
      studentName={student.name}
      studentImage={student.imageUrl}
      activeTab={currentTab === 'home' || !['courses','exams','assignments','results','messages','profile'].includes(currentTab) ? 'home' : currentTab as TabId}
      onTabChange={(tab) => {
        if (tab === 'home') onTabChange('home');
        else onTabChange(tab);
      }}
      notifCount={unreadNotifCount}
      msgCount={unreadMsgCount}
      onNotifClick={onNotifClick}
      onLogout={onLogout}
      onAcademySwitch={onAcademySwitch}
      hasMultipleAcademies={hasMultipleAcademies}
      appName={appSettings?.appName}
      student={student}
    >
      {/* Home Tab */}
      {(activeTab === 'home' || !['exams','courses','assignments','results','messages','profile','discover','games','schedule'].includes(activeTab)) && appSettings ? (
        <AppHome
          settings={appSettings}
          onCategoryClick={handleCategoryClick}
          examsCount={exams.length}
          assignmentsCount={assignments.length}
          studentName={student.name}
        />
      ) : (
        /* All other tabs – rendered by parent */
        <div className="px-4 py-4">{children}</div>
      )}
    </MobileAppLayout>
  );
}
