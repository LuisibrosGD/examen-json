import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Play,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Award,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Calendar,
  Hash,
  FileDown,
} from 'lucide-react';
import { ExamAttemptRecord, ExamSchema } from '../types/exam';
import { PdfPreviewModal, PdfPreviewTarget } from './PdfPreviewModal';

export type ReportPeriodFilter =
  | 'today'
  | '7d'
  | '15d'
  | '30d'
  | '1y'
  | 'all';

interface ExamReportViewProps {
  exam: ExamSchema;
  libraryItemId?: string | null;
  currentUserId: string;
  allAttempts: ExamAttemptRecord[];
  onBackToFolder: () => void;
  onStartExam: () => void;
}

const PERIOD_OPTIONS: { id: ReportPeriodFilter; label: string }[] = [
  { id: 'today', label: 'Hoy' },
  { id: '7d', label: 'Últimos 7 días' },
  { id: '15d', label: 'Últimos 15 días' },
  { id: '30d', label: 'Últimos 30 días' },
  { id: '1y', label: 'Último año' },
  { id: 'all', label: 'Todo el historial' },
];

export function formatReadableDuration(seconds?: number | null): string {
  if (seconds === undefined || seconds === null || Number.isNaN(seconds) || seconds < 0) {
    return 'Sin datos';
  }
  const rounded = Math.round(seconds);
  const hrs = Math.floor(rounded / 3600);
  const mins = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;

  if (hrs > 0) {
    return `${hrs} h ${mins} min ${secs} s`;
  }
  if (mins > 0) {
    return `${mins} min ${secs} s`;
  }
  return `${secs} s`;
}

function getAttemptTimestampMs(attempt: ExamAttemptRecord): number {
  if (typeof attempt.timestamp === 'number' && !Number.isNaN(attempt.timestamp)) {
    return attempt.timestamp;
  }
  // Fallback: extract timestamp from id "attempt-172844..." if present
  const match = attempt.id.match(/attempt-(\d{10,})/);
  if (match) {
    return parseInt(match[1], 10);
  }
  const parsed = Date.parse(attempt.completedAt);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }
  return Date.now();
}

function formatLocalDateTime(ts: number): { dateStr: string; timeStr: string; fullStr: string; shortAxis: string } {
  const d = new Date(ts);
  const dateStr = d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = d.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const shortAxis = d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
  }) + ' ' + d.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return {
    dateStr,
    timeStr,
    fullStr: `${dateStr} · ${timeStr}`,
    shortAxis,
  };
}

export const ExamReportView: React.FC<ExamReportViewProps> = ({
  exam,
  libraryItemId,
  currentUserId,
  allAttempts,
  onBackToFolder,
  onStartExam,
}) => {
  const [period, setPeriod] = useState<ReportPeriodFilter>('all');
  const [hoveredAttemptNumber, setHoveredAttemptNumber] = useState<number | null>(null);
  const [selectedAttemptNumber, setSelectedAttemptNumber] = useState<number | null>(null);
  const [pdfPreviewTarget, setPdfPreviewTarget] = useState<PdfPreviewTarget | null>(null);

  // Filter attempts belonging strictly to the current user, this exam, and completed status
  const completedExamAttemptsAsc = useMemo(() => {
    const filtered = allAttempts.filter((a) => {
      // Only current user's results (legacy records without userId belong to local user)
      if (a.userId && a.userId !== currentUserId) return false;
      // Exclude incomplete attempts
      if (a.completed === false) return false;
      // Match exam by libraryItemId, examId, or title
      const matchesLibId = libraryItemId && a.libraryItemId && a.libraryItemId === libraryItemId;
      const matchesExamId = a.examId && a.examId === exam.id;
      const matchesTitle = !a.examId && a.examTitle === exam.title;
      return Boolean(matchesLibId || matchesExamId || matchesTitle);
    });

    // Sort oldest to newest to assign chronological Attempt Number (#1, #2, #3...)
    return [...filtered].sort((a, b) => getAttemptTimestampMs(a) - getAttemptTimestampMs(b));
  }, [allAttempts, currentUserId, exam.id, exam.title, libraryItemId]);

  // Attach chronological attemptNumber & resolved timestamp
  const numberedAttemptsAsc = useMemo(() => {
    return completedExamAttemptsAsc.map((record, index) => {
      const ts = getAttemptTimestampMs(record);
      return {
        ...record,
        attemptNumber: index + 1,
        resolvedTimestamp: ts,
        formattedDate: formatLocalDateTime(ts),
      };
    });
  }, [completedExamAttemptsAsc]);

  // Filter by selected time period in user's local timezone
  const periodAttemptsAsc = useMemo(() => {
    if (period === 'all') return numberedAttemptsAsc;

    const now = new Date();
    let cutoffMs = 0;

    if (period === 'today') {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      cutoffMs = startOfToday.getTime();
    } else if (period === '7d') {
      cutoffMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    } else if (period === '15d') {
      cutoffMs = now.getTime() - 15 * 24 * 60 * 60 * 1000;
    } else if (period === '30d') {
      cutoffMs = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    } else if (period === '1y') {
      cutoffMs = now.getTime() - 365 * 24 * 60 * 60 * 1000;
    }

    return numberedAttemptsAsc.filter((item) => item.resolvedTimestamp >= cutoffMs);
  }, [numberedAttemptsAsc, period]);

  // Descending list for the attempts table (newest to oldest)
  const periodAttemptsDesc = useMemo(() => {
    return [...periodAttemptsAsc].reverse();
  }, [periodAttemptsAsc]);

  // 1. Counts
  const totalCompletedAllTime = numberedAttemptsAsc.length;
  const totalInPeriod = periodAttemptsAsc.length;

  // 3. Performance Summary Metrics (within selected period)
  const summaryStats = useMemo(() => {
    if (periodAttemptsAsc.length === 0) {
      return null;
    }

    const percentages = periodAttemptsAsc.map((a) => a.percentage);
    const bestPercent = Math.max(...percentages);
    const avgPercent = Math.round(
      percentages.reduce((acc, val) => acc + val, 0) / percentages.length
    );

    const firstAttempt = periodAttemptsAsc[0];
    const lastAttempt = periodAttemptsAsc[periodAttemptsAsc.length - 1];

    const bestPointsAttempt = periodAttemptsAsc.reduce((best, cur) =>
      cur.percentage >= best.percentage ? cur : best
    );

    const avgPointsEarned =
      Math.round(
        (periodAttemptsAsc.reduce((acc, a) => acc + a.scoreEarned, 0) /
          periodAttemptsAsc.length) *
          10
      ) / 10;

    // Difference in points (and percentage points) between first and last in period
    const diffPercentagePoints = lastAttempt.percentage - firstAttempt.percentage;
    const diffRawPoints =
      Math.round((lastAttempt.scoreEarned - firstAttempt.scoreEarned) * 10) / 10;

    return {
      bestPercent,
      bestScoreEarned: bestPointsAttempt.scoreEarned,
      bestTotalPoints: bestPointsAttempt.totalPoints,
      avgPercent,
      avgPointsEarned,
      lastAttempt,
      firstAttempt,
      diffPercentagePoints,
      diffRawPoints,
      hasMultipleAttempts: periodAttemptsAsc.length >= 2,
    };
  }, [periodAttemptsAsc]);

  // 4. Time Metrics (excluding legacy records without valid duration)
  const timeStats = useMemo(() => {
    const validDurationAttempts = periodAttemptsAsc.filter(
      (a) =>
        typeof a.timeSpentSeconds === 'number' &&
        !Number.isNaN(a.timeSpentSeconds) &&
        a.timeSpentSeconds >= 0
    );

    const avgDurationSeconds =
      validDurationAttempts.length > 0
        ? Math.round(
            validDurationAttempts.reduce((acc, a) => acc + (a.timeSpentSeconds || 0), 0) /
              validDurationAttempts.length
          )
        : null;

    // Check if real per-question times were recorded
    const attemptsWithQuestionTimes = periodAttemptsAsc.filter(
      (a) => a.questionTimesSeconds && Object.keys(a.questionTimesSeconds).length > 0
    );

    let avgTimePerQuestionSeconds: number | null = null;
    if (attemptsWithQuestionTimes.length > 0) {
      let totalQSeconds = 0;
      let totalQCount = 0;
      attemptsWithQuestionTimes.forEach((a) => {
        const values = Object.values(a.questionTimesSeconds || {});
        values.forEach((sec) => {
          if (typeof sec === 'number' && sec >= 0) {
            totalQSeconds += sec;
            totalQCount += 1;
          }
        });
      });
      if (totalQCount > 0) {
        avgTimePerQuestionSeconds = Math.round((totalQSeconds / totalQCount) * 10) / 10;
      }
    }

    return {
      avgDurationSeconds,
      validDurationCount: validDurationAttempts.length,
      avgTimePerQuestionSeconds,
    };
  }, [periodAttemptsAsc]);

  const activePointNumber = hoveredAttemptNumber ?? selectedAttemptNumber ?? (periodAttemptsAsc.length > 0 ? periodAttemptsAsc[periodAttemptsAsc.length - 1].attemptNumber : null);
  const activePointData = periodAttemptsAsc.find((a) => a.attemptNumber === activePointNumber) || null;

  // SVG Chart dimensions & coordinate math
  const svgWidth = 760;
  const svgHeight = 250;
  const padLeft = 48;
  const padRight = 28;
  const padTop = 24;
  const padBottom = 48;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const chartPoints = useMemo(() => {
    const count = periodAttemptsAsc.length;
    if (count === 0) return [];
    return periodAttemptsAsc.map((item, idx) => {
      // Equally spaced along horizontal axis so multiple attempts on the same day never overlap
      const x =
        count === 1
          ? padLeft + plotWidth / 2
          : padLeft + (idx / (count - 1)) * plotWidth;
      const clampedScore = Math.max(0, Math.min(100, item.percentage));
      const y = padTop + plotHeight - (clampedScore / 100) * plotHeight;
      return {
        x,
        y,
        item,
      };
    });
  }, [periodAttemptsAsc, plotWidth, plotHeight]);

  const polylinePoints = chartPoints.map((pt) => `${pt.x},${pt.y}`).join(' ');
  const passingY =
    padTop + plotHeight - (Math.max(0, Math.min(100, exam.passingScorePercent)) / 100) * plotHeight;

  return (
    <div className="space-y-6">
      {/* Top Report Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-5 border-b border-slate-200">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <button
                type="button"
                onClick={onBackToFolder}
                className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:text-sky-800 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver a la carpeta</span>
              </button>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-slate-700">{exam.subject}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{exam.questions.length} preguntas</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">Aprobatorio: {exam.passingScorePercent}%</span>
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              Reporte de Rendimiento: {exam.title}
            </h1>
            <p className="text-xs text-slate-500">
              Estadísticas individuales del estudiante en su zona horaria local ({Intl.DateTimeFormat().resolvedOptions().timeZone}). Se excluyen intentos en blanco o incompletos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() =>
                setPdfPreviewTarget({
                  mode: 'exam',
                  options: {
                    exam,
                    includeAnswerKey: false,
                  },
                })
              }
              title="Previsualizar y descargar el cuestionario en formato PDF"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-slate-600" />
              <span>Vista Previa Examen PDF</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setPdfPreviewTarget({
                  mode: 'report',
                  options: {
                    exam,
                    periodLabel:
                      PERIOD_OPTIONS.find((p) => p.id === period)?.label || 'Todo el historial',
                    totalCompletedAllTime,
                    totalInPeriod,
                    summaryStats,
                    timeStats,
                    attemptsDesc: periodAttemptsDesc,
                  },
                })
              }
              title="Previsualizar y descargar este reporte de resultados en formato PDF"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-sky-600" />
              <span>Previsualizar Reporte PDF</span>
            </button>
            <button
              type="button"
              onClick={onStartExam}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Ir al Examen</span>
            </button>
          </div>
        </div>

        {/* Section 1: Attempt Counts & Global Period Filter Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="block text-[11px] font-medium text-slate-500">
                Total histórico completado
              </span>
              <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                {totalCompletedAllTime} {totalCompletedAllTime === 1 ? 'intento' : 'intentos'}
              </span>
            </div>

            <div className="h-8 w-px bg-slate-200 hidden sm:block" />

            <div>
              <span className="block text-[11px] font-medium text-slate-500">
                En el periodo seleccionado ({PERIOD_OPTIONS.find((p) => p.id === period)?.label})
              </span>
              <span className="text-lg font-bold font-mono text-sky-700 tabular-nums">
                {totalInPeriod} {totalInPeriod === 1 ? 'intento' : 'intentos'}
              </span>
            </div>
          </div>

          {/* Unified Temporal Filter */}
          <div className="flex items-center flex-wrap gap-1 p-1 bg-slate-100 rounded-lg">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriod(opt.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  period === opt.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {totalInPeriod === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <BarChart3 className="w-8 h-8 text-slate-400 mx-auto" />
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900">
              No hay intentos completados en este periodo
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {totalCompletedAllTime > 0
                ? 'Tienes intentos registrados en otras fechas. Cambia el filtro a «Todo el historial» o realiza un nuevo intento.'
                : 'Aún no has completado ningún intento calificable para este examen. Resuelve el cuestionario para generar tu curva de evolución y métricas de tiempo.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            {period !== 'all' && totalCompletedAllTime > 0 && (
              <button
                type="button"
                onClick={() => setPeriod('all')}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Ver todo el historial ({totalCompletedAllTime})
              </button>
            )}
            <button
              type="button"
              onClick={onStartExam}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Realizar Intento Ahora</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Section 3: Performance Summary Cards (4 KPI Cards + Time Summary) */}
          {summaryStats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Best Score */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold">Mejor Calificación</span>
                  <Award className="w-4 h-4 text-emerald-600 shrink-0" />
                </div>
                <div>
                  <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    {summaryStats.bestPercent}%
                  </div>
                  <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                    {summaryStats.bestScoreEarned} / {summaryStats.bestTotalPoints} puntos
                  </p>
                </div>
              </div>

              {/* Card 2: Average Score */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold">Calificación Promedio</span>
                  <BarChart3 className="w-4 h-4 text-sky-600 shrink-0" />
                </div>
                <div>
                  <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    {summaryStats.avgPercent}%
                  </div>
                  <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                    Promedio: {summaryStats.avgPointsEarned} pts ({totalInPeriod} {totalInPeriod === 1 ? 'intento' : 'intentos'})
                  </p>
                </div>
              </div>

              {/* Card 3: Last Attempt Score */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold">Último Intento (#{summaryStats.lastAttempt.attemptNumber})</span>
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                </div>
                <div>
                  <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    {summaryStats.lastAttempt.percentage}%
                  </div>
                  <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                    {summaryStats.lastAttempt.scoreEarned} / {summaryStats.lastAttempt.totalPoints} puntos
                  </p>
                </div>
              </div>

              {/* Card 4: Difference between first and last in period */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold">Evolución en el Periodo</span>
                  {!summaryStats.hasMultipleAttempts ? (
                    <Minus className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : summaryStats.diffRawPoints > 0 || summaryStats.diffPercentagePoints > 0 ? (
                    <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : summaryStats.diffRawPoints < 0 || summaryStats.diffPercentagePoints < 0 ? (
                    <TrendingDown className="w-4 h-4 text-amber-600 shrink-0" />
                  ) : (
                    <Minus className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </div>

                {!summaryStats.hasMultipleAttempts ? (
                  <div>
                    <div className="text-sm font-bold text-slate-800">
                      Falta otro intento para comparar
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Completa al menos 2 intentos en este periodo para medir tu progreso.
                    </p>
                  </div>
                ) : (
                  <div>
                    <div
                      className={`text-lg font-bold font-mono tabular-nums ${
                        summaryStats.diffRawPoints > 0 || summaryStats.diffPercentagePoints > 0
                          ? 'text-emerald-700'
                          : summaryStats.diffRawPoints < 0 || summaryStats.diffPercentagePoints < 0
                          ? 'text-amber-700'
                          : 'text-slate-900'
                      }`}
                    >
                      {summaryStats.diffRawPoints > 0
                        ? `Subiste ${summaryStats.diffRawPoints} ${
                            Math.abs(summaryStats.diffRawPoints) === 1 ? 'punto' : 'puntos'
                          }`
                        : summaryStats.diffRawPoints < 0
                        ? `Bajaste ${Math.abs(summaryStats.diffRawPoints)} ${
                            Math.abs(summaryStats.diffRawPoints) === 1 ? 'punto' : 'puntos'
                          }`
                        : summaryStats.diffPercentagePoints > 0
                        ? `Subiste ${summaryStats.diffPercentagePoints} puntos (%)`
                        : summaryStats.diffPercentagePoints < 0
                        ? `Bajaste ${Math.abs(summaryStats.diffPercentagePoints)} puntos (%)`
                        : 'Sin variación (0 puntos)'}
                    </div>
                    <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                      Intento #{summaryStats.firstAttempt.attemptNumber} ({summaryStats.firstAttempt.scoreEarned} pts / {summaryStats.firstAttempt.percentage}%) → #{summaryStats.lastAttempt.attemptNumber} ({summaryStats.lastAttempt.scoreEarned} pts / {summaryStats.lastAttempt.percentage}%)
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 2: Score Evolution Line Chart */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <p className="text-xs text-slate-500">
                  Escala 0% – 100% · Pasa el cursor o selecciona un punto para inspeccionar el intento
                </p>
                <h2 className="text-lg font-bold text-slate-900">
                  Evolución de la Calificación por Intento
                </h2>
              </div>

              {/* Active Point Inspector Callout */}
              {activePointData && (
                <div className="px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-mono font-bold text-sky-700 tabular-nums">
                    Intento #{activePointData.attemptNumber}
                  </span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="font-mono text-slate-600 tabular-nums">
                    {activePointData.formattedDate.fullStr}
                  </span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    Calificación: {activePointData.percentage}% ({activePointData.scoreEarned}/{activePointData.totalPoints} pts)
                  </span>
                </div>
              )}
            </div>

            {/* Responsive SVG Line Chart */}
            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full min-w-[560px] h-auto select-none"
                role="img"
                aria-label="Gráfico de evolución de calificaciones"
              >
                {/* Horizontal Grid Lines (0%, 25%, 50%, 75%, 100%) */}
                {[0, 25, 50, 75, 100].map((tick) => {
                  const y = padTop + plotHeight - (tick / 100) * plotHeight;
                  return (
                    <g key={tick}>
                      <line
                        x1={padLeft}
                        y1={y}
                        x2={svgWidth - padRight}
                        y2={y}
                        stroke="currentColor"
                        className="text-slate-200"
                        strokeWidth={1}
                      />
                      <text
                        x={padLeft - 8}
                        y={y + 4}
                        textAnchor="end"
                        className="text-[11px] font-mono fill-slate-500 tabular-nums"
                      >
                        {tick}%
                      </text>
                    </g>
                  );
                })}

                {/* Passing Threshold Dashed Line */}
                <line
                  x1={padLeft}
                  y1={passingY}
                  x2={svgWidth - padRight}
                  y2={passingY}
                  stroke="#059669"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />
                <text
                  x={svgWidth - padRight}
                  y={passingY - 5}
                  textAnchor="end"
                  className="text-[10px] font-mono fill-emerald-600 font-semibold"
                >
                  Aprobatorio ({exam.passingScorePercent}%)
                </text>

                {/* Connecting Polyline */}
                {chartPoints.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#0284C7"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={polylinePoints}
                  />
                )}

                {/* Individual Attempt Points & X-Axis Labels */}
                {chartPoints.map(({ x, y, item }) => {
                  const isSelected = activePointNumber === item.attemptNumber;
                  const showLabel =
                    chartPoints.length <= 8 ||
                    isSelected ||
                    item.attemptNumber === periodAttemptsAsc[0].attemptNumber ||
                    item.attemptNumber ===
                      periodAttemptsAsc[periodAttemptsAsc.length - 1].attemptNumber;

                  return (
                    <g
                      key={item.id}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredAttemptNumber(item.attemptNumber)}
                      onMouseLeave={() => setHoveredAttemptNumber(null)}
                      onClick={() => setSelectedAttemptNumber(item.attemptNumber)}
                    >
                      {/* Vertical guide on active point */}
                      {isSelected && (
                        <line
                          x1={x}
                          y1={padTop}
                          x2={x}
                          y2={padTop + plotHeight}
                          stroke="#0284C7"
                          strokeWidth={1}
                          strokeDasharray="2 2"
                        />
                      )}

                      {/* Invisible larger hit target */}
                      <circle cx={x} cy={y} r={14} fill="transparent" />

                      {/* Visible Point Circle */}
                      <circle
                        cx={x}
                        cy={y}
                        r={isSelected ? 6.5 : 4.5}
                        fill={item.passed ? '#059669' : '#D97706'}
                        stroke="#FFFFFF"
                        strokeWidth={2}
                      />

                      {/* Score tag above selected point */}
                      {isSelected && (
                        <text
                          x={x}
                          y={Math.max(14, y - 10)}
                          textAnchor="middle"
                          className="text-[11px] font-mono font-bold fill-slate-900 tabular-nums"
                        >
                          #{item.attemptNumber}: {item.percentage}%
                        </text>
                      )}

                      {/* X-Axis Date & Time Label */}
                      {showLabel && (
                        <text
                          x={x}
                          y={svgHeight - 16}
                          textAnchor="middle"
                          className="text-[10px] font-mono fill-slate-500 tabular-nums"
                        >
                          {item.formattedDate.shortAxis}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Section 4: Resolution Time Summary & Attempts Table */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <p className="text-xs text-slate-500">
                  Métricas de Tiempo Activo · Ordenado del más reciente al más antiguo
                </p>
                <h2 className="text-lg font-bold text-slate-900">
                  Tiempo de Resolución y Desglose de Intentos
                </h2>
              </div>

              {/* Time KPI Strip */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-sky-600 shrink-0" />
                  <div className="text-xs">
                    <span className="text-slate-500 block text-[11px]">
                      Duración promedio del periodo
                    </span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {timeStats.avgDurationSeconds !== null
                        ? formatReadableDuration(timeStats.avgDurationSeconds)
                        : 'Sin datos'}
                    </span>
                  </div>
                </div>

                {timeStats.avgTimePerQuestionSeconds !== null && (
                  <div className="px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2.5">
                    <Hash className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="text-xs">
                      <span className="text-slate-500 block text-[11px]">
                        Tiempo real promedio por pregunta
                      </span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        {formatReadableDuration(timeStats.avgTimePerQuestionSeconds)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Attempts Table (Newest to Oldest) */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                    <th className="py-2.5 pr-4">N.º Intento</th>
                    <th className="py-2.5 px-4">Fecha y Hora Local</th>
                    <th className="py-2.5 px-4">Estado</th>
                    <th className="py-2.5 px-4 text-right">Aciertos</th>
                    <th className="py-2.5 px-4 text-right">Puntaje</th>
                    <th className="py-2.5 px-4 text-right">Calificación</th>
                    <th className="py-2.5 pl-4 text-right">Duración</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {periodAttemptsDesc.map((attempt) => {
                    const hasValidDuration =
                      typeof attempt.timeSpentSeconds === 'number' &&
                      !Number.isNaN(attempt.timeSpentSeconds) &&
                      attempt.timeSpentSeconds >= 0;

                    return (
                      <tr
                        key={attempt.id}
                        onClick={() => setSelectedAttemptNumber(attempt.attemptNumber)}
                        className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                          activePointNumber === attempt.attemptNumber ? 'bg-sky-50/50' : ''
                        }`}
                      >
                        <td className="py-3 pr-4 font-mono font-bold text-slate-900 tabular-nums">
                          #{attempt.attemptNumber}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700 tabular-nums">
                          <span>{attempt.formattedDate.dateStr}</span>
                          <span aria-hidden="true" className="mx-1.5 text-slate-400">·</span>
                          <span className="text-slate-500">{attempt.formattedDate.timeStr}</span>
                        </td>
                        <td className="py-3 px-4">
                          {attempt.passed ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>APROBADO</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                              <span>REPASAR</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                          {attempt.correctCount} / {attempt.totalQuestions}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                          {attempt.scoreEarned} / {attempt.totalPoints} pts
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-slate-900">
                          {attempt.percentage}%
                        </td>
                        <td className="py-3 pl-4 text-right font-mono tabular-nums text-slate-700">
                          {hasValidDuration ? (
                            <span>
                              {formatReadableDuration(attempt.timeSpentSeconds)}
                              {attempt.isActiveTime === false && (
                                <span className="block text-[10px] text-slate-400">
                                  tiempo transcurrido
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-400">Sin datos</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
