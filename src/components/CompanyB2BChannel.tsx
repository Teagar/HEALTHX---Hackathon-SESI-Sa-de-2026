import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Building2,
  Users,
  TrendingUp,
  CheckCircle2,
  Clock,
  Activity,
  FileSpreadsheet,
  HeartHandshake,
  Copy,
  Check,
  BookOpen,
} from 'lucide-react';
import type { LgpdGlobalDashboard } from '../types';

export interface CompanyB2BChannelProps {
  metrics: LgpdGlobalDashboard;
}

export const CompanyB2BChannel: React.FC<CompanyB2BChannelProps> = ({ metrics }) => {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    metrics.companies[0]?.companyId || 'emp-1'
  );
  const [copiedDdsIndex, setCopiedDdsIndex] = useState<number | null>(null);

  const currentCompany =
    metrics.companies.find((c) => c.companyId === selectedCompanyId) || metrics.companies[0];

  if (!currentCompany) {
    return null;
  }

  const ddsScripts = [
    {
      title: 'Roteiro 1: Acolhimento em Saúde e Sigilo Médico (2 min)',
      shift: '1º e 2º Turnos • Diálogo Diário de Segurança',
      script:
        'Pessoal, a equipe de Saúde do SESI reservou janelas rápidas de 15 minutos aqui no turno para o check-up preventivo. Quando você recebe o Passe de Cuidado no WhatsApp, o horário já está alinhado com a supervisão, sem perda de bônus ou fila. Tudo o que é conversado no consultório é 100% protegido por sigilo médico — a empresa não recebe nenhum diagnóstico individual.',
    },
    {
      title: 'Roteiro 2: Prevenção de Dores Osteomusculares e Pausa Ativa (2 min)',
      shift: 'Operação e Manutenção • Prevenção na Linha',
      script:
        'Não espere a dor nas costas ou no ombro travar o movimento para procurar orientação. O atendimento da equipe de Enfermagem, Nutrição e Medicina do SESI ajuda a ajustar postura, hidratação e qualidade do sono antes de virar afastamento. Confirme seu horário em um toque pelo WhatsApp.',
    },
  ];

  const handleCopyDds = (text: string, idx: number) => {
    navigator.clipboard?.writeText(text);
    setCopiedDdsIndex(idx);
    setTimeout(() => setCopiedDdsIndex(null), 2500);
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
        {/* Cabeçalho do Portal Corporativo da Empresa */}
        <div className="bg-white rounded-2xl border border-[#E5E0D5] p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#EEF6F3] border border-[#C6E4DA] text-[#1F564C] text-[11px] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              Portal Corporativo da Unidade • Dados Anonimizados (LGPD Art. 11 • Coorte Mínima N ≥ {metrics.minGroupSize})
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-[#1E2926] tracking-tight flex items-center gap-2.5">
              <Building2 className="w-5 h-5 text-[#1F564C] shrink-0" />
              <span>{currentCompany.companyName}</span>
            </h1>
            <p className="text-xs text-[#5A6561]">
              {currentCompany.companyUnit} • {currentCompany.totalCatalogedRows} registros no censo ({currentCompany.totalLives} ativos e {currentCompany.inactiveLives} inativos) • Visão exclusiva desta unidade industrial
            </p>
          </div>

          {/* Seletor discreto de Unidade Credenciada (escopo exclusivo por empresa) */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 bg-[#FAF9F6] p-3 rounded-xl border border-[#E5E0D5]">
            <div className="text-left sm:text-right">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                Unidade Industrial Autenticada
              </span>
              <span className="text-[11px] text-[#5A6561]">
                Indicadores restritos à empresa selecionada
              </span>
            </div>
            <select
              value={currentCompany.companyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              aria-label="Selecionar unidade industrial"
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-[#D5CFC3] text-[#1E2926] focus:outline-none focus:border-[#1F564C]"
            >
              {metrics.companies.map((comp) => (
                <option key={comp.companyId} value={comp.companyId}>
                  {comp.companyName} ({comp.totalLives} vidas ativas)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Caso a unidade tenha menos de 5 vidas ativas, bloqueia exibição por segurança LGPD */}
        {!currentCompany.privacyLockApplied ? (
          <div className="bg-white rounded-2xl border border-[#E5E0D5] p-8 text-center space-y-3">
            <Lock className="w-8 h-8 text-[#C26D27] mx-auto" />
            <h2 className="text-base font-bold text-[#1E2926]">
              Coorte Populacional Inferior ao Mínimo de Anonimização (N &lt; {metrics.minGroupSize})
            </h2>
            <p className="text-xs text-[#5A6561] max-w-lg mx-auto leading-relaxed">
              Para impedir a identificação indireta de colaboradores, os indicadores epidemiológicos e assistenciais só são exibidos quando a unidade possui ao menos {metrics.minGroupSize} trabalhadores ativos cadastrados.
            </p>
          </div>
        ) : (
          <>
            {/* Linha 1: KPIs Operacionais da Empresa */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-[#E5E0D5] p-5 shadow-xs">
                <div className="flex items-center justify-between text-[#5A6561] mb-2">
                  <span className="text-xs font-medium">População Ativa Coberta</span>
                  <Users className="w-4 h-4 text-[#1F564C]" />
                </div>
                <div className="text-2xl font-bold text-[#1E2926] tabular-nums">
                  {currentCompany.totalLives}{' '}
                  <span className="text-xs font-normal text-[#5A6561]">trabalhadores</span>
                </div>
                <p className="text-[11px] text-[#5A6561] mt-1.5">
                  {currentCompany.activatedLives} já acolhidos • {currentCompany.pendingFirstVisitLives} aguardando 1ª consulta
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-[#E5E0D5] p-5 shadow-xs">
                <div className="flex items-center justify-between text-[#5A6561] mb-2">
                  <span className="text-xs font-medium">Taxa de Cobertura APS</span>
                  <CheckCircle2 className="w-4 h-4 text-[#1F564C]" />
                </div>
                <div className="text-2xl font-bold text-[#1F564C] tabular-nums">
                  {currentCompany.activationRatePercent}%
                </div>
                <div className="w-full bg-[#EFECE6] h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-[#1F564C] h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, currentCompany.activationRatePercent || 0)}%` }}
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#E5E0D5] p-5 shadow-xs">
                <div className="flex items-center justify-between text-[#5A6561] mb-2">
                  <span className="text-xs font-medium">Taxa de Falta em Consulta</span>
                  <Clock className="w-4 h-4 text-[#1F564C]" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[#1E2926] tabular-nums">
                    {currentCompany.noShowRatePercent}%
                  </span>
                  <span className="text-[11px] text-[#5A6561] line-through">
                    {metrics.historicalNoShowPercent}% antes
                  </span>
                </div>
                <p className="text-[11px] text-[#1F564C] font-medium mt-1.5">
                  {currentCompany.carePassIssuedCount} Passes de Cuidado emitidos no turno
                </p>
              </div>

              <div className="bg-[#1F564C] text-white rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between text-[#C6E4DA] mb-2">
                  <span className="text-xs font-medium">Economia Assistencial e Produtiva</span>
                  <TrendingUp className="w-4 h-4 text-[#C6E4DA]" />
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {formatBrl(currentCompany.healthImpact.totalEstimatedAnnualImpactBrl)}
                  <span className="text-xs font-normal text-[#C6E4DA]"> /ano</span>
                </div>
                <p className="text-[11px] text-[#E6F2EE] mt-1.5">
                  Projeção proporcional aos {currentCompany.totalLives} vínculos ativos da unidade
                </p>
              </div>
            </div>

            {/* Linha 2: Retorno Assistencial e Produtivo Baseado em Evidências Epidemiológicas */}
            <div className="bg-white rounded-2xl border border-[#E5E0D5] p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#EFECE6] pb-4">
                <div>
                  <h2 className="text-sm font-bold text-[#1E2926] flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#1F564C]" />
                    Impacto Produtivo e Economia em Saúde Ocupacional ({currentCompany.companyName})
                  </h2>
                  <p className="text-xs text-[#5A6561] mt-0.5">
                    Cálculo direto sobre as {currentCompany.totalLives} vidas ativas e {currentCompany.activatedLives} acompanhamentos clínicos desta unidade
                  </p>
                </div>
                <span className="text-[11px] font-medium text-[#1F564C] bg-[#EEF6F3] px-3 py-1 rounded-lg border border-[#C6E4DA] self-start sm:self-auto">
                  Resolutividade APS: {metrics.apsResolvabilityPercent}% • NPS {metrics.npsScore}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Indicador 1: Horas Produtivas Preservadas */}
                <div className="bg-[#FAF9F6] rounded-xl p-4 border border-[#E5E0D5] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5A6561]">
                      1. Horas Produtivas Preservadas
                    </span>
                    <span className="text-xs font-bold text-[#1F564C] bg-[#EEF6F3] px-2 py-0.5 rounded">
                      {currentCompany.healthImpact.productiveHoursPreserved}h / ano
                    </span>
                  </div>
                  <div className="text-xl font-bold text-[#1E2926] tabular-nums">
                    {formatBrl(currentCompany.healthImpact.productiveHoursValueBrl)}
                  </div>
                  <p className="text-[11px] text-[#5A6561] leading-relaxed">
                    {currentCompany.healthImpact.methodologySources[0]?.metricFormula}
                  </p>
                  <div className="pt-1 text-[10px] text-[#64748B] border-t border-[#E5E0D5]">
                    <strong>Fonte:</strong> {currentCompany.healthImpact.methodologySources[0]?.officialSource}
                  </div>
                </div>

                {/* Indicador 2: Pronto-Socorro Evitado */}
                <div className="bg-[#FAF9F6] rounded-xl p-4 border border-[#E5E0D5] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5A6561]">
                      2. Pronto-Socorro Evitado (Sinistralidade)
                    </span>
                    <span className="text-xs font-bold text-[#1F564C] bg-[#EEF6F3] px-2 py-0.5 rounded">
                      {currentCompany.healthImpact.emergencyVisitsAvoided} idas evitadas
                    </span>
                  </div>
                  <div className="text-xl font-bold text-[#1E2926] tabular-nums">
                    {formatBrl(currentCompany.healthImpact.emergencySavingsBrl)}
                  </div>
                  <p className="text-[11px] text-[#5A6561] leading-relaxed">
                    {currentCompany.healthImpact.methodologySources[1]?.metricFormula}
                  </p>
                  <div className="pt-1 text-[10px] text-[#64748B] border-t border-[#E5E0D5]">
                    <strong>Fonte:</strong> {currentCompany.healthImpact.methodologySources[1]?.officialSource}
                  </div>
                </div>

                {/* Indicador 3: Redução de Absenteísmo */}
                <div className="bg-[#FAF9F6] rounded-xl p-4 border border-[#E5E0D5] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5A6561]">
                      3. Dias de Afastamento Evitados
                    </span>
                    <span className="text-xs font-bold text-[#1F564C] bg-[#EEF6F3] px-2 py-0.5 rounded">
                      {currentCompany.healthImpact.absenteeismDaysAvoided} dias / ano
                    </span>
                  </div>
                  <div className="text-xl font-bold text-[#1E2926] tabular-nums">
                    {formatBrl(currentCompany.healthImpact.absenteeismSavingsBrl)}
                  </div>
                  <p className="text-[11px] text-[#5A6561] leading-relaxed">
                    {currentCompany.healthImpact.methodologySources[2]?.metricFormula}
                  </p>
                  <div className="pt-1 text-[10px] text-[#64748B] border-t border-[#E5E0D5]">
                    <strong>Fonte:</strong> {currentCompany.healthImpact.methodologySources[2]?.officialSource}
                  </div>
                </div>
              </div>
            </div>

            {/* Linha 3: Painel Analítico Anonimizado da Unidade (Estratificação + Linhas de Cuidado + Evolução) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Estratificação Populacional de Risco APS */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E5E0D5] p-5 shadow-xs space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-[#1E2926]">
                    Estratificação de Risco Populacional (Anônima)
                  </h3>
                  <p className="text-xs text-[#5A6561] mt-0.5">
                    Distribuição agregada dos {currentCompany.totalLives} colaboradores ativos da unidade
                  </p>
                </div>

                <div className="space-y-3">
                  {currentCompany.riskBreakdown.map((item) => (
                    <div key={item.riskLevel} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[#1E2926]">{item.label}</span>
                        <span
                          className="px-2 py-0.5 rounded font-bold tabular-nums text-xs"
                          style={{
                            color: item.colorHex,
                            backgroundColor: `${item.colorHex}14`,
                          }}
                        >
                          {item.count} vidas ({item.percent}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-[#EFECE6] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${item.percent}%`,
                            backgroundColor: item.colorHex,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Linhas de Cuidado APS & Adesão por Turno */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E5E0D5] p-5 shadow-xs flex flex-col justify-between space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[#1E2926] flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-[#1F564C]" />
                        Demandas Assistenciais e Linhas de Cuidado na Unidade
                      </h3>
                      <p className="text-xs text-[#5A6561]">
                        Temas prioritários para direcionar campanhas internas e ergonomia sem exposição individual
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {currentCompany.careLinesDistribution.map((line) => (
                      <div
                        key={line.lineName}
                        className="p-3 rounded-xl bg-[#FAF9F6] border border-[#E5E0D5] flex items-center justify-between gap-2"
                      >
                        <div className="text-xs font-semibold text-[#1E2926]">{line.lineName}</div>
                        <span className="text-xs font-bold text-[#1F564C] bg-[#EEF6F3] px-2.5 py-1 rounded-lg shrink-0">
                          {line.percent}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Evolução Mensal Jul–Dez/2026 e Adesão por Turno */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[#EFECE6]">
                  <div>
                    <h4 className="text-xs font-bold text-[#1E2926] mb-2">
                      Contatos de Coordenação do Cuidado (Jul–Dez/2026)
                    </h4>
                    <div className="grid grid-cols-6 gap-1.5 items-end h-20 pt-2">
                      {currentCompany.monthlyContactsTrend.map((m) => {
                        const maxVal = Math.max(
                          1,
                          ...currentCompany.monthlyContactsTrend.map((x) => x.contactedCount)
                        );
                        const heightPct = Math.max(18, Math.round((m.contactedCount / maxVal) * 100));
                        return (
                          <div key={m.month} className="flex flex-col items-center gap-1 h-full justify-end">
                            <span className="text-[10px] font-bold text-[#1F564C] tabular-nums">
                              {m.contactedCount}
                            </span>
                            <div
                              className="w-full bg-[#1F564C]/85 rounded-t"
                              style={{ height: `${heightPct}%` }}
                            />
                            <span className="text-[9px] text-[#5A6561] truncate max-w-full">
                              {m.month.split('/')[0]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-[#1E2926] mb-2">
                      Cobertura por Turno Operacional
                    </h4>
                    <div className="space-y-2">
                      {currentCompany.shiftAdhesion.map((sh) => (
                        <div key={sh.shiftLabel} className="text-xs space-y-1">
                          <div className="flex justify-between">
                            <span className="text-[#5A6561] truncate pr-2">{sh.shiftLabel}</span>
                            <span className="font-semibold text-[#1E2926] tabular-nums">
                              {sh.totalGroup} vidas ({sh.adhesionPercent}%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-[#EFECE6] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#1F564C] rounded-full"
                              style={{ width: `${sh.adhesionPercent}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Linha 4: Kit DDS de 2 Minutos para Liderança de Chão de Fábrica */}
            <div className="bg-white rounded-2xl border border-[#E5E0D5] p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[#1E2926] flex items-center gap-2">
                    <HeartHandshake className="w-4 h-4 text-[#1F564C]" />
                    Comunicados Rápidos para Liderança de Turno (DDS de 2 Minutos)
                  </h3>
                  <p className="text-xs text-[#5A6561]">
                    Roteiros curtos para alinhamento com supervisores de produção, facilitando a liberação planejada de 15 min no turno
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#5A6561]">
                  <BookOpen className="w-3.5 h-3.5 text-[#1F564C]" />
                  Pronto para compartilhar no grupo de líderes
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ddsScripts.map((item, idx) => (
                  <div
                    key={item.title}
                    className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E5E0D5] flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="text-xs font-bold text-[#1E2926]">{item.title}</div>
                      <div className="text-[11px] font-medium text-[#1F564C]">{item.shift}</div>
                      <p className="text-xs text-[#5A6561] leading-relaxed pt-1">“{item.script}”</p>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleCopyDds(item.script, idx)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-[#D5CFC3] text-[#1E2926] hover:border-[#1F564C] hover:text-[#1F564C] transition-colors cursor-pointer"
                      >
                        {copiedDdsIndex === idx ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#1F564C]" />
                            Roteiro Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copiar para Supervisor
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CompanyB2BChannel;
