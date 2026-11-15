import { ArrowRight, CalendarClock, Info, ListOrdered } from 'lucide-react';
import type { RiskLevel } from '../types';

/**
 * Protocolo de Classificação de Risco da APS SESI (Regra de Negócio 2): o que é cada nível,
 * fatores típicos, prazo de retorno e onde a pessoa aparece nas filas.
 * Os fatores são exemplos para orientar a equipe; a classificação final é do profissional.
 */
interface RiskInfo {
  level: RiskLevel;
  name: string;
  summary: string;
  factors: string[];
  returnRule: string;
  queue: string;
  colors: { text: string; bg: string; border: string; solid: string };
}

export const RISK_PROTOCOL: RiskInfo[] = [
  {
    level: 4,
    name: 'Crítico / descompensado',
    summary:
      'Doença ativa fora de controle ou sintoma que já afeta o trabalho. Precisa de acompanhamento próximo até estabilizar.',
    factors: [
      'Hipertensão descompensada (pressão persistentemente alta apesar do tratamento)',
      'Diabetes fora da meta (ex.: HbA1c acima de 9%)',
      'Dor osteomuscular aguda e recorrente, com uso de anti-inflamatório sem receita',
      'Ansiedade ou depressão em fase de estabilização',
      'Somados a hábitos que pioram o quadro: sono curto, sedentarismo, excesso de sal no turno',
    ],
    returnRule: 'Quinzenal (15 dias) ou mensal (30 dias), a critério médico',
    queue: 'Topo da fila de retorno (janela superior)',
    colors: { text: 'text-[#C84B31]', bg: 'bg-[#FDF2F0]', border: 'border-[#F5C6BC]', solid: 'bg-[#C84B31]' },
  },
  {
    level: 3,
    name: 'Compensado com comorbidade',
    summary:
      'Tem doença crônica ou de saúde mental, mas está controlada com tratamento. O objetivo é manter o controle.',
    factors: [
      'Hipertensão controlada com medicação',
      'Pré-diabetes ou diabetes na meta (ex.: HbA1c perto de 6%)',
      'Dislipidemia compensada',
      'Ansiedade ocupacional estabilizada, em acompanhamento',
      'Uso contínuo de medicação com boa adesão',
    ],
    returnRule: 'A cada 3 meses (90 dias)',
    queue: 'Fila de retorno, logo abaixo do risco 4',
    colors: { text: 'text-[#C26D27]', bg: 'bg-[#FDF7EC]', border: 'border-[#F5DFB8]', solid: 'bg-[#C26D27]' },
  },
  {
    level: 2,
    name: 'Saudável com fator de risco',
    summary:
      'Ainda sem doença diagnosticada, mas com um fator que aumenta a chance de adoecer. O foco é prevenção.',
    factors: [
      'Sobrepeso ou obesidade (ex.: IMC acima de 25)',
      'Colesterol ou triglicerídeos alterados, sem doença instalada',
      'Tabagismo ou consumo de álcool acima do recomendado',
      'Sedentarismo ou tensão muscular leve ligada ao posto de trabalho',
    ],
    returnRule: 'A cada 6 meses (180 dias)',
    queue: 'Fila de retorno, depois dos riscos 4 e 3',
    colors: { text: 'text-[#A16207]', bg: 'bg-[#FEFCE8]', border: 'border-[#FDE68A]', solid: 'bg-[#A16207]' },
  },
  {
    level: 1,
    name: 'Saudável',
    summary:
      'Sem doença e sem fator de risco relevante. Mantém o acompanhamento preventivo, vacinas e rastreios em dia.',
    factors: [
      'Sem doenças crônicas nem fatores de risco ativos',
      'Atividade física regular e sono reparador',
      'Não fumante',
      'Vacinas e exames de rastreio em dia',
    ],
    returnRule: 'A cada 6 meses (180 dias), preventivo',
    queue: 'Final da fila de retorno',
    colors: { text: 'text-[#0E7A5F]', bg: 'bg-[#ECF8F3]', border: 'border-[#C7EADC]', solid: 'bg-[#0E7A5F]' },
  },
  {
    level: 0,
    name: 'Sem avaliação',
    summary:
      'Trabalhador ativo que ainda não fez a 1ª consulta de acolhimento, então o risco é desconhecido.',
    factors: [
      'Nunca agendou ou nunca compareceu à 1ª consulta',
      'Quanto mais dias desde a ativação, maior a prioridade',
      'Acima de 140 dias entra no lote automático da busca ativa',
    ],
    returnRule: 'Busca ativa até a 1ª consulta',
    queue: 'Fila de busca ativa (janela inferior), por dias sem agendar',
    colors: { text: 'text-[#64748B]', bg: 'bg-[#F1F5F9]', border: 'border-[#CBD5E1]', solid: 'bg-[#64748B]' },
  },
];

export function RiskProtocolGuide({ compact = false }: { compact?: boolean }) {
  return (
    <div className="space-y-4">
      {!compact && (
        <div>
          <h2 className="text-[14px] font-semibold tracking-tight text-[#101828]">
            Classificação de risco da APS SESI
          </h2>
          <p className="mt-0.5 text-[12px] text-[#475467]">
            Define a ordem da fila e o prazo do próximo retorno de cada trabalhador.
          </p>
        </div>
      )}

      {/* Fluxo entre as filas */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] px-3.5 py-2.5 text-[11.5px] text-[#344054]">
        <ListOrdered className="h-4 w-4 shrink-0 text-[#475467]" aria-hidden="true" />
        <span>
          <strong className="font-semibold">Risco 0</strong> fica na busca ativa
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-[#98A2B3]" aria-hidden="true" />
        <span>1ª consulta registrada</span>
        <ArrowRight className="h-3.5 w-3.5 text-[#98A2B3]" aria-hidden="true" />
        <span>
          recebe <strong className="font-semibold">risco 1 a 4</strong> e passa para a fila de retorno
        </span>
      </div>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {RISK_PROTOCOL.map((risk) => (
          <li
            key={risk.level}
            className={`flex flex-col overflow-hidden rounded-xl border bg-white ${risk.colors.border}`}
          >
            <div className={`flex items-center gap-2.5 border-b px-3.5 py-2.5 ${risk.colors.bg} ${risk.colors.border}`}>
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[14px] font-bold text-white ${risk.colors.solid}`}
              >
                {risk.level}
              </span>
              <div className="min-w-0">
                <p className={`text-[10.5px] font-semibold uppercase tracking-wider ${risk.colors.text}`}>
                  Risco {risk.level}
                </p>
                <p className="text-[13px] font-semibold leading-tight text-[#101828]">{risk.name}</p>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-3 p-3.5">
              <p className="text-[12px] leading-relaxed text-[#344054]">{risk.summary}</p>

              <div>
                <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-[#475467]">
                  {risk.level === 0 ? 'Como é priorizado' : 'Fatores típicos'}
                </p>
                <ul className="space-y-1">
                  {risk.factors.map((factor) => (
                    <li key={factor} className="flex gap-2 text-[11.5px] leading-snug text-[#344054]">
                      <span className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${risk.colors.solid}`} />
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-auto space-y-1 border-t border-[#F2F4F7] pt-2.5 text-[11.5px]">
                <p className="flex items-start gap-1.5 text-[#101828]">
                  <CalendarClock className={`mt-px h-3.5 w-3.5 shrink-0 ${risk.colors.text}`} aria-hidden="true" />
                  <span>
                    <span className="font-semibold">Retorno:</span> {risk.returnRule}
                  </span>
                </p>
                <p className="pl-5 text-[#475467]">{risk.queue}</p>
              </div>
            </div>
          </li>
        ))}

        <li className="flex flex-col justify-center gap-2 rounded-xl border border-dashed border-[#D0D5DD] bg-[#F9FAFB] p-4 text-[11.5px] leading-relaxed text-[#475467]">
          <span className="flex items-center gap-1.5 font-semibold text-[#344054]">
            <Info className="h-4 w-4" aria-hidden="true" />
            Quem decide o risco
          </span>
          Os fatores acima são exemplos para orientar a equipe. A classificação final é do médico ou
          enfermeiro na consulta, e o sistema recalcula sozinho a data do próximo retorno ao salvar a ficha.
        </li>
      </ul>
    </div>
  );
}

export default RiskProtocolGuide;
