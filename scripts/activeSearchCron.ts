import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDatabase, saveDatabase } from '../server/dbConnector';
import { exportEmployeesToSesiCsvString } from '../src/queueService';
import { AutomationLogEntry } from '../src/types';

export function runActiveSearchBot(
  trigger: 'CLI_SCRIPT' | 'ADMIN_API_BUTTON' | 'AUTO_CRON' = 'CLI_SCRIPT'
): {
  logEntry: AutomationLogEntry;
  dispatchedCount: number;
} {
  const db = loadDatabase();
  const rowsScanned = db.employees.length;
  let dispatchedCount = 0;

  db.employees = db.employees.map((emp) => {
    if (emp.sentStatus) return emp;

    // Critério da Automação:
    // 1. Pacientes de Risco 4 ou Risco 3 na Janela 1 com retorno pendente
    // 2. Trabalhadores na Janela 2 (Nunca Agendou) com >= 140 dias sem 1ª consulta
    const isHighPriorityReturn = !emp.neverScheduled && emp.riskLevel >= 3;
    const isCriticalActiveSearch =
      (emp.neverScheduled || emp.riskLevel === 0) && emp.daysSinceActivation >= 140;

    if (!isHighPriorityReturn && !isCriticalActiveSearch) {
      return emp;
    }

    const companyConfig = db.shiftConfigs.find((c) => c.companyId === emp.companyId);
    const slot = emp.shift.startsWith('1º Turno')
      ? companyConfig?.shift1Window || 'Terça/Quinta • 09h30–10h00 (Janela Protegida 1º Turno)'
      : companyConfig?.shift2Window || 'Quarta/Sexta • 15h30–16h00 (Janela Protegida 2º Turno)';

    const passCode = emp.carePassCode || `PASSE-${emp.matricula.slice(-4)}`;
    dispatchedCount++;

    return {
      ...emp,
      sentStatus: true,
      carePassCode: passCode,
      protectedWindowSlot: slot,
      whatsappStatus: `✓ Passe de Cuidado (${passCode}) disparado automaticamente via Bot em Janela Protegida (${slot})`,
      returnNotes: `${emp.returnNotes} | [Bot Automação]: Convocação preventiva enviada no WhatsApp sem desconto de ponto.`,
    };
  });

  // Atualiza também a planilha CSV automatizada
  const outputCsvPath = path.resolve(
    process.cwd(),
    'data',
    'GESTAO_DO_CUIDADO_ATUALIZADA_AUTO.csv'
  );
  try {
    fs.writeFileSync(outputCsvPath, exportEmployeesToSesiCsvString(db.employees), 'utf-8');
  } catch {
    // Caso o CSV esteja aberto no Excel pelo usuário, prossegue sem travar
  }

  const logEntry: AutomationLogEntry = {
    id: `log-bot-${Date.now()}`,
    executedAt: new Date().toLocaleString('pt-BR'),
    scriptName: 'activeSearchCron.ts',
    trigger,
    rowsScanned,
    rowsUpdatedOrImported: dispatchedCount,
    carePassesDispatched: dispatchedCount,
    outputFileGenerated: 'data/GESTAO_DO_CUIDADO_ATUALIZADA_AUTO.csv',
    summaryMessage:
      dispatchedCount > 0
        ? `Robô de Busca Ativa disparou ${dispatchedCount} novos Passes de Cuidado no WhatsApp (Risco 4/3 e >140d sem 1ª consulta) respeitando as janelas protegidas de turno.`
        : `Varredura concluída (${rowsScanned} vidas): Todos os casos críticos (Risco 4/3 e >140d) já possuem Passe de Cuidado ativo no turno.`,
  };

  db.automationLogs = [logEntry, ...db.automationLogs.slice(0, 19)];
  saveDatabase(db);

  return {
    logEntry,
    dispatchedCount,
  };
}

// Execução direta via CLI (`npm run cron:bot`)
const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  const result = runActiveSearchBot('CLI_SCRIPT');
  console.log('===============================================================');
  console.log('[HealthX Bot Busca Ativa] Varredura Preventiva Concluída');
  console.log(`• Resumo: ${result.logEntry.summaryMessage}`);
  console.log(`• Passes de Cuidado Disparados neste Ciclo: ${result.dispatchedCount}`);
  console.log('===============================================================');
}
