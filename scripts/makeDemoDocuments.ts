/**
 * Gera os 14 documentos de exemplo (TODOS FICTÍCIOS) em public/demo/, no layout dos relatórios
 * do prontuário SOC/S+ e nos canais reais da equipe (foto, PDF escaneado, e-mail, WhatsApp, Word,
 * XML, JSON, CSV, HTML, texto colado). Base: scripts/make-demo.mjs do teagar/secilita_planilhas,
 * adaptado às 6 empresas e aos 4 médicos de referência do SESI Saúde Acolhe.
 *
 * Pessoas: src/demo/people.json (fonte única, também lida pelo motor de importação).
 * Uso: npm run demo   (precisa de pdftoppm e ImageMagick para a foto, o print e o PDF escaneado)
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib';
import { strToU8, zipSync } from 'fflate';
import { COMPANY_METADATA } from '../src/mockDatabase';

interface Person {
  matricula: string;
  nome: string;
  nascimento: string;
  idade: number;
  entradaAps: string;
  empresa: string;
  medico: string;
  cargo: string;
  setor: string;
}

const OUT = 'public/demo';
mkdirSync(OUT, { recursive: true });
const people: Person[] = JSON.parse(readFileSync('src/demo/people.json', 'utf8'));
const P: Record<string, Person> = Object.fromEntries(people.map((p) => [p.matricula, p]));
for (const p of people) {
  if (!COMPANY_METADATA[p.empresa]) throw new Error(`${p.nome}: empresa fora do SESI (${p.empresa})`);
}
const TMP = mkdtempSync(join(tmpdir(), 'healthx-demo-'));
const FOOT = 'DOCUMENTO FICTÍCIO PARA DEMONSTRAÇÃO · SESI SAÚDE ACOLHE · NÃO CONTÉM DADOS REAIS';
const EQUIPE = 'Equipe SESI Saúde Acolhe';
const ENFERMAGEM = 'Enfermagem SESI Saúde Acolhe';
/** Unidade industrial da empresa, sem o separador "•" (fora do WinAnsi do Helvetica). */
const unitOf = (p: Person) => COMPANY_METADATA[p.empresa].unit.replace(/\s*•\s*/g, ' - ');

/* ---------------- PDF no layout dos relatórios do prontuário SOC/S+ ---------------- */

type Row = [label: string, value?: string];
interface Section {
  heading?: string;
  rows?: Row[];
  paras?: string[];
}

function wrap(s: string, n: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of s.split(/\s+/)) {
    if (`${cur} ${w}`.trim().length > n) {
      out.push(cur.trim());
      cur = w;
    } else cur += ` ${w}`;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

async function socPdf(title: string, p: Person, sections: Section[], ficha = ''): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${title} (fictício)`);
  pdf.setProducer('HealthX SESI Saúde Acolhe demo');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage = pdf.addPage([595, 842]);
  let y = 800;
  const text = (s: string, x: number, size = 10, f = font) =>
    page.drawText(s, { x, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
  text(title, (595 - bold.widthOfTextAtSize(title, 16)) / 2, 16, bold);
  y -= 30;
  const idRows: [string, string, string, string][] = [
    ['Funcionário (Código / Nome)', `${p.matricula} - ${p.nome}`, 'RG', ''],
    ['Empresa', p.empresa, 'CNPJ', '00.000.000/0001-00'],
    ['Unidade', unitOf(p), 'Setor', p.setor],
    ['Cargo', p.cargo, 'Idade', String(p.idade)],
    ['Nascimento', p.nascimento, 'Admissão', p.entradaAps],
    ['Tipo de Exame', 'Monitoramento', 'Data Ficha', ficha],
  ];
  for (const [l1, v1, l2, v2] of idRows) {
    text(l1, 40, 9, bold);
    text(v1, 190, 9);
    text(l2, 400, 9, bold);
    text(v2, 470, 9);
    y -= 16;
  }
  page.drawLine({ start: { x: 40, y: y + 6 }, end: { x: 555, y: y + 6 }, thickness: 0.6, color: rgb(0.6, 0.6, 0.6) });
  y -= 14;
  for (const sec of sections) {
    if (y < 120) {
      page = pdf.addPage([595, 842]);
      y = 800;
    }
    if (sec.heading) {
      text(sec.heading, (595 - bold.widthOfTextAtSize(sec.heading, 11)) / 2, 11, bold);
      y -= 20;
    }
    for (const [label, value] of sec.rows ?? []) {
      if (y < 80) {
        page = pdf.addPage([595, 842]);
        y = 800;
      }
      text(label, 40, 9.5, bold);
      if (value) {
        const lines = wrap(value, 46);
        lines.forEach((ln, i) => page.drawText(ln, { x: 320, y: y - i * 13, size: 9.5, font }));
        y -= 13 * Math.max(1, lines.length) + 5;
      } else y -= 18;
    }
    for (const para of sec.paras ?? []) {
      for (const ln of wrap(para, 100)) {
        text(ln, 40, 9.5);
        y -= 13;
      }
      y -= 6;
    }
    y -= 8;
  }
  for (const pg of pdf.getPages()) {
    pg.drawText(FOOT, { x: 40, y: 30, size: 7.5, font: bold, color: rgb(0.55, 0.2, 0.1) });
  }
  return pdf.save();
}

interface Retorno {
  mon: string;
  medico: string;
  risco: string;
  adesao: string;
  ult: string;
  multi: string;
  prev: string;
  status: string;
  feito: string;
  agend: string;
  msg: string;
  aguard: string;
  obs: string;
  prox: string;
}

const retornoSections = (r: Retorno): Section[] => [
  {
    heading: 'Gestão do Retorno: Monitoramento',
    rows: [
      ['Data do monitoramento:', r.mon],
      ['Médico de referência na APS:', r.medico],
      ['Classificação de risco de saúde:', r.risco],
      ['Verificação de adesão ao plano de cuidado:', r.adesao],
      ['Data da última consulta médica:', r.ult],
      ['Atendimento com equipe multiprofissional', r.multi],
    ],
  },
  {
    heading: 'Dados do Retorno',
    rows: [
      ['Retorno da consulta médica e/ou com a equipe - data prevista', r.prev],
      ['Status plano de cuidado', r.status],
      ['Feito contato', r.feito],
    ],
  },
  {
    heading: 'Desfecho do monitoramento',
    rows: [
      ['Agendamento realizado', r.agend],
      ['Mensagem enviada', r.msg],
      ['Aguardando retorno', r.aguard],
      ['Observações do contato realizado', r.obs],
      ['Data prevista para o próximo monitoramento', r.prox],
    ],
  },
];

const planoSections = (r: { risco: string; adesao: string; prox: string }): Section[] => [
  { heading: 'Classificação de risco de saúde', paras: [r.risco] },
  { heading: 'Verificação de adesão', paras: [r.adesao] },
  {
    heading: 'Recomendações de Saúde',
    rows: [
      ['CUIDADOS COM DOENÇAS CRÔNICAS E/OU AGUDAS:', `Sim. Manter acompanhamento de saúde conforme classificação: ${r.risco}.`],
      ['ENCAMINHAMENTO PARA EXAMES E/OU CONSULTAS COM ESPECIALISTA:', 'Sim. Realizar exames solicitados pelo médico de família: hemograma completo; glicemia em jejum; colesterol total e frações.'],
      ['NUTRIÇÃO (DIETA / PESO)', 'Peso atual de 82 kg, altura de 1,68 m e IMC de 29,05 kg/m². Fazer acompanhamento com nutricionista Sim. Agendar consulta.'],
      ['PRÁTICA DE ATIVIDADE FÍSICA', 'Sim. Caminhada de 30 minutos, 3 vezes por semana, respeitando os limites individuais.'],
      ['PSICOLOGIA', 'Fazer acompanhamento com psicóloga Não.'],
      ['CALENDÁRIO VACINAL', 'Sim. Oriento atualização da vacina contra influenza.'],
      ['OUTRAS RECOMENDAÇÕES', 'Sim. Retornar ao médico de família. Manter ingestão de líquido superior a 2 litros por dia.'],
    ],
  },
  { heading: 'PRÓXIMO CONTATO PARA MONITORAMENTO', paras: [r.prox] },
  { paras: ['Pensando no seu bem-estar, a consulta de retorno é uma parte fundamental do seu cuidado.'] },
];

const cuidadoSections = (r: { inclusao: string; risco: string; multi: string }): Section[] => [
  {
    heading: 'Data de inclusão ao Programa SESI Saúde Acolhe',
    rows: [['Informe a Data de Ativação da vida no Programa', r.inclusao]],
  },
  {
    heading: 'Questionário',
    rows: [
      ['Qual o tipo de atendimento?', 'Presencial'],
      ['Classificação do serviço', 'Coordenação do cuidado'],
      ['Estado civil', 'Casado(a)'],
      ['Escolaridade', 'Médio Completo'],
    ],
  },
  { heading: 'Classificação do paciente quanto ao risco', paras: [r.risco] },
  {
    rows: [
      ['Observações sobre a classificação do risco à saúde:', 'Texto clínico fictício: relata dor lombar ocasional após o turno, sem outras queixas no momento.'],
      ['Atendimento com equipe multiprofissional', r.multi],
      ['1- HIPERTENSÃO ARTERIAL', 'Não'],
      ['2- DIABETES MELLITUS', 'Não'],
      ['Medicamentos em uso', 'Não'],
      ['TABAGISMO', 'Não fumante'],
    ],
  },
];

function rasterize(pdfPath: string, outBase: string, dpi = 110): string {
  execFileSync('pdftoppm', ['-r', String(dpi), '-f', '1', '-l', '1', '-png', pdfPath, outBase]);
  return `${outBase}-1.png`;
}

const b64lines = (data: Uint8Array | string) =>
  Buffer.from(data).toString('base64').replace(/.{76}/g, '$&\r\n');

/* ------------------------------ documentos ------------------------------ */

async function main() {
  // 1. PDF digital — Gestão de Retorno
  {
    const p = P['20269001'];
    const bytes = await socPdf('GESTÃO DE RETORNO', p, retornoSections({
      mon: '20/10/2026', medico: p.medico, risco: 'Compensado', adesao: 'A cada 3 meses', ult: '01/10/2026', multi: 'Não',
      prev: '01/12/2026', status: 'Não recebido', feito: 'Sim', agend: 'Não', msg: 'Sim', aguard: 'Sim',
      obs: 'Aguardo retorno para agendamento pelo WhatsApp', prox: '20/01/2027',
    }));
    writeFileSync(`${OUT}/01_gestao-retorno_joana.pdf`, bytes);
  }

  // 2. Foto de celular — Gestão de Retorno impressa
  {
    const p = P['20269002'];
    const bytes = await socPdf('GESTÃO DE RETORNO', p, retornoSections({
      mon: '05/11/2026', medico: p.medico, risco: 'Saudável com risco', adesao: 'A cada 6 meses', ult: '14/08/2026', multi: 'Sim',
      prev: '14/02/2027', status: 'Aderiu parcialmente', feito: 'Sim', agend: 'Sim', msg: 'Sim', aguard: 'Não',
      obs: 'Retorno agendado na janela protegida do 1º turno', prox: '05/02/2027',
    }));
    const pdfPath = join(TMP, 'rafael.pdf');
    writeFileSync(pdfPath, bytes);
    const png = rasterize(pdfPath, join(TMP, 'rafael'), 150);
    execFileSync('magick', [png, '-crop', '100%x64%+0+0', '+repage',
      '-gravity', 'South', '-font', 'DejaVu-Sans-Bold', '-pointsize', '20', '-fill', '#B8352A', '-annotate', '+0+12', 'DOCUMENTO FICTÍCIO PARA DEMONSTRAÇÃO',
      '-gravity', 'NorthWest', '-background', '#d9d4ca', '-rotate', '1.6',
      '-fill', '#f4efe6', '-colorize', '6', '-blur', '0x0.6',
      '(', '+clone', '-fill', 'black', '-colorize', '100', '-sparse-color', 'Barycentric', '0,0 #ffffff %w,%h #9a9a9a', ')',
      '-compose', 'multiply', '-composite', '-quality', '78', `${OUT}/02_foto-gestao-retorno_rafael.jpg`]);
  }

  // 3. PDF digital — Plano de Cuidados
  {
    const p = P['20269003'];
    const bytes = await socPdf('PLANO DE CUIDADOS', p,
      planoSections({ risco: 'Risco 2 - Saudável com risco', adesao: 'A cada 6 meses', prox: '03/05/2027' }), '03/11/2026');
    writeFileSync(`${OUT}/03_plano-cuidados_camila.pdf`, bytes);
  }

  // 4. PDF escaneado (só imagem, sem camada de texto) — Gestão do Cuidado
  {
    const p = P['20269004'];
    const bytes = await socPdf('GESTÃO DO CUIDADO', p,
      cuidadoSections({ inclusao: '12/03/2025', risco: '2- saudável com risco', multi: 'Não' }), '28/10/2026');
    const pdfPath = join(TMP, 'marcos.pdf');
    writeFileSync(pdfPath, bytes);
    const png = rasterize(pdfPath, join(TMP, 'marcos'), 150);
    const jpg = join(TMP, 'marcos.jpg');
    execFileSync('magick', [png, '-colorspace', 'Gray', '-background', 'white', '-rotate', '-0.7', '-blur', '0x0.4', '-quality', '80', jpg]);
    const scan = await PDFDocument.create();
    scan.setTitle('Digitalização (fictício)');
    const img = await scan.embedJpg(readFileSync(jpg));
    scan.addPage([595, 842]).drawImage(img, { x: 0, y: 0, width: 595, height: 842 });
    writeFileSync(`${OUT}/04_gestao-cuidado_marcos_escaneado.pdf`, await scan.save());
  }

  // 5. E-mail .eml com PDF anexo
  {
    const p = P['20269005'];
    const att = await socPdf('PLANO DE CUIDADOS', p,
      planoSections({ risco: 'Risco 2 - Saudável com risco', adesao: 'A cada 6 meses', prox: '10/05/2027' }), '10/11/2026');
    const body = [
      'Boa tarde!',
      '',
      `A trabalhadora Luciana Peixoto Dias (matrícula 20269005), da ${p.empresa}, compareceu à consulta com a nutricionista em 10/11/2026.`,
      'Ela contou que está seguindo parte das metas: reduziu os refrigerantes, mas ainda não começou a caminhada.',
      'Segue em anexo o plano de cuidados atualizado.',
      '',
      `${ENFERMAGEM} (equipe fictícia)`,
    ].join('\r\n');
    const eml = [
      `From: ${ENFERMAGEM} <enfermagem.aps@example.org>`,
      'To: Coordenacao do Cuidado <coordenacao@example.org>',
      'Subject: =?UTF-8?Q?Retorno_nutri=C3=A7=C3=A3o_-_Luciana_Peixoto?=',
      'Date: Thu, 12 Nov 2026 16:20:00 -0300',
      'MIME-Version: 1.0',
      'Content-Type: multipart/mixed; boundary="HEALTHX-DEMO"',
      '',
      '--HEALTHX-DEMO',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      b64lines(body),
      '--HEALTHX-DEMO',
      'Content-Type: application/pdf; name="plano-cuidados_luciana.pdf"',
      'Content-Disposition: attachment; filename="plano-cuidados_luciana.pdf"',
      'Content-Transfer-Encoding: base64',
      '',
      b64lines(att),
      '--HEALTHX-DEMO--',
      '',
    ].join('\r\n');
    writeFileSync(`${OUT}/05_email-enfermagem_luciana.eml`, eml);
  }

  // 6. Conversa exportada do WhatsApp (iPhone, .txt) — convite com Passe de Cuidado
  writeFileSync(`${OUT}/06_whatsapp_paulo.txt`, [
    `[11/11/2026, 09:02:13] ${EQUIPE}: Olá, Paulo! Seu retorno com o médico de família está previsto para este mês. Podemos marcar na janela protegida do seu turno?`,
    '[11/11/2026, 12:40:51] Paulo Vieira: Boa tarde. Pode marcar sim, consigo ir dia 19/11 de manhã antes do turno',
    `[11/11/2026, 12:41:30] ${EQUIPE}: Combinado, 19/11 às 07h30. Seu Passe de Cuidado vale como autorização para o líder. Até lá!`,
    '[11/11/2026, 12:42:02] Paulo Vieira: Confirmado, obrigado',
    '',
  ].join('\n'));

  // 7. Conversa exportada do WhatsApp (Android, .zip)
  {
    const chat = [
      `13/11/2026 18:05 - ${ENFERMAGEM}: Oi Adriana, tudo bem? Sua consulta de retorno está marcada para 17/11 às 10h.`,
      '13/11/2026 19:22 - Adriana Melo: Oi! Nesse dia não consigo, vou estar no turno.',
      'Dá pra remarcar pra 24/11 de manhã?',
      `13/11/2026 19:30 - ${ENFERMAGEM}: Vou verificar a agenda e te aviso.`,
      '',
    ].join('\n');
    writeFileSync(`${OUT}/07_whatsapp-exportado_adriana.zip`,
      zipSync({ 'Conversa do WhatsApp com Adriana Melo.txt': strToU8(chat) }));
  }

  // 8. Word .docx — declaração de comparecimento
  {
    const paras = [
      'DECLARAÇÃO DE COMPARECIMENTO',
      'Paciente: Gilberto Nunes Rocha',
      'Matrícula: 20269008',
      `Empresa: ${P['20269008'].empresa}`,
      'Especialidade: Psicologia',
      'Data: 06/11/2026',
      'Situação: Compareceu',
      'Declaramos para os devidos fins que o trabalhador acima esteve presente no atendimento do SESI Saúde Acolhe.',
      FOOT,
    ];
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paras.map((t) => `<w:p><w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`;
    writeFileSync(`${OUT}/08_declaracao-comparecimento_gilberto.docx`, zipSync({
      '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
      '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
      'word/document.xml': strToU8(doc),
    }));
  }

  // 9. XML — exportação de agenda (formato hipotético)
  writeFileSync(`${OUT}/09_agenda-exportada.xml`, `<?xml version="1.0" encoding="UTF-8"?>
<!-- ${FOOT} -->
<agenda exportadoEm="2026-11-14T18:00:00-03:00" programa="SESI Saúde Acolhe - Bahia">
  <atendimento>
    <matricula>20269009</matricula>
    <nome>Sandra Reis Mota</nome>
    <empresa>${P['20269009'].empresa}</empresa>
    <especialidade>Clínico geral</especialidade>
    <data>2026-11-09</data>
    <situacao>Compareceu</situacao>
    <classificacaoRisco>2</classificacaoRisco>
    <previsaoRetorno>2027-05-09</previsaoRetorno>
  </atendimento>
  <atendimento>
    <matricula>20269010</matricula>
    <nome>Eduardo Lima Fontes</nome>
    <empresa>${P['20269010'].empresa}</empresa>
    <especialidade>Nutrição</especialidade>
    <data>2026-11-10</data>
    <situacao>Faltou</situacao>
  </atendimento>
  <atendimento>
    <matricula>20269011</matricula>
    <nome>Beatriz Soares Cunha</nome>
    <empresa>${P['20269011'].empresa}</empresa>
    <especialidade>Psicologia</especialidade>
    <data>2026-11-21</data>
    <situacao>Agendado</situacao>
  </atendimento>
</agenda>
`);

  // 10. JSON — respostas do chatbot de WhatsApp (formato hipotético)
  writeFileSync(`${OUT}/10_chatbot-respostas.json`, JSON.stringify({
    aviso: FOOT,
    origem: 'chatbot-whatsapp-sesi-saude-acolhe',
    exportadoEm: '2026-11-14T20:00:00-03:00',
    respostas: [
      { matricula: '20269012', nome: 'Vagner Alves Brito', canal: 'Chatbot WhatsApp', recebidoEm: '2026-11-12T08:15:00-03:00', mensagem: 'Confirmo a consulta de quinta, 19/11' },
      { matricula: '20269013', nome: 'Priscila Dantas Sales', canal: 'Chatbot WhatsApp', recebidoEm: '2026-11-13T21:40:00-03:00', mensagem: 'Preciso remarcar, não consigo ir dia 18/11. Pode ser 25/11?' },
      { matricula: '20269014', nome: 'Renato Castro Leal', canal: 'Chatbot WhatsApp', recebidoEm: '2026-11-14T10:00:00-03:00', status: 'Sem resposta após 3 tentativas' },
    ],
  }, null, 2));

  // 11. CSV — relatório de teleatendimento (separador ;)
  writeFileSync(`${OUT}/11_teleatendimento.csv`, [
    'matricula;nome;data_atendimento;tipo_atendimento;resultado;classificacao_risco;data_prevista_retorno',
    '20269015;Érica Menezes Porto;2026-11-11;Teleconsulta médica;Realizado;Compensado;2027-02-11',
    '20269016;Cláudio Barros Maia;12/11/2026;Teleconsulta nutrição;Realizado;Risco 2;',
    '',
  ].join('\n'));

  // 12. HTML — e-mail salvo pelo navegador
  writeFileSync(`${OUT}/12_email-salvo_natalia.html`, `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Re: Seu plano de cuidados</title></head><body>
<table><tr><td>De:</td><td>Natália Freire Azevedo &lt;natalia@example.org&gt;</td></tr>
<tr><td>Para:</td><td>${ENFERMAGEM} &lt;enfermagem.aps@example.org&gt;</td></tr>
<tr><td>Enviado em:</td><td>13/11/2026 19:05</td></tr>
<tr><td>Assunto:</td><td>Re: Seu plano de cuidados</td></tr></table>
<p>Olá! Aqui é a Natália Freire Azevedo, da ${P['20269017'].empresa}.</p>
<p>Estou seguindo o plano mais ou menos: consegui caminhar 3 vezes por semana, mas a alimentação ainda não mudou. Posso conversar com a enfermeira na semana que vem?</p>
<p><small>${FOOT}</small></p></body></html>`);

  // 13. PNG — print de uma mensagem recebida
  execFileSync('magick', ['-size', '900x360', 'xc:#ECE5DD',
    '-fill', '#FFFFFF', '-draw', 'roundrectangle 40,60 860,300 14,14',
    '-font', 'DejaVu-Sans', '-fill', '#1F4B8C', '-pointsize', '26', '-annotate', '+70+110', 'Fernanda Lima Queiroz',
    '-fill', '#1C1B1A', '-pointsize', '28', '-annotate', '+70+165', 'Bom dia! Confirmo minha consulta do dia',
    '-annotate', '+70+210', '25/11 às 9h. Obrigada!',
    '-fill', '#585C63', '-pointsize', '22', '-annotate', '+600+275', '13/11/2026 07:48',
    '-fill', '#8A8E94', '-pointsize', '16', '-annotate', '+40+340', 'Imagem fictícia para demonstração',
    `${OUT}/13_print-conversa_fernanda.png`]);

  // 14. Texto para colar (anotação de ligação)
  writeFileSync(`${OUT}/14_texto-colado_jorge.txt`,
    'Ligação 14/11/2026: Jorge Matos Aragão não atendeu, caiu na caixa postal. Tentar de novo na segunda pela manhã.\n');

  rmSync(TMP, { recursive: true, force: true });
  console.log('14 documentos de exemplo (fictícios, empresas SESI) gerados em', OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
