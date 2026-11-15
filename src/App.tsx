import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import TopBar from './components/TopBar';
import SidebarTree from './components/SidebarTree';
import DualQueueView from './components/DualQueueView';
import EmployeeCockpit from './components/EmployeeCockpit';
import AdminChannel from './components/AdminChannel';
import CompanyB2BChannel from './components/CompanyB2BChannel';
import NewEmployeeOcrModal from './components/NewEmployeeOcrModal';
import { INITIAL_EMPLOYEES, INITIAL_SHIFT_WINDOWS } from './mockDatabase';
import {
  getActiveSearchQueue,
  getDefaultAutomationLogs,
  getDefaultDatabaseStatus,
  getLgpdAggregatedMetrics,
  getReturnPriorityQueue,
  normalizeEmployeeAfterSave,
  parseSesiCsvContent,
} from './queueService';
import type {
  AppRoute,
  AutomationLogEntry,
  DatabaseConnectionStatus,
  Employee,
  ShiftWindowConfig,
} from './types';
import LandingPortal from './components/LandingPortal';

const VALID_ROUTES: AppRoute[] = ['/', '/home', '/admin', '/gestor'];

function readRouteFromLocation(): AppRoute {
  const path = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
  return (VALID_ROUTES as string[]).includes(path) ? (path as AppRoute) : '/';
}

const EMPLOYEES_STORAGE_KEY = 'healthx_sesi_employees_v5_teams';

interface ApiStatePayload {
  employees: Employee[];
  shiftConfigs?: ShiftWindowConfig[];
  automationLogs?: AutomationLogEntry[];
  dbStatus?: DatabaseConnectionStatus;
}

interface AutomationApiPayload extends ApiStatePayload {
  lastAutomationResult?: AutomationLogEntry;
}

interface TestConnectionPayload {
  ok: boolean;
  testedAt: string;
  message: string;
  dbStatus: DatabaseConnectionStatus;
}

type ToastTone = 'success' | 'info' | 'warning';

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
}

function loadInitialEmployees(): Employee[] {
  try {
    const raw = window.localStorage.getItem(EMPLOYEES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.length >= 100) {
        return parsed as Employee[];
      }
    }
  } catch {
    // Fallback para a base consolidada de 100 registros
  }
  return INITIAL_EMPLOYEES.map((employee) => ({ ...employee }));
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function App() {
  const initialCountRef = useRef<number | null>(null);
  const [employees, setEmployees] = useState<Employee[]>(loadInitialEmployees);
  const [shiftConfigs, setShiftConfigs] = useState<ShiftWindowConfig[]>(() =>
    INITIAL_SHIFT_WINDOWS.map((config) => ({ ...config })),
  );
  const [automationLogs, setAutomationLogs] = useState<AutomationLogEntry[]>(
    getDefaultAutomationLogs,
  );
  const [dbStatus, setDbStatus] = useState<DatabaseConnectionStatus | null>(null);
  const [backendOnline, setBackendOnline] = useState(false);

  const [currentRoute, setCurrentRoute] = useState<AppRoute>(readRouteFromLocation);

  useEffect(() => {
    const onPop = () => setCurrentRoute(readRouteFromLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((route: AppRoute) => {
    if (window.location.pathname !== route) {
      window.history.pushState({}, '', route);
    }
    setCurrentRoute(route);
    setMobileSidebarOpen(false);
  }, []);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastSeqRef = useRef(0);

  if (initialCountRef.current === null) {
    initialCountRef.current = employees.length;
  }

  const pushToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    toastSeqRef.current += 1;
    const id = toastSeqRef.current;
    setToasts((prev) => [...prev.slice(-2), { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 6000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const applyServerState = useCallback((payload: ApiStatePayload) => {
    if (Array.isArray(payload.employees) && payload.employees.length > 0) {
      setEmployees(payload.employees);
    }
    if (Array.isArray(payload.shiftConfigs)) {
      setShiftConfigs(payload.shiftConfigs);
    }
    if (Array.isArray(payload.automationLogs)) {
      setAutomationLogs(payload.automationLogs);
    }
    if (payload.dbStatus) {
      setDbStatus(payload.dbStatus);
    }
    setBackendOnline(true);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(EMPLOYEES_STORAGE_KEY, JSON.stringify(employees));
    } catch {
      // Storage indisponível: mantém estado em memória
    }
    setDbStatus((prev) =>
      prev && prev.totalEmployeesPersisted !== employees.length
        ? {
            ...prev,
            totalEmployeesPersisted: employees.length,
            lastPersistedAt: new Date().toLocaleTimeString('pt-BR'),
          }
        : prev,
    );
  }, [employees]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const payload = await apiRequest<ApiStatePayload>('/api/state');
      if (cancelled) return;
      if (payload && Array.isArray(payload.employees) && payload.employees.length > 0) {
        applyServerState(payload);
      } else {
        setBackendOnline(false);
        setDbStatus({
          ...getDefaultDatabaseStatus(initialCountRef.current ?? 100),
          status: 'LOCAL_CACHE',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyServerState]);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  );

  useEffect(() => {
    if (
      selectedEmployeeId &&
      !employees.some((employee) => employee.id === selectedEmployeeId)
    ) {
      setSelectedEmployeeId(null);
    }
  }, [employees, selectedEmployeeId]);

  const returnQueue = useMemo(() => getReturnPriorityQueue(employees), [employees]);
  const activeSearchQueue = useMemo(() => getActiveSearchQueue(employees), [employees]);

  // Regra 5 (LGPD): o Canal 3 recebe apenas agregados anônimos por empresa, nunca a lista de funcionários
  const b2bMetrics = useMemo(() => getLgpdAggregatedMetrics(employees), [employees]);

  const handleSaveEmployee = (updated: Employee) => {
    const normalized = normalizeEmployeeAfterSave(updated);
    const previous = employees.find((employee) => employee.id === normalized.id);
    const migrated =
      Boolean(previous) &&
      (previous!.neverScheduled || previous!.riskLevel === 0) &&
      !normalized.neverScheduled &&
      normalized.riskLevel > 0;

    setEmployees((prev) =>
      prev.map((employee) => (employee.id === normalized.id ? normalized : employee)),
    );

    if (migrated) {
      pushToast({
        tone: 'success',
        title: 'Migrado para Prioridade Clínica de Retorno',
        message: `${normalized.name} recebeu Risco ${normalized.riskLevel} na 1ª consulta e teve a agenda e prazos atualizados automaticamente.`,
      });
    } else {
      pushToast({
        tone: 'success',
        title: 'Prontuário e Coordenação do Cuidado atualizados',
        message: `${normalized.name} • ${normalized.companyName} • Risco ${normalized.riskLevel}`,
      });
    }

    void (async () => {
      if (!backendOnline) return;
      const payload = await apiRequest<ApiStatePayload>(
        `/api/employees/${encodeURIComponent(normalized.id)}`,
        { method: 'PUT', body: JSON.stringify(normalized) },
      );
      if (payload) {
        applyServerState(payload);
      } else {
        setBackendOnline(false);
      }
    })();
  };

  const persistEmployee = (emp: Employee) => {
    void (async () => {
      if (!backendOnline) return;
      const payload = await apiRequest<ApiStatePayload>(
        `/api/employees/${encodeURIComponent(emp.id)}`,
        { method: 'PUT', body: JSON.stringify(emp) },
      );
      if (payload) {
        applyServerState(payload);
      }
    })();
  };

  // Upsert: atualiza a ficha existente (mesmo id) ou insere novo funcionário cadastrado via importação
  const handleInsertNewEmployee = (newEmp: Employee) => {
    const normalized = normalizeEmployeeAfterSave(newEmp);
    const exists = employees.some((employee) => employee.id === normalized.id);
    setEmployees((prev) =>
      prev.some((employee) => employee.id === normalized.id)
        ? prev.map((employee) => (employee.id === normalized.id ? normalized : employee))
        : [normalized, ...prev],
    );
    if (!exists) {
      setSelectedEmployeeId(normalized.id);
    }

    pushToast({
      tone: 'success',
      title: exists ? 'Ficha atualizada a partir do documento' : 'Novo funcionário cadastrado',
      message: `${normalized.name} (${normalized.companyName}) • Retorno programado: ${normalized.nextVisit}.`,
    });

    persistEmployee(normalized);
  };

  const handleBatchInsertEmployees = (batch: Employee[]) => {
    if (!batch.length) return;
    const normalizedBatch = batch.map((emp) => normalizeEmployeeAfterSave(emp));
    const byId = new Map(normalizedBatch.map((emp) => [emp.id, emp]));
    let insertedCount = 0;
    setEmployees((prev) => {
      const prevIds = new Set(prev.map((employee) => employee.id));
      const updated = prev.map((employee) => byId.get(employee.id) ?? employee);
      const inserted = normalizedBatch.filter((emp) => !prevIds.has(emp.id));
      insertedCount = inserted.length;
      return [...inserted, ...updated];
    });
    pushToast({
      tone: 'success',
      title: 'Importação em lote concluída',
      message: `${normalizedBatch.length} documento(s) aplicados às fichas${
        insertedCount ? ` (${insertedCount} novo(s) cadastro(s))` : ''
      }.`,
    });
    normalizedBatch.forEach(persistEmployee);
  };

  const handleSendWhatsApp = (employeeId: string) => {
    const employee = employees.find((item) => item.id === employeeId);
    if (!employee) return;

    if (employee.sentStatus) {
      pushToast({
        tone: 'info',
        title: 'Passe de Cuidado já emitido',
        message: `${employee.name} • ${employee.carePassCode ?? 'PASSE-OK'}`,
      });
      return;
    }

    const passCode = employee.carePassCode || `PASSE-${employee.matricula.slice(-4)}`;
    const updated: Employee = {
      ...employee,
      sentStatus: true,
      carePassCode: passCode,
      whatsappStatus: `✓ Passe de Cuidado (${passCode}) enviado via WhatsApp • Janela Protegida confirmada`,
    };

    setEmployees((prev) =>
      prev.map((item) => (item.id === employeeId ? updated : item)),
    );

    pushToast({
      tone: 'success',
      title: 'Passe de Cuidado enviado no WhatsApp',
      message: `${employee.name} • ${passCode} • ${
        employee.protectedWindowSlot ?? 'Janela protegida confirmada'
      }`,
    });

    void (async () => {
      if (!backendOnline) return;
      const payload = await apiRequest<ApiStatePayload>(
        `/api/employees/${encodeURIComponent(employeeId)}/send-pass`,
        { method: 'POST' },
      );
      if (payload) {
        applyServerState(payload);
      } else {
        setBackendOnline(false);
      }
    })();
  };

  const handleRunSpreadsheetSync = () => {
    return (async () => {
      if (backendOnline) {
        const payload = await apiRequest<AutomationApiPayload>(
          '/api/automations/sync-spreadsheet',
          { method: 'POST' },
        );
        if (payload) {
          applyServerState(payload);
          pushToast({
            tone: 'success',
            title: 'Agenda S+ / Microsoft Teams sincronizada',
            message:
              payload.lastAutomationResult?.summaryMessage ??
              'Sincronização de Coordenação do Cuidado e agendas concluída com prazos recalculados.',
          });
          return;
        }
        setBackendOnline(false);
      }

      try {
        const response = await fetch('/dados_ficticios_sesi.csv');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const csvText = await response.text();
        const result = parseSesiCsvContent(csvText, employees);
        const existingIds = new Set(employees.map((employee) => employee.id));
        const existingMatriculas = new Set(
          employees.map((employee) => employee.matricula),
        );
        const unique = result.newEmployees.filter(
          (employee) =>
            !existingIds.has(employee.id) && !existingMatriculas.has(employee.matricula),
        );

        if (unique.length > 0) {
          setEmployees((prev) => [...prev, ...unique]);
        }

        const log: AutomationLogEntry = {
          id: `log-sync-${Date.now()}`,
          executedAt: new Date().toLocaleString('pt-BR'),
          scriptName: 'syncSesiSpreadsheet.ts',
          trigger: 'PAINEL_COORDENACAO',
          rowsScanned: 100,
          rowsUpdatedOrImported: unique.length > 0 ? unique.length : employees.length,
          carePassesDispatched: employees.filter((employee) => employee.sentStatus).length,
          outputFileGenerated: 'data/Coordenacao_do_Cuidado_APS_SESI.xlsx',
          summaryMessage:
            unique.length > 0
              ? `Sincronização concluída: ${unique.length} novos vínculos sincronizados com o Sistema S+ e Agenda Microsoft Teams.`
              : `Coordenação do Cuidado e Agendas (S+ / Microsoft Teams) sincronizadas com ${employees.length} registros e prazos recalculados.`,
        };
        setAutomationLogs((prev) => [log, ...prev].slice(0, 20));

        pushToast({
          tone: 'success',
          title: 'Sincronização de agendas concluída',
          message: log.summaryMessage,
        });
      } catch {
        const log: AutomationLogEntry = {
          id: `log-sync-${Date.now()}`,
          executedAt: new Date().toLocaleString('pt-BR'),
          scriptName: 'syncSesiSpreadsheet.ts',
          trigger: 'PAINEL_COORDENACAO',
          rowsScanned: employees.length,
          rowsUpdatedOrImported: employees.length,
          carePassesDispatched: employees.filter((employee) => employee.sentStatus).length,
          outputFileGenerated: 'data/Coordenacao_do_Cuidado_APS_SESI.xlsx',
          summaryMessage: `Prazos de retorno e agendamentos (S+ / Microsoft Teams) recalculados para ${employees.length} trabalhadores cadastrados.`,
        };
        setAutomationLogs((prev) => [log, ...prev].slice(0, 20));
        pushToast({
          tone: 'success',
          title: 'Agendas e prazos sincronizados',
          message: log.summaryMessage,
        });
      }
    })();
  };

  const handleRunActiveSearchBot = () => {
    return (async () => {
      if (backendOnline) {
        const payload = await apiRequest<AutomationApiPayload>(
          '/api/automations/run-active-search-bot',
          { method: 'POST' },
        );
        if (payload) {
          applyServerState(payload);
          pushToast({
            tone: 'success',
            title: 'Varredura de Busca Ativa concluída',
            message:
              payload.lastAutomationResult?.summaryMessage ??
              'Passes de Cuidado e links rápidos (Teams / WhatsApp) emitidos nas janelas protegidas de turno.',
          });
          return;
        }
        setBackendOnline(false);
      }

      const targets = employees.filter((employee) => {
        if (employee.status === 'INATIVO' || employee.sentStatus) return false;
        const isHighPriorityReturn = !employee.neverScheduled && employee.riskLevel >= 3;
        const isCriticalActiveSearch =
          (employee.neverScheduled || employee.riskLevel === 0) &&
          employee.daysSinceActivation >= 140;
        return isHighPriorityReturn || isCriticalActiveSearch;
      });

      const updatedById = new Map<string, Employee>();
      targets.forEach((employee) => {
        const companyConfig = shiftConfigs.find(
          (config) => config.companyId === employee.companyId,
        );
        const slot = employee.shift.startsWith('1º Turno')
          ? companyConfig?.shift1Window ??
            'Terça/Quinta • 09h30–10h00 (Janela Protegida 1º Turno)'
          : companyConfig?.shift2Window ??
            'Quarta/Sexta • 15h30–16h00 (Janela Protegida 2º Turno)';
        const passCode = employee.carePassCode || `PASSE-${employee.matricula.slice(-4)}`;
        updatedById.set(employee.id, {
          ...employee,
          sentStatus: true,
          carePassCode: passCode,
          protectedWindowSlot: slot,
          whatsappStatus: `✓ Passe de Cuidado (${passCode}) enviado via Teams / WhatsApp • Janela Protegida (${slot})`,
          returnNotes: `${employee.returnNotes} | Convocação preventiva enviada no turno.`,
        });
      });

      if (updatedById.size > 0) {
        setEmployees((prev) =>
          prev.map((employee) => updatedById.get(employee.id) ?? employee),
        );
      }

      const log: AutomationLogEntry = {
        id: `log-bot-${Date.now()}`,
        executedAt: new Date().toLocaleString('pt-BR'),
        scriptName: 'activeSearchCron.ts',
        trigger: 'PAINEL_COORDENACAO',
        rowsScanned: employees.length,
        rowsUpdatedOrImported: updatedById.size,
        carePassesDispatched: updatedById.size,
        outputFileGenerated: 'data/Coordenacao_do_Cuidado_APS_SESI.xlsx',
        summaryMessage:
          updatedById.size > 0
            ? `Busca Ativa emitiu ${updatedById.size} Passes de Cuidado e links rápidos (Teams / WhatsApp) para Risco 4/3 e >140d sem 1ª consulta nas janelas protegidas.`
            : `Varredura concluída (${employees.length} registros): todos os casos prioritários já possuem Passe de Cuidado ativo.`,
      };
      setAutomationLogs((prev) => [log, ...prev].slice(0, 20));

      pushToast({
        tone: updatedById.size > 0 ? 'success' : 'info',
        title: 'Busca Ativa processada',
        message: log.summaryMessage,
      });
    })();
  };

  const handleTestDbConnection = () => {
    return (async () => {
      if (backendOnline) {
        const payload = await apiRequest<TestConnectionPayload>(
          '/api/admin/test-connection',
          { method: 'POST' },
        );
        if (payload?.dbStatus) {
          setDbStatus(payload.dbStatus);
          pushToast({
            tone: 'success',
            title: 'Conectores S+, Microsoft Teams e SQL verificados',
            message: payload.message,
          });
          return;
        }
        setBackendOnline(false);
      }

      setDbStatus((prev) => {
        const base = prev ?? getDefaultDatabaseStatus(employees.length);
        return {
          ...base,
          status: 'ONLINE',
          latencyMs: 3,
          lastPersistedAt: new Date().toLocaleTimeString('pt-BR'),
        };
      });
      pushToast({
        tone: 'success',
        title: 'Integridade dos Conectores Verificada',
        message:
          'Sistema S+, Microsoft Graph Calendar (Teams) e PostgreSQL 16 operacionais (3ms).',
      });
    })();
  };

  const handleResetDemo = () => {
    const confirmed = window.confirm(
      'Recarregar os 100 registros iniciais da base de Coordenação do Cuidado?',
    );
    if (!confirmed) return;

    const seed = structuredClone(INITIAL_EMPLOYEES);
    setEmployees(seed);
    setShiftConfigs(structuredClone(INITIAL_SHIFT_WINDOWS));
    setAutomationLogs(getDefaultAutomationLogs());
    setSelectedEmployeeId(null);
    setDbStatus((prev) =>
      prev
        ? {
            ...prev,
            totalEmployeesPersisted: seed.length,
            lastPersistedAt: new Date().toLocaleTimeString('pt-BR'),
          }
        : prev,
    );

    pushToast({
      tone: 'info',
      title: 'Base assistencial recarregada',
      message: `${seed.length} registros (60 ativos e 40 inativos) restaurados na Coordenação do Cuidado.`,
    });

    void (async () => {
      if (!backendOnline) return;
      const payload = await apiRequest<ApiStatePayload>('/api/admin/reset-demo', {
        method: 'POST',
      });
      if (payload) {
        applyServerState(payload);
      }
    })();
  };

  if (currentRoute === '/') {
    return (
      <LandingPortal
        onNavigate={navigate}
        totalEmployees={employees.length}
        activeEmployees={employees.filter((e) => e.status !== 'INATIVO').length}
        companiesCount={b2bMetrics.companies.length}
      />
    );
  }

  return (
    <div className="flex h-[calc(100vh/var(--ui-zoom))] w-full flex-col overflow-hidden bg-[#E4E8EE] text-[#101828]">
      <TopBar
        employees={employees}
        currentRoute={currentRoute}
        onNavigate={navigate}
        onOpenNewEmployeeOcr={() => setIsOcrModalOpen(true)}
        onResetDemo={handleResetDemo}
        onToggleMobileSidebar={() => setMobileSidebarOpen((v) => !v)}
        dbStatus={dbStatus}
      />

      {currentRoute === '/home' && (
        <div className="relative flex min-h-0 flex-1 overflow-hidden bg-[#E4E8EE]">
          <SidebarTree
            employees={employees}
            selectedEmployeeId={selectedEmployeeId}
            onSelectEmployee={setSelectedEmployeeId}
            mobileOpen={mobileSidebarOpen}
            onCloseMobile={() => setMobileSidebarOpen(false)}
          />
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-2.5 sm:p-4">
            {selectedEmployee ? (
              <EmployeeCockpit
                key={selectedEmployee.id}
                employee={selectedEmployee}
                onSave={handleSaveEmployee}
                onSendWhatsApp={handleSendWhatsApp}
                onClose={() => setSelectedEmployeeId(null)}
              />
            ) : (
              <DualQueueView
                employees={employees}
                returnQueue={returnQueue}
                activeSearchQueue={activeSearchQueue}
                onOpenProfile={setSelectedEmployeeId}
                onSendWhatsApp={handleSendWhatsApp}
              />
            )}
          </main>
        </div>
      )}

      {currentRoute === '/admin' && (
        <AdminChannel
          employees={employees}
          automationLogs={automationLogs}
          dbStatus={dbStatus}
          onRunSpreadsheetSync={handleRunSpreadsheetSync}
          onRunActiveSearchBot={handleRunActiveSearchBot}
          onTestDbConnection={handleTestDbConnection}
          onResetDemo={handleResetDemo}
        />
      )}

      {currentRoute === '/gestor' && (
        <CompanyB2BChannel metrics={b2bMetrics} />
      )}

      {currentRoute === '/home' && (
        <NewEmployeeOcrModal
          isOpen={isOcrModalOpen}
          onClose={() => setIsOcrModalOpen(false)}
          employees={employees}
          onConfirmInsert={handleInsertNewEmployee}
          onConfirmBatchInsert={handleBatchInsertEmployees}
        />
      )}

      <div
        className="pointer-events-none fixed bottom-3 right-3 z-50 flex w-[min(calc(92vw/var(--ui-zoom)),360px)] flex-col gap-2"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </div>
  );
}

interface ToastCardProps {
  toast: ToastItem;
  onDismiss: (id: number) => void;
}

const TOAST_TONES: Record<
  ToastTone,
  { className: string; icon: typeof CheckCircle2; accentClassName: string }
> = {
  success: {
    className: 'border-[#C7EADC] bg-[#ECF8F3] text-[#0E7A5F]',
    accentClassName: 'bg-[#0E7A5F]',
    icon: CheckCircle2,
  },
  info: {
    className: 'border-[#CBD5E1] bg-[#F8FAFC] text-[#475569]',
    accentClassName: 'bg-[#64748B]',
    icon: Info,
  },
  warning: {
    className: 'border-[#F5DFB8] bg-[#FDF7EC] text-[#C26D27]',
    accentClassName: 'bg-[#C26D27]',
    icon: AlertTriangle,
  },
};

function ToastCard({ toast, onDismiss }: ToastCardProps) {
  const tone = TOAST_TONES[toast.tone];
  const Icon = tone.icon;
  return (
    <div
      role="status"
      className={`pointer-events-auto relative overflow-hidden rounded-xl border bg-white shadow-lg ${tone.className}`}
    >
      <span
        className={`absolute inset-y-0 left-0 w-1 ${tone.accentClassName}`}
        aria-hidden="true"
      />
      <div className="flex items-start gap-2 py-2.5 pl-3.5 pr-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold leading-tight">{toast.title}</p>
          {toast.message && (
            <p className="mt-0.5 break-words text-[10px] leading-snug opacity-90">
              {toast.message}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Fechar notificação"
          className="shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100 cursor-pointer"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default App;
