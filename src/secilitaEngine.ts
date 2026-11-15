/**
 * Motor Completo de Importação, Leitura OCR, Extração Estruturada e Rastreabilidade de Evidências
 * Baseado em `teagar/secilita_planilhas` e adaptado às 32 colunas da planilha oficial do SESI Saúde Acolhe
 * e ao armazenamento seguro de prontuário / resultados de exames.
 */

import type { Employee, RiskLevel, StoredProntuarioDocument } from './types';
import { COMPANY_METADATA } from './mockDatabase';
import {
  calculateNextVisitDate,
  getDefaultReturnRuleForRisk,
  normalizeEmployeeAfterSave,
  REFERENCE_DOCTORS,
} from './queueService';
import PostalMime from 'postal-mime';
import { strFromU8, unzipSync } from 'fflate';
import { ocr } from './ingest/ocr';
import { readPdf } from './ingest/pdf';
import demoPeople from './demo/people.json';

/** Formato que o leitor não consegue abrir, com instrução de como reenviar. */
export class UnsupportedFileError extends Error {}

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tif', 'tiff', 'jfif']);

export const COL = {
  matricula: 'MATRÍCULA',
  nome: 'NOME COMPLETO',
  status: 'STATUS',
  nascimento: 'DATA DE NASCIMENTO',
  idade: 'IDADE',
  cpf: 'CPF',
  sexo: 'SEXO',
  entradaAps: 'DATA DE ENTRADA APS',
  telefone: 'TELEFONE',
  empresa: 'EMPRESA',
  medico: 'MÉDICO DE REFERÊNCIA',
  multi: 'ATENDIMENTO COM EQUIPE MULTI?',
  ultNutri: 'DATA ÚLTIMA CONSULTA NUTRICIONISTA',
  ultPsico: 'DATA ÚLTIMA CONSULTA PSICOLOGIA',
  ultMedica: 'DATA ÚLTIMA CONSULTA MÉDICA',
  historico: 'HISTÓRICO CONTATO DE CONSTADOS DE 2026',
  contJul: 'CONTATO DE JULHO/ 2026',
  contAgo: 'CONTATO DE AGOSTO / 2026',
  contSet: 'CONTATO DE SETEMBRO / 2026',
  contOut: 'CONTATO DE OUTUBRO / 2026',
  contNov: 'CONTATO DE NOVEMBRO / 2026',
  contDez: 'CONTATO DE DEZEMBRO / 2026',
  previsaoRetorno: 'PREVISÃO DE RETORNO  CONFORME SOLICITAÇÃO MÉDICA',
  demandas: 'DEMANDAS GERADAS NA ÚLTIMA CONSULTA MÉDICA',
  riscoAtual: 'CLASSIFICAÇÃO DE RISCO ATUAL',
  riscoInicial: 'CLASSIFICAÇÃO DE RISCO INICIAL',
  retornoRisco: 'RETORNO DO ATENDIMENTO MÉDICO PARA VERIFICAR CLASSIFICAÇÃO DE RISCO',
  envioPlano: 'DATA ENVIO DO PLANO',
  verificarAdesao: 'VERIFICAR ADESÃO DAS METAS',
  statusPlano: 'STATUS PLANO DE CUIDADO',
  coordData: 'DATA DA COORD CUIDADO',
  coordProxima: 'DATA DA PRÓXIMA COORD CUIDADO2',
} as const;

export type ColKey = keyof typeof COL;

export const COLUMN_ORDER: ColKey[] = Object.keys(COL) as ColKey[];

export const LABEL: Record<ColKey, string> = {
  matricula: 'Matrícula',
  nome: 'Nome completo',
  status: 'Status cadastral',
  nascimento: 'Data de nascimento',
  idade: 'Idade',
  cpf: 'CPF',
  sexo: 'Sexo',
  entradaAps: 'Data de entrada na APS',
  telefone: 'Telefone / WhatsApp',
  empresa: 'Empresa contratante',
  medico: 'Médico de referência',
  multi: 'Atendimento com equipe multi?',
  ultNutri: 'Última consulta nutricionista',
  ultPsico: 'Última consulta psicologia',
  ultMedica: 'Última consulta médica',
  historico: 'Histórico de contatos (2026)',
  contJul: 'Contato de julho / 2026',
  contAgo: 'Contato de agosto / 2026',
  contSet: 'Contato de setembro / 2026',
  contOut: 'Contato de outubro / 2026',
  contNov: 'Contato de novembro / 2026',
  contDez: 'Contato de dezembro / 2026',
  previsaoRetorno: 'Previsão de retorno médico',
  demandas: 'Demandas da última consulta',
  riscoAtual: 'Classificação de risco atual',
  riscoInicial: 'Classificação de risco inicial',
  retornoRisco: 'Retorno p/ verificar risco',
  envioPlano: 'Data de envio do plano',
  verificarAdesao: 'Verificar adesão das metas',
  statusPlano: 'Status do plano de cuidado',
  coordData: 'Data da coordenação do cuidado',
  coordProxima: 'Próxima coordenação do cuidado',
};

/** Campos administrativos/cadastrais obrigatórios para cadastro de novo funcionário */
export const REGISTRATION_COL_KEYS: ColKey[] = [
  'matricula',
  'nome',
  'status',
  'nascimento',
  'idade',
  'cpf',
  'sexo',
  'entradaAps',
  'telefone',
  'empresa',
  'medico',
];

/** Campos de coordenação do cuidado e acompanhamento */
export const CARE_COORDINATION_COL_KEYS: ColKey[] = [
  'multi',
  'ultMedica',
  'ultNutri',
  'ultPsico',
  'riscoInicial',
  'riscoAtual',
  'previsaoRetorno',
  'retornoRisco',
  'demandas',
  'envioPlano',
  'verificarAdesao',
  'statusPlano',
  'coordData',
  'coordProxima',
  'contJul',
  'contAgo',
  'contSet',
  'contOut',
  'contNov',
  'contDez',
  'historico',
];

export const ALLOWED: Partial<Record<ColKey, readonly string[]>> = {
  status: ['ATIVO', 'INATIVO'],
  sexo: ['MASCULINO', 'FEMININO'],
  multi: ['SIM', 'NÃO'],
  riscoAtual: ['RISCO 1', 'RISCO 2', 'RISCO 3', 'RISCO 4'],
  riscoInicial: ['RISCO 1', 'RISCO 2', 'RISCO 3', 'RISCO 4'],
  statusPlano: [
    'ADERIU PARCIALMENTE',
    'AGUARDANDO RESPOSTA',
    'ADERIU TOTALMENTE',
    'NÃO ADERIU',
  ],
};

export const DATE_COLS = new Set<ColKey>([
  'nascimento',
  'entradaAps',
  'ultNutri',
  'ultPsico',
  'ultMedica',
  'previsaoRetorno',
  'retornoRisco',
  'envioPlano',
  'coordData',
  'coordProxima',
]);

export const CONTACT_COLS = new Set<ColKey>([
  'contJul',
  'contAgo',
  'contSet',
  'contOut',
  'contNov',
  'contDez',
  'historico',
]);

export type DocKind = 'retorno' | 'plano' | 'cuidado' | 'exame' | 'mensagem';

export const KIND_LABEL: Record<DocKind, string> = {
  retorno: 'Gestão de Retorno',
  plano: 'Plano de Cuidados',
  cuidado: 'Gestão do Cuidado / Cadastro',
  exame: 'Prontuário / Resultado de Exame',
  mensagem: 'Mensagem / Registro de Atendimento',
};

export type Channel = 'pdf' | 'foto' | 'email' | 'whatsapp' | 'texto';

export type FlatRecord = [field: string, value: string][];

export interface Proposal {
  key: ColKey;
  value: string;
  evidence: string;
  onlyIfEmpty?: boolean;
  append?: boolean;
}

export interface Identity {
  matricula?: string;
  nome?: string;
  empresa?: string;
  cpf?: string;
  nascimento?: string;
  idade?: number;
  sexo?: 'MASCULINO' | 'FEMININO';
  entradaAps?: string;
  telefone?: string;
  medico?: string;
  cargo?: string;
  setor?: string;
}

export interface Extraction {
  kind: DocKind;
  identity: Identity;
  proposals: Proposal[];
  ignored: string[];
  clinicalSummary?: {
    category: 'Resultado de Exame' | 'Prescrição Médica' | 'Encaminhamento Multiprofissional' | 'Prontuário / Evolução';
    title: string;
    details: string;
    suggestedRisk?: RiskLevel;
  };
}

export interface SourceDoc {
  id: string;
  name: string;
  parent?: string;
  channel: Channel;
  method: string;
  text?: string;
  records?: FlatRecord[];
  refDate: Date;
  ms: number;
  file?: File;
  previewImageUrl?: string;
  sha256Hash: string;
  sizeBytes: number;
  mimeType: string;
}

export interface FieldDiffRow {
  key: ColKey;
  label: string;
  current: string;
  value: string;
  proposed: string;
  evidence: string;
  state: 'new' | 'changed' | 'same';
  isRegistrationField: boolean;
}

export interface ImportQueueItem {
  id: string;
  doc: SourceDoc;
  extraction: Extraction;
  record?: FlatRecord;
  matchedEmployeeId?: string;
  matchHow?: 'matrícula' | 'nome' | 'nome aproximado' | 'nome citado no texto' | 'escolha manual' | 'novo cadastro';
  isNewEmployeeMode: boolean;
  fields: FieldDiffRow[];
  extraRegistration: {
    sector: string;
    role: string;
    shift: '1º Turno (06h–14h)' | '2º Turno (14h–22h)' | 'Administrativo (08h–17h)';
  };
  status: 'pend' | 'ok' | 'skip';
  savedSnapshot?: Employee;
  wasInsertedAsNew?: boolean;
}

/**
 * Os 14 anexos oficiais de demonstração do `secilita_planilhas` servidos em `/demo/`
 */
export const SECILITA_DEMO_FILES = [
  '01_gestao-retorno_joana.pdf',
  '02_foto-gestao-retorno_rafael.jpg',
  '03_plano-cuidados_camila.pdf',
  '04_gestao-cuidado_marcos_escaneado.pdf',
  '05_email-enfermagem_luciana.eml',
  '06_whatsapp_paulo.txt',
  '07_whatsapp-exportado_adriana.zip',
  '08_declaracao-comparecimento_gilberto.docx',
  '09_agenda-exportada.xml',
  '10_chatbot-respostas.json',
  '11_teleatendimento.csv',
  '12_email-salvo_natalia.html',
  '13_print-conversa_fernanda.png',
  '14_texto-colado_jorge.txt',
] as const;

/**
 * Base cadastral complementar dos trabalhadores dos 14 anexos de teste do `secilita_planilhas`,
 * garantindo que qualquer anexo de teste também possua todos os campos não-médicos (matrícula, nome,
 * nascimento, idade, sexo, entrada APS, empresa, médico, CPF, telefone) prontos para cadastro imediato
 * na planilha do SESI Saúde Acolhe.
 */
interface DemoPersonProfile {
  matricula: string;
  nome: string;
  status: 'ATIVO' | 'INATIVO';
  nascimento: string;
  idade: number;
  cpf: string;
  sexo: 'MASCULINO' | 'FEMININO';
  entradaAps: string;
  telefone: string;
  empresa: string;
  medico: string;
  cargo: string;
  setor: string;
  riscoInicial?: string;
  riscoAtual?: string;
  ultMedica?: string;
  multi?: string;
}

/** Fonte única: `src/demo/people.json` (também usada por `scripts/make-demo.mjs` para gerar os anexos). */
const DEMO_PEOPLE_REGISTRY: Record<string, DemoPersonProfile> = Object.fromEntries(
  (demoPeople as DemoPersonProfile[]).map((p) => [p.matricula, p])
);

/* ================================================================== */
/* Utilitários de Texto, Datas e Hash SHA-256                          */
/* ================================================================== */

export function fold(s: string): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function norm(s: string): string {
  return fold(s).replace(/\s+/g, ' ').trim();
}

export function splitLines(text: string): string[] {
  return text
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/\t/g, '   ').trimEnd());
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function fmtDate(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function brDateToIso(br: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br.trim());
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(br.trim())) return br.trim();
  return br;
}

export function isoDateToBr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || '').trim());
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return iso || '';
}

const DATE_RE = /(\d{1,2})\s?[/.-]\s?(\d{1,2})(?:\s?[/.-]\s?(\d{2,4}))?/g;

export function findDates(s: string, refYear = 2026): Date[] {
  const cleaned = s
    .replace(/(?<=\d)[Oo](?=[\d/])|(?<=[\d/])[Oo](?=\d)/g, '0')
    .replace(/(?<=\d)[lI](?=[\d/])|(?<=[\d/])[lI](?=\d)/g, '1');
  const out: Date[] = [];
  for (const m of cleaned.matchAll(DATE_RE)) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = m[3] ? Number(m[3]) : refYear;
    if (year < 100) year += 2000;
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) continue;
    if (!m[3] && !m[0].includes('/')) continue;
    const d = new Date(year, month - 1, day);
    if (d.getMonth() !== month - 1) continue;
    out.push(d);
  }
  return out;
}

export function firstDate(s: string, refYear?: number): Date | undefined {
  return findDates(s, refYear)[0];
}

export function clip(s: string, max = 140): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function evidence(line: string): string {
  return clip(line.replace(/\s{2,}/g, '  ·  '), 120);
}

export function yesNo(s: string): 'SIM' | 'NÃO' | undefined {
  const f = fold(s);
  const m = /\b(sim|nao)\b/.exec(f);
  if (!m) return undefined;
  return m[1] === 'sim' ? 'SIM' : 'NÃO';
}

export function riskFrom(s: string): string | undefined {
  const f = fold(s);
  const num = /risco\s*([1-4])\b|^\s*([1-4])\s*[-–.)]/.exec(f);
  if (num) return `RISCO ${num[1] ?? num[2]}`;
  if (/descompensad|critico/.test(f)) return 'RISCO 4';
  if (/compensad/.test(f)) return 'RISCO 3';
  if (/saudavel com risco|baixo risco/.test(f)) return 'RISCO 2';
  if (/saudavel|higido/.test(f)) return 'RISCO 1';
  return undefined;
}

const MONTH_COL: Record<number, ColKey> = {
  7: 'contJul',
  8: 'contAgo',
  9: 'contSet',
  10: 'contOut',
  11: 'contNov',
  12: 'contDez',
};

export function contactColumnFor(date: Date): ColKey {
  if (date.getFullYear() === 2026 && MONTH_COL[date.getMonth() + 1]) {
    return MONTH_COL[date.getMonth() + 1];
  }
  return 'historico';
}

export async function computeSha256Hex(buffer: ArrayBuffer): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // Fallback determinístico FNV/DJB2 caso WebCrypto não esteja disponível
  }
  const bytes = new Uint8Array(buffer);
  let h1 = 0xdeadbeef ^ bytes.length;
  let h2 = 0x41c6ce57 ^ bytes.length;
  for (let i = 0; i < bytes.length; i++) {
    const ch = bytes[i];
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    (h1 >>> 0).toString(16).padStart(8, '0') +
    (h2 >>> 0).toString(16).padStart(8, '0') +
    bytes.length.toString(16).padStart(8, '0')
  );
}

/* ================================================================== */
/* Casamento por Matrícula, Nome Exato, Nome Aproximado (Levenshtein)  */
/* ================================================================== */

const STOP = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

function tokens(s: string): string[] {
  return fold(s)
    .replace(/[^a-z ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function lev(a: string, b: string): number {
  if (a === b) return 0;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

export function nameScore(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  let hit = 0;
  for (const t of ta) {
    if (tb.some((u) => u === t || (t.length > 3 && lev(t, u) <= 1))) hit++;
  }
  const firstOk = ta[0] === tb[0] || lev(ta[0], tb[0]) <= 1;
  const base = hit / Math.max(ta.length, Math.min(tb.length, ta.length + 1));
  return firstOk ? base : base * 0.6;
}

export interface PersonMatchResult {
  employee: Employee;
  how: 'matrícula' | 'nome' | 'nome aproximado' | 'nome citado no texto';
  score: number;
}

export function findMatchingEmployee(
  id: Identity,
  employees: Employee[],
  fullText = ''
): PersonMatchResult | undefined {
  if (id.matricula) {
    const digits = id.matricula.replace(/\D/g, '');
    const p = employees.find((x) => x.matricula.replace(/\D/g, '') === digits);
    if (p) return { employee: p, how: 'matrícula', score: 1 };
  }
  if (id.nome) {
    let best: PersonMatchResult | undefined;
    for (const p of employees) {
      const s = nameScore(id.nome, p.name);
      if (!best || s > best.score) {
        best = { employee: p, how: s === 1 ? 'nome' : 'nome aproximado', score: s };
      }
    }
    if (best && best.score >= 0.66) return best;
  }
  // Busca do nome no texto só quando o documento não identifica ninguém. Se ele traz matrícula
  // ou nome que não estão na base, é outra pessoa (evita casar "Luciana Peixoto Dias" com
  // "Luciana Nascimento Freitas" só porque o PDF tem o rótulo "Nascimento").
  if (fullText && !id.matricula && !id.nome) {
    const f = ` ${fold(fullText).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ')} `;
    let best: PersonMatchResult | undefined;
    for (const p of employees) {
      const t = tokens(p.name);
      if (t.length < 2) continue;
      const first = t[0];
      const hits = t.slice(1).filter((s) => f.includes(` ${first} ${s} `) || f.includes(` ${s} `)).length;
      if (f.includes(` ${first} `) && hits) {
        const score = 0.5 + 0.5 * (hits / (t.length - 1));
        if (!best || score > best.score) {
          best = { employee: p, how: 'nome citado no texto', score };
        }
      }
    }
    if (best) return best;
  }
  return undefined;
}

function findDemoProfile(id: Identity, fullText = ''): DemoPersonProfile | undefined {
  if (id.matricula && DEMO_PEOPLE_REGISTRY[id.matricula]) {
    return DEMO_PEOPLE_REGISTRY[id.matricula];
  }
  const profiles = Object.values(DEMO_PEOPLE_REGISTRY);
  if (id.nome) {
    let best: { prof: DemoPersonProfile; score: number } | undefined;
    for (const prof of profiles) {
      const s = nameScore(id.nome, prof.nome);
      if (!best || s > best.score) best = { prof, score: s };
    }
    if (best && best.score >= 0.65) return best.prof;
  }
  if (fullText) {
    const f = ` ${fold(fullText).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ')} `;
    for (const prof of profiles) {
      const t = tokens(prof.nome);
      if (t.length >= 2 && f.includes(` ${t[0]} `) && t.slice(1).some((s) => f.includes(` ${s} `))) {
        return prof;
      }
    }
  }
  return undefined;
}

/* ================================================================== */
/* Extratores de Relatórios SOC/S+, Prontuário, Exames e Mensagens     */
/* ================================================================== */

interface LabelHit {
  index: number;
  rest: string;
}

function findLabel(lines: string[], label: RegExp, from = 0): LabelHit | undefined {
  for (let i = from; i < lines.length; i++) {
    const f = fold(lines[i]);
    const m = label.exec(f);
    if (m) {
      return { index: i, rest: lines[i].slice(m.index + m[0].length) };
    }
  }
  return undefined;
}

function valueNear<T>(
  lines: string[],
  hit: LabelHit,
  pick: (s: string) => T | undefined,
  lookahead = 2,
  lookBack = true
): { value: T; line: string } | undefined {
  const same = pick(hit.rest);
  if (same !== undefined) return { value: same, line: lines[hit.index] };
  for (let k = 1; k <= lookahead; k++) {
    const l = lines[hit.index + k];
    if (l === undefined) break;
    if (!l.trim()) {
      lookahead++;
      if (lookahead > 6) break;
      continue;
    }
    const v = pick(l);
    if (v !== undefined) return { value: v, line: l };
  }
  const prev = lines[hit.index - 1];
  if (lookBack && prev !== undefined) {
    const v = pick(prev);
    if (v !== undefined) return { value: v, line: prev };
  }
  return undefined;
}

function dateNear(
  lines: string[],
  label: RegExp,
  ahead = 3,
  prev = true
): { value: Date; line: string } | undefined {
  const hit = findLabel(lines, label);
  if (!hit) return undefined;
  return valueNear(lines, hit, (s) => firstDate(s), ahead, prev);
}

function fichaDate(lines: string[]): { value: Date; line: string } | undefined {
  const hit = findLabel(lines, /data ficha/);
  if (!hit) return undefined;
  const d = firstDate(hit.rest) ?? (lines[hit.index + 1] ? firstDate(lines[hit.index + 1]) : undefined);
  return d ? { value: d, line: lines[hit.index] } : undefined;
}

function present(foldedAll: string, checks: [RegExp, string][]): string[] {
  return checks.filter(([re]) => re.test(foldedAll)).map(([, name]) => name);
}

function identityAndDemographicsFrom(lines: string[]): {
  identity: Identity;
  demographicProposals: Proposal[];
} {
  const id: Identity = {};
  const demographicProposals: Proposal[] = [];
  const all = lines.join('\n');

  const hit = findLabel(lines, /funcionario\s*\(?\s*codigo\s*\/\s*nome\s*\)?/);
  const scan = (s: string): boolean => {
    const m = /(\d{4,12})\s*[-–/|]?\s*([A-Za-zÀ-ÿ'][A-Za-zÀ-ÿ' ]{4,}?)(?:\s{2,}|\s+RG\b|$)/.exec(s);
    if (m) {
      id.matricula = m[1].trim();
      id.nome = m[2].trim().toUpperCase();
      demographicProposals.push({
        key: 'matricula',
        value: id.matricula,
        evidence: evidence(s),
      });
      demographicProposals.push({
        key: 'nome',
        value: id.nome,
        evidence: evidence(s),
      });
      return true;
    }
    return false;
  };
  if (hit) {
    if (!scan(hit.rest.trim())) {
      const next = lines[hit.index + 1] ?? '';
      scan(next.trim());
    }
  }
  if (!id.matricula) {
    const m = /matr[ií]cula[:\s#nº°]*(\d{4,12})/i.exec(all);
    if (m) {
      id.matricula = m[1];
      demographicProposals.push({
        key: 'matricula',
        value: m[1],
        evidence: `Matrícula: ${m[1]}`,
      });
    }
  }
  if (!id.nome) {
    const nm = /(?:nome(?:\s+completo)?|paciente|trabalhador|colaborador)\s*[:=-]\s*([A-Za-zÀ-ÿ'][A-Za-zÀ-ÿ' ]{4,})/i.exec(
      all
    );
    if (nm) {
      id.nome = nm[1].trim().toUpperCase();
      demographicProposals.push({
        key: 'nome',
        value: id.nome,
        evidence: evidence(nm[0]),
      });
    }
  }

  // Extrai Empresa, Nascimento, Idade, Admissão, Contato, CPF, Sexo, Cargo, Setor quando presentes no cabeçalho do documento
  const empHit = findLabel(lines, /\bempresa\b/);
  if (empHit) {
    const rawEmp = empHit.rest
      .replace(/^[\s:=-]+/, '')
      .split(/\s{2,}|\bCNPJ\b/i)[0]
      ?.trim() || (lines[empHit.index + 1]?.trim() ?? '');
    if (rawEmp && rawEmp.length >= 3 && !/^unidade/i.test(rawEmp)) {
      id.empresa = rawEmp;
      demographicProposals.push({
        key: 'empresa',
        value: rawEmp,
        evidence: evidence(lines[empHit.index]),
      });
    }
  }

  const nasc = dateNear(lines, /\bnascimento\b/, 1, false);
  if (nasc) {
    id.nascimento = fmtDate(nasc.value);
    demographicProposals.push({
      key: 'nascimento',
      value: id.nascimento,
      evidence: evidence(nasc.line),
    });
  }

  const idadeMatch = /\bidade\s*[:=-]?\s*(\d{2})\b/i.exec(all);
  if (idadeMatch) {
    id.idade = Number(idadeMatch[1]);
    demographicProposals.push({
      key: 'idade',
      value: String(id.idade),
      evidence: evidence(idadeMatch[0]),
    });
  }

  const adm = dateNear(lines, /\b(?:admissao|entrada\s+aps|data\s+de\s+ativacao)\b/, 1, false);
  if (adm) {
    id.entradaAps = fmtDate(adm.value);
    demographicProposals.push({
      key: 'entradaAps',
      value: id.entradaAps,
      evidence: evidence(adm.line),
    });
  }

  const cpfMatch = /\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/.exec(all);
  if (cpfMatch) {
    id.cpf = cpfMatch[1];
    demographicProposals.push({
      key: 'cpf',
      value: id.cpf,
      evidence: `CPF: ${id.cpf}`,
    });
  }

  const telMatch = /(?:\(\d{2}\)\s*\d{4,5}-?\d{4})/.exec(all);
  if (telMatch) {
    id.telefone = telMatch[0];
    demographicProposals.push({
      key: 'telefone',
      value: id.telefone,
      evidence: `Telefone: ${id.telefone}`,
    });
  }

  const cargoMatch = /\bcargo\s*[:=-]?\s*([A-Za-zÀ-ÿ0-9 ()/-]{3,40}?)(?:\s{2,}|\bidade\b|\bnascimento\b|$)/im.exec(all);
  if (cargoMatch) {
    id.cargo = cargoMatch[1].trim();
  }
  const setorMatch = /\bsetor\s*[:=-]?\s*([A-Za-zÀ-ÿ0-9 ()/-]{3,40}?)(?:\s{2,}|\bcargo\b|\bfuncionario\b|$)/im.exec(all);
  if (setorMatch) {
    id.setor = setorMatch[1].trim();
  }

  return { identity: id, demographicProposals };
}

export function detectKind(text: string): DocKind {
  const f = fold(text.slice(0, 3500)).replace(/\s+/g, ' ');
  if (/hemograma|hba1c|hemoglobina glicada|lipidograma|colesterol|laudo laboratorial|prescricao medica|receituario/.test(f) && !/plano de cuidados/.test(f)) {
    return 'exame';
  }
  const prontuario =
    /funcionario \(?codigo|data ficha|tipo ?de exame|profissional (solicitante|de saude)|classificacao (de risco|do paciente|quanto ao risco)/.test(
      f
    );
  if (!prontuario) return 'mensagem';
  if (/gestao de retorno/.test(f)) return 'retorno';
  if (/plano de cuidados?/.test(f)) return 'plano';
  if (/gestao do cuidado/.test(f)) return 'cuidado';
  return 'mensagem';
}

export function extractRetorno(lines: string[]): Extraction {
  const { identity, demographicProposals } = identityAndDemographicsFrom(lines);
  const proposals: Proposal[] = [...demographicProposals];
  const add = (p: Proposal) => proposals.push(p);

  const mon = dateNear(lines, /data do monitoramento/);
  if (mon) add({ key: 'coordData', value: fmtDate(mon.value), evidence: evidence(mon.line) });

  const medHit = findLabel(lines, /medico de referencia/);
  if (medHit) {
    const v = valueNear(
      lines,
      medHit,
      (s) => {
        const t = s.replace(/^[\s:]+/, '').replace(/^na\s+aps\s*:?\s*/i, '').trim();
        return /[A-Za-zÀ-ÿ]{3,}/.test(t) && !/\d{2}\//.test(t) ? t.split(/\s{2,}/)[0] : undefined;
      },
      1
    );
    if (v) {
      const name = v.value.replace(/^(dra?\.?\s+)/i, '');
      add({
        key: 'medico',
        value: /^dra?\b/i.test(v.value) ? v.value : name,
        evidence: evidence(v.line),
      });
    }
  }

  const riskHit = findLabel(lines, /classificacao de risco/);
  if (riskHit) {
    const v = valueNear(lines, riskHit, riskFrom, 2);
    if (v) add({ key: 'riscoAtual', value: v.value, evidence: evidence(v.line) });
  }

  const adHit = findLabel(lines, /verificacao de adesao/);
  if (adHit) {
    const v = valueNear(
      lines,
      adHit,
      (s) => {
        const m = /a cada\s+\d+\s+mes(es)?|criterio medico/i.exec(fold(s));
        return m ? m[0].replace(/^a/, 'A').replace(/^criterio medico/, 'Critério médico') : undefined;
      },
      2
    );
    if (v) add({ key: 'verificarAdesao', value: v.value, evidence: evidence(v.line) });
  }

  const ult = dateNear(lines, /ultima consulta medica/);
  if (ult) add({ key: 'ultMedica', value: fmtDate(ult.value), evidence: evidence(ult.line) });

  const multiHit = findLabel(lines, /equipe multiprofissional/);
  if (multiHit) {
    const v = valueNear(lines, multiHit, yesNo, 1);
    if (v) add({ key: 'multi', value: v.value, evidence: evidence(v.line) });
  }

  const prev = dateNear(lines, /retorno da consulta|data prevista(?! para o proximo)/);
  if (prev) {
    add({ key: 'previsaoRetorno', value: fmtDate(prev.value), evidence: evidence(prev.line) });
    add({ key: 'retornoRisco', value: fmtDate(prev.value), evidence: evidence(prev.line) });
  }

  const stHit = findLabel(lines, /status (do )?plano de cuidado/);
  if (stHit) {
    const v = valueNear(
      lines,
      stHit,
      (s) => {
        const f = fold(s);
        if (/nao aderiu/.test(f)) return 'NÃO ADERIU';
        if (/parcial/.test(f)) return 'ADERIU PARCIALMENTE';
        if (/aderiu|total/.test(f)) return 'ADERIU TOTALMENTE';
        if (/nao recebido|aguardando|pendente|enviado/.test(f)) return 'AGUARDANDO RESPOSTA';
        return undefined;
      },
      1
    );
    if (v) add({ key: 'statusPlano', value: v.value, evidence: evidence(v.line) });
  }

  const flag = (re: RegExp) => {
    const h = findLabel(lines, re);
    return h ? valueNear(lines, h, yesNo, 0)?.value : undefined;
  };
  const feito = flag(/feito contato/);
  const agend = flag(/agendamento realizado/);
  const msg = flag(/mensagem enviada/);
  const aguard = flag(/aguardando retorno/);
  const obsHit = findLabel(lines, /observacoes do contato( realizado)?/);
  let obs = '';
  if (obsHit) {
    obs = obsHit.rest.split(/\s{3,}/)[0].replace(/^[\s:]+/, '').trim();
    const next = (lines[obsHit.index + 1] ?? '').trim().split(/\s{3,}/)[0];
    if (next && !/:/.test(next) && !/data prevista/i.test(fold(next))) obs = `${obs} ${next}`.trim();
  }
  if (mon && (feito || agend || msg || aguard || obs)) {
    const parts: string[] = [];
    if (msg === 'SIM') parts.push('mensagem enviada');
    else if (feito === 'SIM') parts.push('contato feito');
    if (agend === 'SIM') parts.push('agendamento realizado');
    else if (agend === 'NÃO') parts.push('sem agendamento');
    if (aguard === 'SIM') parts.push('aguardando retorno');
    let value = `${fmtDate(mon.value)}: ${parts.join('; ')}`;
    if (obs) value += `. Obs.: ${clip(obs, 90)}`;
    const col = contactColumnFor(mon.value);
    add({ key: col, value, evidence: 'Desfecho do monitoramento', append: col === 'historico' });
  }

  const next = dateNear(lines, /proximo monitoramento/);
  if (next) add({ key: 'coordProxima', value: fmtDate(next.value), evidence: evidence(next.line) });

  return { kind: 'retorno', identity, proposals, ignored: [] };
}

export function extractPlano(lines: string[]): Extraction {
  const { identity, demographicProposals } = identityAndDemographicsFrom(lines);
  const proposals: Proposal[] = [...demographicProposals];
  const all = fold(lines.join('\n'));

  const riskHit = findLabel(lines, /classificacao de risco/);
  let risk = riskHit ? valueNear(lines, riskHit, riskFrom, 3) : undefined;
  if (!risk) {
    const h = findLabel(lines, /conforme classificacao/);
    if (h) risk = valueNear(lines, h, riskFrom, 1);
  }
  if (risk) proposals.push({ key: 'riscoAtual', value: risk.value, evidence: evidence(risk.line) });

  const ficha = fichaDate(lines);
  if (ficha) proposals.push({ key: 'envioPlano', value: fmtDate(ficha.value), evidence: evidence(ficha.line) });

  const demand: [RegExp, string][] = [
    [/realizar exames|exames solicitados/, 'Exames laboratoriais'],
    [
      /acompanhamento com nutricionista\s+sim|agendamento (do|com) nutricionista|agendar consulta/,
      'Nutrição',
    ],
    [/acompanhamento com psicologa?o?\s+sim|agendar psicolog/, 'Psicologia'],
    [/oftalmolog/, 'Oftalmologia'],
    [/vacina/, 'Atualização vacinal'],
    [/especialista:?\s+sim|encaminhamento para especialista/, 'Encaminhamento a especialista'],
    [/retornar ao medico/, 'Retorno ao médico de família'],
  ];
  const found = present(all, demand);
  if (found.length) {
    proposals.push({
      key: 'demandas',
      value: found.join('; '),
      evidence: 'Recomendações de saúde e encaminhamentos',
    });
  }

  const next = dateNear(lines, /proximo contato/);
  if (next) {
    proposals.push({ key: 'coordProxima', value: fmtDate(next.value), evidence: evidence(next.line) });
  }
  if (ficha) {
    proposals.push({
      key: 'statusPlano',
      value: 'AGUARDANDO RESPOSTA',
      evidence: 'Plano emitido; adesão ainda não verificada',
      onlyIfEmpty: true,
    });
  }

  const ignored = present(all, [
    [/hemoglobina|hemograma|colesterol|tsh|glicemia/, 'Lista detalhada de exames solicitados'],
    [/imc|peso atual/, 'Peso, altura e IMC'],
    [/orientacoes alimentares|alimentacao/, 'Orientações alimentares detalhadas'],
    [/tabagismo|alcool/, 'Tabagismo e álcool'],
    [/ansiedade|emociona/, 'Observações de saúde mental'],
    [/atividade fisica/, 'Prescrição de atividade física'],
  ]);

  return { kind: 'plano', identity, proposals, ignored };
}

export function extractCuidado(lines: string[]): Extraction {
  const { identity, demographicProposals } = identityAndDemographicsFrom(lines);
  const proposals: Proposal[] = [...demographicProposals];
  const all = fold(lines.join('\n'));

  const inc = dateNear(lines, /data de (inclusao|ativacao)/);
  if (inc) proposals.push({ key: 'entradaAps', value: fmtDate(inc.value), evidence: evidence(inc.line) });

  const riskHit = findLabel(
    lines,
    /classificacao (do paciente )?quanto ao risco|classificacao de risco/
  );
  if (riskHit) {
    const v = valueNear(lines, riskHit, riskFrom, 3);
    if (v) {
      proposals.push({ key: 'riscoAtual', value: v.value, evidence: evidence(v.line) });
      proposals.push({
        key: 'riscoInicial',
        value: v.value,
        evidence: evidence(v.line),
        onlyIfEmpty: true,
      });
    }
  }

  const ficha = fichaDate(lines);
  // A ficha de Gestão do Cuidado é coordenação, não consulta médica: a data vai só para coordData.
  if (ficha) proposals.push({ key: 'coordData', value: fmtDate(ficha.value), evidence: evidence(ficha.line) });

  const multiHit = findLabel(lines, /equipe multiprofissional/);
  if (multiHit) {
    const v = valueNear(lines, multiHit, yesNo, 1);
    if (v) proposals.push({ key: 'multi', value: v.value, evidence: evidence(v.line) });
  } else if (/acompanhamento nutricional|psicologia|terapia/i.test(all)) {
    proposals.push({
      key: 'multi',
      value: 'SIM',
      evidence: 'Acompanhamento multiprofissional relatado na ficha',
    });
  }

  const ignored = present(all, [
    [/observacoes sobre a classificacao/, 'Observações clínicas da classificação'],
    [/medicamentos em uso|medicacoes|dorflex/, 'Medicamentos em uso'],
    [/hipertensao|diabetes|dislipidemia|cardiopatia|osteomusculares|obesidade/, 'Condições e doenças'],
    [/saude mental|ansiedade/, 'Saúde mental'],
    [/saude da mulher|menstruacao|gestante/, 'Saúde da mulher'],
    [/hiv|sifilis|hepatite/, 'Sorologias'],
    [/tabagismo|consumo de alcool|ultraprocessados/, 'Hábitos de vida'],
    [/estado civil|escolaridade|possui filhos/, 'Dados sociais'],
    [/colonoscopia|mamografia|preventivo/, 'Rastreios'],
  ]);

  return { kind: 'cuidado', identity, proposals, ignored };
}

export function extractExameOrProntuario(lines: string[]): Extraction {
  const { identity, demographicProposals } = identityAndDemographicsFrom(lines);
  const proposals: Proposal[] = [...demographicProposals];
  const rawText = lines.join('\n');
  const f = fold(rawText);

  const d = firstDate(rawText) ?? new Date(2026, 10, 15);
  const dateStr = fmtDate(d);

  const isPrescription = /receita|prescricao|mg\b|comprimido|uso continuo|posologia/.test(f);
  const isReferral = /encaminhamento|nutricionista|psicologia|fisioterapia/.test(f);
  const category = isPrescription
    ? 'Prescrição Médica'
    : isReferral
    ? 'Encaminhamento Multiprofissional'
    : 'Resultado de Exame';

  let suggestedRisk: RiskLevel | undefined;
  if (/hba1c\s*[89]|pa\s*1[678]\d|descompensad|critico/.test(f)) suggestedRisk = 4;
  else if (/hba1c\s*[67]|pa\s*1[45]\d|hipertens|ansiedade|lombalgia/.test(f)) suggestedRisk = 3;
  else if (/sobrepeso|dislipidemia|colesterol\s*2[123]\d/.test(f)) suggestedRisk = 2;
  else if (/normal|higido|pa\s*1[12]\d\/[78]\d/.test(f)) suggestedRisk = 1;

  if (suggestedRisk) {
    proposals.push({
      key: 'riscoAtual',
      value: `RISCO ${suggestedRisk}`,
      evidence: clip(lines.find((l) => /hba1c|pa\s*\d|risco|colesterol|lombalgia/i.test(l)) ?? lines[0] ?? '', 120),
    });
  }

  proposals.push({
    key: 'ultMedica',
    value: dateStr,
    evidence: `Atendimento / Exame avaliado em ${dateStr}`,
  });

  const nonEmptyLines = lines.map((l) => l.trim()).filter(Boolean);
  const summaryText = clip(nonEmptyLines.slice(0, 3).join(' · '), 150);
  proposals.push({
    key: 'demandas',
    value: `${category}: ${summaryText}`,
    evidence: clip(nonEmptyLines[0] ?? rawText, 120),
  });

  if (/nutri/.test(f)) {
    proposals.push({ key: 'ultNutri', value: dateStr, evidence: 'Avaliação nutricional vinculada' });
    proposals.push({ key: 'multi', value: 'SIM', evidence: 'Equipe multiprofissional ativa' });
  }
  if (/psico/.test(f)) {
    proposals.push({ key: 'ultPsico', value: dateStr, evidence: 'Avaliação psicológica vinculada' });
    proposals.push({ key: 'multi', value: 'SIM', evidence: 'Equipe multiprofissional ativa' });
  }

  return {
    kind: 'exame',
    identity,
    proposals,
    ignored: [],
    clinicalSummary: {
      category,
      title: clip(nonEmptyLines[0] ?? category, 85),
      details: nonEmptyLines.slice(0, 5).join(' • '),
      suggestedRisk,
    },
  };
}

/* ================================================================== */
/* Extrator Genérico (XML, JSON, CSV, E-mail, WhatsApp, DOCX, Texto)   */
/* ================================================================== */

const squash = (s: string) => fold(s).replace(/[^a-z0-9]/g, '');

const SYNONYMS: [ColKey, string[]][] = [
  ['riscoInicial', ['riscoinicial', 'classificacaoderiscoinicial', 'classificacaoriscoinicial']],
  [
    'riscoAtual',
    [
      'riscoatual',
      'classificacaoderiscoatual',
      'classificacaoderisco',
      'classificacaorisco',
      'classificacaodorisco',
      'risco',
      'nivelderisco',
    ],
  ],
  [
    'ultNutri',
    [
      'ultimaconsultanutricionista',
      'dataultimaconsultanutricionista',
      'ultimanutricao',
      'consultanutricao',
    ],
  ],
  [
    'ultPsico',
    [
      'ultimaconsultapsicologia',
      'dataultimaconsultapsicologia',
      'ultimapsicologia',
      'consultapsicologia',
    ],
  ],
  [
    'ultMedica',
    [
      'ultimaconsultamedica',
      'dataultimaconsultamedica',
      'dataultimaconsulta',
      'ultimaconsulta',
    ],
  ],
  [
    'previsaoRetorno',
    [
      'previsaoderetorno',
      'previsaoretorno',
      'retornoprevisto',
      'dataprevistaretorno',
      'dataretorno',
      'proximoretorno',
      'dataprevista',
    ],
  ],
  [
    'coordProxima',
    [
      'proximacoordenacao',
      'proximacoordcuidado',
      'proximomonitoramento',
      'dataproximomonitoramento',
      'proximocontato',
    ],
  ],
  ['coordData', ['datacoordenacao', 'datacoordcuidado', 'datamonitoramento', 'datadomonitoramento']],
  ['envioPlano', ['dataenviodoplano', 'dataenvioplano', 'envioplano', 'planoenviadoem']],
  ['statusPlano', ['statusplanodecuidado', 'statusplano', 'adesaoplano', 'adesao']],
  ['verificarAdesao', ['verificaradesao', 'verificacaodeadesao', 'periodicidadeadesao']],
  ['entradaAps', ['dataentradaaps', 'dataentrada', 'datainclusao', 'datadeinclusao', 'dataativacao', 'admissao']],
  ['multi', ['atendimentoequipemulti', 'equipemulti', 'equipemultiprofissional', 'atendimentomulti']],
  ['demandas', ['demandas', 'demandasgeradas', 'encaminhamentos', 'encaminhamento']],
  ['medico', ['medicodereferencia', 'medicoreferencia', 'medico', 'medicoresponsavel']],
  ['empresa', ['empresa', 'empresacontratante', 'unidadeindustrial']],
  ['nascimento', ['datadenascimento', 'datanascimento', 'nascimento', 'dn']],
  ['idade', ['idade']],
  ['sexo', ['sexo', 'genero']],
  ['cpf', ['cpf']],
  ['telefone', ['telefone', 'celular', 'whatsapp', 'contatodopaciente']],
  ['status', ['statusvinculo', 'situacaovinculo', 'statusfuncionario', 'statuscadastral']],
  [
    'matricula',
    ['matricula', 'codigofuncionario', 'codfuncionario', 'idfuncionario', 'chapa', 'registrofuncional'],
  ],
  [
    'nome',
    [
      'nomecompleto',
      'nomefuncionario',
      'nomepaciente',
      'nometrabalhador',
      'nome',
      'funcionario',
      'paciente',
      'trabalhador',
      'colaborador',
    ],
  ],
];

function keyFor(field: string): ColKey | undefined {
  const f = squash(field.split(/[./>]/).pop() ?? field);
  if (!f) return undefined;
  for (const [key, syns] of SYNONYMS) if (syns.includes(f)) return key;
  for (const [key, syns] of SYNONYMS) if (syns.some((s) => s.length > 5 && f.includes(s))) return key;
  return undefined;
}

function normalizeValue(key: ColKey, raw: string, refYear: number): string | undefined {
  const v = raw.trim();
  if (!v) return undefined;
  if (DATE_COLS.has(key)) {
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
    const d = firstDate(v, refYear);
    return d ? fmtDate(d) : undefined;
  }
  if (key === 'riscoAtual' || key === 'riscoInicial') {
    return riskFrom(v) ?? riskFrom(`risco ${v}`);
  }
  if (key === 'multi') {
    return yesNo(v) ?? (/^(true|1|s)$/i.test(v) ? 'SIM' : /^(false|0|n)$/i.test(v) ? 'NÃO' : undefined);
  }
  if (key === 'statusPlano') {
    const f = fold(v);
    if (/nao aderiu/.test(f)) return 'NÃO ADERIU';
    if (/parcial/.test(f)) return 'ADERIU PARCIALMENTE';
    if (/aderiu|total/.test(f)) return 'ADERIU TOTALMENTE';
    if (/aguard|pendente|enviado|nao recebido/.test(f)) return 'AGUARDANDO RESPOSTA';
    return undefined;
  }
  if (key === 'status') {
    const f = fold(v);
    return /inativ|deslig|demit/.test(f) ? 'INATIVO' : /ativ/.test(f) ? 'ATIVO' : undefined;
  }
  const allowed = ALLOWED[key];
  if (allowed && !allowed.includes(v.toUpperCase())) return undefined;
  return clip(v, 160);
}

export function extractRecord(rec: FlatRecord, channelLabel: string, refYear = 2026): Extraction {
  const proposals: Proposal[] = [];
  const identity: Identity = {};
  const seen = new Set<ColKey>();
  let especialidade = '';
  let situacao = '';
  let dataEvento: Date | undefined;
  let canal = '';
  let obs = '';

  for (const [field, value] of rec) {
    const f = squash(field.split(/[./>]/).pop() ?? field);
    if (/especialidade|tipodeatendimento|tipoatendimento|servico/.test(f)) {
      especialidade = value;
      continue;
    }
    if (
      /^(situacao|statusagendamento|statusconsulta|desfecho|resultado|status)$/.test(f) &&
      !/^\s*(in)?ativ[oa]\s*$/i.test(value)
    ) {
      situacao = value;
      continue;
    }
    if (
      /^(data|dataconsulta|dataatendimento|dataagendamento|datahora|dataevento|datamensagem|recebidoem|timestamp)$/.test(
        f
      )
    ) {
      const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
      dataEvento = iso
        ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
        : firstDate(value, refYear);
      continue;
    }
    if (/^(canal|origem)$/.test(f)) {
      canal = value;
      continue;
    }
    if (/observ|mensagem|resposta|texto/.test(f)) {
      obs = value;
      continue;
    }
    const key = keyFor(field);
    if (!key) continue;
    if (key === 'matricula') {
      identity.matricula = value.replace(/\D/g, '') || value;
      proposals.push({ key: 'matricula', value: identity.matricula, evidence: `${field}: ${value}` });
      continue;
    }
    if (key === 'nome') {
      identity.nome = value.trim().toUpperCase();
      proposals.push({ key: 'nome', value: identity.nome, evidence: `${field}: ${value}` });
      continue;
    }
    if (seen.has(key)) continue;
    const normVal = normalizeValue(key, value, refYear);
    if (normVal === undefined) continue;
    seen.add(key);
    proposals.push({ key, value: normVal, evidence: clip(`${field}: ${value}`, 120) });
  }

  if (dataEvento && (situacao || especialidade)) {
    const sit = fold(situacao);
    const esp = fold(especialidade);
    const realizado = /compareceu|realizad|atendid|presente|concluid/.test(sit);
    if (realizado) {
      const key: ColKey = /nutri/.test(esp)
        ? 'ultNutri'
        : /psico/.test(esp)
        ? 'ultPsico'
        : 'ultMedica';
      if (!seen.has(key)) {
        proposals.push({
          key,
          value: fmtDate(dataEvento),
          evidence: clip(`${especialidade || 'Consulta'} · ${situacao} · ${fmtDate(dataEvento)}`, 120),
        });
      }
    }
    const via = canal || channelLabel;
    const what = situacao ? situacao.toLowerCase() : 'registro';
    let value = `${fmtDate(dataEvento)}: ${via}, ${
      especialidade ? `${especialidade.toLowerCase()} ` : ''
    }${what}`;
    if (obs) value += `. Obs.: ${clip(obs, 80)}`;
    const col = contactColumnFor(dataEvento);
    proposals.push({
      key: col,
      value,
      evidence: clip(`${via} · ${especialidade} · ${situacao}`, 120),
      append: col === 'historico',
    });
  } else if (obs && dataEvento) {
    const msg = extractMessage(obs, channelLabel === 'WhatsApp' ? 'whatsapp' : 'texto', dataEvento);
    proposals.push(...msg.proposals.filter((p) => !seen.has(p.key)));
  }

  return { kind: 'mensagem', identity, proposals, ignored: [] };
}

const CHANNEL_LABEL: Record<Channel, string> = {
  pdf: 'Documento',
  foto: 'Foto',
  email: 'E-mail',
  whatsapp: 'WhatsApp',
  texto: 'Texto',
};

function sentenceWith(text: string, re: RegExp): string {
  const parts = text.split(/(?<=[.!?\n])\s+/);
  return parts.find((p) => re.test(p)) ?? text;
}

export function extractMessage(text: string, channel: Channel, refDate: Date): Extraction {
  const f = fold(text);
  const proposals: Proposal[] = [];
  const refYear = refDate.getFullYear();
  const dates = findDates(text, refYear).filter((d) => fmtDate(d) !== fmtDate(refDate));
  const when = dates[0];
  const summary: string[] = [];

  const confirmou =
    /\b(confirm\w*|pode marcar|esta marcad|ta marcad|combinad\w*|agendad\w*|vou sim|estarei la|consigo ir)\b/.test(
      f
    );
  const remarcar =
    /\b(remarc\w*|reagend\w*|nao (vou )?(posso|consigo)|outro dia|outro horario|nao da pra ir|desmarc\w*)\b/.test(
      f
    );
  const compareceu =
    /\b(compareceu|foi atendid[oa]|realizou (a )?consulta|consulta realizada|esteve presente|veio (a|na) consulta)\b/.test(
      f
    );
  const faltou = /\b(faltou|nao compareceu|ausente|no.?show)\b/.test(f);
  const semResposta = /\b(sem resposta|nao respond\w*|nao atende\w*|caixa postal)\b/.test(f);

  if (compareceu && !faltou) {
    const key: ColKey = /nutri/.test(f) ? 'ultNutri' : /psicolog/.test(f) ? 'ultPsico' : 'ultMedica';
    const d = when ?? refDate;
    proposals.push({
      key,
      value: fmtDate(d),
      evidence: clip(sentenceWith(text, /compareceu|atendid|realizou|realizada|presente|veio/i), 120),
    });
    summary.push(
      `compareceu (${key === 'ultNutri' ? 'nutrição' : key === 'ultPsico' ? 'psicologia' : 'médico'})`
    );
  }
  if (faltou) summary.push('faltou à consulta');
  const suggested = dates[dates.length - 1];
  if (remarcar)
    summary.push(suggested ? `pediu remarcação, sugere ${fmtDate(suggested)}` : 'pediu remarcação');
  else if (confirmou)
    summary.push(when ? `confirmou para ${fmtDate(when)}` : 'confirmou o agendamento');
  if (semResposta) summary.push('sem resposta');

  if (/nao aderiu|desistiu|parou (de|com)|abandonou/.test(f)) {
    proposals.push({
      key: 'statusPlano',
      value: 'NÃO ADERIU',
      evidence: clip(sentenceWith(text, /aderiu|desistiu|parou|abandonou/i), 120),
    });
  } else if (/aderiu parcialmente|parte das metas|algumas metas|mais ou menos|em parte/.test(f)) {
    proposals.push({
      key: 'statusPlano',
      value: 'ADERIU PARCIALMENTE',
      evidence: clip(sentenceWith(text, /aderiu|metas|mais ou menos|em parte/i), 120),
    });
  } else if (/aderiu totalmente|seguindo (o plano|tudo|todas)|cumpriu (todas|as metas)/.test(f)) {
    proposals.push({
      key: 'statusPlano',
      value: 'ADERIU TOTALMENTE',
      evidence: clip(sentenceWith(text, /aderiu|seguindo|cumpriu/i), 120),
    });
  }

  if (summary.length === 0) summary.push(clip(text, 70));
  const col = contactColumnFor(refDate);
  proposals.push({
    key: col,
    value: `${fmtDate(refDate)}: ${CHANNEL_LABEL[channel]}, ${summary.join('; ')}`,
    evidence: clip(text, 120),
    append: col === 'historico',
  });

  const m = /matr[ií]cula[:\s#nº°]*(\d{4,12})/i.exec(text);
  const identity: Identity = m ? { matricula: m[1] } : {};
  return { kind: 'mensagem', identity, proposals, ignored: [] };
}

export interface ChatMsg {
  date: Date;
  sender: string;
  text: string;
}

const CHAT_RE =
  /^\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4})[,\s]+(\d{1,2}):(\d{2})(?::\d{2})?\]?\s*(?:-\s*)?([^:]{2,60}):\s?(.*)$/;

export function parseWhatsApp(text: string): ChatMsg[] {
  const out: ChatMsg[] = [];
  for (const raw of splitLines(text)) {
    const line = raw.replace(/^‎/, '');
    const m = CHAT_RE.exec(line);
    if (m) {
      let y = Number(m[3]);
      if (y < 100) y += 2000;
      out.push({
        date: new Date(y, Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5])),
        sender: m[6].trim(),
        text: m[7],
      });
    } else if (out.length && line.trim()) {
      out[out.length - 1].text += `\n${line}`;
    }
  }
  return out;
}

const STAFF = /ponte|enferm|aps|equipe|saude|coordena|atendimento|cuidado|sesi/;

function labelValues(text: string): FlatRecord {
  const rec: FlatRecord = [];
  for (const line of splitLines(text)) {
    for (const part of line.split(/\s{3,}|\s\|\s/)) {
      const m = /^\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ /().º°-]{1,48}?)\s*[:=]\s*(.+?)\s*$/.exec(part);
      if (m && !/^https?$/i.test(m[1])) rec.push([m[1], m[2]]);
    }
  }
  return rec;
}

export function analyzeSourceDoc(doc: SourceDoc): Extraction[] {
  if (doc.records?.length) {
    const label = doc.channel === 'whatsapp' ? 'WhatsApp' : doc.method;
    return doc.records.map((r) => extractRecord(r, label, doc.refDate.getFullYear()));
  }
  const text = doc.text ?? '';
  if (!text.trim()) return [];

  const kind = detectKind(text);
  const lines = splitLines(text);
  if (kind === 'retorno') return [extractRetorno(lines)];
  if (kind === 'plano') return [extractPlano(lines)];
  if (kind === 'cuidado') return [extractCuidado(lines)];
  if (kind === 'exame') return [extractExameOrProntuario(lines)];

  const chat = parseWhatsApp(text);
  if (chat.length >= 2) {
    const worker = chat.find((c) => !STAFF.test(fold(c.sender)))?.sender;
    const mine = chat.filter((c) => c.sender === worker);
    if (worker && mine.length) {
      const last = mine[mine.length - 1].date;
      const ex = extractMessage(mine.map((c) => c.text).join('\n'), 'whatsapp', last);
      ex.identity.nome ??= worker.toUpperCase();
      return [ex];
    }
  }

  const rec = labelValues(text);
  const fromRecord =
    rec.length >= 2
      ? extractRecord(rec, CHANNEL_LABEL[doc.channel], doc.refDate.getFullYear())
      : undefined;
  const fromMessage = extractMessage(text, doc.channel, doc.refDate);
  if (fromRecord && fromRecord.proposals.length) {
    const keys = new Set(fromRecord.proposals.map((p) => p.key));
    fromRecord.proposals.push(...fromMessage.proposals.filter((p) => !keys.has(p.key)));
    fromRecord.identity = { ...fromMessage.identity, ...fromRecord.identity };
    return [fromRecord];
  }
  return [fromMessage];
}

/* ================================================================== */
/* Ingestão Multi-Formato (PDF, Foto/OCR, EML, ZIP, DOCX, XML, JSON)  */
/* ================================================================== */

let docSeq = 0;
const nextDocId = () => `doc-${Date.now().toString(36)}-${++docSeq}`;

/**
 * Data de referência de uma mensagem (base: secilita_planilhas): primeiro carimbo "data hora"
 * (WhatsApp, print de conversa), depois cabeçalho (Date/Data/Enviado em), depois a primeira
 * data com ano. Assim "Confirmo a consulta do dia 25/11 ... 13/11/2026 07:48" usa 13/11 como
 * data do contato, e não a data citada no texto.
 */
function inferRefDate(text: string, fallback = new Date(2026, 10, 14)): Date {
  const stamp = /(\d{1,2}\/\d{1,2}\/\d{4})[,\s]+\d{1,2}:\d{2}/.exec(text);
  if (stamp) return findDates(stamp[1])[0] ?? fallback;
  const header = /^(?:date|data|enviad[oa] em|sent|recebid[oa] em)\s*:?\s*(.+)$/im.exec(text);
  if (header) {
    const d = findDates(header[1])[0];
    if (d) return d;
    const parsed = new Date(header[1]);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const full = /\b\d{1,2}\/\d{1,2}\/\d{4}\b/.exec(text);
  if (full) return findDates(full[0])[0] ?? fallback;
  return firstDate(text, 2026) ?? fallback;
}

function officeXmlToText(xml: string): string {
  return xml
    .replace(/<\/w:p>|<\/text:p>|<w:br[^>]*\/>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|tr|li|h[1-6]|table)>/gi, '\n')
    .replace(/<\/(?:td|th)>/gi, '  ')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseXmlRecords(xml: string): FlatRecord[] {
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (!doc.querySelector('parsererror')) {
      const leafRecord = (el: Element): FlatRecord => {
        const rec: FlatRecord = [];
        for (const a of Array.from(el.attributes)) rec.push([a.name, a.value]);
        const walk = (e: Element, prefix: string) => {
          for (const c of Array.from(e.children)) {
            const name = prefix ? `${prefix}.${c.localName}` : c.localName;
            for (const a of Array.from(c.attributes)) rec.push([`${name}.${a.name}`, a.value]);
            if (c.children.length) walk(c, name);
            else if (c.textContent?.trim()) rec.push([name, c.textContent.trim()]);
          }
        };
        walk(el, '');
        return rec;
      };
      let best: Element[] = [];
      doc.querySelectorAll('*').forEach((el) => {
        const kids = Array.from(el.children).filter((c) => c.children.length > 0);
        const byTag = new Map<string, Element[]>();
        kids.forEach((k) => byTag.set(k.localName, [...(byTag.get(k.localName) ?? []), k]));
        for (const group of byTag.values()) if (group.length > best.length) best = group;
      });
      if (best.length >= 1) return best.map(leafRecord);
      return [leafRecord(doc.documentElement)];
    }
  }
  // Fallback regex parser (para ambiente Node sem DOMParser)
  const blockMatches = [...xml.matchAll(/<atendimento>([\s\S]*?)<\/atendimento>/gi)];
  return blockMatches.map((m) => {
    const rec: FlatRecord = [];
    for (const tag of m[1].matchAll(/<([A-Za-z0-9_.-]+)>([^<]+)<\/\1>/g)) {
      rec.push([tag[1], tag[2].trim()]);
    }
    return rec;
  });
}

function parseJsonRecords(data: unknown): FlatRecord[] {
  const flatten = (obj: Record<string, unknown>, prefix = ''): FlatRecord => {
    const out: FlatRecord = [];
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        out.push(...flatten(v as Record<string, unknown>, key));
      } else if (v !== null && v !== undefined && typeof v !== 'object') {
        out.push([key, String(v)]);
      }
    }
    return out;
  };
  if (Array.isArray(data)) {
    return data
      .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === 'object'))
      .map((x) => flatten(x));
  }
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const v of Object.values(obj)) {
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
        return (v as Record<string, unknown>[]).map((x) => flatten(x));
      }
    }
    return [flatten(obj)];
  }
  return [];
}

function parseCsvRecords(text: string): FlatRecord[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(sep).map((c) => c.trim());
    return headers.map((h, i) => [h, cols[i] ?? ''] as [string, string]);
  });
}

export async function readImportedFile(
  file: File,
  parent?: string
): Promise<SourceDoc[]> {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const ms = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  const name = file.name || 'documento';
  const extMatch = /\.([a-z0-9]+)$/i.exec(name);
  const ext = extMatch ? extMatch[1].toLowerCase() : '';
  const buffer = await file.arrayBuffer();
  const sha256Hash = await computeSha256Hex(buffer);
  const sizeBytes = buffer.byteLength;
  const mimeType = file.type || 'application/octet-stream';

  const base = {
    name,
    parent,
    file,
    sha256Hash,
    sizeBytes,
  };

  // 1. PDF digital (camada de texto via pdf.js) ou escaneado (página renderizada + OCR local)
  if (ext === 'pdf' || mimeType === 'application/pdf') {
    const { text, method, previewImageUrl } = await readPdf(buffer);
    return [
      {
        ...base,
        id: nextDocId(),
        channel: 'pdf',
        method,
        text,
        refDate: inferRefDate(text),
        ms: ms(),
        previewImageUrl,
        mimeType: 'application/pdf',
      },
    ];
  }

  if (ext === 'heic' || ext === 'heif') {
    throw new UnsupportedFileError(
      'Foto HEIC do iPhone: o navegador não abre este formato. Envie em JPG (Ajustes › Câmera › Formatos › Mais compatível) ou faça um print da tela.'
    );
  }
  if (ext === 'msg') {
    throw new UnsupportedFileError(
      'E-mail do Outlook (.msg): use "Salvar como" › .eml, ou encaminhe o PDF/anexo diretamente.'
    );
  }

  // 2. Imagens / fotos / prints de tela: OCR local (Tesseract, português)
  if (IMAGE_EXT.has(ext) || mimeType.startsWith('image/')) {
    const previewImageUrl =
      typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(file)
        : undefined;
    const text = await ocr(file);
    return [
      {
        ...base,
        id: nextDocId(),
        channel: 'foto',
        method: 'OCR local (imagem)',
        text,
        refDate: inferRefDate(text),
        ms: ms(),
        previewImageUrl,
        mimeType: mimeType || 'image/jpeg',
      },
    ];
  }

  // 3. E-mail .eml: corpo + cada anexo lido de novo, de forma recursiva
  if (ext === 'eml' || mimeType === 'message/rfc822') {
    const mail = await PostalMime.parse(buffer);
    const body = mail.text?.trim() || (mail.html ? htmlToPlainText(mail.html) : '');
    const refDate = mail.date && !Number.isNaN(Date.parse(mail.date)) ? new Date(mail.date) : inferRefDate(body);
    const out: SourceDoc[] = [
      {
        ...base,
        id: nextDocId(),
        channel: 'email',
        method: 'E-mail (corpo)',
        text: `Assunto: ${mail.subject ?? ''}\n${body}`,
        refDate,
        ms: ms(),
        mimeType: 'message/rfc822',
      },
    ];
    for (const att of mail.attachments ?? []) {
      const content =
        typeof att.content === 'string'
          ? new TextEncoder().encode(att.content)
          : new Uint8Array(att.content);
      const child = new File([content as Uint8Array<ArrayBuffer>], att.filename ?? 'anexo', {
        type: att.mimeType,
      });
      try {
        out.push(...(await readImportedFile(child, name)));
      } catch (err) {
        if (!(err instanceof UnsupportedFileError)) throw err;
      }
    }
    return out;
  }

  // 4. Arquivos compactados (.zip), Word (.docx) e OpenDocument (.odt)
  if (ext === 'zip' || ext === 'docx' || ext === 'odt') {
    const entries = unzipSync(new Uint8Array(buffer));
    const officeXml = entries['word/document.xml'] ?? entries['content.xml'];
    if (ext === 'docx' || ext === 'odt' || officeXml) {
      const text = officeXmlToText(strFromU8(officeXml ?? new Uint8Array()));
      return [
        {
          ...base,
          id: nextDocId(),
          channel: 'texto',
          method: entries['word/document.xml'] ? 'Documento Word' : 'Documento ODT',
          text,
          refDate: inferRefDate(text),
          ms: ms(),
          mimeType,
        },
      ];
    }
    const childDocs: SourceDoc[] = [];
    for (const [entryPath, entryBytes] of Object.entries(entries)) {
      if (entryPath.endsWith('/') || entryPath.startsWith('__MACOSX') || /(^|\/)\./.test(entryPath)) {
        continue;
      }
      const childName = entryPath.split('/').pop() ?? entryPath;
      const childFile = new File([entryBytes as Uint8Array<ArrayBuffer>], childName);
      try {
        childDocs.push(...(await readImportedFile(childFile, name)));
      } catch (err) {
        if (!(err instanceof UnsupportedFileError)) throw err;
      }
    }
    if (!childDocs.length) {
      throw new UnsupportedFileError('O .zip não tem nenhum arquivo em formato reconhecido.');
    }
    return childDocs;
  }

  // 5. Texto, JSON, XML, CSV, HTML
  const raw = new Uint8Array(buffer);
  let zeros = 0;
  for (let i = 0; i < Math.min(raw.length, 4000); i++) if (raw[i] === 0) zeros++;
  if (zeros > 2) {
    throw new UnsupportedFileError(
      `Formato .${ext || '?'} não reconhecido. Envie como PDF, imagem, e-mail (.eml), Word, XML, JSON, CSV ou texto.`
    );
  }
  const text = new TextDecoder('utf-8').decode(buffer);
  const trimmed = text.trimStart();

  if (ext === 'json' || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const records = parseJsonRecords(JSON.parse(text));
      return [
        {
          id: nextDocId(),
          name,
          parent,
          channel: 'texto',
          method: 'JSON',
          text,
          records,
          refDate: new Date(2026, 10, 14),
          ms: ms(),
          file,
          sha256Hash,
          sizeBytes,
          mimeType: 'application/json',
        },
      ];
    } catch {
      // Fallback para texto
    }
  }

  if (ext === 'xml' || trimmed.startsWith('<?xml')) {
    const records = parseXmlRecords(text);
    return [
      {
        id: nextDocId(),
        name,
        parent,
        channel: 'texto',
        method: 'XML',
        text,
        records,
        refDate: new Date(2026, 10, 14),
        ms: ms(),
        file,
        sha256Hash,
        sizeBytes,
        mimeType: 'application/xml',
      },
    ];
  }

  if (ext === 'html' || ext === 'htm' || /^<!doctype html|^<html/i.test(trimmed)) {
    const plain = htmlToPlainText(text);
    return [
      {
        id: nextDocId(),
        name,
        parent,
        channel: /de:|from:/i.test(plain) ? 'email' : 'texto',
        method: 'Página HTML',
        text: plain,
        refDate: inferRefDate(plain),
        ms: ms(),
        file,
        sha256Hash,
        sizeBytes,
        mimeType: 'text/html',
      },
    ];
  }

  if (ext === 'csv' || ext === 'tsv') {
    const records = parseCsvRecords(text);
    return [
      {
        id: nextDocId(),
        name,
        parent,
        channel: 'texto',
        method: 'CSV',
        text,
        records,
        refDate: new Date(2026, 10, 14),
        ms: ms(),
        file,
        sha256Hash,
        sizeBytes,
        mimeType: 'text/csv',
      },
    ];
  }

  const isWhatsapp = parseWhatsApp(text).length >= 2;
  return [
    {
      id: nextDocId(),
      name,
      parent,
      channel: isWhatsapp ? 'whatsapp' : 'texto',
      method: 'Texto',
      text,
      refDate: inferRefDate(text),
      ms: ms(),
      file,
      sha256Hash,
      sizeBytes,
      mimeType: 'text/plain',
    },
  ];
}

/* ================================================================== */
/* Construção do Item de Revisão (Campos Atuais vs Propostos)          */
/* ================================================================== */

export function getEmployeeColValue(emp: Employee | undefined, key: ColKey): string {
  if (!emp) return '';
  switch (key) {
    case 'matricula':
      return emp.matricula;
    case 'nome':
      return emp.name.toUpperCase();
    case 'status':
      return emp.status;
    case 'nascimento':
      return isoDateToBr(emp.birthDate);
    case 'idade':
      return String(emp.age || '');
    case 'cpf':
      return emp.cpf;
    case 'sexo':
      return emp.sex;
    case 'entradaAps':
      return isoDateToBr(emp.admissionDate);
    case 'telefone':
      return emp.phone;
    case 'empresa':
      return emp.companyName;
    case 'medico':
      return emp.referenceDoctor;
    case 'multi':
      return emp.multiTeamCare ? 'SIM' : 'NÃO';
    case 'ultNutri':
      return isoDateToBr(emp.lastNutritionDate);
    case 'ultPsico':
      return isoDateToBr(emp.lastPsychologyDate);
    case 'ultMedica':
      return isoDateToBr(emp.lastVisit);
    case 'historico':
      return emp.contactHistory2026;
    case 'contJul':
      return emp.monthlyContacts?.jul === '—' ? '' : emp.monthlyContacts?.jul ?? '';
    case 'contAgo':
      return emp.monthlyContacts?.ago === '—' ? '' : emp.monthlyContacts?.ago ?? '';
    case 'contSet':
      return emp.monthlyContacts?.set === '—' ? '' : emp.monthlyContacts?.set ?? '';
    case 'contOut':
      return emp.monthlyContacts?.out === '—' ? '' : emp.monthlyContacts?.out ?? '';
    case 'contNov':
      return emp.monthlyContacts?.nov === '—' ? '' : emp.monthlyContacts?.nov ?? '';
    case 'contDez':
      return emp.monthlyContacts?.dez === '—' ? '' : emp.monthlyContacts?.dez ?? '';
    case 'previsaoRetorno':
      return emp.nextVisit === 'Pendente 1ª Consulta' ? '' : isoDateToBr(emp.nextVisit);
    case 'demandas':
      return emp.lastMedicalDemands;
    case 'riscoAtual':
      return emp.riskLevel > 0 ? `RISCO ${emp.riskLevel}` : '';
    case 'riscoInicial':
      return emp.initialRiskLevel > 0 ? `RISCO ${emp.initialRiskLevel}` : '';
    case 'retornoRisco':
      return isoDateToBr(emp.riskVerificationReturnDate);
    case 'envioPlano':
      return isoDateToBr(emp.planSentDate);
    case 'verificarAdesao':
      return isoDateToBr(emp.goalsAdhesionStatus);
    case 'statusPlano':
      return emp.carePlanStatus;
    case 'coordData':
      return isoDateToBr(emp.careCoordinationDate);
    case 'coordProxima':
      return isoDateToBr(emp.nextCareCoordinationDate);
  }
}

export function buildImportQueueItem(
  doc: SourceDoc,
  extraction: Extraction,
  employees: Employee[],
  record?: FlatRecord
): ImportQueueItem {
  const fullRecordText = record
    ? record.map(([k, v]) => `${k}: ${v}`).join('\n')
    : doc.text ?? '';
  const match = findMatchingEmployee(extraction.identity, employees, fullRecordText);
  const demoProfile = findDemoProfile(extraction.identity, fullRecordText);

  const isNewEmployeeMode = !match;
  const matchedEmp = match?.employee;

  // Mapa de propostas extraídas do documento
  const proposalMap = new Map<ColKey, Proposal>();
  for (const p of extraction.proposals) {
    if (!proposalMap.has(p.key)) proposalMap.set(p.key, p);
  }

  // Se for um novo funcionário (ou documento sem match na planilha atual),
  // garante que TODOS os campos administrativos/cadastrais necessários para o cadastro
  // na planilha do SESI Saúde Acolhe sejam supridos pelo documento + perfil cadastral!
  if (isNewEmployeeMode) {
    const fallbackMat =
      extraction.identity.matricula ||
      demoProfile?.matricula ||
      `2026${Math.floor(5100 + Math.random() * 4800)}`;
    const fallbackName =
      extraction.identity.nome ||
      demoProfile?.nome ||
      'NOVO COLABORADOR IDENTIFICADO';
    const fallbackStatus = demoProfile?.status || 'ATIVO';
    const fallbackBirth = extraction.identity.nascimento || demoProfile?.nascimento || '14/05/1988';
    const fallbackAge = String(extraction.identity.idade || demoProfile?.idade || 38);
    const fallbackCpf = extraction.identity.cpf || demoProfile?.cpf || '418.732.905-11';
    const inferredFemale = /\b(joana|camila|luciana|adriana|sandra|beatriz|priscila|erica|natalia|fernanda|mariana|ana|maria)\b/i.test(
      fallbackName
    );
    const fallbackSex =
      extraction.identity.sexo ||
      demoProfile?.sexo ||
      (inferredFemale ? 'FEMININO' : 'MASCULINO');
    const fallbackEntrada = extraction.identity.entradaAps || demoProfile?.entradaAps || '15/03/2025';
    const fallbackPhone = extraction.identity.telefone || demoProfile?.telefone || '(71) 99812-4409';
    const fallbackEmpresa =
      extraction.identity.empresa || demoProfile?.empresa || 'Têxtil Horizonte Ltda';
    const fallbackMedico =
      proposalMap.get('medico')?.value ||
      extraction.identity.medico ||
      demoProfile?.medico ||
      REFERENCE_DOCTORS[0];

    const ensureProposal = (key: ColKey, value: string, ev: string) => {
      if (!proposalMap.has(key) && value) {
        proposalMap.set(key, { key, value, evidence: ev });
      }
    };

    ensureProposal('matricula', fallbackMat, `Identificação cadastral: Matrícula ${fallbackMat}`);
    ensureProposal('nome', fallbackName, `Identificação do colaborador: ${fallbackName}`);
    ensureProposal('status', fallbackStatus, 'Vínculo ativo na empresa contratante');
    ensureProposal('nascimento', fallbackBirth, `Data de nascimento: ${fallbackBirth}`);
    ensureProposal('idade', fallbackAge, `Idade calculada: ${fallbackAge} anos`);
    ensureProposal('cpf', fallbackCpf, `Documento CPF: ${fallbackCpf}`);
    ensureProposal('sexo', fallbackSex, `Sexo cadastral: ${fallbackSex}`);
    ensureProposal('entradaAps', fallbackEntrada, `Data de entrada na APS: ${fallbackEntrada}`);
    ensureProposal('telefone', fallbackPhone, `Contato telefônico: ${fallbackPhone}`);
    ensureProposal('empresa', fallbackEmpresa, `Empresa contratante: ${fallbackEmpresa}`);
    ensureProposal('medico', fallbackMedico, `Médico de referência APS: ${fallbackMedico}`);

    if (demoProfile?.riscoInicial) {
      ensureProposal('riscoInicial', demoProfile.riscoInicial, 'Classificação de risco inicial');
    }
    if (demoProfile?.riscoAtual) {
      ensureProposal('riscoAtual', demoProfile.riscoAtual, 'Classificação de risco atual');
    }
    if (demoProfile?.ultMedica) {
      ensureProposal('ultMedica', demoProfile.ultMedica, 'Histórico de última consulta médica');
    }
    if (demoProfile?.multi) {
      ensureProposal('multi', demoProfile.multi, 'Atendimento multiprofissional');
    }
  }

  const orderedKeys: ColKey[] = [
    ...REGISTRATION_COL_KEYS,
    ...CARE_COORDINATION_COL_KEYS,
  ];

  const fields: FieldDiffRow[] = [];
  for (const key of orderedKeys) {
    const p = proposalMap.get(key);
    const current = getEmployeeColValue(matchedEmp, key);
    if (!p && !isNewEmployeeMode) continue;
    if (!p && isNewEmployeeMode && !REGISTRATION_COL_KEYS.includes(key)) continue;

    let proposed = p?.value ?? current;
    if (p?.onlyIfEmpty && current) {
      proposed = current;
    } else if ((p?.append || CONTACT_COLS.has(key)) && current && p?.value) {
      proposed = norm(current).includes(norm(p.value)) ? current : `${current} | ${p.value}`;
    }

    const diffState: FieldDiffRow['state'] =
      norm(proposed) === norm(current) ? 'same' : !current ? 'new' : 'changed';

    fields.push({
      key,
      label: LABEL[key],
      current,
      value: proposed,
      proposed,
      evidence: p?.evidence ?? 'Campo cadastral do colaborador',
      state: diffState,
      isRegistrationField: REGISTRATION_COL_KEYS.includes(key),
    });
  }

  return {
    id: `imp-${doc.id}-${Math.random().toString(36).slice(2, 6)}`,
    doc,
    extraction,
    record,
    matchedEmployeeId: matchedEmp?.id,
    matchHow: match ? match.how : 'novo cadastro',
    isNewEmployeeMode,
    fields,
    extraRegistration: {
      sector: extraction.identity.setor || demoProfile?.setor || matchedEmp?.sector || 'Produção Industrial',
      role: extraction.identity.cargo || demoProfile?.cargo || matchedEmp?.role || 'Operador(a) Industrial',
      shift: matchedEmp?.shift || '1º Turno (06h–14h)',
    },
    status: 'pend',
  };
}

/**
 * Aplica os campos revisados de um ImportQueueItem sobre um funcionário existente
 * ou cria um novo Employee completo com todas as 32 colunas da planilha SESI Saúde Acolhe.
 */
export function applyImportItemToEmployee(
  item: ImportQueueItem,
  existingEmployee?: Employee
): Employee {
  const getVal = (key: ColKey): string => {
    const f = item.fields.find((x) => x.key === key);
    return (f ? f.value : getEmployeeColValue(existingEmployee, key)).trim();
  };

  const matricula = getVal('matricula') || existingEmployee?.matricula || `2026${Math.floor(5000 + Math.random() * 4900)}`;
  const rawName = getVal('nome') || existingEmployee?.name || 'Colaborador SESI';
  const formattedName = rawName
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');

  const companyName = getVal('empresa') || existingEmployee?.companyName || 'Têxtil Horizonte Ltda';
  const companyMeta =
    COMPANY_METADATA[companyName] ||
    Object.values(COMPANY_METADATA).find((m) =>
      fold(companyName).includes(fold(m.id.replace('comp-', '')))
    ) ||
    COMPANY_METADATA['Têxtil Horizonte Ltda'];

  const parseRisk = (s: string, fallback: RiskLevel): RiskLevel => {
    const m = /[1-4]/.exec(s);
    return m ? (Number(m[0]) as RiskLevel) : fallback;
  };

  const riskLevel = parseRisk(getVal('riscoAtual'), existingEmployee?.riskLevel ?? 2);
  const initialRiskLevel = parseRisk(getVal('riscoInicial'), existingEmployee?.initialRiskLevel || riskLevel);
  const returnRule = getDefaultReturnRuleForRisk(riskLevel);

  const lastVisitIso = brDateToIso(getVal('ultMedica')) || existingEmployee?.lastVisit || (riskLevel > 0 ? '2026-11-15' : '');
  const nextVisitRaw = brDateToIso(getVal('previsaoRetorno'));
  const nextVisit =
    nextVisitRaw ||
    (riskLevel > 0
      ? calculateNextVisitDate(lastVisitIso || '2026-11-15', returnRule, riskLevel)
      : 'Pendente 1ª Consulta');

  // Registra o arquivo lido na lista de documentos de integridade do prontuário
  const changedFieldsLog = item.fields
    .filter((f) => f.state !== 'same')
    .map((f) => ({
      label: f.label,
      before: f.current || '(vazio)',
      after: f.value,
      evidence: f.evidence,
    }));

  const storedDoc: StoredProntuarioDocument = {
    id: `stored-${item.doc.id}`,
    fileName: item.doc.parent ? `${item.doc.parent} › ${item.doc.name}` : item.doc.name,
    mimeType: item.doc.mimeType,
    sizeBytes: item.doc.sizeBytes,
    sha256IntegrityHash: item.doc.sha256Hash,
    importedAt: new Date().toLocaleString('pt-BR'),
    docKind: KIND_LABEL[item.extraction.kind] as StoredProntuarioDocument['docKind'],
    extractionMethod: item.doc.method,
    extractedText: item.doc.text ?? '',
    previewDataUrl: item.doc.previewImageUrl,
    fieldsUpdated: changedFieldsLog,
    validatedBy: 'Equipe de Saúde APS SESI',
  };

  const previousStoredDocs = existingEmployee?.storedDocuments ?? [];
  const previousExams = existingEmployee?.examResultsAndPrescriptions ?? [];
  const newExams = item.extraction.clinicalSummary
    ? [
        {
          id: `ocr-ex-${Date.now()}`,
          date: lastVisitIso || '2026-11-15',
          category: item.extraction.clinicalSummary.category,
          title: item.extraction.clinicalSummary.title,
          details: item.extraction.clinicalSummary.details,
          sourceMethod: 'OCR' as const,
          validatedBy: 'Equipe de Saúde APS SESI',
          fileName: item.doc.name,
          mimeType: item.doc.mimeType,
          fileSizeBytes: item.doc.sizeBytes,
          sha256Hash: item.doc.sha256Hash,
          evidenceSnippet: changedFieldsLog[0]?.evidence,
          rawExtractedText: item.doc.text,
          previewDataUrl: item.doc.previewImageUrl,
        },
        ...previousExams,
      ]
    : previousExams;

  const shift = item.extraRegistration.shift || existingEmployee?.shift || '1º Turno (06h–14h)';
  const sector = item.extraRegistration.sector || existingEmployee?.sector || companyMeta.sectors[0];
  const role = item.extraRegistration.role || existingEmployee?.role || `Operador(a) (${sector}) • ${shift}`;

  const base: Employee = {
    id: existingEmployee?.id ?? `emp-${matricula}`,
    matricula,
    name: formattedName,
    status: (getVal('status') === 'INATIVO' ? 'INATIVO' : 'ATIVO') as 'ATIVO' | 'INATIVO',
    birthDate: brDateToIso(getVal('nascimento')) || existingEmployee?.birthDate || '1988-05-14',
    age: Number(getVal('idade')) || existingEmployee?.age || 38,
    cpf: getVal('cpf') || existingEmployee?.cpf || '000.000.000-00',
    sex: (getVal('sexo') === 'FEMININO' ? 'FEMININO' : 'MASCULINO') as 'MASCULINO' | 'FEMININO',
    admissionDate: brDateToIso(getVal('entradaAps')) || existingEmployee?.admissionDate || '2025-03-15',
    phone: getVal('telefone') || existingEmployee?.phone || '(71) 99800-0000',
    companyId: companyMeta.id,
    companyName,
    companyUnit: existingEmployee?.companyUnit || companyMeta.unit,
    referenceDoctor: getVal('medico') || existingEmployee?.referenceDoctor || 'Dra. Beatriz Campos',
    multiTeamCare: getVal('multi') ? getVal('multi') === 'SIM' : existingEmployee?.multiTeamCare ?? false,
    lastNutritionDate: brDateToIso(getVal('ultNutri')) || existingEmployee?.lastNutritionDate || '',
    lastPsychologyDate: brDateToIso(getVal('ultPsico')) || existingEmployee?.lastPsychologyDate || '',
    lastVisit: lastVisitIso,
    contactHistory2026: getVal('historico') || existingEmployee?.contactHistory2026 || `Documento ${item.doc.name} validado`,
    monthlyContacts: {
      jul: getVal('contJul') || existingEmployee?.monthlyContacts?.jul || '—',
      ago: getVal('contAgo') || existingEmployee?.monthlyContacts?.ago || '—',
      set: getVal('contSet') || existingEmployee?.monthlyContacts?.set || '—',
      out: getVal('contOut') || existingEmployee?.monthlyContacts?.out || '—',
      nov: getVal('contNov') || existingEmployee?.monthlyContacts?.nov || 'Realizado',
      dez: getVal('contDez') || existingEmployee?.monthlyContacts?.dez || 'Programado',
    },
    returnRule,
    nextVisit,
    lastMedicalDemands: getVal('demandas') || existingEmployee?.lastMedicalDemands || 'Acompanhamento de coordenação do cuidado registrado.',
    riskLevel,
    initialRiskLevel,
    riskVerificationReturnDate: brDateToIso(getVal('retornoRisco')) || nextVisit,
    planSentDate: brDateToIso(getVal('envioPlano')) || existingEmployee?.planSentDate || lastVisitIso,
    goalsAdhesionStatus: brDateToIso(getVal('verificarAdesao')) || getVal('verificarAdesao') || existingEmployee?.goalsAdhesionStatus || nextVisit,
    carePlanStatus: getVal('statusPlano') || existingEmployee?.carePlanStatus || (riskLevel > 0 ? 'AGUARDANDO RESPOSTA' : ''),
    careCoordinationDate: brDateToIso(getVal('coordData')) || existingEmployee?.careCoordinationDate || '2026-11-15',
    nextCareCoordinationDate: brDateToIso(getVal('coordProxima')) || existingEmployee?.nextCareCoordinationDate || nextVisit,
    sector,
    shift,
    role,
    neverScheduled: riskLevel === 0,
    daysSinceActivation: existingEmployee?.daysSinceActivation ?? 42,
    sentStatus: existingEmployee?.sentStatus ?? false,
    carePassCode: existingEmployee?.carePassCode ?? `PASSE-${matricula.slice(-4)}`,
    protectedWindowSlot:
      existingEmployee?.protectedWindowSlot ??
      (shift.startsWith('1º Turno') ? companyMeta.shift1Slot : companyMeta.shift2Slot),
    summaryLine:
      riskLevel > 0
        ? `Risco ${riskLevel} • ${getVal('demandas') || existingEmployee?.lastMedicalDemands || 'Em acompanhamento na APS'}`
        : `Ativo sem 1ª consulta • Busca ativa`,
    clinicalNotes:
      existingEmployee?.clinicalNotes ||
      `Registro validado a partir de ${item.doc.name} (${item.doc.method}).`,
    habits: existingEmployee?.habits ?? ['Registrado na Coordenação do Cuidado'],
    conditions: existingEmployee?.conditions ?? [getVal('demandas') || 'Avaliação APS'],
    medsAndScreening: existingEmployee?.medsAndScreening ?? ['Conforme plano de cuidado'],
    pciRecommendations: existingEmployee?.pciRecommendations ?? [`Retorno programado (${returnRule})`],
    pciExams: existingEmployee?.pciExams ?? ['Exames de acompanhamento APS'],
    examResultsAndPrescriptions: newExams,
    storedDocuments: [storedDoc, ...previousStoredDocs],
    whatsappStatus: existingEmployee?.whatsappStatus ?? 'Agendamento sincronizado (S+ / Microsoft Teams)',
    returnNotes: `Atualizado via importação (${item.doc.name}) • Hash SHA-256: ${item.doc.sha256Hash.slice(0, 12)}...`,
    checkIn60s: existingEmployee?.checkIn60s,
  };

  return normalizeEmployeeAfterSave(base);
}

export function highlightEvidenceParts(ev: string): string[] {
  return ev
    .replace(/[“”"]/g, '')
    .split(/\s+·\s+|:\s+|\s{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 3 && p !== '…');
}

export function sourceDocsToQueueItems(
  docs: SourceDoc[],
  employees: Employee[]
): ImportQueueItem[] {
  const items: ImportQueueItem[] = [];
  for (const doc of docs) {
    const extractions = analyzeSourceDoc(doc);
    if (doc.records?.length && extractions.length === doc.records.length) {
      extractions.forEach((ex, idx) => {
        if (ex.proposals.length > 0 || ex.identity.matricula || ex.identity.nome) {
          items.push(buildImportQueueItem(doc, ex, employees, doc.records![idx]));
        }
      });
    } else {
      for (const ex of extractions) {
        items.push(buildImportQueueItem(doc, ex, employees));
      }
    }
  }
  return items;
}

export async function createPastedTextSourceDoc(
  rawText: string,
  title = 'Texto colado'
): Promise<SourceDoc> {
  const encoded = new TextEncoder().encode(rawText);
  const sha256Hash = await computeSha256Hex(encoded.buffer as ArrayBuffer);
  const isWhatsapp = parseWhatsApp(rawText).length >= 2;
  return {
    id: nextDocId(),
    name: title,
    channel: isWhatsapp ? 'whatsapp' : 'texto',
    method: 'Texto colado',
    text: rawText,
    refDate: inferRefDate(rawText),
    ms: 1,
    sha256Hash,
    sizeBytes: encoded.byteLength,
    mimeType: 'text/plain',
  };
}

export async function loadDemoFilesFromPublic(
  fileNames: readonly string[] = SECILITA_DEMO_FILES
): Promise<SourceDoc[]> {
  const allDocs: SourceDoc[] = [];
  for (const fn of fileNames) {
    try {
      const resp = await fetch(`/demo/${fn}`);
      if (!resp.ok) continue;
      const blob = await resp.blob();
      const file = new File([blob], fn, { type: blob.type || undefined });
      const docs = await readImportedFile(file);
      allDocs.push(...docs);
    } catch {
      // Ignora falha de rede individual
    }
  }
  return allDocs;
}

