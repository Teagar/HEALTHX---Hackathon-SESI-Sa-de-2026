import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import {
  CheckCircle2,
  ClipboardPaste,
  ExternalLink,
  FileCheck2,
  FileScan,
  FileText,
  FolderOpen,
  Layers,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import type { Employee } from '../types';
import { COMPANY_METADATA } from '../mockDatabase';
import { REFERENCE_DOCTORS } from '../queueService';
import {
  ALLOWED,
  applyImportItemToEmployee,
  buildImportQueueItem,
  ColKey,
  createPastedTextSourceDoc,
  FieldDiffRow,
  getEmployeeColValue,
  highlightEvidenceParts,
  ImportQueueItem,
  KIND_LABEL,
  LABEL,
  loadDemoFilesFromPublic,
  parseWhatsApp,
  readImportedFile,
  REGISTRATION_COL_KEYS,
  SECILITA_DEMO_FILES,
  sourceDocsToQueueItems,
  UnsupportedFileError,
} from '../secilitaEngine';

export interface NewEmployeeOcrModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees?: Employee[];
  onConfirmInsert: (newOrUpdatedEmployee: Employee) => void;
  onConfirmBatchInsert?: (employeesToUpsert: Employee[]) => void;
}

const SAMPLE_COMPLETE_REGISTRATION_TEXT = [
  'GESTÃO DO CUIDADO - FICHA DE CADASTRO E ACOLHIMENTO APS SESI',
  'Data Ficha: 15/11/2026',
  'Status: ATIVO',
  'Data de inclusão ao Programa Bem Cuidar',
  'Informe a Data de Ativação da vida no Programa: 05/10/2026',
  '1. Identificação Cadastral do Trabalhador',
  'Funcionário (Código / Nome): 20269875 - MARIANA SILVA SOUZA',
  'CPF: 609.114.872-54',
  'Sexo: FEMININO',
  'Nascimento: 15/05/1990   Idade: 36',
  'Admissão: 05/10/2026',
  'Contato do Paciente: (71) 98888-7777',
  'Empresa: Têxtil Horizonte Ltda',
  'Unidade: Planta Camaçari - BA   Setor: Tecnologia e Automação',
  'Cargo: Analista de Processos Industriais',
  'Médico de referência na APS: Dra. Beatriz Campos',
  '2. Avaliação de Risco de Saúde e Coordenação do Cuidado',
  'Classificação do paciente quanto ao risco: 2 - Saudável com risco',
  'Atendimento com equipe multiprofissional: Sim',
  'Observações sobre a classificação do risco à saúde: Paciente estável, relata leve desconforto lombar ao final da jornada e acompanhamento nutricional.',
  'Demandas geradas: Acompanhamento nutricional; Avaliação ergonômica do posto.',
].join('\n');

/** Exemplo digitado (não é um arquivo de public/demo): rotulado como texto, nunca como PDF. */
const SAMPLE_REGISTRATION_NAME = 'Exemplo: ficha de cadastro (texto colado)';

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderHighlightedHtml(rawText: string, activeEvidence: string): string {
  let html = escapeHtml(rawText);
  if (!activeEvidence) return html;
  const parts = highlightEvidenceParts(activeEvidence);
  for (const part of parts) {
    const escapedPart = escapeHtml(part).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (escapedPart.length < 3) continue;
    try {
      const re = new RegExp(escapedPart, 'i');
      if (re.test(html)) {
        html = html.replace(
          re,
          (m) =>
            `<mark class="rounded bg-[#FDE68A] px-1 py-0.5 font-semibold text-[#1E2926] ring-2 ring-[#F59E0B]/40">${m}</mark>`
        );
        break;
      }
    } catch {
      // Ignora regex inválida
    }
  }
  return html;
}

export function NewEmployeeOcrModal({
  isOpen,
  onClose,
  employees = [],
  onConfirmInsert,
  onConfirmBatchInsert,
}: NewEmployeeOcrModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const docViewerRef = useRef<HTMLDivElement | null>(null);

  const [queue, setQueue] = useState<ImportQueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [docTab, setDocTab] = useState<'rendered' | 'raw'>('rendered');
  const [activeFieldKey, setActiveFieldKey] = useState<ColKey | null>(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string>('');
  const [showPasteBox, setShowPasteBox] = useState<boolean>(false);
  const [pastedText, setPastedText] = useState<string>('');
  const [showPersonSwap, setShowPersonSwap] = useState<boolean>(false);
  const [personSearch, setPersonSearch] = useState<string>('');
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [selectedDemoFile, setSelectedDemoFile] = useState<string>('all');

  // Inicializa com um documento de cadastro completo + 3 anexos variados ao abrir pela 1ª vez se a fila estiver vazia
  useEffect(() => {
    if (!isOpen || queue.length > 0) return;
    let cancelled = false;
    (async () => {
      setIsLoadingFiles(true);
      try {
        const regDoc = await createPastedTextSourceDoc(
          SAMPLE_COMPLETE_REGISTRATION_TEXT,
          SAMPLE_REGISTRATION_NAME
        );
        regDoc.method = 'Texto de exemplo (colado)';
        const initialDemos = await loadDemoFilesFromPublic([
          '01_gestao-retorno_joana.pdf',
          '02_foto-gestao-retorno_rafael.jpg',
          '03_plano-cuidados_camila.pdf',
          '06_whatsapp_paulo.txt',
        ]);
        if (cancelled) return;
        const items = sourceDocsToQueueItems([regDoc, ...initialDemos], employees);
        setQueue(items);
        setCurrentIndex(0);
      } finally {
        if (!cancelled) setIsLoadingFiles(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, employees, queue.length]);

  const currentItem = queue[currentIndex] ?? null;

  const stats = useMemo(() => {
    const total = queue.length;
    const saved = queue.filter((i) => i.status === 'ok').length;
    const skipped = queue.filter((i) => i.status === 'skip').length;
    const pending = total - saved - skipped;
    const done = saved + skipped;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, saved, skipped, pending, done, pct };
  }, [queue]);

  const activeField = useMemo(() => {
    if (!currentItem || !activeFieldKey) return null;
    return currentItem.fields.find((f) => f.key === activeFieldKey) ?? null;
  }, [currentItem, activeFieldKey]);

  useEffect(() => {
    if (!activeField || !docViewerRef.current) return;
    const mark = docViewerRef.current.querySelector('mark');
    if (mark) {
      mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeField, docTab, currentIndex]);

  if (!isOpen) return null;

  const handleFilesSelected = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (!files.length) return;
    setIsLoadingFiles(true);
    setStatusBanner(`Lendo ${files.length} arquivo(s) e extraindo campos para a planilha...`);
    try {
      const docs = [];
      const failures: string[] = [];
      for (const file of files) {
        try {
          docs.push(...(await readImportedFile(file)));
        } catch (err) {
          failures.push(
            err instanceof UnsupportedFileError
              ? `${file.name}: ${err.message}`
              : `${file.name}: não foi possível ler o arquivo.`
          );
        }
      }
      const newItems = sourceDocsToQueueItems(docs, employees);
      setQueue((prev) => {
        const next = [...prev, ...newItems];
        return next;
      });
      if (newItems.length > 0) {
        setCurrentIndex(queue.length);
      }
      setStatusBanner(
        `${newItems.length} registro(s) extraído(s) de ${files.length - failures.length} arquivo(s). Confira na coluna da direita.` +
          (failures.length ? ` Não lidos: ${failures.join(' • ')}` : '')
      );
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleLoadDemoPack = async () => {
    setIsLoadingFiles(true);
    const filesToLoad =
      selectedDemoFile === 'all' ? SECILITA_DEMO_FILES : [selectedDemoFile];
    setStatusBanner(
      `Carregando ${filesToLoad.length} anexo(s) de demonstração do secilita_planilhas...`
    );
    try {
      const docs = await loadDemoFilesFromPublic(filesToLoad);
      const newItems = sourceDocsToQueueItems(docs, employees);
      setQueue((prev) => [...prev, ...newItems]);
      if (newItems.length > 0) {
        setCurrentIndex(queue.length);
      }
      setStatusBanner(
        `${newItems.length} item(ns) carregado(s) dos anexos de teste (${filesToLoad.length} arquivo(s)).`
      );
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleLoadCompleteRegistrationSample = async () => {
    const regDoc = await createPastedTextSourceDoc(
      SAMPLE_COMPLETE_REGISTRATION_TEXT,
      SAMPLE_REGISTRATION_NAME
    );
    regDoc.method = 'Texto de exemplo (colado)';
    const newItems = sourceDocsToQueueItems([regDoc], employees);
    setQueue((prev) => [...prev, ...newItems]);
    setCurrentIndex(queue.length);
    setStatusBanner('Ficha cadastral completa adicionada à fila para conferência.');
  };

  const handleReadPastedText = async () => {
    if (!pastedText.trim()) return;
    const doc = await createPastedTextSourceDoc(pastedText.trim());
    const newItems = sourceDocsToQueueItems([doc], employees);
    setQueue((prev) => [...prev, ...newItems]);
    setCurrentIndex(queue.length);
    setPastedText('');
    setShowPasteBox(false);
    setStatusBanner('Texto lido e estruturado na fila de revisão.');
  };

  const updateCurrentItem = (updater: (item: ImportQueueItem) => ImportQueueItem) => {
    setQueue((prev) =>
      prev.map((it, idx) => (idx === currentIndex ? updater(it) : it))
    );
  };

  const handleFieldChange = (key: ColKey, newValue: string) => {
    updateCurrentItem((item) => {
      const nextFields = item.fields.map((f) => {
        if (f.key !== key) return f;
        const nextState: FieldDiffRow['state'] =
          newValue.trim().toUpperCase() === f.current.trim().toUpperCase()
            ? 'same'
            : !f.current
            ? 'new'
            : 'changed';
        return { ...f, value: newValue, state: nextState };
      });
      return { ...item, fields: nextFields };
    });
  };

  const handleToggleFieldRestore = (key: ColKey) => {
    updateCurrentItem((item) => {
      const nextFields = item.fields.map((f) => {
        if (f.key !== key) return f;
        const restoringOld = f.value !== f.current;
        const nextVal = restoringOld ? f.current : f.proposed;
        const nextState: FieldDiffRow['state'] =
          nextVal.trim().toUpperCase() === f.current.trim().toUpperCase()
            ? 'same'
            : !f.current
            ? 'new'
            : 'changed';
        return { ...f, value: nextVal, state: nextState };
      });
      return { ...item, fields: nextFields };
    });
  };

  const handleSwitchToNewEmployeeMode = () => {
    updateCurrentItem((item) => {
      const rebuilt = buildImportQueueItem(
        item.doc,
        item.extraction,
        [], // Força modo de novo funcionário suprindo todos os campos cadastrais
        item.record
      );
      return {
        ...rebuilt,
        id: item.id,
        isNewEmployeeMode: true,
        matchedEmployeeId: undefined,
        matchHow: 'novo cadastro',
      };
    });
    setShowPersonSwap(false);
  };

  const handleAssignExistingEmployee = (emp: Employee) => {
    updateCurrentItem((item) => {
      // Reconstrói diffs comparando com o funcionário escolhido
      const nextFields: FieldDiffRow[] = item.fields.map((f) => {
        const current = getEmployeeColValue(emp, f.key);
        const proposed = f.proposed || current;
        const state: FieldDiffRow['state'] =
          proposed.trim().toUpperCase() === current.trim().toUpperCase()
            ? 'same'
            : !current
            ? 'new'
            : 'changed';
        return {
          ...f,
          current,
          value: proposed,
          state,
        };
      });
      return {
        ...item,
        matchedEmployeeId: emp.id,
        matchHow: 'escolha manual',
        isNewEmployeeMode: false,
        fields: nextFields,
      };
    });
    setShowPersonSwap(false);
  };

  const advanceToNextPending = (updatedQueue: ImportQueueItem[], fromIdx: number) => {
    const nextIdx = updatedQueue.findIndex(
      (it, idx) => idx > fromIdx && it.status === 'pend'
    );
    if (nextIdx >= 0) {
      setCurrentIndex(nextIdx);
      return;
    }
    const firstPend = updatedQueue.findIndex((it) => it.status === 'pend');
    if (firstPend >= 0) {
      setCurrentIndex(firstPend);
    }
  };

  const handleSaveCurrentItem = () => {
    if (!currentItem) return;
    const existingEmp = currentItem.isNewEmployeeMode
      ? undefined
      : employees.find((e) => e.id === currentItem.matchedEmployeeId);

    const resultingEmployee = applyImportItemToEmployee(currentItem, existingEmp);
    onConfirmInsert(resultingEmployee);

    const nextQueue = queue.map((it, idx) =>
      idx === currentIndex
        ? {
            ...it,
            status: 'ok' as const,
            savedSnapshot: existingEmp,
            wasInsertedAsNew: !existingEmp,
          }
        : it
    );
    setQueue(nextQueue);
    setStatusBanner(
      existingEmp
        ? `Ficha e planilha de ${resultingEmployee.name} atualizadas com sucesso (Hash SHA-256 arquivado no prontuário).`
        : `Novo colaborador ${resultingEmployee.name} (Mat. ${resultingEmployee.matricula}) cadastrado com as 32 colunas da planilha.`
    );
    advanceToNextPending(nextQueue, currentIndex);
  };

  const handleSkipCurrentItem = () => {
    if (!currentItem) return;
    const nextQueue = queue.map((it, idx) =>
      idx === currentIndex ? { ...it, status: 'skip' as const } : it
    );
    setQueue(nextQueue);
    advanceToNextPending(nextQueue, currentIndex);
  };

  const handleUndoCurrentItem = () => {
    if (!currentItem) return;
    if (currentItem.status === 'ok' && currentItem.savedSnapshot) {
      onConfirmInsert(currentItem.savedSnapshot);
    }
    setQueue((prev) =>
      prev.map((it, idx) =>
        idx === currentIndex ? { ...it, status: 'pend' as const } : it
      )
    );
    setStatusBanner('Revisão reaberta para edição.');
  };

  const handleSaveAllPending = () => {
    const pendingItems = queue.filter((it) => it.status === 'pend');
    if (!pendingItems.length) return;

    const upsertedEmployees: Employee[] = [];
    for (const item of pendingItems) {
      const existingEmp = item.isNewEmployeeMode
        ? undefined
        : employees.find((e) => e.id === item.matchedEmployeeId);
      const resulting = applyImportItemToEmployee(item, existingEmp);
      upsertedEmployees.push(resulting);
    }

    if (onConfirmBatchInsert) {
      onConfirmBatchInsert(upsertedEmployees);
    } else {
      upsertedEmployees.forEach((emp) => onConfirmInsert(emp));
    }

    setQueue((prev) =>
      prev.map((it) => (it.status === 'pend' ? { ...it, status: 'ok' as const } : it))
    );
    setStatusBanner(
      `${upsertedEmployees.length} documento(s) salvos em lote na planilha e arquivados nos prontuários.`
    );
  };

  const handleClearReviewed = () => {
    const remaining = queue.filter((it) => it.status === 'pend');
    setQueue(remaining);
    setCurrentIndex(0);
  };

  const handleOpenOriginalDocument = () => {
    if (!currentItem) return;
    const { doc } = currentItem;
    const blob =
      doc.file ?? new Blob([doc.text ?? ''], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer?.files?.length) {
      void handleFilesSelected(e.dataTransfer.files);
    }
  };

  const matchedEmp =
    currentItem && !currentItem.isNewEmployeeMode
      ? employees.find((e) => e.id === currentItem.matchedEmployeeId)
      : undefined;

  const registrationFields =
    currentItem?.fields.filter((f) => REGISTRATION_COL_KEYS.includes(f.key)) ?? [];
  const coordinationFields =
    currentItem?.fields.filter((f) => !REGISTRATION_COL_KEYS.includes(f.key)) ?? [];

  const filteredSwapEmployees = employees
    .filter((e) => {
      if (!personSearch.trim()) return true;
      const q = personSearch.toLowerCase();
      return (
        e.name.toLowerCase().includes(q) ||
        e.matricula.toLowerCase().includes(q) ||
        e.companyName.toLowerCase().includes(q)
      );
    })
    .slice(0, 30);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E2926]/65 p-2 backdrop-blur-[2px] sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="secilita-ocr-title"
    >
      <div className="flex h-[94vh] w-full max-w-[1600px] flex-col overflow-hidden rounded-2xl border border-[#D8D1C5] bg-[#FAF9F6] shadow-2xl">
        {/* Cabeçalho Superior do Workspace de Importação e OCR */}
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#DED9CE] bg-white px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1F564C] text-white">
              <FileScan className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="secilita-ocr-title"
                  className="text-[14px] font-bold text-[#1E2926]"
                >
                  Importar Documentos e Cadastrar Ficha (Leitor Interativo em 3 Colunas)
                </h2>
                <span className="rounded-full bg-[#EEF6F3] px-2.5 py-0.5 text-[10px] font-bold text-[#1F564C]">
                  Motor secilita_planilhas • 32 Colunas SESI
                </span>
              </div>
              <p className="text-[11px] text-[#5A6561]">
                1. Fila de documentos em lote à esquerda · 2. Visualização do documento com evidência marcada ao centro · 3. Campos cadastrais e clínicos da planilha à direita
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Carregador dos 14 anexos de teste do repositório secilita_planilhas */}
            <div className="flex items-center rounded-lg border border-[#DCD7CC] bg-[#FAF9F6] p-0.5">
              <select
                value={selectedDemoFile}
                onChange={(e) => setSelectedDemoFile(e.target.value)}
                aria-label="Selecionar anexo de teste do secilita_planilhas"
                className="rounded-l-md bg-transparent px-2 py-1 text-[11px] font-medium text-[#1E2926] focus:outline-none"
              >
                <option value="all">Todos os 14 anexos de teste (secilita_planilhas)</option>
                {SECILITA_DEMO_FILES.map((fn) => (
                  <option key={fn} value={fn}>
                    {fn}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleLoadDemoPack()}
                disabled={isLoadingFiles}
                className="inline-flex items-center gap-1 rounded-md bg-[#1F564C] px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[#163F37] disabled:opacity-50"
              >
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                <span>Carregar Anexos</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => void handleLoadCompleteRegistrationSample()}
              className="inline-flex items-center gap-1 rounded-lg border border-[#1F564C]/30 bg-[#EEF6F3] px-2.5 py-1.5 text-[11px] font-semibold text-[#1F564C] hover:bg-[#1F564C] hover:text-white"
            >
              <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>+ Ficha de Cadastro Completa</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-lg border border-[#DCD7CC] bg-white px-3 py-1.5 text-[11.5px] font-semibold text-[#5A6561] hover:border-[#1E2926] hover:text-[#1E2926]"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Fechar</span>
            </button>
          </div>
        </header>

        {statusBanner && (
          <div className="flex shrink-0 items-center justify-between border-b border-[#C6E4DA] bg-[#EEF6F3] px-4 py-1.5 text-[11.5px] font-medium text-[#1F564C]">
            <span>{statusBanner}</span>
            <button
              type="button"
              onClick={() => setStatusBanner('')}
              className="text-[10.5px] font-bold underline"
            >
              Ocultar
            </button>
          </div>
        )}

        {/* Corpo Principal: 3 Colunas Simultâneas (Esquerda: Lote | Centro: Documento | Direita: Campos) */}
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-12">
          {/* ================================================================ */}
          {/* COLUNA 1 (ESQUERDA - 3/12): FILA DE DOCUMENTOS INSERIDOS EM LOTE */}
          {/* ================================================================ */}
          <aside className="flex min-h-0 flex-col border-b border-[#DED9CE] bg-[#F2EFE8] lg:col-span-3 lg:border-b-0 lg:border-r">
            {/* Zona de Upload em Lote (Drag & Drop + Botões) */}
            <div className="shrink-0 space-y-2 border-b border-[#DED9CE] p-3">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(true);
                }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={handleDrop}
                className={`rounded-xl border-2 border-dashed p-3 text-center transition-colors ${
                  isDraggingOver
                    ? 'border-[#1F564C] bg-[#EEF6F3]'
                    : 'border-[#C8C2B6] bg-white/90'
                }`}
              >
                <Upload className="mx-auto h-5 w-5 text-[#1F564C]" aria-hidden="true" />
                <p className="mt-1 text-[11.5px] font-bold text-[#1E2926]">
                  Solte os arquivos aqui em lote
                </p>
                <p className="text-[10px] text-[#5A6561]">
                  PDF (digital ou escaneado), fotos JPG/PNG, e-mails (.eml/.html), conversas de WhatsApp (.txt/.zip), Word (.docx), XML, JSON ou CSV
                </p>
                <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.eml,.html,.htm,.txt,.zip,.docx,.odt,.xml,.json,.csv"
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      if (e.target.files) void handleFilesSelected(e.target.files);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#1F564C] px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-[#163F37]"
                  >
                    <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Escolher arquivos</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPasteBox((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#DCD7CC] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#1E2926] hover:border-[#1F564C]"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5 text-[#1F564C]" aria-hidden="true" />
                    <span>Colar um texto</span>
                  </button>
                </div>
              </div>

              {showPasteBox && (
                <div className="rounded-xl border border-[#DCD7CC] bg-white p-2.5 shadow-sm">
                  <textarea
                    rows={3}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Cole mensagem de WhatsApp, corpo de e-mail, evolução médica ou ficha de cadastro..."
                    className="w-full rounded-lg border border-[#DCD7CC] p-2 text-[11px] text-[#1E2926] focus:border-[#1F564C] focus:outline-none"
                  />
                  <div className="mt-1.5 flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowPasteBox(false)}
                      className="rounded px-2 py-1 text-[10.5px] text-[#5A6561]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleReadPastedText()}
                      className="rounded bg-[#1F564C] px-2.5 py-1 text-[10.5px] font-semibold text-white"
                    >
                      Ler texto
                    </button>
                  </div>
                </div>
              )}

              {/* Barra de Progresso do Lote */}
              <div className="rounded-lg border border-[#DED9CE] bg-white px-3 py-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-[#1E2926]">
                    {stats.done} de {stats.total} conferidos
                  </span>
                  {stats.done > 0 && (
                    <button
                      type="button"
                      onClick={handleClearReviewed}
                      className="text-[10px] font-semibold text-[#1F564C] hover:underline"
                    >
                      Limpar conferidos
                    </button>
                  )}
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#E2DDD3]">
                  <div
                    className="h-full bg-[#1F564C] transition-all duration-300"
                    style={{ width: `${stats.pct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Lista de Documentos do Lote */}
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {queue.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#DCD7CC] bg-white/70 p-6 text-center text-[11.5px] text-[#5A6561]">
                  Nenhum documento na fila. Solte arquivos acima ou clique em{' '}
                  <strong>Carregar Anexos</strong>.
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {queue.map((item, idx) => {
                    const isSelected = idx === currentIndex;
                    const empName =
                      item.fields.find((f) => f.key === 'nome')?.value ||
                      item.extraction.identity.nome ||
                      'Colaborador a identificar';
                    const docLabel = item.doc.parent
                      ? `${item.doc.parent} › ${item.doc.name}`
                      : item.doc.name;

                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentIndex(idx);
                            setActiveFieldKey(null);
                            setShowPersonSwap(false);
                          }}
                          className={`flex w-full items-start justify-between gap-2 rounded-xl border p-2.5 text-left transition-all ${
                            isSelected
                              ? 'border-[#1F564C] bg-white shadow-sm ring-1 ring-[#1F564C]/25'
                              : 'border-[#DED9CE] bg-white/75 hover:bg-white'
                          } ${item.status !== 'pend' ? 'opacity-75' : ''}`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-[11.5px] font-bold text-[#1E2926]">
                                {empName}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-[10px] text-[#5A6561]">
                              {docLabel} · {KIND_LABEL[item.extraction.kind]}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              <span className="rounded bg-[#F2EFE8] px-1.5 py-0.5 text-[9.5px] font-semibold text-[#5A6561]">
                                {item.doc.method}
                              </span>
                              {item.isNewEmployeeMode ? (
                                <span className="rounded bg-[#EEF6F3] px-1.5 py-0.5 text-[9.5px] font-bold text-[#1F564C]">
                                  Novo Cadastro
                                </span>
                              ) : (
                                <span className="rounded bg-[#FEFCE8] px-1.5 py-0.5 text-[9.5px] font-semibold text-[#A16207]">
                                  Atualiza Planilha
                                </span>
                              )}
                            </div>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold ${
                              item.status === 'ok'
                                ? 'bg-[#EEF6F3] text-[#1F564C]'
                                : item.status === 'skip'
                                ? 'bg-[#F1F5F9] text-[#64748B]'
                                : 'bg-[#FDF7EC] text-[#C26D27]'
                            }`}
                          >
                            {item.status === 'ok'
                              ? 'Salvo'
                              : item.status === 'skip'
                              ? 'Pulado'
                              : 'Conferir'}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          {/* ================================================================ */}
          {/* COLUNA 2 (CENTRO - 5/12): VISUALIZAÇÃO INTERATIVA DO DOCUMENTO    */}
          {/* ================================================================ */}
          <section className="flex min-h-0 flex-col border-b border-[#DED9CE] bg-[#E8E3D9] lg:col-span-5 lg:border-b-0 lg:border-r">
            {currentItem ? (
              <>
                {/* Barra de Topo do Visualizador Central */}
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#DED9CE] bg-white px-3.5 py-2">
                  <div className="flex items-center gap-1 rounded-lg bg-[#F2EFE8] p-0.5">
                    <button
                      type="button"
                      onClick={() => setDocTab('rendered')}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        docTab === 'rendered'
                          ? 'bg-[#1F564C] text-white'
                          : 'text-[#5A6561] hover:text-[#1E2926]'
                      }`}
                    >
                      Documento
                    </button>
                    <button
                      type="button"
                      onClick={() => setDocTab('raw')}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        docTab === 'raw'
                          ? 'bg-[#1F564C] text-white'
                          : 'text-[#5A6561] hover:text-[#1E2926]'
                      }`}
                    >
                      Texto lido (OCR)
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-[10.5px] text-[#5A6561]">
                    <span
                      title={`SHA-256: ${currentItem.doc.sha256Hash}`}
                      className="inline-flex items-center gap-1 rounded bg-[#EEF6F3] px-2 py-0.5 font-mono text-[9.5px] font-semibold text-[#1F564C]"
                    >
                      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                      SHA-256: {currentItem.doc.sha256Hash.slice(0, 10)}…
                    </span>
                    <button
                      type="button"
                      onClick={handleOpenOriginalDocument}
                      className="inline-flex items-center gap-1 rounded border border-[#DCD7CC] bg-white px-2 py-1 text-[10.5px] font-semibold text-[#1E2926] hover:border-[#1F564C] hover:text-[#1F564C]"
                    >
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      <span>Abrir original</span>
                    </button>
                  </div>
                </div>

                {/* Faixa de Rastreabilidade de Evidência quando um campo está selecionado */}
                {activeField && (
                  <div className="shrink-0 border-b border-[#FDE68A] bg-[#FEFCE8] px-3.5 py-2 text-[11px] text-[#854D0E]">
                    Campo <strong>{activeField.label}</strong> extraído do trecho:{' '}
                    <span className="font-semibold">“{activeField.evidence}”</span>
                  </div>
                )}

                {/* Corpo do Documento Central */}
                <div
                  ref={docViewerRef}
                  className="min-h-0 flex-1 overflow-y-auto p-4"
                >
                  {docTab === 'raw' ? (
                    <div className="rounded-xl border border-[#D8D1C5] bg-white p-4 shadow-sm">
                      <div className="mb-2 flex items-center justify-between border-b border-[#EFECE6] pb-2 text-[10.5px] text-[#5A6561]">
                        <span className="font-bold text-[#1E2926]">
                          Texto Integral Extraído ({currentItem.doc.method})
                        </span>
                        <span>
                          {Math.round(currentItem.doc.ms)} ms •{' '}
                          {(currentItem.doc.sizeBytes / 1024).toFixed(1)} KB
                        </span>
                      </div>
                      <pre
                        className="whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-[#1E2926]"
                        dangerouslySetInnerHTML={{
                          __html: renderHighlightedHtml(
                            currentItem.doc.text ||
                              (currentItem.record
                                ? currentItem.record
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join('\n')
                                : ''),
                            activeField?.evidence ?? ''
                          ),
                        }}
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* 1. Preview Visual de Imagem / Foto / PDF Escaneado */}
                      {currentItem.doc.previewImageUrl && (
                        <div className="overflow-hidden rounded-xl border border-[#D8D1C5] bg-white p-3 shadow-sm">
                          <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-[#5A6561]">
                            <span>Imagem Original do Documento ({currentItem.doc.name})</span>
                            <span className="rounded bg-[#FDF7EC] px-2 py-0.5 text-[10px] font-bold text-[#C26D27]">
                              {currentItem.doc.method}
                            </span>
                          </div>
                          <img
                            src={currentItem.doc.previewImageUrl}
                            alt={currentItem.doc.name}
                            className="mx-auto max-h-[380px] w-auto rounded-lg border border-[#EFECE6] object-contain"
                          />
                        </div>
                      )}

                      {/* 2. Renderizador de Conversa de WhatsApp */}
                      {currentItem.doc.channel === 'whatsapp' &&
                      parseWhatsApp(currentItem.doc.text ?? '').length >= 2 ? (
                        <div className="rounded-xl border border-[#D8D1C5] bg-[#ECE5DD] p-4 shadow-sm">
                          <div className="mb-3 flex items-center justify-between rounded-lg bg-[#075E54] px-3 py-2 text-white">
                            <span className="text-[12px] font-bold">
                              WhatsApp • Coordenação do Cuidado SESI
                            </span>
                            <span className="text-[10px] opacity-80">
                              {currentItem.doc.name}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {parseWhatsApp(currentItem.doc.text ?? '').map((msg, i) => {
                              const isStaff =
                                /ponte|enferm|aps|equipe|saude|coordena|sesi/i.test(
                                  msg.sender
                                );
                              return (
                                <div
                                  key={i}
                                  className={`max-w-[88%] rounded-xl px-3 py-2 text-[11.5px] shadow-sm ${
                                    isStaff
                                      ? 'mr-auto bg-white text-[#1E2926]'
                                      : 'ml-auto bg-[#DCF8C6] text-[#1E2926]'
                                  }`}
                                >
                                  <div className="mb-0.5 text-[10px] font-bold text-[#1F564C]">
                                    {msg.sender}
                                  </div>
                                  <div
                                    className="whitespace-pre-wrap leading-relaxed"
                                    dangerouslySetInnerHTML={{
                                      __html: renderHighlightedHtml(
                                        msg.text,
                                        activeField?.evidence ?? ''
                                      ),
                                    }}
                                  />
                                  <div className="mt-1 text-right text-[9.5px] text-[#5A6561]">
                                    {msg.date.toLocaleDateString('pt-BR')}{' '}
                                    {String(msg.date.getHours()).padStart(2, '0')}:
                                    {String(msg.date.getMinutes()).padStart(2, '0')}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : currentItem.record ? (
                        /* 3. Renderizador de Registro Estruturado (XML, JSON, CSV) */
                        <div className="rounded-xl border border-[#D8D1C5] bg-white p-4 shadow-sm">
                          <div className="mb-3 flex items-center justify-between border-b border-[#EFECE6] pb-2">
                            <span className="text-[12px] font-bold text-[#1E2926]">
                              Registro Estruturado ({currentItem.doc.method}) —{' '}
                              {currentItem.doc.name}
                            </span>
                          </div>
                          <dl className="divide-y divide-[#EFECE6] text-[11.5px]">
                            {currentItem.record.map(([k, v], i) => (
                              <div
                                key={i}
                                className="grid grid-cols-12 gap-2 py-1.5"
                              >
                                <dt className="col-span-5 font-mono text-[10.5px] font-semibold text-[#5A6561]">
                                  {k}
                                </dt>
                                <dd
                                  className="col-span-7 font-medium text-[#1E2926]"
                                  dangerouslySetInnerHTML={{
                                    __html: renderHighlightedHtml(
                                      v,
                                      activeField?.evidence ?? ''
                                    ),
                                  }}
                                />
                              </div>
                            ))}
                          </dl>
                        </div>
                      ) : (
                        /* 4. Folha de Documento Clínico / Ficha S+ / E-mail com Destaque de Evidência */
                        <div className="mx-auto max-w-[680px] rounded-xl border border-[#D8D1C5] bg-white p-5 shadow-md">
                          <div className="mb-3 flex items-center justify-between border-b-2 border-[#1F564C] pb-2.5">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F564C]">
                                {KIND_LABEL[currentItem.extraction.kind]} • SESI Saúde Acolhe
                              </span>
                              <h3 className="text-[13px] font-bold text-[#1E2926]">
                                {currentItem.doc.name}
                              </h3>
                            </div>
                            <span className="rounded-md bg-[#F2EFE8] px-2 py-1 text-[10px] font-semibold text-[#5A6561]">
                              {currentItem.doc.method}
                            </span>
                          </div>
                          <div
                            className="whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-[#1E2926]"
                            dangerouslySetInnerHTML={{
                              __html: renderHighlightedHtml(
                                currentItem.doc.text ?? '',
                                activeField?.evidence ?? ''
                              ),
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-center text-[12px] text-[#5A6561]">
                Selecione um documento na barra lateral esquerda para visualizá-lo no centro.
              </div>
            )}
          </section>

          {/* ================================================================ */}
          {/* COLUNA 3 (DIREITA - 4/12): INFORMAÇÕES EXTRAÍDAS E PLANILHA SESI  */}
          {/* ================================================================ */}
          <aside className="flex min-h-0 flex-col bg-white lg:col-span-4">
            {currentItem ? (
              <>
                {/* Cabeçalho de Identificação da Pessoa (Vínculo na Planilha ou Novo Cadastro) */}
                <div className="shrink-0 border-b border-[#DED9CE] bg-[#FAF9F6] p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F564C]">
                        {currentItem.isNewEmployeeMode
                          ? 'Modo: Cadastrar Novo Funcionário na Planilha'
                          : `Funcionário Encontrado (${currentItem.matchHow})`}
                      </span>
                      <h3 className="truncate text-[13.5px] font-bold text-[#1E2926]">
                        {matchedEmp
                          ? matchedEmp.name
                          : currentItem.fields.find((f) => f.key === 'nome')?.value ||
                            'Novo Colaborador'}
                      </h3>
                      <p className="text-[11px] text-[#5A6561]">
                        {matchedEmp ? (
                          <>
                            Matrícula <strong>{matchedEmp.matricula}</strong> ·{' '}
                            {matchedEmp.companyName} · {matchedEmp.referenceDoctor}
                          </>
                        ) : (
                          <>
                            Supre todas as colunas cadastrais e de coordenação para inclusão imediata
                          </>
                        )}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowPersonSwap((v) => !v)}
                        className="rounded-lg border border-[#DCD7CC] bg-white px-2.5 py-1 text-[10.5px] font-semibold text-[#1E2926] hover:border-[#1F564C]"
                      >
                        {showPersonSwap ? 'Fechar busca' : 'Trocar vínculo'}
                      </button>
                      {!currentItem.isNewEmployeeMode && (
                        <button
                          type="button"
                          onClick={handleSwitchToNewEmployeeMode}
                          className="rounded-lg border border-[#1F564C]/30 bg-[#EEF6F3] px-2.5 py-1 text-[10.5px] font-semibold text-[#1F564C] hover:bg-[#1F564C] hover:text-white"
                        >
                          + Novo Cadastro
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Caixa de Troca de Pessoa / Modo Novo Cadastro */}
                  {showPersonSwap && (
                    <div className="mt-2.5 rounded-xl border border-[#DCD7CC] bg-white p-2.5 shadow-sm">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <input
                          type="search"
                          value={personSearch}
                          onChange={(e) => setPersonSearch(e.target.value)}
                          placeholder="Buscar funcionário na planilha por nome ou matrícula..."
                          className="w-full rounded-lg border border-[#DCD7CC] px-2.5 py-1 text-[11px] text-[#1E2926] focus:border-[#1F564C] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleSwitchToNewEmployeeMode}
                          className="shrink-0 rounded-lg bg-[#1F564C] px-2.5 py-1 text-[10.5px] font-semibold text-white"
                        >
                          Criar como Novo
                        </button>
                      </div>
                      <ul className="max-h-36 space-y-1 overflow-y-auto">
                        {filteredSwapEmployees.map((emp) => (
                          <li key={emp.id}>
                            <button
                              type="button"
                              onClick={() => handleAssignExistingEmployee(emp)}
                              className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-[11px] hover:bg-[#EEF6F3]"
                            >
                              <span className="font-semibold text-[#1E2926]">
                                {emp.name}
                              </span>
                              <span className="text-[10px] text-[#5A6561]">
                                Mat. {emp.matricula} · {emp.companyName}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Lista Editável de Campos Extraídos do Documento */}
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3.5">
                  {/* Bloco 1: Campos Cadastrais / Não-Médicos do Funcionário */}
                  {registrationFields.length > 0 && (
                    <div className="rounded-xl border border-[#DED9CE] bg-[#FAF9F6] p-3">
                      <div className="mb-2.5 flex items-center justify-between border-b border-[#E5E0D5] pb-1.5">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#1F564C]">
                          <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          1. Dados Cadastrais do Funcionário (Colunas 1 a 11)
                        </span>
                        <span className="text-[10px] font-semibold text-[#5A6561]">
                          {registrationFields.length} campos
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {registrationFields.map((field) => {
                          const isFocused = activeFieldKey === field.key;
                          const opts = ALLOWED[field.key];
                          const isCompany = field.key === 'empresa';
                          const isDoctor = field.key === 'medico';

                          return (
                            <div
                              key={field.key}
                              onClick={() => setActiveFieldKey(field.key)}
                              className={`rounded-lg border p-2.5 transition-all ${
                                isFocused
                                  ? 'border-[#1F564C] bg-white ring-2 ring-[#1F564C]/15'
                                  : 'border-[#E5E0D5] bg-white'
                              }`}
                            >
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-[#1E2926]">
                                  {field.label}
                                </span>
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[9.5px] font-bold ${
                                    field.state === 'new'
                                      ? 'bg-[#EEF6F3] text-[#1F564C]'
                                      : field.state === 'changed'
                                      ? 'bg-[#FDF7EC] text-[#C26D27]'
                                      : 'bg-[#F1F5F9] text-[#64748B]'
                                  }`}
                                >
                                  {field.state === 'new'
                                    ? 'Novo'
                                    : field.state === 'changed'
                                    ? 'Muda'
                                    : 'Igual'}
                                </span>
                              </div>

                              {opts ? (
                                <select
                                  value={field.value}
                                  onFocus={() => setActiveFieldKey(field.key)}
                                  onChange={(e) =>
                                    handleFieldChange(field.key, e.target.value)
                                  }
                                  className="w-full rounded-md border border-[#DCD7CC] bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-[#1E2926] focus:border-[#1F564C] focus:outline-none"
                                >
                                  <option value="">(vazio)</option>
                                  {opts.map((o) => (
                                    <option key={o} value={o}>
                                      {o}
                                    </option>
                                  ))}
                                </select>
                              ) : isCompany ? (
                                <select
                                  value={field.value}
                                  onFocus={() => setActiveFieldKey(field.key)}
                                  onChange={(e) =>
                                    handleFieldChange(field.key, e.target.value)
                                  }
                                  className="w-full rounded-md border border-[#DCD7CC] bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-[#1E2926] focus:border-[#1F564C] focus:outline-none"
                                >
                                  {Object.keys(COMPANY_METADATA).map((comp) => (
                                    <option key={comp} value={comp}>
                                      {comp}
                                    </option>
                                  ))}
                                  {!COMPANY_METADATA[field.value] && field.value && (
                                    <option value={field.value}>{field.value}</option>
                                  )}
                                </select>
                              ) : isDoctor ? (
                                <select
                                  value={field.value}
                                  onFocus={() => setActiveFieldKey(field.key)}
                                  onChange={(e) =>
                                    handleFieldChange(field.key, e.target.value)
                                  }
                                  className="w-full rounded-md border border-[#DCD7CC] bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-[#1E2926] focus:border-[#1F564C] focus:outline-none"
                                >
                                  {REFERENCE_DOCTORS.map((docName) => (
                                    <option key={docName} value={docName}>
                                      {docName}
                                    </option>
                                  ))}
                                  {!REFERENCE_DOCTORS.includes(
                                    field.value as (typeof REFERENCE_DOCTORS)[number]
                                  ) &&
                                    field.value && (
                                      <option value={field.value}>{field.value}</option>
                                    )}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={field.value}
                                  onFocus={() => setActiveFieldKey(field.key)}
                                  onChange={(e) =>
                                    handleFieldChange(field.key, e.target.value)
                                  }
                                  className="w-full rounded-md border border-[#DCD7CC] bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-[#1E2926] focus:border-[#1F564C] focus:outline-none"
                                />
                              )}

                              {field.current && field.proposed !== field.current && (
                                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[#5A6561]">
                                  <span>
                                    Antes: <s>{field.current}</s>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleFieldRestore(field.key)}
                                    className="font-semibold text-[#1F564C] hover:underline"
                                  >
                                    {field.value === field.current
                                      ? 'Usar o do documento'
                                      : 'Manter o que estava'}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Campos Operacionais de Turno/Cargo/Setor para Novo Cadastro */}
                        {currentItem.isNewEmployeeMode && (
                          <div className="grid grid-cols-1 gap-2 rounded-lg border border-[#E5E0D5] bg-white p-2.5 sm:grid-cols-3">
                            <div>
                              <label className="block text-[10px] font-bold text-[#5A6561]">
                                Setor Industrial
                              </label>
                              <input
                                type="text"
                                value={currentItem.extraRegistration.sector}
                                onChange={(e) =>
                                  updateCurrentItem((it) => ({
                                    ...it,
                                    extraRegistration: {
                                      ...it.extraRegistration,
                                      sector: e.target.value,
                                    },
                                  }))
                                }
                                className="mt-0.5 w-full rounded border border-[#DCD7CC] px-2 py-1 text-[11px]"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-[#5A6561]">
                                Cargo / Função
                              </label>
                              <input
                                type="text"
                                value={currentItem.extraRegistration.role}
                                onChange={(e) =>
                                  updateCurrentItem((it) => ({
                                    ...it,
                                    extraRegistration: {
                                      ...it.extraRegistration,
                                      role: e.target.value,
                                    },
                                  }))
                                }
                                className="mt-0.5 w-full rounded border border-[#DCD7CC] px-2 py-1 text-[11px]"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-[#5A6561]">
                                Turno
                              </label>
                              <select
                                value={currentItem.extraRegistration.shift}
                                onChange={(e) =>
                                  updateCurrentItem((it) => ({
                                    ...it,
                                    extraRegistration: {
                                      ...it.extraRegistration,
                                      shift: e.target
                                        .value as ImportQueueItem['extraRegistration']['shift'],
                                    },
                                  }))
                                }
                                className="mt-0.5 w-full rounded border border-[#DCD7CC] px-2 py-1 text-[11px]"
                              >
                                <option value="1º Turno (06h–14h)">1º Turno (06h–14h)</option>
                                <option value="2º Turno (14h–22h)">2º Turno (14h–22h)</option>
                                <option value="Administrativo (08h–17h)">
                                  Administrativo (08h–17h)
                                </option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Bloco 2: Campos de Coordenação do Cuidado da Planilha SESI */}
                  {coordinationFields.length > 0 && (
                    <div className="rounded-xl border border-[#DED9CE] bg-[#FAF9F6] p-3">
                      <div className="mb-2.5 flex items-center justify-between border-b border-[#E5E0D5] pb-1.5">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#1F564C]">
                          <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                          2. Coordenação do Cuidado na Planilha (Colunas 12 a 32)
                        </span>
                        <span className="text-[10px] font-semibold text-[#5A6561]">
                          {coordinationFields.length} campos
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {coordinationFields.map((field) => {
                          const isFocused = activeFieldKey === field.key;
                          const opts = ALLOWED[field.key];
                          const isLongText =
                            field.key === 'demandas' ||
                            field.key === 'historico' ||
                            field.key.startsWith('cont');

                          return (
                            <div
                              key={field.key}
                              onClick={() => setActiveFieldKey(field.key)}
                              className={`rounded-lg border p-2.5 transition-all ${
                                isFocused
                                  ? 'border-[#1F564C] bg-white ring-2 ring-[#1F564C]/15'
                                  : 'border-[#E5E0D5] bg-white'
                              }`}
                            >
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-[#1E2926]">
                                  {field.label || LABEL[field.key]}
                                </span>
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[9.5px] font-bold ${
                                    field.state === 'new'
                                      ? 'bg-[#EEF6F3] text-[#1F564C]'
                                      : field.state === 'changed'
                                      ? 'bg-[#FDF7EC] text-[#C26D27]'
                                      : 'bg-[#F1F5F9] text-[#64748B]'
                                  }`}
                                >
                                  {field.state === 'new'
                                    ? 'Novo'
                                    : field.state === 'changed'
                                    ? 'Muda'
                                    : 'Igual'}
                                </span>
                              </div>

                              {opts ? (
                                <select
                                  value={field.value}
                                  onFocus={() => setActiveFieldKey(field.key)}
                                  onChange={(e) =>
                                    handleFieldChange(field.key, e.target.value)
                                  }
                                  className="w-full rounded-md border border-[#DCD7CC] bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-[#1E2926] focus:border-[#1F564C] focus:outline-none"
                                >
                                  <option value="">(vazio)</option>
                                  {opts.map((o) => (
                                    <option key={o} value={o}>
                                      {o}
                                    </option>
                                  ))}
                                </select>
                              ) : isLongText ? (
                                <textarea
                                  rows={2}
                                  value={field.value}
                                  onFocus={() => setActiveFieldKey(field.key)}
                                  onChange={(e) =>
                                    handleFieldChange(field.key, e.target.value)
                                  }
                                  className="w-full rounded-md border border-[#DCD7CC] bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-[#1E2926] focus:border-[#1F564C] focus:outline-none"
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={field.value}
                                  onFocus={() => setActiveFieldKey(field.key)}
                                  onChange={(e) =>
                                    handleFieldChange(field.key, e.target.value)
                                  }
                                  className="w-full rounded-md border border-[#DCD7CC] bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-[#1E2926] focus:border-[#1F564C] focus:outline-none"
                                />
                              )}

                              {field.current && field.proposed !== field.current && (
                                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[#5A6561]">
                                  <span className="truncate">
                                    Antes: <s>{field.current}</s>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleFieldRestore(field.key)}
                                    className="shrink-0 font-semibold text-[#1F564C] hover:underline"
                                  >
                                    {field.value === field.current
                                      ? 'Usar o do documento'
                                      : 'Manter o que estava'}
                                  </button>
                                </div>
                              )}

                              <p className="mt-1 truncate text-[10px] text-[#5A6561]">
                                Trecho: “{field.evidence}”
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Seções Clínicas Lidas no Documento que Ficam Só no Prontuário (Fora da Planilha) */}
                  {currentItem.extraction.ignored.length > 0 && (
                    <details className="rounded-xl border border-[#DCD7CC] bg-[#FAF9F6] p-3 text-[11px] text-[#5A6561]">
                      <summary className="cursor-pointer font-bold text-[#1E2926]">
                        No documento, mas restrito ao prontuário ({currentItem.extraction.ignored.length})
                      </summary>
                      <p className="mt-1 text-[10.5px]">
                        Estas seções foram identificadas no documento e ficam salvas no arquivo de integridade do prontuário, sem expor dados sensíveis na planilha operacional:
                      </p>
                      <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[10.5px]">
                        {currentItem.extraction.ignored.map((ig, i) => (
                          <li key={i}>{ig}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>

                {/* Rodapé de Ações da Coluna Direita (Pular, Desfazer, Salvar, Salvar Todos) */}
                <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#DED9CE] bg-[#FAF9F6] px-3.5 py-2.5">
                  <div className="flex items-center gap-1.5">
                    {currentItem.status === 'pend' ? (
                      <button
                        type="button"
                        onClick={handleSkipCurrentItem}
                        className="rounded-lg border border-[#DCD7CC] bg-white px-3 py-1.5 text-[11.5px] font-semibold text-[#5A6561] hover:border-[#1E2926] hover:text-[#1E2926]"
                      >
                        Pular
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleUndoCurrentItem}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#DCD7CC] bg-white px-3 py-1.5 text-[11.5px] font-semibold text-[#1E2926]"
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Desfazer ({currentItem.status === 'ok' ? 'Salvo' : 'Pulado'})</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {stats.pending > 1 && (
                      <button
                        type="button"
                        onClick={handleSaveAllPending}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#1F564C] bg-[#EEF6F3] px-3 py-1.5 text-[11.5px] font-bold text-[#1F564C] hover:bg-[#1F564C] hover:text-white"
                      >
                        <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Salvar todos ({stats.pending})</span>
                      </button>
                    )}

                    {currentItem.status === 'pend' && (
                      <button
                        type="button"
                        onClick={handleSaveCurrentItem}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F564C] px-4 py-1.5 text-[11.5px] font-bold text-white shadow-sm hover:bg-[#163F37]"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>
                          {currentItem.isNewEmployeeMode
                            ? 'Cadastrar na Planilha'
                            : 'Salvar na Planilha'}
                        </span>
                      </button>
                    )}
                  </div>
                </footer>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6 text-center text-[12px] text-[#5A6561]">
                Nenhum item selecionado para revisão.
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

export default NewEmployeeOcrModal;
