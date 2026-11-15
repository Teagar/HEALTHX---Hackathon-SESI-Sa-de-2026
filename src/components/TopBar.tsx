import {
  ArrowLeft,
  Database,
  FileScan,
  Home,
  Menu,
  RotateCcw,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react';
import type { AppRoute, DatabaseConnectionStatus, Employee } from '../types';
import { getActiveSearchQueue, getReturnPriorityQueue } from '../queueService';

export interface TopBarProps {
  employees: Employee[];
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  onOpenNewEmployeeOcr: () => void;
  onResetDemo: () => void;
  onToggleMobileSidebar?: () => void;
  dbStatus?: DatabaseConnectionStatus | null;
}

const ROUTE_META: Record<
  Exclude<AppRoute, '/'>,
  { title: string; subtitle: string; badge: string }
> = {
  '/home': {
    title: 'SESILITA — Equipe de Saúde (APS)',
    subtitle: 'Coordenação do Cuidado, Filas Prioritárias e Prontuário S+',
    badge: 'Rota /home',
  },
  '/admin': {
    title: 'SESILITA — Coordenação & Inteligência APS',
    subtitle: 'Sincronização S+ / Teams, Indicadores Assistenciais e Base Oficial',
    badge: 'Rota /admin',
  },
  '/gestor': {
    title: 'SESILITA — Portal do Gestor / RH',
    subtitle: 'Indicadores Operacionais e Economia de Produção (Escopo Anônimo LGPD)',
    badge: 'Rota /gestor',
  },
};

export function TopBar({
  employees,
  currentRoute,
  onNavigate,
  onOpenNewEmployeeOcr,
  onResetDemo,
  onToggleMobileSidebar,
  dbStatus,
}: TopBarProps) {
  const activeCount = employees.filter((e) => e.status !== 'INATIVO').length;
  const returnCount = getReturnPriorityQueue(employees).length;
  const activeSearchCount = getActiveSearchQueue(employees).length;
  const routeKey: Exclude<AppRoute, '/'> =
    currentRoute === '/' ? '/home' : currentRoute;
  const meta = ROUTE_META[routeKey];

  return (
    <header className="flex min-h-[56px] shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#D5DAE1] bg-white px-3 py-2 sm:px-5">
      {/* Identidade, Botão Início e Gatilho Mobile */}
      <div className="flex min-w-0 items-center gap-2.5">
        {currentRoute === '/home' && onToggleMobileSidebar && (
          <button
            type="button"
            onClick={onToggleMobileSidebar}
            aria-label="Abrir lista de empresas e funcionários"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] text-[#101828] lg:hidden"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>
        )}

        <button
          type="button"
          onClick={() => onNavigate('/')}
          title="Voltar à Página Inicial de Seleção de Rotas"
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] px-2.5 py-1.5 text-[11.5px] font-semibold text-[#101828] transition-colors hover:border-[#0E7A5F] hover:bg-[#ECF8F3] hover:text-[#0E7A5F]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <Home className="h-3.5 w-3.5 text-[#0E7A5F]" aria-hidden="true" />
          <span className="hidden sm:inline">Início</span>
        </button>

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0E7A5F] text-white">
          {currentRoute === '/gestor' ? (
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          ) : currentRoute === '/admin' ? (
            <Users className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Stethoscope className="h-4 w-4" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13.5px] font-semibold tracking-tight text-[#101828]">
              {meta.title}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10.5px] text-[#475467]">
            {currentRoute === '/gestor' ? (
              <span>
                Visualização agregada por unidade industrial • Dados clínicos e individuais bloqueados (LGPD)
              </span>
            ) : (
              <>
                <span className="inline-flex items-center gap-1">
                  <Database className="h-3 w-3 text-[#0E7A5F]" aria-hidden="true" />
                  {dbStatus?.totalEmployeesPersisted ?? employees.length} registros ({activeCount} ativos)
                </span>
                <span className="hidden text-[#D0D5DD] sm:inline">•</span>
                <span className="hidden sm:inline">
                  {returnCount} em retorno · {activeSearchCount} busca ativa
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Ações Contextuais por Rota */}
      <div className="flex items-center gap-2">
        {currentRoute === '/home' && (
          <button
            type="button"
            onClick={onOpenNewEmployeeOcr}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#0E7A5F] bg-[#0E7A5F] px-3.5 py-1.5 text-[11.5px] font-semibold text-white shadow-sm transition-colors hover:bg-[#0B5F4A]"
          >
            <FileScan className="h-3.5 w-3.5" aria-hidden="true" />
            <span>+ Nova Ficha / Importar Documentos</span>
          </button>
        )}

        {currentRoute === '/admin' && (
          <button
            type="button"
            onClick={onResetDemo}
            title="Desfaz as alterações e volta aos 100 registros iniciais da demonstração"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] px-3 py-1.5 text-[11.5px] font-semibold text-[#101828] transition-colors hover:border-[#0E7A5F] hover:bg-[#ECF8F3] hover:text-[#0E7A5F]"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Restaurar demo</span>
          </button>
        )}

        {currentRoute === '/gestor' && (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#C7EADC] bg-[#ECF8F3] px-3 py-1.5 text-[11px] font-semibold text-[#0E7A5F]">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Trava LGPD Ativa (N ≥ 5)</span>
          </span>
        )}
      </div>
    </header>
  );
}

export default TopBar;
