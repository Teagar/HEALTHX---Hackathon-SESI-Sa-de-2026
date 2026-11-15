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
  return (
    <div className="min-h-[calc(100vh/var(--ui-zoom))] w-full overflow-y-auto bg-[#E2DDD3] text-[#1E2926]">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
        <header className="flex flex-col items-start gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1F564C] text-white">
              <Stethoscope className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">SESILITA</h1>
              <p className="text-[12px] text-[#5A6561]">
                Coordenação do Cuidado do SESI Saúde Acolhe · Atenção Primária Corporativa
              </p>
            </div>
          </div>
          <p className="max-w-2xl text-[13px] leading-relaxed text-[#5A6561]">
            Selecione o ambiente de acesso. Cada perfil enxerga apenas as informações compatíveis
            com sua função — os dados clínicos permanecem restritos à Equipe de Saúde.
          </p>
          <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
            <span className="rounded-full border border-[#C6E4DA] bg-[#EEF6F3] px-3 py-1 text-[#1F564C]">
              {activeEmployees} vidas ativas
            </span>
            <span className="rounded-full border border-[#D5CFC3] bg-[#FAF9F6] px-3 py-1 text-[#5A6561]">
              {totalEmployees} vínculos cadastrados
            </span>
            <span className="rounded-full border border-[#D5CFC3] bg-[#FAF9F6] px-3 py-1 text-[#5A6561]">
              {companiesCount} empresas contratantes
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.route}
                type="button"
                onClick={() => onNavigate(card.route)}
                className="group flex flex-col justify-between gap-5 rounded-2xl border border-[#D5CFC3] bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#1F564C] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#1F564C]/30"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF6F3] text-[#1F564C]">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="rounded-md bg-[#F2EFE8] px-2 py-0.5 font-mono text-[10.5px] font-semibold text-[#5A6561]">
                      {card.route}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-[15px] font-bold">{card.title}</h2>
                    <p className="text-[11px] font-medium text-[#1F564C]">{card.audience}</p>
                  </div>
                  <p className="text-[12px] leading-relaxed text-[#5A6561]">{card.description}</p>
                  <ul className="space-y-1 text-[11.5px] text-[#1E2926]">
                    {card.bullets.map((b) => (
                      <li key={b} className="flex gap-1.5">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1F564C]" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <span className="inline-flex items-center gap-1.5 self-start rounded-lg bg-[#1F564C] px-3.5 py-2 text-[12px] font-semibold text-white transition-colors group-hover:bg-[#163F37]">
                  Acessar
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default LandingPortal;
