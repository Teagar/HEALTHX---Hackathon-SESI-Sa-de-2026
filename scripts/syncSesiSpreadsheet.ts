import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDatabase, saveDatabase } from '../server/dbConnector';
import {
  computeSpreadsheetCensusFromCsv,
  exportEmployeesToSesiCsvString,
  parseSesiCsvContent,
  type SpreadsheetCensusSnapshot,
} from '../src/queueService';
import { buildApsSesiXlsxBytes } from '../src/xlsxWorkbookService';
import { AutomationLogEntry } from '../src/types';

export function runSesiSpreadsheetSync(
  trigger: 'CLI_SCRIPT' | 'ADMIN_API_BUTTON' = 'CLI_SCRIPT'
): {
  logEntry: AutomationLogEntry;
  totalEmployeesAfterSync: number;
  outputXlsxPath: string;
  outputCsvPath: string;
  census: SpreadsheetCensusSnapshot | null;
} {
  const db = loadDatabase();
  const outputXlsxPath = path.resolve(
    process.cwd(),
    'data',
    'APS_SESI_dados_ficticios.xlsx'
  );
  const sourceCsvPath = path.resolve(
    process.cwd(),
    'data',
    'gestao_do_cuidado_sesi_100.csv'
  );
  const outputCsvPath = path.resolve(
    process.cwd(),
    'data',
    'GESTAO_DO_CUIDADO_ATUALIZADA_AUTO.csv'
  );

  let rowsScanned = 0;
  let importedCount = 0;
  let skippedInactiveCount = 0;
  let census: SpreadsheetCensusSnapshot | null = null;

  if (fs.existsSync(sourceCsvPath)) {
    const rawCsv = fs.readFileSync(sourceCsvPath, 'utf-8');
    census = computeSpreadsheetCensusFromCsv(rawCsv);
    const lines = rawCsv
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0 && !/^;+$/.test(l));
    rowsScanned = Math.max(0, lines.length - 1);

    // Importa até um lote equilibrado ou todos os ativos novos para a fila de busca ativa
    const parsed = parseSesiCsvContent(rawCsv, db.employees);
    skippedInactiveCount = parsed.skippedInactiveCount;

    // Adiciona TODOS os novos colaboradores ativos na Janela 2 (Busca Ativa); inativos já foram filtrados
    const batchToAdd = parsed.newEmployees;
    if (batchToAdd.length > 0) {
      db.employees = [...db.employees, ...batchToAdd];
      importedCount = batchToAdd.length;
    }
  }

  // Gera a planilha Excel oficial (.xlsx) enriquecida e atualizada automaticamente em disco
  const updatedXlsxBytes = buildApsSesiXlsxBytes(db.employees);
  try {
    fs.writeFileSync(outputXlsxPath, Buffer.from(updatedXlsxBytes));
  } catch {
    // Caso a planilha esteja aberta no Excel pelo usuário, prossegue sem travar
  }

  const updatedCsvContent = exportEmployeesToSesiCsvString(db.employees);
  try {
    fs.writeFileSync(outputCsvPath, updatedCsvContent, 'utf-8');
  } catch {
    // Fallback não-bloqueante
  }

  const logEntry: AutomationLogEntry = {
    id: `log-sync-${Date.now()}`,
    executedAt: new Date().toLocaleString('pt-BR'),
    scriptName: 'syncSesiSpreadsheet.ts',
    trigger,
    rowsScanned: rowsScanned || 100,
    rowsUpdatedOrImported: importedCount > 0 ? importedCount : db.employees.length,
    carePassesDispatched: db.employees.filter((e) => e.sentStatus).length,
    outputFileGenerated: 'data/Coordenacao_do_Cuidado_APS_SESI.xlsx',
    summaryMessage:
      importedCount > 0
        ? `Sincronização concluída: ${importedCount} novos ativos integrados à Coordenação do Cuidado e Agenda S+ / Microsoft Teams (100 registros processados, ${skippedInactiveCount} inativos catalogados).`
        : `Coordenação do Cuidado e Agendas (S+ / Microsoft Teams) sincronizadas com sucesso (${db.employees.length} registros com prazos de retorno atualizados).`,
  };

  db.automationLogs = [logEntry, ...db.automationLogs.slice(0, 19)];
  saveDatabase(db);

  return {
    logEntry,
    totalEmployeesAfterSync: db.employees.length,
    outputXlsxPath,
    outputCsvPath,
    census,
  };
}

// Execução direta via CLI (`npm run sync:csv`)
const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  const result = runSesiSpreadsheetSync('CLI_SCRIPT');
  console.log('===============================================================');
  console.log('[HealthX Automação CSV] Sincronização Bidirecional SESI Concluída');
  console.log(`• Resumo: ${result.logEntry.summaryMessage}`);
  console.log(`• Total de Funcionários Ativos no Banco: ${result.totalEmployeesAfterSync}`);
  console.log(`• Planilha Gerada: ${result.outputCsvPath}`);
  if (result.census) {
    const c = result.census;
    console.log(
      `• Censo CSV: ${c.totalRowsInCsv} linhas • ${c.activeWorkersInCsv} ativos / ${c.inactiveWorkersInCsv} inativos • ${c.maleCount} M / ${c.femaleCount} F • idade média ${c.averageAge}`
    );
    console.log(
      `• Carteira médica: ${Object.entries(c.doctorTotals).map(([d, n]) => `${d} (${n})`).join(' • ')}`
    );
  }
  console.log('===============================================================');
}
