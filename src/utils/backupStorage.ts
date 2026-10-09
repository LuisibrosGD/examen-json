import { FolderNode, LibraryExamItem, ExamAttemptRecord } from '../types/exam';

export interface WorkspaceBackupPayload {
  schema: 'examina_json_workspace_backup';
  version: 1;
  exportedAt: string;
  stats: {
    folderCount: number;
    examCount: number;
    attemptCount: number;
  };
  data: {
    folders: FolderNode[];
    libraryExams: LibraryExamItem[];
    attempts: ExamAttemptRecord[];
  };
}

export type BackupRestoreStrategy = 'merge' | 'replace';

export interface ParsedBackupResult {
  success: boolean;
  payload?: WorkspaceBackupPayload;
  error?: string;
}

const DB_NAME = 'ExaminaJSON_PersistentDB';
const DB_VERSION = 1;
const STORE_NAME = 'workspace_kv';
const SNAPSHOT_KEY = 'current_workspace_v1';

function openPersistentDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveWorkspaceToIndexedDB(snapshot: {
  folders: FolderNode[];
  libraryExams: LibraryExamItem[];
  attempts: ExamAttemptRecord[];
}): Promise<void> {
  try {
    const db = await openPersistentDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(
        {
          ...snapshot,
          updatedAt: new Date().toISOString(),
        },
        SNAPSHOT_KEY
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Fallback to localStorage is already active in App.tsx
  }
}

export async function loadWorkspaceFromIndexedDB(): Promise<{
  folders: FolderNode[];
  libraryExams: LibraryExamItem[];
  attempts: ExamAttemptRecord[];
  updatedAt?: string;
} | null> {
  try {
    const db = await openPersistentDb();
    const result = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(SNAPSHOT_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (
      result &&
      Array.isArray(result.folders) &&
      Array.isArray(result.libraryExams) &&
      Array.isArray(result.attempts)
    ) {
      return result;
    }
    return null;
  } catch {
    return null;
  }
}

export async function requestBrowserPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persisted();
      if (isPersisted) return true;
      return await navigator.storage.persist();
    }
  } catch {
    // Ignore
  }
  return false;
}

export function buildWorkspaceBackupPayload(
  folders: FolderNode[],
  libraryExams: LibraryExamItem[],
  attempts: ExamAttemptRecord[]
): WorkspaceBackupPayload {
  return {
    schema: 'examina_json_workspace_backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    stats: {
      folderCount: folders.length,
      examCount: libraryExams.length,
      attemptCount: attempts.length,
    },
    data: {
      folders,
      libraryExams,
      attempts,
    },
  };
}

export function downloadWorkspaceBackupFile(
  folders: FolderNode[],
  libraryExams: LibraryExamItem[],
  attempts: ExamAttemptRecord[]
): string {
  const payload = buildWorkspaceBackupPayload(folders, libraryExams, attempts);
  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const dateStamp = new Date().toISOString().slice(0, 10);
  const fileName = `respaldo-examinajson-${dateStamp}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  return fileName;
}

export function parseWorkspaceBackupJson(rawText: string): ParsedBackupResult {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      success: false,
      error: 'El archivo de respaldo está vacío.',
    };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err: any) {
    return {
      success: false,
      error: `El archivo no contiene un JSON válido (${err?.message || 'Error de sintaxis'}).`,
    };
  }

  const dataNode = parsed?.data ? parsed.data : parsed;
  const folders = dataNode?.folders;
  const libraryExams = dataNode?.libraryExams;
  const attempts = dataNode?.attempts || [];

  if (!Array.isArray(folders) || !Array.isArray(libraryExams)) {
    return {
      success: false,
      error:
        'El archivo JSON no tiene la estructura de un Respaldo Completo de ExaminaJSON (faltan "folders" o "libraryExams"). Si deseas importar un único examen, usa el botón "Agregar Examen JSON aquí".',
    };
  }

  const validFolders: FolderNode[] = folders.filter(
    (f: any) => f && typeof f.id === 'string' && typeof f.name === 'string'
  );
  const validExams: LibraryExamItem[] = libraryExams.filter(
    (e: any) =>
      e &&
      typeof e.id === 'string' &&
      e.exam &&
      typeof e.exam.title === 'string' &&
      Array.isArray(e.exam.questions)
  );
  const validAttempts: ExamAttemptRecord[] = Array.isArray(attempts)
    ? attempts.filter((a: any) => a && typeof a.id === 'string' && typeof a.examTitle === 'string')
    : [];

  return {
    success: true,
    payload: {
      schema: 'examina_json_workspace_backup',
      version: 1,
      exportedAt:
        typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
      stats: {
        folderCount: validFolders.length,
        examCount: validExams.length,
        attemptCount: validAttempts.length,
      },
      data: {
        folders: validFolders,
        libraryExams: validExams,
        attempts: validAttempts,
      },
    },
  };
}

export function mergeWorkspaceBackup(
  current: {
    folders: FolderNode[];
    libraryExams: LibraryExamItem[];
    attempts: ExamAttemptRecord[];
  },
  incoming: {
    folders: FolderNode[];
    libraryExams: LibraryExamItem[];
    attempts: ExamAttemptRecord[];
  }
): {
  folders: FolderNode[];
  libraryExams: LibraryExamItem[];
  attempts: ExamAttemptRecord[];
} {
  const folderMap = new Map<string, FolderNode>();
  current.folders.forEach((f) => folderMap.set(f.id, f));
  incoming.folders.forEach((f) => folderMap.set(f.id, f));

  const examMap = new Map<string, LibraryExamItem>();
  current.libraryExams.forEach((e) => examMap.set(e.id, e));
  incoming.libraryExams.forEach((e) => examMap.set(e.id, e));

  const attemptMap = new Map<string, ExamAttemptRecord>();
  current.attempts.forEach((a) => attemptMap.set(a.id, a));
  incoming.attempts.forEach((a) => attemptMap.set(a.id, a));

  const mergedAttempts = Array.from(attemptMap.values()).sort(
    (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
  );

  return {
    folders: Array.from(folderMap.values()),
    libraryExams: Array.from(examMap.values()),
    attempts: mergedAttempts,
  };
}
