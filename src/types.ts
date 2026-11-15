export type RiskLevel = 0 | 1 | 2 | 3 | 4;

export type ReturnRule =
  | 'Quinzenal'
  | 'Mensal (Critério Médico)'
  | 'A cada 3 meses'
  | 'A cada 6 meses'
  | '1ª Consulta Inicial';

export type ChannelTab = 'medical' | 'admin' | 'company_b2b';

export type EmployeeStatus = 'ATIVO' | 'INATIVO';

export interface CheckIn60s {
  submittedAt: string;
  painLevel: 'Nenhuma' | 'Leve' | 'Moderada (Lombar/Ombros)' | 'Forte / Travado';
  sleepQuality: 'Bom' | 'Acorda cansado' | 'Insônia / Ruim';
  energyLevel: 'Disposto' | 'Cansaço no fim do turno' | 'Exausto / Moído';
  stressAndMood: 'Tranquilo' | 'Ansioso / Pressionado' | 'Sobrecarga intensa';
  bloodPressureRef: string;
  suggestedTriage: 'Enfermagem (Acolhimento)' | 'Médico de Família' | 'Teleatendimento / Psicologia';
}

export interface MonthlyContacts2026 {
  jul: string;
  ago: string;
  set: string;
  out: string;
  nov: string;
  dez: string;
}

export interface ExamPrescriptionEntry {
  id: string;
  date: string;
  category: 'Resultado de Exame' | 'Prescrição Médica' | 'Encaminhamento Multiprofissional';
  title: string;
  details: string;
  sourceMethod: 'OCR' | 'Manual';
  validatedBy: string;
}

/**
 * Contrato completo do Funcionário espelhando as 32 colunas oficiais da planilha
 * `GESTÃO DO CUIDADO - APS SESI (Coordenação do cuidado)` + campos operacionais de fila.
 */
export interface Employee {
  id: string;
  // Colunas 1 a 11 — Identificação e Vínculo
  matricula: string; // Col 1: MATRÍCULA
  name: string; // Col 2: NOME COMPLETO
  status: EmployeeStatus; // Col 3: STATUS (ATIVO | INATIVO)
  birthDate: string; // Col 4: DATA DE NASCIMENTO
  age: number; // Col 5: IDADE
  cpf: string; // Col 6: CPF
  sex: 'MASCULINO' | 'FEMININO'; // Col 7: SEXO
  admissionDate: string; // Col 8: DATA DE ENTRADA APS
  phone: string; // Col 9: TELEFONE
  companyId: string;
  companyName: string; // Col 10: EMPRESA
  companyUnit: string;
  referenceDoctor: string; // Col 11: MÉDICO DE REFERÊNCIA

  // Colunas 12 a 15 — Equipe Multiprofissional e Últimas Consultas
  multiTeamCare: boolean; // Col 12: ATENDIMENTO COM EQUIPE MULTI? (SIM | NÃO)
  lastNutritionDate: string; // Col 13: DATA ÚLTIMA CONSULTA NUTRICIONISTA
  lastPsychologyDate: string; // Col 14: DATA ÚLTIMA CONSULTA PSICOLOGIA
  lastVisit: string; // Col 15: DATA ÚLTIMA CONSULTA MÉDICA

  // Colunas 16 a 22 — Histórico e Contatos Mensais 2026
  contactHistory2026: string; // Col 16: HISTÓRICO CONTATO DE CONSTADOS DE 2026
  monthlyContacts: MonthlyContacts2026; // Cols 17..22: CONTATO DE JULHO..DEZEMBRO / 2026

  // Colunas 23 a 27 — Retorno, Demandas e Classificação de Risco
  returnRule: ReturnRule;
  nextVisit: string; // Col 23: PREVISÃO DE RETORNO CONFORME SOLICITAÇÃO MÉDICA
  lastMedicalDemands: string; // Col 24: DEMANDAS GERADAS NA ÚLTIMA CONSULTA MÉDICA
  riskLevel: RiskLevel; // Col 25: CLASSIFICAÇÃO DE RISCO ATUAL (0 = Sem Avaliação / Nunca Agendou)
  initialRiskLevel: RiskLevel; // Col 26: CLASSIFICAÇÃO DE RISCO INICIAL
  riskVerificationReturnDate: string; // Col 27: RETORNO DO ATENDIMENTO MÉDICO PARA VERIFICAR CLASSIFICAÇÃO DE RISCO

  // Colunas 28 a 32 — Plano de Cuidado e Coordenação do Cuidado
  planSentDate: string; // Col 28: DATA ENVIO DO PLANO
  goalsAdhesionStatus: string; // Col 29: VERIFICAR ADESÃO DAS METAS
  carePlanStatus: string; // Col 30: STATUS PLANO DE CUIDADO
  careCoordinationDate: string; // Col 31: DATA DA COORD CUIDADO
  nextCareCoordinationDate: string; // Col 32: DATA DA PRÓXIMA COORD CUIDADO2

  // Campos de Operação da Dupla Fila, Prontuário e Retorno (Exames / Prescrições OCR)
  sector: string;
  shift: '1º Turno (06h–14h)' | '2º Turno (14h–22h)' | 'Administrativo (08h–17h)';
  role: string;
  neverScheduled: boolean;
  daysSinceActivation: number;
  sentStatus: boolean;
  carePassCode?: string;
  protectedWindowSlot?: string;
  summaryLine: string;
  clinicalNotes: string;
  habits: string[];
  conditions: string[];
  medsAndScreening: string[];
  pciRecommendations: string[];
  pciExams: string[];
  examResultsAndPrescriptions: ExamPrescriptionEntry[];
  whatsappStatus: string;
  returnNotes: string;
  checkIn60s?: CheckIn60s;
}

export interface ShiftWindowConfig {
  companyId: string;
  companyName: string;
  companyUnit: string;
  totalActiveLives: number;
  shift1Window: string;
  shift2Window: string;
  ddsDay: string;
  autoScheduleDefault: boolean;
  zeroPayrollDeductionGuaranteed: boolean;
}

/**
 * Métricas de Retorno Operacional e Economia em Saúde Corporativa
 * Baseadas estritamente nos trabalhadores inseridos e em fontes epidemiológicas oficiais.
 * (Sem custos internos de projeto/CAPEX/folha, que são exclusivos do pitch).
 */
export interface CorporateHealthImpactMetrics {
  activeLivesScope: number;
  accompaniedLivesScope: number;
  carePassesIssuedScope: number;
  // 1. Horas produtivas preservadas (Janela Protegida 0,5h vs Saída Externa 4,2h — Fonte: ANAMT / CNI-SESI)
  productiveHoursPreserved: number;
  productiveHoursValueBrl: number;
  // 2. Atendimentos de Pronto-Socorro evitados pela Resolutividade APS de 94% (Fonte: SESI Saúde Acolhe & IESS/ANS)
  emergencyVisitsAvoided: number;
  emergencySavingsBrl: number;
  // 3. Redução estimada de dias de afastamento por atestados curtos (Fonte: OMS / OIT & Previdência Social FAP)
  absenteeismDaysAvoided: number;
  absenteeismSavingsBrl: number;
  // 4. Consultas clínicas aproveitadas pela redução do No-Show (Fonte: Operação SESI Saúde Acolhe)
  recoveredConsultationsCount: number;
  totalEstimatedAnnualImpactBrl: number;
  methodologySources: {
    indicator: string;
    metricFormula: string;
    officialSource: string;
  }[];
}

/**
 * Métricas exclusivas de UMA empresa contratante para o Portal do Gestor B2B (LGPD).
 * NUNCA contém nome, CPF, matrícula, cargo individual ou diagnóstico, e NUNCA expõe outras empresas.
 */
export interface LgpdCompanyMetric {
  companyId: string;
  companyName: string;
  companyUnit: string;
  totalCatalogedRows: number;
  totalLives: number; // Vidas ativas da empresa
  inactiveLives: number; // Vidas inativas da empresa na planilha
  activatedLives: number; // Já acompanhadas na APS
  pendingFirstVisitLives: number; // Nunca agendaram 1ª consulta
  multiTeamLivesCount: number;
  activationRatePercent: number;
  attendanceRatePercent: number;
  noShowRatePercent: number;
  carePassIssuedCount: number;
  privacyLockApplied: boolean; // Trava mínima de grupo N >= 5
  riskBreakdown: {
    riskLevel: RiskLevel;
    label: string;
    count: number;
    percent: number;
    colorHex: string;
  }[];
  careLinesDistribution: {
    lineName: string;
    percent: number;
  }[];
  monthlyContactsTrend: {
    month: string;
    contactedCount: number;
    adhesionPercent: number;
  }[];
  shiftAdhesion: {
    shiftLabel: string;
    totalGroup: number;
    adhesionPercent: number;
    suppressed?: boolean;
  }[];
  healthImpact: CorporateHealthImpactMetrics;
}

export interface LgpdGlobalDashboard {
  totalActiveLives: number;
  totalAccompaniedLives: number;
  totalNeverScheduledLives: number;
  globalActivationRatePercent: number;
  historicalNoShowPercent: number;
  currentNoShowPercent: number;
  apsResolvabilityPercent: number;
  npsScore: number;
  satisfactionPercent: number;
  minGroupSize: number;
  suppressedLivesCount: number;
  shiftAdhesionGlobal: {
    shiftLabel: string;
    totalGroup: number;
    adhesionPercent: number;
    suppressed?: boolean;
  }[];
  companies: LgpdCompanyMetric[];
}

export interface PowerBiAnalyticsPayload {
  spreadsheetCensus: {
    totalRowsInCsv: number; // 100 registros na planilha oficial
    activeWorkersInCsv: number; // 60 ativos
    inactiveWorkersInCsv: number; // 40 inativos
    maleCount: number;
    femaleCount: number;
    averageAge: number;
    multiTeamCarePercent: number;
  };
  riskDistribution: {
    riskLevel: RiskLevel;
    label: string;
    returnProtocol: string;
    count: number;
    percentOfTotal: number;
    colorHex: string;
  }[];
  careLinesPrevalence: {
    lineName: string;
    category: 'Saúde Mental' | 'DCNT / Crônicos' | 'Osteomuscular / Turno' | 'Estilo de Vida / Prevenção';
    affectedPercent: number;
    resolvedInApsPercent: number;
  }[];
  doctorPortfolios: {
    doctorName: string;
    totalAssignedCsv: number;
    activeAssigned: number;
    accompaniedCount: number;
    pendingFirstVisitCount: number;
    carePassSentCount: number;
    adhesionRatePercent: number;
  }[];
  monthlyEvolution2026: {
    month: string;
    scheduledConsultations: number;
    completedConsultations: number;
    noShowPercent: number;
    activeSearchConverted: number;
  }[];
  agePyramid: {
    range: string;
    male: number;
    female: number;
  }[];
  healthImpact: CorporateHealthImpactMetrics;
}

export interface DatabaseConnectionStatus {
  mode: 'LOCAL_PERSISTENCE' | 'POSTGRESQL_ENTERPRISE';
  status: 'ONLINE' | 'SYNCING' | 'LOCAL_CACHE';
  localDbFilePath: string;
  totalEmployeesPersisted: number;
  lastPersistedAt: string;
  latencyMs: number;
  scalabilityAdapters: {
    name: string;
    technology: string;
    endpointPreview: string;
    status: 'ACTIVE' | 'READY';
    capacityTarget: string;
  }[];
}

export interface AutomationLogEntry {
  id: string;
  executedAt: string;
  scriptName: string;
  trigger: string;
  rowsScanned: number;
  rowsUpdatedOrImported: number;
  carePassesDispatched: number;
  outputFileGenerated: string;
  summaryMessage: string;
}
