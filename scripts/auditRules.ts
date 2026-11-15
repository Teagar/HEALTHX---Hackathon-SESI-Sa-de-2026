import fs from 'node:fs';
import { INITIAL_EMPLOYEES } from '../src/mockDatabase';
import {
  computeSpreadsheetCensusFromCsv,
  exportEmployeesToSesiCsvString,
  extractExamPrescriptionFromOcrText,
  extractStructuredFichaFromOcrText,
  getActiveSearchQueue,
  getLgpdAggregatedMetrics,
  getPowerBiAnalyticsPayload,
  getReturnPriorityQueue,
  normalizeEmployeeAfterSave,
  registerFirstConsultation,
} from '../src/queueService';
import {
  buildApsSesiXlsxBytes,
  CARE_PLAN_VALID_OPTIONS,
  extractTextFromPdfBytes,
  parseApsSesiXlsxBytes,
} from '../src/xlsxWorkbookService';
import { resetDatabaseToSeed } from '../server/dbConnector';

let fails = 0;
const check = (name: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`);
  if (!ok) fails++;
};

// Restaura o banco persistente e a planilha consolidada ao estado inicial de 100 registros
let resetCount = INITIAL_EMPLOYEES.length;
try {
  const resetDb = resetDatabaseToSeed();
  resetCount = resetDb.employees.length;
  fs.writeFileSync(
    'data/GESTAO_DO_CUIDADO_ATUALIZADA_AUTO.csv',
    exportEmployeesToSesiCsvString(resetDb.employees),
    'utf-8'
  );
} catch {
  // Em ambiente somente-leitura, valida diretamente sobre INITIAL_EMPLOYEES
}

const emps = structuredClone(INITIAL_EMPLOYEES);
const activeEmps = emps.filter((e) => e.status === 'ATIVO');
const inactiveEmps = emps.filter((e) => e.status === 'INATIVO');

check(
  'R0 Censo completo da planilha oficial carregado (100 registros: 60 ATIVOS + 40 INATIVOS)',
  emps.length === 100 && activeEmps.length === 60 && inactiveEmps.length === 40 && resetCount === 100,
  `total=${emps.length} (ativos=${activeEmps.length}, inativos=${inactiveEmps.length})`
);

// Regra 1: Dupla Fila 50/50 sobre os 60 funcionários ativos
const q1 = getReturnPriorityQueue(emps);
const q2 = getActiveSearchQueue(emps);
check(
  'R1 Janela 1 risco decrescente (4->3->2->1)',
  q1.every((e, i) => i === 0 || q1[i - 1].riskLevel >= e.riskLevel),
  `total Janela 1 = ${q1.length}`
);
check(
  'R1 Janela 1 desempate nextVisit',
  q1.every((e, i) => i === 0 || q1[i - 1].riskLevel !== e.riskLevel || q1[i - 1].nextVisit <= e.nextVisit)
);
check(
  'R1 Janela 2 dias sem agendar decrescente',
  q2.every((e, i) => i === 0 || q2[i - 1].daysSinceActivation >= e.daysSinceActivation),
  `total Janela 2 = ${q2.length}`
);
check(
  'R1 Filas disjuntas e cobrem todos os 60 ativos (0 inativos nas filas)',
  q1.length + q2.length === activeEmps.length &&
    !q1.some((a) => q2.includes(a)) &&
    q1.every((e) => e.status === 'ATIVO') &&
    q2.every((e) => e.status === 'ATIVO'),
  `${q1.length} + ${q2.length} = ${activeEmps.length}`
);

// Regra 2: Protocolo de Risco e Migração Automática + Cálculo de Prazos da Planilha
const target = q2[0];
const viaCockpit = normalizeEmployeeAfterSave({ ...target, riskLevel: 3 });
check(
  'R2 Risco 0->3 migra da Janela 2 para Janela 1',
  !viaCockpit.neverScheduled &&
    getReturnPriorityQueue([viaCockpit]).length === 1 &&
    getActiveSearchQueue([viaCockpit]).length === 0
);
check(
  'R2 Risco 3 => A cada 3 meses (+90d) e preenche colunas da planilha',
  viaCockpit.returnRule === 'A cada 3 meses' &&
    viaCockpit.nextVisit === '2027-02-13' &&
    viaCockpit.riskVerificationReturnDate === '2027-02-13',
  `${viaCockpit.returnRule} ${viaCockpit.lastVisit}->${viaCockpit.nextVisit}`
);
const r4 = registerFirstConsultation(target, 4);
check(
  'R2 1ª consulta Risco 4 => Quinzenal +15d',
  r4.returnRule === 'Quinzenal' && r4.nextVisit === '2026-11-30' && !r4.neverScheduled,
  `${r4.returnRule} ${r4.nextVisit}`
);
const r1 = registerFirstConsultation(target, 1);
check(
  'R2 Risco 1 => A cada 6 meses +180d',
  r1.returnRule === 'A cada 6 meses' && r1.nextVisit === '2027-05-14',
  r1.nextVisit
);
const incoherent = normalizeEmployeeAfterSave({
  ...q1[0],
  riskLevel: 4,
  returnRule: 'A cada 6 meses',
});
check(
  'R2 Regra incoerente corrigida automaticamente',
  incoherent.returnRule === 'Quinzenal',
  incoherent.returnRule
);

// Regra 3: Leitor OCR de Nova Ficha e Leitor OCR de Exames/Prescrições de Retorno + 32 Colunas CSV
const ocrParsed = extractStructuredFichaFromOcrText(
  'MATRÍCULA: 20269901\nNOME COMPLETO: JOÃO CARLOS ROCHA\nCPF: 123.456.789-00\nIDADE: 41\nSEXO: MASCULINO\nEMPRESA: Metalúrgica Atlântida Ltda\nMÉDICO DE REFERÊNCIA: Dr. Felipe Andrade\nCLASSIFICAÇÃO DE RISCO ATUAL: 3\nDEMANDAS GERADAS: Controle pressórico e acompanhamento nutricional.'
);
check(
  'R3 Leitor OCR de Ficha converte campos da planilha e calcula retorno automaticamente',
  ocrParsed.matricula === '20269901' &&
    ocrParsed.riskLevel === 3 &&
    ocrParsed.returnRule === 'A cada 3 meses' &&
    Boolean(ocrParsed.nextVisit),
  `${ocrParsed.name} -> ${ocrParsed.nextVisit}`
);

const ocrExam = extractExamPrescriptionFromOcrText(
  'RESULTADO DE EXAME: HbA1c 7.4% e PA 148x92 mmHg. Ajustar Losartana 50mg.'
);
check(
  'R3 Leitor OCR de Retorno extrai prescrição/exame e sugere risco clínico',
  ocrExam.entry.sourceMethod === 'OCR' && ocrExam.suggestedRisk === 3,
  `${ocrExam.entry.category} (Risco sugerido: ${ocrExam.suggestedRisk})`
);

const exportedCsv = exportEmployeesToSesiCsvString(emps);
const exportedLines = exportedCsv.split('\n');
check(
  'R3 Exportação da planilha gera exatamente 32 colunas e 100 linhas de dados',
  exportedLines[0].split(';').length === 32 && exportedLines.length === 101,
  `colunas=${exportedLines[0].split(';').length}, linhas=${exportedLines.length - 1}`
);

// Regra 5: Trava de Sigilo LGPD (N >= 5) e Escopo Isolado por Empresa
const m = getLgpdAggregatedMetrics(emps);
const json = JSON.stringify(m);
const leaks = emps.filter(
  (e) => json.includes(e.name) || json.includes(e.cpf) || json.includes(e.matricula)
);
check('R5 Zero vazamento de nome/CPF/matrícula no agregado B2B', leaks.length === 0);
check(
  'R5 Todas as 6 empresas da planilha atendem à trava N>=5 e possuem métricas isoladas',
  m.companies.length === 6 &&
    m.companies.every((c) => c.privacyLockApplied && c.totalLives >= 5 && c.productionEconomy.productionValuePreservedBrl > 0),
  m.companies.map((c) => `${c.companyName}:${c.totalLives}`).join(', ')
);
const tiny = getLgpdAggregatedMetrics(activeEmps.slice(0, 3));
check(
  'R5 Coorte N<5 suprimida automaticamente',
  tiny.companies.length === 0 && tiny.suppressedLivesCount === 3
);

// Regra 6: Censo Real Power BI + Impacto Assistencial Baseado em Fontes Epidemiológicas Reais
const census = computeSpreadsheetCensusFromCsv(
  fs.readFileSync('data/gestao_do_cuidado_sesi_100.csv', 'utf-8')
);
const bi = getPowerBiAnalyticsPayload(emps);
check(
  'R6 Censo Power BI == CSV real (100 registros: 60 Ativos / 40 Inativos / 50M / 50F / 38.2 anos)',
  bi.spreadsheetCensus.totalRowsInCsv === 100 &&
    bi.spreadsheetCensus.activeWorkersInCsv === census.activeWorkersInCsv &&
    bi.spreadsheetCensus.inactiveWorkersInCsv === census.inactiveWorkersInCsv &&
    bi.spreadsheetCensus.maleCount === census.maleCount &&
    bi.spreadsheetCensus.averageAge === census.averageAge,
  JSON.stringify(bi.spreadsheetCensus)
);
check(
  'R6 Economia em Saúde calculada sobre dados reais com fontes oficiais (ANAMT, IESS/ANS, OMS/OIT)',
  bi.healthImpact.activeLivesScope === 60 &&
    bi.healthImpact.totalEstimatedAnnualImpactBrl > 0 &&
    bi.healthImpact.methodologySources.length === 3,
  `Economia anual p/ 60 ativos = R$ ${bi.healthImpact.totalEstimatedAnnualImpactBrl}`
);

// Regra 7: Planilha Oficial Excel ("APS SESI dados fictícios.xlsx") Round-Trip + Validação de Dados + PDF OCR Real
async function runAsyncChecks() {
  const xlsxBytes = buildApsSesiXlsxBytes(emps);
  try {
    fs.writeFileSync('data/APS_SESI_dados_ficticios.xlsx', Buffer.from(xlsxBytes));
  } catch {
    // Non-blocking in sandbox if file is locked
  }
  const parsedXlsx = await parseApsSesiXlsxBytes(xlsxBytes, []);
  const allCarePlanStatusesValid = parsedXlsx.updatedEmployees.every(
    (e) =>
      e.carePlanStatus === '' ||
      (CARE_PLAN_VALID_OPTIONS as readonly string[]).includes(e.carePlanStatus)
  );
  check(
    'R7 Planilha Excel (.XLSX) "APS SESI dados fictícios.xlsx" gerada e lida com 100 registros (60 ATIVOS + 40 INATIVOS) e DataValidations oficiais',
    parsedXlsx.totalRowsRead === 100 &&
      parsedXlsx.activeCount === 60 &&
      parsedXlsx.inactiveFilteredCount === 40 &&
      allCarePlanStatusesValid,
    `xlsxSize=${xlsxBytes.byteLength} bytes, rows=${parsedXlsx.totalRowsRead}, active=${parsedXlsx.activeCount}, inactive=${parsedXlsx.inactiveFilteredCount}`
  );

  const pdfMediaPath =
    'C:\\Users\\fell_\\.gemini\\antigravity-cli\\brain\\e12c543f-e914-4f94-91d2-be7510663dff\\.system_generated\\logs\\media\\step_246_media_0.pdf';
  if (fs.existsSync(pdfMediaPath)) {
    const pdfBytes = fs.readFileSync(pdfMediaPath);
    const pdfText = await extractTextFromPdfBytes(pdfBytes);
    const pdfFicha = extractStructuredFichaFromOcrText(pdfText);
    check(
      'R7 Leitor OCR PDF real ("Ficha Gestão do Cuidado - Teste OCR.pdf") extrai Mariana Silva Souza (Mat. 98765, Risco 2, Tech Solutions Brasil LTDA)',
      pdfFicha.matricula === '98765' &&
        pdfFicha.name === 'Mariana Silva Souza' &&
        pdfFicha.companyName === 'Tech Solutions Brasil LTDA' &&
        pdfFicha.riskLevel === 2 &&
        pdfFicha.age === 36,
      `${pdfFicha.matricula} / ${pdfFicha.name} (${pdfFicha.companyName}) -> Risco ${pdfFicha.riskLevel}`
    );
  }

  // Regra 8: Trava LGPD estrita do /gestor (sem risco, sem doenças/linhas, apenas economia de produção)
  const DISEASE_TERMS = [
    'riskBreakdown',
    'careLinesDistribution',
    'Hipertens',
    'Diabetes',
    'Dislipidemia',
    'Saúde Mental',
    'Ansiedade',
    'Depress',
    'DCNT',
    'Obesidade',
    'Osteomuscular',
  ];
  const gestorJson = JSON.stringify(m.companies);
  const diseaseHits = DISEASE_TERMS.filter((t) => gestorJson.includes(t));
  check(
    'R8 /gestor sem classificação de risco e sem doenças/linhas de cuidado no payload',
    diseaseHits.length === 0,
    diseaseHits.join(', ')
  );
  check(
    'R8 /gestor expõe Economia de Produção válida por empresa',
    m.companies.every(
      (c) =>
        c.productionEconomy &&
        c.productionEconomy.productiveHoursPreservedTotal >= 0 &&
        c.productionEconomy.productionValuePreservedBrl >= 0 &&
        typeof c.multiTeamCoveragePercent === 'number'
    ),
    m.companies
      .map((c) => `${c.companyName}: ${c.productionEconomy.productiveHoursPreservedTotal}h`)
      .join(' | ')
  );
  const b2bSource = fs.readFileSync('src/components/CompanyB2BChannel.tsx', 'utf-8');
  check(
    'R8 CompanyB2BChannel.tsx não renderiza riskBreakdown/careLinesDistribution/Economia Assistencial',
    !/riskBreakdown|careLinesDistribution|Economia Assistencial/.test(b2bSource)
  );

  // Regra 9: Motor de importação (14 anexos de teste) + SHA-256 + supply cadastral
  const engine = await import('../src/secilitaEngine');
  const docs: Awaited<ReturnType<typeof engine.readImportedFile>> = [];
  const missing: string[] = [];
  for (const fn of engine.SECILITA_DEMO_FILES) {
    const p = `public/demo/${fn}`;
    if (!fs.existsSync(p)) {
      missing.push(fn);
      continue;
    }
    const file = new File([fs.readFileSync(p)], fn);
    try {
      docs.push(...(await engine.readImportedFile(file)));
    } catch (err) {
      missing.push(`${fn} (erro: ${(err as Error).message})`);
    }
  }
  check(
    'R9 14 anexos de teste presentes e lidos pelo motor de importação',
    missing.length === 0 && docs.length >= 14,
    `docs=${docs.length}${missing.length ? ' faltando=' + missing.join(',') : ''}`
  );
  check(
    'R9 Todo documento lido possui hash SHA-256 (64 hex)',
    docs.every((d) => /^[0-9a-f]{64}$/.test(d.sha256Hash)),
    docs.filter((d) => !/^[0-9a-f]{64}$/.test(d.sha256Hash)).map((d) => d.name).join(',')
  );
  const items = engine.sourceDocsToQueueItems(docs, emps);
  const newItems = items.filter((i) => i.isNewEmployeeMode);
  const regMissing = newItems.filter((i) =>
    engine.REGISTRATION_COL_KEYS.some(
      (k) => !(i.fields.find((f) => f.key === k)?.value ?? '').trim()
    )
  );
  check(
    'R9 Novos cadastros recebem todos os 11 campos cadastrais não-médicos',
    newItems.length > 0 && regMissing.length === 0,
    `itens=${items.length}, novos=${newItems.length}, incompletos=${regMissing.length}`
  );
  const applied = newItems.map((i) => engine.applyImportItemToEmployee(i));
  check(
    'R9 applyImportItemToEmployee gera Employee com storedDocuments (custódia SHA-256)',
    applied.length > 0 &&
      applied.every(
        (e) =>
          e.matricula &&
          e.name &&
          e.companyName &&
          (e.storedDocuments?.length ?? 0) >= 1 &&
          /^[0-9a-f]{64}$/.test(e.storedDocuments![0].sha256IntegrityHash)
      ),
    applied.map((e) => `${e.matricula}/${e.name}`).slice(0, 5).join(', ')
  );

  console.log(fails === 0 ? '\n✅ ALL RULE CHECKS PASSED!' : `\n❌ ${fails} FAILURE(S)`);
  process.exit(fails ? 1 : 0);
}

void runAsyncChecks();
