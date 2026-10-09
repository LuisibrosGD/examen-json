import React, { useRef, useState } from 'react';
import {
  Upload,
  FileJson,
  CheckCircle2,
  AlertTriangle,
  Download,
  Sparkles,
  RotateCcw,
  Copy,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';
import { ExamSchema } from '../types/exam';
import { normalizeExamJson, serializeExamToStandardJson } from '../utils/examParser';
import { buildAiPromptTemplate } from '../data/presetExams';

interface JsonInspectorPanelProps {
  currentExam: ExamSchema;
  rawJsonText: string;
  onRawJsonChange: (text: string) => void;
  onExamLoaded: (exam: ExamSchema, rawText: string) => void;
  onOpenPromptAssistant: () => void;
}

export const JsonInspectorPanel: React.FC<JsonInspectorPanelProps> = ({
  currentExam,
  rawJsonText,
  onRawJsonChange,
  onExamLoaded,
  onOpenPromptAssistant,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedQuickPrompt, setCopiedQuickPrompt] = useState(false);
  const [isCodeVisible, setIsCodeVisible] = useState(false);

  const handleCopyGenericPrompt = async () => {
    const genericPrompt = buildAiPromptTemplate(10, 'Intermedio');
    try {
      await navigator.clipboard.writeText(genericPrompt);
      setCopiedQuickPrompt(true);
      setTimeout(() => setCopiedQuickPrompt(false), 2200);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = genericPrompt;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedQuickPrompt(true);
      setTimeout(() => setCopiedQuickPrompt(false), 2200);
    }
  };

  const validateAndApply = (inputJson: string, sourceLabel?: string) => {
    onRawJsonChange(inputJson);
    const result = normalizeExamJson(inputJson);
    if (!result.success || !result.exam) {
      setParseError(result.error || 'Formato JSON inválido.');
      setStatusMessage(null);
    } else {
      setParseError(null);
      setStatusMessage(
        sourceLabel
          ? `${sourceLabel}: ${result.exam.questions.length} preguntas cargadas`
          : `Esquema válido · ${result.exam.questions.length} preguntas listas`
      );
      onExamLoaded(result.exam, inputJson);
    }
  };

  const handleFileUpload = (file: File) => {
    if (
      !file.name.toLowerCase().endsWith('.json') &&
      file.type !== 'application/json' &&
      file.type !== 'text/plain'
    ) {
      setParseError('Por favor selecciona un archivo con extensión .json o texto plano.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      validateAndApply(content, `Archivo "${file.name}" importado`);
    };
    reader.onerror = () => {
      setParseError('No se pudo leer el archivo seleccionado.');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleFormatJson = () => {
    const formatted = serializeExamToStandardJson(currentExam);
    onRawJsonChange(formatted);
    setParseError(null);
    setStatusMessage('JSON formateado al estándar canónico');
  };

  const handleDownloadJson = () => {
    const content = serializeExamToStandardJson(currentExam);
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = currentExam.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    link.href = url;
    link.download = `${safeName || 'examen'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-5">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <p className="text-xs text-slate-500">
              Entrada de Datos · Validación en Vivo
            </p>
            <h2 className="text-base font-bold text-slate-900 mt-0.5">
              Importador y Editor JSON
            </h2>
          </div>
          <button
            type="button"
            onClick={onOpenPromptAssistant}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ver Prompt Completo</span>
          </button>
        </div>

        {/* Generic Chat Prompt Instruction Box for the User */}
        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-900">
              ¿Estudiando en un chat con IA?
            </span>
            <button
              type="button"
              onClick={handleCopyGenericPrompt}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedQuickPrompt ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>Prompt Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copiar Prompt Genérico</span>
                </>
              )}
            </button>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Pega este prompt en tu conversación actual con ChatGPT, Claude o Gemini. Le indicará: <em className="text-slate-800 font-medium">«Genera un examen en este formato JSON en base al tema de este chat»</em> junto con la estructura exacta a devolver.
          </p>
        </div>

        {/* File Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border border-dashed rounded-lg p-4 text-center transition-colors ${
            isDragging
              ? 'border-sky-600 bg-sky-50/60'
              : 'border-slate-300 bg-slate-50/70 hover:bg-slate-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json,text/plain"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
              e.target.value = '';
            }}
            className="hidden"
          />
          <div className="flex flex-col items-center gap-2">
            <FileJson className="w-6 h-6 text-slate-500" />
            <div className="text-xs text-slate-600">
              Arrastra tu archivo <code className="font-mono font-semibold text-slate-800">.json</code> aquí o{' '}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="font-semibold text-sky-700 hover:text-sky-800 underline cursor-pointer"
              >
                explora tu equipo
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Acepta archivos .json o bloques pegados directamente desde tu IA
            </p>
          </div>
        </div>

        {/* Validation Status Banner */}
        {parseError ? (
          <div
            role="alert"
            className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2.5"
          >
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">▲ ERROR DE ESQUEMA JSON</p>
              <p className="text-red-800 leading-relaxed">{parseError}</p>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-emerald-50/80 border border-emerald-200 text-emerald-950 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">
                {statusMessage || `● ESQUEMA VÁLIDO · ${currentExam.questions.length} PREGUNTAS`}
              </span>
            </div>
            <span className="font-mono text-[11px] text-emerald-800 tabular-nums shrink-0">
              {currentExam.durationMinutes} min
            </span>
          </div>
        )}

        {/* Live JSON Code Editor (Hidden by default, toggled via Eye button) */}
        <div className="pt-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700">
              Código Fuente del Examen (JSON)
            </span>
            <button
              type="button"
              onClick={() => setIsCodeVisible((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title={
                isCodeVisible
                  ? 'Ocultar Código Fuente del Examen (JSON)'
                  : 'Mostrar Código Fuente del Examen (JSON)'
              }
            >
              {isCodeVisible ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-slate-600" />
                  <span>Ocultar JSON</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-sky-600" />
                  <span>Mostrar JSON</span>
                </>
              )}
            </button>
          </div>

          {isCodeVisible && (
            <div className="mt-3 space-y-2.5">
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleFormatJson}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                  title="Formatear JSON actual"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Formatear</span>
                </button>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                  title="Descargar archivo .json"
                >
                  <Download className="w-3 h-3" />
                  <span>Exportar .json</span>
                </button>
              </div>

              <textarea
                id="json-editor-textarea"
                value={rawJsonText}
                onChange={(e) => onRawJsonChange(e.target.value)}
                spellCheck={false}
                rows={12}
                placeholder='Pega aquí el JSON generado por la IA (ej. { "titulo": "...", "preguntas": [...] })'
                className="w-full p-3.5 text-xs font-mono leading-relaxed bg-slate-900 text-slate-100 rounded-lg border border-slate-800 focus:outline-none focus:border-sky-500 resize-y"
              />
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Subir archivo .json</span>
            </button>

            {isCodeVisible ? (
              <button
                type="button"
                onClick={() => validateAndApply(rawJsonText, 'JSON aplicado')}
                className="flex-1 py-2 px-4 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Generar Cuestionario desde JSON
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDownloadJson}
                className="inline-flex items-center justify-center gap-1.5 flex-1 py-2 px-4 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar .json</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Supported Keys Reference Footer */}
      <div className="pt-4 border-t border-slate-200 text-[11px] text-slate-500 space-y-1">
        <p className="font-semibold text-slate-700">Claves JSON reconocidas automáticamente:</p>
        <p className="font-mono text-slate-600">
          preguntas / questions · pregunta / question · opciones / options · respuesta_correcta / correctAnswer · explicacion
        </p>
      </div>
    </aside>
  );
};
