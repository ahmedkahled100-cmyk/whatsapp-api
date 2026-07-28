'use client';

// src/app/teacher/files/page.tsx
// مدير الملفات الاحترافي للمعلمين - AN-Academy File Manager

import React, { useState, useEffect, useMemo } from 'react';
import { useTeacherStore } from '@/lib/store';
import { 
  getTeacherFiles, getTeacherFolders, saveTeacherFile, deleteTeacherFile,
  createTeacherFolder, deleteTeacherFolder, moveFilesToFolder, toggleFileShare,
  uploadFileToStorage
} from '@/lib/db';
import { 
  getTeacherDriveConfig, saveTeacherDriveConfig, disconnectTeacherDrive, 
  ensureAnAcademyFolder, uploadFileToGoogleDrive, fetchGoogleDriveQuota, 
  deleteFileFromGoogleDrive, renameGoogleDriveFile, createGoogleDriveFolder, 
  moveGoogleDriveFile, GoogleDriveConfig, GoogleDriveQuota 
} from '@/lib/google-drive';

import type { TeacherFile, FileFolder } from '@/types';
import { 
  Cloud, UploadCloud, Folder, FolderPlus, Search, RefreshCw, 
  Eye, Download, FolderInput, Share2, Edit3, Trash2, Link as LinkIcon, 
  CheckSquare, Square, PieChart, HardDrive, FileText, Image as ImageIcon, 
  Video, Music, Archive, File, X, Plus, ExternalLink, Globe, Sparkles, Check,
  ChevronRight, Info, Copy, CheckCircle2, AlertCircle, ShieldCheck
} from 'lucide-react';

const STORAGE_QUOTA_MB = 500; // 500 MB default quota per teacher

export default function TeacherFileManagerPage() {
  const user = useTeacherStore((state) => state.user);
  const activeTeacherId = useTeacherStore((state) => state.activeTeacherId);
  const teacherId = activeTeacherId || user?.id || 'unknown_teacher';
  const teacherName = user?.name || 'المعلم';

  // State
  const [files, setFiles] = useState<TeacherFile[]>([]);
  const [folders, setFolders] = useState<FileFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Google Drive Connection & Quota State
  const [driveConfig, setDriveConfig] = useState<GoogleDriveConfig>({ isConnected: false, folderName: 'AN-Academy' });
  const [driveQuota, setDriveQuota] = useState<GoogleDriveQuota | null>(null);
  const [driveInputToken, setDriveInputToken] = useState('');
  const [driveInputEmail, setDriveInputEmail] = useState('');
  const [connectingDrive, setConnectingDrive] = useState(false);

  // Active Tab: 'my_files' | 'shared' | 'analytics' | 'drive'
  const [activeTab, setActiveTab] = useState<'my_files' | 'shared' | 'analytics' | 'drive'>('my_files');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFileType, setSelectedFileType] = useState<string>('all');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all'); // 'all', 'none', or folderId
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'largest' | 'smallest' | 'alphabetical'>('newest');

  // Selection
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [previewFile, setPreviewFile] = useState<TeacherFile | null>(null);
  const [renameFileTarget, setRenameFileTarget] = useState<TeacherFile | null>(null);
  const [newFileName, setNewFileName] = useState('');

  // Upload state
  const [uploadingFiles, setUploadingFiles] = useState<{ file: File; progress: number; status: string }[]>([]);
  const [uploadTargetFolder, setUploadTargetFolder] = useState<string>('');

  // New folder state
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#F5C518');
  const [newFolderDesc, setNewFolderDesc] = useState('');

  // Inline folder creation inside Upload Modal
  const [showInlineFolderForm, setShowInlineFolderForm] = useState(false);
  const [inlineFolderName, setInlineFolderName] = useState('');
  const [creatingInlineFolder, setCreatingInlineFolder] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Inline Folder Creation from inside Upload Modal
  const handleCreateInlineFolder = async () => {
    if (!inlineFolderName.trim()) return;
    setCreatingInlineFolder(true);
    try {
      let driveFolderId: string | undefined = undefined;

      // Sync folder creation to Google Drive inside AN-Academy folder
      if (driveConfig.isConnected && driveConfig.accessToken && driveConfig.folderId) {
        try {
          driveFolderId = await createGoogleDriveFolder(
            driveConfig.accessToken,
            inlineFolderName.trim(),
            driveConfig.folderId
          );
        } catch (gErr) {
          console.warn('Google Drive inline folder create warning:', gErr);
        }
      }

      const createdFolder = await createTeacherFolder({
        teacherId,
        name: inlineFolderName.trim(),
        color: '#F5C518',
        driveFolderId
      });

      setFolders((prev) => [createdFolder, ...prev]);
      setUploadTargetFolder(createdFolder.id); // Automatically select newly created folder!
      setInlineFolderName('');
      setShowInlineFolderForm(false);
      showToast(`تم إنشاء المجلد "${createdFolder.name}" واختياره للرفع تلقائياً! 📁✨`);
    } catch (err) {
      console.error('Error creating inline folder:', err);
    } finally {
      setCreatingInlineFolder(false);
    }
  };


  // Load Data & Real Google Drive Quota
  const fetchData = async () => {
    setRefreshing(true);
    try {
      const [fetchedFiles, fetchedFolders] = await Promise.all([
        getTeacherFiles(teacherId),
        getTeacherFolders(teacherId)
      ]);
      setFiles(fetchedFiles);
      setFolders(fetchedFolders);

      // Load Drive Config & Real Quota
      const dConf = getTeacherDriveConfig(teacherId);
      setDriveConfig(dConf);

      if (dConf.isConnected && dConf.accessToken) {
        try {
          const quota = await fetchGoogleDriveQuota(dConf.accessToken);
          setDriveQuota(quota);
        } catch (gErr) {
          console.warn('Could not fetch Google Drive quota:', gErr);
        }
      }
    } catch (err) {
      console.error('Error loading files:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };


  useEffect(() => {
    if (teacherId) {
      fetchData();
    }
  }, [teacherId]);

  // Total space used in Bytes and MB
  const totalSizeBytes = useMemo(() => {
    return files.reduce((acc, f) => acc + (f.fileSize || 0), 0);
  }, [files]);

  const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(2);
  const usedPercentage = Math.min(100, Math.round((parseFloat(totalSizeMB) / STORAGE_QUOTA_MB) * 100));

  // Filtered Files
  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      // Tab check
      if (activeTab === 'shared' && !file.isShared) return false;

      // Folder filter
      if (selectedFolderId === 'none' && file.folderId) return false;
      if (selectedFolderId !== 'all' && selectedFolderId !== 'none' && file.folderId !== selectedFolderId) return false;

      // Type filter
      if (selectedFileType !== 'all') {
        if (selectedFileType === 'pdf' && file.fileType !== 'pdf') return false;
        if (selectedFileType === 'image' && file.fileType !== 'image') return false;
        if (selectedFileType === 'video' && file.fileType !== 'video') return false;
        if (selectedFileType === 'audio' && file.fileType !== 'audio') return false;
        if (selectedFileType === 'doc' && file.fileType !== 'doc') return false;
        if (selectedFileType === 'archive' && file.fileType !== 'archive') return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = file.name.toLowerCase().includes(q);
        const matchExt = file.extension.toLowerCase().includes(q);
        if (!matchName && !matchExt) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'newest') return b.createdAt - a.createdAt;
      if (sortBy === 'oldest') return a.createdAt - b.createdAt;
      if (sortBy === 'largest') return (b.fileSize || 0) - (a.fileSize || 0);
      if (sortBy === 'smallest') return (a.fileSize || 0) - (b.fileSize || 0);
      if (sortBy === 'alphabetical') return a.name.localeCompare(b.name, 'ar');
      return 0;
    });
  }, [files, activeTab, selectedFolderId, selectedFileType, searchQuery, sortBy]);

  // File Type Icon Helper
  const getFileIcon = (fileType: string, ext: string) => {
    const format = ext.toLowerCase();
    if (fileType === 'pdf' || format === 'pdf') {
      return <FileText className="w-6 h-6 text-red-400" />;
    }
    if (fileType === 'image' || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(format)) {
      return <ImageIcon className="w-6 h-6 text-blue-400" />;
    }
    if (fileType === 'video' || ['mp4', 'webm', 'mkv', 'mov', 'avi'].includes(format)) {
      return <Video className="w-6 h-6 text-purple-400" />;
    }
    if (fileType === 'audio' || ['mp3', 'wav', 'aac', 'm4a', 'ogg'].includes(format)) {
      return <Music className="w-6 h-6 text-emerald-400" />;
    }
    if (fileType === 'archive' || ['zip', 'rar', '7z', 'tar', 'gz'].includes(format)) {
      return <Archive className="w-6 h-6 text-amber-400" />;
    }
    return <File className="w-6 h-6 text-gray-400" />;
  };

  // Helper for human readable file size
  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 بايت';
    const k = 1024;
    const sizes = ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format timestamp to Arabic date
  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'مؤخراً';
    const date = new Date(timestamp);
    return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Handle Multi-file Upload (with Dual Upload to Google Drive AN-Academy Folder)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files;
    if (!selected || selected.length === 0) return;

    const filesArray = Array.from(selected);
    const queue = filesArray.map((f) => ({ file: f, progress: 0, status: 'جاري الرفع...' }));
    setUploadingFiles(queue);

    // Check Google Drive configuration
    let activeFolderId = driveConfig.folderId;
    const isDriveActive = driveConfig.isConnected && driveConfig.accessToken;

    if (isDriveActive && !activeFolderId && driveConfig.accessToken) {
      try {
        activeFolderId = await ensureAnAcademyFolder(driveConfig.accessToken, 'AN-Academy');
        const updatedConfig = { ...driveConfig, folderId: activeFolderId };
        setDriveConfig(updatedConfig);
        saveTeacherDriveConfig(teacherId, updatedConfig);
      } catch (err) {
        console.warn('Could not create Google Drive AN-Academy folder:', err);
      }
    }

    // Resolve target Google Drive folder ID (Root AN-Academy folder or Subfolder on Google Drive)
    let uploadDriveFolderId = activeFolderId;
    if (isDriveActive && uploadTargetFolder && driveConfig.accessToken) {
      const targetFolderObj = folders.find((fd) => fd.id === uploadTargetFolder);
      if (targetFolderObj) {
        if (targetFolderObj.driveFolderId) {
          uploadDriveFolderId = targetFolderObj.driveFolderId;
        } else {
          // Subfolder exists in platform but not yet on Google Drive -> Create it now on Google Drive!
          try {
            const newDriveFolderId = await createGoogleDriveFolder(
              driveConfig.accessToken,
              targetFolderObj.name,
              activeFolderId
            );
            targetFolderObj.driveFolderId = newDriveFolderId;
            uploadDriveFolderId = newDriveFolderId;
          } catch (createErr) {
            console.warn('Could not create subfolder on Google Drive:', createErr);
          }
        }
      }
    }

    for (let i = 0; i < filesArray.length; i++) {
      const fileToUpload = filesArray[i];
      const extension = fileToUpload.name.split('.').pop() || 'file';
      const fileType = detectFileType(extension);
      const isLargeFile = fileToUpload.size > 10 * 1024 * 1024; // > 10MB

      try {
        let primaryUrl = '';
        let driveFileId: string | undefined = undefined;
        let driveWebViewLink: string | undefined = undefined;

        // Path A: If Google Drive is connected, upload directly to Google Drive API inside the target folder!
        if (isDriveActive && driveConfig.accessToken && uploadDriveFolderId) {
          setUploadingFiles((prev) =>
            prev.map((item, idx) => (idx === i ? { ...item, progress: 40, status: 'جاري الرفع المباشر لخوادم Google Drive (المجلد المحدد)...' } : item))
          );

          try {
            const driveRes = await uploadFileToGoogleDrive(
              fileToUpload,
              fileToUpload.name,
              driveConfig.accessToken,
              uploadDriveFolderId,
              (prog) => {
                setUploadingFiles((prev) =>
                  prev.map((item, idx) => (idx === i ? { ...item, progress: prog, status: `جاري الرفع لخوادم جوجل (${prog}%)...` } : item))
                );
              }
            );

            driveFileId = driveRes.driveFileId;
            driveWebViewLink = driveRes.webViewLink;
            primaryUrl = driveRes.webViewLink; // Use Google Drive link directly
          } catch (gErr: any) {
            console.warn('Direct Google Drive upload warning:', gErr);
          }
        }


        // Path B: Upload to platform storage if primaryUrl is not set yet or file is <= 10MB
        if (!primaryUrl) {
          if (isLargeFile && !isDriveActive) {
            throw new Error(`حجم الملف (${(fileToUpload.size / (1024 * 1024)).toFixed(1)}MB) يتجاوز الحد المجاني (10MB). يرجى الضغط على زر Google Drive لربط حسابك ورفع الملفات حتى 5,000 جيجابايت بدون أية قيود! 🚀`);
          }

          primaryUrl = await uploadFileToStorage(
            fileToUpload,
            `teacher_files/${teacherId}/${Date.now()}_${fileToUpload.name}`,
            (prog) => {
              setUploadingFiles((prev) =>
                prev.map((item, idx) => (idx === i ? { ...item, progress: Math.round(prog), status: `جاري التخزين (${prog}%)...` } : item))
              );
            }
          );
        }

        // Save metadata
        const newFile = await saveTeacherFile({
          teacherId,
          name: fileToUpload.name,
          url: primaryUrl,
          fileType,
          fileSize: fileToUpload.size,
          extension,
          folderId: uploadTargetFolder || '',
          isShared: false,
          driveFileId,
          driveWebViewLink
        });

        setFiles((prev) => [newFile, ...prev]);
        showToast(
          driveFileId
            ? `تم رفع ${fileToUpload.name} ومزامنته بـ Google Drive (مجلد AN-Academy)! ☁️✨`
            : `تم رفع ${fileToUpload.name} بنجاح! ✨`
        );
      } catch (err: any) {
        console.error('Upload failed for file:', fileToUpload.name, err);
        showToast(`فشل رفع ${fileToUpload.name}: ${err.message || 'خطأ أثناء الرفع'}`);
      }
    }

    setUploadingFiles([]);
    setShowUploadModal(false);
  };


  const detectFileType = (ext: string): TeacherFile['fileType'] => {
    const e = ext.toLowerCase();
    if (e === 'pdf') return 'pdf';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(e)) return 'image';
    if (['mp4', 'webm', 'mkv', 'mov', 'avi'].includes(e)) return 'video';
    if (['mp3', 'wav', 'aac', 'm4a', 'ogg'].includes(e)) return 'audio';
    if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'].includes(e)) return 'doc';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) return 'archive';
    return 'other';
  };

  // Connect Google Drive Account
  const handleConnectDrive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveInputToken.trim()) return;

    setConnectingDrive(true);
    try {
      const token = driveInputToken.trim();
      const userEmail = driveInputEmail.trim() || `${teacherName}@gmail.com`;

      // Step 1: Ensure "AN-Academy" folder exists on Google Drive
      const folderId = await ensureAnAcademyFolder(token, 'AN-Academy');

      const config: GoogleDriveConfig = {
        isConnected: true,
        userEmail,
        userName: teacherName,
        accessToken: token,
        folderId,
        folderName: 'AN-Academy',
        connectedAt: Date.now()
      };

      setDriveConfig(config);
      saveTeacherDriveConfig(teacherId, config);

      setDriveInputToken('');
      setDriveInputEmail('');
      setShowDriveModal(false);
      showToast('تم ربط حساب Google Drive وتجهيز مجلد AN-Academy بنجاح! ☁️🎉');
    } catch (err: any) {
      console.error(err);
      showToast(`خطأ في ربط Google Drive: ${err.message || 'يرجى التأكد من الـ Token والترخيص'}`);
    } finally {
      setConnectingDrive(false);
    }
  };

  // Disconnect Google Drive
  const handleDisconnectDrive = () => {
    if (!confirm('هل تريد إلغاء ربط حساب Google Drive لهذا المعلم؟')) return;
    disconnectTeacherDrive(teacherId);
    setDriveConfig({ isConnected: false, folderName: 'AN-Academy' });
    showToast('تم إلغاء ربط حساب Google Drive.');
  };

  // Handle New Folder Creation (with Google Drive sync)
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      let driveFolderId: string | undefined = undefined;

      // Sync folder creation to Google Drive inside AN-Academy folder
      if (driveConfig.isConnected && driveConfig.accessToken && driveConfig.folderId) {
        try {
          driveFolderId = await createGoogleDriveFolder(
            driveConfig.accessToken,
            newFolderName.trim(),
            driveConfig.folderId
          );
        } catch (gErr) {
          console.warn('Google Drive folder create warning:', gErr);
        }
      }

      const createdFolder = await createTeacherFolder({
        teacherId,
        name: newFolderName.trim(),
        color: newFolderColor,
        description: newFolderDesc.trim(),
        driveFolderId
      });

      setFolders((prev) => [createdFolder, ...prev]);
      setNewFolderName('');
      setNewFolderDesc('');
      setShowFolderModal(false);
      showToast(
        driveFolderId
          ? `تم إنشاء المجلد "${createdFolder.name}" ومزامنته بـ Google Drive! 📁☁️`
          : `تم إنشاء المجلد "${createdFolder.name}" بنجاح! 📁`
      );
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Single File (from DB and from Google Drive if connected)
  const handleDeleteFile = async (fileId: string, fileName: string) => {
    if (!confirm(`هل أنت تأكد من رغبتك في حذف الملف "${fileName}"؟`)) return;

    const fileTarget = files.find((f) => f.id === fileId);

    try {
      // 1. Delete from Google Drive if connected and driveFileId exists
      if (fileTarget?.driveFileId && driveConfig.isConnected && driveConfig.accessToken) {
        try {
          await deleteFileFromGoogleDrive(driveConfig.accessToken, fileTarget.driveFileId);
        } catch (gErr) {
          console.warn('Google Drive file delete warning:', gErr);
        }
      }

      // 2. Delete from platform DB
      await deleteTeacherFile(teacherId, fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      setSelectedFileIds((prev) => prev.filter((id) => id !== fileId));
      showToast(`تم حذف الملف "${fileName}" من المنصة وGoogle Drive بنجاح. 🗑️`);

      // Refresh drive quota
      if (driveConfig.isConnected && driveConfig.accessToken) {
        fetchGoogleDriveQuota(driveConfig.accessToken).then(setDriveQuota).catch(() => {});
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Batch Delete (from DB and Google Drive)
  const handleBatchDelete = async () => {
    if (selectedFileIds.length === 0) return;
    if (!confirm(`هل أنت متاكد من حذف ${selectedFileIds.length} ملفات محددة؟`)) return;

    try {
      for (const id of selectedFileIds) {
        const fileTarget = files.find((f) => f.id === id);
        if (fileTarget?.driveFileId && driveConfig.isConnected && driveConfig.accessToken) {
          try {
            await deleteFileFromGoogleDrive(driveConfig.accessToken, fileTarget.driveFileId);
          } catch (gErr) {
            console.warn('Google Drive batch file delete warning:', gErr);
          }
        }
        await deleteTeacherFile(teacherId, id);
      }
      setFiles((prev) => prev.filter((f) => !selectedFileIds.includes(f.id)));
      showToast(`تم حذف ${selectedFileIds.length} ملف من المنصة وGoogle Drive بنجاح.`);
      setSelectedFileIds([]);

      // Refresh drive quota
      if (driveConfig.isConnected && driveConfig.accessToken) {
        fetchGoogleDriveQuota(driveConfig.accessToken).then(setDriveQuota).catch(() => {});
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Folder and all files inside it (from DB and Google Drive)
  const handleDeleteFolder = async (folder: FileFolder) => {
    const filesInFolder = files.filter((f) => f.folderId === folder.id);
    const countText = filesInFolder.length > 0 ? ` وجامع ملفاته (${filesInFolder.length} ملف)` : '';

    if (!confirm(`هل أنت تأكد من رغبتك في حذف المجلد "${folder.name}"${countText}؟ سيتم حذف المجلد وجميع الملفات بداخله نهائياً من المنصة وGoogle Drive!`)) return;

    try {
      // 1. Delete folder from Google Drive if driveFolderId exists
      if (folder.driveFolderId && driveConfig.isConnected && driveConfig.accessToken) {
        try {
          await deleteFileFromGoogleDrive(driveConfig.accessToken, folder.driveFolderId);
        } catch (gErr) {
          console.warn('Google Drive folder delete warning:', gErr);
        }
      }

      // Also clean up drive file IDs for files inside that folder
      if (driveConfig.isConnected && driveConfig.accessToken) {
        for (const fileItem of filesInFolder) {
          if (fileItem.driveFileId && fileItem.driveFileId !== folder.driveFolderId) {
            try {
              await deleteFileFromGoogleDrive(driveConfig.accessToken, fileItem.driveFileId);
            } catch {
              // Silently ignore if already deleted along with parent folder
            }
          }
        }
      }

      // 2. Delete folder and all files inside it from platform DB
      await deleteTeacherFolder(teacherId, folder.id);

      // Update local React UI states
      setFolders((prev) => prev.filter((f) => f.id !== folder.id));
      setFiles((prev) => prev.filter((f) => f.folderId !== folder.id));
      setSelectedFileIds((prev) => prev.filter((id) => !filesInFolder.some((f) => f.id === id)));

      if (selectedFolderId === folder.id) setSelectedFolderId('all');

      // Refresh drive quota
      if (driveConfig.isConnected && driveConfig.accessToken) {
        fetchGoogleDriveQuota(driveConfig.accessToken).then(setDriveQuota).catch(() => {});
      }

      showToast(`تم حذف المجلد "${folder.name}" وجميع ملفاته (${filesInFolder.length}) نهائياً من المنصة وGoogle Drive! 🗑️☁️`);
    } catch (err) {
      console.error('Error deleting folder:', err);
    }
  };


  // Move Files to Folder (with Google Drive sync)

  const handleMoveFiles = async (targetFolderId: string) => {
    if (selectedFileIds.length === 0) return;
    try {
      // Sync file moves to Google Drive if connected
      if (driveConfig.isConnected && driveConfig.accessToken) {
        let newDriveParentId = driveConfig.folderId; // Default: Root AN-Academy folder

        if (targetFolderId) {
          const targetFolder = folders.find((fd) => fd.id === targetFolderId);
          if (targetFolder) {
            if (targetFolder.driveFolderId) {
              newDriveParentId = targetFolder.driveFolderId;
            } else {
              // Create subfolder on Google Drive if missing
              try {
                const createdDriveFolderId = await createGoogleDriveFolder(
                  driveConfig.accessToken,
                  targetFolder.name,
                  driveConfig.folderId
                );
                targetFolder.driveFolderId = createdDriveFolderId;
                newDriveParentId = createdDriveFolderId;
              } catch (createErr) {
                console.warn('Could not create target subfolder on Google Drive:', createErr);
              }
            }
          }
        }

        if (newDriveParentId) {
          for (const id of selectedFileIds) {
            const fileTarget = files.find((f) => f.id === id);
            if (fileTarget?.driveFileId) {
              try {
                await moveGoogleDriveFile(
                  driveConfig.accessToken,
                  fileTarget.driveFileId,
                  newDriveParentId
                );
              } catch (gErr) {
                console.warn('Google Drive move file warning:', gErr);
              }
            }
          }
        }
      }

      await moveFilesToFolder(teacherId, selectedFileIds, targetFolderId);
      setFiles((prev) =>
        prev.map((f) => (selectedFileIds.includes(f.id) ? { ...f, folderId: targetFolderId } : f))
      );
      showToast(`تم نقل ${selectedFileIds.length} ملف ومزامنتها بداخل مجلد Google Drive! 📁☁️`);
      setSelectedFileIds([]);
      setShowMoveModal(false);
    } catch (err) {
      console.error(err);
    }
  };


  // Toggle Share
  const handleToggleShare = async (file: TeacherFile) => {
    const nextShare = !file.isShared;
    try {
      await toggleFileShare(teacherId, file.id, nextShare);
      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, isShared: nextShare } : f))
      );
      showToast(nextShare ? 'تمت مشاركة الملف داخل المنصة 🔗' : 'تم إلغاء مشاركة الملف 🔒');
    } catch (err) {
      console.error(err);
    }
  };

  // Rename File (with Google Drive sync)
  const handleRenameFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameFileTarget || !newFileName.trim()) return;

    try {
      // Sync rename to Google Drive
      if (renameFileTarget.driveFileId && driveConfig.isConnected && driveConfig.accessToken) {
        try {
          await renameGoogleDriveFile(
            driveConfig.accessToken,
            renameFileTarget.driveFileId,
            newFileName.trim()
          );
        } catch (gErr) {
          console.warn('Google Drive file rename warning:', gErr);
        }
      }

      const updated = await saveTeacherFile({
        ...renameFileTarget,
        name: newFileName.trim()
      });
      setFiles((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      setRenameFileTarget(null);
      setNewFileName('');
      showToast('تم تعديل اسم الملف ومزامنته بـ Google Drive! ✏️☁️');
    } catch (err) {
      console.error(err);
    }
  };


  // Copy File Link / Attach to platform
  const handleCopyLink = (file: TeacherFile) => {
    const linkToCopy = file.driveWebViewLink || file.url;
    navigator.clipboard.writeText(linkToCopy);
    showToast('تم نسخ رابط الملف حافظة الجهاز لاستخدامه في المنصة! 📋');
  };

  // Selection toggles
  const toggleSelectAll = () => {
    if (selectedFileIds.length === filteredFiles.length) {
      setSelectedFileIds([]);
    } else {
      setSelectedFileIds(filteredFiles.map((f) => f.id));
    }
  };

  const toggleSelectFile = (fileId: string) => {
    if (selectedFileIds.includes(fileId)) {
      setSelectedFileIds((prev) => prev.filter((id) => id !== fileId));
    } else {
      setSelectedFileIds((prev) => [...prev, fileId]);
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans" dir="rtl">
      
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 bg-[#F5C518] text-black px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce border border-yellow-300 font-bold">
          <Sparkles className="w-5 h-5 text-black" />
          <span className="text-sm">{toastMessage}</span>
        </div>
      )}

      {/* 1. Header Banner matching AN-Academy native dark theme */}
      <div className="bg-[var(--dark2)] border border-white/10 rounded-2xl p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-tr from-[#F5C518] to-yellow-500 p-3.5 rounded-2xl shadow-lg shadow-yellow-500/10">
            <Cloud className="w-8 h-8 text-black" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-[var(--text)] tracking-wide flex items-center gap-2">
              <span>مدير الملفات</span>
              <span className="text-xs bg-[#F5C518]/20 text-[#F5C518] border border-[#F5C518]/30 px-2.5 py-0.5 rounded-full font-bold">
                السحابي
              </span>
            </h1>
            <p className="text-xs md:text-sm text-[var(--text-muted)] mt-1">
              رفع وتنسيق المواد السحابية ومزامنتها تلقائياً في مجلد AN-Academy بـ Google Drive
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          {/* Drive Status Badge */}
          {driveConfig.isConnected ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>متصل بـ Google Drive (مجلد AN-Academy)</span>
            </div>
          ) : (
            <button
              onClick={() => setShowDriveModal(true)}
              className="bg-yellow-500/10 border border-yellow-500/30 text-[#F5C518] hover:bg-yellow-500/20 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition"
            >
              <Globe className="w-4 h-4 text-[#F5C518]" />
              <span>ربط Google Drive المعلم</span>
            </button>
          )}

          <button
            onClick={() => window.history.back()}
            className="bg-white/5 hover:bg-white/10 text-[var(--text)] px-4 py-2 rounded-xl border border-white/10 text-xs md:text-sm font-bold transition flex items-center gap-1.5"
          >
            <span>خروج</span>
          </button>
        </div>
      </div>

      {/* 2. Top Action Tabs Grid matching platform styling */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Green Upload Button */}
        <button
          onClick={() => setShowUploadModal(true)}
          className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-3.5 px-5 rounded-2xl shadow-lg border border-emerald-500/40 flex items-center justify-center gap-2.5 transition duration-150"
        >
          <UploadCloud className="w-5 h-5" />
          <span className="text-sm md:text-base">رفع ملف</span>
        </button>

        {/* My Files Tab */}
        <button
          onClick={() => { setActiveTab('my_files'); setSelectedFolderId('all'); }}
          className={`font-bold py-3.5 px-5 rounded-2xl shadow-lg flex items-center justify-center gap-2.5 transition duration-150 border ${
            activeTab === 'my_files'
              ? 'bg-[#F5C518] text-black border-[#F5C518] shadow-yellow-500/10'
              : 'bg-[var(--dark2)] hover:bg-white/5 text-[var(--text)] border-white/10'
          }`}
        >
          <Folder className="w-5 h-5" />
          <span className="text-sm md:text-base">ملفاتي</span>
        </button>

        {/* Shared With Me Tab */}
        <button
          onClick={() => setActiveTab('shared')}
          className={`font-bold py-3.5 px-5 rounded-2xl shadow-lg flex items-center justify-center gap-2.5 transition duration-150 border ${
            activeTab === 'shared'
              ? 'bg-[#F5C518] text-black border-[#F5C518] shadow-yellow-500/10'
              : 'bg-[var(--dark2)] hover:bg-white/5 text-[var(--text)] border-white/10'
          }`}
        >
          <Share2 className="w-5 h-5" />
          <span className="text-sm md:text-base">مشاركة معي</span>
        </button>

        {/* Analytics Tab */}
        <button
          onClick={() => setActiveTab('analytics')}
          className={`font-bold py-3.5 px-5 rounded-2xl shadow-lg flex items-center justify-center gap-2.5 transition duration-150 border ${
            activeTab === 'analytics'
              ? 'bg-[#F5C518] text-black border-[#F5C518] shadow-yellow-500/10'
              : 'bg-[var(--dark2)] hover:bg-white/5 text-[var(--text)] border-white/10'
          }`}
        >
          <PieChart className="w-5 h-5" />
          <span className="text-sm md:text-base">إحصائياتي</span>
        </button>

        {/* Google Drive Integration Button */}
        <button
          onClick={() => setShowDriveModal(true)}
          className={`col-span-2 sm:col-span-1 font-bold py-3.5 px-5 rounded-2xl shadow-lg flex items-center justify-center gap-2.5 transition duration-150 border ${
            driveConfig.isConnected
              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40 hover:bg-emerald-900/60'
              : 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-500/40'
          }`}
        >
          <Globe className="w-5 h-5" />
          <span className="text-sm md:text-base">Google Drive</span>
        </button>
      </div>

      {/* 3. Storage Bar matching user screenshot & real Google Drive quota */}
      <div className="bg-[var(--dark2)] border border-white/10 rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between text-xs md:text-sm font-semibold text-[var(--text)]">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-[#F5C518]" />
            <span>
              {driveQuota ? (
                <>
                  {driveQuota.usageGB > 0.1 ? `${driveQuota.usageGB} جيجابايت` : `${driveQuota.usageMB} ميجابايت`} مستخدمة من {driveQuota.limitGB} جيجابايت في Google Drive (%{Math.min(100, Math.round((driveQuota.usageBytes / driveQuota.limitBytes) * 100))})
                </>
              ) : (
                <>
                  {totalSizeMB} ميجابايت من {STORAGE_QUOTA_MB} ميجابايت (%{usedPercentage})
                </>
              )}
            </span>
          </div>
          <span className="text-[var(--text-muted)] text-xs font-normal">
            {driveQuota ? 'مساحة Google Drive الحقيقية للمعلم' : 'المساحة المتوفرة للمعلم'}
          </span>
        </div>

        <div className="w-full bg-[var(--dark)] h-3 rounded-full overflow-hidden p-0.5 border border-white/10">
          <div
            className="bg-gradient-to-r from-yellow-500 via-[#F5C518] to-emerald-400 h-full rounded-full transition-all duration-500"
            style={{
              width: `${driveQuota ? Math.min(100, Math.round((driveQuota.usageBytes / driveQuota.limitBytes) * 100)) : usedPercentage}%`
            }}
          />
        </div>
      </div>


      {/* Analytics Tab Content */}
      {activeTab === 'analytics' ? (
        <div className="bg-[var(--dark2)] border border-white/10 rounded-2xl p-6 space-y-6">
          <h2 className="text-xl font-bold text-[var(--text)] flex items-center gap-2">
            <PieChart className="w-6 h-6 text-[#F5C518]" />
            <span>إحصائيات المساحة والملفات المجهزة</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center gap-3">
              <FileText className="w-10 h-10 text-red-400 bg-red-400/10 p-2 rounded-xl" />
              <div>
                <div className="text-xs text-[var(--text-muted)]">ملفات PDF</div>
                <div className="text-lg font-bold text-[var(--text)]">
                  {files.filter(f => f.fileType === 'pdf').length} ملف
                </div>
              </div>
            </div>

            <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center gap-3">
              <ImageIcon className="w-10 h-10 text-blue-400 bg-blue-400/10 p-2 rounded-xl" />
              <div>
                <div className="text-xs text-[var(--text-muted)]">الصور والرسومات</div>
                <div className="text-lg font-bold text-[var(--text)]">
                  {files.filter(f => f.fileType === 'image').length} ملف
                </div>
              </div>
            </div>

            <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center gap-3">
              <Video className="w-10 h-10 text-purple-400 bg-purple-400/10 p-2 rounded-xl" />
              <div>
                <div className="text-xs text-[var(--text-muted)]">الفيديوهات والتسجيلات</div>
                <div className="text-lg font-bold text-[var(--text)]">
                  {files.filter(f => f.fileType === 'video').length} ملف
                </div>
              </div>
            </div>

            <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center gap-3">
              <Folder className="w-10 h-10 text-[#F5C518] bg-yellow-400/10 p-2 rounded-xl" />
              <div>
                <div className="text-xs text-[var(--text-muted)]">إجمالي المجلدات</div>
                <div className="text-lg font-bold text-[var(--text)]">{folders.length} مجلد</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 4. Controls & Filter Bar */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-3.5 bg-[var(--dark2)] p-4 rounded-2xl border border-white/10">
            {/* Left Controls */}
            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
              <button
                onClick={fetchData}
                disabled={refreshing}
                className="bg-white/5 hover:bg-white/10 text-[var(--text)] p-2.5 rounded-xl border border-white/10 flex items-center gap-1.5 text-xs font-bold transition"
                title="تحديث القائمة"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#F5C518]' : ''}`} />
                <span>تحديث</span>
              </button>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-white/5 text-[var(--text)] text-xs md:text-sm font-medium rounded-xl border border-white/10 px-3 py-2.5 focus:outline-none focus:border-[#F5C518]"
              >
                <option value="newest" className="bg-[var(--dark2)] text-white">الأحدث</option>
                <option value="oldest" className="bg-[var(--dark2)] text-white">الأقدم</option>
                <option value="largest" className="bg-[var(--dark2)] text-white">الأكبر حجماً</option>
                <option value="smallest" className="bg-[var(--dark2)] text-white">الأصغر حجماً</option>
                <option value="alphabetical" className="bg-[var(--dark2)] text-white">أبجدي</option>
              </select>

              {/* Type Dropdown */}
              <select
                value={selectedFileType}
                onChange={(e) => setSelectedFileType(e.target.value)}
                className="bg-white/5 text-[var(--text)] text-xs md:text-sm font-medium rounded-xl border border-white/10 px-3 py-2.5 focus:outline-none focus:border-[#F5C518]"
              >
                <option value="all" className="bg-[var(--dark2)] text-white">كل الأنواع</option>
                <option value="pdf" className="bg-[var(--dark2)] text-white">مستندات PDF</option>
                <option value="image" className="bg-[var(--dark2)] text-white">صور PNG/JPG</option>
                <option value="video" className="bg-[var(--dark2)] text-white">فيديوهات</option>
                <option value="audio" className="bg-[var(--dark2)] text-white">صوتيات</option>
                <option value="archive" className="bg-[var(--dark2)] text-white">ملفات مضغوطة</option>
              </select>
            </div>

            {/* Right Search Input */}
            <div className="relative w-full lg:w-80">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث بالاسم..."
                className="w-full bg-[var(--dark)] text-[var(--text)] text-xs md:text-sm rounded-xl border border-white/10 pr-10 pl-4 py-2.5 placeholder-[var(--text-muted)] focus:outline-none focus:border-[#F5C518] transition"
              />
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute right-3.5 top-3" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-3 text-[var(--text-muted)] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* 5. Folders Filter Pills Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--dark2)] p-3 rounded-2xl border border-white/10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[var(--text-muted)] ml-2 flex items-center gap-1">
                <Folder className="w-4 h-4 text-[#F5C518]" />
                <span>ملفاتي:</span>
              </span>

              {/* All Pill */}
              <button
                onClick={() => setSelectedFolderId('all')}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedFolderId === 'all'
                    ? 'bg-[#F5C518] text-black font-bold shadow'
                    : 'bg-white/5 text-[var(--text)] hover:bg-white/10'
                }`}
              >
                الكل ({files.length})
              </button>

              {/* Root / Unfolderized Pill */}
              <button
                onClick={() => setSelectedFolderId('none')}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedFolderId === 'none'
                    ? 'bg-[#F5C518] text-black font-bold shadow'
                    : 'bg-white/5 text-[var(--text)] hover:bg-white/10'
                }`}
              >
                بدون مجلد ({files.filter((f) => !f.folderId).length})
              </button>

              {/* Folders List */}
              {folders.map((folder) => {
                const folderCount = files.filter((f) => f.folderId === folder.id).length;
                return (
                  <div key={folder.id} className="relative group">
                    <button
                      onClick={() => setSelectedFolderId(folder.id)}
                      style={{
                        borderColor: selectedFolderId === folder.id ? (folder.color || '#F5C518') : undefined
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                        selectedFolderId === folder.id
                          ? 'bg-white/10 text-white ring-2 ring-[#F5C518]/50'
                          : 'bg-white/5 text-[var(--text)] hover:bg-white/10 border-white/10'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: folder.color || '#F5C518' }}
                      />
                      <span>{folder.name}</span>
                      <span className="bg-[var(--dark)] px-1.5 py-0.5 rounded-md text-[10px] text-[var(--text-muted)]">
                        {folderCount}
                      </span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFolder(folder);
                      }}
                      className="hidden group-hover:flex absolute -top-2 -left-2 bg-red-600 text-white p-1 rounded-full text-[10px] shadow transition hover:scale-110"
                      title="حذف المجلد نهائياً من المنصة وGoogle Drive"
                    >
                      <X className="w-3 h-3" />
                    </button>


                  </div>
                );
              })}
            </div>

            {/* Add New Folder Button */}
            <button
              onClick={() => setShowFolderModal(true)}
              className="bg-[#F5C518]/10 hover:bg-[#F5C518]/20 text-[#F5C518] border border-[#F5C518]/30 text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition"
            >
              <FolderPlus className="w-4 h-4" />
              <span>+ مجلد جديد</span>
            </button>
          </div>

          {/* 6. Select All & Batch Actions Header */}
          <div className="flex items-center justify-between px-2 pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[var(--text)]">
              <input
                type="checkbox"
                checked={filteredFiles.length > 0 && selectedFileIds.length === filteredFiles.length}
                onChange={toggleSelectAll}
                className="w-4 h-4 accent-[#F5C518] rounded cursor-pointer"
              />
              <span>تحديد الكل ({filteredFiles.length})</span>
            </label>

            {selectedFileIds.length > 0 && (
              <div className="flex items-center gap-2 bg-[var(--dark2)] px-3 py-1.5 rounded-xl border border-white/10 text-xs">
                <span className="text-[#F5C518] font-bold">{selectedFileIds.length} مادة محدودة:</span>

                <button
                  onClick={() => setShowMoveModal(true)}
                  className="bg-white/5 hover:bg-white/10 text-[var(--text)] px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1"
                >
                  <FolderInput className="w-3.5 h-3.5 text-[#F5C518]" />
                  <span>نقل</span>
                </button>

                <button
                  onClick={handleBatchDelete}
                  className="bg-red-950/60 hover:bg-red-900 text-red-200 px-2.5 py-1 rounded-lg border border-red-700 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span>حذف المكتمل</span>
                </button>
              </div>
            )}
          </div>

          {/* 7. File Cards List matching user screenshot & AN-Academy theme */}
          {loading ? (
            <div className="text-center py-16 space-y-3">
              <RefreshCw className="w-8 h-8 text-[#F5C518] animate-spin mx-auto" />
              <p className="text-[var(--text-muted)] text-sm">جاري تحميل ملفاتك والتخزين...</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="bg-[var(--dark2)] border border-dashed border-white/10 rounded-3xl p-12 text-center space-y-4">
              <Cloud className="w-16 h-16 text-[var(--text-muted)] opacity-40 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-[var(--text)]">لا توجد ملفات حالياً</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  يمكنك رفع ملفاتك وتصفحها وحفظها مجاناً واستخدامها داخل منصتك التعليمية.
                </p>
              </div>
              <button
                onClick={() => setShowUploadModal(true)}
                className="bg-[#F5C518] hover:bg-yellow-400 text-black font-bold px-6 py-2.5 rounded-xl text-xs transition inline-flex items-center gap-2"
              >
                <UploadCloud className="w-4 h-4" />
                <span>رفع أول ملف الآن</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFiles.map((file) => {
                const isSelected = selectedFileIds.includes(file.id);
                const folder = folders.find((fd) => fd.id === file.folderId);

                return (
                  <div
                    key={file.id}
                    className={`bg-[var(--dark2)] text-[var(--text)] rounded-2xl p-4 border transition duration-200 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isSelected
                        ? 'border-[#F5C518] ring-2 ring-[#F5C518]/20 bg-white/5'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    {/* Right Part: Checkbox + Icon + File Info */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectFile(file.id)}
                        className="w-5 h-5 accent-[#F5C518] rounded cursor-pointer shrink-0"
                      />

                      {/* File Format Icon */}
                      <div className="bg-white/5 p-3 rounded-2xl shrink-0 flex items-center justify-center border border-white/5">
                        {getFileIcon(file.fileType, file.extension)}
                      </div>

                      {/* Title & Metadata */}
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm md:text-base text-white truncate max-w-xs md:max-w-md">
                            {file.name}
                          </h3>
                          {folder && (
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-md font-bold text-black"
                              style={{ backgroundColor: folder.color || '#F5C518' }}
                            >
                              {folder.name}
                            </span>
                          )}
                          {file.driveFileId && (
                            <span className="text-[10px] bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                              <span>☁️ AN-Academy Drive</span>
                            </span>
                          )}
                          {file.isShared && (
                            <span className="text-[10px] bg-purple-950/80 border border-purple-500/40 text-purple-300 px-2 py-0.5 rounded-md font-bold">
                              مشارك بالمنصة
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                          <span>{formatFileSize(file.fileSize)}</span>
                          <span>•</span>
                          <span>{formatDate(file.createdAt)}</span>
                          <span>•</span>
                          <span className="uppercase font-mono bg-white/5 px-1.5 py-0.5 rounded text-[10px] text-gray-300">
                            {file.extension || 'FILE'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Left Part: Action Buttons matching the user image pills */}
                    <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/10">
                      {/* View Preview Button (Blue pill) */}
                      <button
                        onClick={() => setPreviewFile(file)}
                        className="bg-sky-950/60 hover:bg-sky-900 text-sky-300 text-xs font-bold px-3 py-1.5 rounded-xl border border-sky-800/60 flex items-center gap-1 transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>عرض</span>
                      </button>

                      {/* Download Button (Green pill) */}
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        download={file.name}
                        className="bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 text-xs font-bold px-3 py-1.5 rounded-xl border border-emerald-800/60 flex items-center gap-1 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>تحميل</span>
                      </a>

                      {/* Move Button (Slate pill) */}
                      <button
                        onClick={() => {
                          setSelectedFileIds([file.id]);
                          setShowMoveModal(true);
                        }}
                        className="bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-bold px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-1 transition"
                      >
                        <FolderInput className="w-3.5 h-3.5" />
                        <span>نقل</span>
                      </button>

                      {/* Share Toggle Button (Purple/Rose pill) */}
                      <button
                        onClick={() => handleToggleShare(file)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1 transition ${
                          file.isShared
                            ? 'bg-rose-950/60 hover:bg-rose-900 text-rose-300 border-rose-800/60'
                            : 'bg-purple-950/60 hover:bg-purple-900 text-purple-300 border-purple-800/60'
                        }`}
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>{file.isShared ? 'إلغاء مشاركة' : 'مشاركة'}</span>
                      </button>

                      {/* Rename Button (Amber pill) */}
                      <button
                        onClick={() => {
                          setRenameFileTarget(file);
                          setNewFileName(file.name);
                        }}
                        className="bg-amber-950/60 hover:bg-amber-900 text-amber-300 text-xs font-bold px-3 py-1.5 rounded-xl border border-amber-800/60 flex items-center gap-1 transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>تعديل الاسم</span>
                      </button>

                      {/* Delete Button (Red pill) */}
                      <button
                        onClick={() => handleDeleteFile(file.id, file.name)}
                        className="bg-red-950/60 hover:bg-red-900 text-red-300 text-xs font-bold px-3 py-1.5 rounded-xl border border-red-800/60 flex items-center gap-1 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>

                      {/* Use Link Pill (Gold) */}
                      <button
                        onClick={() => handleCopyLink(file)}
                        className="bg-yellow-500/10 hover:bg-yellow-500/20 text-[#F5C518] text-xs font-bold px-3 py-1.5 rounded-xl border border-[#F5C518]/30 flex items-center gap-1 transition"
                        title="نسخ رابط الملف للاستخدام في المناهج والواجبات والاختبارات"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>استخدام</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* MODAL 1: Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--dark2)] border border-white/10 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl relative">
            <button
              onClick={() => setShowUploadModal(false)}
              className="absolute left-5 top-5 text-[var(--text-muted)] hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="bg-emerald-500/20 p-2.5 rounded-xl text-emerald-400 border border-emerald-500/30">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">رفع ملفات جديدة</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  {driveConfig.isConnected
                    ? 'سيتم رفع الملفات ومزامنتها مباشرة في مجلد AN-Academy بـ Google Drive الخاص بك'
                    : 'اختر الملفات ليتم رفعها وتخزينها في مساحتك'}
                </p>
              </div>
            </div>

            {/* Target Folder Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[var(--text)]">اختر المجلد المستهدف (اختياري):</label>
                <button
                  type="button"
                  onClick={() => setShowInlineFolderForm(!showInlineFolderForm)}
                  className="text-[11px] bg-[#F5C518]/10 hover:bg-[#F5C518]/20 text-[#F5C518] border border-[#F5C518]/30 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>+ مجلد جديد</span>
                </button>
              </div>

              {showInlineFolderForm ? (
                <div className="bg-[var(--dark)] p-3 rounded-xl border border-[#F5C518]/40 space-y-2">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <FolderPlus className="w-4 h-4 text-[#F5C518]" />
                    <span>إنشاء مجلد جديد واختياره للرفع:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="اسم المجلد الجديد..."
                      value={inlineFolderName}
                      onChange={(e) => setInlineFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCreateInlineFolder();
                        }
                      }}
                      className="flex-1 bg-[var(--dark2)] text-white text-xs rounded-xl border border-white/10 p-2.5 focus:outline-none focus:border-[#F5C518]"
                    />
                    <button
                      type="button"
                      onClick={handleCreateInlineFolder}
                      disabled={creatingInlineFolder}
                      className="bg-[#F5C518] hover:bg-yellow-400 text-black text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1 shadow shrink-0"
                    >
                      {creatingInlineFolder ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>إنشاء واختيار</span>
                    </button>
                  </div>
                </div>
              ) : (
                <select
                  value={uploadTargetFolder}
                  onChange={(e) => {
                    if (e.target.value === '__NEW_FOLDER__') {
                      setShowInlineFolderForm(true);
                    } else {
                      setUploadTargetFolder(e.target.value);
                    }
                  }}
                  className="w-full bg-[var(--dark)] text-white text-xs md:text-sm rounded-xl border border-white/10 p-2.5 focus:outline-none focus:border-[#F5C518]"
                >
                  <option value="">بدون مجلد (الرئيسي)</option>
                  {folders.map((fd) => (
                    <option key={fd.id} value={fd.id}>
                      📁 {fd.name}
                    </option>
                  ))}
                  <option value="__NEW_FOLDER__" className="font-bold text-[#F5C518]">
                    + إنشاء مجلد جديد...
                  </option>
                </select>
              )}
            </div>


            {/* Upload Drag Drop Box */}
            <div className="border-2 border-dashed border-white/20 hover:border-[#F5C518] bg-[var(--dark)] p-8 rounded-2xl text-center space-y-3 cursor-pointer relative">
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <UploadCloud className="w-12 h-12 text-[#F5C518] mx-auto animate-bounce" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-white">اسحب الملفات هنا أو انقر للاختيار</p>
                <p className="text-xs text-[var(--text-muted)]">يدعم كافة الصيغ: PDF, الصور, الفيديوهات, المستندات</p>
              </div>
            </div>

            {/* Progress list */}
            {uploadingFiles.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {uploadingFiles.map((up, i) => (
                  <div key={i} className="bg-[var(--dark)] p-3 rounded-xl border border-white/10 space-y-1 text-xs">
                    <div className="flex justify-between font-semibold text-white">
                      <span className="truncate max-w-[200px]">{up.file.name}</span>
                      <span>{up.progress}%</span>
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)]">{up.status}</div>
                    <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#F5C518] h-full transition-all" style={{ width: `${up.progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: New Folder Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateFolder} className="bg-[var(--dark2)] border border-white/10 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowFolderModal(false)}
              className="absolute left-5 top-5 text-[var(--text-muted)] hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="bg-[#F5C518]/20 p-2.5 rounded-xl text-[#F5C518] border border-[#F5C518]/30">
                <FolderPlus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">إنشاء مجلد جديد</h3>
                <p className="text-xs text-[var(--text-muted)]">قم بتنظيم ملفاتك في مجلدات ملونة ومحددة</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text)]">اسم المجلد:</label>
              <input
                type="text"
                required
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="مثال: ملازم الصف الثالث الثانوي"
                className="w-full bg-[var(--dark)] text-white text-xs md:text-sm rounded-xl border border-white/10 p-3 focus:outline-none focus:border-[#F5C518]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text)]">لون المجلد:</label>
              <div className="flex items-center gap-2">
                {['#F5C518', '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#64748b'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewFolderColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-7 h-7 rounded-full transition transform ${
                      newFolderColor === c ? 'scale-125 ring-2 ring-white shadow' : 'opacity-80 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowFolderModal(false)}
                className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="bg-[#F5C518] hover:bg-yellow-400 text-black px-5 py-2 rounded-xl text-xs font-bold shadow"
              >
                إنشاء المجلد
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: Move Files Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--dark2)] border border-white/10 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl relative">
            <button
              onClick={() => setShowMoveModal(false)}
              className="absolute left-5 top-5 text-[var(--text-muted)] hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="bg-purple-600/20 p-2.5 rounded-xl text-purple-400 border border-purple-500/30">
                <FolderInput className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">نقل الملفات إلى مجلد</h3>
                <p className="text-xs text-[var(--text-muted)]">حدد المجلد الجديد لنقل العناصر المحددة ({selectedFileIds.length})</p>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleMoveFiles('')}
                className="w-full bg-[var(--dark)] hover:bg-white/5 text-[var(--text)] p-3 rounded-xl border border-white/10 text-xs font-bold text-right flex items-center gap-2"
              >
                <Folder className="w-4 h-4 text-gray-400" />
                <span>بدون مجلد (الرئيسي)</span>
              </button>

              {folders.map((fd) => (
                <button
                  key={fd.id}
                  onClick={() => handleMoveFiles(fd.id)}
                  className="w-full bg-[var(--dark)] hover:bg-white/5 text-[var(--text)] p-3 rounded-xl border border-white/10 text-xs font-bold text-right flex items-center gap-2"
                >
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: fd.color || '#F5C518' }} />
                  <span>{fd.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Rename File Modal */}
      {renameFileTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleRenameFile} className="bg-[var(--dark2)] border border-white/10 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setRenameFileTarget(null)}
              className="absolute left-5 top-5 text-[var(--text-muted)] hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="bg-amber-600/20 p-2.5 rounded-xl text-amber-400 border border-amber-500/30">
                <Edit3 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">تعديل اسم الملف</h3>
                <p className="text-xs text-[var(--text-muted)]">أدخل الاسم الجديد للملف</p>
              </div>
            </div>

            <input
              type="text"
              required
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              className="w-full bg-[var(--dark)] text-white text-xs md:text-sm rounded-xl border border-white/10 p-3 focus:outline-none focus:border-[#F5C518]"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenameFileTarget(null)}
                className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="bg-[#F5C518] hover:bg-yellow-400 text-black px-5 py-2 rounded-xl text-xs font-bold shadow"
              >
                حفظ التعديل
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 5: Real Google Drive Direct Integration Modal */}
      {showDriveModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleConnectDrive} className="bg-[var(--dark2)] border border-white/10 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowDriveModal(false)}
              className="absolute left-5 top-5 text-[var(--text-muted)] hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="bg-cyan-600/20 p-2.5 rounded-xl text-cyan-400 border border-cyan-500/30">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>ربط حساب Google Drive المعلم</span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-md">
                    مجلد AN-Academy
                  </span>
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  ربط مباشر بحساب جوجل درايف ليتم حفظ جميع الملفات المرفوعة في مجلد تلقائي باسم AN-Academy
                </p>
              </div>
            </div>

            {driveConfig.isConnected ? (
              <div className="bg-emerald-950/60 border border-emerald-500/40 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>حساب Google Drive مرتبط بنجاح!</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDisconnectDrive}
                    className="bg-red-950 text-red-300 hover:bg-red-900 border border-red-700/60 px-3 py-1 rounded-xl text-xs font-bold"
                  >
                    إلغاء الربط
                  </button>
                </div>

                <div className="text-xs text-slate-300 space-y-1 bg-black/30 p-3 rounded-xl border border-white/5 font-mono">
                  <div><strong>الحساب:</strong> {driveConfig.userEmail}</div>
                  <div><strong>مجلد الحفظ التلقائي:</strong> {driveConfig.folderName || 'AN-Academy'}</div>
                  <div className="text-emerald-400 font-sans">
                    ✨ أي ملف يتم رفعه بالمنصة سيُحفظ تلقائياً في مجلد AN-Academy بدرايف معلمك!
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text)]">بريد معلم Google Drive (اختياري):</label>
                  <input
                    type="email"
                    placeholder="teacher@gmail.com"
                    value={driveInputEmail}
                    onChange={(e) => setDriveInputEmail(e.target.value)}
                    className="w-full bg-[var(--dark)] text-white text-xs md:text-sm rounded-xl border border-white/10 p-3 focus:outline-none focus:border-[#F5C518]"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[var(--text)]">رمز الوصول Access Token (Google Drive API / OAuth):</label>
                    <a
                      href="https://developers.google.com/oauthplayground/?force=true&scopes=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.file"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] bg-[#F5C518]/20 hover:bg-[#F5C518]/30 text-[#F5C518] border border-[#F5C518]/40 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>الحصول على الرمز بضغطة زر (OAuth Playground)</span>
                    </a>
                  </div>
                  <textarea
                    required
                    rows={3}
                    placeholder="الصق Google OAuth Access Token الخاص بحسابك (يبدأ بـ ya29...)"
                    value={driveInputToken}
                    onChange={(e) => setDriveInputToken(e.target.value)}
                    className="w-full bg-[var(--dark)] text-white text-xs rounded-xl border border-white/10 p-3 focus:outline-none focus:border-[#F5C518] font-mono"
                    dir="ltr"
                  />
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/30 p-3.5 rounded-xl text-xs text-slate-300 space-y-1.5">
                  <div className="font-bold text-[#F5C518] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>خطوات سريعة للحصول على الرمز (أقل من دقيقة):</span>
                  </div>
                  <p>1. اضغط الزر بالأعلى لتمرير النطاق المباشر <strong>Google Drive API</strong>.</p>
                  <p>2. اضغط على الزر الأزرق <strong>Authorize APIs</strong> وسجل الدخول بحساب Google.</p>
                  <p>3. اضغط على <strong>Exchange authorization code for tokens</strong> وانخ الـ <strong>Access token</strong> والصقه هنا.</p>
                  <p className="text-emerald-400 font-semibold pt-1">
                    ✨ بمجرد اللصق والتأكيد، سيتم إنشاء وتجهيز مجلد <strong>AN-Academy</strong> في Google Drive تلقائياً!
                  </p>
                </div>

              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDriveModal(false)}
                className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl text-xs font-bold"
              >
                إغلاق
              </button>

              {!driveConfig.isConnected && (
                <button
                  type="submit"
                  disabled={connectingDrive}
                  className="bg-[#F5C518] hover:bg-yellow-400 text-black px-5 py-2 rounded-xl text-xs font-bold shadow flex items-center gap-2"
                >
                  {connectingDrive ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>تأكيد ربط Google Drive ومجلد AN-Academy</span>
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* MODAL 6: File Preview Lightbox Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[var(--dark2)] border border-white/10 rounded-3xl p-6 max-w-4xl w-full h-[85vh] flex flex-col space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                {getFileIcon(previewFile.fileType, previewFile.extension)}
                <div>
                  <h3 className="font-bold text-base text-white truncate max-w-md">{previewFile.name}</h3>
                  <span className="text-xs text-[var(--text-muted)]">{formatFileSize(previewFile.fileSize)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={previewFile.driveWebViewLink || previewFile.url}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-[#F5C518] hover:bg-yellow-400 text-black text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>فتح برابط مستقل</span>
                </a>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="bg-white/5 hover:bg-white/10 text-slate-300 p-2 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Preview Frame */}
            <div className="flex-1 bg-[var(--dark)] rounded-2xl overflow-hidden flex items-center justify-center border border-white/10 relative p-2">
              {previewFile.fileType === 'image' ? (
                <img
                  src={previewFile.url}
                  alt={previewFile.name}
                  className="max-h-full max-w-full object-contain rounded-xl"
                />
              ) : previewFile.fileType === 'pdf' ? (
                <iframe
                  src={`${previewFile.url}#toolbar=1`}
                  className="w-full h-full rounded-xl border-0"
                  title={previewFile.name}
                />
              ) : previewFile.fileType === 'video' ? (
                <video
                  src={previewFile.url}
                  controls
                  className="max-h-full max-w-full rounded-xl"
                />
              ) : previewFile.fileType === 'audio' ? (
                <div className="text-center space-y-4">
                  <Music className="w-16 h-16 text-[#F5C518] mx-auto animate-bounce" />
                  <audio src={previewFile.url} controls className="w-80" />
                </div>
              ) : (
                <div className="text-center space-y-3 p-8">
                  <FileText className="w-16 h-16 text-[#F5C518] mx-auto" />
                  <p className="text-sm font-bold text-white">معاينة الملف المرفق</p>
                  <a
                    href={previewFile.url}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-[#F5C518] hover:bg-yellow-400 text-black font-bold px-5 py-2 rounded-xl text-xs inline-flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>تحميل لمشاهدة المحتوى</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
