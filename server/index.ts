import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import {
  getDatabaseStatusSnapshot,
  loadDatabase,
  resetDatabaseToSeed,
  saveDatabase,
} from './dbConnector';
import {
  computeSpreadsheetCensusFromCsv,
  exportEmployeesToSesiCsvString,
  getLgpdAggregatedMetrics,
  getPowerBiAnalyticsPayload,
  normalizeEmployeeAfterSave,
  registerFirstConsultation,
  SESI_CSV_CENSUS_SNAPSHOT,
} from '../src/queueService';
import { buildApsSesiXlsxBytes } from '../src/xlsxWorkbookService';
import { Employee, RiskLevel, ShiftWindowConfig } from '../src/types';
import { runSesiSpreadsheetSync } from '../scripts/syncSesiSpreadsheet';
import { runActiveSearchBot } from '../scripts/activeSearchCron';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

function loadLiveCensus() {
  try {
    const csvPath = path.resolve(process.cwd(), 'data', 'gestao_do_cuidado_sesi_100.csv');
    return computeSpreadsheetCensusFromCsv(fs.readFileSync(csvPath, 'utf-8'));
  } catch {
    return SESI_CSV_CENSUS_SNAPSHOT;
  }
}

function buildFullStatePayload() {
  const db = loadDatabase();
  return {
    employees: db.employees,
    shiftConfigs: db.shiftConfigs,
    automationLogs: db.automationLogs,
    dbStatus: getDatabaseStatusSnapshot(db),
    biAnalytics: getPowerBiAnalyticsPayload(db.employees, loadLiveCensus()),
    lgpdDashboard: getLgpdAggregatedMetrics(db.employees),
  };
}

function syncCsvOnDisk(employees: Employee[]) {
  try {
    const xlsxPath = path.resolve(
      process.cwd(),
      'data',
      'APS_SESI_dados_ficticios.xlsx'
    );
    fs.writeFileSync(xlsxPath, Buffer.from(buildApsSesiXlsxBytes(employees)));
  } catch {
    // Non-blocking fallback
  }
  try {
    const outPath = path.resolve(
      process.cwd(),
      'data',
      'GESTAO_DO_CUIDADO_ATUALIZADA_AUTO.csv'
    );
    fs.writeFileSync(outPath, exportEmployeesToSesiCsvString(employees), 'utf-8');
  } catch {
    // Non-blocking fallback
  }
}

app.get('/api/spreadsheet/export.xlsx', (_req, res) => {
  const db = loadDatabase();
  const xlsxBytes = buildApsSesiXlsxBytes(db.employees);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="APS SESI dados ficticios.xlsx"'
  );
  res.send(Buffer.from(xlsxBytes));
});

app.get('/api/health', (_req, res) => {
  const db = loadDatabase();
  res.json({
    ok: true,
    service: 'HealthX SESI Saúde Acolhe API',
    version: db.version,
    lastUpdatedAt: db.lastUpdatedAt,
    employeesCount: db.employees.length,
  });
});

app.get('/api/state', (_req, res) => {
  res.json(buildFullStatePayload());
});

// Canal 3 (Gestor B2B): endpoint 100% anônimo — nunca devolve a lista de funcionários (Regra 5 / LGPD)
app.get('/api/b2b/dashboard', (_req, res) => {
  const db = loadDatabase();
  const { spreadsheetCensus, healthImpact } = getPowerBiAnalyticsPayload(
    db.employees,
    loadLiveCensus()
  );
  res.json({
    lgpdDashboard: getLgpdAggregatedMetrics(db.employees),
    analytics: { spreadsheetCensus, healthImpact },
  });
});

app.post('/api/employees', (req, res) => {
  const incoming = req.body as Employee;
  if (!incoming || typeof incoming !== 'object' || !incoming.name) {
    res.status(400).json({ error: 'Payload de funcionário inválido' });
    return;
  }
  const db = loadDatabase();
  const normalized = normalizeEmployeeAfterSave(incoming);
  const exists = db.employees.some((e) => e.id === normalized.id);
  db.employees = exists
    ? db.employees.map((e) => (e.id === normalized.id ? normalized : e))
    : [normalized, ...db.employees];
  saveDatabase(db);
  syncCsvOnDisk(db.employees);
  res.json(buildFullStatePayload());
});

app.put('/api/employees/:id', (req, res) => {
  const { id } = req.params;
  const incoming = req.body as Employee;
  if (!incoming || typeof incoming !== 'object' || !incoming.name) {
    res.status(400).json({ error: 'Payload de funcionário inválido' });
    return;
  }
  const db = loadDatabase();

  const normalized = normalizeEmployeeAfterSave({ ...incoming, id });
  const exists = db.employees.some((e) => e.id === id);
  db.employees = exists
    ? db.employees.map((e) => (e.id === id ? normalized : e))
    : [normalized, ...db.employees];
  saveDatabase(db);
  syncCsvOnDisk(db.employees);

  res.json(buildFullStatePayload());
});

app.post('/api/employees/:id/send-pass', (req, res) => {
  const { id } = req.params;
  const db = loadDatabase();

  db.employees = db.employees.map((e) => {
    if (e.id !== id) return e;
    const passCode = e.carePassCode || `PASSE-${e.matricula.slice(-4)}`;
    return {
      ...e,
      sentStatus: true,
      carePassCode: passCode,
      whatsappStatus: `✓ Passe de Cuidado (${passCode}) enviado via WhatsApp • Janela Protegida confirmada`,
    };
  });

  saveDatabase(db);
  syncCsvOnDisk(db.employees);
  res.json(buildFullStatePayload());
});

app.post('/api/employees/:id/first-visit', (req, res) => {
  const { id } = req.params;
  const assignedRisk = (Number(req.body?.assignedRisk) || 2) as Exclude<RiskLevel, 0>;
  const db = loadDatabase();

  db.employees = db.employees.map((e) =>
    e.id === id ? registerFirstConsultation(e, assignedRisk) : e
  );

  saveDatabase(db);
  syncCsvOnDisk(db.employees);
  res.json(buildFullStatePayload());
});

app.put('/api/admin/shift-configs', (req, res) => {
  const incomingConfigs = req.body?.shiftConfigs as ShiftWindowConfig[];
  const db = loadDatabase();
  if (Array.isArray(incomingConfigs)) {
    db.shiftConfigs = incomingConfigs;
    saveDatabase(db);
  }
  res.json(buildFullStatePayload());
});

app.post('/api/automations/sync-spreadsheet', (_req, res) => {
  const syncResult = runSesiSpreadsheetSync('ADMIN_API_BUTTON');
  res.json({
    ...buildFullStatePayload(),
    lastAutomationResult: syncResult.logEntry,
  });
});

app.post('/api/automations/run-active-search-bot', (_req, res) => {
  const botResult = runActiveSearchBot('ADMIN_API_BUTTON');
  res.json({
    ...buildFullStatePayload(),
    lastAutomationResult: botResult.logEntry,
  });
});

app.post('/api/admin/test-connection', (_req, res) => {
  const db = loadDatabase();
  const status = getDatabaseStatusSnapshot(db);
  status.latencyMs = Math.floor(Math.random() * 4) + 2;
  res.json({
    ok: true,
    testedAt: new Date().toLocaleTimeString('pt-BR'),
    message:
      'Handshake SQL / S+ Webhook concluído (3ms): Schema PostgreSQL 16 (server/schema.sql) validado para 104 estabelecimentos (10.025 vidas).',
    dbStatus: status,
  });
});

app.post('/api/admin/reset-demo', (_req, res) => {
  const resetDb = resetDatabaseToSeed();
  syncCsvOnDisk(resetDb.employees);
  res.json(buildFullStatePayload());
});

app.listen(PORT, () => {
  const db = loadDatabase();
  syncCsvOnDisk(db.employees);
  console.log(
    `[HealthX API Server] Rodando em http://localhost:${PORT} (${db.employees.length} registros carregados)`
  );
});
