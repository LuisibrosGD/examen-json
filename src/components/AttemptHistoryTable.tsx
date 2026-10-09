import React from 'react';
import { Trash2, CheckCircle2, AlertCircle, ClipboardList } from 'lucide-react';
import { ExamAttemptRecord } from '../types/exam';
import { formatReadableDuration } from './ExamReportView';

interface AttemptHistoryTableProps {
  attempts: ExamAttemptRecord[];
  onClearHistory: () => void;
}

export const AttemptHistoryTable: React.FC<AttemptHistoryTableProps> = ({
  attempts,
  onClearHistory,
}) => {
  return (
    <section id="historial" className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <p className="text-xs text-slate-500">
            Registro Local de Sesiones · Métricas Tabulares
          </p>
          <h2 className="text-lg font-bold text-slate-900">
            Historial de Evaluaciones Calificadas
          </h2>
        </div>

        {attempts.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-700 border border-slate-200 hover:border-red-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpiar Historial</span>
          </button>
        )}
      </div>

      {attempts.length === 0 ? (
        <div className="py-8 text-center space-y-2">
          <ClipboardList className="w-7 h-7 text-slate-400 mx-auto" />
          <p className="text-sm font-medium text-slate-800">
            Aún no hay evaluaciones completadas en esta sesión
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Responde el formulario interactivo y pulsa "Calificar Examen Completo" para registrar tu calificación, porcentaje de acierto y tiempo de resolución.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 pr-4">Examen Evaluado</th>
                <th className="py-2.5 px-4">Materia</th>
                <th className="py-2.5 px-4">Estado</th>
                <th className="py-2.5 px-4 text-right">Aciertos</th>
                <th className="py-2.5 px-4 text-right">Puntaje</th>
                <th className="py-2.5 px-4 text-right">Calificación</th>
                <th className="py-2.5 pl-4 text-right">Tiempo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {attempts.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 pr-4 font-semibold text-slate-900">
                    {item.examTitle}
                    <div className="text-[11px] font-normal text-slate-400 tabular-nums">
                      {item.completedAt}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{item.subject}</td>
                  <td className="py-3 px-4">
                    {item.passed ? (
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
                    {item.correctCount} / {item.totalQuestions}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                    {item.scoreEarned} / {item.totalPoints} pts
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-slate-900">
                    {item.percentage}%
                  </td>
                  <td className="py-3 pl-4 text-right font-mono tabular-nums text-slate-600">
                    {formatReadableDuration(item.timeSpentSeconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
