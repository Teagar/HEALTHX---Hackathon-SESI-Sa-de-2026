import React, { useMemo, useState } from 'react';
import {
  CalendarCheck,
  Bot,
  Database,
  BarChart3,
  Download,
  RefreshCw,
  CheckCircle2,
  Users,
  Stethoscope,
  Activity,
  RotateCcw,
  Server,
  BookOpenCheck,
  Video,
  Smartphone,
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
  onRunSpreadsheetSync: () => void;
  onRunActiveSearchBot: () => void;
  onTestDbConnection: () => void;
  onResetDemo?: () => void;
}

export const AdminChannel: React.FC<AdminChannelProps> = ({
  employees,
  automationLogs,
  dbStatus,
  onRunSpreadsheetSync,
  onRunActiveSearchBot,
  onTestDbConnection,
  onResetDemo,
}) => {
  const [activeSection, setActiveSection] = useState<'BI' | 'AUTOMATIONS' | 'INFRA'>('BI');

  const analytics = useMemo(() => getPowerBiAnalyticsPayload(employees), [employees]);
  const effectiveDbStatus = useMemo(
    () => dbStatus ?? getDefaultDatabaseStatus(employees.length),
    [dbStatus, employees.length]
  );

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

  return (
    <div className="h-full overflow-y-auto bg-[#F5F3EE] p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6 pb-8">
        {/* Cabeçalho do Painel de Inteligência & Agenda Integrada */}
        <div className="bg-white rounded-2xl border border-[#E5E0D5] p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#1F564C] bg-[#EEF6F3] px-2.5 py-0.5 rounded-full border border-[#C6E4DA]">
              Coordenação Regional SESI Saúde Acolhe • Censo de {analytics.spreadsheetCensus.totalRowsInCsv} Trabalhadores
            </span>
            <h1 className="text-lg sm:text-xl font-bold text-[#1E2926] tracking-tight">
              Coordenação do Cuidado, Agenda Integrada (S+ / Teams) e Inteligência Epidemiológica
            </h1>
            <p className="text-xs text-[#5A6561]">
              Atualização automática de prazos clínicos, sincronização com o Sistema de Agendamento SESI (S+) e Agenda Microsoft Teams, e indicadores assistenciais.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadUpdatedXlsx}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#1F564C] text-white hover:bg-[#163F37] transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar Relatório de Coordenação (.XLSX)
            </button>
            {onResetDemo && (
              <button
                type="button"
                onClick={onResetDemo}
                title="Restaurar estado inicial da base assistencial de 100 registros"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-[#FAF9F6] text-[#5A6561] border border-[#D5CFC3] hover:text-[#1E2926] hover:bg-[#EFECE6] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Recarregar Base Assistencial (100 Vidas)
              </button>
            )}
          </div>
        </div>

        {/* Navegação enxuta do Canal 2 */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSection('BI')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeSection === 'BI'
                ? 'bg-[#1F564C] text-white shadow-xs'
                : 'bg-white text-[#5A6561] border border-[#E5E0D5] hover:text-[#1E2926]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Painel Epidemiológico & Economia em Saúde
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('AUTOMATIONS')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeSection === 'AUTOMATIONS'
                ? 'bg-[#1F564C] text-white shadow-xs'
                : 'bg-white text-[#5A6561] border border-[#E5E0D5] hover:text-[#1E2926]'
            }`}
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            Integração de Agenda (S+ / Teams) e Busca Ativa
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('INFRA')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeSection === 'INFRA'
                ? 'bg-[#1F564C] text-white shadow-xs'
                : 'bg-white text-[#5A6561] border border-[#E5E0D5] hover:text-[#1E2926]'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            Banco de Dados e Conectores (S+, Microsoft Teams & SQL)
          </button>
        </div>

        {/* SEÇÃO 1: PAINEL EPIDEMIOLÓGICO & IMPACTO ASSISTENCIAL */}
        {activeSection === 'BI' && (
          <div className="space-y-6">
            {/* Cards Superiores do Censo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-[#E5E0D5] p-5 shadow-xs">
                <div className="flex items-center justify-between text-[#5A6561] mb-1.5">
                  <span className="text-xs font-medium">Censo Consolidado SESI</span>
                  <Users className="w-4 h-4 text-[#1F564C]" />
                </div>
                <div className="text-2xl font-bold text-[#1E2926] tabular-nums">
                  {analytics.spreadsheetCensus.totalRowsInCsv}{' '}
                  <span className="text-xs font-normal text-[#5A6561]">registros</span>
                </div>
                <p className="text-[11px] text-[#5A6561] mt-1">
                  {analytics.spreadsheetCensus.activeWorkersInCsv} ativos • {analytics.spreadsheetCensus.inactiveWorkersInCsv} inativos catalogados
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-[#E5E0D5] p-5 shadow-xs">
                <div className="flex items-center justify-between text-[#5A6561] mb-1.5">
                  <span className="text-xs font-medium">Perfil Demográfico</span>
                  <Activity className="w-4 h-4 text-[#1F564C]" />
                </div>
                <div className="text-2xl font-bold text-[#1E2926] tabular-nums">
                  {analytics.spreadsheetCensus.averageAge}{' '}
                  <span className="text-xs font-normal text-[#5A6561]">anos (média)</span>
                </div>
                <p className="text-[11px] text-[#5A6561] mt-1">
                  {analytics.spreadsheetCensus.maleCount} Masculino • {analytics.spreadsheetCensus.femaleCount} Feminino
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-[#E5E0D5] p-5 shadow-xs">
                <div className="flex items-center justify-between text-[#5A6561] mb-1.5">
                  <span className="text-xs font-medium">Cuidado Multiprofissional</span>
                  <Stethoscope className="w-4 h-4 text-[#1F564C]" />
                </div>
                <div className="text-2xl font-bold text-[#1F564C] tabular-nums">
                  {analytics.spreadsheetCensus.multiTeamCarePercent}%
                </div>
                <p className="text-[11px] text-[#5A6561] mt-1">
                  Medicina de Família, Enfermagem, Psicologia e Nutrição
                </p>
              </div>

              <div className="bg-[#1F564C] text-white rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between text-[#C6E4DA] mb-1.5">
                  <span className="text-xs font-medium">Economia Assistencial Anual</span>
                  <BookOpenCheck className="w-4 h-4 text-[#C6E4DA]" />
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {formatBrl(analytics.healthImpact.totalEstimatedAnnualImpactBrl)}
                </div>
                <p className="text-[11px] text-[#E6F2EE] mt-1">
                  Cálculo proporcional às {analytics.healthImpact.activeLivesScope} vidas ativas
                </p>
              </div>
            </div>

            {/* Economia Assistencial e Produtiva com Fontes Epidemiológicas Reais */}
            <div className="bg-white rounded-2xl border border-[#E5E0D5] p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#EFECE6] pb-4">
                <div>
                  <h2 className="text-sm font-bold text-[#1E2926]">
                    Retorno Operacional e Economia em Saúde Ocupacional (Baseado nos Dados Inseridos)
                  </h2>
                  <p className="text-xs text-[#5A6561] mt-0.5">
                    Indicadores calculados proporcionalmente aos {analytics.healthImpact.activeLivesScope} funcionários ativos, {analytics.healthImpact.accompaniedLivesScope} acompanhados e {analytics.healthImpact.recoveredConsultationsCount} agendamentos recuperados.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E5E0D5] space-y-1.5">
                  <div className="text-xs font-semibold text-[#5A6561]">
                    Preservação de Horas Produtivas no Turno
                  </div>
                  <div className="text-xl font-bold text-[#1E2926] tabular-nums">
                    {formatBrl(analytics.healthImpact.productiveHoursValueBrl)}{' '}
                    <span className="text-xs font-semibold text-[#1F564C]">
                      ({analytics.healthImpact.productiveHoursPreserved}h/ano)
                    </span>
                  </div>
                  <p className="text-[11px] text-[#5A6561] leading-relaxed">
                    {analytics.healthImpact.methodologySources[0]?.metricFormula}
                  </p>
                  <div className="text-[10px] text-[#64748B] pt-1 border-t border-[#E5E0D5]">
                    <strong>Referência:</strong> {analytics.healthImpact.methodologySources[0]?.officialSource}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E5E0D5] space-y-1.5">
                  <div className="text-xs font-semibold text-[#5A6561]">
                    Redução de Sinistralidade em Pronto-Socorro
                  </div>
                  <div className="text-xl font-bold text-[#1E2926] tabular-nums">
                    {formatBrl(analytics.healthImpact.emergencySavingsBrl)}{' '}
                    <span className="text-xs font-semibold text-[#1F564C]">
                      ({analytics.healthImpact.emergencyVisitsAvoided} idas evitadas)
                    </span>
                  </div>
                  <p className="text-[11px] text-[#5A6561] leading-relaxed">
                    {analytics.healthImpact.methodologySources[1]?.metricFormula}
                  </p>
                  <div className="text-[10px] text-[#64748B] pt-1 border-t border-[#E5E0D5]">
                    <strong>Referência:</strong> {analytics.healthImpact.methodologySources[1]?.officialSource}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E5E0D5] space-y-1.5">
                  <div className="text-xs font-semibold text-[#5A6561]">
                    Mitigação de Absenteísmo e Afastamentos Crônicos
                  </div>
                  <div className="text-xl font-bold text-[#1E2926] tabular-nums">
                    {formatBrl(analytics.healthImpact.absenteeismSavingsBrl)}{' '}
                    <span className="text-xs font-semibold text-[#1F564C]">
                      ({analytics.healthImpact.absenteeismDaysAvoided} dias evitados)
                    </span>
                  </div>
                  <p className="text-[11px] text-[#5A6561] leading-relaxed">
                    {analytics.healthImpact.methodologySources[2]?.metricFormula}
                  </p>
                  <div className="text-[10px] text-[#64748B] pt-1 border-t border-[#E5E0D5]">
                    <strong>Referência:</strong> {analytics.healthImpact.methodologySources[2]?.officialSource}
                  </div>
                </div>
              </div>
            </div>

            {/* Carteira por Médico de Referência e Linhas de Cuidado */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-[#E5E0D5] p-5 shadow-xs space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-[#1E2926]">
                    Carteira por Médico de Referência (APS SESI)
                  </h3>
                  <p className="text-xs text-[#5A6561]">
                    Distribuição dos {analytics.spreadsheetCensus.totalRowsInCsv} trabalhadores pelas equipes médicas responsáveis
                  </p>
                </div>

                <div className="space-y-2.5">
                  {analytics.doctorPortfolios.map((doc) => (
                    <div
                      key={doc.doctorName}
                      className="p-3 rounded-xl bg-[#FAF9F6] border border-[#E5E0D5] flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-[#1E2926]">{doc.doctorName}</div>
                        <div className="text-[11px] text-[#5A6561]">
                          {doc.totalAssignedCsv} no censo ({doc.activeAssigned} ativos • {doc.accompaniedCount} acompanhados)
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-[#1F564C] bg-[#EEF6F3] px-2.5 py-1 rounded-lg">
                        {doc.pendingFirstVisitCount} sem 1ª consulta
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#E5E0D5] p-5 shadow-xs space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-[#1E2926]">
                    Prevalência de Linhas de Cuidado APS
                  </h3>
                  <p className="text-xs text-[#5A6561]">
                    Demandas clínicas consolidadas e resolutividade na Atenção Primária
                  </p>
                </div>

                <div className="space-y-2.5">
                  {analytics.careLinesPrevalence.map((item) => (
                    <div key={item.lineName} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-[#1E2926]">{item.lineName}</span>
                        <span className="font-bold text-[#1F564C] tabular-nums">
                          {item.affectedPercent}% ({item.resolvedInApsPercent}% resolutividade)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-[#EFECE6] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#1F564C] rounded-full"
                          style={{ width: `${item.affectedPercent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SEÇÃO 2: INTEGRAÇÃO DE AGENDA (S+ / TEAMS) E BUSCA ATIVA */}
        {activeSection === 'AUTOMATIONS' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-[#E5E0D5] p-5 space-y-4 shadow-xs flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 text-xs font-bold text-[#1F564C]">
                    <Video className="w-4 h-4" />
                    Sincronização Automática com Sistema de Agendamento (S+) e Agenda Microsoft Teams
                  </div>
                  <p className="text-xs text-[#5A6561] leading-relaxed">
                    Elimina o controle manual: todas as consultas realizadas, retornos programados conforme o Protocolo de Risco (Risco 4, 3, 2 e 1) e acompanhamentos multiprofissionais são sincronizados automaticamente com o Sistema de Agendamento SESI (S+) e com o calendário do Microsoft Teams da equipe e do colaborador.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onRunSpreadsheetSync}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#1F564C] text-white hover:bg-[#163F37] transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  Sincronizar Agendas (S+ / Teams) e Prazos Agora
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-[#E5E0D5] p-5 space-y-4 shadow-xs flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 text-xs font-bold text-[#1F564C]">
                    <Smartphone className="w-4 h-4" />
                    Busca Ativa Automatizada e Acesso Rápido do Trabalhador (Teams / WhatsApp)
                  </div>
                  <p className="text-xs text-[#5A6561] leading-relaxed">
                    Identifica pacientes críticos (Risco 4 e Risco 3 com retorno pendente) e trabalhadores com maior tempo sem agendar a 1ª consulta, enviando link de acesso direto em 1 clique (sem senha) via Microsoft Teams e WhatsApp com horário reservado na janela protegida do turno.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onRunActiveSearchBot}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#1E2926] text-white hover:bg-[#33413D] transition-colors cursor-pointer"
                >
                  <Bot className="w-4 h-4" />
                  Executar Varredura e Enviar Acessos Rápidos
                </button>
              </div>
            </div>

            {/* Histórico de Execuções */}
            <div className="bg-white rounded-2xl border border-[#E5E0D5] p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-[#1E2926]">
                Registro de Sincronizações de Coordenação do Cuidado e Agendamento
              </h3>
              <div className="space-y-2">
                {automationLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#E5E0D5] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#1F564C] shrink-0" />
                        <span className="text-xs font-bold text-[#1E2926]">{log.scriptName}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#EEF6F3] text-[#1F564C]">
                          {log.rowsUpdatedOrImported} registros atualizados
                        </span>
                      </div>
                      <p className="text-xs text-[#5A6561] pl-5">{log.summaryMessage}</p>
                    </div>
                    <span className="text-[11px] text-[#64748B] tabular-nums pl-5 sm:pl-0 shrink-0">
                      {log.executedAt}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SEÇÃO 3: BANCO DE DADOS E CONECTORES ENTERPRISE */}
        {activeSection === 'INFRA' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-[#E5E0D5] p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[#1E2926] flex items-center gap-2">
                    <Server className="w-4 h-4 text-[#1F564C]" />
                    Persistência Transacional e Conectores de Integração (S+, Microsoft Teams & SQL)
                  </h3>
                  <p className="text-xs text-[#5A6561]">
                    Motor transacional ativo ({effectiveDbStatus.totalEmployeesPersisted} registros) com conectores para Sistema de Agendamento S+, Microsoft Graph Calendar (Teams) e PostgreSQL 16
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#1F564C] bg-[#EEF6F3] px-3 py-1.5 rounded-lg border border-[#C6E4DA]">
                    Latência: {effectiveDbStatus.latencyMs}ms • Sincronizado às {effectiveDbStatus.lastPersistedAt}
                  </span>
                  <button
                    type="button"
                    onClick={onTestDbConnection}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1F564C] text-white hover:bg-[#163F37] transition-colors cursor-pointer"
                  >
                    Verificar Conectores
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {effectiveDbStatus.scalabilityAdapters.map((adapter) => (
                  <div
                    key={adapter.name}
                    className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E5E0D5] flex flex-col justify-between gap-2.5"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#1E2926]">{adapter.name}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#EEF6F3] text-[#1F564C]">
                          {adapter.status === 'ACTIVE' ? 'ATIVO' : 'PRONTO'}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#5A6561]">{adapter.technology}</div>
                      <div className="text-[11px] font-mono text-[#1F564C] break-all">
                        {adapter.endpointPreview}
                      </div>
                    </div>
                    <div className="text-[11px] text-[#64748B] pt-2 border-t border-[#E5E0D5]">
                      Capacidade: {adapter.capacityTarget}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminChannel;
