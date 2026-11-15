import { ArrowRight, BarChart3, Info, Linkedin, ShieldCheck, Stethoscope, Users } from 'lucide-react';
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

/** Criadores do projeto. `linkedin` vazio = mostra só o nome, sem link. */
const CREATORS: { name: string; linkedin?: string }[] = [
  { name: 'Calyson Andrade Britto', linkedin: 'https://www.linkedin.com/in/calyson-britto/' },
  { name: 'Carlos Henrique Gonzaga Lima', linkedin: 'https://www.linkedin.com/in/carlos-henrique-487b0a260/' },
  { name: 'Gabriel Boaventura Silva' },
  { name: 'Pedro Henrique Silva Souza Filho', linkedin: 'https://www.linkedin.com/in/pedro-henrique-211b70346/' },
  { name: 'Thiago Bastos Cerqueira', linkedin: 'https://www.linkedin.com/in/teagar/' },
];

function initials(name: string): string {
  const parts = name.split(' ');
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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

        <div className="space-y-5">
          <div
            role="note"
            className="mx-auto flex max-w-3xl items-start gap-3 rounded-xl border border-[#F5DFB8] bg-[#FDF7EC] px-4 py-3 text-left"
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#C26D27] text-white">
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <p className="text-[12.5px] leading-relaxed text-[#7A4A1E]">
              <strong className="font-semibold text-[#5C3714]">Acesso livre só nesta demonstração.</strong>{' '}
              Os três ambientes abaixo estão abertos para a banca conhecer o sistema. Na aplicação real,
              cada usuário entra com login e acessa <strong className="font-semibold">apenas a sua rota</strong>:
              a equipe de saúde vê <code className="font-mono text-[11.5px]">/home</code>, a coordenação vê{' '}
              <code className="font-mono text-[11.5px]">/admin</code> e o gestor da empresa vê só{' '}
              <code className="font-mono text-[11.5px]">/gestor</code>, com dados anônimos.
            </p>
          </div>

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

        </div>

        <footer className="flex flex-col items-center gap-3 border-t border-[#D5DAE1] pt-8 text-center">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#475467]">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            Criado por
          </span>
          <ul className="flex flex-wrap justify-center gap-2">
            {CREATORS.map(({ name, linkedin }) => {
              const chip =
                'inline-flex items-center gap-2 rounded-full border border-[#E4E7EC] bg-white py-1 pl-1 pr-3 text-[12px] font-medium text-[#344054] shadow-xs';
              const avatar = (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ECF8F3] text-[10px] font-semibold text-[#0E7A5F]">
                  {initials(name)}
                </span>
              );
              return (
                <li key={name}>
                  {linkedin ? (
                    <a
                      href={linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`LinkedIn de ${name}`}
                      className={`${chip} hover:border-[#0A66C2] hover:text-[#0A66C2]`}
                    >
                      {avatar}
                      {name}
                      <Linkedin className="h-3.5 w-3.5 text-[#0A66C2]" aria-label="LinkedIn" />
                    </a>
                  ) : (
                    <span className={chip}>
                      {avatar}
                      {name}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-[#98A2B3]">
            Hackathon SESI Saúde 2026 · todos os dados são fictícios
          </p>
        </footer>
      </div>
    </div>
  );
}

export default LandingPortal;
