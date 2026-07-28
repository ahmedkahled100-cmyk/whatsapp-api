// src/lib/google-drive.ts
// Google Drive API helper for direct integration with Teacher's Google Drive account

export interface GoogleDriveConfig {
  isConnected: boolean;
  userEmail?: string;
  userName?: string;
  accessToken?: string;
  tokenExpiry?: number;
  folderId?: string; // ID of the "AN-Academy" folder in Google Drive
  folderName: string; // Default: 'AN-Academy'
  connectedAt?: number;
  driveLimitMB?: number;
  driveUsageMB?: number;
}

export interface GoogleDriveQuota {
  limitBytes: number;
  usageBytes: number;
  limitMB: number;
  usageMB: number;
  limitGB: number;
  usageGB: number;
  userEmail?: string;
  userName?: string;
}

export const fetchGoogleDriveQuota = async (accessToken: string): Promise<GoogleDriveQuota> => {
  try {
    const url = 'https://www.googleapis.com/drive/v3/about?fields=storageQuota,user';
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      throw new Error('فشل جلب بيانات المساحة من Google Drive');
    }

    const data = await res.json();
    const limitBytes = parseInt(data.storageQuota?.limit || '16106127360', 10);
    const usageBytes = parseInt(data.storageQuota?.usage || '0', 10);

    const limitMB = parseFloat((limitBytes / (1024 * 1024)).toFixed(1));
    const usageMB = parseFloat((usageBytes / (1024 * 1024)).toFixed(1));

    const limitGB = parseFloat((limitBytes / (1024 * 1024 * 1024)).toFixed(1));
    const usageGB = parseFloat((usageBytes / (1024 * 1024 * 1024)).toFixed(1));

    return {
      limitBytes,
      usageBytes,
      limitMB,
      usageMB,
      limitGB,
      usageGB,
      userEmail: data.user?.emailAddress,
      userName: data.user?.displayName
    };
  } catch (err) {
    console.error('fetchGoogleDriveQuota error:', err);
    throw err;
  }
};

/**
 * Deletes a file or folder directly from the teacher's Google Drive space.
 */
export const deleteFileFromGoogleDrive = async (accessToken: string, driveFileId: string): Promise<boolean> => {
  if (!accessToken || !driveFileId) return false;
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    return res.ok || res.status === 204 || res.status === 404;
  } catch (err) {
    console.warn('deleteFileFromGoogleDrive warning:', err);
    return false;
  }
};

/**
 * Renames a file or folder on Google Drive.
 */
export const renameGoogleDriveFile = async (
  accessToken: string,
  driveFileId: string,
  newName: string
): Promise<boolean> => {
  if (!accessToken || !driveFileId || !newName) return false;
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: newName })
    });
    return res.ok;
  } catch (err) {
    console.warn('renameGoogleDriveFile warning:', err);
    return false;
  }
};

/**
 * Creates a folder inside Google Drive (e.g. inside AN-Academy folder).
 */
export const createGoogleDriveFolder = async (
  accessToken: string,
  folderName: string,
  parentFolderId?: string
): Promise<string> => {
  try {
    // Step 1: Check if a folder with the same name already exists under the parent folder in Google Drive
    try {
      const cleanName = folderName.replace(/'/g, "\\'");
      let q = `name='${cleanName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      if (parentFolderId) {
        q += ` and '${parentFolderId}' in parents`;
      }
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`;
      const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) {
          // Reuse existing Google Drive folder ID to prevent duplicates!
          return searchData.files[0].id;
        }
      }
    } catch (sErr) {
      console.warn('Google Drive search existing folder warning:', sErr);
    }

    // Step 2: Create new folder on Google Drive
    const body: any = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    };
    if (parentFolderId) {
      body.parents = [parentFolderId];
    }

    const res = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`فشل إنشاء المجلد على Google Drive: ${errText}`);
    }

    const data = await res.json();
    return data.id;
  } catch (err) {
    console.error('createGoogleDriveFolder error:', err);
    throw err;
  }
};


/**
 * Moves a file or subfolder to a new parent folder on Google Drive.
 */
export const moveGoogleDriveFile = async (
  accessToken: string,
  driveFileId: string,
  newParentFolderId: string,
  currentParentFolderId?: string
): Promise<boolean> => {
  if (!accessToken || !driveFileId || !newParentFolderId) return false;
  try {
    let previousParents = currentParentFolderId;

    // Step 1: If current parent folder ID is not provided, fetch the file's current parents from Google Drive
    if (!previousParents) {
      const getRes = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}?fields=parents`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (getRes.ok) {
        const getData = await getRes.json();
        if (getData.parents && getData.parents.length > 0) {
          previousParents = getData.parents.join(',');
        }
      }
    }

    // Step 2: Patch to move file in Google Drive
    let url = `https://www.googleapis.com/drive/v3/files/${driveFileId}?addParents=${encodeURIComponent(newParentFolderId)}`;
    if (previousParents) {
      url += `&removeParents=${encodeURIComponent(previousParents)}`;
    }

    const res = await fetch(url, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    return res.ok;
  } catch (err) {
    console.warn('moveGoogleDriveFile warning:', err);
    return false;
  }
};





const GDRIVE_CONFIG_KEY = 'an_academy_gdrive_config';

export const getTeacherDriveConfig = (teacherId: string): GoogleDriveConfig => {
  if (typeof window === 'undefined') return { isConnected: false, folderName: 'AN-Academy' };
  try {
    const raw = localStorage.getItem(`${GDRIVE_CONFIG_KEY}_${teacherId}`);
    if (!raw) return { isConnected: false, folderName: 'AN-Academy' };
    const parsed: GoogleDriveConfig = JSON.parse(raw);
    
    // Check token expiry if present
    if (parsed.tokenExpiry && Date.now() > parsed.tokenExpiry) {
      return { ...parsed, isConnected: false };
    }
    return parsed;
  } catch {
    return { isConnected: false, folderName: 'AN-Academy' };
  }
};

export const saveTeacherDriveConfig = (teacherId: string, config: GoogleDriveConfig): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${GDRIVE_CONFIG_KEY}_${teacherId}`, JSON.stringify(config));
  } catch (err) {
    console.error('Error saving Google Drive config:', err);
  }
};

export const disconnectTeacherDrive = (teacherId: string): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`${GDRIVE_CONFIG_KEY}_${teacherId}`);
  } catch (err) {
    console.error('Error disconnecting Google Drive:', err);
  }
};

/**
 * Ensures a dedicated folder named "AN-Academy" exists in the teacher's Google Drive.
 * Returns the folder ID.
 */
export const ensureAnAcademyFolder = async (accessToken: string, folderName = 'AN-Academy'): Promise<string> => {
  try {
    // Step 1: Search for existing folder with name "AN-Academy"
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(folderName)}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id, name)`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
      }
    }

    // Step 2: Folder not found, create new folder "AN-Academy"
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        description: 'مجلد منصة AN-Academy لحفظ ملفات المعلم وتطبيقاتها'
      })
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`فشل إنشاء مجلد ${folderName} في Google Drive: ${errText}`);
    }

    const folderData = await createRes.json();
    return folderData.id;
  } catch (err) {
    console.error('ensureAnAcademyFolder error:', err);
    throw err;
  }
};

/**
 * Uploads a file directly to the teacher's Google Drive inside the "AN-Academy" folder.
 */
export const uploadFileToGoogleDrive = async (
  file: File | Blob,
  fileName: string,
  accessToken: string,
  folderId: string,
  onProgress?: (progress: number) => void
): Promise<{ driveFileId: string; webViewLink: string; webContentLink: string }> => {
  try {
    const fileType = (file as File).type || 'application/octet-stream';

    // Build Multipart Body
    const metadata = {
      name: fileName,
      mimeType: fileType,
      parents: folderId ? [folderId] : []
    };

    const formData = new FormData();
    formData.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    formData.append('file', file, fileName);

    // Upload request via XMLHttpRequest to track progress
    const driveUploadPromise = new Promise<{ id: string; webViewLink?: string; webContentLink?: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(
        'POST',
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
        true
      );
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 201) {
          try {
            const resp = JSON.parse(xhr.responseText);
            resolve(resp);
          } catch (e) {
            reject(new Error('فشل قراءة استجابة Google Drive'));
          }
        } else {
          reject(new Error(`خطأ في رفع الملف لـ Google Drive: ${xhr.status} - ${xhr.responseText}`));
        }
      };

      xhr.onerror = () => reject(new Error('فشل الاتصال بخوادم Google Drive أثناء الرفع'));
      xhr.send(formData);
    });

    const uploadedDriveFile = await driveUploadPromise;
    const driveFileId = uploadedDriveFile.id;

    // Step 2: Make file readable by anyone with link so it can be previewed/used on the platform
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone'
        })
      });
    } catch (permErr) {
      console.warn('Google Drive set permissions warning:', permErr);
    }

    const webViewLink = uploadedDriveFile.webViewLink || `https://drive.google.com/file/d/${driveFileId}/view`;
    const webContentLink = uploadedDriveFile.webContentLink || `https://drive.google.com/uc?id=${driveFileId}&export=download`;

    return {
      driveFileId,
      webViewLink,
      webContentLink
    };
  } catch (err) {
    console.error('uploadFileToGoogleDrive error:', err);
    throw err;
  }
};
