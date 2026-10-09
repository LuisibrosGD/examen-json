import React, { useEffect, useState } from 'react';
import { FileDown, X, Eye, CheckCircle2, FileText } from 'lucide-react';
import {
  ExportExamPdfOptions,
  ExportExamReportPdfOptions,
  createExamPdfDocument,
  createExamReportPdfDocument,
} from '../utils/pdfExporter';

export type PdfPreviewTarget =
  | {
      mode: 'exam';
      options: ExportExamPdfOptions;
    }
  | {
      mode: 'report';
      options: ExportExamReportPdfOptions;
    };

interface PdfPreviewModalProps {
  target: PdfPreviewTarget;
  onClose: () => void;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({ target, onClose }) => {
  const [includeAnswerKey, setIncludeAnswerKey] = useState<boolean>(
    target.mode === 'exam' ? Boolean(target.options.includeAnswerKey ?? false) : true
  );
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('documento.pdf');
  const [title, setTitle] = useState<string>('Vista Previa de Documento PDF');
  const [subtitle, setSubtitle] = useState<string>('');

  useEffect(() => {
    const generated =
      target.mode === 'exam'
        ? createExamPdfDocument({
            ...target.options,
            includeAnswerKey,
          })
        : createExamReportPdfDocument(target.options);

    setFileName(generated.fileName);
    setTitle(generated.title);
    setSubtitle(generated.subtitle);

    const blob = generated.doc.output('blob');
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [target, includeAnswerKey]);

  const handleConfirmDownload = () => {
    const generated =
      target.mode === 'exam'
        ? createExamPdfDocument({
            ...target.options,
            includeAnswerKey,
          })
        : createExamReportPdfDocument(target.options);
    generated.doc.save(generated.fileName);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-preview-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-slate-200 rounded-xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Modal Top Toolbar */}
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-start justify-between gap-4 shrink-0">
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-sky-700 font-semibold">
              <Eye className="w-3.5 h-3.5 shrink-0" />
              <span>Previsualización de PDF en formato A4</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-500 truncate max-w-xs">{fileName}</span>
            </div>
            <h2
              id="pdf-preview-modal-title"
              className="text-base sm:text-lg font-bold text-slate-900 truncate"
            >
              {title}
            </h2>
            <p className="text-xs text-slate-500 truncate">{subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 shrink-0">
            {/* Option switcher when previewing an exam PDF */}
            {target.mode === 'exam' && (
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setIncludeAnswerKey(false)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    !includeAnswerKey
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Para Resolver (Sin Clave)
                </button>
                <button
                  type="button"
                  onClick={() => setIncludeAnswerKey(true)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    includeAnswerKey
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Con Clave y Respuestas
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleConfirmDownload}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Descargar PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Cerrar vista previa"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Embedded PDF Preview Area */}
        <div className="flex-1 bg-slate-100 p-3 sm:p-5 overflow-hidden flex flex-col">
          {blobUrl ? (
            <iframe
              src={blobUrl}
              title={title}
              className="w-full h-full rounded-lg border border-slate-300 bg-white shadow-sm"
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-xs text-slate-500 gap-2">
              <FileText className="w-6 h-6 text-slate-400 animate-pulse" />
              <span>Generando vista previa del documento PDF...</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">
              Revisa cómo quedará el archivo antes de guardarlo o imprimirlo desde tu lector PDF.
            </span>
          </div>
          <div className="flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleConfirmDownload}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 shrink-0" />
              <span>Confirmar y Descargar PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
