import React, { useState, useEffect } from 'react';
import {
  Download,
  Eye,
  EyeOff,
  Pencil,
  Check,
  X,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { ExamSchema } from '../types/exam';
import {
  normalizeExamJson,
  serializeExamToStandardJson,
} from '../utils/examParser';

interface JsonInspectorPanelProps {
  currentExam: ExamSchema;
  rawJsonText?: string;
  onRawJsonChange?: (text: string) => void;
  onExamLoaded?: (exam: ExamSchema, rawText: string) => void;
}

export const JsonInspectorPanel: React.FC<JsonInspectorPanelProps> = ({
  currentExam,
  onRawJsonChange,
  onExamLoaded,
}) => {
  const [isCodeVisible, setIsCodeVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editableJson, setEditableJson] = useState<string>(() =>
    serializeExamToStandardJson(currentExam)
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const formattedJson = serializeExamToStandardJson(currentExam);

  useEffect(() => {
    if (!isEditing) {
      setEditableJson(serializeExamToStandardJson(currentExam));
    }
  }, [currentExam, isEditing]);

  const handleDownloadJson = () => {
    const blob = new Blob([formattedJson], {
      type: 'application/json;charset=utf-8',
    });
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

  const handleToggleEdit = () => {
    if (isEditing) {
      setIsEditing(false);
      setParseError(null);
      setEditableJson(formattedJson);
    } else {
      setEditableJson(formattedJson);
      setParseError(null);
      setSaveMessage(null);
      setIsCodeVisible(true);
      setIsEditing(true);
    }
  };

  const handleApplyChanges = () => {
    const result = normalizeExamJson(editableJson);
    if (!result.success || !result.exam) {
      setParseError(result.error || 'El formato JSON tiene un error de sintaxis.');
      setSaveMessage(null);
      return;
    }

    const normalizedString = serializeExamToStandardJson(result.exam);
    setParseError(null);
    setEditableJson(normalizedString);
    setIsEditing(false);
    onRawJsonChange?.(normalizedString);
    onExamLoaded?.(result.exam, normalizedString);
    setSaveMessage('Cambios del JSON aplicados al examen.');
    setTimeout(() => setSaveMessage(null), 3500);
  };

  return (
    <aside className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-slate-900">
          Código Fuente del Examen (JSON)
        </h2>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (isCodeVisible) {
                setIsCodeVisible(false);
                setIsEditing(false);
                setParseError(null);
              } else {
                setIsCodeVisible(true);
              }
            }}
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

          <button
            type="button"
            onClick={handleDownloadJson}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Exportar archivo .json"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar .json</span>
          </button>

          <button
            type="button"
            onClick={handleToggleEdit}
            aria-label="Editar JSON"
            title={isEditing ? 'Cancelar edición JSON' : 'Editar JSON'}
            className={`inline-flex items-center justify-center p-1.5 rounded-lg border transition-colors shrink-0 cursor-pointer ${
              isEditing
                ? 'bg-sky-600 text-white border-sky-600 hover:bg-sky-700'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {saveMessage && (
        <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">● {saveMessage}</span>
        </div>
      )}

      {parseError && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2"
        >
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">▲ ERROR EN EL JSON</p>
            <p className="text-red-800 mt-0.5">{parseError}</p>
          </div>
        </div>
      )}

      {isCodeVisible && (
        <div className="space-y-3">
          {isEditing ? (
            <>
              <textarea
                id="json-editor-textarea"
                value={editableJson}
                onChange={(e) => setEditableJson(e.target.value)}
                spellCheck={false}
                rows={14}
                className="w-full p-3.5 text-xs font-mono leading-relaxed bg-slate-900 text-slate-100 rounded-lg border border-sky-500 focus:outline-none resize-y"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setParseError(null);
                    setEditableJson(formattedJson);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancelar</span>
                </button>
                <button
                  type="button"
                  onClick={handleApplyChanges}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Guardar cambios JSON</span>
                </button>
              </div>
            </>
          ) : (
            <pre
              aria-label="Código fuente JSON del examen (solo lectura)"
              className="w-full max-h-96 overflow-auto p-3.5 text-xs font-mono leading-relaxed bg-slate-900 text-slate-100 rounded-lg border border-slate-800 select-all"
            >
              <code>{formattedJson}</code>
            </pre>
          )}
        </div>
      )}
    </aside>
  );
};
