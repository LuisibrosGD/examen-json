import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  CheckCheck,
  Clock,
  Award,
  Eye,
  SlidersHorizontal,
  Pause,
  Play,
  BarChart3,
  AlertTriangle,
  Bell,
  X,
  FileDown,
  Settings2,
  Plus,
  Minus,
} from 'lucide-react';
import { ExamSchema, ExamQuestion, ExamOption } from '../types/exam';
import {
  getQuestionCorrectIds,
  areAnswerSetsEqual,
  OPTION_LETTERS,
} from '../utils/examParser';
import { PdfPreviewModal, PdfPreviewTarget } from './PdfPreviewModal';

interface ToastNotification {
  id: string;
  variant: 'warning' | 'danger' | 'info';
  title: string;
  message: string;
}

interface InteractiveExamStageProps {
  exam: ExamSchema;
  onUpdateExam?: (updatedExam: ExamSchema) => void;
  onOpenReport: () => void;
  onFinishAttempt: (record: {
    scoreEarned: number;
    totalPoints: number;
    percentage: number;
    correctCount: number;
    totalQuestions: number;
    timeSpentSeconds: number;
    questionTimesSeconds: Record<string, number>;
    isActiveTime: boolean;
    passed: boolean;
  }) => void;
}

type ValidationMode = 'instant' | 'final';
type QuestionFilter = 'all' | 'unanswered' | 'incorrect';

export const InteractiveExamStage: React.FC<InteractiveExamStageProps> = ({
  exam,
  onUpdateExam,
  onOpenReport,
  onFinishAttempt,
}) => {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string[]>>({});
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [revealedQuestions, setRevealedQuestions] = useState<Record<string, boolean>>({});
  const [isStarted, setIsStarted] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitReason, setSubmitReason] = useState<'manual' | 'timeout-with-answers' | 'timeout-empty'>('manual');
  const [validationMode, setValidationMode] = useState<ValidationMode>('final');
  const [filter, setFilter] = useState<QuestionFilter>('all');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(
    exam.questions[0]?.id || null
  );
  const [questionTimesSeconds, setQuestionTimesSeconds] = useState<Record<string, number>>({});
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [pdfPreviewTarget, setPdfPreviewTarget] = useState<PdfPreviewTarget | null>(null);
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState<boolean>(() => {
    return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
  });

  const warned60Ref = useRef(false);
  const warned15Ref = useRef(false);
  const warnedExpiredRef = useRef(false);
  const questionCardRefs = useRef<Record<string, HTMLElement | null>>({});

  const pushToast = (
    variant: ToastNotification['variant'],
    title: string,
    message: string
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, variant, title, message }]);

    // Also trigger native Browser Notification if supported and granted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: message,
        });
      } catch {
        // Ignore browser notification restrictions inside sandboxed iframes
      }
    }

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6500);
  };

  const handleRequestBrowserNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      pushToast(
        'info',
        '● AVISOS EN PANTALLA ACTIVOS',
        'Tu navegador actual usa notificaciones tipo Toast integradas directamente en el visor.'
      );
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setBrowserNotificationsEnabled(true);
        pushToast(
          'info',
          '● ALERTAS DE NAVEGADOR ACTIVADAS',
          'Recibirás avisos tanto en pantalla (Toast UI) como del navegador cuando el examen esté por vencer.'
        );
      } else {
        pushToast(
          'warning',
          '▲ AVISOS LOCALES UI ACTIVOS',
          'El permiso del navegador fue denegado, pero seguirás viendo los Toasts flotantes en pantalla.'
        );
      }
    } catch {
      pushToast(
        'info',
        '● AVISOS EN PANTALLA ACTIVOS',
        'Recibirás notificaciones flotantes Toast UI cuando quede poco tiempo.'
      );
    }
  };

  const durationLimitSeconds = Math.max(1, Math.round((exam.durationMinutes || 15) * 60));
  const remainingSeconds = Math.max(0, durationLimitSeconds - elapsedSeconds);
  const isLowTime = !isSubmitted && remainingSeconds <= 60 && remainingSeconds > 0;

  // Reset state whenever a different exam ID is loaded
  useEffect(() => {
    setSelectedAnswers({});
    setEditingQuestionId(null);
    setRevealedQuestions({});
    setIsStarted(false);
    setIsSubmitted(false);
    setSubmitReason('manual');
    setFilter('all');
    setElapsedSeconds(0);
    setIsPaused(false);
    setActiveQuestionId(exam.questions[0]?.id || null);
    setQuestionTimesSeconds({});
    setToasts([]);
    warned60Ref.current = false;
    warned15Ref.current = false;
    warnedExpiredRef.current = false;
  }, [exam.id]);

  const totalQuestions = exam.questions.length;
  const answeredCount = exam.questions.filter(
    (q) => (selectedAnswers[q.id]?.length || 0) > 0
  ).length;

  const totalPoints = exam.questions.reduce((acc, q) => acc + (q.points || 1), 0);
  const scoreEarned = exam.questions.reduce((acc, q) => {
    const userChoices = selectedAnswers[q.id] || [];
    const correctIds = getQuestionCorrectIds(q);
    return areAnswerSetsEqual(userChoices, correctIds) ? acc + (q.points || 1) : acc;
  }, 0);
  const correctCount = exam.questions.filter((q) => {
    const userChoices = selectedAnswers[q.id] || [];
    const correctIds = getQuestionCorrectIds(q);
    return areAnswerSetsEqual(userChoices, correctIds);
  }).length;
  const percentage = totalPoints > 0 ? Math.round((scoreEarned / totalPoints) * 100) : 0;
  const passed = percentage >= exam.passingScorePercent;

  // Live active countdown timer while exam is started, active, and not paused
  useEffect(() => {
    if (!isStarted || isSubmitted || isPaused) return;
    const interval = setInterval(() => {
      if (document.hidden) return; // Only count active tab time
      setElapsedSeconds((prev) => prev + 1);
      if (activeQuestionId) {
        setQuestionTimesSeconds((prev) => ({
          ...prev,
          [activeQuestionId]: (prev[activeQuestionId] || 0) + 1,
        }));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isStarted, isSubmitted, isPaused, exam, activeQuestionId]);

  // Trigger warning toasts when exam is about to expire (60s and 15s remaining)
  useEffect(() => {
    if (!isStarted || isSubmitted || isPaused) return;

    if (
      durationLimitSeconds > 60 &&
      remainingSeconds === 60 &&
      !warned60Ref.current
    ) {
      warned60Ref.current = true;
      pushToast(
        'warning',
        '▲ QUEDA 1 MINUTO DE EXAMEN',
        `Llevas ${answeredCount} de ${totalQuestions} preguntas respondidas en «${exam.title}». Revisa tus respuestas antes de que el tiempo termine.`
      );
    }

    if (remainingSeconds === 15 && !warned15Ref.current) {
      warned15Ref.current = true;
      pushToast(
        'danger',
        '▲ ÚLTIMOS 15 SEGUNDOS',
        'El examen está a punto de cerrarse y calificarse automáticamente.'
      );
    }
  }, [
    remainingSeconds,
    durationLimitSeconds,
    isSubmitted,
    isPaused,
    answeredCount,
    totalQuestions,
    exam.title,
  ]);

  // Trigger automatic behavior and expiration toast when countdown hits 00:00
  useEffect(() => {
    if (!isStarted || isSubmitted) return;
    if (elapsedSeconds >= durationLimitSeconds) {
      const allRevealed: Record<string, boolean> = {};
      exam.questions.forEach((q) => {
        allRevealed[q.id] = true;
      });
      setRevealedQuestions(allRevealed);
      setIsSubmitted(true);
      setIsPaused(false);

      if (answeredCount === 0) {
        // Case 1: Time expired and 0 answers were selected
        setSubmitReason('timeout-empty');
        if (!warnedExpiredRef.current) {
          warnedExpiredRef.current = true;
          pushToast(
            'danger',
            '▲ TIEMPO AGOTADO SIN RESPUESTAS',
            `Finalizó el tiempo de «${exam.title}» sin respuestas seleccionadas. Se mostraron las claves de estudio.`
          );
        }
      } else {
        // Case 2: Time expired and user had selected answers without clicking submit
        setSubmitReason('timeout-with-answers');
        if (!warnedExpiredRef.current) {
          warnedExpiredRef.current = true;
          pushToast(
            'danger',
            '▲ TIEMPO AGOTADO · AUTO-CALIFICADO',
            `El tiempo terminó. Se calificaron automáticamente tus ${answeredCount} respuestas marcadas (${percentage}%).`
          );
        }
        onFinishAttempt({
          scoreEarned,
          totalPoints,
          percentage,
          correctCount,
          totalQuestions,
          timeSpentSeconds: durationLimitSeconds,
          questionTimesSeconds,
          isActiveTime: true,
          passed,
        });
      }
    }
  }, [
    elapsedSeconds,
    durationLimitSeconds,
    isStarted,
    isSubmitted,
    answeredCount,
    exam.questions,
    exam.title,
    onFinishAttempt,
    scoreEarned,
    totalPoints,
    percentage,
    correctCount,
    totalQuestions,
    questionTimesSeconds,
    passed,
  ]);

  const handleStartExam = () => {
    setSelectedAnswers({});
    setRevealedQuestions({});
    setIsSubmitted(false);
    setSubmitReason('manual');
    setFilter('all');
    setElapsedSeconds(0);
    setIsPaused(false);
    setActiveQuestionId(exam.questions[0]?.id || null);
    setQuestionTimesSeconds({});
    setToasts([]);
    warned60Ref.current = false;
    warned15Ref.current = false;
    warnedExpiredRef.current = false;
    setIsStarted(true);
    setTimeout(() => {
      const firstId = exam.questions[0]?.id;
      if (firstId && questionCardRefs.current[firstId]) {
        questionCardRefs.current[firstId]?.focus({ preventScroll: true });
      }
    }, 50);
  };

  const handleSelectOption = (question: ExamQuestion, optionId: string) => {
    if (!isStarted || isSubmitted || isPaused) return;
    const questionId = question.id;
    setActiveQuestionId(questionId);

    const correctIds = getQuestionCorrectIds(question);
    const isMultiCorrectQuestion = correctIds.length > 1;

    setSelectedAnswers((prev) => {
      const current = prev[questionId] || [];
      let nextSelection: string[];

      if (isMultiCorrectQuestion) {
        // Toggle option in array for multi-answer questions
        if (current.includes(optionId)) {
          nextSelection = current.filter((id) => id !== optionId);
        } else {
          nextSelection = [...current, optionId];
        }
      } else {
        // Single-answer question
        nextSelection = [optionId];
      }

      if (
        validationMode === 'instant' &&
        nextSelection.length >= correctIds.length
      ) {
        setRevealedQuestions((rPrev) => ({
          ...rPrev,
          [questionId]: true,
        }));
      }

      return {
        ...prev,
        [questionId]: nextSelection,
      };
    });
  };

  // Allow modifying the number of alternatives (min 2, max 7) for a question and syncing to JSON
  const handleChangeOptionCount = (questionId: string, targetCount: number) => {
    if (!onUpdateExam) return;
    const clampedCount = Math.max(2, Math.min(7, targetCount));

    const updatedQuestions = exam.questions.map((q) => {
      if (q.id !== questionId) return q;
      const currentOptions = [...q.options];
      let nextOptions: ExamOption[];

      if (clampedCount <= currentOptions.length) {
        nextOptions = currentOptions.slice(0, clampedCount);
      } else {
        nextOptions = [...currentOptions];
        for (let idx = currentOptions.length; idx < clampedCount; idx++) {
          const letter = OPTION_LETTERS[idx] || String(idx + 1);
          nextOptions.push({
            id: letter,
            label: letter,
            text: `Alternativa ${letter}`,
          });
        }
      }

      const validOptionIds = new Set(nextOptions.map((o) => o.id));
      const existingCorrect = getQuestionCorrectIds(q).filter((id) =>
        validOptionIds.has(id)
      );
      const nextCorrectIds =
        existingCorrect.length > 0 ? existingCorrect : [nextOptions[0].id];

      return {
        ...q,
        options: nextOptions,
        correctOptionId: nextCorrectIds[0],
        correctOptionIds: nextCorrectIds,
      };
    });

    onUpdateExam({
      ...exam,
      questions: updatedQuestions,
    });
  };

  // Allow toggling which options are correct (1, 2, or more correct answers) and syncing to JSON
  const handleToggleCorrectAnswerKey = (questionId: string, optionId: string) => {
    if (!onUpdateExam) return;

    const updatedQuestions = exam.questions.map((q) => {
      if (q.id !== questionId) return q;
      const currentCorrect = getQuestionCorrectIds(q);
      let nextCorrect: string[];

      if (currentCorrect.includes(optionId)) {
        // Keep at least 1 correct answer per question
        if (currentCorrect.length <= 1) return q;
        nextCorrect = currentCorrect.filter((id) => id !== optionId);
      } else {
        nextCorrect = [...currentCorrect, optionId].sort();
      }

      return {
        ...q,
        correctOptionId: nextCorrect[0],
        correctOptionIds: nextCorrect,
      };
    });

    onUpdateExam({
      ...exam,
      questions: updatedQuestions,
    });
  };

  // Allow editing the text of an option directly when customizing alternatives
  const handleChangeOptionText = (
    questionId: string,
    optionId: string,
    newText: string
  ) => {
    if (!onUpdateExam) return;
    const updatedQuestions = exam.questions.map((q) => {
      if (q.id !== questionId) return q;
      return {
        ...q,
        options: q.options.map((opt) =>
          opt.id === optionId ? { ...opt, text: newText } : opt
        ),
      };
    });
    onUpdateExam({
      ...exam,
      questions: updatedQuestions,
    });
  };

  const handleToggleRevealSingle = (questionId: string) => {
    setRevealedQuestions((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  const handleSubmitExam = () => {
    const allRevealed: Record<string, boolean> = {};
    exam.questions.forEach((q) => {
      allRevealed[q.id] = true;
    });
    setRevealedQuestions(allRevealed);
    setSubmitReason('manual');
    setIsSubmitted(true);
    setIsPaused(false);
    onFinishAttempt({
      scoreEarned,
      totalPoints,
      percentage,
      correctCount,
      totalQuestions,
      timeSpentSeconds: Math.min(elapsedSeconds, durationLimitSeconds),
      questionTimesSeconds,
      isActiveTime: true,
      passed,
    });
  };

  const handleResetExam = () => {
    setSelectedAnswers({});
    setRevealedQuestions({});
    setIsSubmitted(false);
    setSubmitReason('manual');
    setFilter('all');
    setElapsedSeconds(0);
    setIsPaused(false);
    setActiveQuestionId(exam.questions[0]?.id || null);
    setQuestionTimesSeconds({});
    setToasts([]);
    warned60Ref.current = false;
    warned15Ref.current = false;
    warnedExpiredRef.current = false;
    setIsStarted(true);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const filteredQuestions = exam.questions.filter((q) => {
    const userChoices = selectedAnswers[q.id] || [];
    if (filter === 'unanswered') {
      return userChoices.length === 0;
    }
    if (filter === 'incorrect') {
      const isRevealed = isSubmitted || revealedQuestions[q.id];
      if (!isRevealed) return false;
      return !areAnswerSetsEqual(userChoices, getQuestionCorrectIds(q));
    }
    return true;
  });

  // Keyboard Arrow Navigation between Exam Questions during an active attempt
  useEffect(() => {
    if (!isStarted || isSubmitted || isPaused || pdfPreviewTarget) return;

    const handleQuestionArrowKeys = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      // Do not hijack arrow keys when the user is typing inside an input, textarea, or select
      const targetEl = e.target as HTMLElement | null;
      if (
        targetEl &&
        (targetEl.tagName === 'INPUT' ||
          targetEl.tagName === 'TEXTAREA' ||
          targetEl.tagName === 'SELECT' ||
          targetEl.isContentEditable)
      ) {
        return;
      }

      if (
        e.key !== 'ArrowDown' &&
        e.key !== 'ArrowRight' &&
        e.key !== 'ArrowUp' &&
        e.key !== 'ArrowLeft'
      ) {
        return;
      }

      if (filteredQuestions.length === 0) return;

      e.preventDefault();
      const currentIdx = filteredQuestions.findIndex((q) => q.id === activeQuestionId);
      let nextIdx = 0;

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        nextIdx =
          currentIdx < 0
            ? 0
            : Math.min(filteredQuestions.length - 1, currentIdx + 1);
      } else {
        nextIdx = currentIdx <= 0 ? 0 : currentIdx - 1;
      }

      const targetQuestion = filteredQuestions[nextIdx];
      if (targetQuestion) {
        setActiveQuestionId(targetQuestion.id);
        const cardEl = questionCardRefs.current[targetQuestion.id];
        if (cardEl) {
          cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          cardEl.focus({ preventScroll: true });
        }
      }
    };

    window.addEventListener('keydown', handleQuestionArrowKeys);
    return () => window.removeEventListener('keydown', handleQuestionArrowKeys);
  }, [filteredQuestions, activeQuestionId, isStarted, isSubmitted, isPaused, pdfPreviewTarget]);

  return (
    <div className="space-y-6">
      {/* Floating Toast UI Notification Stack */}
      {toasts.length > 0 && (
        <div
          aria-live="assertive"
          className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
        >
          {toasts.map((toast) => {
            const isDanger = toast.variant === 'danger';
            const isWarning = toast.variant === 'warning';
            return (
              <div
                key={toast.id}
                role="alert"
                className={`pointer-events-auto p-4 rounded-xl border bg-white text-slate-900 shadow-xl flex items-start justify-between gap-3 transition-opacity duration-150 ${
                  isDanger
                    ? 'border-red-500'
                    : isWarning
                    ? 'border-amber-500'
                    : 'border-sky-500'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isDanger
                        ? 'bg-red-600 text-white'
                        : isWarning
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-sky-600 text-white'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                  </div>
                  <div className="space-y-1 text-xs">
                    <p
                      className={`font-bold tracking-tight ${
                        isDanger
                          ? 'text-red-600 dark:text-red-400'
                          : isWarning
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-sky-700 dark:text-sky-400'
                      }`}
                    >
                      {toast.title}
                    </p>
                    <p className="leading-relaxed text-slate-700 font-medium">
                      {toast.message}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setToasts((prev) => prev.filter((item) => item.id !== toast.id))
                  }
                  className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer shrink-0"
                  title="Cerrar aviso"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Exam Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-5 border-b border-slate-200">
          <div className="space-y-1.5">
            {/* Clean unboxed metadata with typographic separators */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{exam.subject}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{totalQuestions} preguntas</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">Mínimo aprobatorio: {exam.passingScorePercent}%</span>
              <span aria-hidden="true">·</span>
              <span
                className={`inline-flex items-center gap-1 font-mono tabular-nums font-semibold ${
                  !isStarted
                    ? 'text-slate-600'
                    : remainingSeconds === 0
                    ? 'text-red-600'
                    : isLowTime
                    ? 'text-amber-600'
                    : 'text-slate-700'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {!isStarted
                    ? `Duración asignada: ${formatTime(durationLimitSeconds)}`
                    : `Tiempo activo restante: ${formatTime(remainingSeconds)} / ${formatTime(durationLimitSeconds)}`}
                </span>
              </span>
              {isStarted && !isSubmitted && (
                <button
                  type="button"
                  onClick={() => setIsPaused((p) => !p)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                >
                  {isPaused ? (
                    <>
                      <Play className="w-3 h-3 text-emerald-600" />
                      <span>Reanudar</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-3 h-3 text-slate-500" />
                      <span>Pausar</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              {exam.title}
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              {exam.description}
            </p>
          </div>

          {/* Interactive Mode Switcher & Report Access */}
          <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              {!browserNotificationsEnabled && (
                <button
                  type="button"
                  onClick={handleRequestBrowserNotifications}
                  title="Activar notificaciones del navegador al estar por vencer el tiempo"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5 text-amber-500" />
                  <span>Avisos del navegador</span>
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  setPdfPreviewTarget({
                    mode: 'exam',
                    options: {
                      exam,
                      selectedAnswers,
                      includeAnswerKey: false,
                      isSubmitted,
                      elapsedSeconds: isSubmitted ? elapsedSeconds : undefined,
                    },
                  })
                }
                title="Previsualizar y descargar el examen actual en formato PDF"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 text-sky-600" />
                <span>Previsualizar / PDF</span>
              </button>
              <button
                type="button"
                onClick={onOpenReport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Ver reporte</span>
              </button>
            </div>
            <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3" />
              Modo de validación de clave
            </span>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setValidationMode('final')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  validationMode === 'final'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Al Finalizar Examen
              </button>
              <button
                type="button"
                onClick={() => setValidationMode('instant')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  validationMode === 'instant'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Validación Instantánea
              </button>
            </div>
          </div>
        </div>

        {/* Progress & Filter Bar (Only shown once exam is started) */}
        {isStarted && (
          <div className="pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-600">
                  Progreso de respuestas
                </span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {answeredCount} / {totalQuestions} respondidas ({Math.round((answeredCount / Math.max(1, totalQuestions)) * 100)}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-600 transition-transform duration-200 origin-left"
                  style={{
                    transform: `scaleX(${answeredCount / Math.max(1, totalQuestions)})`,
                  }}
                />
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todas ({totalQuestions})
              </button>
              <button
                type="button"
                onClick={() => setFilter('unanswered')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filter === 'unanswered'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pendientes ({totalQuestions - answeredCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('incorrect')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filter === 'incorrect'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Con Error
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Prominent Start Exam Stage before the attempt begins */}
      {!isStarted ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 md:p-10 text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center mx-auto">
            <Play className="w-7 h-7 fill-current ml-0.5" />
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
              ¿Listo para comenzar el examen?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              El cronómetro (<span className="font-mono font-semibold text-slate-900 tabular-nums">{formatTime(durationLimitSeconds)}</span>) y las <span className="font-mono font-semibold text-slate-900 tabular-nums">{totalQuestions}</span> preguntas se activarán únicamente cuando presiones el botón <strong className="text-slate-900">Iniciar Examen</strong>.
            </p>
          </div>

          <div className="pt-1 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              data-start-exam-button="true"
              onClick={handleStartExam}
              className="inline-flex items-center justify-center gap-2.5 px-8 py-4 text-sm md:text-base font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-md hover:shadow-lg transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Iniciar Examen</span>
            </button>
          </div>

          <p className="text-[11px] font-mono text-slate-400">
            Atajo rápido: presiona <kbd className="font-semibold text-slate-600">Alt + S</kbd> para iniciar o enfocar el examen
          </p>
        </div>
      ) : (
        <>

      {/* Results Summary Banner when Submitted */}
      {isSubmitted && (
        <div
          className={`border rounded-xl p-6 transition-opacity duration-200 ${
            submitReason === 'timeout-empty'
              ? 'bg-red-50/70 border-red-200 text-red-950'
              : passed
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              : 'bg-amber-50/70 border-amber-200 text-amber-950'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-wide">
                <Award
                  className={`w-4 h-4 ${
                    submitReason === 'timeout-empty'
                      ? 'text-red-600'
                      : passed
                      ? 'text-emerald-600'
                      : 'text-amber-600'
                  }`}
                />
                <span>
                  {submitReason === 'timeout-empty'
                    ? '▲ TIEMPO AGOTADO SIN RESPUESTAS (0% · NO REGISTRADO EN HISTORIAL)'
                    : submitReason === 'timeout-with-answers'
                    ? passed
                      ? '● TIEMPO AGOTADO · AUTO-CALIFICADO: APROBADO'
                      : '▲ TIEMPO AGOTADO · AUTO-CALIFICADO: REQUIERE REPASO'
                    : passed
                    ? '● ENTREGADO A TIEMPO · RESULTADO: APROBADO'
                    : '▲ ENTREGADO A TIEMPO · RESULTADO: REQUIERE REPASO'}
                </span>
              </div>

              <h2 className="text-2xl font-bold text-slate-900">
                Calificación Final: <span className="font-mono tabular-nums">{percentage}%</span> ({correctCount} de {totalQuestions} aciertos)
              </h2>

              <p className="text-xs text-slate-700 leading-relaxed">
                {submitReason === 'timeout-empty' ? (
                  <>
                    El límite de <span className="font-mono font-semibold tabular-nums">{exam.durationMinutes}:00 min</span> finalizó sin que se seleccionara ninguna respuesta. Se han revelado las claves correctas para estudio, pero este intento en blanco no se guardó en tu historial.
                  </>
                ) : submitReason === 'timeout-with-answers' ? (
                  <>
                    El tiempo límite (<span className="font-mono font-semibold tabular-nums">{exam.durationMinutes}:00 min</span>) terminó antes de pulsar calificar. El sistema evaluó y guardó automáticamente las <span className="font-mono font-semibold tabular-nums">{answeredCount}</span> respuestas que habías marcado (<span className="font-mono font-semibold tabular-nums">{scoreEarned} / {totalPoints} pts</span>).
                  </>
                ) : (
                  <>
                    Entregado antes del límite · Puntaje obtenido: <span className="font-mono font-semibold tabular-nums">{scoreEarned} / {totalPoints} pts</span> · Tiempo empleado: <span className="font-mono font-semibold tabular-nums">{formatTime(elapsedSeconds)}</span> (sobraron <span className="font-mono font-semibold tabular-nums">{formatTime(remainingSeconds)}</span>).
                  </>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() =>
                  setPdfPreviewTarget({
                    mode: 'exam',
                    options: {
                      exam,
                      selectedAnswers,
                      includeAnswerKey: true,
                      isSubmitted: true,
                      elapsedSeconds,
                    },
                  })
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 text-sky-600" />
                <span>Previsualizar PDF con Resultados</span>
              </button>
              <button
                type="button"
                onClick={onOpenReport}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Ver reporte</span>
              </button>
              <button
                type="button"
                onClick={handleResetExam}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reintentar Examen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Questions List */}
      {filteredQuestions.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <HelpCircle className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-base font-semibold text-slate-900">
            No hay preguntas que coincidan con este filtro
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Cambia el filtro a "Todas" para visualizar el cuestionario completo.
          </p>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className="px-4 py-2 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Mostrar todas las preguntas
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredQuestions.map((q: ExamQuestion) => {
            const userChoices = selectedAnswers[q.id] || [];
            const hasAnswered = userChoices.length > 0;
            const correctIds = getQuestionCorrectIds(q);
            const isMultiCorrect = correctIds.length > 1;
            const isRevealed = isSubmitted || Boolean(revealedQuestions[q.id]);
            const isCorrect = areAnswerSetsEqual(userChoices, correctIds);
            const isEditingQuestion = editingQuestionId === q.id;

            return (
              <article
                key={q.id}
                ref={(el) => {
                  questionCardRefs.current[q.id] = el;
                }}
                tabIndex={-1}
                data-exam-question-card="true"
                onClick={() => {
                  if (!isSubmitted && !isPaused) setActiveQuestionId(q.id);
                }}
                onMouseEnter={() => {
                  if (!isSubmitted && !isPaused) setActiveQuestionId(q.id);
                }}
                onFocus={() => {
                  if (!isSubmitted && !isPaused) setActiveQuestionId(q.id);
                }}
                className={`bg-white border rounded-xl p-6 space-y-5 transition-colors focus:outline-none ${
                  !isSubmitted && activeQuestionId === q.id
                    ? 'border-sky-500 ring-1 ring-sky-500/30'
                    : 'border-slate-200'
                }`}
              >
                {/* Question Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-slate-800 tabular-nums">
                        Pregunta {String(q.number).padStart(2, '0')}
                      </span>
                      {q.category && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{q.category}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {q.points} {q.points === 1 ? 'punto' : 'puntos'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {q.options.length} alternativas
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`font-semibold ${
                          isMultiCorrect ? 'text-sky-700' : 'text-slate-600'
                        }`}
                      >
                        {isMultiCorrect
                          ? `Selecciona ${correctIds.length} respuestas correctas`
                          : '1 respuesta correcta'}
                      </span>
                    </div>
                    <h3 className="text-base md:text-lg font-semibold text-slate-900 leading-snug">
                      {q.question}
                    </h3>
                  </div>

                  {/* Right Actions: Status Indicator + Question Key/Alternatives Configurator */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    {onUpdateExam && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditingQuestionId((prev) =>
                            prev === q.id ? null : q.id
                          )
                        }
                        title="Modificar alternativas (2 a 7) y respuestas correctas de esta pregunta"
                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          isEditingQuestion
                            ? 'bg-sky-50 border-sky-300 text-sky-800'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <Settings2 className="w-3 h-3" />
                        <span>Editar Claves / Opciones</span>
                      </button>
                    )}

                    {/* Explicit Dual-Coded Status Indicator when Revealed */}
                    {isRevealed ? (
                      hasAnswered ? (
                        isCorrect ? (
                          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 shrink-0">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>● CORRECTA</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 shrink-0">
                            <XCircle className="w-4 h-4 text-red-600" />
                            <span>▲ INCORRECTA</span>
                          </div>
                        )
                      ) : (
                        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 shrink-0">
                          <HelpCircle className="w-4 h-4 text-amber-600" />
                          <span>▲ SIN RESPONDER</span>
                        </div>
                      )
                    ) : (
                      hasAnswered && (
                        <button
                          type="button"
                          onClick={() => handleToggleRevealSingle(q.id)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-800 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Verificar respuesta</span>
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Inline Configurator for Alternatives (2-7) & Multiple Correct Answers */}
                {isEditingQuestion && onUpdateExam && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-200">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-900 block">
                          Configurar Alternativas y Respuestas Correctas (Se refleja en el JSON)
                        </span>
                        <span className="text-[11px] text-slate-500 block">
                          Ajusta entre 2 y 7 alternativas y marca 1, 2 o más opciones como respuestas correctas.
                        </span>
                      </div>

                      {/* Option Count Selector (2 to 7) */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700">
                          N.º de alternativas:
                        </span>
                        <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
                          <button
                            type="button"
                            disabled={q.options.length <= 2}
                            onClick={() =>
                              handleChangeOptionCount(q.id, q.options.length - 1)
                            }
                            className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-40 cursor-pointer disabled:cursor-default"
                            title="Quitar última alternativa (mínimo 2)"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2 font-mono text-xs font-bold text-slate-900 tabular-nums">
                            {q.options.length}
                          </span>
                          <button
                            type="button"
                            disabled={q.options.length >= 7}
                            onClick={() =>
                              handleChangeOptionCount(q.id, q.options.length + 1)
                            }
                            className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-40 cursor-pointer disabled:cursor-default"
                            title="Agregar alternativa (máximo 7)"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Correct Answer Multi-Toggle Chips + Option Text Editor */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">
                          Haz clic en las letras para marcar o desmarcar las respuestas correctas (mín. 1):
                        </span>
                        <span className="font-mono font-bold text-emerald-700">
                          Claves activas: [{correctIds.join(', ')}]
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        {q.options.map((opt) => {
                          const isKeyCorrect = correctIds.includes(opt.id);
                          return (
                            <div
                              key={opt.id}
                              className="flex items-center gap-2"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleCorrectAnswerKey(q.id, opt.id)
                                }
                                className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold border transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
                                  isKeyCorrect
                                    ? 'bg-emerald-600 border-emerald-600 text-white'
                                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                                }`}
                                title={
                                  isKeyCorrect
                                    ? 'Opción marcada como correcta (clic para alternar)'
                                    : 'Marcar esta opción como correcta'
                                }
                              >
                                <span>{opt.label}</span>
                                <span>{isKeyCorrect ? '✓ Correcta' : 'Incorrecta'}</span>
                              </button>
                              <input
                                type="text"
                                value={opt.text}
                                onChange={(e) =>
                                  handleChangeOptionText(
                                    q.id,
                                    opt.id,
                                    e.target.value
                                  )
                                }
                                aria-label={`Texto de la alternativa ${opt.label}`}
                                className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-sky-600"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Options Grid */}
                <div className="grid grid-cols-1 gap-2.5" role="group" aria-label={q.question}>
                  {q.options.map((opt) => {
                    const isSelected = userChoices.includes(opt.id);
                    const isOptionCorrect = correctIds.includes(opt.id);

                    let optionStyle =
                      'border-slate-200 bg-slate-50/60 hover:bg-slate-100/80 hover:border-slate-300 text-slate-800';
                    let badgeStyle = 'bg-white border border-slate-300 text-slate-700';
                    let statusTag: React.ReactNode = null;

                    if (isRevealed) {
                      if (isOptionCorrect) {
                        optionStyle = 'border-emerald-500 bg-emerald-50/70 text-emerald-950';
                        badgeStyle = 'bg-emerald-600 border-emerald-600 text-white';
                        statusTag = (
                          <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1 shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>
                              {isSelected ? 'Correcta (Marcada)' : 'Clave Correcta'}
                            </span>
                          </span>
                        );
                      } else if (isSelected && !isOptionCorrect) {
                        optionStyle = 'border-red-400 bg-red-50/70 text-red-950';
                        badgeStyle = 'bg-red-600 border-red-600 text-white';
                        statusTag = (
                          <span className="text-xs font-semibold text-red-800 flex items-center gap-1 shrink-0">
                            <XCircle className="w-3.5 h-3.5 text-red-600" />
                            <span>Tu selección</span>
                          </span>
                        );
                      } else {
                        optionStyle = 'border-slate-200 bg-white text-slate-500 opacity-75';
                      }
                    } else if (isSelected) {
                      optionStyle = 'border-sky-600 bg-sky-50/70 text-slate-900';
                      badgeStyle = 'bg-sky-600 border-sky-600 text-white';
                      statusTag = (
                        <span className="text-xs font-semibold text-sky-800 shrink-0">
                          Seleccionada
                        </span>
                      );
                    }

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={isSubmitted}
                        onClick={() => handleSelectOption(q, opt.id)}
                        className={`w-full text-left p-3.5 rounded-lg border transition-colors flex items-center justify-between gap-4 cursor-pointer disabled:cursor-default ${optionStyle}`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`w-6 h-6 rounded-md font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${badgeStyle}`}
                          >
                            {opt.label}
                          </span>
                          <span className="text-sm leading-relaxed">{opt.text}</span>
                        </div>
                        {statusTag}
                      </button>
                    );
                  })}
                </div>

                {/* Explanation Callout */}
                {isRevealed && (
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
                    <div className="font-semibold text-slate-900 flex items-center justify-between">
                      <span>
                        Fundamentación de la Clave (
                        {correctIds.length > 1
                          ? `Opciones Correctas: ${correctIds.join(', ')}`
                          : `Opción ${correctIds[0]}`}
                        )
                      </span>
                      {!isSubmitted && (
                        <button
                          type="button"
                          onClick={() => handleToggleRevealSingle(q.id)}
                          className="text-[11px] font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          Ocultar clave
                        </button>
                      )}
                    </div>
                    <p className="leading-relaxed text-slate-600">
                      {q.explanation ||
                        `De acuerdo con la clave de respuestas del archivo JSON, ${
                          correctIds.length > 1
                            ? `las opciones correctas son: ${correctIds.join(', ')}`
                            : `la opción correcta es la "${correctIds[0]}"`
                        }.`}
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Bottom Action Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-slate-600">
          {isSubmitted ? (
            <span>
              Evaluación finalizada · Calificación registrada: <strong className="font-mono text-slate-900 tabular-nums">{percentage}%</strong>
            </span>
          ) : (
            <span>
              Has respondido <strong className="font-mono text-slate-900 tabular-nums">{answeredCount}</strong> de{' '}
              <strong className="font-mono text-slate-900 tabular-nums">{totalQuestions}</strong> preguntas. Puedes calificar el examen en cualquier momento.
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleResetExam}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reiniciar Respuestas</span>
          </button>

          {!isSubmitted && (
            <button
              type="button"
              onClick={handleSubmitExam}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Calificar Examen Completo</span>
            </button>
          )}
        </div>
      </div>
        </>
      )}

      {/* PDF Live Preview Modal */}
      {pdfPreviewTarget && (
        <PdfPreviewModal
          target={pdfPreviewTarget}
          onClose={() => setPdfPreviewTarget(null)}
        />
      )}
    </div>
  );
};
