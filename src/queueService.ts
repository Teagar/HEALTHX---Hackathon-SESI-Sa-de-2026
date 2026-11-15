import {
  AutomationLogEntry,
  CorporateHealthImpactMetrics,
  DatabaseConnectionStatus,
  Employee,
  ExamPrescriptionEntry,
  LgpdCompanyMetric,
  LgpdGlobalDashboard,
  PowerBiAnalyticsPayload,
  ReturnRule,
  RiskLevel,
} from './types';
import { COMPANY_METADATA } from './mockDatabase';

function isEmployeeActive(emp: Employee): boolean {
  return emp.status !== 'INATIVO';
}

/**
 * REGRA DE NEGÓCIO 1 (PARTE A) — JANELA INTERNA SUPERIOR:
 * Filtra os funcionários ativos já acompanhados (`status === 'ATIVO' && !neverScheduled && riskLevel > 0`) e
 * ordena de forma ESTRITAMENTE DECRESCENTE pela Classificação de Risco (4 -> 3 -> 2 -> 1).
 * Critério de desempate: Data prevista de retorno (`nextVisit`) mais antiga/atrasada primeiro.
 */
export function getReturnPriorityQueue(employees: Employee[]): Employee[] {
  return employees
    .filter((emp) => isEmployeeActive(emp) && !emp.neverScheduled && emp.riskLevel > 0)
    .sort((a, b) => {
      if (b.riskLevel !== a.riskLevel) {
        return b.riskLevel - a.riskLevel; // 4 -> 3 -> 2 -> 1
      }
      const dateA = a.nextVisit || '9999-12-31';
      const dateB = b.nextVisit || '9999-12-31';
      return dateA.localeCompare(dateB);
    });
}

/**
 * REGRA DE NEGÓCIO 1 (PARTE B) — JANELA INTERNA INFERIOR:
 * Filtra os funcionários ativos que NUNCA agendaram a 1ª consulta (`status === 'ATIVO' && (neverScheduled || riskLevel === 0)`) e
 * ordena de forma ESTRITAMENTE DECRESCENTE por `daysSinceActivation` (ex: 215d -> 209d -> 184d...).
 */
export function getActiveSearchQueue(employees: Employee[]): Employee[] {
  return employees
    .filter((emp) => isEmployeeActive(emp) && (emp.neverScheduled || emp.riskLevel === 0))
    .sort((a, b) => b.daysSinceActivation - a.daysSinceActivation);
}

/**
 * REGRA DE NEGÓCIO 2 — PROTOCOLO DE CLASSIFICAÇÃO DE RISCO E PRAZOS DE RETORNO (APS SESI):
 */
export function getDefaultReturnRuleForRisk(riskLevel: RiskLevel): ReturnRule {
  switch (riskLevel) {
    case 4:
      return 'Quinzenal';
    case 3:
      return 'A cada 3 meses';
    case 2:
    case 1:
      return 'A cada 6 meses';
    case 0:
    default:
      return '1ª Consulta Inicial';
  }
}

export function getAllowedReturnRulesForRisk(riskLevel: RiskLevel): ReturnRule[] {
  switch (riskLevel) {
    case 4:
      return ['Quinzenal', 'Mensal (Critério Médico)'];
    case 3:
      return ['A cada 3 meses'];
    case 2:
    case 1:
      return ['A cada 6 meses'];
    case 0:
    default:
      return ['1ª Consulta Inicial'];
  }
}

/**
 * Calcula automaticamente a data prevista do próximo retorno (`YYYY-MM-DD`)
 * com base na data da última consulta e na regra de periodicidade do SESI Saúde Acolhe.
 */
export function calculateNextVisitDate(
  lastVisitDateStr: string,
  returnRule: ReturnRule,
  riskLevel: RiskLevel
): string {
  if (riskLevel === 0 || returnRule === '1ª Consulta Inicial') {
    return 'Pendente 1ª Consulta';
  }

  const baseDate = lastVisitDateStr
    ? new Date(`${lastVisitDateStr}T12:00:00`)
    : new Date('2026-11-15T12:00:00');
  if (Number.isNaN(baseDate.getTime())) {
    return '2027-02-15';
  }

  const result = new Date(baseDate);
  if (returnRule === 'Quinzenal') {
    result.setDate(result.getDate() + 15);
  } else if (returnRule === 'Mensal (Critério Médico)') {
    result.setDate(result.getDate() + 30);
  } else if (returnRule === 'A cada 3 meses') {
    result.setDate(result.getDate() + 90);
  } else {
    result.setDate(result.getDate() + 180);
  }

  return result.toISOString().slice(0, 10);
}

/**
 * Automatiza todos os prazos da planilha oficial ao salvar ou validar uma ficha.
 */
export function normalizeEmployeeAfterSave(updated: Employee): Employee {
  const copy: Employee = {
    ...updated,
    status: updated.status || 'ATIVO',
    monthlyContacts: updated.monthlyContacts || {
      jul: '—',
      ago: '—',
      set: '—',
      out: '—',
      nov: 'Realizado',
      dez: 'Programado',
    },
    examResultsAndPrescriptions: updated.examResultsAndPrescriptions || [],
  };

  if (copy.riskLevel > 0) {
    const wasNeverScheduled = copy.neverScheduled;
    copy.neverScheduled = false;

    if (!copy.lastVisit || copy.lastVisit.trim() === '') {
      copy.lastVisit = '2026-11-15';
    }
    if (!copy.initialRiskLevel) {
      copy.initialRiskLevel = copy.riskLevel;
    }

    const ruleIsCoherent = getAllowedReturnRulesForRisk(copy.riskLevel).includes(copy.returnRule);
    if (!ruleIsCoherent) {
      copy.returnRule = getDefaultReturnRuleForRisk(copy.riskLevel);
    }
    if (
      wasNeverScheduled ||
      !ruleIsCoherent ||
      !/^\d{4}-\d{2}-\d{2}$/.test(copy.nextVisit || '')
    ) {
      copy.nextVisit = calculateNextVisitDate(copy.lastVisit, copy.returnRule, copy.riskLevel);
    }

    copy.riskVerificationReturnDate = copy.nextVisit;
    if (!copy.planSentDate) {
      copy.planSentDate = copy.lastVisit;
    }
    if (!copy.careCoordinationDate) {
      copy.careCoordinationDate = copy.lastVisit;
    }
    copy.nextCareCoordinationDate = copy.nextVisit;
    const validCarePlanStatuses = [
      'ADERIU TOTALMENTE',
      'ADERIU PARCIALMENTE',
      'AGUARDANDO RESPOSTA',
      'NÃO ADERIU',
    ];
    if (!copy.carePlanStatus || !validCarePlanStatuses.includes(copy.carePlanStatus.toUpperCase())) {
      copy.carePlanStatus = 'AGUARDANDO RESPOSTA';
    } else {
      copy.carePlanStatus = copy.carePlanStatus.toUpperCase();
    }
    if (!copy.goalsAdhesionStatus || copy.goalsAdhesionStatus.includes('Aguardando')) {
      copy.goalsAdhesionStatus = copy.nextVisit;
    }
  } else {
    copy.neverScheduled = true;
    copy.returnRule = '1ª Consulta Inicial';
    copy.nextVisit = copy.status === 'INATIVO' ? 'Inativo' : 'Pendente 1ª Consulta';
    copy.riskVerificationReturnDate =
      copy.status === 'INATIVO' ? '' : 'Pendente 1ª Consulta';
    copy.carePlanStatus = '';
    copy.goalsAdhesionStatus = '';
  }

  return copy;
}

/**
 * Converte imediatamente um trabalhador de Busca Ativa (Janela 2) em paciente acompanhado (Janela 1)
 * ao registrar a 1ª Consulta.
 */
export function registerFirstConsultation(
  employee: Employee,
  assignedRisk: Exclude<RiskLevel, 0> = 2
): Employee {
  const returnRule = getDefaultReturnRuleForRisk(assignedRisk);
  const lastVisit = '2026-11-15';
  const nextVisit = calculateNextVisitDate(lastVisit, returnRule, assignedRisk);

  return normalizeEmployeeAfterSave({
    ...employee,
    riskLevel: assignedRisk,
    initialRiskLevel: employee.initialRiskLevel || assignedRisk,
    neverScheduled: false,
    lastVisit,
    returnRule,
    nextVisit,
    riskVerificationReturnDate: nextVisit,
    planSentDate: lastVisit,
    careCoordinationDate: lastVisit,
    nextCareCoordinationDate: nextVisit,
    goalsAdhesionStatus: nextVisit,
    carePlanStatus: 'AGUARDANDO RESPOSTA',
    monthlyContacts: {
      ...(employee.monthlyContacts || {
        jul: '—',
        ago: '—',
        set: '—',
        out: '—',
        nov: 'Realizado',
        dez: 'Programado',
      }),
      nov: '1ª Consulta Realizada',
    },
    whatsappStatus: '1ª Consulta realizada • Plano de Cuidado ativo no WhatsApp',
    summaryLine: `Risco ${assignedRisk} Recém-Acolhido • 1ª Consulta realizada em 15/11/2026 • Retorno: ${returnRule}`,
  });
}

/**
 * MOTOR DE RETORNO E IMPACTO EM SAÚDE CORPORATIVA (BASEADO EM ESTATÍSTICAS E FONTES OFICIAIS):
 * Calcula a economia operacional e de saúde estritamente proporcional aos trabalhadores ativos
 * inseridos na base (ou na empresa selecionada), sem expor custos internos do projeto.
 */
export function computeCorporateHealthImpact(
  activeEmployeesScope: Employee[]
): CorporateHealthImpactMetrics {
  const activeLivesScope = activeEmployeesScope.length;
  const accompaniedLivesScope = activeEmployeesScope.filter(
    (e) => !e.neverScheduled && e.riskLevel > 0
  ).length;
  const carePassesIssuedScope = activeEmployeesScope.filter((e) => e.sentStatus).length;

  // 1. Consultas anuais estimadas na APS para a população acompanhada (média de 3,2 atendimentos/vida/ano entre médico, enfermagem, psicologia e nutrição)
  const annualConsultationsScope = Math.max(
    accompaniedLivesScope * 3.2,
    activeLivesScope * 1.8
  );

  // Redução do No-Show: de 50,0% histórico para ~15,5% com Janela Protegida e Passe de Cuidado (+34,5 p.p. de comparecimento)
  const recoveredConsultationsCount = Math.round(annualConsultationsScope * 0.345);

  // 2. Horas produtivas preservadas no turno:
  // Saída externa para consulta/PS consome em média 4,2h (deslocamento + espera) vs 0,5h na janela protegida interna = 3,7h preservadas por atendimento
  // Fonte: ANAMT / Estudos de Absenteísmo Industrial CNI-SESI (Valor médio da hora produtiva industrial c/ encargos: R$ 34,50/h)
  const productiveHoursPreserved = Math.round(
    (accompaniedLivesScope * 2.4 + carePassesIssuedScope * 0.8) * 3.7
  );
  const productiveHoursValueBrl = Math.round(productiveHoursPreserved * 34.5);

  // 3. Atendimentos de Pronto-Socorro evitados pela Resolutividade de 94% da APS SESI:
  // 94% das demandas agudas leves/crônicas compensadas na APS evitam ida ao PS externo.
  // Custo médio de atendimento em Pronto-Socorro na Saúde Suplementar: R$ 410,00 (Fonte: IESS / ANS - Mapa Assistencial)
  const highRiskCount = activeEmployeesScope.filter((e) => e.riskLevel >= 3).length;
  const emergencyVisitsAvoided = Math.max(
    1,
    Math.round((accompaniedLivesScope * 0.65 + highRiskCount * 0.85) * 0.94)
  );
  const emergencySavingsBrl = Math.round(emergencyVisitsAvoided * 410);

  // 4. Redução de dias de afastamento por atestados curtos (DCNT, lombalgia e saúde mental acompanhadas):
  // Redução média de 28% nos dias perdidos (média de 1,9 dia evitado por trabalhador acompanhado/ano).
  // Custo médio diário de absenteísmo industrial: R$ 215,00/dia (Fonte: OIT / OMS & Previdência Social - FAP)
  const absenteeismDaysAvoided = Math.max(
    1,
    Math.round(accompaniedLivesScope * 1.9 + highRiskCount * 1.2)
  );
  const absenteeismSavingsBrl = Math.round(absenteeismDaysAvoided * 215);

  const totalEstimatedAnnualImpactBrl =
    productiveHoursValueBrl + emergencySavingsBrl + absenteeismSavingsBrl;

  return {
    activeLivesScope,
    accompaniedLivesScope,
    carePassesIssuedScope,
    productiveHoursPreserved,
    productiveHoursValueBrl,
    emergencyVisitsAvoided,
    emergencySavingsBrl,
    absenteeismDaysAvoided,
    absenteeismSavingsBrl,
    recoveredConsultationsCount,
    totalEstimatedAnnualImpactBrl,
    methodologySources: [
      {
        indicator: 'Horas Produtivas Preservadas no Turno',
        metricFormula:
          '3,7h poupadas por atendimento em Janela Protegida interna (0,5h) vs. saída externa (4,2h) × R$ 34,50/h industrial',
        officialSource: 'ANAMT & CNI / SESI — Estudos de Saúde e Produtividade Industrial',
      },
      {
        indicator: 'Pronto-Socorro e Sinistralidade Evitados (94% Resolutividade)',
        metricFormula:
          '94% de resolutividade clínica na APS corporativa × R$ 410,00 por atendimento de urgência evitado na rede suplementar',
        officialSource:
          'Relatório Operacional SESI Saúde Acolhe (2026) & IESS / ANS (Mapa Assistencial da Saúde Suplementar)',
      },
      {
        indicator: 'Redução de Absenteísmo e Atestados de Curta Duração',
        metricFormula:
          'Redução média de 28% em faltas por DCNT, osteomuscular e saúde mental monitoradas (1,9 dia/vida acompanhada × R$ 215/dia)',
        officialSource:
          'OMS / OIT (Saúde Mental e Trabalho) & Ministério da Previdência Social (Indicadores FAP / NTEP)',
      },
    ],
  };
}

export const LGPD_MIN_GROUP_SIZE = 5;

const SHIFT_GROUPS = [
  { prefix: '1º Turno', label: '1º Turno (06h–14h • Janela Protegida Manhã)' },
  { prefix: '2º Turno', label: '2º Turno (14h–22h • Janela Protegida Tarde)' },
  { prefix: 'Administrativo', label: 'Administrativo (08h–17h)' },
];

function buildShiftAdhesion(
  list: Employee[],
  scaleFactor = 1
): LgpdCompanyMetric['shiftAdhesion'] {
  return SHIFT_GROUPS.map(({ prefix, label }) => {
    const group = list.filter((e) => e.shift.startsWith(prefix));
    if (group.length < LGPD_MIN_GROUP_SIZE) {
      return { shiftLabel: label, totalGroup: 0, adhesionPercent: 0, suppressed: true };
    }
    const engaged = group.filter(
      (e) => (!e.neverScheduled && e.riskLevel > 0) || e.sentStatus
    ).length;
    return {
      shiftLabel: label,
      totalGroup: group.length * scaleFactor,
      adhesionPercent: Math.min(98, Math.round((engaged / group.length) * 100)),
      suppressed: false,
    };
  });
}

/**
 * REGRA DE NEGÓCIO 5 — TRAVA DE SIGILO E PRIVACIDADE (LGPD NO CANAL 3):
 * Agrega os indicadores estritamente dentro dos dados reais de cada empresa com trava N >= 5.
 * Cada empresa possui seu próprio relatório isolado (`LgpdCompanyMetric`) para que o gestor
 * visualize apenas os indicadores de interesse da sua própria empresa, de forma 100% anonimizada.
 */
export function getLgpdAggregatedMetrics(employees: Employee[]): LgpdGlobalDashboard {
  const activeEmployees = employees.filter(isEmployeeActive);
  const companyMap = new Map<string, Employee[]>();
  const allCompanyRowsMap = new Map<string, Employee[]>();

  for (const emp of employees) {
    const allList = allCompanyRowsMap.get(emp.companyId) || [];
    allList.push(emp);
    allCompanyRowsMap.set(emp.companyId, allList);

    if (isEmployeeActive(emp)) {
      const list = companyMap.get(emp.companyId) || [];
      list.push(emp);
      companyMap.set(emp.companyId, list);
    }
  }

  const cohorts: {
    companyId: string;
    companyName: string;
    companyUnit: string;
    list: Employee[];
  }[] = [];
  const smallGroup: Employee[] = [];

  companyMap.forEach((empList, companyId) => {
    if (empList.length >= LGPD_MIN_GROUP_SIZE) {
      cohorts.push({
        companyId,
        companyName: empList[0].companyName,
        companyUnit: empList[0].companyUnit,
        list: empList,
      });
    } else {
      smallGroup.push(...empList);
    }
  });

  let suppressedLivesCount = 0;
  if (smallGroup.length >= LGPD_MIN_GROUP_SIZE) {
    cohorts.push({
      companyId: 'cohort-demais-unidades',
      companyName: 'Demais Unidades Consolidada (N ≥ 5)',
      companyUnit: 'Agrupamento de proteção de anonimato LGPD',
      list: smallGroup,
    });
  } else {
    suppressedLivesCount = smallGroup.length;
  }

  const companies: LgpdCompanyMetric[] = [];

  cohorts.forEach(({ companyId, companyName, companyUnit, list: empList }) => {
    const allRowsForCompany = allCompanyRowsMap.get(companyId) || empList;
    const totalLives = empList.length;
    const inactiveLives = Math.max(0, allRowsForCompany.length - totalLives);
    const activatedLives = empList.filter((e) => !e.neverScheduled && e.riskLevel > 0).length;
    const pendingFirstVisitLives = totalLives - activatedLives;
    const carePassRaw = empList.filter((e) => e.sentStatus).length;
    const multiTeamLivesCount = empList.filter((e) => e.multiTeamCare).length;

    const activationRatePercent = Math.round((activatedLives / Math.max(totalLives, 1)) * 100);
    const sentRatio = carePassRaw / Math.max(totalLives, 1);
    const noShowRatePercent = Number(Math.max(12.4, 23.8 - sentRatio * 11.5).toFixed(1));
    const attendanceRatePercent = Number((100 - noShowRatePercent).toFixed(1));

    const r4 = empList.filter((e) => !e.neverScheduled && e.riskLevel === 4).length;
    const r3 = empList.filter((e) => !e.neverScheduled && e.riskLevel === 3).length;
    const r2 = empList.filter((e) => !e.neverScheduled && e.riskLevel === 2).length;
    const r1 = empList.filter((e) => !e.neverScheduled && e.riskLevel === 1).length;
    const r0 = empList.filter((e) => e.neverScheduled || e.riskLevel === 0).length;

    const riskBreakdown: LgpdCompanyMetric['riskBreakdown'] = [
      {
        riskLevel: 4,
        label: 'Risco 4 • Crítico / Prioritário',
        count: r4,
        percent: Math.round((r4 / Math.max(totalLives, 1)) * 100),
        colorHex: '#C84B31',
      },
      {
        riskLevel: 3,
        label: 'Risco 3 • Comorbidade em Controle (3m)',
        count: r3,
        percent: Math.round((r3 / Math.max(totalLives, 1)) * 100),
        colorHex: '#C26D27',
      },
      {
        riskLevel: 2,
        label: 'Risco 2 • Fator de Risco Modificável (6m)',
        count: r2,
        percent: Math.round((r2 / Math.max(totalLives, 1)) * 100),
        colorHex: '#A16207',
      },
      {
        riskLevel: 1,
        label: 'Risco 1 • Hígido / Preventivo (6m)',
        count: r1,
        percent: Math.round((r1 / Math.max(totalLives, 1)) * 100),
        colorHex: '#1F564C',
      },
      {
        riskLevel: 0,
        label: 'Aguardando 1ª Consulta (Busca Ativa)',
        count: r0,
        percent: Math.round((r0 / Math.max(totalLives, 1)) * 100),
        colorHex: '#64748B',
      },
    ];

    const careLinesDistribution = [
      {
        lineName: 'Nutrição, Sobrepeso e Metabolismo',
        percent: Math.min(95, Math.max(18, Math.round(((r2 + r3 + r4) / Math.max(totalLives, 1)) * 82))),
      },
      {
        lineName: 'Saúde Mental e Qualidade do Sono no Turno',
        percent: Math.min(90, Math.max(15, Math.round(((r3 + r4) / Math.max(totalLives, 1)) * 88))),
      },
      {
        lineName: 'Saúde Osteomuscular e Ergonomia',
        percent: Math.min(88, Math.max(14, Math.round(((r2 + r4) / Math.max(totalLives, 1)) * 76))),
      },
      {
        lineName: 'Hipertensão Arterial e Diabetes (DCNT)',
        percent: Math.min(85, Math.max(12, Math.round(((r3 + r4) / Math.max(totalLives, 1)) * 74))),
      },
    ];

    const countMonthEngaged = (key: keyof Employee['monthlyContacts']) =>
      empList.filter((e) => {
        const val = (e.monthlyContacts?.[key] || '').toLowerCase();
        return val.includes('realizado') || val.includes('monitorado') || val.includes('acompanhamento') || val.includes('1ª consulta');
      }).length;

    const monthlyContactsTrend = [
      { month: 'Jul/26', contactedCount: countMonthEngaged('jul'), adhesionPercent: Math.round((countMonthEngaged('jul') / Math.max(totalLives, 1)) * 100) },
      { month: 'Ago/26', contactedCount: countMonthEngaged('ago'), adhesionPercent: Math.round((countMonthEngaged('ago') / Math.max(totalLives, 1)) * 100) },
      { month: 'Set/26', contactedCount: countMonthEngaged('set'), adhesionPercent: Math.round((countMonthEngaged('set') / Math.max(totalLives, 1)) * 100) },
      { month: 'Out/26', contactedCount: countMonthEngaged('out'), adhesionPercent: Math.round((countMonthEngaged('out') / Math.max(totalLives, 1)) * 100) },
      { month: 'Nov/26', contactedCount: Math.max(activatedLives, countMonthEngaged('nov')), adhesionPercent: activationRatePercent },
      { month: 'Dez/26 (Prog.)', contactedCount: Math.min(totalLives, activatedLives + carePassRaw), adhesionPercent: Math.min(100, Math.round(((activatedLives + carePassRaw) / Math.max(totalLives, 1)) * 100)) },
    ];

    companies.push({
      companyId,
      companyName,
      companyUnit,
      totalCatalogedRows: allRowsForCompany.length,
      totalLives,
      inactiveLives,
      activatedLives,
      pendingFirstVisitLives,
      multiTeamLivesCount,
      activationRatePercent,
      attendanceRatePercent,
      noShowRatePercent,
      carePassIssuedCount: carePassRaw,
      privacyLockApplied: empList.length >= LGPD_MIN_GROUP_SIZE,
      riskBreakdown,
      careLinesDistribution,
      monthlyContactsTrend,
      shiftAdhesion: buildShiftAdhesion(empList, 1),
      healthImpact: computeCorporateHealthImpact(empList),
    });
  });

  const publishedEmployees = cohorts.flatMap((c) => c.list);
  const shiftAdhesionGlobal = buildShiftAdhesion(publishedEmployees, 1);

  const totalActiveLives = companies.reduce((acc, c) => acc + c.totalLives, 0);
  const totalAccompaniedLives = companies.reduce((acc, c) => acc + c.activatedLives, 0);
  const totalNeverScheduledLives = companies.reduce(
    (acc, c) => acc + c.pendingFirstVisitLives,
    0
  );
  const globalActivationRatePercent = Math.round(
    (totalAccompaniedLives / Math.max(totalActiveLives, 1)) * 100
  );

  return {
    totalActiveLives: totalActiveLives || activeEmployees.length,
    totalAccompaniedLives,
    totalNeverScheduledLives,
    globalActivationRatePercent,
    historicalNoShowPercent: 50.0,
    currentNoShowPercent: 15.5,
    apsResolvabilityPercent: 94.0,
    npsScore: 97,
    satisfactionPercent: 96.0,
    minGroupSize: LGPD_MIN_GROUP_SIZE,
    suppressedLivesCount,
    shiftAdhesionGlobal,
    companies,
  };
}

export interface SpreadsheetCensusSnapshot {
  totalRowsInCsv: number;
  activeWorkersInCsv: number;
  inactiveWorkersInCsv: number;
  maleCount: number;
  femaleCount: number;
  averageAge: number;
  doctorTotals: Record<string, number>;
  agePyramid: { range: string; male: number; female: number }[];
}

export const SESI_CSV_CENSUS_SNAPSHOT: SpreadsheetCensusSnapshot = {
  totalRowsInCsv: 100,
  activeWorkersInCsv: 60,
  inactiveWorkersInCsv: 40,
  maleCount: 50,
  femaleCount: 50,
  averageAge: 38.2,
  doctorTotals: {
    'Dr. Felipe Andrade': 21,
    'Dra. Helena Matos': 26,
    'Dr. Ricardo Fontes': 24,
    'Dra. Beatriz Campos': 29,
  },
  agePyramid: [
    { range: '18 a 29 anos', male: 10, female: 19 },
    { range: '30 a 39 anos', male: 14, female: 12 },
    { range: '40 a 49 anos', male: 12, female: 13 },
    { range: '50+ anos', male: 14, female: 6 },
  ],
};

export const REFERENCE_DOCTORS = [
  'Dr. Felipe Andrade',
  'Dra. Helena Matos',
  'Dr. Ricardo Fontes',
  'Dra. Beatriz Campos',
] as const;

export function computeSpreadsheetCensusFromCsv(csvText: string): SpreadsheetCensusSnapshot {
  const lines = csvText
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0 && !/^;+$/.test(l.trim()));
  const rows = lines.slice(1).map((l) => l.split(';').map((c) => c.trim()));
  const valid = rows.filter((r) => r[0] && r[1]);

  const doctorTotals: Record<string, number> = {};
  REFERENCE_DOCTORS.forEach((d) => (doctorTotals[d] = 0));
  const buckets = [
    { range: '18 a 29 anos', min: 0, max: 29, male: 0, female: 0 },
    { range: '30 a 39 anos', min: 30, max: 39, male: 0, female: 0 },
    { range: '40 a 49 anos', min: 40, max: 49, male: 0, female: 0 },
    { range: '50+ anos', min: 50, max: 200, male: 0, female: 0 },
  ];

  let active = 0;
  let male = 0;
  let female = 0;
  let ageSum = 0;
  let ageCount = 0;

  for (const r of valid) {
    const status = (r[2] || '').toUpperCase();
    if (status === 'ATIVO') active++;
    const isFemale = (r[6] || '').toUpperCase() === 'FEMININO';
    if (isFemale) female++;
    else male++;
    const age = parseInt(r[4] || '', 10);
    if (!Number.isNaN(age)) {
      ageSum += age;
      ageCount++;
      const bucket = buckets.find((b) => age >= b.min && age <= b.max);
      if (bucket) {
        if (isFemale) bucket.female++;
        else bucket.male++;
      }
    }
    const doctor = r[10];
    if (doctor) doctorTotals[doctor] = (doctorTotals[doctor] || 0) + 1;
  }

  return {
    totalRowsInCsv: valid.length,
    activeWorkersInCsv: active,
    inactiveWorkersInCsv: valid.length - active,
    maleCount: male,
    femaleCount: female,
    averageAge: ageCount > 0 ? Number((ageSum / ageCount).toFixed(1)) : 0,
    doctorTotals,
    agePyramid: buckets.map(({ range, male: m, female: f }) => ({ range, male: m, female: f })),
  };
}

export function getPowerBiAnalyticsPayload(
  employees: Employee[],
  census: SpreadsheetCensusSnapshot = SESI_CSV_CENSUS_SNAPSHOT
): PowerBiAnalyticsPayload {
  const activeEmployees = employees.filter(isEmployeeActive);
  const totalEmp = Math.max(activeEmployees.length, 1);
  const r4 = activeEmployees.filter((e) => !e.neverScheduled && e.riskLevel === 4).length;
  const r3 = activeEmployees.filter((e) => !e.neverScheduled && e.riskLevel === 3).length;
  const r2 = activeEmployees.filter((e) => !e.neverScheduled && e.riskLevel === 2).length;
  const r1 = activeEmployees.filter((e) => !e.neverScheduled && e.riskLevel === 1).length;
  const r0 = activeEmployees.filter((e) => e.neverScheduled || e.riskLevel === 0).length;

  const doctors = REFERENCE_DOCTORS.map((name) => ({
    name,
    csvTotal: census.doctorTotals[name] ?? 0,
  }));

  const doctorPortfolios = doctors.map((doc) => {
    const docEmployees = activeEmployees.filter((e) => e.referenceDoctor === doc.name);
    const activeAssigned = docEmployees.length;
    const accompaniedCount = docEmployees.filter(
      (e) => !e.neverScheduled && e.riskLevel > 0
    ).length;
    const pendingFirstVisitCount = activeAssigned - accompaniedCount;
    const carePassSentCount = docEmployees.filter((e) => e.sentStatus).length;
    const adhesionRatePercent =
      activeAssigned > 0
        ? Math.min(
            98,
            Math.round(((accompaniedCount + carePassSentCount * 0.6) / activeAssigned) * 100)
          )
        : 80;

    return {
      doctorName: doc.name,
      totalAssignedCsv: doc.csvTotal,
      activeAssigned,
      accompaniedCount,
      pendingFirstVisitCount,
      carePassSentCount,
      adhesionRatePercent,
    };
  });

  return {
    spreadsheetCensus: {
      totalRowsInCsv: employees.length || census.totalRowsInCsv,
      activeWorkersInCsv: activeEmployees.length || census.activeWorkersInCsv,
      inactiveWorkersInCsv:
        employees.filter((e) => e.status === 'INATIVO').length || census.inactiveWorkersInCsv,
      maleCount: census.maleCount,
      femaleCount: census.femaleCount,
      averageAge: census.averageAge,
      multiTeamCarePercent: Number(
        ((activeEmployees.filter((e) => e.multiTeamCare).length / totalEmp) * 100).toFixed(1)
      ),
    },
    riskDistribution: [
      {
        riskLevel: 4,
        label: 'Risco 4 • Crítico / Descompensado',
        returnProtocol: 'Retorno Quinzenal / Mensal (Critério Médico)',
        count: r4,
        percentOfTotal: Math.round((r4 / totalEmp) * 100),
        colorHex: '#C84B31',
      },
      {
        riskLevel: 3,
        label: 'Risco 3 • Comorbidade / Saúde Mental',
        returnProtocol: 'Retorno Obrigatório a cada 3 meses (90d)',
        count: r3,
        percentOfTotal: Math.round((r3 / totalEmp) * 100),
        colorHex: '#C26D27',
      },
      {
        riskLevel: 2,
        label: 'Risco 2 • Saudável com Fator de Risco',
        returnProtocol: 'Retorno a cada 6 meses (180d)',
        count: r2,
        percentOfTotal: Math.round((r2 / totalEmp) * 100),
        colorHex: '#A16207',
      },
      {
        riskLevel: 1,
        label: 'Risco 1 • Saudável / Hígido',
        returnProtocol: 'Retorno Preventivo a cada 6 meses (180d)',
        count: r1,
        percentOfTotal: Math.round((r1 / totalEmp) * 100),
        colorHex: '#1F564C',
      },
      {
        riskLevel: 0,
        label: 'Aguardando 1ª Consulta (Busca Ativa)',
        returnProtocol: 'Prioridade por Maior Tempo sem Agendar (Fila 2)',
        count: r0,
        percentOfTotal: Math.round((r0 / totalEmp) * 100),
        colorHex: '#64748B',
      },
    ],
    careLinesPrevalence: [
      {
        lineName: 'Saúde Mental (Ansiedade, Estresse de Turno e Sono)',
        category: 'Saúde Mental',
        affectedPercent: 34.2,
        resolvedInApsPercent: 92.5,
      },
      {
        lineName: 'DCNT • Hipertensão Arterial e Diabetes Mellitus Tipo 2',
        category: 'DCNT / Crônicos',
        affectedPercent: 28.6,
        resolvedInApsPercent: 95.0,
      },
      {
        lineName: 'Osteomuscular • Lombalgia Mecânica e Ergonomia',
        category: 'Osteomuscular / Turno',
        affectedPercent: 31.8,
        resolvedInApsPercent: 94.0,
      },
      {
        lineName: 'Nutrição • Sobrepeso, Obesidade e Dislipidemia',
        category: 'Estilo de Vida / Prevenção',
        affectedPercent: 41.5,
        resolvedInApsPercent: 96.2,
      },
      {
        lineName: 'Cessação do Tabagismo e Controle do Uso de Álcool',
        category: 'Estilo de Vida / Prevenção',
        affectedPercent: 14.8,
        resolvedInApsPercent: 89.4,
      },
      {
        lineName: 'Saúde Integral da Mulher e do Homem (Rastreio Preventivo)',
        category: 'Estilo de Vida / Prevenção',
        affectedPercent: 52.0,
        resolvedInApsPercent: 97.1,
      },
    ],
    doctorPortfolios,
    monthlyEvolution2026: [
      {
        month: 'Jul/2026',
        scheduledConsultations: 60,
        completedConsultations: 30,
        noShowPercent: 50.0,
        activeSearchConverted: 4,
      },
      {
        month: 'Ago/2026',
        scheduledConsultations: 60,
        completedConsultations: 35,
        noShowPercent: 41.7,
        activeSearchConverted: 8,
      },
      {
        month: 'Set/2026',
        scheduledConsultations: 60,
        completedConsultations: 43,
        noShowPercent: 28.3,
        activeSearchConverted: 14,
      },
      {
        month: 'Out/2026',
        scheduledConsultations: 60,
        completedConsultations: 49,
        noShowPercent: 18.3,
        activeSearchConverted: 21,
      },
      {
        month: 'Nov/2026',
        scheduledConsultations: 60,
        completedConsultations: 51,
        noShowPercent: 15.0,
        activeSearchConverted: 28,
      },
      {
        month: 'Dez/2026 (Meta)',
        scheduledConsultations: 60,
        completedConsultations: 53,
        noShowPercent: 11.7,
        activeSearchConverted: 36,
      },
    ],
    agePyramid: census.agePyramid.map((b) => ({ ...b })),
    healthImpact: computeCorporateHealthImpact(activeEmployees),
  };
}

export function getDefaultDatabaseStatus(employeesCount: number): DatabaseConnectionStatus {
  return {
    mode: 'LOCAL_PERSISTENCE',
    status: 'ONLINE',
    localDbFilePath: 'server/data/healthx_db.json',
    totalEmployeesPersisted: employeesCount,
    lastPersistedAt: new Date().toLocaleTimeString('pt-BR'),
    latencyMs: 3,
    scalabilityAdapters: [
      {
        name: 'Sistema de Agendamento SESI (S+ / SOC)',
        technology: 'REST Webhook + Sincronização Bidirecional de Consultas e Prazos',
        endpointPreview: 'https://api.smais.sesiba.org.br/v2/coordenacao-cuidado/sync',
        status: 'ACTIVE',
        capacityTarget: 'Atualização automática de prazos de retorno e demandas médicas',
      },
      {
        name: 'Microsoft Teams & Graph Calendar API',
        technology: 'Sincronização de Agenda Médica/Multiprofissional + Acesso Rápido do Trabalhador',
        endpointPreview: 'https://graph.microsoft.com/v1.0/users/aps-sesi@sesiba.org.br/calendar/events',
        status: 'ACTIVE',
        capacityTarget: 'Reserva na janela protegida do turno e link direto sem senha (Teams/Mobile)',
      },
      {
        name: 'Gateway WhatsApp Corporativo (Cloud API)',
        technology: 'Emissão de Passe de Cuidado + Pré-Check-in QR Code em 1 Clique',
        endpointPreview: 'https://graph.facebook.com/v20.0/sesi-saude-acolhe/messages',
        status: 'ACTIVE',
        capacityTarget: 'Convocação em janelas protegidas de 1º e 2º turno',
      },
      {
        name: 'PostgreSQL 16 + Camada Analítica Power BI',
        technology: 'Pool Transacional SQL + View Materializada Anonimizada (Trava N ≥ 5)',
        endpointPreview: 'postgresql://sesi_aps_prod:***@db.sesisaude.org.br:5432/healthx_acolhe',
        status: 'READY',
        capacityTarget: '104 estabelecimentos industriais • 10.025+ vidas ativas',
      },
    ],
  };
}

export function getDefaultAutomationLogs(): AutomationLogEntry[] {
  return [
    {
      id: 'log-auto-001',
      executedAt: '15/11/2026 07:30:12',
      scriptName: 'syncSesiSpreadsheet.ts',
      trigger: 'ROTINA_SISTEMA',
      rowsScanned: 100,
      rowsUpdatedOrImported: 100,
      carePassesDispatched: 12,
      outputFileGenerated: 'data/Coordenacao_do_Cuidado_APS_SESI.xlsx',
      summaryMessage:
        'Sincronização automática de Coordenação do Cuidado e Agendas (S+ / Microsoft Teams) concluída (100 registros: 60 ativos distribuídos nas filas clínicas e 40 inativos catalogados).',
    },
    {
      id: 'log-auto-002',
      executedAt: '15/11/2026 08:00:05',
      scriptName: 'activeSearchCron.ts',
      trigger: 'AGENDADOR_AUTOMATICO',
      rowsScanned: 60,
      rowsUpdatedOrImported: 12,
      carePassesDispatched: 12,
      outputFileGenerated: 'server/data/healthx_db.json',
      summaryMessage:
        'Varredura automática de prazos: 12 Passes de Cuidado e links de acesso rápido (Teams / WhatsApp) emitidos nas janelas protegidas de turno.',
    },
  ];
}

/**
 * Exporta o estado atual de todos os funcionários para as EXATAS 32 colunas da planilha oficial do SESI:
 * `GESTÃO DO CUIDADO - APS SESI (Coordenação do cuidado).csv`
 */
export function exportEmployeesToSesiCsvString(employees: Employee[]): string {
  const header = [
    'MATRÍCULA ',
    'NOME COMPLETO',
    'STATUS',
    'DATA DE NASCIMENTO',
    'IDADE',
    'CPF',
    'SEXO',
    'DATA DE ENTRADA APS',
    'TELEFONE',
    'EMPRESA',
    'MÉDICO DE REFERÊNCIA',
    'ATENDIMENTO COM EQUIPE MULTI?',
    'DATA ÚLTIMA CONSULTA NUTRICIONISTA',
    'DATA ÚLTIMA CONSULTA PSICOLOGIA',
    'DATA ÚLTIMA CONSULTA MÉDICA',
    'HISTÓRICO CONTATO DE CONSTADOS DE 2026',
    'CONTATO DE JULHO/ 2026',
    'CONTATO DE AGOSTO / 2026',
    'CONTATO DE SETEMBRO / 2026',
    'CONTATO DE OUTUBRO / 2026',
    'CONTATO DE NOVEMBRO / 2026',
    'CONTATO DE DEZEMBRO / 2026',
    'PREVISÃO DE RETORNO  CONFORME SOLICITAÇÃO MÉDICA',
    'DEMANDAS GERADAS NA ÚLTIMA CONSULTA MÉDICA',
    'CLASSIFICAÇÃO DE RISCO ATUAL',
    'CLASSIFICAÇÃO DE RISCO INICIAL',
    'RETORNO DO ATENDIMENTO MÉDICO PARA VERIFICAR CLASSIFICAÇÃO DE RISCO',
    'DATA ENVIO DO PLANO',
    'VERIFICAR ADESÃO DAS METAS',
    'STATUS PLANO DE CUIDADO',
    'DATA DA COORD CUIDADO',
    'DATA DA PRÓXIMA COORD CUIDADO2',
  ].join(';');

  const clean = (val: string | number | undefined) =>
    String(val ?? '')
      .replace(/;/g, ',')
      .replace(/\r?\n/g, ' ')
      .trim();

  const rows = employees.map((emp) => {
    const mc = emp.monthlyContacts || {
      jul: '',
      ago: '',
      set: '',
      out: '',
      nov: '',
      dez: '',
    };
    return [
      clean(emp.matricula),
      clean(emp.name.toUpperCase()),
      clean(emp.status || 'ATIVO'),
      clean(emp.birthDate),
      clean(emp.age),
      clean(emp.cpf),
      clean(emp.sex),
      clean(emp.admissionDate),
      clean(emp.phone),
      clean(emp.companyName),
      clean(emp.referenceDoctor),
      emp.multiTeamCare ? 'SIM' : 'NÃO',
      clean(emp.lastNutritionDate),
      clean(emp.lastPsychologyDate),
      clean(emp.lastVisit),
      clean(emp.contactHistory2026 || emp.whatsappStatus),
      clean(mc.jul),
      clean(mc.ago),
      clean(mc.set),
      clean(mc.out),
      clean(mc.nov),
      clean(mc.dez),
      clean(emp.nextVisit),
      clean(emp.lastMedicalDemands || emp.summaryLine),
      emp.riskLevel > 0 ? `RISCO ${emp.riskLevel}` : 'SEM CLASSIFICAÇÃO',
      emp.initialRiskLevel > 0 ? `RISCO ${emp.initialRiskLevel}` : 'SEM CLASSIFICAÇÃO',
      clean(emp.riskVerificationReturnDate || emp.nextVisit),
      clean(emp.planSentDate),
      clean(emp.goalsAdhesionStatus),
      clean(emp.carePlanStatus),
      clean(emp.careCoordinationDate),
      clean(emp.nextCareCoordinationDate || emp.nextVisit),
    ].join(';');
  });

  return [header, ...rows].join('\n');
}

/**
 * Importador de planilha CSV no formato de 32 colunas do SESI Saúde Acolhe.
 */
export function parseSesiCsvContent(
  csvText: string,
  existingEmployees: Employee[]
): {
  importedCount: number;
  skippedInactiveCount: number;
  newEmployees: Employee[];
} {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^;+$/.test(l));

  if (lines.length <= 1) {
    return { importedCount: 0, skippedInactiveCount: 0, newEmployees: [] };
  }

  const existingMatriculas = new Set(existingEmployees.map((e) => e.matricula));
  const newEmployees: Employee[] = [];
  let skippedInactiveCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';').map((c) => c.trim());
    const matricula = cols[0];
    const rawName = cols[1];
    const status = (cols[2] || 'ATIVO').toUpperCase() === 'INATIVO' ? 'INATIVO' : 'ATIVO';

    if (!matricula || !rawName) continue;
    if (status === 'INATIVO') {
      skippedInactiveCount++;
    }
    if (existingMatriculas.has(matricula)) continue;

    const age = parseInt(cols[4] || '35', 10) || 35;
    const cpf = cols[5] || '000.000.000-00';
    const sex = (cols[6] || 'MASCULINO').toUpperCase() === 'FEMININO' ? 'FEMININO' : 'MASCULINO';
    const admissionRaw = cols[7] || '2026-05-15';
    const phone = cols[8] || '(71) 90000-0000';
    const companyName = cols[9] || 'Têxtil Horizonte Ltda';
    const doctor = cols[10] || 'Dra. Beatriz Campos';
    const multiTeam =
      (cols[11] || '').toUpperCase() === 'SIM' || Boolean(cols[12]) || Boolean(cols[13]);

    const formattedName = rawName
      .toLowerCase()
      .split(' ')
      .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
      .join(' ');

    const mappedCompany =
      COMPANY_METADATA[companyName] || COMPANY_METADATA['Têxtil Horizonte Ltda'];
    const daysSinceActivation = status === 'INATIVO' ? 0 : Math.max(45, Math.min(240, 120 + ((i * 17) % 80)));
    const shift = i % 2 === 0 ? '1º Turno (06h–14h)' : '2º Turno (14h–22h)';

    const parsedRiskMatch = (cols[24] || '').match(/[1-4]/);
    const riskLevel = (parsedRiskMatch ? Number(parsedRiskMatch[0]) : 0) as RiskLevel;
    const initialRiskMatch = (cols[25] || '').match(/[1-4]/);
    const initialRiskLevel = (initialRiskMatch ? Number(initialRiskMatch[0]) : riskLevel) as RiskLevel;

    const emp: Employee = normalizeEmployeeAfterSave({
      id: `emp-${matricula}`,
      matricula,
      name: formattedName,
      status,
      birthDate: cols[3] || '1988-01-01',
      age,
      cpf,
      sex,
      admissionDate: admissionRaw,
      phone,
      companyId: mappedCompany.id,
      companyName,
      companyUnit: mappedCompany.unit,
      referenceDoctor: doctor,
      multiTeamCare: multiTeam,
      lastNutritionDate: cols[12] || '',
      lastPsychologyDate: cols[13] || '',
      lastVisit: cols[14] || '',
      contactHistory2026: cols[15] || 'Registro sincronizado na Coordenação do Cuidado',
      monthlyContacts: {
        jul: cols[16] || '—',
        ago: cols[17] || '—',
        set: cols[18] || '—',
        out: cols[19] || '—',
        nov: cols[20] || 'Aguardando',
        dez: cols[21] || 'Programado',
      },
      returnRule: getDefaultReturnRuleForRisk(riskLevel),
      nextVisit: cols[22] || 'Pendente 1ª Consulta',
      lastMedicalDemands: cols[23] || 'Avaliação clínica inicial na APS',
      riskLevel,
      initialRiskLevel,
      riskVerificationReturnDate: cols[26] || '',
      planSentDate: cols[27] || '',
      goalsAdhesionStatus: cols[28] || 'Aguardando 1ª consulta',
      carePlanStatus: cols[29] || 'Pendente Acolhimento Inicial',
      careCoordinationDate: cols[30] || '2026-11-15',
      nextCareCoordinationDate: cols[31] || '',
      sector: mappedCompany.sectors[i % mappedCompany.sectors.length],
      shift,
      role: `Operador Industrial • ${shift}`,
      neverScheduled: riskLevel === 0,
      daysSinceActivation,
      sentStatus: false,
      carePassCode: `PASSE-${matricula.slice(-4)}`,
      protectedWindowSlot: i % 2 === 0 ? mappedCompany.shift1Slot : mappedCompany.shift2Slot,
      summaryLine:
        riskLevel > 0
          ? `Risco ${riskLevel} • ${cols[23] || 'Em acompanhamento na APS'}`
          : `${daysSinceActivation} dias ativo sem 1ª consulta • Busca ativa`,
      clinicalNotes:
        cols[23] ||
        `Registro sincronizado na Coordenação do Cuidado (Matrícula ${matricula}).`,
      habits: ['Coleta programada na consulta APS'],
      conditions: [cols[23] || 'Avaliação clínica inicial'],
      medsAndScreening: ['Rastreio preventivo APS'],
      pciRecommendations: ['Agendar atendimento dentro da janela protegida do turno'],
      pciExams: ['Triagem pressórica, glicêmica e antropométrica'],
      examResultsAndPrescriptions: [],
      whatsappStatus: 'Aguardando disparo do Passe de Cuidado',
      returnNotes: `Médico de referência: ${doctor}.`,
    });

    newEmployees.push(emp);
    existingMatriculas.add(matricula);
  }

  return {
    importedCount: newEmployees.length,
    skippedInactiveCount,
    newEmployees,
  };
}

/**
 * LEITOR OCR SIMPLES — EXTRAÇÃO AUTOMÁTICA DE FICHA DE ACOLHIMENTO / ASO PARA OS CAMPOS DA PLANILHA:
 * Recebe o texto extraído de documento/imagem/ficha e converte automaticamente nos campos da planilha
 * do SESI para validação pelo médico/enfermeiro.
 */
export function extractStructuredFichaFromOcrText(rawText: string): Partial<Employee> {
  const findField = (patterns: RegExp[], fallback = ''): string => {
    for (const regex of patterns) {
      const match = rawText.match(regex);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return fallback;
  };

  // Suporta formato "Funcionário (Código / Nome)\n98765 / Mariana Silva Souza" do PDF de Teste OCR
  const codeAndNameMatch = rawText.match(
    /funcion[áa]rio\s*\(c[óo]digo\s*\/\s*nome\)\s*[\r\n:]+\s*(\d{3,10})\s*\/\s*([^\r\n;]+)/i
  );

  const matricula =
    codeAndNameMatch?.[1]?.trim() ||
    findField([
      /matr[íi]cula\s*[:=-]?\s*(\d{4,10})/i,
      /c[óo]digo\s*[:=-]?\s*(\d{4,10})/i,
      /\b(2026\d{4})\b/,
    ]) ||
    `2026${Math.floor(5000 + Math.random() * 4900)}`;

  const name =
    codeAndNameMatch?.[2]?.trim() ||
    findField([
      /nome(?:\s+completo)?\s*[:=-]\s*([^\r\n;]+)/i,
      /funcion[áa]rio\s*[:=-]\s*([^\r\n;]+)/i,
      /paciente\s*[:=-]\s*([^\r\n;]+)/i,
    ]) ||
    '';

  const cpf =
    findField([
      /cpf\s*[:=-]?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i,
      /\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/,
    ]) || '000.000.000-00';

  const birthRaw = findField([
    /nascimento\s*[\r\n:=-]+\s*(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/i,
    /dn\s*[\r\n:=-]+\s*(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/i,
  ]);
  let birthDate = '1988-05-14';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(birthRaw)) {
    const [d, m, y] = birthRaw.split('/');
    birthDate = `${y}-${m}-${d}`;
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(birthRaw)) {
    birthDate = birthRaw;
  }

  const birthYear = parseInt(birthDate.slice(0, 4), 10);
  const ageStr = findField([/idade\s*[\r\n:=-]+\s*(\d{2})\b/i]);
  const age = ageStr ? parseInt(ageStr, 10) : Math.max(18, 2026 - (birthYear || 1988));

  const sexRaw = findField([/sexo\s*[\r\n:=-]+\s*(masculino|feminino|m|f)\b/i]).toUpperCase();
  const inferredFemaleByName = /\b(mariana|ana|maria|juliana|fernanda|patr[íi]cia|camila|bruna|vanessa|jessica|j[ée]ssica|cl[áa]udia|adriana|alessandra|tatiane|simone|priscila|renata|luciana|elaine|daniela|sandra|ros[âa]ngela|aline)\b/i.test(
    name
  );
  const sex: 'MASCULINO' | 'FEMININO' = sexRaw.startsWith('F')
    ? 'FEMININO'
    : sexRaw.startsWith('M')
    ? 'MASCULINO'
    : inferredFemaleByName
    ? 'FEMININO'
    : 'MASCULINO';

  const phone =
    findField([
      /contato(?:\s+do\s+paciente)?\s*[\r\n:=-]+\s*(\(?\d{2}\)?\s*\d{4,5}-?\d{4})/i,
      /telefone\s*[\r\n:=-]+\s*(\(?\d{2}\)?\s*\d{4,5}-?\d{4})/i,
      /celular\s*[\r\n:=-]+\s*(\(?\d{2}\)?\s*\d{4,5}-?\d{4})/i,
      /(\(\d{2}\)\s*\d{4,5}-\d{4})/,
    ]) || '(71) 99640-1120';

  const companyRaw = findField([
    /empresa\s*[\r\n:=-]+\s*([^\r\n;]+)/i,
  ]);
  const unitRaw = findField([
    /unidade\s*[\r\n:=-]+\s*([^\r\n;]+)/i,
  ]);
  const cargoRaw = findField([
    /cargo\s*[\r\n:=-]+\s*([^\r\n;]+)/i,
  ]);
  const setorRaw = findField([
    /setor\s*[\r\n:=-]+\s*([^\r\n;]+)/i,
  ]);

  const matchedExistingCompany = Object.keys(COMPANY_METADATA).find(
    (c) => companyRaw && companyRaw.toLowerCase().includes(c.split(' ')[0].toLowerCase())
  );
  const matchedCompanyName =
    matchedExistingCompany || (companyRaw ? companyRaw.trim() : 'Têxtil Horizonte Ltda');
  const companyMeta =
    COMPANY_METADATA[matchedExistingCompany || 'Têxtil Horizonte Ltda'];

  const activationRaw = findField([
    /data\s+de\s+ativa[çc][ãa]o\s*[\r\n:=-]+\s*(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/i,
    /entrada\s+aps\s*[\r\n:=-]+\s*(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/i,
    /admiss[ãa]o\s*[\r\n:=-]+\s*(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/i,
  ]);
  let admissionDate = '2026-11-15';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(activationRaw)) {
    const [d, m, y] = activationRaw.split('/');
    admissionDate = `${y}-${m}-${d}`;
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(activationRaw)) {
    admissionDate = activationRaw;
  }

  const fichaDateRaw = findField([
    /data\s+ficha\s*[\r\n:=-]+\s*(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/i,
    /data\s+consulta\s*[\r\n:=-]+\s*(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/i,
  ]);
  let lastVisit = '2026-11-15';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(fichaDateRaw)) {
    const [d, m, y] = fichaDateRaw.split('/');
    lastVisit = `${y}-${m}-${d}`;
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(fichaDateRaw)) {
    lastVisit = fichaDateRaw;
  }

  const doctorRaw = findField([
    /m[ée]dico(?:\s+de\s+refer[êe]ncia)?\s*[\r\n:=-]+\s*([^\r\n;]+)/i,
    /(Dr\.?\s+[A-Za-zÀ-ÿ\s]+|Dra\.?\s+[A-Za-zÀ-ÿ\s]+)/i,
  ]);
  const referenceDoctor =
    REFERENCE_DOCTORS.find((d) =>
      doctorRaw.toLowerCase().includes(d.split(' ')[1].toLowerCase())
    ) || 'Dra. Beatriz Campos';

  const riskMatch = rawText.match(
    /(?:classifica[çc][ãa]o\s+quanto\s+ao\s+risco|risco(?:\s+atual|\s+inicial|\s+cl[íi]nico)?)\s*[\r\n:=-]+\s*([0-4])/i
  );
  const riskLevel = (riskMatch ? Number(riskMatch[1]) : 2) as RiskLevel;

  const obsMatch = rawText.match(
    /observa[çc][õo]es\s+sobre\s+a\s+classifica[çc][ãa]o\s+do\s+risco\s+[àa]\s+sa[úu]de\s*:\s*[\r\n]+([\s\S]*?)(?:\r?\n\d+\.\s|\r?\nHist[óo]rico|$)/i
  );
  const cleanedObs = obsMatch
    ? obsMatch[1]
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .join(' ')
    : '';

  const demands =
    cleanedObs ||
    findField([
      /demandas(?:\s+geradas)?\s*[:=-]\s*([^\r\n]+)/i,
      /conduta\s*[:=-]\s*([^\r\n]+)/i,
      /observa[çc][õo]es\s*[:=-]\s*([^\r\n]+)/i,
      /queixa\s*[:=-]\s*([^\r\n]+)/i,
    ]) ||
    'Acolhimento clínico realizado; plano de cuidado e exames solicitados.';

  const extractedConditions: string[] = [];
  if (/doen[çc]as\s+osteomusculares\s*[\r\n]+☑\s*[\r\n]*sim/i.test(rawText) || /lombalgia/i.test(rawText)) {
    extractedConditions.push('Doença Osteomuscular (Lombalgia tensional)');
  }
  if (/obesidade\s*[\r\n]+☑\s*[\r\n]*sim/i.test(rawText)) {
    extractedConditions.push('Obesidade Grau 1 (Em acompanhamento nutricional)');
  }
  if (/sa[úu]de\s+mental\s*\(ansiedade\)\s*[\r\n]+☑\s*[\r\n]*sim/i.test(rawText) || /ansiedade\s+leve/i.test(rawText)) {
    extractedConditions.push('Saúde Mental — Ansiedade Leve');
  }
  if (/hipertens[ãa]o|pa\s*1[4567]\d/i.test(rawText) && !/hipertens[ãa]o\s+arterial\s*[\r\n]+☐/i.test(rawText)) {
    extractedConditions.push('Hipertensão Arterial em monitoramento');
  }

  const extractedMeds: string[] = [];
  const medDescMatch = rawText.match(/descri[çc][ãa]o\s*[\r\n]+([^\r\n]+(?:\r?\n[^\r\n]+)?)/i);
  if (medDescMatch && !/data\s+in[íi]cio/i.test(medDescMatch[1])) {
    const medLine = medDescMatch[1]
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !/^\d{2}\/\d{2}\/\d{4}$/.test(l))
      .join(' ');
    if (medLine) extractedMeds.push(medLine);
  }

  const multiTeam = /multi|nutri[çc][ãa]o|nutricional|psicologia|terapia/i.test(rawText);
  const returnRule = getDefaultReturnRuleForRisk(riskLevel);
  const nextVisit = calculateNextVisitDate(lastVisit, returnRule, riskLevel);

  return {
    matricula,
    name,
    status: 'ATIVO',
    birthDate,
    age,
    cpf,
    sex,
    admissionDate,
    phone,
    companyId: companyMeta.id,
    companyName: matchedCompanyName,
    companyUnit: unitRaw || companyMeta.unit,
    sector: setorRaw || companyMeta.sectors[0],
    role: cargoRaw ? `${cargoRaw}${setorRaw ? ` (${setorRaw})` : ''}` : undefined,
    referenceDoctor,
    multiTeamCare: multiTeam,
    lastVisit: riskLevel > 0 ? lastVisit : '',
    lastNutritionDate: /nutri/i.test(rawText) ? lastVisit : '',
    lastPsychologyDate: /psico|terapia/i.test(rawText) ? lastVisit : '',
    riskLevel,
    initialRiskLevel: riskLevel,
    returnRule,
    nextVisit,
    riskVerificationReturnDate: nextVisit,
    lastMedicalDemands: demands,
    clinicalNotes: cleanedObs || demands,
    conditions: extractedConditions.length > 0 ? extractedConditions : undefined,
    medsAndScreening: extractedMeds.length > 0 ? extractedMeds : undefined,
    planSentDate: riskLevel > 0 ? lastVisit : '',
    goalsAdhesionStatus: riskLevel > 0 ? nextVisit : '',
    carePlanStatus: riskLevel > 0 ? 'AGUARDANDO RESPOSTA' : '',
    careCoordinationDate: lastVisit,
    nextCareCoordinationDate: nextVisit,
  };
}

/**
 * LEITOR OCR DE RETORNO — EXTRAÇÃO AUTOMÁTICA DE PRESCRIÇÕES E RESULTADOS DE EXAMES:
 * Converte laudos laboratoriais, aferições ou receituários em registro estruturado na ficha de retorno.
 */
export function extractExamPrescriptionFromOcrText(rawText: string): {
  entry: ExamPrescriptionEntry;
  suggestedRisk?: RiskLevel;
  updatedDemandsSummary: string;
} {
  const isPrescription = /receita|prescri[çc][ãa]o|mg\b|comprimido|uso\s+cont[íi]nuo|posologia/i.test(
    rawText
  );
  const isReferral = /encaminhamento|psicologia|nutri[çc][ãa]o|fisioterapia/i.test(rawText);

  const category: ExamPrescriptionEntry['category'] = isPrescription
    ? 'Prescrição Médica'
    : isReferral
      ? 'Encaminhamento Multiprofissional'
      : 'Resultado de Exame';

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const title =
    lines[0]?.replace(/^(laudo|exame|receitu[áa]rio|resultado)\s*[:=-]?\s*/i, '') ||
    (isPrescription ? 'Prescrição de Retorno APS' : 'Resultado de Exame Laboratorial / Clínico');

  const details = lines.slice(0, 4).join(' • ') || rawText.trim();

  let suggestedRisk: RiskLevel | undefined;
  if (/hba1c\s*[89]|pa\s*1[678]\d|descompensad|cr[íi]tico/i.test(rawText)) {
    suggestedRisk = 4;
  } else if (/hba1c\s*[67]|pa\s*1[45]\d|hipertens|ansiedade|lombalgia/i.test(rawText)) {
    suggestedRisk = 3;
  } else if (/sobrepeso|dislipidemia|colesterol\s*2[123]\d/i.test(rawText)) {
    suggestedRisk = 2;
  } else if (/normal|h[íi]gido|pa\s*1[12]\d\/[78]\d/i.test(rawText)) {
    suggestedRisk = 1;
  }

  return {
    entry: {
      id: `ocr-ret-${Date.now()}`,
      date: '2026-11-15',
      category,
      title: title.slice(0, 90),
      details,
      sourceMethod: 'OCR',
      validatedBy: 'Equipe Médica / Enfermagem APS',
    },
    suggestedRisk,
    updatedDemandsSummary: `${category} validado em retorno (${title.slice(0, 50)}): ${details.slice(0, 120)}`,
  };
}
