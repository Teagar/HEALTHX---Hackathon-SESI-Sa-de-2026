import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileScan,
  FileText,
  HeartPulse,
  ListChecks,
  Plus,
  Save,
  Send,
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
} from '../types';
import {
  calculateNextVisitDate,
  extractExamPrescriptionFromOcrText,
  getAllowedReturnRulesForRisk,
  getDefaultReturnRuleForRisk,
  normalizeEmployeeAfterSave,
  REFERENCE_DOCTORS,
  registerFirstConsultation,
} from '../queueService';
import {
  CARE_PLAN_VALID_OPTIONS,
  extractTextFromPdfBytes,
} from '../xlsxWorkbookService';

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

const SAMPLE_RETURN_OCR_SNIPPETS = [
  {
    label: 'Laudo Laboratorial (HbA1c + Lipidograma)',
    text: 'Resultado de Exame Laboratorial: Glicemia jejum 104 mg/dL • HbA1c 6,0% • Colesterol Total 182 mg/dL • PA 126/80 mmHg em controle adequado.',
  },
  {
    label: 'Prescrição Médica de Retorno (HAS)',
    text: 'Prescrição Médica: Manter Losartana Potássica 50mg 1 cp pela manhã + Hidroclorotiazida 12,5mg 1x/dia. Controle pressórico estabilizado.',
  },
  {
    label: 'Encaminhamento Multiprofissional (Nutrição/Psicologia)',
    text: 'Encaminhamento Multiprofissional: Seguimento conjunto com Nutrição Clínica e Psicologia APS para manejo de estresse ocupacional e reeducação alimentar.',
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

  // Estado do Leitor OCR de Retorno (Exames / Prescrições)
  const examFileInputRef = useRef<HTMLInputElement>(null);
  const [ocrExamRaw, setOcrExamRaw] = useState('');
  const [pendingOcrEntry, setPendingOcrEntry] = useState<ExamPrescriptionEntry | null>(null);
  const [pendingSuggestedRisk, setPendingSuggestedRisk] = useState<RiskLevel | undefined>(
    undefined
  );

  useEffect(() => {
    setDraft(employee);
    setDirty(false);
    setPendingOcrEntry(null);
    setOcrExamRaw('');
    setTeamsCalendarSynced(employee.sentStatus);
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

  // Sincronização em 1 clique com o Sistema de Agendamento (S+) e Agenda Microsoft Teams
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

  // Leitura OCR para Prescrições / Resultados de Exames na Consulta de Retorno
  function parseOcrForReturnExam(text: string) {
    if (!text.trim()) return;
    const parsed = extractExamPrescriptionFromOcrText(text);
    setPendingOcrEntry(parsed.entry);
    setPendingSuggestedRisk(parsed.suggestedRisk);
  }

  async function handleExamFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith('.pdf') || file.type === 'application/pdf') {
        const buffer = await file.arrayBuffer();
        const pdfText = await extractTextFromPdfBytes(buffer);
        if (pdfText && pdfText.trim().length > 10) {
          setOcrExamRaw(pdfText);
          parseOcrForReturnExam(pdfText);
          return;
        }
      }
      if (file.type.startsWith('text/') || lowerName.endsWith('.txt')) {
        const text = await file.text();
        setOcrExamRaw(text);
        parseOcrForReturnExam(text);
      } else {
        const extracted = `Laudo / Receituário Digitalizado (${file.name}): Exames laboratoriais e parâmetros vitais revisados na consulta de retorno; conduta terapêutica registrada.`;
        setOcrExamRaw(extracted);
        parseOcrForReturnExam(extracted);
      }
    } finally {
      event.target.value = '';
    }
  }

  function handleValidateAndAddExamEntry() {
    if (!pendingOcrEntry) return;
    const currentList = draft.examResultsAndPrescriptions || [];
    const updatedList = [pendingOcrEntry, ...currentList];
    const visitDate = todayIso();
    const targetRisk =
      draft.riskLevel === 0 ? (pendingSuggestedRisk ?? 2) : draft.riskLevel;
    const rule =
      draft.riskLevel === 0 ? getDefaultReturnRuleForRisk(targetRisk) : draft.returnRule;
    const nextVisit = calculateNextVisitDate(visitDate, rule, targetRisk);

    const updatedEmployee = normalizeEmployeeAfterSave({
      ...draft,
      riskLevel: targetRisk,
      neverScheduled: false,
      lastVisit: visitDate,
      returnRule: rule,
      nextVisit,
      riskVerificationReturnDate: nextVisit,
      careCoordinationDate: visitDate,
      nextCareCoordinationDate: nextVisit,
      lastMedicalDemands: `${pendingOcrEntry.title}: ${pendingOcrEntry.details}`,
      examResultsAndPrescriptions: updatedList,
      monthlyContacts: {
        ...(draft.monthlyContacts || {
          jul: '—',
          ago: '—',
          set: '—',
          out: '—',
          nov: 'Realizado',
          dez: 'Programado',
        }),
        nov: 'Retorno Realizado',
      },
    });

    setDraft(updatedEmployee);
    setPendingOcrEntry(null);
    setOcrExamRaw('');
    setDirty(true);
  }

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
  const mc = draft.monthlyContacts || {
    jul: '',
    ago: '',
    set: '',
    out: '',
    nov: '',
    dez: '',
  };

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

          {/* COLUNA DIREITA (5/12): Gestão de Retorno + Agendamento Integrado (S+ & Microsoft Teams) + OCR de Exames + Contatos */}
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
              <div className="mt-3.5 rounded-xl border border-[#C6E4DA] bg-[#F4F9F7] p-3.5 space-y-3">
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

                {/* Portal Simplificado do Trabalhador (Acesso sem senha via Teams / WhatsApp) */}
                {showWorkerAccessPreview && (
                  <div className="rounded-xl border border-[#DCD7CC] bg-white p-3 shadow-xs space-y-2">
                    <div className="flex items-center justify-between border-b border-[#EFECE6] pb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F564C]">
                        Visão do Trabalhador • Acesso Direto sem Senha (Teams & WhatsApp)
                      </span>
                      <span className="rounded bg-[#EEF6F3] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#1F564C]">
                        {draft.carePassCode || `PASSE-${draft.matricula.slice(-4)}`}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#1E2926] leading-relaxed">
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

            {/* Bloco 4: Consultas de Retorno — Prescrições e Resultados de Exames com Leitor OCR */}
            <article className="rounded-xl border border-[#DED9CE] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFECE6] pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EEF6F3] text-[#1F564C]">
                    <FileScan className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-[12px] font-bold text-[#1E2926]">
                      Retorno • Prescrições e Resultados de Exames (OCR)
                    </h3>
                    <p className="text-[10.5px] text-[#5A6561]">
                      Extraia dados de laudos ou receitas e valide para atualização automática dos prazos
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => examFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#1F564C] bg-[#1F564C] px-2.5 py-1 text-[10.5px] font-semibold text-white hover:bg-[#163F37]"
                >
                  <Upload className="h-3 w-3" aria-hidden="true" />
                  Ler Exame / Receita (OCR)
                </button>
                <input
                  ref={examFileInputRef}
                  type="file"
                  accept="image/*,.pdf,.txt"
                  onChange={(e) => void handleExamFileUpload(e)}
                  className="hidden"
                />
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1">
                {SAMPLE_RETURN_OCR_SNIPPETS.map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => {
                      setOcrExamRaw(sample.text);
                      parseOcrForReturnExam(sample.text);
                    }}
                    className="rounded-md border border-[#DCD7CC] bg-[#FAF9F6] px-2 py-1 text-[10px] font-medium text-[#1E2926] hover:border-[#1F564C] hover:bg-[#EEF6F3] hover:text-[#1F564C]"
                  >
                    + {sample.label}
                  </button>
                ))}
              </div>

              <div className="mt-2.5 flex gap-1.5">
                <input
                  type="text"
                  value={ocrExamRaw}
                  onChange={(e) => setOcrExamRaw(e.target.value)}
                  placeholder="Digite ou cole resultado de exame / prescrição para converter..."
                  className={FIELD_CLASS}
                />
                <button
                  type="button"
                  onClick={() => parseOcrForReturnExam(ocrExamRaw)}
                  disabled={!ocrExamRaw.trim()}
                  className="shrink-0 rounded-lg border border-[#1F564C] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#1F564C] hover:bg-[#EEF6F3] disabled:opacity-40"
                >
                  Converter
                </button>
              </div>

              {/* Card de Validação pelo Insersor */}
              {pendingOcrEntry && (
                <div className="mt-3 rounded-lg border border-[#C6E4DA] bg-[#EEF6F3] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F564C]">
                      Validação de Leitura OCR • {pendingOcrEntry.category}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPendingOcrEntry(null)}
                      className="text-[10px] text-[#5A6561] hover:text-[#C84B31]"
                    >
                      Descartar
                    </button>
                  </div>
                  <div className="mt-2 space-y-2">
                    <input
                      type="text"
                      value={pendingOcrEntry.title}
                      onChange={(e) =>
                        setPendingOcrEntry({ ...pendingOcrEntry, title: e.target.value })
                      }
                      className="w-full rounded border border-[#C6E4DA] bg-white px-2 py-1 text-[11.5px] font-semibold text-[#1E2926]"
                    />
                    <textarea
                      rows={2}
                      value={pendingOcrEntry.details}
                      onChange={(e) =>
                        setPendingOcrEntry({ ...pendingOcrEntry, details: e.target.value })
                      }
                      className="w-full rounded border border-[#C6E4DA] bg-white px-2 py-1 text-[11px] text-[#1E2926]"
                    />
                    <button
                      type="button"
                      onClick={handleValidateAndAddExamEntry}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#1F564C] px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-[#163F37]"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Validar Registro e Atualizar Prazos Automaticamente
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de Prescrições e Exames Registrados */}
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
                        </div>
                        <p className="mt-1 text-[11.5px] font-bold text-[#1E2926]">{item.title}</p>
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
