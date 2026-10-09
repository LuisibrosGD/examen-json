import { ExamOption, ExamQuestion, ExamSchema } from '../types/exam';

export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

function cleanJsonInput(raw: string): string {
  let trimmed = raw.trim();
  // Strip ```json ... ``` or ``` ... ``` markdown wrappers that generative AI often outputs
  const codeBlockMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (codeBlockMatch) {
    trimmed = codeBlockMatch[1].trim();
  }
  return trimmed;
}

export function getQuestionCorrectIds(q: ExamQuestion): string[] {
  if (Array.isArray(q.correctOptionIds) && q.correctOptionIds.length > 0) {
    return q.correctOptionIds;
  }
  if (q.correctOptionId) {
    return [q.correctOptionId];
  }
  return [];
}

export function areAnswerSetsEqual(selected: string[], correct: string[]): boolean {
  if (selected.length === 0 || selected.length !== correct.length) return false;
  const normSelected = [...new Set(selected.map((s) => s.toUpperCase()))].sort();
  const normCorrect = [...new Set(correct.map((c) => c.toUpperCase()))].sort();
  if (normSelected.length !== normCorrect.length) return false;
  return normSelected.every((val, idx) => val === normCorrect[idx]);
}

function resolveSingleCorrectToken(
  token: string | number,
  options: ExamOption[]
): string | undefined {
  if (typeof token === 'number') {
    if (token >= 0 && token < options.length) {
      return options[token].id;
    }
    if (token >= 1 && token <= options.length) {
      return options[token - 1].id;
    }
    return undefined;
  }

  const cleanTarget = String(token).trim();
  if (!cleanTarget) return undefined;
  const upperTarget = cleanTarget.toUpperCase();

  // 1. Direct match on option id or label (e.g., "A", "B")
  const byId = options.find(
    (o) => o.id.toUpperCase() === upperTarget || o.label.toUpperCase() === upperTarget
  );
  if (byId) return byId.id;

  // 2. Match if token starts with "A)" or "B."
  const prefixMatch = cleanTarget.match(/^([A-Ga-g])[).:-]\s*/);
  if (prefixMatch) {
    const letter = prefixMatch[1].toUpperCase();
    const byPrefix = options.find(
      (o) => o.label.toUpperCase() === letter || o.id.toUpperCase() === letter
    );
    if (byPrefix) return byPrefix.id;
  }

  // 3. Exact or case-insensitive text match
  const strippedTarget = cleanTarget.replace(/^[A-Ga-g][).:-]\s+/, '').toLowerCase();
  const byText = options.find((o) => o.text.toLowerCase() === strippedTarget);
  if (byText) return byText.id;

  // 4. Numeric string index e.g. "0" or "1"
  if (/^\d+$/.test(cleanTarget)) {
    const num = parseInt(cleanTarget, 10);
    if (num >= 0 && num < options.length) {
      return options[num].id;
    }
  }

  return undefined;
}

export interface ParseResult {
  success: boolean;
  exam?: ExamSchema;
  error?: string;
  warnings: string[];
}

export function normalizeExamJson(rawInput: string): ParseResult {
  const warnings: string[] = [];
  const cleaned = cleanJsonInput(rawInput);

  if (!cleaned) {
    return {
      success: false,
      error:
        'El contenido JSON está vacío. Pega el JSON generado por tu IA o sube un archivo .json.',
      warnings,
    };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err: any) {
    return {
      success: false,
      error: `Error de sintaxis JSON: ${err?.message || 'Formato inválido'}. Asegúrate de copiar el bloque JSON completo.`,
      warnings,
    };
  }

  // Extract questions array from root or common Spanish/English keys
  let rawQuestions: any[] | undefined;
  let rootObj: any = {};

  if (Array.isArray(parsed)) {
    rawQuestions = parsed;
  } else if (parsed && typeof parsed === 'object') {
    rootObj = parsed;
    rawQuestions =
      parsed.preguntas ||
      parsed.questions ||
      parsed.items ||
      parsed.cuestionario ||
      parsed.examen?.preguntas ||
      parsed.examen?.questions ||
      parsed.quiz?.questions;
  }

  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    return {
      success: false,
      error:
        'No se encontró una lista de preguntas válida. El JSON debe incluir un arreglo "preguntas" o "questions" con al menos una pregunta.',
      warnings,
    };
  }

  const normalizedQuestions: ExamQuestion[] = [];

  for (let i = 0; i < rawQuestions.length; i++) {
    const q = rawQuestions[i];
    if (!q || typeof q !== 'object') {
      warnings.push(`La pregunta #${i + 1} fue omitida por no ser un objeto válido.`);
      continue;
    }

    const questionText = String(
      q.pregunta ?? q.question ?? q.enunciado ?? q.texto ?? q.title ?? q.stem ?? ''
    ).trim();

    if (!questionText) {
      return {
        success: false,
        error: `La pregunta #${i + 1} no contiene texto de enunciado ("pregunta" o "question").`,
        warnings,
      };
    }

    const rawOptions =
      q.opciones ??
      q.options ??
      q.alternativas ??
      q.choices ??
      q.respuestas ??
      q.answers;
    const options: ExamOption[] = [];

    if (Array.isArray(rawOptions) && rawOptions.length >= 2) {
      rawOptions.slice(0, 7).forEach((opt: any, idx: number) => {
        const label = OPTION_LETTERS[idx] || String(idx + 1);
        if (typeof opt === 'string' || typeof opt === 'number') {
          const rawStr = String(opt).trim();
          const stripped = rawStr.replace(/^[A-Ga-g][).:-]\s+/, '');
          options.push({
            id: label,
            label,
            text: stripped || rawStr,
          });
        } else if (opt && typeof opt === 'object') {
          const optId = String(opt.id ?? opt.letra ?? opt.key ?? opt.label ?? label)
            .trim()
            .toUpperCase();
          const optText = String(
            opt.texto ?? opt.text ?? opt.valor ?? opt.value ?? opt.label ?? ''
          ).trim();
          options.push({
            id: optId || label,
            label: optId.length <= 2 ? optId : label,
            text: optText || `Opción ${label}`,
          });
        }
      });
    } else if (rawOptions && typeof rawOptions === 'object' && !Array.isArray(rawOptions)) {
      const entries = Object.entries(rawOptions).slice(0, 7);
      entries.forEach(([key, val], idx) => {
        const label =
          key.trim().toUpperCase() || OPTION_LETTERS[idx] || String(idx + 1);
        options.push({
          id: label,
          label: label.length <= 2 ? label : OPTION_LETTERS[idx] || String(idx + 1),
          text: String(val).trim(),
        });
      });
    }

    if (options.length < 2) {
      return {
        success: false,
        error: `La pregunta #${i + 1} ("${questionText.slice(0, 45)}...") debe incluir entre 2 y 7 opciones de respuesta.`,
        warnings,
      };
    }

    // Resolve single or multiple correct answer keys
    const rawCorrect =
      q.respuestas_correctas ??
      q.respuestasCorrectas ??
      q.correct_answers ??
      q.correctAnswers ??
      q.respuesta_correcta ??
      q.respuestaCorrecta ??
      q.correct_answer ??
      q.correctAnswer ??
      q.correcta ??
      q.correct ??
      q.answer ??
      q.respuesta ??
      q.clave;

    const resolvedCorrectIds: string[] = [];

    // 1. Check if option objects have { correcta: true / isCorrect: true }
    if (Array.isArray(rawOptions)) {
      rawOptions.slice(0, 7).forEach((o: any, idx: number) => {
        if (
          o &&
          typeof o === 'object' &&
          (o.correcta === true || o.isCorrect === true || o.correct === true) &&
          options[idx]
        ) {
          resolvedCorrectIds.push(options[idx].id);
        }
      });
    }

    // 2. If rawCorrect is an array of keys e.g. ["A", "C"]
    if (resolvedCorrectIds.length === 0 && Array.isArray(rawCorrect)) {
      rawCorrect.forEach((item: any) => {
        const match = resolveSingleCorrectToken(item, options);
        if (match && !resolvedCorrectIds.includes(match)) {
          resolvedCorrectIds.push(match);
        }
      });
    }

    // 3. If rawCorrect is a string or number
    if (
      resolvedCorrectIds.length === 0 &&
      rawCorrect !== undefined &&
      rawCorrect !== null &&
      !Array.isArray(rawCorrect)
    ) {
      if (typeof rawCorrect === 'number') {
        const match = resolveSingleCorrectToken(rawCorrect, options);
        if (match) resolvedCorrectIds.push(match);
      } else if (typeof rawCorrect === 'string') {
        const cleanStr = rawCorrect.trim();
        // First try matching as a single option (in case an option text contains commas)
        const directSingle = resolveSingleCorrectToken(cleanStr, options);
        if (directSingle) {
          resolvedCorrectIds.push(directSingle);
        } else if (/[,;/]|\s+y\s+|\s+and\s+/i.test(cleanStr)) {
          // Split multiple letters e.g. "A, C" or "A y B"
          const tokens = cleanStr
            .split(/[,;/]|\s+y\s+|\s+and\s+/i)
            .map((t) => t.trim())
            .filter(Boolean);
          tokens.forEach((tok) => {
            const match = resolveSingleCorrectToken(tok, options);
            if (match && !resolvedCorrectIds.includes(match)) {
              resolvedCorrectIds.push(match);
            }
          });
        }
      }
    }

    if (resolvedCorrectIds.length === 0) {
      return {
        success: false,
        error: `No se pudo identificar la respuesta correcta para la pregunta #${i + 1} ("${questionText.slice(0, 40)}..."). Verifica el campo "respuesta_correcta" o "respuestas_correctas".`,
        warnings,
      };
    }

    const explanation = String(
      q.explicacion ??
        q.explanation ??
        q.justificacion ??
        q.rationale ??
        q.retroalimentacion ??
        ''
    ).trim();

    const category = String(
      q.categoria ?? q.category ?? q.tema ?? q.topic ?? ''
    ).trim();
    const points = Number(q.puntos ?? q.points ?? q.valor ?? 1) || 1;

    normalizedQuestions.push({
      id: String(q.id ?? `q-${i + 1}`),
      number: i + 1,
      category: category || undefined,
      question: questionText,
      options,
      correctOptionId: resolvedCorrectIds[0],
      correctOptionIds: resolvedCorrectIds,
      explanation: explanation || undefined,
      points,
    });
  }

  const title = String(
    rootObj.titulo ??
      rootObj.title ??
      rootObj.nombre ??
      rootObj.examen?.titulo ??
      'Examen Interactivo Generado'
  ).trim();

  const subject = String(
    rootObj.materia ??
      rootObj.subject ??
      rootObj.categoria ??
      rootObj.tema ??
      'Evaluación General'
  ).trim();

  const description = String(
    rootObj.descripcion ??
      rootObj.description ??
      rootObj.instrucciones ??
      'Selecciona la respuesta correcta para cada pregunta de opción múltiple.'
  ).trim();

  const rawSeconds = Number(
    rootObj.duracion_segundos ?? rootObj.durationSeconds ?? 0
  );
  const rawMinutes = Number(
    rootObj.duracion_minutos ??
      rootObj.durationMinutes ??
      rootObj.tiempo ??
      (rawSeconds > 0
        ? Number((rawSeconds / 60).toFixed(2))
        : Math.max(5, normalizedQuestions.length * 2))
  );
  const durationMinutes = rawMinutes > 0 ? rawMinutes : 15;

  const passingScorePercent =
    Number(
      rootObj.puntaje_aprobatorio ??
        rootObj.passingScorePercent ??
        rootObj.minScore ??
        70
    ) || 70;

  return {
    success: true,
    exam: {
      id: String(rootObj.id ?? `exam-${Date.now()}`),
      title,
      subject,
      description,
      durationMinutes,
      passingScorePercent,
      questions: normalizedQuestions,
    },
    warnings,
  };
}

export function serializeExamToStandardJson(exam: ExamSchema): string {
  const payload = {
    titulo: exam.title,
    materia: exam.subject,
    descripcion: exam.description,
    duracion_minutos: exam.durationMinutes,
    puntaje_aprobatorio: exam.passingScorePercent,
    preguntas: exam.questions.map((q) => {
      const correctIds = getQuestionCorrectIds(q);
      return {
        id: q.number,
        categoria: q.category || exam.subject,
        pregunta: q.question,
        cantidad_alternativas: q.options.length,
        opciones: q.options.map((o) => `${o.label}) ${o.text}`),
        respuesta_correcta: correctIds.length === 1 ? correctIds[0] : correctIds,
        respuestas_correctas: correctIds,
        explicacion: q.explanation || '',
        puntos: q.points,
      };
    }),
  };
  return JSON.stringify(payload, null, 2);
}
