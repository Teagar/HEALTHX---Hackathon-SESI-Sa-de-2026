import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Building2,
  Users,
  TrendingUp,
  CheckCircle2,
  Clock,
  Briefcase,
  CalendarCheck,
  HeartHandshake,
  Copy,
  Check,
  BookOpen,
  Layers,
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
      title: 'Roteiro 1: Liberação Planejada na Janela do Turno e Sigilo Total (2 min)',
      shift: '1º e 2º Turnos • Diálogo Diário com Liderança e Operação',
      script:
        'Pessoal, a equipe do SESI Saúde Acolhe reservou janelas rápidas de 15 a 20 minutos dentro do turno para os acompanhamentos periódicos. Quando você recebe o Passe de Cuidado no WhatsApp ou Microsoft Teams, o horário já está alinhado com a supervisão, sem perda de prêmio de assiduidade e sem precisar ir no contraturno. Todo atendimento é 100% protegido por sigilo — a empresa recebe apenas indicadores operacionais de presença e cobertura, sem qualquer informação clínica.',
    },
    {
      title: 'Roteiro 2: Confirmação em 1 Toque para Evitar Vagas Ociosas (2 min)',
      shift: 'Operação e Manutenção • Organização de Escala',
      script:
        'Quando chegar a confirmação do horário da sua consulta do SESI no celular, confirme em um toque ou avise caso precise trocar de janela no turno. Assim a liderança organiza a cobertura rápida do posto por 15 minutos e garantimos que nenhum colega perca a vaga de atendimento.',
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

  const pe = currentCompany.productionEconomy;
  const prod = {
    attendanceRatePercent: Math.max(0, 100 - currentCompany.noShowRatePercent),
    carePlanActiveAdhesionPercent: pe.carePlanActiveAdhesionPercent,
    consultationsRealizedInProtectedShift: pe.totalConsultationsInShiftWindow,
    equivalentFullShiftsPreserved: pe.equivalentWorkshiftsPreserved,
    methodologyNote: pe.methodologyNote,
    productiveHoursPreservedInShift: pe.productiveHoursPreservedTotal,
    productiveValuePreservedBrl: pe.productionValuePreservedBrl,
    hoursSavedPerConsultation: pe.hoursSavedPerConsultationInShift,
  };

  return (
    <div className="h-full overflow-y-auto bg-[#E4E8EE] p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6 pb-8">
        {/* Cabeçalho do Portal do Gestor / RH da Empresa Contratante */}
        <div className="bg-white rounded-2xl border border-[#EAECF0] p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#ECF8F3] border border-[#C7EADC] text-[#0E7A5F] text-[11px] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              Portal do Gestor / RH • Conformidade Estrita LGPD (Sem Classificação de Risco ou Dados Clínicos • N ≥ {metrics.minGroupSize})
            </div>
            <h1 className="text-lg sm:text-xl font-semibold text-[#101828] tracking-tight flex items-center gap-2.5">
              <Building2 className="w-5 h-5 text-[#0E7A5F] shrink-0" />
              <span>{currentCompany.companyName}</span>
            </h1>
            <p className="text-xs text-[#475467]">
              {currentCompany.companyUnit} • {currentCompany.totalCatalogedRows} vínculos no censo contratual ({currentCompany.totalLives} ativos e {currentCompany.inactiveLives} inativos) • Indicadores exclusivos de produção, cobertura e assiduidade
            </p>
          </div>

          {/* Seletor de Unidade Industrial Autenticada */}
          <div className="flex w-full shrink-0 flex-col gap-1.5 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] p-3 lg:w-[320px]">
            <div>
              <span className="block whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                Unidade industrial autenticada
              </span>
              <span className="block text-[11px] text-[#475467]">
                Escopo isolado por empresa contratante
              </span>
            </div>
            <select
              value={currentCompany.companyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              aria-label="Selecionar unidade industrial"
              className="w-full px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-[#E4E7EC] text-[#101828] shadow-xs focus:outline-none focus:border-[#0E7A5F]"
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
          <div className="bg-white rounded-2xl border border-[#EAECF0] p-8 text-center space-y-3">
            <Lock className="w-8 h-8 text-[#C26D27] mx-auto" />
            <h2 className="text-base font-semibold text-[#101828]">
              Coorte Populacional Inferior ao Mínimo de Anonimização (N &lt; {metrics.minGroupSize})
            </h2>
            <p className="text-xs text-[#475467] max-w-lg mx-auto leading-relaxed">
              Para impedir qualquer inferência individual, os indicadores operacionais só são exibidos quando a unidade possui ao menos {metrics.minGroupSize} trabalhadores ativos cadastrados.
            </p>
          </div>
        ) : (
          <>
            {/* Linha 1: 4 KPIs Operacionais e de Economia de Produção */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-[#EAECF0] p-5 shadow-xs">
                <div className="flex items-center justify-between text-[#475467] mb-2">
                  <span className="text-xs font-medium">Carteira Ativa Contratada</span>
                  <Users className="w-4 h-4 text-[#0E7A5F]" />
                </div>
                <div className="text-2xl font-semibold text-[#101828] tabular-nums">
                  {currentCompany.totalLives}{' '}
                  <span className="text-xs font-normal text-[#475467]">trabalhadores ativos</span>
                </div>
                <p className="text-[11px] text-[#475467] mt-1.5">
                  {currentCompany.activatedLives} já em acompanhamento • {currentCompany.pendingFirstVisitLives} aguardando 1ª consulta
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-[#EAECF0] p-5 shadow-xs">
                <div className="flex items-center justify-between text-[#475467] mb-2">
                  <span className="text-xs font-medium">Utilização da Cobertura Contratada</span>
                  <CheckCircle2 className="w-4 h-4 text-[#0E7A5F]" />
                </div>
                <div className="text-2xl font-semibold text-[#0E7A5F] tabular-nums">
                  {currentCompany.activationRatePercent}%
                </div>
                <div className="w-full bg-[#F2F4F7] h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-[#0E7A5F] h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, currentCompany.activationRatePercent || 0)}%` }}
                  />
                </div>
                <p className="text-[11px] text-[#475467] mt-1.5">
                  Meta operacional de ativação da carteira industrial
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-[#EAECF0] p-5 shadow-xs">
                <div className="flex items-center justify-between text-[#475467] mb-2">
                  <span className="text-xs font-medium">Assiduidade nas Janelas de Turno</span>
                  <Clock className="w-4 h-4 text-[#0E7A5F]" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-semibold text-[#101828] tabular-nums">
                    {prod.attendanceRatePercent}%
                  </span>
                  <span className="text-[11px] text-[#475467]">
                    ({currentCompany.noShowRatePercent}% faltas vs {metrics.historicalNoShowPercent}% histórico)
                  </span>
                </div>
                <p className="text-[11px] text-[#0E7A5F] font-medium mt-1.5">
                  {currentCompany.carePassIssuedCount} Passes de Cuidado emitidos na janela protegida
                </p>
              </div>

              <div className="bg-[#0E7A5F] text-white rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between text-[#C7EADC] mb-2">
                  <span className="text-xs font-medium">Economia de Produção no Turno</span>
                  <TrendingUp className="w-4 h-4 text-[#C7EADC]" />
                </div>
                <div className="text-2xl font-semibold tabular-nums">
                  {formatBrl(prod.productiveValuePreservedBrl)}
                  <span className="text-xs font-normal text-[#C7EADC]"> /ano</span>
                </div>
                <p className="text-[11px] text-[#E3F4EC] mt-1.5">
                  {prod.productiveHoursPreservedInShift}h produtivas preservadas ({prod.equivalentFullShiftsPreserved} turnos de 8h)
                </p>
              </div>
            </div>

            {/* Linha 2: Detalhamento da Economia de Produção e Indicadores Operacionais da Carteira */}
            <div className="bg-white rounded-2xl border border-[#EAECF0] p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#F2F4F7] pb-4">
                <div>
                  <h2 className="text-sm font-semibold text-[#101828] flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-[#0E7A5F]" />
                    Economia de Produção e Eficiência Operacional da Carteira ({currentCompany.companyName})
                  </h2>
                  <p className="text-xs text-[#475467] mt-0.5">
                    Métricas exclusivamente produtivas e logísticas calculadas a partir dos {currentCompany.totalLives} colaboradores ativos e {prod.consultationsRealizedInProtectedShift} atendimentos realizados em janela protegida.
                  </p>
                </div>
                <span className="text-[11px] font-medium text-[#0E7A5F] bg-[#ECF8F3] px-3 py-1 rounded-lg border border-[#C7EADC] self-start sm:self-auto">
                  Zero exposição de dados clínicos ou de doenças (LGPD)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Métrica Produtiva 1 */}
                <div className="bg-[#F9FAFB] rounded-xl p-4 border border-[#EAECF0] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#475467]">
                      1. Horas Produtivas Preservadas na Planta
                    </span>
                    <span className="text-xs font-semibold text-[#0E7A5F] bg-[#ECF8F3] px-2 py-0.5 rounded">
                      {prod.productiveHoursPreservedInShift}h / ano
                    </span>
                  </div>
                  <div className="text-xl font-semibold text-[#101828] tabular-nums">
                    {formatBrl(prod.productiveValuePreservedBrl)}{' '}
                    <span className="text-xs font-semibold text-[#0E7A5F]">
                      ({prod.equivalentFullShiftsPreserved} turnos de 8h)
                    </span>
                  </div>
                  <p className="text-[11px] text-[#475467] leading-relaxed">
                    Consultas realizadas na janela protegida de 15–20 min evitam o deslocamento externo sem hora marcada (~3,5h de ausência na linha por saída), preservando {prod.hoursSavedPerConsultation.toLocaleString('pt-BR')}h produtivas por atendimento.
                  </p>
                  <div className="pt-1 text-[10px] text-[#64748B] border-t border-[#EAECF0]">
                    <strong>Base de cálculo:</strong> {prod.methodologyNote}
                  </div>
                </div>

                {/* Métrica Produtiva 2 */}
                <div className="bg-[#F9FAFB] rounded-xl p-4 border border-[#EAECF0] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#475467]">
                      2. Cobertura Multiprofissional Integrada
                    </span>
                    <span className="text-xs font-semibold text-[#0E7A5F] bg-[#ECF8F3] px-2 py-0.5 rounded">
                      { currentCompany.multiTeamCoveragePercent }% da carteira
                    </span>
                  </div>
                  <div className="text-xl font-semibold text-[#101828] tabular-nums">
                    {prod.consultationsRealizedInProtectedShift} atendimentos no turno
                  </div>
                  <p className="text-[11px] text-[#475467] leading-relaxed">
                    Percentual dos trabalhadores ativos que utilizam o acompanhamento integrado do contrato SESI Saúde Acolhe dentro das janelas programadas sem atrito com a supervisão.
                  </p>
                  <div className="pt-1 text-[10px] text-[#64748B] border-t border-[#EAECF0]">
                    <strong>Fonte:</strong> Registro de agendamentos e comparecimentos da unidade
                  </div>
                </div>

                {/* Métrica Produtiva 3 */}
                <div className="bg-[#F9FAFB] rounded-xl p-4 border border-[#EAECF0] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#475467]">
                      3. Engajamento e Continuidade Operacional
                    </span>
                    <span className="text-xs font-semibold text-[#0E7A5F] bg-[#ECF8F3] px-2 py-0.5 rounded">
                      {prod.carePlanActiveAdhesionPercent}% de adesão
                    </span>
                  </div>
                  <div className="text-xl font-semibold text-[#101828] tabular-nums">
                    {currentCompany.activatedLives} de {currentCompany.totalLives} vidas ativas
                  </div>
                  <p className="text-[11px] text-[#475467] leading-relaxed">
                    Índice de trabalhadores acolhidos que mantêm continuidade regular nos retornos programados e adesão às metas preventivas pactuadas, reduzindo paradas imprevistas na escala.
                  </p>
                  <div className="pt-1 text-[10px] text-[#64748B] border-t border-[#EAECF0]">
                    <strong>Fonte:</strong> Indicador agregado de continuidade do programa APS
                  </div>
                </div>
              </div>
            </div>

            {/* Linha 3: Evolução Mensal de Acompanhamentos (Jul–Dez/2026) & Cobertura por Turno Operacional */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Evolução Mensal Jul–Dez/2026 */}
              <div className="lg:col-span-6 bg-white rounded-2xl border border-[#EAECF0] p-5 shadow-xs flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-[#101828] flex items-center gap-2">
                    <CalendarCheck className="w-4 h-4 text-[#0E7A5F]" />
                    Evolução Mensal de Acompanhamentos na Unidade (Jul–Dez/2026)
                  </h3>
                  <p className="text-xs text-[#475467] mt-0.5">
                    Volume mensal de trabalhadores contatados e acompanhados nas janelas de turno (Colunas Jul–Dez/2026)
                  </p>
                </div>

                <div className="grid grid-cols-6 gap-2.5 items-end h-36 pt-4 px-2">
                  {currentCompany.monthlyContactsTrend.map((m) => {
                    const maxVal = Math.max(
                      1,
                      ...currentCompany.monthlyContactsTrend.map((x) => x.contactedCount)
                    );
                    const heightPct = Math.max(18, Math.round((m.contactedCount / maxVal) * 100));
                    return (
                      <div key={m.month} className="flex flex-col items-center gap-1.5 h-full justify-end">
                        <span className="text-xs font-semibold text-[#0E7A5F] tabular-nums">
                          {m.contactedCount}
                        </span>
                        <div
                          className="w-full bg-[#0E7A5F]/85 rounded-t-lg transition-all"
                          style={{ height: `${heightPct}%` }}
                        />
                        <span className="text-[10.5px] font-semibold text-[#475467] truncate max-w-full">
                          {m.month}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-xl bg-[#F9FAFB] border border-[#EAECF0] px-3.5 py-2.5 text-[11px] text-[#475467]">
                  A programação antecipada dos retornos permite que a supervisão de turno conheça com antecedência o volume semanal de liberações de 15 minutos, sem impacto na linha de produção.
                </div>
              </div>

              {/* Cobertura e Assiduidade por Turno Operacional */}
              <div className="lg:col-span-6 bg-white rounded-2xl border border-[#EAECF0] p-5 shadow-xs flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-[#101828] flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#0E7A5F]" />
                    Cobertura e Engajamento por Turno Operacional
                  </h3>
                  <p className="text-xs text-[#475467] mt-0.5">
                    Distribuição dos trabalhadores ativos e percentual de cobertura por janela de turno
                  </p>
                </div>

                <div className="space-y-3.5">
                  {currentCompany.shiftAdhesion.map((sh) => (
                    <div
                      key={sh.shiftLabel}
                      className="rounded-xl border border-[#EAECF0] bg-[#F9FAFB] p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#101828]">{sh.shiftLabel}</span>
                        <span className="font-semibold text-[#0E7A5F] bg-[#ECF8F3] px-2.5 py-0.5 rounded-md tabular-nums">
                          {sh.totalGroup} vidas ativas • {sh.adhesionPercent}% cobertos
                        </span>
                      </div>
                      <div className="w-full h-2 bg-[#F2F4F7] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#0E7A5F] rounded-full"
                          style={{ width: `${sh.adhesionPercent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl bg-[#ECF8F3] border border-[#C7EADC] px-3.5 py-2.5 text-[11px] text-[#0E7A5F] font-medium">
                  Proteção de Dados (LGPD Art. 11): Este painel apresenta exclusivamente métricas operacionais de utilização, cobertura de carteira e horas produtivas preservadas. Classificações de risco clínico e prevalência de patologias são de acesso exclusivo da Equipe de Saúde.
                </div>
              </div>
            </div>

            {/* Linha 4: Kit DDS de 2 Minutos para Liderança de Chão de Fábrica */}
            <div className="bg-white rounded-2xl border border-[#EAECF0] p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[#101828] flex items-center gap-2">
                    <HeartHandshake className="w-4 h-4 text-[#0E7A5F]" />
                    Comunicados Rápidos para Liderança de Turno (DDS de 2 Minutos)
                  </h3>
                  <p className="text-xs text-[#475467]">
                    Roteiros curtos para alinhamento com supervisores de produção sobre a janela protegida de 15 minutos no turno
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#475467]">
                  <BookOpen className="w-3.5 h-3.5 text-[#0E7A5F]" />
                  Pronto para compartilhar no grupo de líderes
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ddsScripts.map((item, idx) => (
                  <div
                    key={item.title}
                    className="p-4 rounded-xl bg-[#F9FAFB] border border-[#EAECF0] flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold text-[#101828]">{item.title}</div>
                      <div className="text-[11px] font-medium text-[#0E7A5F]">{item.shift}</div>
                      <p className="text-xs text-[#475467] leading-relaxed pt-1">“{item.script}”</p>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleCopyDds(item.script, idx)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-[#E4E7EC] text-[#101828] hover:border-[#0E7A5F] hover:text-[#0E7A5F] transition-colors cursor-pointer"
                      >
                        {copiedDdsIndex === idx ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#0E7A5F]" />
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
