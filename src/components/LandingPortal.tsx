import { ArrowRight, BarChart3, ShieldCheck, Stethoscope } from 'lucide-react';
import type { AppRoute } from '../types';

export interface LandingPortalProps {
  onNavigate: (route: AppRoute) => void;
  totalEmployees: number;
  activeEmployees: number;
  companiesCount: number;
}

const CARDS: {
  route: Exclude<AppRoute, '/'>;
  title: string;
  audience: string;
  description: string;
  bullets: string[];
  icon: typeof Stethoscope;
}[] = [
  {
    route: '/home',
    title: 'Equipe de Saúde (APS)',
    audience: 'Médicos de Família, Enfermagem, Psicologia e Nutrição',
    description:
      'Filas prioritárias de retorno e busca ativa, ficha única do funcionário e importação de documentos.',
    bullets: [
      'Dupla fila: risco clínico × dias sem 1ª consulta',
      'Ficha única editável (Gestão do Cuidado, PCI e Retorno)',
      'Importação de documentos e leitura de prontuário/exames',
    ],
    icon: Stethoscope,
  },
  {
    route: '/admin',
    title: 'Coordenação & Inteligência APS',
    audience: 'Coordenação regional do programa',
    description:
      'Sincronização de agenda (S+ / Teams), busca ativa automatizada, indicadores assistenciais e base oficial.',
    bullets: [
      'Painel epidemiológico e carteira por médico',
      'Eficiência de agenda e horas produtivas preservadas',
      'Conectores, banco de dados e recarga da base',
    ],
    icon: BarChart3,
  },
  {
    route: '/gestor',
    title: 'Portal do Gestor / RH',
    audience: 'Empresa contratante (acesso anônimo)',
    description:
      'Indicadores operacionais e economia de produção da unidade, sem qualquer dado clínico ou individual.',
    bullets: [
      'Cobertura da carteira e assiduidade nas janelas de turno',
      'Economia de produção (horas e turnos preservados)',
      'Trava LGPD: agregados apenas com N ≥ 5',
    ],
    icon: ShieldCheck,
  },
];

export function LandingPortal({
  onNavigate,
  totalEmployees,
  activeEmployees,
  companiesCount,
}: LandingPortalProps) {
  const stats = [
    { value: activeEmployees, label: 'vidas ativas' },
    { value: totalEmployees, label: 'vínculos cadastrados' },
    { value: companiesCount, label: 'empresas contratantes' },
  ];

  return (
    <div className="relative min-h-[calc(100vh/var(--ui-zoom))] w-full overflow-y-auto bg-[#E4E8EE] text-[#101828]">
      {/* Brilho suave no topo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,#D5EDE2_0%,rgba(228,232,238,0)_100%)]"
      />

      <div className="relative mx-auto flex min-h-[calc(100vh/var(--ui-zoom))] max-w-6xl flex-col justify-center gap-12 px-5 py-12 sm:px-8">
        <header className="flex flex-col items-center gap-5 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#E4E7EC] bg-white px-3 py-1 text-[11px] font-medium text-[#475467] shadow-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0E7A5F]" />
            SESI Saúde Acolhe · Atenção Primária Corporativa
          </span>

          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0E7A5F] text-white shadow-md">
              <Stethoscope className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="text-[34px] font-semibold leading-none tracking-tight sm:text-[40px]">
              SESILITA
            </h1>
          </div>

          <p className="max-w-xl text-[14.5px] leading-relaxed text-[#475467]">
            Coordenação do cuidado sem planilha manual. Escolha seu ambiente: cada perfil vê só o
            que precisa, e os dados clínicos ficam restritos à Equipe de Saúde.
          </p>

          <dl className="mt-1 flex flex-wrap items-center justify-center divide-x divide-[#EAECF0] rounded-2xl border border-[#EAECF0] bg-white shadow-xs">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center px-6 py-3">
                <dt className="order-2 text-[11px] text-[#475467]">{stat.label}</dt>
                <dd className="order-1 text-[20px] font-semibold tracking-tight text-[#101828]">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </header>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.route}
                type="button"
                onClick={() => onNavigate(card.route)}
                className="group flex flex-col gap-5 rounded-2xl border border-[#EAECF0] bg-white p-6 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[#C7EADC] hover:shadow-lg"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ECF8F3] text-[#0E7A5F] transition-colors group-hover:bg-[#0E7A5F] group-hover:text-white">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>

                <div className="space-y-1.5">
                  <h2 className="text-[16px] font-semibold tracking-tight">{card.title}</h2>
                  <p className="text-[11.5px] font-medium text-[#0E7A5F]">{card.audience}</p>
                  <p className="pt-1 text-[12.5px] leading-relaxed text-[#475467]">
                    {card.description}
                  </p>
                </div>

                <ul className="space-y-2 border-t border-[#F2F4F7] pt-4 text-[12px] text-[#344054]">
                  {card.bullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#0E7A5F]" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                <span className="mt-auto inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#0E7A5F]">
                  Acessar
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-center text-[11px] text-[#98A2B3]">
          Demonstração do Hackathon SESI Saúde 2026 · todos os dados são fictícios
        </p>
      </div>
    </div>
  );
}

export default LandingPortal;
