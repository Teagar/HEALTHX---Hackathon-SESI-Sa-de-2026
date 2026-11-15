import {
  Database,
  FileScan,
  Menu,
  RotateCcw,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react';
import type { ChannelTab, DatabaseConnectionStatus, Employee } from '../types';
import { getActiveSearchQueue, getReturnPriorityQueue } from '../queueService';

export interface TopBarProps {
  employees: Employee[];
  activeChannel: ChannelTab;
  onChannelChange: (channel: ChannelTab) => void;
  onOpenNewEmployeeOcr: () => void;
  onResetDemo: () => void;
  onToggleMobileSidebar?: () => void;
  dbStatus?: DatabaseConnectionStatus | null;
}

const CHANNELS: { id: ChannelTab; label: string; mobileLabel: string }[] = [
  {
    id: 'medical',
    label: 'Equipe de Saúde (APS)',
    mobileLabel: 'Saúde APS',
  },
  {
    id: 'admin',
    label: 'Coordenação & Agenda Integrada',
    mobileLabel: 'Coordenação',
  },
  {
    id: 'company_b2b',
    label: 'Portal da Empresa (LGPD)',
    mobileLabel: 'Empresa',
  },
];

export function TopBar({
  employees,
  activeChannel,
  onChannelChange,
  onOpenNewEmployeeOcr,
  onResetDemo,
  onToggleMobileSidebar,
  dbStatus,
}: TopBarProps) {
  const activeCount = employees.filter((e) => e.status !== 'INATIVO').length;
  const returnCount = getReturnPriorityQueue(employees).length;
  const activeSearchCount = getActiveSearchQueue(employees).length;

  return (
    <header className="flex min-h-[56px] shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#E2DDD3] bg-white px-3 py-2 sm:px-5">
      {/* Identidade e Gatilho Mobile */}
      <div className="flex min-w-0 items-center gap-2.5">
        {activeChannel === 'medical' && onToggleMobileSidebar && (
          <button
            type="button"
            onClick={onToggleMobileSidebar}
            aria-label="Abrir lista de empresas e funcionários"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#DCD7CC] bg-[#FAF9F6] text-[#1E2926] lg:hidden"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>
        )}

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1F564C] text-white">
          <Stethoscope className="h-4 w-4" aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13.5px] font-bold tracking-tight text-[#1E2926]">
              SESI Saúde Acolhe
            </span>
            <span className="hidden rounded-full bg-[#EEF6F3] px-2 py-0.5 text-[10px] font-semibold text-[#1F564C] md:inline-block">
              Coordenação do Cuidado
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10.5px] text-[#5A6561]">
            <span className="inline-flex items-center gap-1">
              <Database className="h-3 w-3 text-[#1F564C]" aria-hidden="true" />
              {dbStatus?.totalEmployeesPersisted ?? employees.length} registros ({activeCount} ativos)
            </span>
            <span className="hidden text-[#C8C2B6] sm:inline">•</span>
            <span className="hidden sm:inline">
              {returnCount} em retorno · {activeSearchCount} busca ativa
            </span>
          </div>
        </div>
      </div>

      {/* Seletor Minimalista de Canais */}
      <nav
        className="order-3 flex w-full items-center justify-center gap-1 rounded-xl bg-[#F4F1EA] p-1 sm:order-2 sm:w-auto"
        aria-label="Navegação de módulos"
      >
        {CHANNELS.map((channel) => {
          const isActive = activeChannel === channel.id;
          return (
            <button
              key={channel.id}
              type="button"
              onClick={() => onChannelChange(channel.id)}
              aria-pressed={isActive}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-semibold transition-all sm:flex-initial ${
                isActive
                  ? 'bg-[#1F564C] text-white shadow-sm'
                  : 'text-[#5A6561] hover:text-[#1E2926]'
              }`}
            >
              {channel.id === 'company_b2b' ? (
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : channel.id === 'admin' ? (
                <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <Stethoscope className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              )}
              <span className="hidden md:inline">{channel.label}</span>
              <span className="md:hidden">{channel.mobileLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* Ações Rápidas da Via Interna */}
      <div className="order-2 flex items-center gap-2 sm:order-3">
        <button
          type="button"
          onClick={onOpenNewEmployeeOcr}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#1F564C] bg-[#1F564C] px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-sm transition-colors hover:bg-[#163F37]"
        >
          <FileScan className="h-3.5 w-3.5" aria-hidden="true" />
          <span>+ Inserir Ficha (OCR)</span>
        </button>

        <button
          type="button"
          onClick={onResetDemo}
          title="Recarregar censo padrão de 100 registros"
          className="inline-flex items-center gap-1 rounded-lg border border-[#DCD7CC] bg-[#FAF9F6] px-2.5 py-1.5 text-[11px] font-medium text-[#5A6561] transition-colors hover:border-[#1E2926] hover:text-[#1E2926]"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden xl:inline">Recarregar Base</span>
        </button>
      </div>
    </header>
  );
}

export default TopBar;
