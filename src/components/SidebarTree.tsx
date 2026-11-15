import { useMemo, useState } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  LayoutList,
  Search,
  Users,
  X,
} from 'lucide-react';
import type { Employee, RiskLevel } from '../types';

export interface SidebarTreeProps {
  employees: Employee[];
  selectedEmployeeId: string | null;
  onSelectEmployee: (employeeId: string | null) => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface RiskStyle {
  dotClassName: string;
  badgeClassName: string;
  label: string;
}

const RISK_STYLES: Record<RiskLevel, RiskStyle> = {
  4: {
    dotClassName: 'bg-[#C84B31]',
    badgeClassName: 'border-[#F5C6BC] bg-[#FDF2F0] text-[#C84B31]',
    label: 'R4',
  },
  3: {
    dotClassName: 'bg-[#C26D27]',
    badgeClassName: 'border-[#F5DFB8] bg-[#FDF7EC] text-[#C26D27]',
    label: 'R3',
  },
  2: {
    dotClassName: 'bg-[#A16207]',
    badgeClassName: 'border-[#FDE68A] bg-[#FEFCE8] text-[#A16207]',
    label: 'R2',
  },
  1: {
    dotClassName: 'bg-[#0E7A5F]',
    badgeClassName: 'border-[#C7EADC] bg-[#ECF8F3] text-[#0E7A5F]',
    label: 'R1',
  },
  0: {
    dotClassName: 'bg-[#94A3B8]',
    badgeClassName: 'border-[#CBD5E1] bg-[#F1F5F9] text-[#64748B]',
    label: 'R0',
  },
};

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function sortEmployees(a: Employee, b: Employee): number {
  if (a.status !== b.status) return a.status === 'INATIVO' ? 1 : -1;
  const aPending = a.neverScheduled || a.riskLevel === 0;
  const bPending = b.neverScheduled || b.riskLevel === 0;
  if (aPending !== bPending) return aPending ? 1 : -1;
  if (b.riskLevel !== a.riskLevel) return b.riskLevel - a.riskLevel;
  if (aPending && b.daysSinceActivation !== a.daysSinceActivation) {
    return b.daysSinceActivation - a.daysSinceActivation;
  }
  return a.name.localeCompare(b.name, 'pt-BR');
}

export function SidebarTree({
  employees,
  selectedEmployeeId,
  onSelectEmployee,
  mobileOpen = false,
  onCloseMobile,
}: SidebarTreeProps) {
  const [query, setQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(false);
  // Todos os containers de empresa iniciam colapsados por padrão e só expandem mediante interação do usuário
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(
    () => new Set()
  );

  const normalizedQuery = normalizeText(query);
  const isSearching = normalizedQuery.length > 0;

  const activeCount = useMemo(
    () => employees.filter((e) => e.status !== 'INATIVO').length,
    [employees]
  );
  const inactiveCount = useMemo(
    () => employees.filter((e) => e.status === 'INATIVO').length,
    [employees]
  );

  const companies = useMemo(() => {
    const map = new Map<string, { id: string; name: string; unit: string; total: number }>();
    employees.forEach((emp) => {
      if (!showInactive && emp.status === 'INATIVO') return;
      const existing = map.get(emp.companyId);
      if (existing) {
        existing.total += 1;
      } else {
        map.set(emp.companyId, {
          id: emp.companyId,
          name: emp.companyName,
          unit: emp.companyUnit,
          total: 1,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [employees, showInactive]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (!showInactive && emp.status === 'INATIVO') return false;
      if (companyFilter !== 'all' && emp.companyId !== companyFilter) return false;
      if (!isSearching) return true;
      const haystack = normalizeText(
        [
          emp.name,
          emp.matricula,
          emp.cpf,
          emp.companyName,
          emp.referenceDoctor,
          emp.summaryLine,
        ].join(' ')
      );
      return haystack.includes(normalizedQuery);
    });
  }, [employees, showInactive, companyFilter, isSearching, normalizedQuery]);

  const groupedCompanies = useMemo(() => {
    const groups = new Map<
      string,
      { company: (typeof companies)[number]; members: Employee[] }
    >();
    filteredEmployees.forEach((emp) => {
      const company = companies.find((item) => item.id === emp.companyId);
      if (!company) return;
      const group = groups.get(emp.companyId);
      if (group) {
        group.members.push(emp);
      } else {
        groups.set(emp.companyId, { company, members: [emp] });
      }
    });
    return Array.from(groups.values())
      .map((group) => ({ ...group, members: [...group.members].sort(sortEmployees) }))
      .sort((a, b) => a.company.name.localeCompare(b.company.name, 'pt-BR'));
  }, [filteredEmployees, companies]);

  const toggleCompany = (companyId: string) => {
    setExpandedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(companyId)) {
        next.delete(companyId);
      } else {
        next.add(companyId);
      }
      return next;
    });
  };

  const isCompanyExpanded = (companyId: string) =>
    isSearching || expandedCompanies.has(companyId);

  const handleSelect = (id: string | null) => {
    onSelectEmployee(id);
    if (onCloseMobile) onCloseMobile();
  };

  const content = (
    <aside className="flex h-full w-72 shrink-0 flex-col overflow-hidden border-r border-[#E4E7EC] bg-[#FFFFFF]">
      <div className="shrink-0 space-y-2.5 border-b border-[#E4E7EC] p-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12px] font-semibold transition-all ${
              selectedEmployeeId === null
                ? 'border-[#0E7A5F] bg-[#0E7A5F] text-white shadow-sm'
                : 'border-[#E4E7EC] bg-white text-[#101828] hover:border-[#0E7A5F]'
            }`}
          >
            <LayoutList className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Filas Prioritárias</span>
            <span
              className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                selectedEmployeeId === null
                  ? 'bg-white/20 text-white'
                  : 'bg-[#ECF8F3] text-[#0E7A5F]'
              }`}
            >
              {activeCount}
            </span>
          </button>

          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="rounded-lg border border-[#E4E7EC] bg-white p-2 text-[#475467] lg:hidden"
              aria-label="Fechar menu lateral"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#98A2B3]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar nome, matrícula ou médico..."
            aria-label="Buscar funcionário"
            className="w-full rounded-lg border border-[#E4E7EC] bg-white py-1.5 pl-8 pr-7 text-[11.5px] text-[#101828] placeholder:text-[#98A2B3] focus:border-[#0E7A5F] focus:outline-none"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Limpar busca"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-[#98A2B3] hover:text-[#101828]"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <select
          value={companyFilter}
          onChange={(event) => setCompanyFilter(event.target.value)}
          aria-label="Filtrar por empresa"
          className="w-full rounded-lg border border-[#E4E7EC] bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-[#101828] focus:border-[#0E7A5F] focus:outline-none"
        >
          <option value="all">Todas as 6 empresas ({filteredEmployees.length})</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name} ({company.total})
            </option>
          ))}
        </select>

        {inactiveCount > 0 && (
          <label className="flex cursor-pointer items-center justify-between rounded-md bg-white/70 px-2 py-1 text-[10.5px] text-[#475467]">
            <span>Exibir vínculos inativos ({inactiveCount})</span>
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-[#0E7A5F]"
            />
          </label>
        )}
      </div>

      {/* Lista de Empresas e Funcionários (containers iniciam colapsados) */}
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {groupedCompanies.length === 0 ? (
          <div className="mx-1 mt-4 rounded-xl border border-dashed border-[#E4E7EC] bg-white/80 px-3 py-6 text-center">
            <Users className="mx-auto h-5 w-5 text-[#98A2B3]" aria-hidden="true" />
            <p className="mt-2 text-[11.5px] font-semibold text-[#475467]">
              Nenhum registro encontrado
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {groupedCompanies.map(({ company, members }) => {
              const expanded = isCompanyExpanded(company.id);
              return (
                <li key={company.id}>
                  <button
                    type="button"
                    onClick={() => toggleCompany(company.id)}
                    aria-expanded={expanded}
                    className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[#E4E7EC]"
                  >
                    {expanded ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#475467]" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#475467]" />
                    )}
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-[#0E7A5F]" />
                    <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-[#101828]">
                      {company.name}
                    </span>
                    <span className="rounded-full bg-white px-1.5 py-0.5 text-[9.5px] font-semibold tabular-nums text-[#475467]">
                      {members.length}
                    </span>
                  </button>

                  {expanded && (
                    <ul className="mt-0.5 space-y-0.5 border-l border-[#E4E7EC] pl-2">
                      {members.map((emp) => {
                        const riskStyle = RISK_STYLES[emp.riskLevel];
                        const isSelected = selectedEmployeeId === emp.id;
                        const isInactive = emp.status === 'INATIVO';
                        const isPending = emp.neverScheduled || emp.riskLevel === 0;

                        return (
                          <li key={emp.id}>
                            <button
                              type="button"
                              onClick={() => handleSelect(emp.id)}
                              className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-all ${
                                isSelected
                                  ? 'border-[#0E7A5F] bg-white shadow-sm'
                                  : 'border-transparent hover:bg-white/70'
                              } ${isInactive ? 'opacity-60' : ''}`}
                            >
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${riskStyle.dotClassName}`}
                              />
                              <span className="min-w-0 flex-1">
                                <span
                                  className={`block truncate text-[11.5px] font-medium ${
                                    isSelected ? 'font-semibold text-[#0E7A5F]' : 'text-[#101828]'
                                  }`}
                                >
                                  {emp.name}
                                </span>
                                <span className="block truncate text-[9.5px] text-[#475467]">
                                  Mat. {emp.matricula} • {emp.referenceDoctor}
                                </span>
                              </span>
                              {isInactive ? (
                                <span className="shrink-0 rounded bg-[#E2E8F0] px-1 py-0.5 text-[9px] font-semibold text-[#475569]">
                                  Inativo
                                </span>
                              ) : isPending ? (
                                <span className="shrink-0 rounded border border-[#CBD5E1] bg-white px-1 py-0.5 text-[9.5px] font-semibold tabular-nums text-[#64748B]">
                                  {emp.daysSinceActivation}d
                                </span>
                              ) : (
                                <span
                                  className={`shrink-0 rounded border px-1 py-0.5 text-[9.5px] font-semibold ${riskStyle.badgeClassName}`}
                                >
                                  {riskStyle.label}
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-[#E4E7EC] px-3 py-2 text-[10px] font-medium text-[#475467]">
        Censo integral: {employees.length} registros ({activeCount} ativos • {inactiveCount} inativos)
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden h-full lg:block">{content}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#101828]/40 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 flex h-full">{content}</div>
        </div>
      )}
    </>
  );
}

export default SidebarTree;
