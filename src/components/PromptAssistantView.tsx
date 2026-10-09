import React, { useState } from 'react';
import { Copy, Check, Terminal, MessageSquareText, ListChecks } from 'lucide-react';
import { buildAiPromptTemplate } from '../data/presetExams';

interface PromptAssistantModalProps {
  onClose: () => void;
  onLoadSampleJson: () => void;
}

export const PromptAssistantView: React.FC<PromptAssistantModalProps> = ({
  onClose,
  onLoadSampleJson,
}) => {
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState<'Básico' | 'Intermedio' | 'Avanzado'>('Intermedio');
  const [durationUnit, setDurationUnit] = useState<'minutes' | 'seconds'>('minutes');
  const [durationValue, setDurationValue] = useState<number>(20);
  const [optionsPerQuestion, setOptionsPerQuestion] = useState<number>(4);
  const [singleCorrectPercent, setSingleCorrectPercent] = useState<number>(70);
  const [twoCorrectPercent, setTwoCorrectPercent] = useState<number>(30);
  const [threePlusCorrectPercent, setThreePlusCorrectPercent] = useState<number>(0);
  const [customTopic, setCustomTopic] = useState('');
  const [copied, setCopied] = useState(false);

  const handleUnitChange = (newUnit: 'minutes' | 'seconds') => {
    if (newUnit === durationUnit) return;
    if (newUnit === 'seconds') {
      setDurationValue(
        durationValue <= 5 ? Math.max(15, Math.round(durationValue * 60)) : 60
      );
    } else {
      setDurationValue(
        durationValue >= 60
          ? Math.max(1, Math.round(durationValue / 60))
          : Math.max(5, questionCount * 2)
      );
    }
    setDurationUnit(newUnit);
  };

  const handleSinglePctChange = (val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    setSingleCorrectPercent(clamped);
    const remaining = 100 - clamped;
    if (twoCorrectPercent + threePlusCorrectPercent !== remaining) {
      const nextTwo = Math.min(remaining, twoCorrectPercent);
      setTwoCorrectPercent(nextTwo);
      setThreePlusCorrectPercent(Math.max(0, remaining - nextTwo));
    }
  };

  const handleTwoPctChange = (val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    setTwoCorrectPercent(clamped);
    const remaining = 100 - clamped;
    if (singleCorrectPercent + threePlusCorrectPercent !== remaining) {
      const nextSingle = Math.min(remaining, singleCorrectPercent);
      setSingleCorrectPercent(nextSingle);
      setThreePlusCorrectPercent(Math.max(0, remaining - nextSingle));
    }
  };

  const handleThreePctChange = (val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    setThreePlusCorrectPercent(clamped);
    const remaining = 100 - clamped;
    if (singleCorrectPercent + twoCorrectPercent !== remaining) {
      const nextSingle = Math.min(remaining, singleCorrectPercent);
      setSingleCorrectPercent(nextSingle);
      setTwoCorrectPercent(Math.max(0, remaining - nextSingle));
    }
  };

  const generatedPrompt = buildAiPromptTemplate(
    questionCount,
    difficulty,
    customTopic,
    durationValue,
    durationUnit,
    optionsPerQuestion,
    {
      singleCorrectPercent,
      twoCorrectPercent,
      threePlusCorrectPercent: optionsPerQuestion >= 3 ? threePlusCorrectPercent : 0,
    }
  );

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = generatedPrompt;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const optionLettersPreview = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
    .slice(0, optionsPerQuestion)
    .join(', ');

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6 md:p-8">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">
            Prompt Universal de Contexto · Para pegar al final de cualquier conversación con IA
          </p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Prompt Genérico: «Genera el examen en base al tema de este chat»
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Personaliza la cantidad de preguntas, alternativas por reactivo (2 a 7), duración y el porcentaje de preguntas con 1, 2 o más respuestas correctas.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onLoadSampleJson}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Probar con JSON de ejemplo
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Volver al Examen
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 items-stretch">
        {/* Left column: Guidance for the user + configuration parameters */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-5">
          <div className="space-y-5">
            {/* 1. Question Count */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="prompt-count" className="text-xs font-semibold text-slate-700">
                  Cantidad de Preguntas a Solicitar
                </label>
                <span className="text-xs font-mono font-semibold text-sky-700 tabular-nums">
                  {questionCount} reactivos
                </span>
              </div>
              <input
                id="prompt-count"
                type="range"
                min={3}
                max={25}
                step={1}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-400 tabular-nums mt-0.5">
                <span>3 preguntas</span>
                <span>10 preguntas</span>
                <span>15 preguntas</span>
                <span>25 preguntas</span>
              </div>
            </div>

            {/* 2. Alternatives per Question (Min 2 to Max 7) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700">
                  Alternativas por Pregunta (Mín. 2 · Máx. 7)
                </span>
                <span className="text-xs font-mono font-semibold text-sky-700 tabular-nums">
                  {optionsPerQuestion} opciones ({optionLettersPreview})
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1 p-1 bg-slate-100 rounded-lg">
                {[2, 3, 4, 5, 6, 7].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      setOptionsPerQuestion(num);
                      if (num < 3 && threePlusCorrectPercent > 0) {
                        setSingleCorrectPercent((s) => s + threePlusCorrectPercent);
                        setThreePlusCorrectPercent(0);
                      }
                    }}
                    className={`py-1.5 px-2 text-xs font-mono font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      optionsPerQuestion === num
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Percentage Distribution for 1, 2, or 3+ Correct Answers */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <ListChecks className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>Distribución de Respuestas Correctas (%)</span>
                </span>
                <span className="text-[11px] font-mono font-semibold text-slate-500 tabular-nums">
                  Total: 100%
                </span>
              </div>

              {/* Quick distribution presets */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSingleCorrectPercent(100);
                    setTwoCorrectPercent(0);
                    setThreePlusCorrectPercent(0);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors cursor-pointer ${
                    singleCorrectPercent === 100
                      ? 'bg-sky-50 border-sky-300 text-sky-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Solo 1 correcta (100%)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSingleCorrectPercent(70);
                    setTwoCorrectPercent(30);
                    setThreePlusCorrectPercent(0);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors cursor-pointer ${
                    singleCorrectPercent === 70 && twoCorrectPercent === 30
                      ? 'bg-sky-50 border-sky-300 text-sky-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Mixto (70% de 1 · 30% de 2)
                </button>
                {optionsPerQuestion >= 3 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSingleCorrectPercent(50);
                      setTwoCorrectPercent(30);
                      setThreePlusCorrectPercent(20);
                    }}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors cursor-pointer ${
                      singleCorrectPercent === 50 &&
                      twoCorrectPercent === 30 &&
                      threePlusCorrectPercent === 20
                        ? 'bg-sky-50 border-sky-300 text-sky-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Avanzado (50% / 30% / 20%)
                  </button>
                )}
              </div>

              <div className="space-y-2.5 pt-1">
                {/* 1 Correct Answer % */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 font-medium">
                      Preguntas con <strong>1 respuesta correcta</strong>
                    </span>
                    <div className="flex items-center gap-1.5 font-mono tabular-nums">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={5}
                        value={singleCorrectPercent}
                        onChange={(e) => handleSinglePctChange(Number(e.target.value) || 0)}
                        aria-label="Porcentaje de preguntas con 1 respuesta correcta"
                        className="w-14 px-1.5 py-0.5 text-right text-xs font-bold bg-white border border-slate-300 rounded text-slate-900"
                      />
                      <span className="text-slate-500">%</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={singleCorrectPercent}
                    onChange={(e) => handleSinglePctChange(Number(e.target.value))}
                    className="w-full accent-sky-600 cursor-pointer h-1.5"
                  />
                </div>

                {/* 2 Correct Answers % */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 font-medium">
                      Preguntas con <strong>2 respuestas correctas</strong>
                    </span>
                    <div className="flex items-center gap-1.5 font-mono tabular-nums">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={5}
                        value={twoCorrectPercent}
                        onChange={(e) => handleTwoPctChange(Number(e.target.value) || 0)}
                        aria-label="Porcentaje de preguntas con 2 respuestas correctas"
                        className="w-14 px-1.5 py-0.5 text-right text-xs font-bold bg-white border border-slate-300 rounded text-slate-900"
                      />
                      <span className="text-slate-500">%</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={twoCorrectPercent}
                    onChange={(e) => handleTwoPctChange(Number(e.target.value))}
                    className="w-full accent-sky-600 cursor-pointer h-1.5"
                  />
                </div>

                {/* 3+ Correct Answers % (available when optionsPerQuestion >= 3) */}
                {optionsPerQuestion >= 3 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 font-medium">
                        Preguntas con <strong>3 o más correctas</strong>
                      </span>
                      <div className="flex items-center gap-1.5 font-mono tabular-nums">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={5}
                          value={threePlusCorrectPercent}
                          onChange={(e) => handleThreePctChange(Number(e.target.value) || 0)}
                          aria-label="Porcentaje de preguntas con 3 o más respuestas correctas"
                          className="w-14 px-1.5 py-0.5 text-right text-xs font-bold bg-white border border-slate-300 rounded text-slate-900"
                        />
                        <span className="text-slate-500">%</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={threePlusCorrectPercent}
                      onChange={(e) => handleThreePctChange(Number(e.target.value))}
                      className="w-full accent-sky-600 cursor-pointer h-1.5"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 4. Difficulty Level */}
            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-2">
                Nivel de Dificultad Solicitado
              </span>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
                {(['Básico', 'Intermedio', 'Avanzado'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setDifficulty(lvl)}
                    className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      difficulty === lvl
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Duration Configuration (Minutes or Seconds) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="prompt-duration" className="text-xs font-semibold text-slate-700">
                  Duración del Examen (<code className="font-mono text-[11px]">duracion_minutos</code>)
                </label>
                <span className="text-xs font-mono font-semibold text-sky-700 tabular-nums">
                  {durationUnit === 'seconds'
                    ? `${durationValue} seg (${Number((durationValue / 60).toFixed(2))} min)`
                    : `${durationValue} min`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="prompt-duration"
                  type="number"
                  min={1}
                  max={durationUnit === 'seconds' ? 3600 : 240}
                  step={durationUnit === 'seconds' ? 5 : 1}
                  value={durationValue}
                  onChange={(e) => {
                    const val = Math.max(1, Number(e.target.value) || 1);
                    setDurationValue(val);
                  }}
                  className="w-28 px-3 py-2 text-xs font-mono font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-900 tabular-nums focus:outline-none focus:border-sky-600 focus:bg-white transition-colors"
                />

                <div className="flex-1 grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => handleUnitChange('minutes')}
                    className={`py-1.5 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      durationUnit === 'minutes'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    En Minutos
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUnitChange('seconds')}
                    className={`py-1.5 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      durationUnit === 'seconds'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    En Segundos
                  </button>
                </div>
              </div>
            </div>

            {/* 6. Custom Subtopic */}
            <div>
              <label htmlFor="prompt-topic" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Acotar a un subtema específico del chat <span className="font-normal text-slate-400">(Opcional)</span>
              </label>
              <input
                id="prompt-topic"
                type="text"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="Déjalo vacío para usar todo el tema del chat actual..."
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-sky-600 focus:bg-white transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Right column: Live Prompt Output */}
        <div className="lg:col-span-7 flex flex-col bg-slate-900 rounded-xl p-5 text-slate-100 justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <Terminal className="w-4 h-4 text-sky-400" />
                <span>prompt_generico_para_tu_chat.txt</span>
              </div>
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-sky-600 hover:bg-sky-500 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Prompt Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Prompt Genérico</span>
                  </>
                )}
              </button>
            </div>
            <pre className="text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-[540px] overflow-y-auto">
              {generatedPrompt}
            </pre>
          </div>

          <div className="pt-3 mt-4 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Pégalo en cualquier chat activo de IA para extraer el JSON</span>
            <span className="tabular-nums">{generatedPrompt.length} caracteres</span>
          </div>
        </div>
      </div>
    </section>
  );
};
