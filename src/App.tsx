/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ChevronRight, Sun, Moon, Monitor, ChevronDown, Check } from 'lucide-react';
import {
  PRESET_EXAMS,
  INITIAL_FOLDERS,
  INITIAL_LIBRARY_EXAMS,
} from './data/presetExams';
import {
  ExamSchema,
  ExamAttemptRecord,
  FolderNode,
  LibraryExamItem,
} from './types/exam';
import { serializeExamToStandardJson } from './utils/examParser';
import {
  saveWorkspaceToIndexedDB,
  loadWorkspaceFromIndexedDB,
  requestBrowserPersistentStorage,
  downloadWorkspaceBackupFile,
  mergeWorkspaceBackup,
  BackupRestoreStrategy,
  WorkspaceBackupPayload,
} from './utils/backupStorage';
import { InteractiveExamStage } from './components/InteractiveExamStage';
import { JsonInspectorPanel } from './components/JsonInspectorPanel';
import { PromptAssistantView } from './components/PromptAssistantView';
import { AttemptHistoryTable } from './components/AttemptHistoryTable';
import { HomeFolderExplorer } from './components/HomeFolderExplorer';
import { ExamReportView } from './components/ExamReportView';

type ActiveSection =
  | 'home-folders'
  | 'exam-workspace'
  | 'exam-report'
  | 'prompt-assistant'
  | 'history';
type ThemeMode = 'system' | 'light' | 'dark';

export default function App() {
  // Persistent Local User ID (so each user only queries their own attempts)
  const [currentUserId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('examina_json_user_id_v1');
      if (saved) return saved;
      const created = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem('examina_json_user_id_v1', created);
      return created;
    } catch {
      return 'local-student-user';
    }
  });
  // Theme State ('system' | 'light' | 'dark')
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('examina_json_theme_v1') as ThemeMode | null;
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
      return 'system';
    } catch {
      return 'system';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('examina_json_theme_v1', themeMode);
    } catch {
      // Ignore storage errors
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const isDark =
        themeMode === 'dark' || (themeMode === 'system' && mediaQuery.matches);
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme();
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [themeMode]);

  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        themeMenuRef.current &&
        !themeMenuRef.current.contains(event.target as Node)
      ) {
        setIsThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global Keyboard Shortcuts: Alt+H (Home), Alt+P (Prompt Assistant), Alt+S (Start/Focus Current Exam)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const key = e.key.toLowerCase();

      if (key === 'h') {
        e.preventDefault();
        setActiveSection('home-folders');
      } else if (key === 'p') {
        e.preventDefault();
        setActiveSection('prompt-assistant');
      } else if (key === 's') {
        e.preventDefault();
        setActiveSection('exam-workspace');
        setTimeout(() => {
          const examStageEl = document.getElementById('cuestionario');
          examStageEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          const startBtn = document.querySelector<HTMLButtonElement>(
            '[data-start-exam-button="true"]'
          );
          if (startBtn) {
            startBtn.click();
          } else {
            const firstQuestionCard = document.querySelector<HTMLElement>(
              '[data-exam-question-card="true"]'
            );
            firstQuestionCard?.focus({ preventScroll: true });
          }
        }, 60);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);
  // Persistent Folders State
  const [folders, setFolders] = useState<FolderNode[]>(() => {
    try {
      const saved = localStorage.getItem('examina_json_folders_v1');
      return saved ? JSON.parse(saved) : INITIAL_FOLDERS;
    } catch {
      return INITIAL_FOLDERS;
    }
  });

  // Persistent Library Exams State
  const [libraryExams, setLibraryExams] = useState<LibraryExamItem[]>(() => {
    try {
      const saved = localStorage.getItem('examina_json_library_v1');
      return saved ? JSON.parse(saved) : INITIAL_LIBRARY_EXAMS;
    } catch {
      return INITIAL_LIBRARY_EXAMS;
    }
  });

  // Current Folder in Explorer (null = Root / Inicio)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  // Active Exam in the Runner / JSON Editor
  const [activeLibraryItemId, setActiveLibraryItemId] = useState<string | null>(
    INITIAL_LIBRARY_EXAMS[0].id
  );
  const [currentExam, setCurrentExam] = useState<ExamSchema>(PRESET_EXAMS[0]);
  const [rawJsonText, setRawJsonText] = useState<string>(() =>
    serializeExamToStandardJson(PRESET_EXAMS[0])
  );

  // Default landing screen is the Home Folder Organization view (no login)
  const [activeSection, setActiveSection] = useState<ActiveSection>('home-folders');

  // Attempts History
  const [attempts, setAttempts] = useState<ExamAttemptRecord[]>(() => {
    try {
      const saved = localStorage.getItem('examina_json_attempts_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('examina_json_folders_v1', JSON.stringify(folders));
    } catch {
      // Ignore quota errors
    }
  }, [folders]);

  useEffect(() => {
    try {
      localStorage.setItem('examina_json_library_v1', JSON.stringify(libraryExams));
    } catch {
      // Ignore quota errors
    }
  }, [libraryExams]);

  // Request durable browser storage & recover from IndexedDB if localStorage was cleared
  const [isStoragePersisted, setIsStoragePersisted] = useState<boolean>(false);

  useEffect(() => {
    requestBrowserPersistentStorage().then((persisted) => {
      setIsStoragePersisted(persisted);
    });

    loadWorkspaceFromIndexedDB().then((idbSnapshot) => {
      if (!idbSnapshot) return;
      const hasLocalFolders = Boolean(localStorage.getItem('examina_json_folders_v1'));
      const hasLocalLibrary = Boolean(localStorage.getItem('examina_json_library_v1'));
      if (!hasLocalFolders && !hasLocalLibrary) {
        setFolders(idbSnapshot.folders);
        setLibraryExams(idbSnapshot.libraryExams);
        setAttempts(idbSnapshot.attempts);
      }
    });
  }, []);

  // Mirror folders, libraryExams, and attempts into IndexedDB on every change
  useEffect(() => {
    saveWorkspaceToIndexedDB({
      folders,
      libraryExams,
      attempts,
    });
  }, [folders, libraryExams, attempts]);

  const handleExportFullBackup = (): string => {
    return downloadWorkspaceBackupFile(folders, libraryExams, attempts);
  };

  const handleRestoreFullBackup = (
    payload: WorkspaceBackupPayload,
    strategy: BackupRestoreStrategy
  ) => {
    const nextState =
      strategy === 'replace'
        ? {
            folders: payload.data.folders,
            libraryExams: payload.data.libraryExams,
            attempts: payload.data.attempts,
          }
        : mergeWorkspaceBackup(
            { folders, libraryExams, attempts },
            payload.data
          );

    setFolders(nextState.folders);
    setLibraryExams(nextState.libraryExams);
    setAttempts(nextState.attempts);
    setCurrentFolderId(null);

    if (nextState.libraryExams.length > 0) {
      setActiveLibraryItemId(nextState.libraryExams[0].id);
      setCurrentExam(nextState.libraryExams[0].exam);
      setRawJsonText(nextState.libraryExams[0].rawJson);
    }

    try {
      localStorage.setItem('examina_json_folders_v1', JSON.stringify(nextState.folders));
      localStorage.setItem('examina_json_library_v1', JSON.stringify(nextState.libraryExams));
      localStorage.setItem('examina_json_attempts_v1', JSON.stringify(nextState.attempts));
    } catch {
      // Ignore storage quota errors
    }
  };

  // Folder Operations
  const handleCreateFolder = (
    name: string,
    description: string,
    parentId: string | null
  ) => {
    const newFolder: FolderNode = {
      id: `folder-${Date.now()}`,
      name,
      description: description || undefined,
      parentId,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setFolders((prev) => [...prev, newFolder]);
  };

  const handleDeleteFolder = (folderId: string) => {
    const targetFolder = folders.find((f) => f.id === folderId);
    const parentDestination = targetFolder ? targetFolder.parentId : null;

    // Re-parent child folders and exams to the deleted folder's parent so nothing is lost
    setFolders((prev) =>
      prev
        .filter((f) => f.id !== folderId)
        .map((f) => (f.parentId === folderId ? { ...f, parentId: parentDestination } : f))
    );
    setLibraryExams((prev) =>
      prev.map((item) =>
        item.folderId === folderId ? { ...item, folderId: parentDestination } : item
      )
    );
    if (currentFolderId === folderId) {
      setCurrentFolderId(parentDestination);
    }
  };

  // Library Exam Operations
  const handleImportExamToFolder = (
    exam: ExamSchema,
    rawJson: string,
    folderId: string | null
  ) => {
    const newItem: LibraryExamItem = {
      id: `lib-${Date.now()}`,
      folderId,
      exam,
      rawJson,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    setLibraryExams((prev) => [newItem, ...prev]);
    setActiveLibraryItemId(newItem.id);
    setCurrentExam(exam);
    setRawJsonText(rawJson);
  };

  const handleOpenExamFromExplorer = (item: LibraryExamItem) => {
    setActiveLibraryItemId(item.id);
    setCurrentExam(item.exam);
    setRawJsonText(item.rawJson);
    if (item.folderId !== undefined) {
      setCurrentFolderId(item.folderId);
    }
    setActiveSection('exam-workspace');
  };

  const handleOpenExamReportFromExplorer = (item: LibraryExamItem) => {
    setActiveLibraryItemId(item.id);
    setCurrentExam(item.exam);
    setRawJsonText(item.rawJson);
    if (item.folderId !== undefined) {
      setCurrentFolderId(item.folderId);
    }
    setActiveSection('exam-report');
  };

  const handleDeleteExam = (examItemId: string) => {
    setLibraryExams((prev) => prev.filter((item) => item.id !== examItemId));
  };

  const handleMoveExam = (examItemId: string, targetFolderId: string | null) => {
    setLibraryExams((prev) =>
      prev.map((item) =>
        item.id === examItemId ? { ...item, folderId: targetFolderId } : item
      )
    );
  };

  const handleExamLoadedInWorkspace = (exam: ExamSchema, rawText: string) => {
    setCurrentExam(exam);
    setRawJsonText(rawText);
    // Also save or update in the current folder so it stays organized
    if (activeLibraryItemId && libraryExams.some((i) => i.id === activeLibraryItemId)) {
      setLibraryExams((prev) =>
        prev.map((item) =>
          item.id === activeLibraryItemId
            ? { ...item, exam, rawJson: rawText, updatedAt: new Date().toISOString().slice(0, 10) }
            : item
        )
      );
    } else {
      const newItem: LibraryExamItem = {
        id: `lib-${Date.now()}`,
        folderId: currentFolderId,
        exam,
        rawJson: rawText,
        updatedAt: new Date().toISOString().slice(0, 10),
      };
      setLibraryExams((prev) => [newItem, ...prev]);
      setActiveLibraryItemId(newItem.id);
    }
    setActiveSection('exam-workspace');
  };

  const handleFinishAttempt = (stats: {
    scoreEarned: number;
    totalPoints: number;
    percentage: number;
    correctCount: number;
    totalQuestions: number;
    timeSpentSeconds: number;
    questionTimesSeconds: Record<string, number>;
    isActiveTime: boolean;
    passed: boolean;
  }) => {
    const now = new Date();
    const formattedDate =
      now.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }) +
      ', ' +
      now.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

    const newRecord: ExamAttemptRecord = {
      id: `attempt-${now.getTime()}`,
      userId: currentUserId,
      libraryItemId: activeLibraryItemId || undefined,
      examId: currentExam.id,
      examVersionHash: `${currentExam.id}-q${currentExam.questions.length}-p${stats.totalPoints}`,
      examTitle: currentExam.title,
      subject: currentExam.subject,
      completedAt: formattedDate,
      timestamp: now.getTime(),
      completed: true,
      ...stats,
    };

    const updated = [newRecord, ...attempts];
    setAttempts(updated);
    try {
      localStorage.setItem('examina_json_attempts_v1', JSON.stringify(updated));
    } catch {
      // Ignore storage quota errors
    }

    // Update lastScorePercent on library item
    if (activeLibraryItemId) {
      setLibraryExams((prev) =>
        prev.map((item) =>
          item.id === activeLibraryItemId
            ? { ...item, lastScorePercent: stats.percentage }
            : item
        )
      );
    }
  };

  const handleClearHistory = () => {
    setAttempts([]);
    try {
      localStorage.removeItem('examina_json_attempts_v1');
    } catch {
      // Ignore
    }
  };

  const activeFolderObj = folders.find((f) => f.id === currentFolderId) || null;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#inicio"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('home-folders');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 font-display"
        >
          ExaminaJSON
        </a>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a
            href="#inicio"
            title="Inicio (Atajo: Alt+H)"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('home-folders');
            }}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
              activeSection === 'home-folders' ? 'text-slate-900 font-semibold' : ''
            }`}
          >
            Inicio
          </a>
          <a
            href="#cuestionario"
            title="Iniciar o enfocar examen actual (Atajo: Alt+S)"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('exam-workspace');
            }}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
              activeSection === 'exam-workspace' ? 'text-slate-900 font-semibold' : ''
            }`}
          >
            Examen
          </a>
          <a
            href="#prompt-ia"
            title="Asistente de Prompt IA (Atajo: Alt+P)"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('prompt-assistant');
            }}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
              activeSection === 'prompt-assistant' ? 'text-slate-900 font-semibold' : ''
            }`}
          >
            Prompt IA
          </a>
          <a
            href="#historial"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('history');
            }}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
              activeSection === 'history' ? 'text-slate-900 font-semibold' : ''
            }`}
          >
            Historial
          </a>
        </nav>

        {/* Zone 3: 1 primary action (Theme dropdown selector: Sistema / Claro / Oscuro) */}
        <div ref={themeMenuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setIsThemeMenuOpen((prev) => !prev)}
            aria-haspopup="listbox"
            aria-expanded={isThemeMenuOpen}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {themeMode === 'system' && (
              <>
                <Monitor className="w-3.5 h-3.5 text-sky-600" />
                <span>Tema: Sistema</span>
              </>
            )}
            {themeMode === 'light' && (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Tema: Claro</span>
              </>
            )}
            {themeMode === 'dark' && (
              <>
                <Moon className="w-3.5 h-3.5 text-sky-400" />
                <span>Tema: Oscuro</span>
              </>
            )}
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-150 ${
                isThemeMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {isThemeMenuOpen && (
            <div
              role="listbox"
              aria-label="Seleccionar modo de tema"
              className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-50 space-y-0.5"
            >
              <button
                type="button"
                role="option"
                aria-selected={themeMode === 'system'}
                onClick={() => {
                  setThemeMode('system');
                  setIsThemeMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  themeMode === 'system'
                    ? 'bg-sky-50 text-sky-800 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100 font-medium'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Monitor className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span>Sistema</span>
                </span>
                {themeMode === 'system' && <Check className="w-3.5 h-3.5 text-sky-600 shrink-0" />}
              </button>

              <button
                type="button"
                role="option"
                aria-selected={themeMode === 'light'}
                onClick={() => {
                  setThemeMode('light');
                  setIsThemeMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  themeMode === 'light'
                    ? 'bg-sky-50 text-sky-800 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100 font-medium'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Claro</span>
                </span>
                {themeMode === 'light' && <Check className="w-3.5 h-3.5 text-sky-600 shrink-0" />}
              </button>

              <button
                type="button"
                role="option"
                aria-selected={themeMode === 'dark'}
                onClick={() => {
                  setThemeMode('dark');
                  setIsThemeMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  themeMode === 'dark'
                    ? 'bg-sky-50 text-sky-800 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100 font-medium'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Moon className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>Oscuro</span>
                </span>
                {themeMode === 'dark' && <Check className="w-3.5 h-3.5 text-sky-600 shrink-0" />}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Contextual Breadcrumb Bar only when inside Exam Workspace */}
      {activeSection === 'exam-workspace' && (
        <div className="bg-white border-b border-slate-200 px-6 py-2.5">
          <div className="max-w-[1380px] mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setActiveSection('home-folders')}
                className="inline-flex items-center gap-1.5 font-semibold text-sky-700 hover:text-sky-800 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver a Carpetas</span>
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500">
                Carpeta:{' '}
                <strong className="text-slate-800">
                  {activeFolderObj ? activeFolderObj.name : 'Inicio (Raíz)'}
                </strong>
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-900 truncate max-w-xs">
                {currentExam.title}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Container (1440px Desktop Baseline) */}
      <main className="flex-1 max-w-[1380px] w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {activeSection === 'prompt-assistant' && (
          <PromptAssistantView
            onClose={() => setActiveSection('home-folders')}
            onLoadSampleJson={() => {
              handleOpenExamFromExplorer(libraryExams[0] || INITIAL_LIBRARY_EXAMS[0]);
            }}
          />
        )}

        {activeSection === 'home-folders' && (
          <HomeFolderExplorer
            folders={folders}
            exams={libraryExams}
            attemptsCount={attempts.length}
            isStoragePersisted={isStoragePersisted}
            currentFolderId={currentFolderId}
            onNavigateFolder={(id) => setCurrentFolderId(id)}
            onCreateFolder={handleCreateFolder}
            onDeleteFolder={handleDeleteFolder}
            onImportExamToFolder={handleImportExamToFolder}
            onOpenExam={handleOpenExamFromExplorer}
            onOpenExamReport={handleOpenExamReportFromExplorer}
            onDeleteExam={handleDeleteExam}
            onMoveExam={handleMoveExam}
            onOpenPromptAssistant={() => setActiveSection('prompt-assistant')}
            onExportFullBackup={handleExportFullBackup}
            onRestoreFullBackup={handleRestoreFullBackup}
          />
        )}

        {activeSection === 'exam-workspace' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div id="cuestionario" className="lg:col-span-7">
              <InteractiveExamStage
                exam={currentExam}
                onUpdateExam={(updatedExam) => {
                  const formattedJson = serializeExamToStandardJson(updatedExam);
                  handleExamLoadedInWorkspace(updatedExam, formattedJson);
                }}
                onOpenReport={() => setActiveSection('exam-report')}
                onFinishAttempt={handleFinishAttempt}
              />
            </div>

            <div id="importador-json" className="lg:col-span-5 lg:sticky lg:top-6">
              <JsonInspectorPanel
                currentExam={currentExam}
                rawJsonText={rawJsonText}
                onRawJsonChange={setRawJsonText}
                onExamLoaded={handleExamLoadedInWorkspace}
                onOpenPromptAssistant={() => setActiveSection('prompt-assistant')}
              />
            </div>
          </div>
        )}

        {activeSection === 'exam-report' && (
          <ExamReportView
            exam={currentExam}
            libraryItemId={activeLibraryItemId}
            currentUserId={currentUserId}
            allAttempts={attempts}
            onBackToFolder={() => setActiveSection('home-folders')}
            onStartExam={() => setActiveSection('exam-workspace')}
          />
        )}

        {activeSection === 'history' && (
          <AttemptHistoryTable
            attempts={attempts.filter((a) => !a.userId || a.userId === currentUserId)}
            onClearHistory={handleClearHistory}
          />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="bg-white border-t border-slate-200 px-6 py-5 mt-12">
        <div className="max-w-[1380px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            ExaminaJSON — Atajos rápidos: <kbd className="font-mono font-semibold text-slate-700">Alt+H</kbd> Inicio · <kbd className="font-mono font-semibold text-slate-700">Alt+S</kbd> Examen · <kbd className="font-mono font-semibold text-slate-700">Alt+P</kbd> Prompt IA · <kbd className="font-mono font-semibold text-slate-700">↑/↓/←/→</kbd> Navegar preguntas
          </p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveSection('home-folders')}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Inicio
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveSection('prompt-assistant')}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Prompt Genérico IA
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
