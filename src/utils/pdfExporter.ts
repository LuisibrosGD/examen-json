import { jsPDF } from 'jspdf';
import { ExamSchema, ExamAttemptRecord } from '../types/exam';
import { getQuestionCorrectIds, areAnswerSetsEqual } from './examParser';
import { formatReadableDuration } from '../components/ExamReportView';

function sanitizeFileName(raw: string): string {
  return (
    raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'examen'
  );
}

/**
 * Normalizes Unicode characters outside WinAnsi / ISO-8859-1 (such as chemical
 * subscripts ₂, superscripts ²⁺, arrows →, mathematical symbols, etc.) so jsPDF's
 * built-in Helvetica font never switches into corrupt wide-character kerning or
 * overflows the page margin.
 */
function normalizePdfText(input: string | undefined | null): string {
  if (!input) return '';
  const charMap: Record<string, string> = {
    // Subscripts
    '₀': '0',
    '₁': '1',
    '₂': '2',
    '₃': '3',
    '₄': '4',
    '₅': '5',
    '₆': '6',
    '₇': '7',
    '₈': '8',
    '₉': '9',
    '₊': '+',
    '₋': '-',
    '₌': '=',
    '₍': '(',
    '₎': ')',
    // Superscripts
    '⁰': '0',
    '¹': '1',
    '²': '2',
    '³': '3',
    '⁴': '4',
    '⁵': '5',
    '⁶': '6',
    '⁷': '7',
    '⁸': '8',
    '⁹': '9',
    '⁺': '+',
    '⁻': '-',
    '⁼': '=',
    '⁽': '(',
    '⁾': ')',
    // Arrows & math symbols
    '→': '->',
    '←': '<-',
    '↔': '<->',
    '⇌': '<=>',
    '⇒': '=>',
    '≥': '>=',
    '≤': '<=',
    '≠': '!=',
    '≈': '~',
    '×': 'x',
    '÷': '/',
    '−': '-',
    '–': '-',
    '—': ' - ',
    '•': '-',
    '·': '-',
    '“': '"',
    '”': '"',
    '‘': "'",
    '’': "'",
    '«': '"',
    '»': '"',
    '…': '...',
    'α': 'alfa',
    'β': 'beta',
    'γ': 'gamma',
    'δ': 'delta',
    'Δ': 'Delta',
    'μ': 'u',
  };

  let out = '';
  for (const ch of input) {
    if (charMap[ch] !== undefined) {
      out += charMap[ch];
    } else if (ch.charCodeAt(0) <= 255) {
      out += ch;
    } else {
      // Fallback: strip combining diacritics if any exotic unicode remains
      const decomposed = ch.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
      out += decomposed
        .split('')
        .filter((c) => c.charCodeAt(0) <= 255)
        .join('');
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Renders an array of wrapped lines one by one with charSpace = 0 so jsPDF
 * never stretches or disperses characters across the line.
 */
function drawWrappedLines(
  doc: jsPDF,
  lines: string[],
  x: number,
  startY: number,
  lineHeight: number
): number {
  let currentY = startY;
  doc.setCharSpace(0);
  for (const line of lines) {
    doc.text(line, x, currentY, { charSpace: 0 });
    currentY += lineHeight;
  }
  return currentY;
}

export interface ExportExamPdfOptions {
  exam: ExamSchema;
  selectedAnswers?: Record<string, string | string[]>;
  includeAnswerKey?: boolean;
  isSubmitted?: boolean;
  elapsedSeconds?: number;
}

export interface GeneratedPdfDocument {
  doc: jsPDF;
  fileName: string;
  title: string;
  subtitle: string;
}

export function createExamPdfDocument({
  exam,
  selectedAnswers = {},
  includeAnswerKey = false,
  isSubmitted = false,
  elapsedSeconds,
}: ExportExamPdfOptions): GeneratedPdfDocument {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  doc.setCharSpace(0);

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 16;
  const contentWidth = pageWidth - margin * 2; // 178mm
  const safeWrapWidth = contentWidth - 6; // Extra safety margin so no word ever clips right
  let y = 16;

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 18) {
      doc.addPage();
      doc.setCharSpace(0);
      y = 18;
    }
  };

  const cleanTitle = normalizePdfText(exam.title);
  const cleanSubject = normalizePdfText(exam.subject || 'Cuestionario');
  const cleanDescription = normalizePdfText(exam.description);

  // Header Banner
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  const titleLines: string[] = doc.splitTextToSize(cleanTitle, contentWidth - 14);
  const bannerHeight = Math.max(28, 22 + titleLines.length * 5.5);

  doc.setFillColor(15, 23, 42); // Slate 900
  doc.roundedRect(margin, y, contentWidth, bannerHeight, 3, 3, 'F');

  doc.setTextColor(56, 189, 248); // Sky 400
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`EXAMINAJSON  |  ${cleanSubject.toUpperCase()}`, margin + 6, y + 7.5, {
    charSpace: 0,
  });

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  let headerY = drawWrappedLines(doc, titleLines, margin + 6, y + 14.5, 5.5);

  doc.setTextColor(203, 213, 225);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const generatedStr = normalizePdfText(
    new Date().toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  );
  doc.text(
    `Preguntas: ${exam.questions.length}   |   Duracion: ${exam.durationMinutes} min   |   Aprobatorio: ${exam.passingScorePercent}%   |   Fecha: ${generatedStr}`,
    margin + 6,
    headerY + 1.5,
    { charSpace: 0 }
  );

  y += bannerHeight + 6;

  // Exam Description
  if (cleanDescription) {
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const descLines: string[] = doc.splitTextToSize(cleanDescription, safeWrapWidth);
    ensureSpace(descLines.length * 4.6 + 4);
    y = drawWrappedLines(doc, descLines, margin, y, 4.6) + 2;
  }

  // Current Attempt Summary Box if user answered questions or submitted
  const getNormalizedChoices = (qId: string): string[] => {
    const raw = selectedAnswers[qId];
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  };

  const answeredCount = exam.questions.filter(
    (q) => getNormalizedChoices(q.id).length > 0
  ).length;
  if (isSubmitted || answeredCount > 0) {
    const totalPoints = exam.questions.reduce((acc, q) => acc + (q.points || 1), 0);
    const scoreEarned = exam.questions.reduce((acc, q) => {
      const choices = getNormalizedChoices(q.id);
      const correctIds = getQuestionCorrectIds(q);
      return areAnswerSetsEqual(choices, correctIds) ? acc + (q.points || 1) : acc;
    }, 0);
    const correctCount = exam.questions.filter((q) => {
      const choices = getNormalizedChoices(q.id);
      const correctIds = getQuestionCorrectIds(q);
      return areAnswerSetsEqual(choices, correctIds);
    }).length;
    const percentage = totalPoints > 0 ? Math.round((scoreEarned / totalPoints) * 100) : 0;
    const passed = percentage >= exam.passingScorePercent;

    ensureSpace(22);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y, contentWidth, 17, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(
      isSubmitted
        ? `RESUMEN DE EVALUACION: ${percentage}% (${passed ? 'APROBADO' : 'REQUIERE REPASO'})`
        : `PROGRESO DE RESPUESTAS MARCADAS (${answeredCount}/${exam.questions.length})`,
      margin + 4,
      y + 6.5,
      { charSpace: 0 }
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const timeLabel =
      typeof elapsedSeconds === 'number'
        ? `   |   Tiempo empleado: ${normalizePdfText(formatReadableDuration(elapsedSeconds))}`
        : '';
    doc.text(
      `Aciertos: ${correctCount} de ${exam.questions.length}   |   Puntaje: ${scoreEarned} / ${totalPoints} pts${timeLabel}`,
      margin + 4,
      y + 13,
      { charSpace: 0 }
    );

    y += 22;
  }

  // Divider line
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Render Each Question
  exam.questions.forEach((q) => {
    const userChoices = getNormalizedChoices(q.id);
    const hasAnswered = userChoices.length > 0;
    const correctIds = getQuestionCorrectIds(q);
    const isCorrect = areAnswerSetsEqual(userChoices, correctIds);

    const cleanCategory = q.category ? ` - ${normalizePdfText(q.category)}` : '';
    const multiHint =
      correctIds.length > 1 ? ` - [${correctIds.length} respuestas correctas]` : '';
    const qHeader = `Pregunta ${String(q.number).padStart(2, '0')}${cleanCategory} (${
      q.points
    } ${q.points === 1 ? 'pto' : 'ptos'})${multiHint}`;

    const cleanQuestionText = normalizePdfText(q.question);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const questionLines: string[] = doc.splitTextToSize(cleanQuestionText, safeWrapWidth);

    // Estimate block height so we avoid splitting a question header from its prompt
    const estimatedHeight =
      10 +
      questionLines.length * 4.8 +
      q.options.length * 6.5 +
      (includeAnswerKey ? 14 : 4);
    ensureSpace(Math.min(estimatedHeight, 68));

    // Question Meta + Status
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(2, 132, 199); // Sky 600
    doc.text(qHeader, margin, y, { charSpace: 0 });

    if (includeAnswerKey && hasAnswered) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      if (isCorrect) {
        doc.setTextColor(5, 150, 105); // Emerald 600
        doc.text('[CORRECTA]', pageWidth - margin, y, { align: 'right', charSpace: 0 });
      } else {
        doc.setTextColor(220, 38, 38); // Red 600
        doc.text('[INCORRECTA]', pageWidth - margin, y, { align: 'right', charSpace: 0 });
      }
    }

    y += 5;

    // Question Prompt
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    y = drawWrappedLines(doc, questionLines, margin, y, 4.8) + 1.5;

    // Options with clean hanging indent (badge on left, wrapped text aligned at margin + 12)
    const optionTextX = margin + 12;
    const optionWrapWidth = contentWidth - 16;

    q.options.forEach((opt) => {
      const isSelected = userChoices.includes(opt.id);
      const isOptionCorrect = correctIds.includes(opt.id);

      let suffix = '';
      if (includeAnswerKey) {
        if (isOptionCorrect && isSelected) {
          suffix = '  [Tu respuesta - Correcta]';
        } else if (isOptionCorrect) {
          suffix = '  [Clave correcta]';
        } else if (isSelected) {
          suffix = '  [Tu seleccion - Incorrecta]';
        }
      } else if (isSelected) {
        suffix = '  [Seleccionada]';
      }

      const isBoldOption = (includeAnswerKey && isOptionCorrect) || isSelected;
      doc.setFont('helvetica', isBoldOption ? 'bold' : 'normal');
      doc.setFontSize(9.2);

      const cleanOptText = `${normalizePdfText(opt.text)}${suffix}`;
      const optLines: string[] = doc.splitTextToSize(cleanOptText, optionWrapWidth);

      ensureSpace(optLines.length * 4.5 + 2.5);

      if (includeAnswerKey && isOptionCorrect) {
        doc.setTextColor(5, 150, 105);
      } else if (includeAnswerKey && isSelected && !isOptionCorrect) {
        doc.setTextColor(220, 38, 38);
      } else {
        doc.setTextColor(51, 65, 85);
      }

      // Draw option badge [A] at fixed left column
      doc.text(`[${normalizePdfText(opt.label)}]`, margin + 2, y, { charSpace: 0 });

      // Draw wrapped option lines at hanging indent X
      y = drawWrappedLines(doc, optLines, optionTextX, y, 4.5) + 1.2;
    });

    // Explanation block if includeAnswerKey is true
    if (includeAnswerKey) {
      const correctKeysStr = correctIds.join(', ');
      const rawExplanation =
        q.explanation || `Clave correcta: ${correctKeysStr}.`;
      const cleanExplanation = normalizePdfText(
        `Fundamentacion (Clave ${correctKeysStr}): ${rawExplanation}`
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);

      const expWrapWidth = contentWidth - 12;
      const expLines: string[] = doc.splitTextToSize(cleanExplanation, expWrapWidth);
      const boxHeight = expLines.length * 4.2 + 5;

      ensureSpace(boxHeight + 4);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin + 2, y - 3, contentWidth - 4, boxHeight, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      y = drawWrappedLines(doc, expLines, margin + 5, y + 1, 4.2) + 4;
    }

    y += 2;
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5.5;
  });

  // Add page numbers at the bottom
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setCharSpace(0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `ExaminaJSON  |  ${cleanTitle.slice(0, 65)}  |  Pagina ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center', charSpace: 0 }
    );
  }

  const suffix = includeAnswerKey ? 'con-clave' : 'para-resolver';
  return {
    doc,
    fileName: `${sanitizeFileName(exam.title)}-${suffix}.pdf`,
    title: `Vista Previa PDF: ${exam.title}`,
    subtitle: includeAnswerKey
      ? 'Incluye claves correctas, fundamentaciones y tus respuestas seleccionadas'
      : 'Versión limpia en blanco para resolver o imprimir sin claves visibles',
  };
}

export function downloadExamPdf(options: ExportExamPdfOptions): void {
  const { doc, fileName } = createExamPdfDocument(options);
  doc.save(fileName);
}

export interface NumberedAttemptForPdf extends ExamAttemptRecord {
  attemptNumber: number;
  formattedDate: {
    dateStr: string;
    timeStr: string;
    fullStr: string;
  };
}

export interface ExportExamReportPdfOptions {
  exam: ExamSchema;
  periodLabel: string;
  totalCompletedAllTime: number;
  totalInPeriod: number;
  summaryStats: {
    bestPercent: number;
    bestScoreEarned: number;
    bestTotalPoints: number;
    avgPercent: number;
    avgPointsEarned: number;
    lastAttempt: NumberedAttemptForPdf;
    firstAttempt: NumberedAttemptForPdf;
    diffPercentagePoints: number;
    diffRawPoints: number;
    hasMultipleAttempts: boolean;
  } | null;
  timeStats: {
    avgDurationSeconds: number | null;
    avgTimePerQuestionSeconds: number | null;
  };
  attemptsDesc: NumberedAttemptForPdf[];
}

export function createExamReportPdfDocument({
  exam,
  periodLabel,
  totalCompletedAllTime,
  totalInPeriod,
  summaryStats,
  timeStats,
  attemptsDesc,
}: ExportExamReportPdfOptions): GeneratedPdfDocument {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  doc.setCharSpace(0);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 18) {
      doc.addPage();
      doc.setCharSpace(0);
      y = 18;
    }
  };

  const cleanTitle = normalizePdfText(exam.title);
  const cleanSubject = normalizePdfText(exam.subject);
  const cleanPeriod = normalizePdfText(periodLabel);

  // Top Header Banner
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  const titleLines: string[] = doc.splitTextToSize(cleanTitle, contentWidth - 14);
  const bannerHeight = Math.max(29, 22 + titleLines.length * 5.5);

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, y, contentWidth, bannerHeight, 3, 3, 'F');

  doc.setTextColor(56, 189, 248);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('EXAMINAJSON  |  REPORTE INDIVIDUAL DE RENDIMIENTO', margin + 6, y + 7.5, {
    charSpace: 0,
  });

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  let headerY = drawWrappedLines(doc, titleLines, margin + 6, y + 14.5, 5.5);

  doc.setTextColor(203, 213, 225);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const generatedStr = normalizePdfText(
    new Date().toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  );
  doc.text(
    `Materia: ${cleanSubject}   |   Filtro: ${cleanPeriod}   |   Aprobatorio: ${exam.passingScorePercent}%   |   Exportado: ${generatedStr}`,
    margin + 6,
    headerY + 1.5,
    { charSpace: 0 }
  );

  y += bannerHeight + 7;

  // Section 1: Attempt Counts
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Resumen de Intentos y Rendimiento', margin, y, { charSpace: 0 });
  y += 5;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 16, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Total historico completado: ${totalCompletedAllTime} ${
      totalCompletedAllTime === 1 ? 'intento' : 'intentos'
    }`,
    margin + 5,
    y + 6.5,
    { charSpace: 0 }
  );
  doc.text(
    `Intentos en el periodo (${cleanPeriod}): ${totalInPeriod} ${
      totalInPeriod === 1 ? 'intento' : 'intentos'
    }`,
    margin + 5,
    y + 12.5,
    { charSpace: 0 }
  );

  y += 22;

  if (!summaryStats || totalInPeriod === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('No existen intentos completados en el periodo seleccionado.', margin, y, {
      charSpace: 0,
    });
  } else {
    // 4 KPI Boxes in 2x2 Grid
    const boxWidth = (contentWidth - 6) / 2;
    const boxHeight = 20;

    let diffText = 'Falta otro intento para comparar';
    if (summaryStats.hasMultipleAttempts) {
      if (summaryStats.diffRawPoints > 0) {
        diffText = `Subiste ${summaryStats.diffRawPoints} ${
          Math.abs(summaryStats.diffRawPoints) === 1 ? 'punto' : 'puntos'
        } (${
          summaryStats.diffPercentagePoints > 0
            ? `+${summaryStats.diffPercentagePoints}%`
            : `${summaryStats.diffPercentagePoints}%`
        })`;
      } else if (summaryStats.diffRawPoints < 0) {
        diffText = `Bajaste ${Math.abs(summaryStats.diffRawPoints)} ${
          Math.abs(summaryStats.diffRawPoints) === 1 ? 'punto' : 'puntos'
        } (${summaryStats.diffPercentagePoints}%)`;
      } else {
        diffText = 'Sin variacion (0 puntos)';
      }
    }

    const kpis = [
      {
        label: 'Mejor Calificacion',
        value: `${summaryStats.bestPercent}% (${summaryStats.bestScoreEarned}/${summaryStats.bestTotalPoints} pts)`,
      },
      {
        label: 'Calificacion Promedio',
        value: `${summaryStats.avgPercent}% (Prom: ${summaryStats.avgPointsEarned} pts)`,
      },
      {
        label: `Ultimo Intento (#${summaryStats.lastAttempt.attemptNumber})`,
        value: `${summaryStats.lastAttempt.percentage}% (${summaryStats.lastAttempt.scoreEarned}/${summaryStats.lastAttempt.totalPoints} pts)`,
      },
      {
        label: 'Evolucion en el Periodo',
        value: diffText,
      },
    ];

    kpis.forEach((kpi, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const bx = margin + col * (boxWidth + 6);
      const by = y + row * (boxHeight + 4);

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(bx, by, boxWidth, boxHeight, 2, 2, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(normalizePdfText(kpi.label), bx + 4, by + 7, { charSpace: 0 });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(normalizePdfText(kpi.value), bx + 4, by + 14.5, { charSpace: 0 });
    });

    y += (boxHeight + 4) * 2 + 4;

    // Section 2: Time Metrics
    ensureSpace(26);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('2. Metricas de Tiempo de Resolucion', margin, y, { charSpace: 0 });
    y += 5;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    const avgDurStr =
      timeStats.avgDurationSeconds !== null
        ? normalizePdfText(formatReadableDuration(timeStats.avgDurationSeconds))
        : 'Sin datos';
    const avgQStr =
      timeStats.avgTimePerQuestionSeconds !== null
        ? `   |   Promedio real por pregunta: ${normalizePdfText(
            formatReadableDuration(timeStats.avgTimePerQuestionSeconds)
          )}`
        : '';
    doc.text(`Duracion promedio del periodo: ${avgDurStr}${avgQStr}`, margin + 5, y + 9, {
      charSpace: 0,
    });

    y += 22;

    // Section 3: Attempts Table
    ensureSpace(25);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(
      '3. Historial de Intentos Completados (Mas reciente al mas antiguo)',
      margin,
      y,
      { charSpace: 0 }
    );
    y += 5;

    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);

    doc.text('Intento', margin + 3, y + 5.5, { charSpace: 0 });
    doc.text('Fecha y Hora Local', margin + 22, y + 5.5, { charSpace: 0 });
    doc.text('Estado', margin + 78, y + 5.5, { charSpace: 0 });
    doc.text('Aciertos', margin + 106, y + 5.5, { charSpace: 0 });
    doc.text('Puntaje', margin + 128, y + 5.5, { charSpace: 0 });
    doc.text('Calif.', margin + 150, y + 5.5, { charSpace: 0 });
    doc.text('Duracion', pageWidth - margin - 3, y + 5.5, { align: 'right', charSpace: 0 });

    y += 8;

    attemptsDesc.forEach((attempt, idx) => {
      ensureSpace(9);
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, 8, 'F');
      }

      const hasValidDuration =
        typeof attempt.timeSpentSeconds === 'number' &&
        !Number.isNaN(attempt.timeSpentSeconds) &&
        attempt.timeSpentSeconds >= 0;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`#${attempt.attemptNumber}`, margin + 3, y + 5.5, { charSpace: 0 });

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(
        normalizePdfText(`${attempt.formattedDate.dateStr} ${attempt.formattedDate.timeStr}`),
        margin + 22,
        y + 5.5,
        { charSpace: 0 }
      );

      doc.setFont('helvetica', 'bold');
      if (attempt.passed) {
        doc.setTextColor(5, 150, 105);
        doc.text('APROBADO', margin + 78, y + 5.5, { charSpace: 0 });
      } else {
        doc.setTextColor(217, 119, 6);
        doc.text('REPASAR', margin + 78, y + 5.5, { charSpace: 0 });
      }

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(`${attempt.correctCount}/${attempt.totalQuestions}`, margin + 106, y + 5.5, {
        charSpace: 0,
      });
      doc.text(`${attempt.scoreEarned}/${attempt.totalPoints}`, margin + 128, y + 5.5, {
        charSpace: 0,
      });

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`${attempt.percentage}%`, margin + 150, y + 5.5, { charSpace: 0 });

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(
        hasValidDuration
          ? normalizePdfText(formatReadableDuration(attempt.timeSpentSeconds))
          : 'Sin datos',
        pageWidth - margin - 3,
        y + 5.5,
        { align: 'right', charSpace: 0 }
      );

      y += 8;
      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y, pageWidth - margin, y);
    });
  }

  // Page footers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setCharSpace(0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `ExaminaJSON  |  Reporte de ${cleanTitle.slice(0, 55)}  |  Pagina ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center', charSpace: 0 }
    );
  }

  return {
    doc,
    fileName: `reporte-${sanitizeFileName(exam.title)}.pdf`,
    title: `Vista Previa del Reporte PDF: ${exam.title}`,
    subtitle: `Filtro aplicado: ${periodLabel} · ${totalInPeriod} ${
      totalInPeriod === 1 ? 'intento registrado' : 'intentos registrados'
    }`,
  };
}

export function downloadExamReportPdf(options: ExportExamReportPdfOptions): void {
  const { doc, fileName } = createExamReportPdfDocument(options);
  doc.save(fileName);
}
