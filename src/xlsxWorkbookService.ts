import { Employee, RiskLevel, ReturnRule } from './types';
import {
  XLSX_STATIC_ENTRIES,
  XLSX_SHEET1_BEFORE_DATA,
  XLSX_SHEET1_HEADER_ROW,
  XLSX_SHEET1_AFTER_DATA,
} from './xlsxStaticTemplate';

/**
 * 32 Colunas oficiais da planilha Excel "APS SESI dados fictícios.xlsx" (Aba "Coordenação do cuidado")
 */
export const APS_SESI_XLSX_HEADERS = [
  'MATRÍCULA',
  'NOME COMPLETO',
  'STATUS',
  'DATA DE NASCIMENTO',
  'IDADE',
  'CPF',
  'SEXO',
  'DATA DE ENTRADA APS',
  'TELEFONE',
  'EMPRESA',
  'MÉDICO DE REFERÊNCIA',
  'ATENDIMENTO COM EQUIPE MULTI?',
  'DATA ÚLTIMA CONSULTA NUTRICIONISTA',
  'DATA ÚLTIMA CONSULTA PSICOLOGIA',
  'DATA ÚLTIMA CONSULTA MÉDICA',
  'HISTÓRICO CONTATO DE CONSTADOS DE 2026',
  'CONTATO DE JULHO/ 2026',
  'CONTATO DE AGOSTO / 2026',
  'CONTATO DE SETEMBRO / 2026',
  'CONTATO DE OUTUBRO / 2026',
  'CONTATO DE NOVEMBRO / 2026',
  'CONTATO DE DEZEMBRO / 2026',
  'PREVISÃO DE RETORNO  CONFORME SOLICITAÇÃO MÉDICA',
  'DEMANDAS GERADAS NA ÚLTIMA CONSULTA MÉDICA',
  'CLASSIFICAÇÃO DE RISCO ATUAL',
  'CLASSIFICAÇÃO DE RISCO INICIAL',
  'RETORNO DO ATENDIMENTO MÉDICO PARA VERIFICAR CLASSIFICAÇÃO DE RISCO',
  'DATA ENVIO DO PLANO',
  'VERIFICAR ADESÃO DAS METAS',
  'STATUS PLANO DE CUIDADO',
  'DATA DA COORD CUIDADO',
  'DATA DA PRÓXIMA COORD CUIDADO2',
] as const;

export const CARE_PLAN_VALID_OPTIONS = [
  'ADERIU TOTALMENTE',
  'ADERIU PARCIALMENTE',
  'AGUARDANDO RESPOSTA',
  'NÃO ADERIU',
] as const;

export type CarePlanStatusOption = (typeof CARE_PLAN_VALID_OPTIONS)[number] | '';

const COL_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
  'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF',
];

/**
 * Estilos originais das 32 colunas de dados (s attribute em xl/worksheets/sheet1.xml)
 */
const DATA_COL_STYLES = [
  27, // A: MATRÍCULA
  28, // B: NOME COMPLETO
  29, // C: STATUS
  30, // D: DATA DE NASCIMENTO
  31, // E: IDADE
  32, // F: CPF
  33, // G: SEXO
  34, // H: DATA DE ENTRADA APS
  35, // I: TELEFONE
  36, // J: EMPRESA
  37, // K: MÉDICO DE REFERÊNCIA
  33, // L: ATENDIMENTO COM EQUIPE MULTI?
  38, // M: DATA ÚLTIMA CONSULTA NUTRICIONISTA
  30, // N: DATA ÚLTIMA CONSULTA PSICOLOGIA
  30, // O: DATA ÚLTIMA CONSULTA MÉDICA
  39, // P: HISTÓRICO CONTATO DE CONSTADOS DE 2026
  39, // Q: CONTATO DE JULHO/ 2026
  39, // R: CONTATO DE AGOSTO / 2026
  39, // S: CONTATO DE SETEMBRO / 2026
  39, // T: CONTATO DE OUTUBRO / 2026
  39, // U: CONTATO DE NOVEMBRO / 2026
  39, // V: CONTATO DE DEZEMBRO / 2026
  40, // W: PREVISÃO DE RETORNO CONFORME SOLICITAÇÃO MÉDICA
  41, // X: DEMANDAS GERADAS NA ÚLTIMA CONSULTA MÉDICA
  42, // Y: CLASSIFICAÇÃO DE RISCO ATUAL
  43, // Z: CLASSIFICAÇÃO DE RISCO INICIAL
  30, // AA: RETORNO DO ATENDIMENTO MÉDICO PARA VERIFICAR CLASSIFICAÇÃO DE RISCO
  30, // AB: DATA ENVIO DO PLANO
  30, // AC: VERIFICAR ADESÃO DAS METAS
  44, // AD: STATUS PLANO DE CUIDADO
  45, // AE: DATA DA COORD CUIDADO
  45, // AF: DATA DA PRÓXIMA COORD CUIDADO2
];

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * Converte data DD/MM/AAAA ou AAAA-MM-DD para número serial do Excel (base 1900)
 */
export function dateStrToExcelSerial(value?: string): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '—' || trimmed.toLowerCase().includes('nunca') || trimmed.toLowerCase().includes('pendente') || trimmed.toLowerCase().includes('inativo')) return null;

  let year = 0;
  let month = 0;
  let day = 0;

  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    day = Number(brMatch[1]);
    month = Number(brMatch[2]);
    year = Number(brMatch[3]);
  } else {
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      year = Number(isoMatch[1]);
      month = Number(isoMatch[2]);
      day = Number(isoMatch[3]);
    } else {
      return null;
    }
  }

  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const utcMs = Date.UTC(year, month - 1, day);
  return 25569 + Math.round(utcMs / 86400000);
}

/**
 * Converte número serial do Excel (ex: 34408) para AAAA-MM-DD
 */
export function excelSerialToIsoDate(serial: number): string {
  const utcDays = Math.round(serial - 25569);
  const dt = new Date(utcDays * 86400000);
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = dt.getUTCFullYear();
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Normaliza o status do plano de cuidado para um dos 4 valores da validação de dados do Excel
 * ("ADERIU PARCIALMENTE,AGUARDANDO RESPOSTA,ADERIU TOTALMENTE,NÃO ADERIU")
 */
export function normalizeCarePlanStatusForExcel(
  rawStatus: string | undefined,
  emp?: Pick<Employee, 'status' | 'neverScheduled' | 'riskLevel'>
): CarePlanStatusOption {
  if (emp && (emp.status === 'INATIVO' || emp.neverScheduled || emp.riskLevel === 0)) {
    return '';
  }
  const upper = (rawStatus || '').trim().toUpperCase();
  if (!upper || upper === '—' || upper.includes('PENDENTE') || upper.includes('INATIVO')) return '';
  if (upper === 'ADERIU TOTALMENTE' || upper.includes('TOTALMENTE') || upper.includes('CONCLUÍDO') || upper.includes('ESTABILIZADO')) {
    return 'ADERIU TOTALMENTE';
  }
  if (upper === 'ADERIU PARCIALMENTE' || upper.includes('PARCIAL') || upper.includes('TRIMESTRAL') || upper.includes('SEMESTRAL')) {
    return 'ADERIU PARCIALMENTE';
  }
  if (upper === 'NÃO ADERIU' || upper === 'NAO ADERIU' || upper.includes('NÃO ADERIU')) {
    return 'NÃO ADERIU';
  }
  if (
    upper === 'AGUARDANDO RESPOSTA' ||
    upper.includes('AGUARDANDO') ||
    upper.includes('PRIORIDADE') ||
    upper.includes('MONITORAMENTO') ||
    upper.includes('SEGUIMENTO')
  ) {
    return 'AGUARDANDO RESPOSTA';
  }
  return 'AGUARDANDO RESPOSTA';
}

/**
 * Constrói o arquivo binário .xlsx ("APS SESI dados fictícios.xlsx") fiel ao modelo oficial do SESI
 */
export function buildApsSesiXlsxBytes(employees: Employee[]): Uint8Array {
  const sharedStrings: string[] = [...APS_SESI_XLSX_HEADERS];
  const sharedMap = new Map<string, number>();
  sharedStrings.forEach((s, idx) => sharedMap.set(s, idx));

  let sstCount = 32;

  const getSharedStringIndex = (val: string): number => {
    sstCount += 1;
    const existing = sharedMap.get(val);
    if (existing !== undefined) return existing;
    const idx = sharedStrings.length;
    sharedStrings.push(val);
    sharedMap.set(val, idx);
    return idx;
  };

  const rowsXml: string[] = [XLSX_SHEET1_HEADER_ROW];

  employees.forEach((emp, i) => {
    const r = i + 2;
    const isInactive = emp.status === 'INATIVO';
    const isEvaluated = !isInactive && !emp.neverScheduled && emp.riskLevel > 0;

    const matriculaNum = Number(String(emp.matricula || '').replace(/\D/g, '')) || 20261001 + i;
    const statusStr = isInactive ? 'INATIVO' : 'ATIVO';
    const multiTeamStr = emp.multiTeamCare ? 'SIM' : 'NÃO';
    const currentRiskStr = isEvaluated ? `RISCO ${emp.riskLevel}` : '';
    const initialRiskLevel =
      emp.initialRiskLevel && emp.initialRiskLevel > 0 ? emp.initialRiskLevel : emp.riskLevel;
    const initialRiskStr = isEvaluated && initialRiskLevel > 0 ? `RISCO ${initialRiskLevel}` : '';
    const carePlanStr = normalizeCarePlanStatusForExcel(emp.carePlanStatus, emp);

    const demandsStr = isEvaluated
      ? emp.lastMedicalDemands || emp.pciExams.join(' | ')
      : '';

    const mc = emp.monthlyContacts || {
      jul: '',
      ago: '',
      set: '',
      out: '',
      nov: '',
      dez: '',
    };

    const contact2026Str = isInactive
      ? ''
      : emp.contactHistory2026 ||
        (emp.sentStatus
          ? `Passe enviado (${emp.protectedWindowSlot || 'Turno'}) — ${emp.whatsappStatus}`
          : emp.whatsappStatus);

    const cells: string[] = [];

    const pushEmpty = (colIdx: number) => {
      const ref = `${COL_LETTERS[colIdx]}${r}`;
      const style = DATA_COL_STYLES[colIdx];
      cells.push(`<c r="${ref}" s="${style}"/>`);
    };

    const pushString = (colIdx: number, val?: string) => {
      const cleaned = (val || '').trim();
      if (!cleaned || cleaned === '—') {
        pushEmpty(colIdx);
        return;
      }
      const ref = `${COL_LETTERS[colIdx]}${r}`;
      const style = DATA_COL_STYLES[colIdx];
      const sstIdx = getSharedStringIndex(cleaned);
      cells.push(`<c r="${ref}" s="${style}" t="s"><v>${sstIdx}</v></c>`);
    };

    const pushDateOrString = (colIdx: number, val?: string) => {
      const cleaned = (val || '').trim();
      if (
        !cleaned ||
        cleaned === '—' ||
        cleaned.toLowerCase().includes('nunca') ||
        cleaned.toLowerCase().includes('pendente') ||
        cleaned.toLowerCase().includes('inativo')
      ) {
        pushEmpty(colIdx);
        return;
      }
      const serial = dateStrToExcelSerial(cleaned);
      const ref = `${COL_LETTERS[colIdx]}${r}`;
      const style = DATA_COL_STYLES[colIdx];
      if (serial !== null) {
        cells.push(`<c r="${ref}" s="${style}"><v>${serial}</v></c>`);
      } else {
        const sstIdx = getSharedStringIndex(cleaned);
        cells.push(`<c r="${ref}" s="${style}" t="s"><v>${sstIdx}</v></c>`);
      }
    };

    // Col 0 (A): MATRÍCULA (numérico)
    cells.push(`<c r="A${r}" s="${DATA_COL_STYLES[0]}"><v>${matriculaNum}</v></c>`);
    // Col 1 (B): NOME COMPLETO (em CAIXA ALTA como na planilha original)
    pushString(1, emp.name.toUpperCase());
    // Col 2 (C): STATUS (ATIVO / INATIVO)
    pushString(2, statusStr);
    // Col 3 (D): DATA DE NASCIMENTO
    pushDateOrString(3, emp.birthDate);
    // Col 4 (E): IDADE (fórmula oficial Excel)
    cells.push(
      `<c r="E${r}" s="${DATA_COL_STYLES[4]}"><f>IFERROR(INT((TODAY()-D${r})/365.25),"")</f><v>${emp.age || 35}</v></c>`
    );
    // Col 5 (F): CPF
    pushString(5, emp.cpf);
    // Col 6 (G): SEXO
    pushString(6, emp.sex?.toUpperCase() === 'FEMININO' ? 'FEMININO' : 'MASCULINO');
    // Col 7 (H): DATA DE ENTRADA APS
    pushDateOrString(7, emp.admissionDate);
    // Col 8 (I): TELEFONE
    pushString(8, emp.phone);
    // Col 9 (J): EMPRESA
    pushString(9, emp.companyName);
    // Col 10 (K): MÉDICO DE REFERÊNCIA
    pushString(10, emp.referenceDoctor);
    // Col 11 (L): ATENDIMENTO COM EQUIPE MULTI?
    pushString(11, multiTeamStr);
    // Col 12 (M): DATA ÚLTIMA CONSULTA NUTRICIONISTA
    pushDateOrString(12, isInactive ? '' : emp.lastNutritionDate);
    // Col 13 (N): DATA ÚLTIMA CONSULTA PSICOLOGIA
    pushDateOrString(13, isInactive ? '' : emp.lastPsychologyDate);
    // Col 14 (O): DATA ÚLTIMA CONSULTA MÉDICA
    pushDateOrString(14, isEvaluated ? emp.lastVisit : '');
    // Col 15 (P): HISTÓRICO CONTATO DE CONSTADOS DE 2026
    pushString(15, contact2026Str);
    // Col 16 (Q): CONTATO DE JULHO/ 2026
    pushString(16, isInactive ? '' : mc.jul);
    // Col 17 (R): CONTATO DE AGOSTO / 2026
    pushString(17, isInactive ? '' : mc.ago);
    // Col 18 (S): CONTATO DE SETEMBRO / 2026
    pushString(18, isInactive ? '' : mc.set);
    // Col 19 (T): CONTATO DE OUTUBRO / 2026
    pushString(19, isInactive ? '' : mc.out);
    // Col 20 (U): CONTATO DE NOVEMBRO / 2026
    pushString(
      20,
      isInactive
        ? ''
        : mc.nov || (emp.sentStatus ? `Passe enviado (${emp.protectedWindowSlot || 'Turno'})` : '')
    );
    // Col 21 (V): CONTATO DE DEZEMBRO / 2026
    pushString(21, isInactive ? '' : mc.dez);
    // Col 22 (W): PREVISÃO DE RETORNO CONFORME SOLICITAÇÃO MÉDICA
    pushDateOrString(22, isEvaluated ? emp.nextVisit : '');
    // Col 23 (X): DEMANDAS GERADAS NA ÚLTIMA CONSULTA MÉDICA
    pushString(23, demandsStr);
    // Col 24 (Y): CLASSIFICAÇÃO DE RISCO ATUAL
    pushString(24, currentRiskStr);
    // Col 25 (Z): CLASSIFICAÇÃO DE RISCO INICIAL
    pushString(25, initialRiskStr);
    // Col 26 (AA): RETORNO DO ATENDIMENTO MÉDICO PARA VERIFICAR CLASSIFICAÇÃO DE RISCO
    pushDateOrString(26, isEvaluated ? emp.riskVerificationReturnDate || emp.nextVisit : '');
    // Col 27 (AB): DATA ENVIO DO PLANO
    pushDateOrString(27, isEvaluated ? emp.planSentDate || emp.lastVisit : '');
    // Col 28 (AC): VERIFICAR ADESÃO DAS METAS
    pushDateOrString(28, isEvaluated ? emp.goalsAdhesionStatus : '');
    // Col 29 (AD): STATUS PLANO DE CUIDADO
    pushString(29, carePlanStr);
    // Col 30 (AE): DATA DA COORD CUIDADO
    pushDateOrString(30, isEvaluated ? emp.careCoordinationDate || emp.lastVisit : '');
    // Col 31 (AF): DATA DA PRÓXIMA COORD CUIDADO2
    pushDateOrString(31, isEvaluated ? emp.nextCareCoordinationDate || emp.nextVisit : '');

    rowsXml.push(`<row r="${r}" spans="1:32">${cells.join('')}</row>`);
  });

  const lastRow = Math.max(2, employees.length + 1);
  const sheetXml =
    XLSX_SHEET1_BEFORE_DATA +
    `<sheetData>${rowsXml.join('')}</sheetData>` +
    XLSX_SHEET1_AFTER_DATA;

  const sstItemsXml = sharedStrings.map((s) => `<si><t>${escapeXml(s)}</t></si>`).join('');
  const sharedStringsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n` +
    `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sstCount}" uniqueCount="${sharedStrings.length}">${sstItemsXml}</sst>`;

  const tableXml = XLSX_STATIC_ENTRIES['xl/tables/table1.xml'].replace(
    /ref="A1:AF\d+"/g,
    `ref="A1:AF${lastRow}"`
  );

  const allFiles: Record<string, string> = {
    ...XLSX_STATIC_ENTRIES,
    'xl/tables/table1.xml': tableXml,
    'xl/sharedStrings.xml': sharedStringsXml,
    'xl/worksheets/sheet1.xml': sheetXml,
  };

  return createStoredZipBytes(allFiles);
}

/**
 * Empacotador ZIP (STORED method 0 + CRC32) compatível com Excel, LibreOffice e OpenXML SDK
 */
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32Bytes(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUInt16LE(buf: Uint8Array, val: number, offset: number) {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >>> 8) & 0xff;
}

function writeUInt32LE(buf: Uint8Array, val: number, offset: number) {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >>> 8) & 0xff;
  buf[offset + 2] = (val >>> 16) & 0xff;
  buf[offset + 3] = (val >>> 24) & 0xff;
}

function createStoredZipBytes(entries: Record<string, string>): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const names = Object.keys(entries);

  for (const name of names) {
    const nameBytes = encoder.encode(name);
    const dataBytes = encoder.encode(entries[name]);
    const crc = crc32Bytes(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    writeUInt32LE(localHeader, 0x04034b50, 0);
    writeUInt16LE(localHeader, 20, 4);
    writeUInt16LE(localHeader, 0, 6);
    writeUInt16LE(localHeader, 0, 8); // STORED (0)
    writeUInt16LE(localHeader, 0, 10);
    writeUInt16LE(localHeader, 0x5421, 12);
    writeUInt32LE(localHeader, crc, 14);
    writeUInt32LE(localHeader, dataBytes.length, 18);
    writeUInt32LE(localHeader, dataBytes.length, 22);
    writeUInt16LE(localHeader, nameBytes.length, 26);
    writeUInt16LE(localHeader, 0, 28);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    writeUInt32LE(centralHeader, 0x02014b50, 0);
    writeUInt16LE(centralHeader, 20, 4);
    writeUInt16LE(centralHeader, 20, 6);
    writeUInt16LE(centralHeader, 0, 8);
    writeUInt16LE(centralHeader, 0, 10);
    writeUInt16LE(centralHeader, 0, 12);
    writeUInt16LE(centralHeader, 0x5421, 14);
    writeUInt32LE(centralHeader, crc, 16);
    writeUInt32LE(centralHeader, dataBytes.length, 20);
    writeUInt32LE(centralHeader, dataBytes.length, 24);
    writeUInt16LE(centralHeader, nameBytes.length, 28);
    writeUInt16LE(centralHeader, 0, 30);
    writeUInt16LE(centralHeader, 0, 32);
    writeUInt16LE(centralHeader, 0, 34);
    writeUInt16LE(centralHeader, 0, 36);
    writeUInt32LE(centralHeader, 0, 38);
    writeUInt32LE(centralHeader, offset, 42);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  let centralSize = 0;
  for (const part of centralParts) centralSize += part.length;

  const eocd = new Uint8Array(22);
  writeUInt32LE(eocd, 0x06054b50, 0);
  writeUInt16LE(eocd, 0, 4);
  writeUInt16LE(eocd, 0, 6);
  writeUInt16LE(eocd, names.length, 8);
  writeUInt16LE(eocd, names.length, 10);
  writeUInt32LE(eocd, centralSize, 12);
  writeUInt32LE(eocd, offset, 16);
  writeUInt16LE(eocd, 0, 20);

  const totalSize = offset + centralSize + eocd.length;
  const out = new Uint8Array(totalSize);
  let pos = 0;
  for (const p of localParts) {
    out.set(p, pos);
    pos += p.length;
  }
  for (const p of centralParts) {
    out.set(p, pos);
    pos += p.length;
  }
  out.set(eocd, pos);
  return out;
}

/**
 * Descompacta entradas de um arquivo .xlsx (STORED ou DEFLATE) em navegador ou Node 22+
 */
async function inflateRawBytes(compressed: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(compressed as unknown as BufferSource);
  writer.close();
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function readUInt16LE(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8);
}

function readUInt32LE(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset] |
      (buf[offset + 1] << 8) |
      (buf[offset + 2] << 16) |
      (buf[offset + 3] << 24)) >>>
    0
  );
}

export async function unzipXlsxEntries(buffer: ArrayBuffer | Uint8Array): Promise<Record<string, string>> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const decoder = new TextDecoder('utf-8');
  const entries: Record<string, string> = {};

  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (readUInt32LE(bytes, i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new Error('Arquivo Excel (.xlsx) inválido: cabeçalho ZIP EOCD não encontrado.');
  }

  const totalEntries = readUInt16LE(bytes, eocdOffset + 10);
  const centralDirOffset = readUInt32LE(bytes, eocdOffset + 16);

  let ptr = centralDirOffset;
  for (let e = 0; e < totalEntries; e++) {
    if (readUInt32LE(bytes, ptr) !== 0x02014b50) break;
    const method = readUInt16LE(bytes, ptr + 10);
    const compressedSize = readUInt32LE(bytes, ptr + 20);
    const fileNameLen = readUInt16LE(bytes, ptr + 28);
    const extraLen = readUInt16LE(bytes, ptr + 30);
    const commentLen = readUInt16LE(bytes, ptr + 32);
    const localHeaderOffset = readUInt32LE(bytes, ptr + 42);
    const name = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + fileNameLen));

    const localNameLen = readUInt16LE(bytes, localHeaderOffset + 26);
    const localExtraLen = readUInt16LE(bytes, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const compressedSlice = bytes.subarray(dataStart, dataStart + compressedSize);

    if (name === 'xl/sharedStrings.xml' || name === 'xl/worksheets/sheet1.xml') {
      if (method === 0) {
        entries[name] = decoder.decode(compressedSlice);
      } else if (method === 8) {
        const uncompressed = await inflateRawBytes(compressedSlice);
        entries[name] = decoder.decode(uncompressed);
      }
    }

    ptr += 46 + fileNameLen + extraLen + commentLen;
  }

  return entries;
}

const DATE_COL_INDICES = new Set([3, 7, 12, 13, 14, 22, 26, 27, 28, 30, 31]);

const COMPANY_MAP_BY_NAME: Record<string, { id: string; unit: string }> = {
  'Têxtil Horizonte Ltda': { id: 'comp-textil', unit: 'Unidade Camaçari • Polo Industrial' },
  'Plásticos Recôncavo Ltda': { id: 'comp-plasticos', unit: 'Unidade Simões Filho • CIA Sul' },
  'Cerâmica Pedra Azul Ltda': { id: 'comp-ceramica', unit: 'Unidade Feira de Santana • CIS' },
  'Metalúrgica Atlântida Ltda': { id: 'comp-metalurgica', unit: 'Unidade Candeias • Distrito Industrial' },
  'Alimentos Vale Verde Ltda': { id: 'comp-alimentos', unit: 'Unidade Lauro de Freitas • Polo Logístico' },
  'Química Litoral Norte S.A.': { id: 'comp-quimica', unit: 'Unidade Dias d’Ávila • Complexo Básico' },
};

/**
 * Lê um arquivo "APS SESI dados fictícios.xlsx" e sincroniza todas as linhas com a base de funcionários
 */
export async function parseApsSesiXlsxBytes(
  buffer: ArrayBuffer | Uint8Array,
  existingEmployees: Employee[]
): Promise<{
  updatedEmployees: Employee[];
  totalRowsRead: number;
  activeCount: number;
  inactiveFilteredCount: number;
  newlySyncedToWindow2: number;
}> {
  const entries = await unzipXlsxEntries(buffer);
  const sstXml = entries['xl/sharedStrings.xml'] || '';
  const sheetXml = entries['xl/worksheets/sheet1.xml'] || '';

  const sharedStrings: string[] = [];
  const siRegex = /<si>([\s\S]*?)<\/si>/g;
  let siMatch: RegExpExecArray | null;
  while ((siMatch = siRegex.exec(sstXml)) !== null) {
    const inner = siMatch[1];
    const tMatches = [...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)];
    sharedStrings.push(tMatches.map((m) => unescapeXml(m[1])).join(''));
  }

  const rowRegex = /<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  const parsedRows: string[][] = [];
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    const rNum = Number(rowMatch[1]);
    if (rNum === 1) continue; // Cabeçalho
    const rowContent = rowMatch[2];
    const rowCols = Array(32).fill('');

    const cellRegex = /<c r="([A-Z]+)\d+"([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const colLet = cellMatch[1];
      const colIdx = COL_LETTERS.indexOf(colLet);
      if (colIdx < 0 || colIdx >= 32) continue;
      const attrs = cellMatch[2] || '';
      const inner = cellMatch[3] || '';
      if (!inner) continue;
      const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
      if (!vMatch) continue;
      const rawVal = vMatch[1].trim();
      const isSharedStr = /t="s"/.test(attrs);
      const isInlineStr = /t="str"/.test(attrs);

      if (isSharedStr) {
        const idx = Number(rawVal);
        rowCols[colIdx] = sharedStrings[idx] ?? '';
      } else if (isInlineStr) {
        rowCols[colIdx] = unescapeXml(rawVal);
      } else if (DATE_COL_INDICES.has(colIdx) && /^\d+(\.\d+)?$/.test(rawVal)) {
        const serial = Number(rawVal);
        rowCols[colIdx] = serial > 10000 ? excelSerialToIsoDate(serial) : rawVal;
      } else {
        rowCols[colIdx] = rawVal;
      }
    }

    if (rowCols[0] || rowCols[1]) {
      parsedRows.push(rowCols);
    }
  }

  const byMatricula = new Map<string, Employee>();
  const byName = new Map<string, Employee>();
  existingEmployees.forEach((e) => {
    if (e.matricula) byMatricula.set(String(e.matricula).trim(), e);
    byName.set(e.name.toLowerCase(), e);
  });

  let activeCount = 0;
  let inactiveFilteredCount = 0;
  let newlySyncedToWindow2 = 0;
  const updatedList: Employee[] = [...existingEmployees];

  parsedRows.forEach((cols, idx) => {
    const matricula = (cols[0] || '').trim();
    const fullName = (cols[1] || '').trim();
    const statusRaw = (cols[2] || '').trim().toUpperCase();
    const birthDate = (cols[3] || '').trim();
    const age = Number(cols[4]) || 35;
    const cpf = (cols[5] || '').trim();
    const sexRaw = (cols[6] || '').trim().toUpperCase();
    const sex: 'MASCULINO' | 'FEMININO' = sexRaw.startsWith('F') ? 'FEMININO' : 'MASCULINO';
    const admissionDate = (cols[7] || '').trim();
    const phone = (cols[8] || '').trim();
    const companyName = (cols[9] || 'Têxtil Horizonte Ltda').trim();
    const referenceDoctor = (cols[10] || 'Dr. Felipe Andrade').trim();
    const multiTeamCare = (cols[11] || '').trim().toUpperCase() === 'SIM';
    const lastNutritionDate = (cols[12] || '').trim();
    const lastPsychologyDate = (cols[13] || '').trim();
    const lastMedicalVisit = (cols[14] || '').trim();
    const contactHistory2026 = (cols[15] || '').trim();
    const contactJul2026 = (cols[16] || '').trim();
    const contactAug2026 = (cols[17] || '').trim();
    const contactSep2026 = (cols[18] || '').trim();
    const contactOct2026 = (cols[19] || '').trim();
    const contactNov2026 = (cols[20] || '').trim();
    const contactDec2026 = (cols[21] || '').trim();
    const medicalReturnPrediction = (cols[22] || '').trim();
    const lastMedicalDemands = (cols[23] || '').trim();
    const currentRiskStr = (cols[24] || '').trim().toUpperCase();
    const initialRiskStr = (cols[25] || '').trim().toUpperCase();
    const riskVerificationReturnDate = (cols[26] || '').trim();
    const planSentDate = (cols[27] || '').trim();
    const goalsAdhesionStatus = (cols[28] || '').trim();
    const carePlanStatusRaw = (cols[29] || '').trim();
    const careCoordinationDate = (cols[30] || '').trim();
    const nextCareCoordinationDate = (cols[31] || '').trim();

    if (statusRaw === 'INATIVO') {
      inactiveFilteredCount += 1;
    } else {
      activeCount += 1;
    }

    const parseRisk = (val: string): RiskLevel => {
      if (val.includes('4')) return 4;
      if (val.includes('3')) return 3;
      if (val.includes('2')) return 2;
      if (val.includes('1')) return 1;
      return 0;
    };

    const parsedRisk = parseRisk(currentRiskStr);
    const parsedInitialRisk = parseRisk(initialRiskStr) || parsedRisk;

    const existing = byMatricula.get(matricula) || byName.get(fullName.toLowerCase());
    if (existing) {
      const indexInList = updatedList.findIndex((item) => item.id === existing.id);
      if (indexInList >= 0) {
        const current = updatedList[indexInList];
        updatedList[indexInList] = {
          ...current,
          matricula: matricula || current.matricula,
          status: statusRaw === 'INATIVO' ? 'INATIVO' : 'ATIVO',
          birthDate: birthDate || current.birthDate,
          age: age || current.age,
          cpf: cpf || current.cpf,
          sex: sex || current.sex,
          admissionDate: admissionDate || current.admissionDate,
          phone: phone || current.phone,
          companyName: companyName || current.companyName,
          referenceDoctor: referenceDoctor || current.referenceDoctor,
          multiTeamCare: multiTeamCare || current.multiTeamCare,
          lastNutritionDate: lastNutritionDate || current.lastNutritionDate,
          lastPsychologyDate: lastPsychologyDate || current.lastPsychologyDate,
          contactHistory2026: contactHistory2026 || current.contactHistory2026,
          monthlyContacts: {
            jul: contactJul2026 || current.monthlyContacts?.jul || '—',
            ago: contactAug2026 || current.monthlyContacts?.ago || '—',
            set: contactSep2026 || current.monthlyContacts?.set || '—',
            out: contactOct2026 || current.monthlyContacts?.out || '—',
            nov: contactNov2026 || current.monthlyContacts?.nov || '—',
            dez: contactDec2026 || current.monthlyContacts?.dez || '—',
          },
          lastMedicalDemands: lastMedicalDemands || current.lastMedicalDemands,
          initialRiskLevel: current.initialRiskLevel || parsedInitialRisk,
          riskVerificationReturnDate:
            riskVerificationReturnDate || current.riskVerificationReturnDate,
          planSentDate: planSentDate || current.planSentDate,
          goalsAdhesionStatus: goalsAdhesionStatus || current.goalsAdhesionStatus,
          carePlanStatus: normalizeCarePlanStatusForExcel(
            carePlanStatusRaw || current.carePlanStatus,
            current
          ),
          careCoordinationDate: careCoordinationDate || current.careCoordinationDate,
          nextCareCoordinationDate: nextCareCoordinationDate || current.nextCareCoordinationDate,
        };
      }
    } else if (fullName) {
      newlySyncedToWindow2 += 1;
      const neverScheduled = !lastMedicalVisit && parsedRisk === 0;
      const returnRule: ReturnRule =
        parsedRisk === 4
          ? 'Quinzenal'
          : parsedRisk === 3
          ? 'A cada 3 meses'
          : parsedRisk >= 1
          ? 'A cada 6 meses'
          : '1ª Consulta Inicial';

      const compMeta = COMPANY_MAP_BY_NAME[companyName] || {
        id: 'comp-textil',
        unit: 'Planta Industrial BA',
      };
      const shift = idx % 2 === 0 ? '1º Turno (06h–14h)' : '2º Turno (14h–22h)';

      const newEmp: Employee = {
        id: `emp-xlsx-${matricula || idx + 200}`,
        matricula: matricula || `${20265000 + idx}`,
        name: fullName,
        status: statusRaw === 'INATIVO' ? 'INATIVO' : 'ATIVO',
        birthDate: birthDate || '1988-05-10',
        age,
        cpf: cpf || '000.000.000-00',
        sex,
        role: `Operador Industrial • ${shift}`,
        sector: 'Produção Industrial',
        shift,
        companyId: compMeta.id,
        companyName,
        companyUnit: compMeta.unit,
        admissionDate: admissionDate || '2026-01-15',
        daysSinceActivation: statusRaw === 'INATIVO' ? 0 : 120 + (idx % 60),
        phone: phone || '(71) 98800-0000',
        referenceDoctor,
        multiTeamCare,
        lastNutritionDate,
        lastPsychologyDate,
        contactHistory2026:
          contactHistory2026 || 'Sincronizado da planilha APS SESI dados fictícios.xlsx',
        monthlyContacts: {
          jul: contactJul2026 || '—',
          ago: contactAug2026 || '—',
          set: contactSep2026 || '—',
          out: contactOct2026 || '—',
          nov: contactNov2026 || 'Aguardando',
          dez: contactDec2026 || 'Programado',
        },
        lastMedicalDemands: lastMedicalDemands || 'Avaliação clínica inicial na APS',
        initialRiskLevel: parsedInitialRisk,
        riskVerificationReturnDate: riskVerificationReturnDate || medicalReturnPrediction,
        planSentDate,
        goalsAdhesionStatus: goalsAdhesionStatus || 'Aguardando 1ª consulta',
        carePlanStatus: normalizeCarePlanStatusForExcel(carePlanStatusRaw, {
          status: statusRaw === 'INATIVO' ? 'INATIVO' : 'ATIVO',
          neverScheduled,
          riskLevel: parsedRisk,
        }),
        careCoordinationDate,
        nextCareCoordinationDate,
        riskLevel: parsedRisk,
        neverScheduled,
        lastVisit: lastMedicalVisit || '',
        nextVisit: medicalReturnPrediction || nextCareCoordinationDate || 'Pendente 1ª Consulta',
        returnRule,
        carePassCode: `PASSE-${(matricula || '0000').slice(-4)}`,
        protectedWindowSlot: '08h30–10h00 (1º Turno)',
        summaryLine: neverScheduled
          ? 'Sincronizado da planilha APS SESI dados fictícios.xlsx — Aguardando 1ª Consulta'
          : `Sincronizado da planilha APS SESI dados fictícios.xlsx — Risco ${parsedRisk}`,
        clinicalNotes: `Trabalhador sincronizado a partir da planilha oficial APS SESI dados fictícios.xlsx (Matrícula ${matricula}). Médica(o) de referência: ${referenceDoctor}.`,
        habits: ['Censo APS SESI sincronizado'],
        conditions: neverScheduled ? ['Sem avaliação clínica inicial'] : [`Acompanhamento Risco ${parsedRisk}`],
        medsAndScreening: lastMedicalDemands ? [lastMedicalDemands] : ['Rastreio ocupacional periódico'],
        pciRecommendations: ['Realizar acolhimento multiprofissional e pactuar metas do Plano de Cuidado'],
        pciExams: ['Triagem pressórica, glicêmica e antropométrica'],
        examResultsAndPrescriptions: [],
        whatsappStatus: 'Aguardando disparo do Passe de Cuidado',
        returnNotes: contactHistory2026 || 'Importado via conector oficial APS SESI dados fictícios.xlsx.',
        sentStatus: false,
      };
      updatedList.push(newEmp);
    }
  });

  return {
    updatedEmployees: updatedList,
    totalRowsRead: parsedRows.length,
    activeCount,
    inactiveFilteredCount,
    newlySyncedToWindow2,
  };
}

/**
 * Extrator nativo de texto de arquivos PDF (suporta FlateDecode + ToUnicode CMap, como "Ficha Gestão do Cuidado - Teste OCR.pdf")
 */
async function inflateZlibBytes(compressed: Uint8Array): Promise<Uint8Array | null> {
  // Verifica cabeçalho zlib (ex: 0x78 0x9C, 0x78 0x01, 0x78 0xDA, 0x78 0x5E)
  const hasZlibHeader =
    compressed.length > 2 &&
    compressed[0] === 0x78 &&
    ((compressed[0] * 256 + compressed[1]) % 31 === 0);

  const formats = hasZlibHeader
    ? (['deflate', 'deflate-raw'] as const)
    : (['deflate-raw', 'deflate'] as const);

  for (const format of formats) {
    try {
      const ds = new DecompressionStream(format);
      const writer = ds.writable.getWriter();
      const reader = ds.readable.getReader();

      const writePromise = (async () => {
        await writer.write(compressed as unknown as BufferSource);
        await writer.close();
      })();

      const readPromise = (async () => {
        const chunks: Uint8Array[] = [];
        let total = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            total += value.length;
          }
        }
        const out = new Uint8Array(total);
        let offset = 0;
        for (const c of chunks) {
          out.set(c, offset);
          offset += c.length;
        }
        return out;
      })();

      const [, result] = await Promise.all([writePromise, readPromise]);
      return result;
    } catch {
      // Tenta próximo formato
    }
  }
  return null;
}

export async function extractTextFromPdfBytes(buffer: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const latin1Decoder = new TextDecoder('latin1');
  const rawPdf = latin1Decoder.decode(bytes);

  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const decompressedStreams: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(rawPdf)) !== null) {
    const rawContent = match[1];
    const slice = new Uint8Array(rawContent.length);
    for (let i = 0; i < rawContent.length; i++) {
      slice[i] = rawContent.charCodeAt(i) & 0xff;
    }
    const inflated = await inflateZlibBytes(slice);
    if (inflated) {
      decompressedStreams.push(latin1Decoder.decode(inflated));
    }
  }

  // 1. Constrói tabela ToUnicode CMap a partir dos streams de fontes do PDF
  const glyphMap = new Map<number, string>();
  for (const s of decompressedStreams) {
    if (!s.includes('beginbfchar') && !s.includes('beginbfrange')) continue;

    const bfcharBlocks = [...s.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)];
    for (const block of bfcharBlocks) {
      const pairs = [...block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)];
      for (const p of pairs) {
        const cid = parseInt(p[1], 16);
        const hex = p[2];
        let str = '';
        for (let i = 0; i < hex.length; i += 4) {
          str += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
        }
        glyphMap.set(cid, str);
      }
    }

    const bfrangeBlocks = [...s.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)];
    for (const block of bfrangeBlocks) {
      const ranges = [
        ...block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g),
      ];
      for (const r of ranges) {
        const start = parseInt(r[1], 16);
        const end = parseInt(r[2], 16);
        let target = parseInt(r[3], 16);
        for (let c = start; c <= end; c++) {
          glyphMap.set(c, String.fromCharCode(target++));
        }
      }
    }
  }

  const decodeHexToken = (hex: string): string => {
    let out = '';
    const step = hex.length % 4 === 0 ? 4 : 2;
    for (let i = 0; i < hex.length; i += step) {
      const cid = parseInt(hex.slice(i, i + step), 16);
      out += glyphMap.get(cid) ?? String.fromCharCode(cid);
    }
    return out;
  };

  const decodeLiteralToken = (lit: string): string => {
    return lit
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\');
  };

  // 2. Extrai blocos BT ... ET de texto
  const lines: string[] = [];
  for (const s of decompressedStreams) {
    if (!s.includes('BT') || !s.includes('ET')) continue;
    const btBlocks = [...s.matchAll(/BT([\s\S]*?)ET/g)];
    for (const b of btBlocks) {
      const block = b[1];
      let line = '';
      const tokenRegex = /<([0-9A-Fa-f]+)>|\(([^)\\]*(?:\\.[^)\\]*)*)\)/g;
      let tok: RegExpExecArray | null;
      while ((tok = tokenRegex.exec(block)) !== null) {
        if (tok[1] !== undefined) {
          line += decodeHexToken(tok[1]);
        } else if (tok[2] !== undefined) {
          line += decodeLiteralToken(tok[2]);
        }
      }
      if (line.trim()) {
        lines.push(line.trim());
      }
    }
  }

  return lines.join('\n');
}
