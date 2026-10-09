import { ExamSchema, FolderNode, LibraryExamItem } from '../types/exam';
import { serializeExamToStandardJson } from '../utils/examParser';

export const PRESET_EXAMS: ExamSchema[] = [
  {
    id: 'preset-biologia-celular',
    title: 'Biología Celular y Metabolismo Energético',
    subject: 'Ciencias Biológicas',
    description:
      'Evaluación sobre estructura de organelos eucariotas, transporte de membrana, glucólisis y fosforilación oxidativa.',
    durationMinutes: 12,
    passingScorePercent: 70,
    questions: [
      {
        id: 'bio-1',
        number: 1,
        category: 'Bioenergética',
        question:
          '¿En qué compartimento subcelular específico se localiza la cadena de transporte de electrones y la ATP sintasa en células eucariotas?',
        options: [
          { id: 'A', label: 'A', text: 'Matriz mitocondrial soluble' },
          { id: 'B', label: 'B', text: 'Membrana mitocondrial interna (crestas)' },
          { id: 'C', label: 'C', text: 'Espacio intermembrana del cloroplasto' },
          { id: 'D', label: 'D', text: 'Citosol perinuclear' },
        ],
        correctOptionId: 'B',
        explanation:
          'Los complejos respiratorios I-IV y la ATP sintasa están insertos en la membrana mitocondrial interna, cuyas invaginaciones (crestas) maximizan la superficie para generar el gradiente protónico.',
        points: 1,
      },
      {
        id: 'bio-2',
        number: 2,
        category: 'Fisiología Respiratoria',
        question:
          'Según el efecto Bohr en la hemoglobina humana, ¿qué ocurre cuando aumenta la presión parcial de CO₂ y disminuye el pH en los tejidos periféricos activos?',
        options: [
          { id: 'A', label: 'A', text: 'Aumenta la afinidad de la hemoglobina por el O₂, reteniendo el oxígeno' },
          { id: 'B', label: 'B', text: 'La curva de disociación se desplaza hacia la derecha, facilitando la liberación de O₂' },
          { id: 'C', label: 'C', text: 'El hierro hemo se oxida irreversiblemente de estado ferroso (Fe²⁺) a férrico (Fe³⁺)' },
          { id: 'D', label: 'D', text: 'Se bloquea la enzima anhidrasa carbónica eritrocitaria' },
        ],
        correctOptionId: 'B',
        explanation:
          'Una mayor concentración de H⁺ y CO₂ estabiliza el estado tenso (T) de la hemoglobina, desplazando la curva hacia la derecha y promoviendo la descarga de O₂ hacia los tejidos metabólicamente activos.',
        points: 1,
      },
      {
        id: 'bio-3',
        number: 3,
        category: 'Transporte Celular',
        question:
          '¿Cuál es la proporción estequiométrica de iones transportados por la bomba de Na⁺/K⁺-ATPasa en cada ciclo hidrolítico de una molécula de ATP?',
        options: [
          { id: 'A', label: 'A', text: 'Expulsa 3 iones Na⁺ hacia el exterior e introduce 2 iones K⁺ hacia el interior' },
          { id: 'B', label: 'B', text: 'Introduce 3 iones Na⁺ al citosol y expulsa 2 iones K⁺ al medio extracelular' },
          { id: 'C', label: 'C', text: 'Intercambia 2 iones Na⁺ por 2 iones K⁺ de manera electroneutra' },
          { id: 'D', label: 'D', text: 'Expulsa 1 ion Na⁺ e introduce 3 iones K⁺ sin gasto directo de ATP' },
        ],
        correctOptionId: 'A',
        explanation:
          'La bomba Na⁺/K⁺-ATPasa es electrogénica: bombea activamente 3 Na⁺ fuera de la célula y 2 K⁺ dentro de la célula por cada ATP hidrolizado, manteniendo el potencial de membrana en reposo.',
        points: 1,
      },
      {
        id: 'bio-4',
        number: 4,
        category: 'Biología Molecular',
        question:
          'Durante la replicación semiconservativa del ADN, ¿qué enzima se encarga de aliviar la tensión torsional superenrollada delante de la horquilla de replicación?',
        options: [
          { id: 'A', label: 'A', text: 'ADN Polimerasa III' },
          { id: 'B', label: 'B', text: 'ADN Ligasa dependiente de NAD⁺' },
          { id: 'C', label: 'C', text: 'Topoisomerasa (ADN girasa)' },
          { id: 'D', label: 'D', text: 'Primasa de ARN' },
        ],
        correctOptionId: 'C',
        explanation:
          'Las topoisomerasas producen cortes transitorios simples o dobles en el esqueleto fosfodiéster para relajar el superenrollamiento positivo inducido por el desenrollamiento de la helicasa.',
        points: 1,
      },
      {
        id: 'bio-5',
        number: 5,
        category: 'Tráfico Vesicular',
        question:
          '¿Qué modificación postraduccional en el aparato de Golgi dirige específicamente a las hidrolasas ácidas hacia los lisosomas?',
        options: [
          { id: 'A', label: 'A', text: 'Poliubiquitinación en residuos de lisina' },
          { id: 'B', label: 'B', text: 'Adición de etiquetas de manosa-6-fosfato (M6P)' },
          { id: 'C', label: 'C', text: 'Acetilación del extremo amino-terminal' },
          { id: 'D', label: 'D', text: 'Hidroxilación de residuos de prolina' },
        ],
        correctOptionId: 'B',
        explanation:
          'En la red cis-Golgi, las enzimas destinadas al lisosoma son fosforiladas en residuos de manosa formando manosa-6-fosfato (M6P), reconocida por receptores específicos en la red trans-Golgi.',
        points: 1,
      },
    ],
  },
  {
    id: 'preset-arquitectura-web',
    title: 'Ingeniería de Software, HTTP y TypeScript',
    subject: 'Ciencias de la Computación',
    description:
      'Cuestionario técnico sobre semántica del protocolo HTTP, sistemas de tipos en TypeScript, concurrencia en el Event Loop y seguridad web.',
    durationMinutes: 10,
    passingScorePercent: 75,
    questions: [
      {
        id: 'cs-1',
        number: 1,
        category: 'Protocolo HTTP',
        question:
          '¿Cuál de los siguientes métodos HTTP se define formalmente en RFC 9110 como idempotente pero NO seguro (not safe)?',
        options: [
          { id: 'A', label: 'A', text: 'POST' },
          { id: 'B', label: 'B', text: 'GET' },
          { id: 'C', label: 'C', text: 'PUT' },
          { id: 'D', label: 'D', text: 'OPTIONS' },
        ],
        correctOptionId: 'C',
        explanation:
          'PUT modifica el estado en el servidor (por lo tanto no es seguro), pero múltiples solicitudes idénticas con el mismo payload producen el mismo estado final del recurso (idempotente). POST no es ni seguro ni idempotente.',
        points: 1,
      },
      {
        id: 'cs-2',
        number: 2,
        category: 'JavaScript Runtime',
        question:
          'En el Event Loop de JavaScript, ¿qué cola tiene prioridad de ejecución inmediatamente después de que finaliza la pila de ejecución (call stack) actual?',
        options: [
          { id: 'A', label: 'A', text: 'La cola de macrotareas (setTimeout / setInterval)' },
          { id: 'B', label: 'B', text: 'La cola de microtareas (Promise callbacks / queueMicrotask)' },
          { id: 'C', label: 'C', text: 'Los callbacks de requestAnimationFrame' },
          { id: 'D', label: 'D', text: 'Los eventos de E/S de red en orden FIFO estricto' },
        ],
        correctOptionId: 'B',
        explanation:
          'El motor vacía por completo la cola de microtareas (Microtask Queue), incluyendo promesas resueltas y queueMicrotask, antes de procesar el siguiente ciclo de renderizado o la siguiente macrotarea.',
        points: 1,
      },
      {
        id: 'cs-3',
        number: 3,
        category: 'TypeScript',
        question:
          'En TypeScript, ¿cuál es la diferencia fundamental entre los tipos `unknown` y `any`?',
        options: [
          { id: 'A', label: 'A', text: '`unknown` solo acepta valores primitivos mientras que `any` acepta objetos' },
          { id: 'B', label: 'B', text: '`unknown` obliga a realizar comprobación o refinamiento de tipos (narrowing) antes de operar sobre el valor' },
          { id: 'C', label: 'C', text: '`unknown` genera código adicional en tiempo de ejecución para validar el esquema' },
          { id: 'D', label: 'D', text: 'No existe diferencia; son alias sintácticos en el compilador tsc' },
        ],
        correctOptionId: 'B',
        explanation:
          '`unknown` es la contraparte segura (type-safe top type) de `any`. Cualquier valor es asignable a `unknown`, pero el compilador prohíbe acceder a propiedades o invocarlo sin antes restringir su tipo con typeof, instanceof o type guards.',
        points: 1,
      },
      {
        id: 'cs-4',
        number: 4,
        category: 'Estructuras de Datos',
        question:
          '¿Cuál es la complejidad temporal en el caso promedio para buscar, insertar y eliminar un elemento en una Tabla Hash bien dimensionada con factor de carga bajo?',
        options: [
          { id: 'A', label: 'A', text: 'O(1) tiempo constante amortizado' },
          { id: 'B', label: 'B', text: 'O(log n) tiempo logarítmico' },
          { id: 'C', label: 'C', text: 'O(n) tiempo lineal' },
          { id: 'D', label: 'D', text: 'O(n log n) tiempo cuasilineal' },
        ],
        correctOptionId: 'A',
        explanation:
          'Con una función hash uniforme y un factor de carga controlado, las operaciones de búsqueda, inserción y borrado se ejecutan en tiempo constante O(1) en promedio.',
        points: 1,
      },
    ],
  },
  {
    id: 'preset-macroeconomia',
    title: 'Fundamentos de Macroeconomía y Política Monetaria',
    subject: 'Economía y Finanzas',
    description:
      'Examen sobre inflación, tasas de interés reales, curva de Phillips, producto interno bruto y mecanismos de transmisión de banca central.',
    durationMinutes: 10,
    passingScorePercent: 70,
    questions: [
      {
        id: 'eco-1',
        number: 1,
        category: 'Política Monetaria',
        question:
          'Según la ecuación de Fisher aproximada, si la tasa de interés nominal de un bono es del 8.5% anual y la inflación esperada es del 3.2%, ¿cuál es la tasa de interés real ex-ante?',
        options: [
          { id: 'A', label: 'A', text: '11.7% anual' },
          { id: 'B', label: 'B', text: '5.3% anual' },
          { id: 'C', label: 'C', text: '2.65% anual' },
          { id: 'D', label: 'D', text: '8.5% anual' },
        ],
        correctOptionId: 'B',
        explanation:
          'La ecuación de Fisher establece que la tasa real aproximada es r ≈ i - πᵉ. Por tanto, 8.5% - 3.2% = 5.3%.',
        points: 1,
      },
      {
        id: 'eco-2',
        number: 2,
        category: 'Banca Central',
        question:
          'Cuando un banco central realiza una operación de mercado abierto vendiendo bonos gubernamentales a los bancos comerciales, ¿cuál es el efecto inmediato sobre la liquidez?',
        options: [
          { id: 'A', label: 'A', text: 'Aumentan las reservas bancarias y disminuye la tasa de interés interbancaria' },
          { id: 'B', label: 'B', text: 'Se contrae la base monetaria y tiende a subir la tasa de interés de corto plazo' },
          { id: 'C', label: 'C', text: 'El multiplicador monetario se duplica automáticamente' },
          { id: 'D', label: 'D', text: 'Se reduce el déficit fiscal primario del gobierno central' },
        ],
        correctOptionId: 'B',
        explanation:
          'Al vender bonos, el banco central retira dinero de circulación a cambio de títulos, drenando reservas del sistema bancario (política monetaria contractiva) y elevando el costo del dinero a corto plazo.',
        points: 1,
      },
      {
        id: 'eco-3',
        number: 3,
        category: 'Cuentas Nacionales',
        question:
          '¿Cuál de las siguientes transacciones se contabiliza directamente dentro del cálculo del Producto Interno Bruto (PIB) de un país en el año actual?',
        options: [
          { id: 'A', label: 'A', text: 'La compra de acciones de una empresa tecnológica en el mercado secundario bursátil' },
          { id: 'B', label: 'B', text: 'La venta de un automóvil usado fabricado hace cuatro años entre dos particulares' },
          { id: 'C', label: 'C', text: 'La construcción de una nueva planta industrial de semiconductores dentro del territorio nacional' },
          { id: 'D', label: 'D', text: 'El pago de pensiones públicas de jubilación por parte del Estado' },
        ],
        correctOptionId: 'C',
        explanation:
          'La construcción de nueva infraestructura productiva forma parte de la Formación Bruta de Capital Fijo (Inversión, componente I del PIB). Las transferencias, bienes usados y activos financieros secundarios no representan producción corriente.',
        points: 1,
      },
    ],
  },
];

export interface PromptCorrectDistribution {
  singleCorrectPercent: number; // % of questions with 1 correct answer
  twoCorrectPercent: number; // % of questions with 2 correct answers
  threePlusCorrectPercent: number; // % of questions with 3 or more correct answers
}

export function buildAiPromptTemplate(
  questionCount: number = 10,
  difficulty: string = 'Intermedio',
  customTopic?: string,
  durationValue?: number,
  durationUnit: 'minutes' | 'seconds' = 'minutes',
  optionsPerQuestion: number = 4,
  distribution: PromptCorrectDistribution = {
    singleCorrectPercent: 100,
    twoCorrectPercent: 0,
    threePlusCorrectPercent: 0,
  }
): string {
  const cleanTopic = customTopic?.trim();
  const contextInstruction = cleanTopic
    ? `sobre "${cleanTopic}" (o basándote en los apuntes y el contexto de este chat)`
    : `en base al tema, apuntes o documentos que estamos tratando en este chat`;

  const clampedOptionsCount = Math.max(2, Math.min(7, Math.round(optionsPerQuestion || 4)));
  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].slice(0, clampedOptionsCount);

  const resolvedDurationMinutes =
    durationValue !== undefined && durationValue > 0
      ? durationUnit === 'seconds'
        ? Number((durationValue / 60).toFixed(2))
        : durationValue
      : Math.max(5, questionCount * 2);

  const durationText =
    durationValue !== undefined && durationValue > 0
      ? durationUnit === 'seconds'
        ? `${durationValue} segundos (${resolvedDurationMinutes} min)`
        : `${durationValue} minutos`
      : `${resolvedDurationMinutes} minutos`;

  const p1 = Math.max(0, Math.round(distribution.singleCorrectPercent));
  const p2 = Math.max(0, Math.round(distribution.twoCorrectPercent));
  const p3 = Math.max(0, Math.round(distribution.threePlusCorrectPercent));
  const totalPct = p1 + p2 + p3 || 100;

  const norm1 = Math.round((p1 / totalPct) * 100);
  const norm2 = Math.round((p2 / totalPct) * 100);
  const norm3 = Math.max(0, 100 - norm1 - norm2);

  const count1 = Math.round((norm1 / 100) * questionCount);
  const count2 = Math.round((norm2 / 100) * questionCount);
  const count3 = Math.max(0, questionCount - count1 - count2);

  const sampleOptionsJson = optionLetters
    .map((letter, idx) => `        "${letter}) Opción de respuesta ${idx + 1}"`)
    .join(',\n');

  const hasMultiCorrect = norm2 > 0 || norm3 > 0;

  const distributionInstruction = hasMultiCorrect
    ? `DISTRIBUCIÓN OBLIGATORIA DE RESPUESTAS CORRECTAS Y ALTERNATIVAS:
- Cada pregunta debe tener exactamente ${clampedOptionsCount} alternativas (${optionLetters.join(', ')}).
- ${norm1}% de las preguntas (${count1} reactivos) con 1 sola respuesta correcta (ej. "respuestas_correctas": ["B"]).
- ${norm2}% de las preguntas (${count2} reactivos) con 2 respuestas correctas (ej. "respuestas_correctas": ["A", "C"]).${
        norm3 > 0
          ? `\n- ${norm3}% de las preguntas (${count3} reactivos) con 3 o más respuestas correctas (ej. "respuestas_correctas": ["A", "B", "D"]).`
          : ''
      }`
    : `CONFIGURACIÓN DE ALTERNATIVAS Y RESPUESTAS:
- Cada pregunta debe tener exactamente ${clampedOptionsCount} alternativas (${optionLetters.join(', ')}).
- 100% de las preguntas (${questionCount} reactivos) con 1 respuesta correcta.`;

  const secondQuestionExample = hasMultiCorrect
    ? `,
    {
      "id": 2,
      "categoria": "Subtema con respuesta múltiple",
      "pregunta": "Enunciado de pregunta que tiene 2 o más respuestas correctas",
      "cantidad_alternativas": ${clampedOptionsCount},
      "opciones": [
${sampleOptionsJson}
      ],
      "respuesta_correcta": ["${optionLetters[0]}", "${optionLetters[Math.min(1, optionLetters.length - 1)]}"],
      "respuestas_correctas": ["${optionLetters[0]}", "${optionLetters[Math.min(1, optionLetters.length - 1)]}"],
      "explicacion": "Justificación explicando por qué tanto ${optionLetters[0]} como ${optionLetters[Math.min(1, optionLetters.length - 1)]} son correctas.",
      "puntos": 1
    }`
    : '';

  return `Genera un examen en este formato JSON ${contextInstruction}, con ${questionCount} preguntas de opción múltiple (nivel de dificultad: ${difficulty}, duración total: ${durationText}, ${clampedOptionsCount} alternativas por pregunta) y su clave de respuestas correcta.

${distributionInstruction}

IMPORTANTE: Responde ÚNICAMENTE con un bloque JSON válido (sin texto adicional fuera del JSON) que siga exactamente esta estructura para poder importarlo directamente en mi visor de exámenes:

{
  "titulo": "Título descriptivo del examen según el tema del chat",
  "materia": "Nombre de la materia o tema principal",
  "descripcion": "Evaluación generada a partir de la conversación con validación automática.",
  "duracion_minutos": ${resolvedDurationMinutes},
  "puntaje_aprobatorio": 70,
  "preguntas": [
    {
      "id": 1,
      "categoria": "Subtema específico",
      "pregunta": "Enunciado claro y preciso de la pregunta 1",
      "cantidad_alternativas": ${clampedOptionsCount},
      "opciones": [
${sampleOptionsJson}
      ],
      "respuesta_correcta": "${optionLetters[Math.min(1, optionLetters.length - 1)]}",
      "respuestas_correctas": ["${optionLetters[Math.min(1, optionLetters.length - 1)]}"],
      "explicacion": "Breve justificación de por qué la opción es la correcta según lo visto en el chat.",
      "puntos": 1
    }${secondQuestionExample}
  ]
}`;
}

export const INITIAL_FOLDERS: FolderNode[] = [
  {
    id: 'folder-cursos',
    name: 'Cursos',
    description: 'Materias semestrales, módulos académicos y asignaturas troncales.',
    parentId: null,
    createdAt: '2026-10-01',
  },
  {
    id: 'folder-repaso',
    name: 'Repaso',
    description: 'Cuestionarios rápidos de estudio diario y tarjetas de autoevaluación.',
    parentId: null,
    createdAt: '2026-10-02',
  },
  {
    id: 'folder-examenes',
    name: 'Exámenes',
    description: 'Simulacros parciales, evaluaciones finales y bancos de preguntas.',
    parentId: null,
    createdAt: '2026-10-03',
  },
  // Subfolders inside "Cursos"
  {
    id: 'folder-cursos-biologia',
    name: 'Biología y Ciencias de la Salud',
    description: 'Fisiología celular, bioenergética y metabolismo.',
    parentId: 'folder-cursos',
    createdAt: '2026-10-04',
  },
  {
    id: 'folder-cursos-ingenieria',
    name: 'Ingeniería de Software',
    description: 'Arquitectura web, protocolos de red y lenguajes tipados.',
    parentId: 'folder-cursos',
    createdAt: '2026-10-04',
  },
  // Subfolder inside "Exámenes"
  {
    id: 'folder-examenes-parciales',
    name: 'Parciales Semestrales',
    description: 'Evaluaciones sumativas de mitad de periodo.',
    parentId: 'folder-examenes',
    createdAt: '2026-10-05',
  },
];

export const INITIAL_LIBRARY_EXAMS: LibraryExamItem[] = [
  {
    id: 'lib-bio-1',
    folderId: 'folder-cursos-biologia',
    exam: PRESET_EXAMS[0],
    rawJson: serializeExamToStandardJson(PRESET_EXAMS[0]),
    updatedAt: '2026-10-06',
  },
  {
    id: 'lib-cs-1',
    folderId: 'folder-cursos-ingenieria',
    exam: PRESET_EXAMS[1],
    rawJson: serializeExamToStandardJson(PRESET_EXAMS[1]),
    updatedAt: '2026-10-07',
  },
  {
    id: 'lib-eco-1',
    folderId: 'folder-examenes-parciales',
    exam: PRESET_EXAMS[2],
    rawJson: serializeExamToStandardJson(PRESET_EXAMS[2]),
    updatedAt: '2026-10-08',
  },
  {
    id: 'lib-repaso-bio',
    folderId: 'folder-repaso',
    exam: {
      ...PRESET_EXAMS[0],
      id: 'preset-repaso-membrana',
      title: 'Repaso Rápido: Transporte Celular y Efecto Bohr',
      subject: 'Fisiología Celular',
      durationMinutes: 6,
      questions: PRESET_EXAMS[0].questions.slice(0, 3),
    },
    rawJson: serializeExamToStandardJson({
      ...PRESET_EXAMS[0],
      id: 'preset-repaso-membrana',
      title: 'Repaso Rápido: Transporte Celular y Efecto Bohr',
      subject: 'Fisiología Celular',
      durationMinutes: 6,
      questions: PRESET_EXAMS[0].questions.slice(0, 3),
    }),
    updatedAt: '2026-10-08',
  },
];

