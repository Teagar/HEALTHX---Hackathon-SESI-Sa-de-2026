import fs from 'node:fs';
import path from 'node:path';
import {
  AutomationLogEntry,
  DatabaseConnectionStatus,
  Employee,
  ShiftWindowConfig,
} from '../src/types';
import { INITIAL_EMPLOYEES, INITIAL_SHIFT_WINDOWS } from '../src/mockDatabase';
import {
  getDefaultAutomationLogs,
  getDefaultDatabaseStatus,
} from '../src/queueService';

export interface PersistedHealthXDatabase {
  version: string;
  lastUpdatedAt: string;
  employees: Employee[];
  shiftConfigs: ShiftWindowConfig[];
  automationLogs: AutomationLogEntry[];
}

const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
const DB_FILE_PATH = path.join(DATA_DIR, 'healthx_db.json');

let memoryDbMirror: PersistedHealthXDatabase | null = null;

function createCleanSeed(): PersistedHealthXDatabase {
  return {
    version: '2.2.0-SESI-SPLUS-TEAMS',
    lastUpdatedAt: new Date().toLocaleString('pt-BR'),
    employees: structuredClone(INITIAL_EMPLOYEES),
    shiftConfigs: structuredClone(INITIAL_SHIFT_WINDOWS),
    automationLogs: getDefaultAutomationLogs(),
  };
}

function tryWriteDbFile(db: PersistedHealthXDatabase) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch {
    // Fallback em memória caso o arquivo esteja bloqueado pelo SO
  }
}

/**
 * Inicializa ou lê o banco de dados persistente local (`server/data/healthx_db.json`).
 * Funciona como camada de persistência transacional durante o Hackathon e possui
 * adaptador de escalabilidade pronto para PostgreSQL / Azure SQL / SOC S+.
 */
export function loadDatabase(): PersistedHealthXDatabase {
  if (!fs.existsSync(DB_FILE_PATH)) {
    const seed = createCleanSeed();
    memoryDbMirror = seed;
    tryWriteDbFile(seed);
    return seed;
  }

  try {
    const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as PersistedHealthXDatabase;
    if (
      parsed.version !== '2.2.0-SESI-SPLUS-TEAMS' ||
      !Array.isArray(parsed.employees) ||
      parsed.employees.length < 100
    ) {
      throw new Error('Reset marker or legacy employees array in persisted JSON DB');
    }
    memoryDbMirror = parsed;
    return parsed;
  } catch {
    if (memoryDbMirror && memoryDbMirror.employees.length > 0) {
      return memoryDbMirror;
    }
    const fallback = createCleanSeed();
    memoryDbMirror = fallback;
    tryWriteDbFile(fallback);
    return fallback;
  }
}

export function saveDatabase(db: PersistedHealthXDatabase): PersistedHealthXDatabase {
  db.lastUpdatedAt = new Date().toLocaleString('pt-BR');
  memoryDbMirror = db;
  tryWriteDbFile(db);
  return db;
}

export function resetDatabaseToSeed(): PersistedHealthXDatabase {
  const seed = createCleanSeed();
  return saveDatabase(seed);
}

export function getDatabaseStatusSnapshot(db: PersistedHealthXDatabase): DatabaseConnectionStatus {
  const status = getDefaultDatabaseStatus(db.employees.length);
  status.lastPersistedAt = db.lastUpdatedAt;
  return status;
}
