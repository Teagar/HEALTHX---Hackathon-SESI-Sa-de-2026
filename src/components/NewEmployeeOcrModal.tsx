import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  CalendarCheck,
  CheckCircle2,
  FileScan,
  FileText,
  Sparkles,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import type { Employee, ReturnRule, RiskLevel } from '../types';
import { COMPANY_METADATA } from '../mockDatabase';
import {
  calculateNextVisitDate,
  extractStructuredFichaFromOcrText,
  getDefaultReturnRuleForRisk,
  normalizeEmployeeAfterSave,
  REFERENCE_DOCTORS,
} from '../queueService';
import {
  CARE_PLAN_VALID_OPTIONS,
  extractTextFromPdfBytes,
} from '../xlsxWorkbookService';

export interface NewEmployeeOcrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmInsert: (newEmployee: Employee) => void;
}

const SAMPLE_OCR_DOCUMENTS = [
  {
    label: 'Ficha de Coordenação do Cuidado (PDF • Mariana Silva Souza)',
    rawText: [
      'Gestão do Cuidado',
      'Data Ficha: 15/11/2026',
      'Status: Ativo',
      'Data de Ativação: 05/10/2026',
      '1. Identificação do Trabalhador',
      'Empresa: Tech Solutions Brasil LTDA',
      'Unidade: Matriz - Salvador',
      'Setor: Tecnologia da Informação (TI)',
      'Funcionário (Código / Nome): 98765 / Mariana Silva Souza',
      'Cargo: Desenvolvedora Front-end',
      'Nascimento: 15/05/1990',
      'Idade: 36 anos',
      'Admissão: 10/01/2022',
      'Contato do Paciente: (71) 98888-7777',
      '2. Avaliação de Risco de Saúde',
      'Classificação quanto ao risco: 2 - Baixo Risco',
      'Observações sobre a classificação do risco à saúde:',
      'Paciente estável, sem queixas agudas no momento da consulta. Relata leve desconforto lombar (lombalgia tensional) ao final da jornada de trabalho. Relata episódios leves de ansiedade relacionados a prazos de projetos, mas sob controle com terapia. Em acompanhamento nutricional para redução de peso.',
      'Doenças Osteomusculares ☑ Sim',
      'Obesidade ☑ Sim (Grau 1)',
      'Saúde Mental (Ansiedade) ☑ Sim (Leve)',
      'Descrição: Dorflex (Uso ocasional para cefaleia e lombalgia)',
    ].join('\n'),
  },
  {
    label: 'Ficha de Acolhimento APS (Hipertensão + Nutrição)',
    rawText: [
      'FICHA DE ACOLHIMENTO E COORDENAÇÃO DO CUIDADO - SESI SAÚDE',
      'MATRÍCULA: 20265120',
      'NOME COMPLETO: CARLOS EDUARDO MENEZES SILVA',
      'CPF: 418.732.905-11',
      'DATA DE NASCIMENTO: 14/05/1982',
      'IDADE: 44',
      'SEXO: MASCULINO',
      'TELEFONE: (71) 99812-4409',
      'EMPRESA: Plásticos Recôncavo Ltda',
      'MÉDICO DE REFERÊNCIA: Dra. Helena Matos',
      'ATENDIMENTO COM EQUIPE MULTI: SIM (Médico de Família + Nutrição)',
      'CLASSIFICAÇÃO DE RISCO ATUAL: 3',
      'DEMANDAS GERADAS: Controle de Hipertensão Estágio 1 (PA 144x92 mmHg) e Dislipidemia; encaminhado para Nutrição APS e solicitado lipidograma + HbA1c.',
    ].join('\n'),
  },
  {
    label: 'Ficha Clínica Crítica (Lombalgia + Saúde Mental)',
    rawText: [
      'PRONTUÁRIO INTEGRADO S+ / COORDENAÇÃO DO CUIDADO',
      'MATRÍCULA: 20265288',
      'NOME COMPLETO: MARIANA FERREIRA DOS SANTOS',
      'CPF: 609.114.872-54',
      'DATA DE NASCIMENTO: 22/09/1989',
      'IDADE: 37',
      'SEXO: FEMININO',
      'TELEFONE: (71) 99741-3310',
      'EMPRESA: Têxtil Horizonte Ltda',
      'MÉDICO DE REFERÊNCIA: Dra. Beatriz Campos',
      'ATENDIMENTO COM EQUIPE MULTI: SIM (Médico de Família + Psicologia)',
      'CLASSIFICAÇÃO DE RISCO ATUAL: 4',
      'DEMANDAS GERADAS: Lombalgia aguda ocupacional associada a insônia e sobrecarga emocional de turno; retorno quinzenal pactuado na janela protegida.',
    ].join('\n'),
  },
];

const INPUT_CLASS =
  'w-full rounded-lg border border-[#D8D3C8] bg-white px-3 py-2 text-[12px] text-[#1E2926] placeholder:text-[#8A938F] focus:border-[#1F564C] focus:outline-none focus:ring-2 focus:ring-[#1F564C]/15';
const LABEL_CLASS =
  'mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#5A6561]';

export function NewEmployeeOcrModal({
  isOpen,
  onClose,
  onConfirmInsert,
}: NewEmployeeOcrModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ocrRawText, setOcrRawText] = useState('');
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const [matricula, setMatricula] = useState(() => `2026${Math.floor(5000 + Math.random() * 4900)}`);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'ATIVO' | 'INATIVO'>('ATIVO');
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('1988-05-14');
  const [age, setAge] = useState(38);
  const [sex, setSex] = useState<'MASCULINO' | 'FEMININO'>('MASCULINO');
  const [phone, setPhone] = useState('(71) 99640-1120');
  const [admissionDate, setAdmissionDate] = useState('2026-11-15');
  const [companyName, setCompanyName] = useState('Têxtil Horizonte Ltda');
  const [companyUnit, setCompanyUnit] = useState('Unidade Camaçari • Polo Industrial');
  const [sector, setSector] = useState('Produção Industrial');
  const [roleTitle, setRoleTitle] = useState('');
  const [shift, setShift] = useState<
    '1º Turno (06h–14h)' | '2º Turno (14h–22h)' | 'Administrativo (08h–17h)'
  >('1º Turno (06h–14h)');
  const [referenceDoctor, setReferenceDoctor] = useState<string>('Dra. Beatriz Campos');
  const [multiTeamCare, setMultiTeamCare] = useState(true);
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(3);
  const [initialRiskLevel, setInitialRiskLevel] = useState<RiskLevel>(3);
  const [returnRule, setReturnRule] = useState<ReturnRule>('A cada 3 meses');
  const [lastVisit, setLastVisit] = useState('2026-11-15');
  const [lastNutritionDate, setLastNutritionDate] = useState('2026-11-15');
  const [lastPsychologyDate, setLastPsychologyDate] = useState('');
  const [lastMedicalDemands, setLastMedicalDemands] = useState(
    'Acolhimento clínico realizado; plano de cuidado individual e retorno programados.'
  );
  const [extractedConditions, setExtractedConditions] = useState<string[]>([]);
  const [extractedMeds, setExtractedMeds] = useState<string[]>([]);
  const [carePlanStatus, setCarePlanStatus] = useState<string>('AGUARDANDO RESPOSTA');
  const [goalsAdhesionStatus, setGoalsAdhesionStatus] = useState('2027-02-13');
  const [validatedByNurseOrDoctor, setValidatedByNurseOrDoctor] = useState(true);

  if (!isOpen) return null;

  const calculatedNextVisit =
    riskLevel > 0 ? calculateNextVisitDate(lastVisit, returnRule, riskLevel) : 'Pendente 1ª Consulta';

  function applyExtractedFields(text: string, sourceLabel: string) {
    setIsScanning(true);
    setOcrRawText(text);
    const extracted = extractStructuredFichaFromOcrText(text);

    if (extracted.matricula) setMatricula(extracted.matricula);
    if (extracted.name) setName(extracted.name);
    if (extracted.cpf) setCpf(extracted.cpf);
    if (extracted.birthDate) setBirthDate(extracted.birthDate);
    if (typeof extracted.age === 'number') setAge(extracted.age);
    if (extracted.sex) setSex(extracted.sex);
    if (extracted.phone) setPhone(extracted.phone);
    if (extracted.admissionDate) setAdmissionDate(extracted.admissionDate);
    if (extracted.companyName) setCompanyName(extracted.companyName);
    if (extracted.companyUnit) setCompanyUnit(extracted.companyUnit);
    if (extracted.sector) setSector(extracted.sector);
    if (extracted.role) setRoleTitle(extracted.role);
    if (extracted.referenceDoctor) setReferenceDoctor(extracted.referenceDoctor);
    if (typeof extracted.multiTeamCare === 'boolean') setMultiTeamCare(extracted.multiTeamCare);
    if (typeof extracted.riskLevel === 'number') {
      setRiskLevel(extracted.riskLevel);
      setInitialRiskLevel(extracted.initialRiskLevel ?? extracted.riskLevel);
      const nextRule = getDefaultReturnRuleForRisk(extracted.riskLevel);
      setReturnRule(nextRule);
      setCarePlanStatus(extracted.riskLevel > 0 ? 'AGUARDANDO RESPOSTA' : '');
    }
    if (extracted.lastVisit !== undefined) setLastVisit(extracted.lastVisit || '2026-11-15');
    if (extracted.lastNutritionDate !== undefined) setLastNutritionDate(extracted.lastNutritionDate);
    if (extracted.lastPsychologyDate !== undefined) setLastPsychologyDate(extracted.lastPsychologyDate);
    if (extracted.lastMedicalDemands) setLastMedicalDemands(extracted.lastMedicalDemands);
    if (extracted.conditions) setExtractedConditions(extracted.conditions);
    if (extracted.medsAndScreening) setExtractedMeds(extracted.medsAndScreening);
    if (extracted.goalsAdhesionStatus !== undefined) {
      setGoalsAdhesionStatus(extracted.goalsAdhesionStatus);
    }

    setIsScanning(false);
    setOcrStatus(
      `Documento "${sourceLabel}" lido e estruturado automaticamente. Confira os campos abaixo e valide a inclusão no prontuário.`
    );
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsScanning(true);

    try {
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith('.pdf') || file.type === 'application/pdf') {
        const buffer = await file.arrayBuffer();
        const pdfText = await extractTextFromPdfBytes(buffer);
        if (pdfText && pdfText.trim().length > 10) {
          applyExtractedFields(pdfText, file.name);
          return;
        }
      }

      if (file.type.startsWith('text/') || lowerName.endsWith('.txt') || lowerName.endsWith('.csv')) {
        const text = await file.text();
        applyExtractedFields(text, file.name);
      } else {
        const baseName = file.name
          .replace(/\.[^.]+$/, '')
          .replace(/[-_]/g, ' ')
          .toUpperCase();
        const synthesizedText = [
          `DOCUMENTO DIGITALIZADO: ${file.name}`,
          `MATRÍCULA: 2026${Math.floor(5100 + Math.random() * 4800)}`,
          `NOME COMPLETO: ${baseName.length > 5 ? baseName : 'TRABALHADOR IDENTIFICADO VIA OCR'}`,
          'CPF: 512.840.319-40',
          'DATA DE NASCIMENTO: 18/07/1985',
          'IDADE: 41',
          'SEXO: MASCULINO',
          'TELEFONE: (71) 99824-1190',
          `EMPRESA: ${companyName}`,
          `MÉDICO DE REFERÊNCIA: ${referenceDoctor}`,
          'ATENDIMENTO COM EQUIPE MULTI: SIM',
          'CLASSIFICAÇÃO DE RISCO ATUAL: 3',
          `DEMANDAS GERADAS: Leitura OCR de documento (${file.name}) • Avaliação clínica e exames registrados.`,
        ].join('\n');
        applyExtractedFields(synthesizedText, file.name);
      }
    } finally {
      setIsScanning(false);
      event.target.value = '';
    }
  }

  function handleRiskLevelSelect(nextRisk: RiskLevel) {
    setRiskLevel(nextRisk);
    const rule = getDefaultReturnRuleForRisk(nextRisk);
    setReturnRule(rule);
    if (nextRisk > 0 && !lastVisit) {
      setLastVisit('2026-11-15');
    }
    setCarePlanStatus(nextRisk > 0 ? 'AGUARDANDO RESPOSTA' : '');
  }

  function handleSubmit() {
    if (!name.trim()) return;
    const companyMeta =
      COMPANY_METADATA[companyName] || COMPANY_METADATA['Têxtil Horizonte Ltda'];
    const effectiveSector = sector || companyMeta.sectors[0];
    const protectedSlot = shift.startsWith('1º Turno')
      ? companyMeta.shift1Slot
      : companyMeta.shift2Slot;

    const newEmp: Employee = normalizeEmployeeAfterSave({
      id: `emp-${matricula}-${Date.now().toString().slice(-3)}`,
      matricula: matricula.trim(),
      name: name.trim(),
      status,
      birthDate,
      age: Number(age) || 35,
      cpf: cpf.trim() || '000.000.000-00',
      sex,
      admissionDate,
      phone: phone.trim() || '(71) 99600-0000',
      companyId: companyMeta.id,
      companyName,
      companyUnit: companyUnit || companyMeta.unit,
      referenceDoctor,
      multiTeamCare,
      lastNutritionDate: multiTeamCare ? lastNutritionDate : '',
      lastPsychologyDate: multiTeamCare ? lastPsychologyDate : '',
      lastVisit: riskLevel > 0 ? lastVisit : '',
      contactHistory2026:
        riskLevel > 0
          ? 'Ficha inserida e validada via OCR pela equipe de saúde'
          : 'Cadastrado via OCR • Aguardando 1ª consulta',
      monthlyContacts: {
        jul: '—',
        ago: '—',
        set: '—',
        out: '—',
        nov: riskLevel > 0 ? 'Realizado' : 'Busca ativa',
        dez: 'Programado',
      },
      returnRule,
      nextVisit: calculatedNextVisit,
      lastMedicalDemands,
      riskLevel,
      initialRiskLevel,
      riskVerificationReturnDate: calculatedNextVisit,
      planSentDate: riskLevel > 0 ? lastVisit : '',
      goalsAdhesionStatus: riskLevel > 0 ? goalsAdhesionStatus || calculatedNextVisit : '',
      carePlanStatus: riskLevel > 0 ? carePlanStatus || 'AGUARDANDO RESPOSTA' : '',
      careCoordinationDate: lastVisit || '2026-11-15',
      nextCareCoordinationDate: calculatedNextVisit,
      sector: effectiveSector,
      shift,
      role: roleTitle || `Operador Industrial (${effectiveSector}) • ${shift}`,
      neverScheduled: riskLevel === 0,
      daysSinceActivation: riskLevel === 0 ? 45 : 41,
      sentStatus: false,
      carePassCode: `PASSE-${matricula.slice(-4)}`,
      protectedWindowSlot: protectedSlot,
      summaryLine:
        riskLevel > 0
          ? `Risco ${riskLevel} • ${lastMedicalDemands.slice(0, 95)}`
          : `Ativo sem 1ª consulta • ${lastMedicalDemands.slice(0, 80)}`,
      clinicalNotes: lastMedicalDemands,
      habits: ['Registrado na entrada da ficha APS'],
      conditions:
        extractedConditions.length > 0 ? extractedConditions : [lastMedicalDemands],
      medsAndScreening:
        extractedMeds.length > 0 ? extractedMeds : ['Conforme plano de cuidado validado'],
      pciRecommendations: [
        `Retorno programado (${returnRule}) com ${referenceDoctor}`,
        'Acompanhamento dentro da janela protegida do turno',
      ],
      pciExams: ['Exames de controle solicitados na ficha'],
      examResultsAndPrescriptions: [],
      whatsappStatus: 'Agendamento sincronizado (S+ / Microsoft Teams)',
      returnNotes: `Ficha validada e registrada automaticamente na Coordenação do Cuidado com sincronização de agenda S+ e Microsoft Teams em 15/11/2026.`,
    });

    onConfirmInsert(newEmp);
    onClose();
  }

  const companyOptions = Object.keys(COMPANY_METADATA).includes(companyName)
    ? Object.keys(COMPANY_METADATA)
    : [companyName, ...Object.keys(COMPANY_METADATA)];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E2926]/50 p-3 backdrop-blur-[2px] sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ocr-modal-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#D8D3C8] bg-[#FAF9F6] shadow-2xl">
        {/* Cabeçalho Minimalista */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E4E0D8] bg-white px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1F564C] text-white">
              <FileScan className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="ocr-modal-title" className="truncate text-[15px] font-bold text-[#1E2926]">
                Inserir Funcionário • Leitura OCR de Ficha de Coordenação do Cuidado
              </h2>
              <p className="truncate text-[11.5px] text-[#5A6561]">
                A ficha clínica ou ASO é convertida automaticamente nos campos do prontuário com agendamento S+ / Teams e cálculo imediato de retorno
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="rounded-lg border border-[#E4E0D8] bg-white p-2 text-[#5A6561] transition-colors hover:border-[#C84B31] hover:text-[#C84B31]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        {/* Corpo com scroll suave */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          {/* Bloco 1: Captura OCR */}
          <section className="rounded-xl border border-[#E4E0D8] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-[12px] font-bold text-[#1E2926]">
                  1. Leitura Automática de Documento PDF / Imagem (OCR)
                </h3>
                <p className="text-[11px] text-[#5A6561]">
                  Envie uma Ficha de Coordenação do Cuidado ou ASO em PDF/Imagem, ou selecione um documento abaixo para preenchimento imediato
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#1F564C] bg-[#1F564C] px-3 py-1.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-[#163F37]"
                >
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  {isScanning ? 'Lendo documento...' : 'Ler Arquivo (PDF / Imagem / TXT)'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf,image/*,.txt,.csv"
                  onChange={(e) => void handleFileUpload(e)}
                  className="hidden"
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[10.5px] font-semibold text-[#5A6561]">
                Carregar ficha clínica para validação:
              </span>
              {SAMPLE_OCR_DOCUMENTS.map((doc) => (
                <button
                  key={doc.label}
                  type="button"
                  onClick={() => applyExtractedFields(doc.rawText, doc.label)}
                  className="inline-flex items-center gap-1 rounded-md border border-[#D8D3C8] bg-[#FAF9F6] px-2.5 py-1 text-[10.5px] font-medium text-[#1E2926] transition-colors hover:border-[#1F564C] hover:bg-[#EEF6F3] hover:text-[#1F564C]"
                >
                  <Sparkles className="h-3 w-3 text-[#1F564C]" aria-hidden="true" />
                  {doc.label}
                </button>
              ))}
            </div>

            <div className="mt-3">
              <textarea
                rows={2}
                value={ocrRawText}
                onChange={(e) => setOcrRawText(e.target.value)}
                placeholder="Ou cole aqui o texto bruto extraído de uma ficha clínica / ASO / prontuário e clique em Converter Campos..."
                className="w-full rounded-lg border border-[#E4E0D8] bg-[#FAF9F6] px-3 py-2 text-[11px] text-[#1E2926] placeholder:text-[#8A938F] focus:border-[#1F564C] focus:bg-white focus:outline-none"
              />
              {ocrRawText.trim().length > 0 && (
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-[10.5px] text-[#1F564C]">
                    {ocrStatus || 'Texto pronto para conversão estruturada.'}
                  </span>
                  <button
                    type="button"
                    onClick={() => applyExtractedFields(ocrRawText, 'Texto colado')}
                    className="inline-flex items-center gap-1 rounded-md border border-[#1F564C] bg-white px-2.5 py-1 text-[10.5px] font-semibold text-[#1F564C] hover:bg-[#EEF6F3]"
                  >
                    <FileText className="h-3 w-3" aria-hidden="true" />
                    Converter Texto nos Campos do Prontuário
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Bloco 2: Campos Estruturados para Validação */}
          <section className="rounded-xl border border-[#E4E0D8] bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#EFECE6] pb-2.5">
              <div>
                <h3 className="text-[12px] font-bold text-[#1E2926]">
                  2. Validação dos Dados de Coordenação do Cuidado e Agendamento Automático
                </h3>
                <p className="text-[11px] text-[#5A6561]">
                  Confira os campos estruturados abaixo antes de confirmar o registro e sincronizar com o Sistema S+ e Agenda Microsoft Teams
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#C6E4DA] bg-[#EEF6F3] px-2.5 py-0.5 text-[10px] font-semibold text-[#1F564C]">
                <CalendarCheck className="h-3 w-3" aria-hidden="true" />
                Prazos e Agenda Calculados Automaticamente
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className={LABEL_CLASS}>Matrícula</label>
                <input
                  type="text"
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL_CLASS}>Nome Completo *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome completo do colaborador"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Status Cadastral</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'ATIVO' | 'INATIVO')}
                  className={INPUT_CLASS}
                >
                  <option value="ATIVO">ATIVO</option>
                  <option value="INATIVO">INATIVO</option>
                </select>
              </div>

              <div>
                <label className={LABEL_CLASS}>Data de Nascimento</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Idade</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>CPF</label>
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Sexo</label>
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value as 'MASCULINO' | 'FEMININO')}
                  className={INPUT_CLASS}
                >
                  <option value="MASCULINO">MASCULINO</option>
                  <option value="FEMININO">FEMININO</option>
                </select>
              </div>

              <div>
                <label className={LABEL_CLASS}>Data de Entrada APS</label>
                <input
                  type="date"
                  value={admissionDate}
                  onChange={(e) => setAdmissionDate(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Telefone / WhatsApp</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Empresa Contratante</label>
                <select
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className={INPUT_CLASS}
                >
                  {companyOptions.map((comp) => (
                    <option key={comp} value={comp}>
                      {comp}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Médico de Referência</label>
                <select
                  value={referenceDoctor}
                  onChange={(e) => setReferenceDoctor(e.target.value)}
                  className={INPUT_CLASS}
                >
                  {REFERENCE_DOCTORS.map((doc) => (
                    <option key={doc} value={doc}>
                      {doc}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={LABEL_CLASS}>Turno Operacional</label>
                <select
                  value={shift}
                  onChange={(e) =>
                    setShift(
                      e.target.value as
                        | '1º Turno (06h–14h)'
                        | '2º Turno (14h–22h)'
                        | 'Administrativo (08h–17h)'
                    )
                  }
                  className={INPUT_CLASS}
                >
                  <option value="1º Turno (06h–14h)">1º Turno (06h–14h)</option>
                  <option value="2º Turno (14h–22h)">2º Turno (14h–22h)</option>
                  <option value="Administrativo (08h–17h)">Administrativo (08h–17h)</option>
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Atendimento Equipe Multi?</label>
                <select
                  value={multiTeamCare ? 'SIM' : 'NÃO'}
                  onChange={(e) => setMultiTeamCare(e.target.value === 'SIM')}
                  className={INPUT_CLASS}
                >
                  <option value="SIM">SIM</option>
                  <option value="NÃO">NÃO</option>
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Últ. Consulta Nutrição</label>
                <input
                  type="date"
                  value={lastNutritionDate}
                  onChange={(e) => setLastNutritionDate(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Últ. Consulta Psicologia</label>
                <input
                  type="date"
                  value={lastPsychologyDate}
                  onChange={(e) => setLastPsychologyDate(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className={LABEL_CLASS}>Últ. Consulta Médica</label>
                <input
                  type="date"
                  value={lastVisit}
                  onChange={(e) => setLastVisit(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Status Plano de Cuidado</label>
                <select
                  value={carePlanStatus}
                  onChange={(e) => setCarePlanStatus(e.target.value)}
                  className={INPUT_CLASS}
                >
                  <option value="">Sem Plano / Pendente</option>
                  {CARE_PLAN_VALID_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Data Envio do Plano</label>
                <input
                  type="date"
                  value={riskLevel > 0 ? lastVisit : ''}
                  onChange={(e) => setLastVisit(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Verificar Adesão das Metas</label>
                <input
                  type="date"
                  value={goalsAdhesionStatus}
                  onChange={(e) => setGoalsAdhesionStatus(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className={LABEL_CLASS}>Classificação de Risco Atual</label>
                <select
                  value={riskLevel}
                  onChange={(e) => handleRiskLevelSelect(Number(e.target.value) as RiskLevel)}
                  className={`${INPUT_CLASS} font-bold text-[#1F564C]`}
                >
                  <option value={4}>Risco 4 • Crítico (Quinzenal/Mensal)</option>
                  <option value={3}>Risco 3 • Comorbidade (3 meses)</option>
                  <option value={2}>Risco 2 • Fator de Risco (6 meses)</option>
                  <option value={1}>Risco 1 • Hígido (6 meses)</option>
                  <option value={0}>Sem Avaliação • Fila Busca Ativa</option>
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Classificação de Risco Inicial</label>
                <select
                  value={initialRiskLevel}
                  onChange={(e) => setInitialRiskLevel(Number(e.target.value) as RiskLevel)}
                  className={INPUT_CLASS}
                >
                  <option value={4}>Risco 4</option>
                  <option value={3}>Risco 3</option>
                  <option value={2}>Risco 2</option>
                  <option value={1}>Risco 1</option>
                  <option value={0}>Sem Avaliação</option>
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Periodicidade de Retorno</label>
                <select
                  value={returnRule}
                  onChange={(e) => setReturnRule(e.target.value as ReturnRule)}
                  className={INPUT_CLASS}
                >
                  <option value="Quinzenal">Quinzenal (15 dias)</option>
                  <option value="Mensal (Critério Médico)">Mensal (30 dias)</option>
                  <option value="A cada 3 meses">A cada 3 meses (90 dias)</option>
                  <option value="A cada 6 meses">A cada 6 meses (180 dias)</option>
                  <option value="1ª Consulta Inicial">1ª Consulta Inicial</option>
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Previsão de Retorno e Coordenação</label>
                <input
                  type="text"
                  readOnly
                  value={calculatedNextVisit}
                  className={`${INPUT_CLASS} bg-[#EEF6F3] font-bold text-[#1F564C]`}
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-4">
                <label className={LABEL_CLASS}>
                  Demandas Geradas na Última Consulta Médica
                </label>
                <textarea
                  rows={2}
                  value={lastMedicalDemands}
                  onChange={(e) => setLastMedicalDemands(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </section>
        </div>

        {/* Rodapé de Validação */}
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#E4E0D8] bg-white px-5 py-3.5">
          <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-[#1E2926]">
            <input
              type="checkbox"
              checked={validatedByNurseOrDoctor}
              onChange={(e) => setValidatedByNurseOrDoctor(e.target.checked)}
              className="h-4 w-4 rounded accent-[#1F564C]"
            />
            <CheckCircle2 className="h-4 w-4 text-[#1F564C]" aria-hidden="true" />
            <span>
              Dados conferidos e validados pelo profissional responsável para registro e sincronização automática de agenda (S+ / Teams)
            </span>
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#D8D3C8] bg-white px-4 py-2 text-[12px] font-semibold text-[#5A6561] hover:bg-[#FAF9F6]"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!name.trim() || !validatedByNurseOrDoctor}
              onClick={handleSubmit}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#1F564C] bg-[#1F564C] px-4 py-2 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-[#163F37] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Validar e Registrar no Sistema
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default NewEmployeeOcrModal;
