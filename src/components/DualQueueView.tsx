import { useMemo } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ClipboardList,
  Clock,
  MapPin,
  Send,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import type { Employee } from '../types';
import { getActiveSearchQueue, getReturnPriorityQueue } from '../queueService';

export interface DualQueueViewProps {
  employees: Employee[];
  returnQueue?: Employee[];
  activeSearchQueue?: Employee[];
  onOpenProfile: (employeeId: string) => void;
  onSendWhatsApp: (employeeId: string) => void;
}

type ReturnRiskLevel = 1 | 2 | 3 | 4;

interface ReturnRiskMeta {
  badgeLabel: string;
  badgeClassName: string;
  dotClassName: string;
  ruleLabel: string;
}

const RETURN_RISK_META: Record<ReturnRiskLevel, ReturnRiskMeta> = {
  4: {
    badgeLabel: 'RISCO 4 • CRÍTICO',
    badgeClassName: 'border-[#F5C6BC] bg-[#FDF2F0] text-[#C84B31]',
    dotClassName: 'bg-[#C84B31]',
    ruleLabel: 'Quinzenal / Mensal',
  },
  3: {
    badgeLabel: 'RISCO 3 • 3 MESES',
    badgeClassName: 'border-[#F5DFB8] bg-[#FDF7EC] text-[#C26D27]',
    dotClassName: 'bg-[#C26D27]',
    ruleLabel: 'Retorno em 90 dias',
  },
  2: {
    badgeLabel: 'RISCO 2 • 6 MESES',
    badgeClassName: 'border-[#FDE68A] bg-[#FEFCE8] text-[#A16207]',
    dotClassName: 'bg-[#A16207]',
    ruleLabel: 'Retorno em 180 dias',
  },
  1: {
    badgeLabel: 'RISCO 1 • 6 MESES',
    badgeClassName: 'border-[#C6E4DA] bg-[#EEF6F3] text-[#1F564C]',
    dotClassName: 'bg-[#1F564C]',
    ruleLabel: 'Preventivo 180 dias',
  },
};

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateBr(value: string): string {
  const date = parseIsoDate(value);
  if (!date) return value || '—';
  return date.toLocaleDateString('pt-BR');
}

const TH_BASE =
  'sticky top-0 z-10 border-b border-[#E6E2D8] bg-[#FAF9F6] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#5A6561]';
const TD_BASE = 'border-b border-[#F2EFE8] px-3 py-2.5 align-middle';

export function DualQueueView({
  employees,
  returnQueue: returnQueueProp,
  activeSearchQueue: activeSearchQueueProp,
  onOpenProfile,
  onSendWhatsApp,
}: DualQueueViewProps) {
  const returnQueue = useMemo(
    () => returnQueueProp ?? getReturnPriorityQueue(employees),
    [returnQueueProp, employees]
  );
  const activeSearchQueue = useMemo(
    () => activeSearchQueueProp ?? getActiveSearchQueue(employees),
    [activeSearchQueueProp, employees]
  );

  const criticalActiveSearchCount = activeSearchQueue.filter(
    (emp) => emp.daysSinceActivation >= 150
  ).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto lg:overflow-hidden">
      {/* JANELA INTERNA SUPERIOR (50%): PRIORIDADE CLÍNICA DE RETORNO */}
      <section className="flex min-h-[280px] flex-1 flex-col overflow-hidden rounded-xl border border-[#DED9CE] bg-white shadow-sm lg:min-h-0">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#E6E2D8] bg-[#FAF9F6] px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1F564C] text-white">
              <Stethoscope className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-[12px] font-bold text-[#1E2926]">
                Prioridade Clínica de Retorno (Pacientes Acompanhados)
              </h2>
              <p className="truncate text-[10.5px] text-[#5A6561]">
                Ordenado por classificação de risco (Risco 4 → 3 → 2 → 1) e data prevista de retorno
              </p>
            </div>
          </div>
          <span className="rounded-full border border-[#C6E4DA] bg-[#EEF6F3] px-2.5 py-0.5 text-[10.5px] font-bold tabular-nums text-[#1F564C]">
            {returnQueue.length} em acompanhamento
          </span>
        </header>

        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
          <table className="w-full min-w-[680px] border-collapse text-left">
            <thead>
              <tr>
                <th scope="col" className={`${TH_BASE} w-[150px]`}>
                  Risco e Regra
                </th>
                <th scope="col" className={`${TH_BASE} w-[28%]`}>
                  Funcionário e Empresa
                </th>
                <th scope="col" className={TH_BASE}>
                  Demandas Clínicas e Prazo de Retorno
                </th>
                <th scope="col" className={`${TH_BASE} w-[195px] text-right`}>
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {returnQueue.map((emp) => {
                const risk = (emp.riskLevel === 0 ? 1 : emp.riskLevel) as ReturnRiskLevel;
                const meta = RETURN_RISK_META[risk];
                return (
                  <tr key={emp.id} className="transition-colors hover:bg-[#FAF9F6]">
                    <td className={TD_BASE}>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-bold ${meta.badgeClassName}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClassName}`} />
                        {meta.badgeLabel}
                      </span>
                      <div className="mt-1 text-[10px] text-[#5A6561]">{emp.returnRule}</div>
                    </td>
                    <td className={TD_BASE}>
                      <div className="truncate text-[12.5px] font-bold text-[#1E2926]">
                        {emp.name}
                      </div>
                      <div className="truncate text-[10.5px] text-[#5A6561]">
                        Mat. {emp.matricula} • {emp.age} anos • {emp.shift.split(' ')[0]} Turno
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-[10.5px] font-medium text-[#1F564C]">
                        <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">{emp.companyName}</span>
                      </div>
                    </td>
                    <td className={TD_BASE}>
                      <div className="line-clamp-1 text-[11.5px] font-medium text-[#1E2926]">
                        {emp.lastMedicalDemands || emp.summaryLine}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] text-[#5A6561]">
                        <span>Médico: {emp.referenceDoctor}</span>
                        <span className="inline-flex items-center gap-1 font-medium text-[#1E2926]">
                          <CalendarClock className="h-3 w-3 text-[#1F564C]" />
                          Retorno: {formatDateBr(emp.nextVisit)}
                        </span>
                      </div>
                    </td>
                    <td className={TD_BASE}>
                      <RowActions
                        employee={emp}
                        onOpenProfile={onOpenProfile}
                        onSendWhatsApp={onSendWhatsApp}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* JANELA INTERNA INFERIOR (50%): BUSCA ATIVA DE 1ª CONSULTA */}
      <section className="flex min-h-[280px] flex-1 flex-col overflow-hidden rounded-xl border border-[#DED9CE] bg-white shadow-sm lg:min-h-0">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#E6E2D8] bg-[#FAF9F6] px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#C84B31] text-white">
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-[12px] font-bold text-[#1E2926]">
                Busca Ativa de 1ª Consulta (Nunca Agendaram)
              </h2>
              <p className="truncate text-[10.5px] text-[#5A6561]">
                Ordenado pelo maior tempo ativo sem agendar a 1ª consulta de acolhimento
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {criticalActiveSearchCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#F5C6BC] bg-[#FDF2F0] px-2.5 py-0.5 text-[10px] font-bold text-[#C84B31]">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                {criticalActiveSearchCount} ≥ 150 dias
              </span>
            )}
            <span className="rounded-full border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-0.5 text-[10.5px] font-bold tabular-nums text-[#475569]">
              {activeSearchQueue.length} pendentes
            </span>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
          <table className="w-full min-w-[680px] border-collapse text-left">
            <thead>
              <tr>
                <th scope="col" className={`${TH_BASE} w-[150px]`}>
                  Dias sem Agendar
                </th>
                <th scope="col" className={`${TH_BASE} w-[28%]`}>
                  Funcionário e Empresa
                </th>
                <th scope="col" className={TH_BASE}>
                  Situação na Busca Ativa e Janela Protegida
                </th>
                <th scope="col" className={`${TH_BASE} w-[195px] text-right`}>
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {activeSearchQueue.map((emp) => {
                const isCritical = emp.daysSinceActivation >= 150;
                return (
                  <tr key={emp.id} className="transition-colors hover:bg-[#FAF9F6]">
                    <td className={TD_BASE}>
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                          isCritical
                            ? 'border-[#F5C6BC] bg-[#FDF2F0] text-[#C84B31]'
                            : 'border-[#CBD5E1] bg-[#F8FAFC] text-[#475569]'
                        }`}
                      >
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {emp.daysSinceActivation} dias
                      </span>
                      <div className="mt-1 text-[10px] text-[#5A6561]">
                        Entrada: {formatDateBr(emp.admissionDate)}
                      </div>
                    </td>
                    <td className={TD_BASE}>
                      <div className="truncate text-[12.5px] font-bold text-[#1E2926]">
                        {emp.name}
                      </div>
                      <div className="truncate text-[10.5px] text-[#5A6561]">
                        Mat. {emp.matricula} • {emp.age} anos • {emp.shift.split(' ')[0]} Turno
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-[10.5px] font-medium text-[#1F564C]">
                        <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">{emp.companyName}</span>
                      </div>
                    </td>
                    <td className={TD_BASE}>
                      <div className="line-clamp-1 text-[11.5px] font-medium text-[#1E2926]">
                        {emp.summaryLine}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] text-[#1F564C]">
                        <span className="inline-flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          {emp.protectedWindowSlot ?? 'Janela protegida do turno'}
                        </span>
                        <span className="text-[#5A6561]">Ref.: {emp.referenceDoctor}</span>
                      </div>
                    </td>
                    <td className={TD_BASE}>
                      <RowActions
                        employee={emp}
                        onOpenProfile={onOpenProfile}
                        onSendWhatsApp={onSendWhatsApp}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

interface RowActionsProps {
  employee: Employee;
  onOpenProfile: (employeeId: string) => void;
  onSendWhatsApp: (employeeId: string) => void;
}

/**
 * REGRA DE NEGÓCIO 4: Ordem obrigatória dos botões:
 * 1º `[ Abrir Ficha ]` (à esquerda)
 * 2º `[ Enviar ]` (à direita)
 */
function RowActions({ employee, onOpenProfile, onSendWhatsApp }: RowActionsProps) {
  const sent = employee.sentStatus;
  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={() => onOpenProfile(employee.id)}
        className="shrink-0 rounded-lg border border-[#1F564C] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1F564C] transition-colors hover:bg-[#EEF6F3]"
      >
        Abrir Ficha
      </button>
      <button
        type="button"
        onClick={() => onSendWhatsApp(employee.id)}
        disabled={sent}
        className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
          sent
            ? 'cursor-default border-[#C6E4DA] bg-[#EEF6F3] text-[#1F564C]'
            : 'border-[#1F564C] bg-[#1F564C] text-white hover:bg-[#163F37]'
        }`}
      >
        {sent ? (
          <>
            <Check className="h-3 w-3" aria-hidden="true" /> Enviado
          </>
        ) : (
          <>
            <Send className="h-3 w-3" aria-hidden="true" /> Enviar
          </>
        )}
      </button>
    </div>
  );
}

export default DualQueueView;
