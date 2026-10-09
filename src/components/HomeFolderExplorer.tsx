import React, { useState, useRef } from 'react';
import {
  Folder,
  FolderPlus,
  FileText,
  ChevronRight,
  Home,
  Upload,
  Search,
  Trash2,
  Play,
  Sparkles,
  CornerLeftUp,
  CheckCircle2,
  AlertTriangle,
  X,
  FolderOpen,
  BarChart3,
  Download,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import { FolderNode, LibraryExamItem, ExamSchema } from '../types/exam';
import { normalizeExamJson } from '../utils/examParser';
import {
  BackupRestoreStrategy,
  WorkspaceBackupPayload,
  parseWorkspaceBackupJson,
} from '../utils/backupStorage';

interface HomeFolderExplorerProps {
  folders: FolderNode[];
  exams: LibraryExamItem[];
  attemptsCount: number;
  isStoragePersisted?: boolean;
  currentFolderId: string | null;
  onNavigateFolder: (folderId: string | null) => void;
  onCreateFolder: (name: string, description: string, parentId: string | null) => void;
  onDeleteFolder: (folderId: string) => void;
  onImportExamToFolder: (exam: ExamSchema, rawJson: string, folderId: string | null) => void;
  onOpenExam: (item: LibraryExamItem) => void;
  onOpenExamReport: (item: LibraryExamItem) => void;
  onDeleteExam: (examItemId: string) => void;
  onMoveExam: (examItemId: string, targetFolderId: string | null) => void;
  onOpenPromptAssistant: () => void;
  onExportFullBackup: () => string;
  onRestoreFullBackup: (
    payload: WorkspaceBackupPayload,
    strategy: BackupRestoreStrategy
  ) => void;
}

export const HomeFolderExplorer: React.FC<HomeFolderExplorerProps> = ({
  folders,
  exams,
  attemptsCount,
  isStoragePersisted,
  currentFolderId,
  onNavigateFolder,
  onCreateFolder,
  onDeleteFolder,
  onImportExamToFolder,
  onOpenExam,
  onOpenExamReport,
  onDeleteExam,
  onMoveExam,
  onOpenPromptAssistant,
  onExportFullBackup,
  onRestoreFullBackup,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDesc, setNewFolderDesc] = useState('');

  const [isImportingModalOpen, setIsImportingModalOpen] = useState(false);
  const [pastedJson, setPastedJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<FolderNode | null>(null);

  const [isBackupDrawerOpen, setIsBackupDrawerOpen] = useState(false);
  const [pendingBackupPayload, setPendingBackupPayload] =
    useState<WorkspaceBackupPayload | null>(null);
  const [backupRestoreStrategy, setBackupRestoreStrategy] =
    useState<BackupRestoreStrategy>('merge');
  const [backupError, setBackupError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement | null>(null);

  // Compute breadcrumb chain from root to currentFolderId
  const getBreadcrumbs = (): FolderNode[] => {
    const trail: FolderNode[] = [];
    let pointerId = currentFolderId;
    const visited = new Set<string>();
    while (pointerId && !visited.has(pointerId)) {
      visited.add(pointerId);
      const found = folders.find((f) => f.id === pointerId);
      if (found) {
        trail.unshift(found);
        pointerId = found.parentId;
      } else {
        break;
      }
    }
    return trail;
  };

  const breadcrumbs = getBreadcrumbs();
  const currentFolder = folders.find((f) => f.id === currentFolderId) || null;

  // Count nested subfolders and exams inside any given folder
  const getFolderCounts = (folderId: string) => {
    const subCount = folders.filter((f) => f.parentId === folderId).length;
    const examCount = exams.filter((e) => e.folderId === folderId).length;
    return { subCount, examCount };
  };

  // Unique subjects across all exams for quick filtering
  const availableSubjects = Array.from(
    new Set(exams.map((item) => item.exam.subject.trim()).filter(Boolean))
  );

  // Filter items by current directory or global search / subject filter
  const isSearching = searchQuery.trim().length > 0 || selectedSubject !== 'all';
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const visibleFolders = isSearching
    ? folders.filter((f) => {
        const matchesText =
          !normalizedQuery ||
          f.name.toLowerCase().includes(normalizedQuery) ||
          (f.description && f.description.toLowerCase().includes(normalizedQuery));
        if (!matchesText) return false;
        if (selectedSubject === 'all') return true;
        // If filtering by a specific subject, show folders that match or contain exams of that subject
        return exams.some(
          (e) => e.folderId === f.id && e.exam.subject === selectedSubject
        );
      })
    : folders.filter((f) => f.parentId === currentFolderId);

  const visibleExams = isSearching
    ? exams.filter((item) => {
        const matchesSubjectDropdown =
          selectedSubject === 'all' || item.exam.subject === selectedSubject;
        const matchesQuery =
          !normalizedQuery ||
          item.exam.title.toLowerCase().includes(normalizedQuery) ||
          item.exam.subject.toLowerCase().includes(normalizedQuery) ||
          item.exam.description.toLowerCase().includes(normalizedQuery);
        return matchesSubjectDropdown && matchesQuery;
      })
    : exams.filter((item) => item.folderId === currentFolderId);

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    onCreateFolder(newFolderName.trim(), newFolderDesc.trim(), currentFolderId);
    setNewFolderName('');
    setNewFolderDesc('');
    setIsCreatingFolder(false);
  };

  const processImportedJsonString = (rawText: string, openImmediately: boolean) => {
    const parsed = normalizeExamJson(rawText);
    if (!parsed.success || !parsed.exam) {
      setImportError(parsed.error || 'El contenido no es un esquema JSON de examen válido.');
      setImportSuccess(null);
      return;
    }
    setImportError(null);
    onImportExamToFolder(parsed.exam, rawText, currentFolderId);
    setPastedJson('');
    setIsImportingModalOpen(false);
    setImportSuccess(
      `Examen "${parsed.exam.title}" guardado en ${currentFolder ? currentFolder.name : 'Inicio'}.`
    );
    setTimeout(() => setImportSuccess(null), 4000);

    if (openImmediately) {
      onOpenExam({
        id: `temp-${Date.now()}`,
        folderId: currentFolderId,
        exam: parsed.exam,
        rawJson: rawText,
        updatedAt: new Date().toISOString().slice(0, 10),
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target?.result || '');
      processImportedJsonString(content, false);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleBackupFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target?.result || '');
      const parsed = parseWorkspaceBackupJson(content);
      if (!parsed.success || !parsed.payload) {
        setBackupError(parsed.error || 'Archivo de respaldo inválido.');
        setPendingBackupPayload(null);
        setIsBackupDrawerOpen(true);
        return;
      }
      setBackupError(null);
      setPendingBackupPayload(parsed.payload);
      setIsBackupDrawerOpen(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmBackupRestore = () => {
    if (!pendingBackupPayload) return;
    onRestoreFullBackup(pendingBackupPayload, backupRestoreStrategy);
    const { folderCount, examCount, attemptCount } = pendingBackupPayload.stats;
    setPendingBackupPayload(null);
    setIsBackupDrawerOpen(false);
    setImportSuccess(
      `Respaldo completo restaurado (${
        backupRestoreStrategy === 'merge' ? 'Combinado' : 'Reemplazado'
      }): ${folderCount} carpetas, ${examCount} exámenes y ${attemptCount} intentos.`
    );
    setTimeout(() => setImportSuccess(null), 5000);
  };

  const handleTriggerBackupDownload = () => {
    const fileName = onExportFullBackup();
    setImportSuccess(`Respaldo completo descargado como «${fileName}».`);
    setTimeout(() => setImportSuccess(null), 4500);
  };

  const getFolderNameById = (folderId: string | null) => {
    if (!folderId) return 'Raíz (Inicio)';
    return folders.find((f) => f.id === folderId)?.name || 'Carpeta';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left Sidebar: Hierarchical Directory Tree */}
      <aside className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div className="pb-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-500">
              Estructura de Estudio
            </p>
            <h2 className="text-sm font-bold text-slate-900">
              Directorio de Carpetas
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsCreatingFolder(true);
              setIsImportingModalOpen(false);
            }}
            className="p-1.5 text-slate-600 hover:text-sky-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Crear carpeta en la ubicación actual"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>

        {/* Root & Tree List */}
        <nav aria-label="Árbol de carpetas" className="space-y-1 text-xs">
          <button
            type="button"
            onClick={() => onNavigateFolder(null)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
              currentFolderId === null
                ? 'bg-sky-50 text-sky-800 font-semibold'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              <Home className="w-4 h-4 shrink-0 text-sky-600" />
              <span className="truncate">Inicio (Raíz)</span>
            </span>
            <span className="font-mono text-[11px] text-slate-400 tabular-nums">
              {folders.filter((f) => f.parentId === null).length}
            </span>
          </button>

          {/* Root-level folders and their nested subfolders */}
          <div className="pt-1 space-y-1">
            {folders
              .filter((f) => f.parentId === null)
              .map((rootFolder) => {
                const isSelectedRoot = currentFolderId === rootFolder.id;
                const childFolders = folders.filter((sub) => sub.parentId === rootFolder.id);
                const { subCount, examCount } = getFolderCounts(rootFolder.id);

                return (
                  <div key={rootFolder.id} className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => onNavigateFolder(rootFolder.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                        isSelectedRoot
                          ? 'bg-sky-50 text-sky-800 font-semibold'
                          : 'text-slate-700 hover:bg-slate-100 font-medium'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        {isSelectedRoot ? (
                          <FolderOpen className="w-4 h-4 shrink-0 text-sky-600" />
                        ) : (
                          <Folder className="w-4 h-4 shrink-0 text-slate-400" />
                        )}
                        <span className="truncate">{rootFolder.name}</span>
                      </span>
                      <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                        {subCount + examCount}
                      </span>
                    </button>

                    {/* Second-level subfolders in sidebar */}
                    {childFolders.length > 0 && (
                      <div className="pl-5 space-y-0.5 border-l border-slate-200 ml-4">
                        {childFolders.map((sub) => {
                          const isSelectedSub = currentFolderId === sub.id;
                          const subStats = getFolderCounts(sub.id);
                          const deepChildren = folders.filter((d) => d.parentId === sub.id);

                          return (
                            <div key={sub.id} className="space-y-0.5">
                              <button
                                type="button"
                                onClick={() => onNavigateFolder(sub.id)}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors cursor-pointer ${
                                  isSelectedSub
                                    ? 'bg-sky-50 text-sky-800 font-semibold'
                                    : 'text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <span className="flex items-center gap-2 truncate">
                                  <Folder className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                  <span className="truncate">{sub.name}</span>
                                </span>
                                <span className="font-mono text-[10px] text-slate-400 tabular-nums shrink-0">
                                  {subStats.subCount + subStats.examCount}
                                </span>
                              </button>

                              {/* Third-level subfolders if created */}
                              {deepChildren.length > 0 && (
                                <div className="pl-4 space-y-0.5 border-l border-slate-200 ml-3">
                                  {deepChildren.map((deep) => {
                                    const isSelectedDeep = currentFolderId === deep.id;
                                    const deepStats = getFolderCounts(deep.id);
                                    return (
                                      <button
                                        key={deep.id}
                                        type="button"
                                        onClick={() => onNavigateFolder(deep.id)}
                                        className={`w-full flex items-center justify-between px-2 py-1 rounded-md transition-colors cursor-pointer ${
                                          isSelectedDeep
                                            ? 'bg-sky-50 text-sky-800 font-semibold'
                                            : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                      >
                                        <span className="flex items-center gap-1.5 truncate">
                                          <Folder className="w-3 h-3 shrink-0 text-slate-400" />
                                          <span className="truncate">{deep.name}</span>
                                        </span>
                                        <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                                          {deepStats.subCount + deepStats.examCount}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </nav>

        {/* Quick Prompt Helper Box inside Sidebar */}
        <div className="pt-4 border-t border-slate-200 space-y-2">
          <p className="text-[11px] font-semibold text-slate-700">
            ¿Nuevo examen desde tu chat con IA?
          </p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Copia el prompt genérico para pedirle a tu IA el JSON del tema que estés estudiando y guárdalo en cualquier carpeta.
          </p>
          <button
            type="button"
            onClick={onOpenPromptAssistant}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Obtener Prompt Genérico</span>
          </button>
        </div>

        {/* Persistent Memory & Full Backup Box inside Sidebar */}
        <div className="pt-4 border-t border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-slate-800 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span>Memoria y Respaldo</span>
            </span>
            <span className="text-[10px] font-mono font-semibold text-emerald-700">
              {isStoragePersisted ? '● Persistente' : '● Guardado local'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Tus exámenes se guardan en este navegador (IndexedDB + LocalStorage). Descarga un <strong>Respaldo Completo</strong> para abrirlos en tu celular u otra PC cada 8 semanas sin usar base de datos.
          </p>
          <div className="grid grid-cols-1 gap-1.5">
            <button
              type="button"
              onClick={handleTriggerBackupDownload}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar Respaldo (.json)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsBackupDrawerOpen(true);
                setIsCreatingFolder(false);
                setIsImportingModalOpen(false);
                setBackupError(null);
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-sky-600" />
              <span>Restaurar / Sincronizar</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace Stage: Folder & Exam Explorer */}
      <div className="lg:col-span-9 space-y-6">
        {/* Top Search & Subject Filter Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar rápidamente carpetas o exámenes por título o materia..."
              aria-label="Buscar carpetas o exámenes por título o materia"
              className="w-full pl-10 pr-9 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-sky-600 focus:bg-white transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                title="Limpiar texto de búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="subject-filter-select" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
              Materia:
            </label>
            <select
              id="subject-filter-select"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-3 py-2.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-sky-600 cursor-pointer"
            >
              <option value="all">Todas las materias</option>
              {availableSubjects.map((subj) => (
                <option key={subj} value={subj}>
                  {subj}
                </option>
              ))}
            </select>

            {isSearching && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedSubject('all');
                }}
                className="px-3 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Top Explorer Bar: Breadcrumbs & Folder Actions */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            {/* Breadcrumb Path */}
            <nav aria-label="Ruta de navegación" className="flex items-center flex-wrap gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => onNavigateFolder(null)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  currentFolderId === null
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 font-medium'
                }`}
              >
                <Home className="w-3.5 h-3.5" />
                <span>Inicio</span>
              </button>

              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={crumb.id}>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <button
                      type="button"
                      onClick={() => onNavigateFolder(crumb.id)}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                        isLast
                          ? 'bg-slate-900 text-white font-semibold'
                          : 'text-slate-600 hover:bg-slate-100 font-medium'
                      }`}
                    >
                      {crumb.name}
                    </button>
                  </React.Fragment>
                );
              })}
            </nav>

            {/* Primary Folder Actions */}
            <div className="flex items-center flex-wrap gap-2.5 shrink-0">
              {currentFolder && (
                <button
                  type="button"
                  onClick={() => onNavigateFolder(currentFolder.parentId)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <CornerLeftUp className="w-3.5 h-3.5" />
                  <span>Subir nivel</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsCreatingFolder((prev) => !prev);
                  setIsImportingModalOpen(false);
                  setIsBackupDrawerOpen(false);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5 text-sky-600" />
                <span>Nueva Carpeta</span>
              </button>

              <input
                ref={backupFileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleBackupFileChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => {
                  setIsBackupDrawerOpen((prev) => !prev);
                  setIsCreatingFolder(false);
                  setIsImportingModalOpen(false);
                  setBackupError(null);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <HardDrive className="w-3.5 h-3.5 text-sky-600" />
                <span>Respaldo Completo</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json,text/plain"
                onChange={handleFileChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => {
                  setIsImportingModalOpen((prev) => !prev);
                  setIsCreatingFolder(false);
                  setIsBackupDrawerOpen(false);
                  setImportError(null);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Agregar Examen JSON aquí</span>
              </button>
            </div>
          </div>

          {/* Current Location Title */}
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {currentFolder ? currentFolder.name : 'Espacio de Organización Académica'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {currentFolder
                ? currentFolder.description || 'Carpeta personalizada de estudio y evaluación.'
                : 'Organiza tus cuestionarios JSON por Cursos, Repaso y Exámenes. Cada carpeta puede contener más subcarpetas o evaluaciones.'}
            </p>
          </div>

          {/* Status Notification */}
          {importSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>● {importSuccess}</span>
              </div>
              <button
                type="button"
                onClick={() => setImportSuccess(null)}
                className="text-emerald-700 hover:text-emerald-950 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Inline Create Folder Drawer */}
          {isCreatingFolder && (
            <form
              onSubmit={handleCreateFolderSubmit}
              className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">
                  Crear nueva subcarpeta dentro de «{currentFolder ? currentFolder.name : 'Inicio'}»
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreatingFolder(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Nombre de la carpeta
                  </label>
                  <input
                    type="text"
                    required
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Ej. Semestre 2026, Anatomía, Simulacros..."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-sky-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Descripción breve (opcional)
                  </label>
                  <input
                    type="text"
                    value={newFolderDesc}
                    onChange={(e) => setNewFolderDesc(e.target.value)}
                    placeholder="Ej. Material para el segundo examen parcial..."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-sky-600"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Guardar Carpeta
                </button>
              </div>
            </form>
          )}

          {/* Inline Full Workspace Backup & Restore Drawer */}
          {isBackupDrawerOpen && (
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>Respaldo Completo Portátil (PC ↔ Celular sin Base de Datos)</span>
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-[68ch]">
                    Guarda o restaura <strong>todas tus carpetas ({folders.length})</strong>,{' '}
                    <strong>exámenes ({exams.length})</strong> e{' '}
                    <strong>historial de intentos ({attemptsCount})</strong> en un único archivo{' '}
                    <code className="font-mono">.json</code>. Ideal para conservar tus evaluaciones de cada 8 semanas en WhatsApp, Google Drive o en tu teléfono sin necesidad de cuentas ni servidores.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsBackupDrawerOpen(false);
                    setPendingBackupPayload(null);
                    setBackupError(null);
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer shrink-0"
                >
                  Cerrar
                </button>
              </div>

              {backupError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">▲ ERROR AL LEER EL ARCHIVO DE RESPALDO</p>
                    <p className="text-red-800 mt-0.5">{backupError}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Export Card */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono font-semibold text-sky-700 uppercase">
                      1. Exportar todo tu progreso
                    </span>
                    <h4 className="text-xs font-bold text-slate-900">
                      Descargar copia completa actual
                    </h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Incluye tu estructura jerárquica de carpetas, todos los cuestionarios JSON importados y las métricas de tus intentos realizados.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                      {folders.length} carpetas · {exams.length} exámenes · {attemptsCount} intentos
                    </span>
                    <button
                      type="button"
                      onClick={handleTriggerBackupDownload}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Descargar Respaldo</span>
                    </button>
                  </div>
                </div>

                {/* Import / Restore Card */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono font-semibold text-emerald-700 uppercase">
                      2. Cargar en celular u otra PC
                    </span>
                    <h4 className="text-xs font-bold text-slate-900">
                      Restaurar desde archivo de respaldo
                    </h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Selecciona un archivo <code className="font-mono">respaldo-examinajson-*.json</code> previamente descargado para recuperar o fusionar tus exámenes.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500">
                      Compatible con Android, iOS y PC
                    </span>
                    <button
                      type="button"
                      onClick={() => backupFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Seleccionar Respaldo (.json)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Confirmation step when a backup file is loaded */}
              {pendingBackupPayload && (
                <div className="p-4 rounded-xl bg-white border border-sky-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        ● Archivo de respaldo listo para aplicar
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        Contiene {pendingBackupPayload.stats.folderCount} carpetas,{' '}
                        {pendingBackupPayload.stats.examCount} exámenes y{' '}
                        {pendingBackupPayload.stats.attemptCount} intentos registrados.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-slate-700">Modo de restauración:</span>
                      <button
                        type="button"
                        onClick={() => setBackupRestoreStrategy('merge')}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                          backupRestoreStrategy === 'merge'
                            ? 'bg-sky-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Combinar con mis exámenes actuales (Recomendado)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBackupRestoreStrategy('replace')}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                          backupRestoreStrategy === 'replace'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Reemplazar todo
                      </button>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPendingBackupPayload(null)}
                        className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmBackupRestore}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Aplicar Respaldo Ahora</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Inline Import JSON Exam Drawer */}
          {isImportingModalOpen && (
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900">
                    Guardar nuevo examen JSON en «{currentFolder ? currentFolder.name : 'Inicio'}»
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Sube un archivo <code className="font-mono">.json</code> desde tu dispositivo o pega el bloque JSON que te dio tu IA.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsImportingModalOpen(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Cerrar
                </button>
              </div>

              {importError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">▲ ERROR AL VALIDAR EL JSON</p>
                    <p className="text-red-800 mt-0.5">{importError}</p>
                  </div>
                </div>
              )}

              <textarea
                value={pastedJson}
                onChange={(e) => setPastedJson(e.target.value)}
                rows={7}
                spellCheck={false}
                placeholder='Pega aquí el JSON generado por tu IA: { "titulo": "...", "preguntas": [...] }'
                className="w-full p-3 text-xs font-mono bg-slate-900 text-slate-100 rounded-lg border border-slate-800 focus:outline-none focus:border-sky-500"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Subir archivo .json</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => processImportedJsonString(pastedJson, false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Solo Guardar en Carpeta
                  </button>
                  <button
                    type="button"
                    onClick={() => processImportedJsonString(pastedJson, true)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Guardar e Iniciar Examen
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Subfolders Grid Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">
              {isSearching
                ? `Carpetas encontradas (${visibleFolders.length})`
                : currentFolder
                ? `Subcarpetas en ${currentFolder.name} (${visibleFolders.length})`
                : `Carpetas Principales (${visibleFolders.length})`}
            </h2>
            <button
              type="button"
              onClick={() => setIsCreatingFolder(true)}
              className="text-xs font-semibold text-sky-700 hover:text-sky-800 cursor-pointer"
            >
              + Añadir carpeta aquí
            </button>
          </div>

          {visibleFolders.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-slate-800">
                  No hay subcarpetas en este nivel
                </p>
                <p className="text-xs text-slate-500">
                  Puedes crear subcarpetas adicionales para dividir tus temas por unidad, parcial o módulo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingFolder(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Crear Subcarpeta</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleFolders.map((folder) => {
                const { subCount, examCount } = getFolderCounts(folder.id);
                return (
                  <div
                    key={folder.id}
                    onClick={() => {
                      setSearchQuery('');
                      onNavigateFolder(folder.id);
                    }}
                    className="group bg-white border border-slate-200 hover:border-sky-600 rounded-xl p-5 transition-colors cursor-pointer flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                          <Folder className="w-5 h-5" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFolderToDelete(folder);
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                          title="Eliminar carpeta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                          {folder.name}
                        </h3>
                        {folder.description && (
                          <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                            {folder.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Unboxed clean metadata footer */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-1.5 font-mono tabular-nums">
                        <span>{subCount} {subCount === 1 ? 'carpeta' : 'carpetas'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{examCount} {examCount === 1 ? 'examen' : 'exámenes'}</span>
                      </div>
                      <span className="font-semibold text-sky-700 inline-flex items-center gap-0.5">
                        <span>Abrir</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Exams in Current Folder Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">
              {isSearching
                ? `Exámenes encontrados (${visibleExams.length})`
                : currentFolder
                ? `Exámenes en ${currentFolder.name} (${visibleExams.length})`
                : `Exámenes en Inicio (${visibleExams.length})`}
            </h2>
          </div>

          {visibleExams.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
              <FileText className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">
                  No hay exámenes guardados directamente en «{currentFolder ? currentFolder.name : 'Inicio'}»
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Entra a una de las carpetas de arriba (como Cursos, Repaso o Exámenes) o importa un nuevo archivo JSON directamente en esta ubicación.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIsImportingModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Importar Examen JSON aquí</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleExams.map((item) => (
                <article
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors"
                >
                  <div className="space-y-2">
                    {/* Clean unboxed metadata */}
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-slate-700">{item.exam.subject}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{item.exam.questions.length} preguntas</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{item.exam.durationMinutes} min</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onDeleteExam(item.id)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                        title="Eliminar examen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {item.exam.title}
                    </h3>
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {item.exam.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    {/* Folder assignment selector */}
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span>Carpeta:</span>
                      <select
                        value={item.folderId || ''}
                        onChange={(e) =>
                          onMoveExam(item.id, e.target.value === '' ? null : e.target.value)
                        }
                        aria-label="Mover examen a otra carpeta"
                        className="bg-slate-100 text-slate-800 font-medium px-2 py-1 rounded border border-slate-200 text-[11px] focus:outline-none focus:border-sky-600 cursor-pointer"
                      >
                        <option value="">Inicio (Raíz)</option>
                        {folders.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.parentId ? `↳ ${f.name} (${getFolderNameById(f.parentId)})` : f.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {item.lastScorePercent !== undefined && (
                        <span className="text-xs font-mono font-semibold text-emerald-700 tabular-nums">
                          Última nota: {item.lastScorePercent}%
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenExamReport(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <BarChart3 className="w-3.5 h-3.5 text-sky-600" />
                        <span>Ver reporte</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenExam(item)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Resolver Examen</span>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Confirmation Modal for Deleting a Folder */}
      {folderToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-delete-folder-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
          onClick={() => setFolderToDelete(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-5 shadow-xl"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div className="space-y-1">
                <h3
                  id="modal-delete-folder-title"
                  className="text-base font-bold text-slate-900"
                >
                  ¿Eliminar la carpeta «{folderToDelete.name}»?
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Estás por eliminar esta carpeta de tu estructura de organización.
                  {(() => {
                    const { subCount, examCount } = getFolderCounts(folderToDelete.id);
                    if (subCount > 0 || examCount > 0) {
                      return ` Contiene ${subCount} ${
                        subCount === 1 ? 'subcarpeta' : 'subcarpetas'
                      } y ${examCount} ${
                        examCount === 1 ? 'examen' : 'exámenes'
                      }, los cuales se moverán automáticamente al nivel superior (${getFolderNameById(
                        folderToDelete.parentId
                      )}) para que no pierdas ningún cuestionario.`;
                    }
                    return ' Esta carpeta se encuentra vacía y se eliminará de forma permanente.';
                  })()}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setFolderToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteFolder(folderToDelete.id);
                  setFolderToDelete(null);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sí, eliminar carpeta</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
