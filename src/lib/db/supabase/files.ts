// src/lib/db/supabase/files.ts
import { supabase } from '@/lib/supabase';
import { TEACHER_FILES, TEACHER_FOLDERS } from '../constants';
import { fromDB, toDB, manyFromDB } from './dbUtils';
import type { TeacherFile, FileFolder } from '@/types';

// Helper for local storage persistence fallback if tables aren't pre-created in Supabase
const LOCAL_FILES_KEY = 'an_academy_teacher_files_v1';
const LOCAL_FOLDERS_KEY = 'an_academy_teacher_folders_v1';

const getLocalFiles = (teacherId: string): TeacherFile[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_FILES_KEY}_${teacherId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalFiles = (teacherId: string, files: TeacherFile[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${LOCAL_FILES_KEY}_${teacherId}`, JSON.stringify(files));
  } catch (e) {
    console.error('Error saving local files:', e);
  }
};

const getLocalFolders = (teacherId: string): FileFolder[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_FOLDERS_KEY}_${teacherId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalFolders = (teacherId: string, folders: FileFolder[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${LOCAL_FOLDERS_KEY}_${teacherId}`, JSON.stringify(folders));
  } catch (e) {
    console.error('Error saving local folders:', e);
  }
};

export const getTeacherFiles = async (teacherId: string): Promise<TeacherFile[]> => {
  if (!teacherId || teacherId === 'unknown_teacher') return [];
  
  try {
    const { data, error } = await supabase
      .from(TEACHER_FILES)
      .select('*')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false });

    if (error) {
      return getLocalFiles(teacherId);
    }
    const dbFiles = manyFromDB<TeacherFile>(data || []);
    if (dbFiles.length === 0) {
      const local = getLocalFiles(teacherId);
      if (local.length > 0) return local;
    } else {
      saveLocalFiles(teacherId, dbFiles);
    }
    return dbFiles;
  } catch {
    return getLocalFiles(teacherId);
  }
};

export const getTeacherFolders = async (teacherId: string): Promise<FileFolder[]> => {
  if (!teacherId || teacherId === 'unknown_teacher') return [];

  try {
    const { data, error } = await supabase
      .from(TEACHER_FOLDERS)
      .select('*')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false });

    if (error) {
      return getLocalFolders(teacherId);
    }
    const dbFolders = manyFromDB<FileFolder>(data || []);
    if (dbFolders.length === 0) {
      const local = getLocalFolders(teacherId);
      if (local.length > 0) return local;
    } else {
      saveLocalFolders(teacherId, dbFolders);
    }
    return dbFolders;
  } catch {
    return getLocalFolders(teacherId);
  }
};

export const saveTeacherFile = async (fileData: Omit<TeacherFile, 'id' | 'createdAt'> & { id?: string; createdAt?: number }): Promise<TeacherFile> => {
  const teacherId = fileData.teacherId;
  const now = Date.now();
  const fileToSave: TeacherFile = {
    id: fileData.id || crypto.randomUUID(),
    teacherId: fileData.teacherId,
    name: fileData.name,
    url: fileData.url,
    fileType: fileData.fileType || 'other',
    fileSize: fileData.fileSize || 0,
    extension: fileData.extension || 'file',
    folderId: fileData.folderId || '',
    isShared: fileData.isShared ?? false,
    driveFileId: fileData.driveFileId,
    driveWebViewLink: fileData.driveWebViewLink,
    createdAt: fileData.createdAt || now,
    updatedAt: now
  };

  // Sync to local
  const currentLocal = getLocalFiles(teacherId);
  const existingIdx = currentLocal.findIndex(f => f.id === fileToSave.id);
  if (existingIdx >= 0) {
    currentLocal[existingIdx] = fileToSave;
  } else {
    currentLocal.unshift(fileToSave);
  }
  saveLocalFiles(teacherId, currentLocal);

  // Sync to Supabase
  try {
    const payload = toDB(fileToSave);
    await supabase.from(TEACHER_FILES).upsert(payload);
  } catch (err) {
    console.warn('Supabase upsert file silent warning:', err);
  }

  return fileToSave;
};

export const deleteTeacherFile = async (teacherId: string, fileId: string): Promise<boolean> => {
  const currentLocal = getLocalFiles(teacherId).filter(f => f.id !== fileId);
  saveLocalFiles(teacherId, currentLocal);

  try {
    await supabase.from(TEACHER_FILES).delete().eq('id', fileId).eq('teacher_id', teacherId);
  } catch (err) {
    console.warn('Supabase delete file silent warning:', err);
  }
  return true;
};

export const createTeacherFolder = async (folderData: Omit<FileFolder, 'id' | 'createdAt'> & { id?: string; createdAt?: number }): Promise<FileFolder> => {
  const teacherId = folderData.teacherId;
  const folderToSave: FileFolder = {
    id: folderData.id || crypto.randomUUID(),
    teacherId: folderData.teacherId,
    name: folderData.name,
    color: folderData.color || '#3b82f6',
    description: folderData.description || '',
    driveFolderId: folderData.driveFolderId,
    createdAt: folderData.createdAt || Date.now()
  };


  const currentFolders = getLocalFolders(teacherId);
  currentFolders.unshift(folderToSave);
  saveLocalFolders(teacherId, currentFolders);

  try {
    const payload = toDB(folderToSave);
    await supabase.from(TEACHER_FOLDERS).upsert(payload);
  } catch (err) {
    console.warn('Supabase upsert folder silent warning:', err);
  }

  return folderToSave;
};

export const deleteTeacherFolder = async (teacherId: string, folderId: string): Promise<boolean> => {
  const currentFolders = getLocalFolders(teacherId).filter(f => f.id !== folderId);
  saveLocalFolders(teacherId, currentFolders);

  // Delete all files in this folder from local storage
  const currentFiles = getLocalFiles(teacherId).filter(f => f.folderId !== folderId);
  saveLocalFiles(teacherId, currentFiles);

  try {
    await supabase.from(TEACHER_FOLDERS).delete().eq('id', folderId).eq('teacher_id', teacherId);
    await supabase.from(TEACHER_FILES).delete().eq('folder_id', folderId).eq('teacher_id', teacherId);
  } catch (err) {
    console.warn('Supabase delete folder warning:', err);
  }
  return true;
};


export const moveFilesToFolder = async (teacherId: string, fileIds: string[], folderId: string): Promise<void> => {
  const currentFiles = getLocalFiles(teacherId).map(f => fileIds.includes(f.id) ? { ...f, folderId } : f);
  saveLocalFiles(teacherId, currentFiles);

  try {
    await supabase.from(TEACHER_FILES).update({ folder_id: folderId }).in('id', fileIds).eq('teacher_id', teacherId);
  } catch (err) {
    console.warn('Supabase move files warning:', err);
  }
};

export const toggleFileShare = async (teacherId: string, fileId: string, isShared: boolean): Promise<void> => {
  const currentFiles = getLocalFiles(teacherId).map(f => f.id === fileId ? { ...f, isShared } : f);
  saveLocalFiles(teacherId, currentFiles);

  try {
    await supabase.from(TEACHER_FILES).update({ is_shared: isShared }).eq('id', fileId).eq('teacher_id', teacherId);
  } catch (err) {
    console.warn('Supabase toggle share warning:', err);
  }
};

export const subscribeToTeacherFiles = (teacherId: string, callback: (files: TeacherFile[]) => void) => {
  if (!teacherId || teacherId === 'unknown_teacher') {
    callback([]);
    return () => {};
  }

  const fetchAndNotify = async () => {
    const files = await getTeacherFiles(teacherId);
    callback(files);
  };

  fetchAndNotify();

  try {
    const channel = supabase
      .channel(`teacher_files:${teacherId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: TEACHER_FILES, filter: `teacher_id=eq.${teacherId}` }, fetchAndNotify)
      .subscribe();
    return () => supabase.removeChannel(channel);
  } catch {
    return () => {};
  }
};
