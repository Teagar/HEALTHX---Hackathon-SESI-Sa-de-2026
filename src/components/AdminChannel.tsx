import React, { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity,
  BarChart3,
  Bot,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Database,
  Download,
  Factory,
  Info,
  Loader2,
  Plug,
  RefreshCw,
  Stethoscope,
  Users,
} from 'lucide-react';
import type {
  AutomationLogEntry,
  DatabaseConnectionStatus,
  Employee,
} from '../types';
import {
  getDefaultDatabaseStatus,
  getPowerBiAnalyticsPayload,
} from '../queueService';
import { buildApsSesiXlsxBytes } from '../xlsxWorkbookService';

export interface AdminChannelProps {
  employees: Employee[];
  automationLogs: AutomationLogEntry[];
  dbStatus?: DatabaseConnectionStatus | null;
  onRunSpreadsheetSync: () => void | Promise<void>;
  onRunActiveSearchBot: () => void | Promise<void>;
  onTestDbConnection: () => void | Promise<void>;
  /** O reset da demonstração fica na barra superior; mantido por compatibilidade. */
  onResetDemo?: () => void;
}

type Section = 'BI' | 'AUTOMATIONS' | 'INFRA';
type RunningAction = 'sync' | 'bot' | 'connectors' | null;

/** Nome legível de cada rotina registrada no histórico. */
const SCRIPT_LABELS: Record<string, string> = {
  'syncSesiSpreadsheet.ts': 'Sincronização de agendas e prazos',
  'activeSearchCron.ts': 'Busca ativa e Passes de Cuidado',
};

const CARD = 'rounded-2xl border border-[#EAECF0] bg-white shadow-xs';

export const AdminChannel: React.FC<AdminChannelProps> = ({
  employees,
  automationLogs,
  dbStatus,
  onRunSpreadsheetSync,
  onRunActiveSearchBot,
  onTestDbConnection,
}) => {
  const [activeSection, setActiveSection] = useState<Section>('BI');
  const [running, setRunning] = useState<RunningAction>(null);

  const analytics = useMemo(() => getPowerBiAnalyticsPayload(employees), [employees]);
  const effectiveDbStatus = useMemo(
    () => dbStatus ?? getDefaultDatabaseStatus(employees.length),
    [dbStatus, employees.length]
  );
  const census = analytics.spreadsheetCensus;
  const impact = analytics.healthImpact;

  const lastRunOf = (scriptName: string) =>
    automationLogs.find((log) => log.scriptName === scriptName);

  const run = async (action: Exclude<RunningAction, null>, fn: () => void | Promise<void>) => {
    if (running) return;
    setRunning(action);
    try {
      // Garante um retorno visível mesmo quando a resposta é instantânea.
      await Promise.all([fn(), new Promise((resolve) => setTimeout(resolve, 600))]);
    } finally {
      setRunning(null);
    }
  };

  const handleDownloadUpdatedXlsx = () => {
    const xlsxBytes = buildApsSesiXlsxBytes(employees);
    const blob = new Blob([xlsxBytes as unknown as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Coordenacao_do_Cuidado_APS_SESI.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatBrl = (val: number) =>
    val.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    });

  const pendingFirstVisitTotal = analytics.doctorPortfolios.reduce(
    (sum, doc) => sum + doc.pendingFirstVisitCount,
    0
  );

  const tabs: { id: Section; label: string; hint: string; icon: ReactNode; badge?: string }[] = [
    {
      id: 'BI',
      label: 'Visão geral',
      hint: 'Indicadores, impacto e carteira dos médicos',
      icon: <BarChart3 className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'AUTOMATIONS',
      label: 'Automações',
      hint: 'Sincronizar agendas e rodar a busca ativa',
      icon: <Bot className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'INFRA',
      label: 'Integrações',
      hint: 'Banco de dados e conectores externos',
      icon: <Plug className="h-4 w-4" aria-hidden="true" />,
      badge: String(effectiveDbStatus.scalabilityAdapters.length),
    },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#E4E8EE] p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5 pb-8">
        {/* Cabeçalho: o que é esta tela e a ação principal */}
        <header className={`${CARD} flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between`}>
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0E7A5F]">
              Coordenação regional · SESI Saúde Acolhe
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-[#101828]">
              Painel da Coordenação do Cuidado
            </h1>
            <p className="text-[12.5px] text-[#475467]">
              {census.activeWorkersInCsv} vidas ativas em {census.totalRowsInCsv} vínculos ·{' '}
              {pendingFirstVisitTotal} ainda sem 1ª consulta · atualizado em{' '}
              {effectiveDbStatus.lastPersistedAt}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadUpdatedXlsx}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0E7A5F] px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-sm hover:bg-[#0B5F4A]"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Baixar planilha atualizada (.xlsx)
          </button>
        </header>

        {/* Abas */}
        <nav
          role="tablist"
          aria-label="Seções do painel da coordenação"
          className={`${CARD} grid grid-cols-1 gap-1 p-1.5 sm:grid-cols-3`}
        >
          {tabs.map((tab) => {
            const active = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveSection(tab.id)}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left ${
                  active
                    ? 'bg-[#ECF8F3] ring-1 ring-[#C7EADC]'
                    : 'hover:bg-[#F2F4F7]'
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    active ? 'bg-[#0E7A5F] text-white' : 'bg-[#F2F4F7] text-[#475467]'
                  }`}
                >
                  {tab.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`flex items-center gap-2 text-[13px] font-semibold ${
                      active ? 'text-[#0B4A3B]' : 'text-[#101828]'
                    }`}
                  >
                    {tab.label}
                    {tab.badge && (
                      <span
                        className={`rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums ${
                          active ? 'bg-white text-[#0E7A5F]' : 'bg-[#EAECF0] text-[#475467]'
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[11px] text-[#475467]">{tab.hint}</span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* ABA 1: VISÃO GERAL */}
        {activeSection === 'BI' && (
          <div role="tabpanel" className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                icon={<Users className="h-4 w-4" aria-hidden="true" />}
                label="Trabalhadores na base"
                value={String(census.totalRowsInCsv)}
                detail={`${census.activeWorkersInCsv} ativos · ${census.inactiveWorkersInCsv} inativos`}
              />
              <KpiCard
                icon={<Activity className="h-4 w-4" aria-hidden="true" />}
                label="Idade média"
                value={`${census.averageAge}`}
                unit="anos"
                detail={`${census.maleCount} homens · ${census.femaleCount} mulheres`}
              />
              <KpiCard
                icon={<Stethoscope className="h-4 w-4" aria-hidden="true" />}
                label="Com equipe multiprofissional"
                value={`${census.multiTeamCarePercent}%`}
                detail="Medicina, Enfermagem, Psicologia e Nutrição"
                progress={census.multiTeamCarePercent}
              />
              <KpiCard
                highlight
                icon={<Factory className="h-4 w-4" aria-hidden="true" />}
                label="Horas de produção preservadas"
                value={`${impact.productiveHoursPreserved}h`}
                unit="por ano"
                detail={`${Math.round(impact.productiveHoursPreserved / 8)} turnos · ${impact.accompaniedLivesScope} de ${impact.activeLivesScope} vidas acompanhadas`}
              />
            </div>

            <section className={`${CARD} p-5 sm:p-6`}>
              <SectionTitle
                title="Impacto da coordenação do cuidado"
                subtitle={`Calculado sobre ${impact.activeLivesScope} trabalhadores ativos, ${impact.accompaniedLivesScope} com risco avaliado e ${impact.recoveredConsultationsCount} agendamentos sincronizados.`}
              />
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <ImpactCard
                  label="Horas preservadas no turno"
                  value={`${impact.productiveHoursPreserved}h/ano`}
                  money={`${formatBrl(impact.productiveHoursValueBrl)} em produção`}
                  text="Consultas marcadas na janela protegida do turno evitam a saída externa sem hora marcada."
                  source={impact.methodologySources[0]?.officialSource}
                />
                <ImpactCard
                  label="Encaminhamentos externos evitados"
                  value={`${impact.emergencyVisitsAvoided}`}
                  money="resolutividade APS de 94%"
                  text="A equipe de referência resolve a maior parte das queixas na própria unidade, sem pronto-socorro."
                  source={impact.methodologySources[1]?.officialSource}
                />
                <ImpactCard
                  label="Dias de absenteísmo evitados"
                  value={`${impact.absenteeismDaysAvoided} dias/ano`}
                  money={`${formatBrl(impact.absenteeismSavingsBrl)} em horas de planta`}
                  text="Retornos no prazo do protocolo de risco reduzem afastamentos agudos no chão de fábrica."
                  source={impact.methodologySources[2]?.officialSource}
                />
              </div>
            </section>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <section className={`${CARD} p-5`}>
                <SectionTitle
                  title="Carteira por médico de referência"
                  subtitle="Quantos já estão em acompanhamento e quantos ainda esperam a 1ª consulta"
                />
                <ul className="mt-4 space-y-3">
                  {analytics.doctorPortfolios.map((doc) => {
                    const pct = doc.activeAssigned
                      ? Math.round((doc.accompaniedCount / doc.activeAssigned) * 100)
                      : 0;
                    return (
                      <li key={doc.doctorName} className="rounded-xl border border-[#EAECF0] bg-[#F9FAFB] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[12.5px] font-semibold text-[#101828]">
                              {doc.doctorName}
                            </p>
                            <p className="text-[11px] text-[#475467]">
                              {doc.activeAssigned} ativos · {doc.accompaniedCount} em acompanhamento
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-lg border px-2 py-1 text-[11px] font-semibold ${
                              doc.pendingFirstVisitCount > 0
                                ? 'border-[#F5DFB8] bg-[#FDF7EC] text-[#C26D27]'
                                : 'border-[#C7EADC] bg-[#ECF8F3] text-[#0E7A5F]'
                            }`}
                          >
                            {doc.pendingFirstVisitCount > 0
                              ? `${doc.pendingFirstVisitCount} sem 1ª consulta`
                              : 'Todos acolhidos'}
                          </span>
                        </div>
                        <div
                          className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#EAECF0]"
                          role="progressbar"
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${pct}% da carteira ativa em acompanhamento`}
                        >
                          <div className="h-full rounded-full bg-[#0E7A5F]" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className={`${CARD} p-5`}>
                <SectionTitle
                  title="Linhas de cuidado mais frequentes"
                  subtitle="% dos trabalhadores em cada linha e quanto é resolvido na própria APS"
                />
                <ul className="mt-4 space-y-3.5">
                  {analytics.careLinesPrevalence.map((item) => (
                    <li key={item.lineName}>
                      <div className="flex items-baseline justify-between gap-3 text-[12px]">
                        <span className="font-medium text-[#101828]">{item.lineName}</span>
                        <span className="shrink-0 font-semibold tabular-nums text-[#101828]">
                          {item.affectedPercent}%
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#F2F4F7]">
                        <div
                          className="h-full rounded-full bg-[#0E7A5F]"
                          style={{ width: `${item.affectedPercent}%` }}
                        />
                      </div>
                      <p className="mt-0.5 text-[10.5px] text-[#475467]">
                        {item.resolvedInApsPercent}% resolvido na APS
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        )}

        {/* ABA 2: AUTOMAÇÕES */}
        {activeSection === 'AUTOMATIONS' && (
          <div role="tabpanel" className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ActionCard
                icon={<CalendarCheck className="h-5 w-5" aria-hidden="true" />}
                title="Sincronizar agendas e prazos"
                description="Atualiza a base com a planilha oficial e leva consultas e retornos para o S+ e o Microsoft Teams."
                steps={[
                  'Lê a planilha de 32 colunas e separa ativos e inativos',
                  'Recalcula a próxima consulta pelo protocolo de risco',
                  'Atualiza as agendas do S+ e do Teams e gera a planilha',
                ]}
                lastRun={lastRunOf('syncSesiSpreadsheet.ts')}
                buttonLabel="Sincronizar agora"
                runningLabel="Sincronizando…"
                buttonIcon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
                running={running === 'sync'}
                disabled={running !== null}
                onRun={() => void run('sync', onRunSpreadsheetSync)}
              />
              <ActionCard
                icon={<Bot className="h-5 w-5" aria-hidden="true" />}
                title="Rodar busca ativa"
                description="Encontra quem precisa de contato agora e envia o Passe de Cuidado com horário na janela do turno."
                steps={[
                  'Seleciona risco 4 e 3 com retorno pendente',
                  'Inclui quem está há mais de 140 dias sem a 1ª consulta',
                  'Envia o link de acesso por WhatsApp/Teams, sem senha',
                ]}
                lastRun={lastRunOf('activeSearchCron.ts')}
                buttonLabel="Rodar busca ativa"
                runningLabel="Varrendo as filas…"
                buttonIcon={<Bot className="h-4 w-4" aria-hidden="true" />}
                running={running === 'bot'}
                disabled={running !== null}
                onRun={() => void run('bot', onRunActiveSearchBot)}
              />
            </div>

            <section className={`${CARD} p-5`}>
              <SectionTitle
                title="Histórico de execuções"
                subtitle="As mais recentes primeiro. As rotinas também rodam sozinhas no horário programado."
              />
              {automationLogs.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-[#E4E7EC] p-6 text-center text-[12px] text-[#475467]">
                  Nenhuma execução registrada ainda.
                </p>
              ) : (
                <ol className="mt-4 divide-y divide-[#F2F4F7]">
                  {automationLogs.map((log) => (
                    <li key={log.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#ECF8F3] text-[#0E7A5F]">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                          <p className="text-[12.5px] font-semibold text-[#101828]">
                            {SCRIPT_LABELS[log.scriptName] ?? log.scriptName}
                            <span className="ml-2 font-mono text-[10.5px] font-normal text-[#98A2B3]">
                              {log.scriptName}
                            </span>
                          </p>
                          <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-[#475467]">
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            {log.executedAt}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[12px] leading-relaxed text-[#475467]">
                          {log.summaryMessage}
                        </p>
                        <p className="mt-1 text-[11px] font-medium text-[#0E7A5F]">
                          {log.rowsUpdatedOrImported} registros atualizados
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}

        {/* ABA 3: INTEGRAÇÕES */}
        {activeSection === 'INFRA' && (
          <div role="tabpanel" className="space-y-5">
            <section className={`${CARD} p-5`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <SectionTitle
                  title="Banco de dados e conectores"
                  subtitle={`${effectiveDbStatus.totalEmployeesPersisted} registros gravados · resposta em ${effectiveDbStatus.latencyMs} ms · última gravação em ${effectiveDbStatus.lastPersistedAt}`}
                />
                <button
                  type="button"
                  onClick={() => void run('connectors', onTestDbConnection)}
                  disabled={running !== null}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#0E7A5F] bg-white px-3.5 py-2 text-[12px] font-semibold text-[#0E7A5F] hover:bg-[#ECF8F3] disabled:cursor-wait disabled:opacity-70"
                >
                  {running === 'connectors' ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  )}
                  {running === 'connectors' ? 'Testando…' : 'Testar conexões'}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {effectiveDbStatus.scalabilityAdapters.map((adapter) => {
                  const active = adapter.status === 'ACTIVE';
                  return (
                    <article key={adapter.name} className="rounded-xl border border-[#EAECF0] bg-[#F9FAFB] p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#475467] ring-1 ring-[#EAECF0]">
                            <Database className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <p className="text-[12.5px] font-semibold text-[#101828]">{adapter.name}</p>
                        </div>
                        <span
                          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                            active ? 'bg-[#ECF8F3] text-[#0E7A5F]' : 'bg-[#EEF2F8] text-[#2F5D9E]'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-[#0E7A5F]' : 'bg-[#2F5D9E]'}`}
                          />
                          {active ? 'Ativo (simulado)' : 'Pronto para ligar'}
                        </span>
                      </div>
                      <p className="mt-2 text-[11.5px] text-[#475467]">{adapter.technology}</p>
                      <code className="mt-2 block truncate rounded-md bg-white px-2 py-1 font-mono text-[10.5px] text-[#344054] ring-1 ring-[#EAECF0]" title={adapter.endpointPreview}>
                        {adapter.endpointPreview}
                      </code>
                      <p className="mt-2 text-[11px] text-[#475467]">
                        <span className="font-medium text-[#344054]">Para que serve:</span>{' '}
                        {adapter.capacityTarget}
                      </p>
                    </article>
                  );
                })}
              </div>

              <p className="mt-4 flex items-start gap-2 rounded-xl bg-[#F2F4F7] px-3 py-2.5 text-[11.5px] text-[#475467]">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Na demonstração os conectores são simulados e os dados ficam num banco local. O
                esquema para produção (PostgreSQL 16, com a trava LGPD N ≥ 5) está em{' '}
                <code className="font-mono">server/schema.sql</code>.
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="min-w-0">
      <h2 className="text-[14px] font-semibold tracking-tight text-[#101828]">{title}</h2>
      {subtitle && <p className="mt-0.5 text-[12px] text-[#475467]">{subtitle}</p>}
    </div>
  );
}

interface KpiCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  unit?: string;
  detail: string;
  progress?: number;
  highlight?: boolean;
}

function KpiCard({ icon, label, value, unit, detail, progress, highlight }: KpiCardProps) {
  return (
    <div
      className={`rounded-2xl p-5 shadow-xs ${
        highlight ? 'bg-[#0E7A5F] text-white' : 'border border-[#EAECF0] bg-white'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${
            highlight ? 'bg-white/15 text-white' : 'bg-[#ECF8F3] text-[#0E7A5F]'
          }`}
        >
          {icon}
        </span>
        <span className={`text-[12px] font-medium ${highlight ? 'text-[#D5EDE2]' : 'text-[#475467]'}`}>
          {label}
        </span>
      </div>
      <p
        className={`mt-3 text-[26px] font-semibold leading-none tracking-tight tabular-nums ${
          highlight ? 'text-white' : 'text-[#101828]'
        }`}
      >
        {value}
        {unit && (
          <span className={`ml-1 text-[12px] font-normal ${highlight ? 'text-[#D5EDE2]' : 'text-[#475467]'}`}>
            {unit}
          </span>
        )}
      </p>
      {progress !== undefined && (
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#EAECF0]">
          <div className="h-full rounded-full bg-[#0E7A5F]" style={{ width: `${progress}%` }} />
        </div>
      )}
      <p className={`mt-2 text-[11.5px] ${highlight ? 'text-[#E3F4EC]' : 'text-[#475467]'}`}>{detail}</p>
    </div>
  );
}

interface ImpactCardProps {
  label: string;
  value: string;
  money: string;
  text: string;
  source?: string;
}

function ImpactCard({ label, value, money, text, source }: ImpactCardProps) {
  return (
    <div className="flex flex-col rounded-xl border border-[#EAECF0] bg-[#F9FAFB] p-4">
      <p className="text-[12px] font-medium text-[#475467]">{label}</p>
      <p className="mt-1.5 text-[22px] font-semibold leading-tight tracking-tight tabular-nums text-[#101828]">
        {value}
      </p>
      <p className="text-[12px] font-semibold text-[#0E7A5F]">{money}</p>
      <p className="mt-2 flex-1 text-[11.5px] leading-relaxed text-[#475467]">{text}</p>
      {source && (
        <p className="mt-3 border-t border-[#EAECF0] pt-2 text-[10.5px] text-[#64748B]">
          Fonte: {source}
        </p>
      )}
    </div>
  );
}

interface ActionCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  steps: string[];
  lastRun?: AutomationLogEntry;
  buttonLabel: string;
  runningLabel: string;
  buttonIcon: ReactNode;
  running: boolean;
  disabled: boolean;
  onRun: () => void;
}

function ActionCard({
  icon,
  title,
  description,
  steps,
  lastRun,
  buttonLabel,
  runningLabel,
  buttonIcon,
  running,
  disabled,
  onRun,
}: ActionCardProps) {
  return (
    <section className={`${CARD} flex flex-col p-5`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ECF8F3] text-[#0E7A5F]">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold tracking-tight text-[#101828]">{title}</h2>
          <p className="mt-0.5 text-[12px] leading-relaxed text-[#475467]">{description}</p>
        </div>
      </div>

      <ol className="mt-4 space-y-1.5">
        {steps.map((step, idx) => (
          <li key={step} className="flex items-start gap-2 text-[12px] text-[#344054]">
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#F2F4F7] text-[10px] font-semibold text-[#475467]">
              {idx + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      <div className="mt-4 flex-1" />

      <p className="mb-3 flex items-center gap-1.5 text-[11.5px] text-[#475467]">
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        {lastRun ? (
          <>
            Última execução: <span className="font-medium text-[#344054]">{lastRun.executedAt}</span>
            <span className="text-[#98A2B3]">·</span>
            {lastRun.rowsUpdatedOrImported} registros
          </>
        ) : (
          'Ainda não executada'
        )}
      </p>

      <button
        type="button"
        onClick={onRun}
        disabled={disabled}
        aria-busy={running}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0E7A5F] px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-sm hover:bg-[#0B5F4A] disabled:cursor-wait disabled:opacity-70"
      >
        {running ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : buttonIcon}
        {running ? runningLabel : buttonLabel}
      </button>
    </section>
  );
}

export default AdminChannel;
