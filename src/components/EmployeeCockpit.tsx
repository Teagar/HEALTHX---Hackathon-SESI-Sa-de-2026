import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  Archive,
  CalendarCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Eye,
  FileCheck2,
  FileScan,
  FileText,
  FolderOpen,
  HeartPulse,
  ListChecks,
  Lock,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stethoscope,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import type {
  CheckIn60s,
  Employee,
  ExamPrescriptionEntry,
  MonthlyContacts2026,
  ReturnRule,
  RiskLevel,
  StoredProntuarioDocument,
} from '../types';
import {
  calculateNextVisitDate,
  getAllowedReturnRulesForRisk,
  getDefaultReturnRuleForRisk,
  normalizeEmployeeAfterSave,
  REFERENCE_DOCTORS,
  registerFirstConsultation,
} from '../queueService';
import { CARE_PLAN_VALID_OPTIONS } from '../xlsxWorkbookService';
import {
  ALLOWED,
  applyImportItemToEmployee,
  ColKey,
  createPastedTextSourceDoc,
  FieldDiffRow,
  highlightEvidenceParts,
  ImportQueueItem,
  KIND_LABEL,
  LABEL,
  readImportedFile,
  sourceDocsToQueueItems,
} from '../secilitaEngine';

export interface EmployeeCockpitProps {
  employee: Employee;
  onSave: (employee: Employee) => void;
  onSendWhatsApp: (employeeId: string) => void;
  onClose: () => void;
}

const RISK_LABELS: Record<RiskLevel, string> = {
  0: 'Sem Avaliação • Busca Ativa',
  1: 'Risco 1 • Hígido (6m)',
  2: 'Risco 2 • Fator de Risco (6m)',
  3: 'Risco 3 • Comorbidade (3m)',
  4: 'Risco 4 • Crítico (Quinzenal/Mensal)',
};

const RISK_SELECT_CLASSES: Record<RiskLevel, string> = {
  0: 'border-[#CBD5E1] bg-[#F8FAFC] text-[#475569]',
  1: 'border-[#C6E4DA] bg-[#EEF6F3] text-[#1F564C]',
  2: 'border-[#FDE68A] bg-[#FEFCE8] text-[#A16207]',
  3: 'border-[#F5DFB8] bg-[#FDF7EC] text-[#C26D27]',
  4: 'border-[#F5C6BC] bg-[#FDF2F0] text-[#C84B31]',
};

const FIELD_CLASS =
  'w-full rounded-lg border border-[#DCD7CC] bg-white px-2.5 py-1.5 text-[12px] text-[#1E2926] placeholder:text-[#9AA29E] focus:border-[#1F564C] focus:outline-none focus:ring-2 focus:ring-[#1F564C]/15';
const LABEL_CLASS =
  'mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#5A6561]';

const PRONTUARIO_SAMPLE_DOCUMENTS = [
  {
    fileName: 'laudo_laboratorial_hba1c_lipidograma.pdf',
    label: 'Laudo Laboratorial (HbA1c + Lipidograma)',
    text: [
      'LAUDO LABORATORIAL E EVOLUÇÃO DE PRONTUÁRIO S+',
      'Data Ficha: 15/11/2026',
      'Resultado de Exame Laboratorial: Hemograma completo dentro dos parâmetros de normalidade.',
      'Glicemia de jejum: 104 mg/dL • Hemoglobina Glicada (HbA1c): 6,0%',
      'Lipidograma: Colesterol Total 182 mg/dL • HDL 52 mg/dL • Triglicerídeos 138 mg/dL.',
      'Pressão Arterial aferida em consultório: PA 126/80 mmHg em controle adequado.',
      'Classificação de risco de saúde: 2 - Saudável com risco',
      'Status plano de cuidado: Aderiu totalmente',
      'Retorno da consulta médica - data prevista: 15/05/2027',
    ].join('\n'),
  },
  {
    fileName: 'prescricao_medica_retorno_has.pdf',
    label: 'Prescrição Médica de Retorno (Hipertensão / DCNT)',
    text: [
      'PRESCRIÇÃO MÉDICA E GESTÃO DE RETORNO APS SESI',
      'Data do monitoramento: 15/11/2026',
      'Data da última consulta médica: 15/11/2026',
      'Prescrição Médica: Manter Losartana Potássica 50mg 1 cp pela manhã + Hidroclorotiazida 12,5mg 1x/dia.',
      'Classificação de risco de saúde: 3 - Compensado',
      'Verificação de adesão ao plano de cuidado: A cada 3 meses',
      'Atendimento com equipe multiprofissional: Sim',
      'Retorno da consulta médica - data prevista: 13/02/2027',
      'Status plano de cuidado: Aderiu parcialmente',
      'Feito contato: Sim',
      'Agendamento realizado: Sim',
      'Observações do contato realizado: Receituário renovado e exames de controle solicitados.',
    ].join('\n'),
  },
  {
    fileName: 'evolucao_multiprofissional_nutri_psico.pdf',
    label: 'Evolução Multiprofissional (Nutrição + Psicologia)',
    text: [
      'PLANO DE CUIDADOS E EVOLUÇÃO MULTIPROFISSIONAL APS',
      'Data Ficha: 15/11/2026',
      'Encaminhamento Multiprofissional: Acompanhamento com nutricionista Sim; Acompanhamento com psicólogo Sim.',
      'Realizar exames laboratoriais de controle trimestral.',
      'Classificação de risco de saúde: 3 - Compensado',
      'Próximo contato: 15/02/2027',
      'Observações: Colaborador em seguimento conjunto com Nutrição Clínica e Psicologia APS para manejo de estresse ocupacional e reeducação alimentar.',
    ].join('\n'),
  },
];

function todayIso(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatDateBr(value: string): string {
  if (!isIsoDate(value)) return value || '—';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function highlightProntuarioHtml(rawText: string, activeEvidence: string): string {
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

export function EmployeeCockpit({
  employee,
  onSave,
  onSendWhatsApp,
  onClose,
}: EmployeeCockpitProps) {
  const [draft, setDraft] = useState<Employee>(employee);
  const [dirty, setDirty] = useState(false);
  const [firstVisitRisk, setFirstVisitRisk] = useState<Exclude<RiskLevel, 0>>(2);

  // Integração com Sistema de Agendamento (S+) e Agenda Microsoft Teams
  const [appointmentModality, setAppointmentModality] = useState<
    'Presencial no Consultório APS' | 'Teleatendimento via Microsoft Teams'
  >('Presencial no Consultório APS');
  const [teamsCalendarSynced, setTeamsCalendarSynced] = useState<boolean>(employee.sentStatus);
  const [showWorkerAccessPreview, setShowWorkerAccessPreview] = useState<boolean>(false);

  // Estado do Leitor Interativo de Prontuário / Exames em 3 Colunas + Arquivo de Integridade
  const examFileInputRef = useRef<HTMLInputElement>(null);
  const [isProntuarioReaderOpen, setIsProntuarioReaderOpen] = useState<boolean>(false);
  const [prontuarioQueue, setProntuarioQueue] = useState<ImportQueueItem[]>([]);
  const [prontuarioIdx, setProntuarioIdx] = useState<number>(0);
  const [prontuarioTab, setProntuarioTab] = useState<'rendered' | 'raw'>('rendered');
  const [activeProntuarioField, setActiveProntuarioField] = useState<ColKey | null>(null);
  const [inspectedStoredDoc, setInspectedStoredDoc] =
    useState<StoredProntuarioDocument | null>(null);

  useEffect(() => {
    setDraft(employee);
    setDirty(false);
    setTeamsCalendarSynced(employee.sentStatus);
    setInspectedStoredDoc(null);
  }, [employee.id]);

  useEffect(() => {
    setDraft((prev) =>
      prev.sentStatus === employee.sentStatus
        ? prev
        : { ...prev, sentStatus: employee.sentStatus }
    );
    if (employee.sentStatus) {
      setTeamsCalendarSynced(true);
    }
  }, [employee.sentStatus]);

  function update<K extends keyof Employee>(key: K, value: Employee[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function updateMonthlyContact(monthKey: keyof MonthlyContacts2026, value: string) {
    setDraft((prev) => ({
      ...prev,
      monthlyContacts: {
        ...(prev.monthlyContacts || {
          jul: '',
          ago: '',
          set: '',
          out: '',
          nov: '',
          dez: '',
        }),
        [monthKey]: value,
      },
    }));
    setDirty(true);
  }

  const handleRiskChange = (nextRisk: RiskLevel) => {
    setDirty(true);
    setDraft((prev) => {
      if (nextRisk === 0) {
        return {
          ...prev,
          riskLevel: 0,
          neverScheduled: true,
          returnRule: '1ª Consulta Inicial',
          nextVisit: 'Pendente 1ª Consulta',
          riskVerificationReturnDate: 'Pendente 1ª Consulta',
          carePlanStatus: '',
        };
      }
      const returnRule = getDefaultReturnRuleForRisk(nextRisk);
      const lastVisit = isIsoDate(prev.lastVisit) ? prev.lastVisit : todayIso();
      const nextVisit = calculateNextVisitDate(lastVisit, returnRule, nextRisk);
      return {
        ...prev,
        riskLevel: nextRisk,
        initialRiskLevel: prev.initialRiskLevel || nextRisk,
        neverScheduled: false,
        returnRule,
        lastVisit,
        nextVisit,
        riskVerificationReturnDate: nextVisit,
        nextCareCoordinationDate: nextVisit,
        goalsAdhesionStatus: prev.goalsAdhesionStatus || nextVisit,
        carePlanStatus: prev.carePlanStatus || 'AGUARDANDO RESPOSTA',
      };
    });
  };

  const handleReturnRuleChange = (returnRule: ReturnRule) => {
    setDirty(true);
    setDraft((prev) => {
      const nextVisit =
        prev.riskLevel > 0
          ? calculateNextVisitDate(prev.lastVisit, returnRule, prev.riskLevel)
          : prev.nextVisit;
      return {
        ...prev,
        returnRule,
        nextVisit,
        riskVerificationReturnDate: nextVisit,
        nextCareCoordinationDate: nextVisit,
      };
    });
  };

  const handleLastVisitChange = (lastVisit: string) => {
    setDirty(true);
    setDraft((prev) => {
      const nextVisit =
        prev.riskLevel > 0 && isIsoDate(lastVisit)
          ? calculateNextVisitDate(lastVisit, prev.returnRule, prev.riskLevel)
          : prev.nextVisit;
      return {
        ...prev,
        lastVisit,
        nextVisit,
        riskVerificationReturnDate: nextVisit,
        careCoordinationDate: lastVisit,
        nextCareCoordinationDate: nextVisit,
      };
    });
  };

  const handleSave = () => {
    const saved = normalizeEmployeeAfterSave(draft);
    setDraft(saved);
    setDirty(false);
    onSave(saved);
  };

  const handleRegisterFirstVisit = () => {
    const updated = registerFirstConsultation(draft, firstVisitRisk);
    setDraft(updated);
    setDirty(false);
    onSave(updated);
  };

  const handleSyncScheduleAndTeams = () => {
    const passCode = draft.carePassCode || `PASSE-${draft.matricula.slice(-4)}`;
    const slot =
      draft.protectedWindowSlot ||
      (draft.shift.startsWith('1º Turno')
        ? 'Terça/Quinta • 09h30–10h00 (Janela Protegida 1º Turno)'
        : 'Quarta/Sexta • 15h30–16h00 (Janela Protegida 2º Turno)');
    const today = '2026-11-15';

    const updated = normalizeEmployeeAfterSave({
      ...draft,
      sentStatus: true,
      carePassCode: passCode,
      protectedWindowSlot: slot,
      careCoordinationDate: today,
      contactHistory2026: `Agendado via S+ & Microsoft Teams (${appointmentModality}) • ${slot}`,
      monthlyContacts: {
        ...(draft.monthlyContacts || {
          jul: '—',
          ago: '—',
          set: '—',
          out: '—',
          nov: 'Agendado Teams/S+',
          dez: 'Programado',
        }),
        nov: `Agendado (${appointmentModality.includes('Teams') ? 'Teams' : 'S+'})`,
      },
      whatsappStatus: `✓ Sincronizado na Agenda Teams / S+ (${passCode}) • Link de acesso enviado ao colaborador`,
    });

    setTeamsCalendarSynced(true);
    setDraft(updated);
    setDirty(false);
    onSave(updated);
    if (!draft.sentStatus) {
      onSendWhatsApp(draft.id);
    }
  };

  // Abre o Leitor Interativo de Prontuário / Exames em 3 Colunas
  const openProntuarioReaderWithSample = async (sampleIdx = 0) => {
    const sample = PRONTUARIO_SAMPLE_DOCUMENTS[sampleIdx] ?? PRONTUARIO_SAMPLE_DOCUMENTS[0];
    const headerInjected = [
      `Funcionário (Código / Nome): ${draft.matricula} - ${draft.name}`,
      `Empresa: ${draft.companyName}`,
      sample.text,
    ].join('\n');
    const doc = await createPastedTextSourceDoc(headerInjected, sample.fileName);
    doc.channel = 'pdf';
    doc.method = 'Leitura OCR de Prontuário / Exame';
    const items = sourceDocsToQueueItems([doc], [draft]).map((it) => ({
      ...it,
      matchedEmployeeId: draft.id,
      isNewEmployeeMode: false,
      matchHow: 'matrícula' as const,
    }));
    setProntuarioQueue((prev) => [...items, ...prev]);
    setProntuarioIdx(0);
    setIsProntuarioReaderOpen(true);
  };

  const handleProntuarioFilesUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || !fileList.length) return;
    const files = Array.from(fileList);
    event.target.value = '';
    const docs = [];
    for (const f of files) {
      docs.push(...(await readImportedFile(f)));
    }
    const items = sourceDocsToQueueItems(docs, [draft]).map((it) => ({
      ...it,
      matchedEmployeeId: draft.id,
      isNewEmployeeMode: false,
      matchHow: 'matrícula' as const,
    }));
    setProntuarioQueue((prev) => [...items, ...prev]);
    setProntuarioIdx(0);
    setIsProntuarioReaderOpen(true);
  };

  const currentProntuarioItem = prontuarioQueue[prontuarioIdx] ?? null;

  const handleProntuarioFieldChange = (key: ColKey, newValue: string) => {
    setProntuarioQueue((prev) =>
      prev.map((it, idx) => {
        if (idx !== prontuarioIdx) return it;
        const nextFields: FieldDiffRow[] = it.fields.map((f) =>
          f.key === key
            ? {
                ...f,
                value: newValue,
                state:
                  newValue.trim().toUpperCase() === f.current.trim().toUpperCase()
                    ? 'same'
                    : !f.current
                    ? 'new'
                    : 'changed',
              }
            : f
        );
        return { ...it, fields: nextFields };
      })
    );
  };

  const handleApplyProntuarioItem = () => {
    if (!currentProntuarioItem) return;
    const updatedEmp = applyImportItemToEmployee(currentProntuarioItem, draft);
    setDraft(updatedEmp);
    setDirty(false);
    onSave(updatedEmp);
    setProntuarioQueue((prev) =>
      prev.map((it, idx) =>
        idx === prontuarioIdx ? { ...it, status: 'ok' as const } : it
      )
    );
  };

  function handleRemoveExamEntry(entryId: string) {
    const currentList = draft.examResultsAndPrescriptions || [];
    update(
      'examResultsAndPrescriptions',
      currentList.filter((item) => item.id !== entryId)
    );
  }

  const handleRecordPreCheckIn = () => {
    const suggestedTriage: CheckIn60s['suggestedTriage'] =
      draft.riskLevel >= 3 ? 'Médico de Família' : 'Enfermagem (Acolhimento)';
    const sample: CheckIn60s = {
      submittedAt: new Date().toLocaleDateString('pt-BR'),
      painLevel: 'Leve',
      sleepQuality: 'Acorda cansado',
      energyLevel: 'Cansaço no fim do turno',
      stressAndMood: 'Ansioso / Pressionado',
      bloodPressureRef: '132/84 mmHg • aferida na triagem de enfermagem',
      suggestedTriage,
    };
    setDraft((prev) => ({ ...prev, checkIn60s: sample }));
    setDirty(true);
  };

  const isPendingFirstVisit = draft.neverScheduled || draft.riskLevel === 0;
  const sent = draft.sentStatus;
  const allowedRules = getAllowedReturnRulesForRisk(draft.riskLevel);
  const storedDocs = draft.storedDocuments || [];
  const mc = draft.monthlyContacts || {
    jul: '',
    ago: '',
    set: '',
    out: '',
    nov: '',
    dez: '',
  };

  const activeProntuarioDiff =
    currentProntuarioItem?.fields.find((f) => f.key === activeProntuarioField) ?? null;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#DED9CE] bg-white shadow-sm">
      {/* Barra Superior Minimalista da Ficha (60px) */}
      <header className="flex min-h-[60px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E6E2D8] bg-[#FAF9F6] px-4 py-2.5">
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={draft.name}
              onChange={(event) => update('name', event.target.value)}
              aria-label="Nome do funcionário"
              className="min-w-[180px] flex-1 rounded border-b border-transparent bg-transparent px-1 py-0.5 text-[15px] font-bold text-[#1E2926] focus:border-[#1F564C] focus:bg-white focus:outline-none"
            />
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                draft.status === 'INATIVO'
                  ? 'bg-[#F1F5F9] text-[#64748B]'
                  : 'bg-[#EEF6F3] text-[#1F564C]'
              }`}
            >
              {draft.status || 'ATIVO'}
            </span>
            {isPendingFirstVisit && draft.status !== 'INATIVO' && (
              <span className="rounded-full border border-[#F5C6BC] bg-[#FDF2F0] px-2 py-0.5 text-[10px] font-bold text-[#C84B31]">
                Busca Ativa • 1ª Consulta
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#5A6561]">
            <span>Mat. {draft.matricula}</span>
            <span>•</span>
            <span>CPF {draft.cpf}</span>
            <span>•</span>
            <span className="font-medium text-[#1E2926]">{draft.companyName}</span>
            <span>•</span>
            <span className="font-medium text-[#1F564C]">{draft.referenceDoctor}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5">
            <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-[#5A6561] sm:inline">
              Risco Atual
            </span>
            <select
              value={draft.riskLevel}
              onChange={(event) => handleRiskChange(Number(event.target.value) as RiskLevel)}
              aria-label="Classificação de Risco"
              className={`rounded-lg border px-2.5 py-1.5 text-[11.5px] font-bold focus:outline-none ${
                RISK_SELECT_CLASSES[draft.riskLevel]
              }`}
            >
              {([4, 3, 2, 1, 0] as RiskLevel[]).map((level) => (
                <option key={level} value={level}>
                  {RISK_LABELS[level]}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={handleSave}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11.5px] font-semibold transition-colors ${
              dirty
                ? 'border-[#1F564C] bg-[#1F564C] text-white shadow-sm hover:bg-[#163F37]'
                : 'border-[#DCD7CC] bg-white text-[#1E2926] hover:border-[#1F564C] hover:text-[#1F564C]'
            }`}
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            Salvar Alterações
          </button>

          <button
            type="button"
            onClick={() => onSendWhatsApp(draft.id)}
            disabled={sent}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11.5px] font-semibold transition-colors ${
              sent
                ? 'cursor-default border-[#C6E4DA] bg-[#EEF6F3] text-[#1F564C]'
                : 'border-[#1F564C] bg-white text-[#1F564C] hover:bg-[#EEF6F3]'
            }`}
          >
            {sent ? (
              <>
                <Check className="h-3.5 w-3.5" aria-hidden="true" /> Enviado
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" aria-hidden="true" /> Enviar
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-lg border border-[#DCD7CC] bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-[#5A6561] transition-colors hover:border-[#C84B31] hover:text-[#C84B31]"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Fechar Ficha
          </button>
        </div>
      </header>

      {/* Corpo Principal em 2 Colunas Simultâneas (7/12 Esquerda e 5/12 Direita) */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-[#F6F4EE] p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* COLUNA ESQUERDA (7/12): Identificação, Equipe Multiprofissional, Gestão do Cuidado + PCI */}
          <div className="min-w-0 space-y-4 lg:col-span-7">
            {/* Bloco 1: Identificação, Vínculo e Atendimento Multiprofissional */}
            <article className="rounded-xl border border-[#DED9CE] bg-white p-4">
              <SectionHeader
                icon={<FileText className="h-4 w-4" aria-hidden="true" />}
                title="Coordenação do Cuidado • Identificação, Vínculo e Equipe Multiprofissional"
                subtitle="Cadastro ocupacional, médico de referência e histórico de consultas multiprofissionais"
              />
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                <div>
                  <label className={LABEL_CLASS}>Matrícula</label>
                  <input
                    type="text"
                    value={draft.matricula}
                    onChange={(e) => update('matricula', e.target.value)}
                    className={FIELD_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Status Cadastral</label>
                  <select
                    value={draft.status || 'ATIVO'}
                    onChange={(e) => update('status', e.target.value as 'ATIVO' | 'INATIVO')}
                    className={FIELD_CLASS}
                  >
                    <option value="ATIVO">ATIVO</option>
                    <option value="INATIVO">INATIVO</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Data de Nascimento</label>
                  <input
                    type="date"
                    value={isIsoDate(draft.birthDate) ? draft.birthDate : '1988-01-01'}
                    onChange={(e) => update('birthDate', e.target.value)}
                    className={FIELD_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Idade e Sexo</label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      value={draft.age}
                      onChange={(e) => update('age', Number(e.target.value))}
                      className={`${FIELD_CLASS} w-16`}
                    />
                    <select
                      value={draft.sex}
                      onChange={(e) =>
                        update('sex', e.target.value as 'MASCULINO' | 'FEMININO')
                      }
                      className={`${FIELD_CLASS} flex-1`}
                    >
                      <option value="MASCULINO">MASCULINO</option>
                      <option value="FEMININO">FEMININO</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className={LABEL_CLASS}>CPF</label>
                  <input
                    type="text"
                    value={draft.cpf}
                    onChange={(e) => update('cpf', e.target.value)}
                    className={FIELD_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Data de Entrada APS</label>
                  <input
                    type="date"
                    value={isIsoDate(draft.admissionDate) ? draft.admissionDate : '2025-05-15'}
                    onChange={(e) => update('admissionDate', e.target.value)}
                    className={FIELD_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Telefone / WhatsApp</label>
                  <input
                    type="text"
                    value={draft.phone}
                    onChange={(e) => update('phone', e.target.value)}
                    className={FIELD_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Empresa Contratante</label>
                  <input
                    type="text"
                    value={draft.companyName}
                    onChange={(e) => update('companyName', e.target.value)}
                    className={FIELD_CLASS}
                  />
                </div>

                <div>
                  <label className={LABEL_CLASS}>Médico de Referência</label>
                  <select
                    value={draft.referenceDoctor}
                    onChange={(e) => update('referenceDoctor', e.target.value)}
                    className={FIELD_CLASS}
                  >
                    {REFERENCE_DOCTORS.map((doc) => (
                      <option key={doc} value={doc}>
                        {doc}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Atendimento Equipe Multi?</label>
                  <select
                    value={draft.multiTeamCare ? 'SIM' : 'NÃO'}
                    onChange={(e) => update('multiTeamCare', e.target.value === 'SIM')}
                    className={FIELD_CLASS}
                  >
                    <option value="SIM">SIM</option>
                    <option value="NÃO">NÃO</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Últ. Consulta Nutricionista</label>
                  <input
                    type="date"
                    value={draft.lastNutritionDate || ''}
                    onChange={(e) => update('lastNutritionDate', e.target.value)}
                    className={FIELD_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Últ. Consulta Psicologia</label>
                  <input
                    type="date"
                    value={draft.lastPsychologyDate || ''}
                    onChange={(e) => update('lastPsychologyDate', e.target.value)}
                    className={FIELD_CLASS}
                  />
                </div>

                <div>
                  <label className={LABEL_CLASS}>Últ. Consulta Médica</label>
                  <input
                    type="date"
                    value={draft.lastVisit || ''}
                    onChange={(e) => handleLastVisitChange(e.target.value)}
                    className={FIELD_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Classificação de Risco Inicial</label>
                  <select
                    value={draft.initialRiskLevel ?? draft.riskLevel}
                    onChange={(e) =>
                      update('initialRiskLevel', Number(e.target.value) as RiskLevel)
                    }
                    className={FIELD_CLASS}
                  >
                    <option value={4}>RISCO 4</option>
                    <option value={3}>RISCO 3</option>
                    <option value={2}>RISCO 2</option>
                    <option value={1}>RISCO 1</option>
                    <option value={0}>Sem Avaliação</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={LABEL_CLASS}>Cargo / Setor e Turno</label>
                  <input
                    type="text"
                    value={draft.role}
                    onChange={(e) => update('role', e.target.value)}
                    className={FIELD_CLASS}
                  />
                </div>
              </div>

              {/* Demandas Geradas e Anamnese */}
              <div className="mt-3 space-y-3 border-t border-[#EFECE6] pt-3">
                <div>
                  <label className={LABEL_CLASS}>
                    Demandas Geradas na Última Consulta Médica
                  </label>
                  <input
                    type="text"
                    value={draft.lastMedicalDemands || draft.summaryLine}
                    onChange={(e) => {
                      update('lastMedicalDemands', e.target.value);
                      update('summaryLine', e.target.value);
                    }}
                    className={FIELD_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Anamnese e Evolução Clínica (Prontuário S+)</label>
                  <textarea
                    rows={2}
                    value={draft.clinicalNotes}
                    onChange={(e) => update('clinicalNotes', e.target.value)}
                    className={`${FIELD_CLASS} resize-y leading-relaxed`}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <EditableListCard
                    title="Hábitos de Vida"
                    icon={<HeartPulse className="h-3.5 w-3.5" aria-hidden="true" />}
                    items={draft.habits}
                    placeholder="Novo hábito..."
                    onChange={(items) => update('habits', items)}
                  />
                  <EditableListCard
                    title="Condições / DCNT / Mental"
                    icon={<Activity className="h-3.5 w-3.5" aria-hidden="true" />}
                    items={draft.conditions}
                    placeholder="Nova condição..."
                    onChange={(items) => update('conditions', items)}
                  />
                  <EditableListCard
                    title="Medicações e Rastreio"
                    icon={<Stethoscope className="h-3.5 w-3.5" aria-hidden="true" />}
                    items={draft.medsAndScreening}
                    placeholder="Nova medicação..."
                    onChange={(items) => update('medsAndScreening', items)}
                  />
                </div>
              </div>
            </article>

            {/* Bloco 2: Plano de Cuidados Individual (PCI) */}
            <article className="rounded-xl border border-[#DED9CE] bg-white p-4">
              <SectionHeader
                icon={<ListChecks className="h-4 w-4" aria-hidden="true" />}
                title="Plano de Cuidados Individual (PCI)"
                subtitle="Envio do plano, verificação de adesão às metas e status assistencial"
              />
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className={LABEL_CLASS}>Data Envio do Plano</label>
                  <input
                    type="date"
                    value={draft.planSentDate || ''}
                    onChange={(e) => update('planSentDate', e.target.value)}
                    className={FIELD_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Verificar Adesão das Metas</label>
                  <input
                    type="text"
                    value={draft.goalsAdhesionStatus || ''}
                    onChange={(e) => update('goalsAdhesionStatus', e.target.value)}
                    placeholder="Data ou status de verificação"
                    className={FIELD_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Status Plano de Cuidado</label>
                  <select
                    value={draft.carePlanStatus || ''}
                    onChange={(e) => update('carePlanStatus', e.target.value)}
                    className={FIELD_CLASS}
                  >
                    <option value="">Pendente de Avaliação</option>
                    {CARE_PLAN_VALID_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <EditableListCard
                  title="Metas Pactuadas com o Colaborador"
                  icon={<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
                  items={draft.pciRecommendations}
                  placeholder="Adicionar meta..."
                  onChange={(items) => update('pciRecommendations', items)}
                />
                <EditableListCard
                  title="Exames e Encaminhamentos Solicitados"
                  icon={<ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />}
                  items={draft.pciExams}
                  placeholder="Adicionar exame..."
                  onChange={(items) => update('pciExams', items)}
                />
              </div>
            </article>
          </div>

          {/* COLUNA DIREITA (5/12): Gestão de Retorno + Agendamento Integrado + Leitor de Prontuário/Exames + Custódia de Arquivos */}
          <div className="min-w-0 space-y-4 lg:col-span-5">
            {isPendingFirstVisit && draft.status !== 'INATIVO' && (
              <article className="rounded-xl border border-[#F5C6BC] bg-[#FDF2F0] p-4">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#C84B31] text-white">
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[12px] font-bold uppercase tracking-wide text-[#C84B31]">
                      Busca Ativa • 1ª Consulta Pendente
                    </h3>
                    <p className="mt-0.5 text-[11px] text-[#7A3A2A]">
                      Colaborador ativo há <strong>{draft.daysSinceActivation} dias</strong> sem registro de 1ª consulta.
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="min-w-[160px] flex-1">
                    <span className="mb-1 block text-[9.5px] font-bold uppercase text-[#7A3A2A]">
                      Classificação na 1ª Consulta
                    </span>
                    <select
                      value={firstVisitRisk}
                      onChange={(e) =>
                        setFirstVisitRisk(Number(e.target.value) as Exclude<RiskLevel, 0>)
                      }
                      className="w-full rounded-lg border border-[#F5C6BC] bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-[#C84B31]"
                    >
                      {([4, 3, 2, 1] as Exclude<RiskLevel, 0>[]).map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {RISK_LABELS[lvl]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={handleRegisterFirstVisit}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F564C] px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-[#163F37]"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Registrar 1ª Consulta Realizada
                  </button>
                </div>
              </article>
            )}

            {/* Bloco 3: Gestão de Retorno Automatizada + Conexão Sistema de Agendamento & Microsoft Teams */}
            <article className="rounded-xl border border-[#DED9CE] bg-white p-4">
              <SectionHeader
                icon={<CalendarClock className="h-4 w-4" aria-hidden="true" />}
                title="Gestão de Retorno & Integração de Agenda (S+ / Microsoft Teams)"
                subtitle="Prazos calculados automaticamente sem necessidade de digitação manual"
              />
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={LABEL_CLASS}>Regra de Retorno APS</label>
                  <select
                    value={draft.returnRule}
                    onChange={(e) => handleReturnRuleChange(e.target.value as ReturnRule)}
                    disabled={draft.riskLevel === 0}
                    className={FIELD_CLASS}
                  >
                    {allowedRules.map((rule) => (
                      <option key={rule} value={rule}>
                        {rule}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLASS}>
                    Previsão de Retorno (Solicitação Médica)
                  </label>
                  <input
                    type="text"
                    value={formatDateBr(draft.nextVisit)}
                    readOnly
                    className={`${FIELD_CLASS} bg-[#EEF6F3] font-bold text-[#1F564C]`}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>
                    Retorno p/ Verificar Classificação de Risco
                  </label>
                  <input
                    type="date"
                    value={
                      isIsoDate(draft.riskVerificationReturnDate)
                        ? draft.riskVerificationReturnDate
                        : isIsoDate(draft.nextVisit)
                        ? draft.nextVisit
                        : ''
                    }
                    onChange={(e) => update('riskVerificationReturnDate', e.target.value)}
                    className={FIELD_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Data da Coord. Cuidado</label>
                  <input
                    type="date"
                    value={draft.careCoordinationDate || ''}
                    onChange={(e) => update('careCoordinationDate', e.target.value)}
                    className={FIELD_CLASS}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={LABEL_CLASS}>Data da Próxima Coord. Cuidado (Automática)</label>
                  <input
                    type="text"
                    value={formatDateBr(draft.nextCareCoordinationDate || draft.nextVisit)}
                    readOnly
                    className={`${FIELD_CLASS} bg-[#FAF9F6] font-semibold text-[#1E2926]`}
                  />
                </div>
              </div>

              {/* Card de Conexão com Sistema de Agendamento e Agenda do Microsoft Teams */}
              <div className="mt-3.5 space-y-3 rounded-xl border border-[#C6E4DA] bg-[#F4F9F7] p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1F564C] text-white">
                      <Video className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <div>
                      <h4 className="text-[11.5px] font-bold text-[#1E2926]">
                        Agenda Conectada • Sistema S+ & Microsoft Teams
                      </h4>
                      <p className="text-[10px] text-[#5A6561]">
                        Reserva automática na janela do turno e envio de link direto ao trabalhador
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold ${
                      teamsCalendarSynced
                        ? 'bg-[#1F564C] text-white'
                        : 'border border-[#C6E4DA] bg-white text-[#1F564C]'
                    }`}
                  >
                    {teamsCalendarSynced ? '✓ Sincronizado na Agenda' : 'Pronto p/ Agendar'}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <label className={LABEL_CLASS}>Janela Protegida do Turno</label>
                    <input
                      type="text"
                      value={draft.protectedWindowSlot || ''}
                      onChange={(e) => update('protectedWindowSlot', e.target.value)}
                      className={FIELD_CLASS}
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Canal de Atendimento</label>
                    <select
                      value={appointmentModality}
                      onChange={(e) =>
                        setAppointmentModality(
                          e.target.value as
                            | 'Presencial no Consultório APS'
                            | 'Teleatendimento via Microsoft Teams'
                        )
                      }
                      className={FIELD_CLASS}
                    >
                      <option value="Presencial no Consultório APS">
                        Presencial no Consultório APS
                      </option>
                      <option value="Teleatendimento via Microsoft Teams">
                        Teleatendimento via Microsoft Teams
                      </option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSyncScheduleAndTeams}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#1F564C] px-3 py-2 text-[11.5px] font-semibold text-white shadow-xs transition-colors hover:bg-[#163F37]"
                  >
                    <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    {teamsCalendarSynced
                      ? 'Atualizar Evento no Teams / S+ e Reenviar Acesso'
                      : 'Agendar no Teams / S+ e Enviar Acesso ao Trabalhador'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowWorkerAccessPreview((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#1F564C]/30 bg-white px-2.5 py-2 text-[11px] font-semibold text-[#1F564C] transition-colors hover:bg-[#EEF6F3]"
                  >
                    <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                    {showWorkerAccessPreview ? 'Ocultar Acesso' : 'Ver Acesso do Trabalhador'}
                  </button>
                </div>

                {showWorkerAccessPreview && (
                  <div className="space-y-2 rounded-xl border border-[#DCD7CC] bg-white p-3 shadow-xs">
                    <div className="flex items-center justify-between border-b border-[#EFECE6] pb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F564C]">
                        Visão do Trabalhador • Acesso Direto sem Senha (Teams & WhatsApp)
                      </span>
                      <span className="rounded bg-[#EEF6F3] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#1F564C]">
                        {draft.carePassCode || `PASSE-${draft.matricula.slice(-4)}`}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-[#1E2926]">
                      Olá, <strong>{draft.name.split(' ')[0]}</strong>! Seu atendimento com{' '}
                      <strong>{draft.referenceDoctor}</strong> está reservado na sua janela protegida:{' '}
                      <strong className="text-[#1F564C]">
                        {draft.protectedWindowSlot || 'Horário protegido do turno'}
                      </strong>
                      .
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#EEF6F3] px-2.5 py-1 text-[10.5px] font-semibold text-[#1F564C]">
                        <CheckCircle2 className="h-3 w-3" /> Horário liberado no turno (sem desconto)
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#F4F1EA] px-2.5 py-1 text-[10.5px] font-semibold text-[#1E2926]">
                        <ExternalLink className="h-3 w-3 text-[#1F564C]" /> Link Direto Microsoft Teams / Check-in 60s
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </article>

            {/* Bloco 4: Leitura de Prontuário / Resultados de Exames (Visualizador 3 Colunas + Custódia de Integridade SHA-256) */}
            <article className="rounded-xl border border-[#DED9CE] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFECE6] pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EEF6F3] text-[#1F564C]">
                    <FileScan className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-[12px] font-bold text-[#1E2926]">
                      Prontuário & Resultados de Exames (Leitor 3 Colunas + Custódia SHA-256)
                    </h3>
                    <p className="text-[10.5px] text-[#5A6561]">
                      Importa laudos, receitas e evoluções com visualização central e armazena os arquivos lidos com controle de integridade
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void openProntuarioReaderWithSample(0)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#1F564C] bg-[#1F564C] px-2.5 py-1.5 text-[10.5px] font-semibold text-white shadow-xs hover:bg-[#163F37]"
                  >
                    <FileScan className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Abrir Leitor de Prontuário / Exame</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => examFileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#DCD7CC] bg-[#FAF9F6] px-2.5 py-1.5 text-[10.5px] font-semibold text-[#1E2926] hover:border-[#1F564C]"
                  >
                    <Upload className="h-3 w-3 text-[#1F564C]" aria-hidden="true" />
                    <span>Anexar Arquivo</span>
                  </button>
                  <input
                    ref={examFileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.txt,.eml,.html,.docx,.xml,.json,.csv"
                    onChange={(e) => void handleProntuarioFilesUpload(e)}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Botões Rápidos de Documentos de Prontuário / Exames */}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {PRONTUARIO_SAMPLE_DOCUMENTS.map((sample, idx) => (
                  <button
                    key={sample.fileName}
                    type="button"
                    onClick={() => void openProntuarioReaderWithSample(idx)}
                    className="rounded-md border border-[#DCD7CC] bg-[#FAF9F6] px-2 py-1 text-[10px] font-semibold text-[#1E2926] hover:border-[#1F564C] hover:bg-[#EEF6F3] hover:text-[#1F564C]"
                  >
                    + Ler {sample.label}
                  </button>
                ))}
              </div>

              {/* Repositório de Arquivos Lidos & Controle de Segurança da Integridade da Informação */}
              <div className="mt-3 rounded-xl border border-[#C6E4DA] bg-[#F4F9F7] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-[#1F564C]" aria-hidden="true" />
                    <span className="text-[11px] font-bold text-[#1E2926]">
                      Arquivos Lidos e Armazenados no Prontuário (Integridade SHA-256)
                    </span>
                  </div>
                  <span className="rounded-full bg-[#1F564C] px-2 py-0.5 text-[9.5px] font-bold text-white">
                    {storedDocs.length} arquivo(s) sob custódia
                  </span>
                </div>

                {storedDocs.length === 0 ? (
                  <p className="mt-2 rounded-lg border border-dashed border-[#C6E4DA] bg-white/80 px-3 py-2.5 text-center text-[10.5px] text-[#5A6561]">
                    Nenhum arquivo de prontuário/exame arquivado ainda. Clique em{' '}
                    <strong>Abrir Leitor de Prontuário / Exame</strong> para ler e armazenar com hash SHA-256.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {storedDocs.map((sdoc) => (
                      <li
                        key={sdoc.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-[#DCD7CC] bg-white px-2.5 py-2 text-[11px]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Archive className="h-3.5 w-3.5 shrink-0 text-[#1F564C]" />
                            <span className="truncate font-bold text-[#1E2926]">
                              {sdoc.fileName}
                            </span>
                            <span className="rounded bg-[#EEF6F3] px-1.5 py-0.5 text-[9px] font-bold text-[#1F564C]">
                              {sdoc.docKind}
                            </span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[9.5px] text-[#5A6561]">
                            <span>{sdoc.importedAt}</span>
                            <span>•</span>
                            <span className="font-mono text-[#1F564C]">
                              SHA-256: {sdoc.sha256IntegrityHash.slice(0, 14)}…
                            </span>
                            <span>•</span>
                            <span>{sdoc.fieldsUpdated.length} campo(s) auditado(s)</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setInspectedStoredDoc(
                              inspectedStoredDoc?.id === sdoc.id ? null : sdoc
                            )
                          }
                          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#DCD7CC] bg-[#FAF9F6] px-2 py-1 text-[10px] font-semibold text-[#1E2926] hover:border-[#1F564C] hover:text-[#1F564C]"
                        >
                          <Eye className="h-3 w-3" aria-hidden="true" />
                          <span>
                            {inspectedStoredDoc?.id === sdoc.id ? 'Fechar' : 'Inspecionar'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {inspectedStoredDoc && (
                  <div className="mt-2.5 rounded-lg border border-[#1F564C]/30 bg-white p-3 text-[11px]">
                    <div className="flex items-center justify-between border-b border-[#EFECE6] pb-1.5">
                      <span className="font-bold text-[#1F564C]">
                        Registro de Auditoria e Integridade: {inspectedStoredDoc.fileName}
                      </span>
                      <span className="font-mono text-[9.5px] text-[#5A6561]">
                        Hash: {inspectedStoredDoc.sha256IntegrityHash.slice(0, 24)}…
                      </span>
                    </div>
                    {inspectedStoredDoc.fieldsUpdated.length > 0 && (
                      <div className="mt-2">
                        <p className="text-[10px] font-bold uppercase text-[#5A6561]">
                          Campos Atualizados a partir deste Documento:
                        </p>
                        <ul className="mt-1 space-y-1 text-[10.5px]">
                          {inspectedStoredDoc.fieldsUpdated.map((fu, i) => (
                            <li key={i} className="rounded bg-[#FAF9F6] px-2 py-1">
                              <strong>{fu.label}:</strong> {fu.before} →{' '}
                              <strong className="text-[#1F564C]">{fu.after}</strong>{' '}
                              <span className="text-[9.5px] text-[#5A6561]">
                                (“{fu.evidence}”)
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="mt-2">
                      <p className="text-[10px] font-bold uppercase text-[#5A6561]">
                        Conteúdo Arquivado (Somente Leitura • Imutável):
                      </p>
                      <pre className="mt-1 max-h-36 overflow-y-auto whitespace-pre-wrap rounded border border-[#EFECE6] bg-[#FAF9F6] p-2 font-mono text-[10px] text-[#1E2926]">
                        {inspectedStoredDoc.extractedText}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              {/* Lista de Prescrições e Exames Clínicos Registrados */}
              <div className="mt-3 space-y-2">
                {(draft.examResultsAndPrescriptions || []).length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#DCD7CC] bg-[#FAF9F6] px-3 py-3 text-center text-[11px] text-[#8A938F]">
                    Nenhuma prescrição ou resultado de exame anexado neste retorno.
                  </p>
                ) : (
                  (draft.examResultsAndPrescriptions || []).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-2 rounded-lg border border-[#E6E2D8] bg-[#FAF9F6] p-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-[#EEF6F3] px-1.5 py-0.5 text-[9.5px] font-bold text-[#1F564C]">
                            {item.category}
                          </span>
                          <span className="text-[10px] text-[#5A6561]">
                            {formatDateBr(item.date)} • {item.sourceMethod}
                          </span>
                          {item.sha256Hash && (
                            <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[9px] text-[#1F564C]">
                              SHA-256: {item.sha256Hash.slice(0, 8)}…
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[11.5px] font-bold text-[#1E2926]">
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-snug text-[#5A6561]">
                          {item.details}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveExamEntry(item.id)}
                        aria-label="Remover registro"
                        className="rounded p-1 text-[#8A938F] hover:bg-[#FDF2F0] hover:text-[#C84B31]"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </article>

            {/* Bloco 5: Histórico e Contatos Mensais de 2026 + Pré-Check-in QR */}
            <article className="rounded-xl border border-[#DED9CE] bg-white p-4">
              <SectionHeader
                icon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
                title="Histórico e Contatos Mensais de Monitoramento (2026)"
                subtitle="Registro automático de gestão de retorno (Sálvia / Equipe APS) e pré-consulta rápida"
              />
              <div className="mt-3">
                <label className={LABEL_CLASS}>Histórico de Contatos de 2026</label>
                <input
                  type="text"
                  value={draft.contactHistory2026 || ''}
                  onChange={(e) => update('contactHistory2026', e.target.value)}
                  className={FIELD_CLASS}
                />
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(
                  [
                    ['jul', 'Contato Julho / 2026'],
                    ['ago', 'Contato Agosto / 2026'],
                    ['set', 'Contato Setembro / 2026'],
                    ['out', 'Contato Outubro / 2026'],
                    ['nov', 'Contato Novembro / 2026'],
                    ['dez', 'Contato Dezembro / 2026'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <label className="mb-0.5 block text-[9.5px] font-semibold text-[#5A6561]">
                      {label}
                    </label>
                    <input
                      type="text"
                      value={mc[key] || ''}
                      onChange={(e) => updateMonthlyContact(key, e.target.value)}
                      className="w-full rounded-md border border-[#DCD7CC] bg-[#FAF9F6] px-2 py-1 text-[11px] text-[#1E2926] focus:border-[#1F564C] focus:bg-white focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-3 border-t border-[#EFECE6] pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-bold uppercase tracking-wide text-[#5A6561]">
                    Pré-Check-in 60s do Trabalhador (QR Code / Link Teams)
                  </span>
                  {!draft.checkIn60s && (
                    <button
                      type="button"
                      onClick={handleRecordPreCheckIn}
                      className="text-[10.5px] font-semibold text-[#1F564C] hover:underline"
                    >
                      + Registrar respostas do trabalhador
                    </button>
                  )}
                </div>
                {draft.checkIn60s ? (
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5 rounded-lg border border-[#E6E2D8] bg-[#FAF9F6] p-2.5 text-[10.5px]">
                    <div>
                      <span className="text-[#8A938F]">Dor:</span>{' '}
                      <strong className="text-[#1E2926]">{draft.checkIn60s.painLevel}</strong>
                    </div>
                    <div>
                      <span className="text-[#8A938F]">Sono:</span>{' '}
                      <strong className="text-[#1E2926]">{draft.checkIn60s.sleepQuality}</strong>
                    </div>
                    <div>
                      <span className="text-[#8A938F]">Humor:</span>{' '}
                      <strong className="text-[#1E2926]">{draft.checkIn60s.stressAndMood}</strong>
                    </div>
                    <div>
                      <span className="text-[#8A938F]">PA Ref.:</span>{' '}
                      <strong className="text-[#1F564C]">
                        {draft.checkIn60s.bloodPressureRef}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-[11px] text-[#8A938F]">
                    Sem pré-check-in registrado para a consulta atual.
                  </p>
                )}
              </div>
            </article>
          </div>
        </div>
      </div>

      {/* ======================================================================== */}
      {/* MODAL DE 3 COLUNAS: LEITOR DE PRONTUÁRIO E RESULTADOS DE EXAME + SHA-256 */}
      {/* ======================================================================== */}
      {isProntuarioReaderOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E2926]/65 p-2 backdrop-blur-[2px] sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Leitor Interativo de Prontuário e Resultados de Exame"
        >
          <div className="flex h-[90vh] w-full max-w-[1480px] flex-col overflow-hidden rounded-2xl border border-[#D8D1C5] bg-[#FAF9F6] shadow-2xl">
            <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#DED9CE] bg-white px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1F564C] text-white">
                  <FileScan className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-[13.5px] font-bold text-[#1E2926]">
                    Leitor de Prontuário, Exames e Prescrições — {draft.name} (Mat. {draft.matricula})
                  </h3>
                  <p className="text-[11px] text-[#5A6561]">
                    Estrutura em 3 colunas com destaque de evidência no documento e arquivamento imutável (SHA-256) no prontuário
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => examFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#1F564C] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#163F37]"
                >
                  <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Adicionar Laudos / Prontuários</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsProntuarioReaderOpen(false)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#DCD7CC] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#5A6561] hover:text-[#1E2926]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Fechar Leitor</span>
                </button>
              </div>
            </header>

            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-12">
              {/* Coluna Esquerda (3/12): Documentos de Prontuário / Exames Inseridos */}
              <aside className="flex min-h-0 flex-col border-r border-[#DED9CE] bg-[#F2EFE8] lg:col-span-3">
                <div className="border-b border-[#DED9CE] p-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F564C]">
                    1. Documentos Clínicos em Lote ({prontuarioQueue.length})
                  </span>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {PRONTUARIO_SAMPLE_DOCUMENTS.map((s, i) => (
                      <button
                        key={s.fileName}
                        type="button"
                        onClick={() => void openProntuarioReaderWithSample(i)}
                        className="rounded border border-[#DCD7CC] bg-white px-2 py-1 text-[10px] font-semibold text-[#1E2926] hover:border-[#1F564C]"
                      >
                        + {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                  <ul className="space-y-1.5">
                    {prontuarioQueue.map((item, idx) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setProntuarioIdx(idx);
                            setActiveProntuarioField(null);
                          }}
                          className={`flex w-full items-start justify-between gap-2 rounded-xl border p-2.5 text-left ${
                            idx === prontuarioIdx
                              ? 'border-[#1F564C] bg-white shadow-xs'
                              : 'border-[#DED9CE] bg-white/70'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11.5px] font-bold text-[#1E2926]">
                              {item.doc.name}
                            </p>
                            <p className="text-[10px] text-[#5A6561]">
                              {KIND_LABEL[item.extraction.kind]} • SHA-256:{' '}
                              {item.doc.sha256Hash.slice(0, 8)}…
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold ${
                              item.status === 'ok'
                                ? 'bg-[#EEF6F3] text-[#1F564C]'
                                : 'bg-[#FDF7EC] text-[#C26D27]'
                            }`}
                          >
                            {item.status === 'ok' ? 'Arquivado' : 'Conferir'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>

              {/* Coluna Central (5/12): Visualização do Documento Clínico / Laudo */}
              <section className="flex min-h-0 flex-col border-r border-[#DED9CE] bg-[#E8E3D9] lg:col-span-5">
                {currentProntuarioItem ? (
                  <>
                    <div className="flex items-center justify-between border-b border-[#DED9CE] bg-white px-3.5 py-2">
                      <div className="flex items-center gap-1 rounded-lg bg-[#F2EFE8] p-0.5">
                        <button
                          type="button"
                          onClick={() => setProntuarioTab('rendered')}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                            prontuarioTab === 'rendered'
                              ? 'bg-[#1F564C] text-white'
                              : 'text-[#5A6561]'
                          }`}
                        >
                          Documento Clínico
                        </button>
                        <button
                          type="button"
                          onClick={() => setProntuarioTab('raw')}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                            prontuarioTab === 'raw'
                              ? 'bg-[#1F564C] text-white'
                              : 'text-[#5A6561]'
                          }`}
                        >
                          Texto Lido (OCR)
                        </button>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded bg-[#EEF6F3] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#1F564C]">
                        <ShieldCheck className="h-3 w-3" />
                        SHA-256: {currentProntuarioItem.doc.sha256Hash.slice(0, 12)}…
                      </span>
                    </div>

                    {activeProntuarioDiff && (
                      <div className="border-b border-[#FDE68A] bg-[#FEFCE8] px-3.5 py-1.5 text-[11px] text-[#854D0E]">
                        Trecho de origem de <strong>{activeProntuarioDiff.label}</strong>:{' '}
                        “{activeProntuarioDiff.evidence}”
                      </div>
                    )}

                    <div className="min-h-0 flex-1 overflow-y-auto p-4">
                      <div className="mx-auto max-w-[650px] rounded-xl border border-[#D8D1C5] bg-white p-5 shadow-md">
                        <div className="mb-3 flex items-center justify-between border-b-2 border-[#1F564C] pb-2">
                          <div>
                            <span className="text-[10px] font-bold uppercase text-[#1F564C]">
                              {KIND_LABEL[currentProntuarioItem.extraction.kind]} • Prontuário S+
                            </span>
                            <h4 className="text-[13px] font-bold text-[#1E2926]">
                              {currentProntuarioItem.doc.name}
                            </h4>
                          </div>
                          <span className="rounded bg-[#F2EFE8] px-2 py-0.5 text-[10px] font-semibold text-[#5A6561]">
                            {currentProntuarioItem.doc.method}
                          </span>
                        </div>
                        <div
                          className={`whitespace-pre-wrap text-[12px] leading-relaxed text-[#1E2926] ${
                            prontuarioTab === 'raw' ? 'font-mono' : 'font-sans'
                          }`}
                          dangerouslySetInnerHTML={{
                            __html: highlightProntuarioHtml(
                              currentProntuarioItem.doc.text ?? '',
                              activeProntuarioDiff?.evidence ?? ''
                            ),
                          }}
                        />
                      </div>
                    </div>
                  </>
                ) : null}
              </section>

              {/* Coluna Direita (4/12): Informações Extraídas do Prontuário / Exame */}
              <aside className="flex min-h-0 flex-col bg-white lg:col-span-4">
                {currentProntuarioItem ? (
                  <>
                    <div className="border-b border-[#DED9CE] bg-[#FAF9F6] p-3.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F564C]">
                        2. Informações Clínicas e de Retorno Constantes no Documento
                      </span>
                      <h4 className="text-[13px] font-bold text-[#1E2926]">
                        {draft.name} (Mat. {draft.matricula})
                      </h4>
                      <p className="text-[10.5px] text-[#5A6561]">
                        Ao validar, o arquivo original é armazenado no prontuário com hash SHA-256 e os prazos de retorno são recalculados.
                      </p>
                    </div>

                    <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3.5">
                      {currentProntuarioItem.extraction.clinicalSummary && (
                        <div className="rounded-xl border border-[#C6E4DA] bg-[#EEF6F3] p-3">
                          <span className="text-[10px] font-bold uppercase text-[#1F564C]">
                            Resumo Clínico Identificado ({currentProntuarioItem.extraction.clinicalSummary.category})
                          </span>
                          <p className="mt-1 text-[11.5px] font-bold text-[#1E2926]">
                            {currentProntuarioItem.extraction.clinicalSummary.title}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[#5A6561]">
                            {currentProntuarioItem.extraction.clinicalSummary.details}
                          </p>
                        </div>
                      )}

                      {currentProntuarioItem.fields.map((field) => {
                        const opts = ALLOWED[field.key];
                        return (
                          <div
                            key={field.key}
                            onClick={() => setActiveProntuarioField(field.key)}
                            className={`rounded-lg border p-2.5 ${
                              activeProntuarioField === field.key
                                ? 'border-[#1F564C] bg-[#FAF9F6] ring-2 ring-[#1F564C]/15'
                                : 'border-[#E5E0D5] bg-white'
                            }`}
                          >
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-[11px] font-bold text-[#1E2926]">
                                {field.label || LABEL[field.key]}
                              </span>
                              <span className="rounded bg-[#EEF6F3] px-1.5 py-0.5 text-[9.5px] font-bold text-[#1F564C]">
                                {field.state === 'new'
                                  ? 'Novo'
                                  : field.state === 'changed'
                                  ? 'Atualiza'
                                  : 'Confirmado'}
                              </span>
                            </div>
                            {opts ? (
                              <select
                                value={field.value}
                                onFocus={() => setActiveProntuarioField(field.key)}
                                onChange={(e) =>
                                  handleProntuarioFieldChange(field.key, e.target.value)
                                }
                                className="w-full rounded border border-[#DCD7CC] bg-white px-2 py-1 text-[11.5px]"
                              >
                                <option value="">(vazio)</option>
                                {opts.map((o) => (
                                  <option key={o} value={o}>
                                    {o}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={field.value}
                                onFocus={() => setActiveProntuarioField(field.key)}
                                onChange={(e) =>
                                  handleProntuarioFieldChange(field.key, e.target.value)
                                }
                                className="w-full rounded border border-[#DCD7CC] bg-white px-2 py-1 text-[11.5px]"
                              />
                            )}
                            <p className="mt-1 truncate text-[10px] text-[#5A6561]">
                              Evidência: “{field.evidence}”
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <footer className="flex items-center justify-between gap-2 border-t border-[#DED9CE] bg-[#FAF9F6] px-3.5 py-2.5">
                      <button
                        type="button"
                        onClick={() => setIsProntuarioReaderOpen(false)}
                        className="rounded-lg border border-[#DCD7CC] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#5A6561]"
                      >
                        Fechar
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyProntuarioItem}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F564C] px-4 py-1.5 text-[11.5px] font-bold text-white shadow-sm hover:bg-[#163F37]"
                      >
                        <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Validar, Atualizar Ficha e Arquivar Prontuário</span>
                      </button>
                    </footer>
                  </>
                ) : null}
              </aside>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

interface SectionHeaderProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
}

function SectionHeader({ icon, title, subtitle }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2.5 border-b border-[#EFECE6] pb-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EEF6F3] text-[#1F564C]">
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="truncate text-[12px] font-bold text-[#1E2926]">{title}</h2>
        <p className="truncate text-[10.5px] text-[#5A6561]">{subtitle}</p>
      </div>
    </div>
  );
}

interface EditableListCardProps {
  title: string;
  icon: ReactNode;
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
}

function EditableListCard({
  title,
  icon,
  items,
  placeholder,
  onChange,
}: EditableListCardProps) {
  const [newItem, setNewItem] = useState('');

  const handleAdd = () => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    onChange([...items, trimmed]);
    setNewItem('');
  };

  return (
    <div className="flex flex-col rounded-lg border border-[#E6E2D8] bg-[#FAF9F6] p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-bold text-[#1E2926]">
        <span className="text-[#1F564C]">{icon}</span>
        <span className="truncate">{title}</span>
      </div>
      <ul className="mb-2 flex-1 space-y-1">
        {items.map((item, idx) => (
          <li
            key={`${idx}-${item}`}
            className="flex items-start justify-between gap-1.5 rounded border border-[#EAE6DC] bg-white px-2 py-1 text-[11px] text-[#1E2926]"
          >
            <span className="leading-snug">{item}</span>
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
              className="shrink-0 text-[#8A938F] hover:text-[#C84B31]"
              aria-label="Remover item"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-1">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded border border-[#DCD7CC] bg-white px-2 py-1 text-[11px] text-[#1E2926] placeholder:text-[#9AA29E] focus:border-[#1F564C] focus:outline-none"
        />
        <button
          type="button"
          onClick={handleAdd}
          aria-label={`Adicionar em ${title}`}
          className="inline-flex items-center justify-center rounded border border-[#1F564C] bg-[#1F564C] px-2 py-1 text-white hover:bg-[#163F37]"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default EmployeeCockpit;
