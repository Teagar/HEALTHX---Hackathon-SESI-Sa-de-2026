import {
  Employee,
  ExamPrescriptionEntry,
  MonthlyContacts2026,
  ReturnRule,
  RiskLevel,
  ShiftWindowConfig,
} from './types';

export const INITIAL_SHIFT_WINDOWS: ShiftWindowConfig[] = [
  {
    companyId: 'comp-textil',
    companyName: 'Têxtil Horizonte Ltda',
    companyUnit: 'Polo Industrial Camaçari • BA',
    totalActiveLives: 10,
    shift1Window: 'Terças e Quintas • 09h00 às 10h30 (1º Turno 06h–14h)',
    shift2Window: 'Terças e Quintas • 15h30 às 17h00 (2º Turno 14h–22h)',
    ddsDay: 'Segundas-feiras • 06h00 (DDS Operacional 2 min)',
    autoScheduleDefault: true,
    zeroPayrollDeductionGuaranteed: true,
  },
  {
    companyId: 'comp-plasticos',
    companyName: 'Plásticos Recôncavo Ltda',
    companyUnit: 'CIA Sul • Simões Filho • BA',
    totalActiveLives: 14,
    shift1Window: 'Segundas e Quartas • 08h30 às 10h00 (1º Turno 06h–14h)',
    shift2Window: 'Segundas e Quartas • 16h00 às 17h30 (2º Turno 14h–22h)',
    ddsDay: 'Terças-feiras • 06h00 (DDS Operacional 2 min)',
    autoScheduleDefault: true,
    zeroPayrollDeductionGuaranteed: true,
  },
  {
    companyId: 'comp-ceramica',
    companyName: 'Cerâmica Pedra Azul Ltda',
    companyUnit: 'Distrito Industrial • Feira de Santana • BA',
    totalActiveLives: 9,
    shift1Window: 'Quartas e Sextas • 09h00 às 10h30 (1º Turno 06h–14h)',
    shift2Window: 'Quartas e Sextas • 15h00 às 16h30 (2º Turno 14h–22h)',
    ddsDay: 'Quartas-feiras • 06h00 (DDS Operacional 2 min)',
    autoScheduleDefault: true,
    zeroPayrollDeductionGuaranteed: true,
  },
  {
    companyId: 'comp-metalurgica',
    companyName: 'Metalúrgica Atlântida Ltda',
    companyUnit: 'Centro Industrial de Aratu • Candeias • BA',
    totalActiveLives: 11,
    shift1Window: 'Terças e Sextas • 08h00 às 09h30 (1º Turno 06h–14h)',
    shift2Window: 'Terças e Sextas • 15h30 às 17h00 (2º Turno 14h–22h)',
    ddsDay: 'Segundas-feiras • 06h00 (DDS Operacional 2 min)',
    autoScheduleDefault: true,
    zeroPayrollDeductionGuaranteed: true,
  },
  {
    companyId: 'comp-alimentos',
    companyName: 'Alimentos Vale Verde Ltda',
    companyUnit: 'Distrito Industrial • Vitória da Conquista • BA',
    totalActiveLives: 11,
    shift1Window: 'Segundas e Quintas • 09h30 às 11h00 (1º Turno 06h–14h)',
    shift2Window: 'Segundas e Quintas • 16h00 às 17h30 (2º Turno 14h–22h)',
    ddsDay: 'Quintas-feiras • 06h00 (DDS Operacional 2 min)',
    autoScheduleDefault: true,
    zeroPayrollDeductionGuaranteed: true,
  },
  {
    companyId: 'comp-quimica',
    companyName: 'Química Litoral Norte S.A.',
    companyUnit: 'Complexo Petroquímico • Camaçari • BA',
    totalActiveLives: 5,
    shift1Window: 'Quartas e Quintas • 08h30 às 10h00 (1º Turno 06h–14h)',
    shift2Window: 'Quartas e Quintas • 15h00 às 16h30 (2º Turno 14h–22h)',
    ddsDay: 'Sextas-feiras • 06h00 (DDS Operacional 2 min)',
    autoScheduleDefault: true,
    zeroPayrollDeductionGuaranteed: true,
  },
];

export const COMPANY_METADATA: Record<
  string,
  { id: string; unit: string; shift1Slot: string; shift2Slot: string; sectors: string[] }
> = {
  'Têxtil Horizonte Ltda': {
    id: 'comp-textil',
    unit: 'Polo Industrial Camaçari • BA',
    shift1Slot: 'Terça-feira • 09h00–09h30 (Janela Protegida 1º Turno)',
    shift2Slot: 'Quinta-feira • 15h30–16h00 (Janela Protegida 2º Turno)',
    sectors: ['Tecelagem Industrial', 'Acabamento Têxtil', 'Controle de Qualidade'],
  },
  'Plásticos Recôncavo Ltda': {
    id: 'comp-plasticos',
    unit: 'CIA Sul • Simões Filho • BA',
    shift1Slot: 'Segunda-feira • 08h30–09h00 (Janela Protegida 1º Turno)',
    shift2Slot: 'Quarta-feira • 16h00–16h30 (Janela Protegida 2º Turno)',
    sectors: ['Extrusão e Sopro', 'Injeção Termoplástica', 'Logística Interna'],
  },
  'Cerâmica Pedra Azul Ltda': {
    id: 'comp-ceramica',
    unit: 'Distrito Industrial • Feira de Santana • BA',
    shift1Slot: 'Quarta-feira • 09h00–09h30 (Janela Protegida 1º Turno)',
    shift2Slot: 'Sexta-feira • 15h00–15h30 (Janela Protegida 2º Turno)',
    sectors: ['Fornos Contínuos', 'Esmaltação', 'Expedição e Paletização'],
  },
  'Metalúrgica Atlântida Ltda': {
    id: 'comp-metalurgica',
    unit: 'Centro Industrial de Aratu • Candeias • BA',
    shift1Slot: 'Terça-feira • 08h00–08h30 (Janela Protegida 1º Turno)',
    shift2Slot: 'Sexta-feira • 15h30–16h00 (Janela Protegida 2º Turno)',
    sectors: ['Caldeiraria e Solda', 'Usinagem CNC', 'Manutenção Mecânica'],
  },
  'Alimentos Vale Verde Ltda': {
    id: 'comp-alimentos',
    unit: 'Distrito Industrial • Vitória da Conquista • BA',
    shift1Slot: 'Segunda-feira • 09h30–10h00 (Janela Protegida 1º Turno)',
    shift2Slot: 'Quinta-feira • 16h00–16h30 (Janela Protegida 2º Turno)',
    sectors: ['Envase Automatizado', 'Processamento Térmico', 'Câmara Fria'],
  },
  'Química Litoral Norte S.A.': {
    id: 'comp-quimica',
    unit: 'Complexo Petroquímico • Camaçari • BA',
    shift1Slot: 'Quarta-feira • 08h30–09h00 (Janela Protegida 1º Turno)',
    shift2Slot: 'Quinta-feira • 15h00–15h30 (Janela Protegida 2º Turno)',
    sectors: ['Operação de Processos', 'Laboratório Analítico', 'Utilidades Industriais'],
  },
};

/**
 * Censo integral com as 100 linhas exatas da planilha fornecida pelo Hackathon:
 * `GESTÃO DO CUIDADO - APS SESI (Coordenação do cuidado)`
 */
const RAW_SESI_100_ROWS = [
  '20261001;LUCIANA NASCIMENTO FREITAS;INATIVO;10/1/1994;32;297.875.347-22;FEMININO;1/20/2023;(71) 90000-0001;Têxtil Horizonte Ltda;Dr. Felipe Andrade',
  '20261038;GUSTAVO MOREIRA CONCEIÇÃO;INATIVO;2/13/1966;60;571.784.726-36;MASCULINO;3/11/2023;(71) 90000-0002;Cerâmica Pedra Azul Ltda;Dr. Felipe Andrade',
  '20261075;JULIANA BISPO ALMEIDA;ATIVO;4/19/1966;60;136.270.107-70;FEMININO;10/18/2025;(71) 90000-0003;Plásticos Recôncavo Ltda;Dra. Helena Matos',
  '20261112;SÉRGIO MENDES COSTA;ATIVO;9/13/1995;31;845.205.997-43;MASCULINO;9/6/2023;(71) 90000-0004;Cerâmica Pedra Azul Ltda;Dr. Ricardo Fontes',
  '20261149;LARISSA RODRIGUES ROCHA;INATIVO;6/11/1980;46;841.622.948-20;FEMININO;9/27/2023;(71) 90000-0005;Têxtil Horizonte Ltda;Dr. Felipe Andrade',
  '20261186;MARCOS DIAS MENDES;ATIVO;12/29/1997;28;161.055.008-17;MASCULINO;2/10/2025;(71) 90000-0006;Têxtil Horizonte Ltda;Dra. Beatriz Campos',
  '20261223;BRUNA NASCIMENTO BARBOSA;ATIVO;3/11/1992;34;799.229.836-66;FEMININO;9/7/2023;(71) 90000-0007;Plásticos Recôncavo Ltda;Dra. Beatriz Campos',
  '20261260;LEANDRO TEIXEIRA RODRIGUES;INATIVO;5/19/1976;50;603.208.073-14;MASCULINO;5/24/2023;(71) 90000-0008;Têxtil Horizonte Ltda;Dra. Helena Matos',
  '20261297;PATRÍCIA BISPO DIAS;INATIVO;1/2/1997;29;226.468.616-31;FEMININO;11/25/2025;(71) 90000-0009;Alimentos Vale Verde Ltda;Dr. Ricardo Fontes',
  '20261334;EDSON PEREIRA ALMEIDA;ATIVO;1/3/1986;40;472.587.718-34;MASCULINO;10/17/2025;(71) 90000-0010;Plásticos Recôncavo Ltda;Dra. Beatriz Campos',
  '20261371;FERNANDA NUNES COSTA;ATIVO;6/9/1996;30;756.820.525-97;FEMININO;1/12/2023;(71) 90000-0011;Plásticos Recôncavo Ltda;Dr. Ricardo Fontes',
  '20261408;PAULO TEIXEIRA JESUS;ATIVO;3/27/1994;32;394.948.214-93;MASCULINO;2/13/2026;(71) 90000-0012;Metalúrgica Atlântida Ltda;Dr. Felipe Andrade',
  '20261445;CAMILA SOUZA CONCEIÇÃO;INATIVO;2/8/2004;22;185.491.452-07;FEMININO;12/31/2024;(71) 90000-0013;Alimentos Vale Verde Ltda;Dra. Beatriz Campos',
  '20261482;CARLOS SILVA GOMES;INATIVO;12/13/1967;58;001.304.118-60;MASCULINO;6/11/2024;(71) 90000-0014;Plásticos Recôncavo Ltda;Dra. Beatriz Campos',
  '20261519;JÉSSICA REIS BARBOSA;ATIVO;7/30/1979;47;659.397.615-79;FEMININO;7/6/2026;(71) 90000-0015;Plásticos Recôncavo Ltda;Dra. Beatriz Campos',
  '20261556;DIEGO NASCIMENTO FREITAS;INATIVO;11/1/1990;36;045.414.659-16;MASCULINO;4/30/2023;(71) 90000-0016;Metalúrgica Atlântida Ltda;Dra. Beatriz Campos',
  '20261593;LUCIANA MOREIRA SANTOS;ATIVO;6/12/1974;52;911.028.594-70;FEMININO;8/20/2023;(71) 90000-0017;Metalúrgica Atlântida Ltda;Dr. Felipe Andrade',
  '20261630;ROBERTO LIMA ARAÚJO;ATIVO;3/9/1988;38;363.228.088-79;MASCULINO;2/26/2025;(71) 90000-0018;Têxtil Horizonte Ltda;Dra. Beatriz Campos',
  '20261667;PATRÍCIA RODRIGUES SILVA;ATIVO;1/27/2006;20;764.529.128-20;FEMININO;7/21/2024;(71) 90000-0019;Metalúrgica Atlântida Ltda;Dra. Beatriz Campos',
  '20261704;ANDERSON BISPO DIAS;ATIVO;12/20/1972;53;037.038.265-19;MASCULINO;10/13/2024;(71) 90000-0020;Química Litoral Norte S.A.;Dra. Beatriz Campos',
  '20261741;JÉSSICA NUNES COSTA;INATIVO;1/3/1990;36;787.943.262-17;FEMININO;1/6/2025;(71) 90000-0021;Têxtil Horizonte Ltda;Dra. Helena Matos',
  '20261778;EDSON FREITAS FREITAS;ATIVO;5/7/1983;43;214.584.210-25;MASCULINO;4/17/2025;(71) 90000-0022;Plásticos Recôncavo Ltda;Dr. Ricardo Fontes',
  '20261815;ELAINE CARDOSO NASCIMENTO;ATIVO;2/17/1981;45;688.281.126-21;FEMININO;4/3/2023;(71) 90000-0023;Alimentos Vale Verde Ltda;Dra. Beatriz Campos',
  '20261852;FÁBIO SANTOS BATISTA;INATIVO;3/24/1980;46;244.845.263-70;MASCULINO;9/19/2026;(71) 90000-0024;Cerâmica Pedra Azul Ltda;Dra. Helena Matos',
  '20261889;ROSÂNGELA BISPO ROCHA;INATIVO;11/10/1987;39;280.258.220-97;FEMININO;12/30/2024;(71) 90000-0025;Metalúrgica Atlântida Ltda;Dra. Helena Matos',
  '20261926;EDSON OLIVEIRA ARAÚJO;INATIVO;3/29/1993;33;299.321.571-14;MASCULINO;3/19/2024;(71) 90000-0026;Cerâmica Pedra Azul Ltda;Dra. Helena Matos',
  '20261963;CLÁUDIA ALMEIDA TEIXEIRA;ATIVO;4/17/1993;33;577.188.357-41;FEMININO;8/20/2026;(71) 90000-0027;Plásticos Recôncavo Ltda;Dra. Beatriz Campos',
  '20262000;CARLOS OLIVEIRA REIS;ATIVO;11/16/2002;23;432.568.855-37;MASCULINO;10/11/2025;(71) 90000-0028;Cerâmica Pedra Azul Ltda;Dr. Felipe Andrade',
  '20262037;CLÁUDIA CARVALHO PEREIRA;ATIVO;1/1/1998;28;556.963.279-50;FEMININO;8/7/2025;(71) 90000-0029;Cerâmica Pedra Azul Ltda;Dr. Ricardo Fontes',
  '20262074;GUSTAVO ALMEIDA CARVALHO;ATIVO;5/1/1969;57;474.284.352-60;MASCULINO;8/31/2023;(71) 90000-0030;Plásticos Recôncavo Ltda;Dra. Helena Matos',
  '20262111;TATIANE NASCIMENTO CARDOSO;ATIVO;4/9/1986;40;608.565.178-46;FEMININO;7/21/2026;(71) 90000-0031;Plásticos Recôncavo Ltda;Dr. Ricardo Fontes',
  '20262148;GUSTAVO ARAÚJO BISPO;ATIVO;12/29/1991;34;204.842.599-30;MASCULINO;5/4/2023;(71) 90000-0032;Têxtil Horizonte Ltda;Dr. Felipe Andrade',
  '20262185;ALINE CARVALHO SILVA;ATIVO;2/18/2005;21;450.378.495-29;FEMININO;3/27/2024;(71) 90000-0033;Metalúrgica Atlântida Ltda;Dr. Ricardo Fontes',
  '20262222;ALEXANDRE REIS SILVA;INATIVO;7/12/2002;24;373.924.196-02;MASCULINO;11/17/2023;(71) 90000-0034;Cerâmica Pedra Azul Ltda;Dr. Ricardo Fontes',
  '20262259;FERNANDA SILVA ALMEIDA;INATIVO;12/31/1987;38;883.755.559-93;FEMININO;4/3/2023;(71) 90000-0035;Têxtil Horizonte Ltda;Dra. Beatriz Campos',
  '20262296;MÁRCIO PINTO CARVALHO;ATIVO;3/8/1969;57;720.754.735-97;MASCULINO;5/28/2024;(71) 90000-0036;Alimentos Vale Verde Ltda;Dr. Felipe Andrade',
  '20262333;DANIELA COSTA CARDOSO;ATIVO;5/21/2004;22;884.791.889-97;FEMININO;4/22/2025;(71) 90000-0037;Alimentos Vale Verde Ltda;Dr. Felipe Andrade',
  '20262370;ANDERSON CONCEIÇÃO CARVALHO;ATIVO;8/31/1990;36;824.886.193-80;MASCULINO;1/8/2024;(71) 90000-0038;Metalúrgica Atlântida Ltda;Dr. Felipe Andrade',
  '20262407;ADRIANA COSTA GOMES;ATIVO;1/11/1984;42;834.728.556-16;FEMININO;12/15/2025;(71) 90000-0039;Plásticos Recôncavo Ltda;Dr. Ricardo Fontes',
  '20262444;MARCOS TEIXEIRA MOREIRA;INATIVO;3/15/1975;51;290.044.224-08;MASCULINO;11/11/2023;(71) 90000-0040;Plásticos Recôncavo Ltda;Dra. Beatriz Campos',
  '20262481;PATRÍCIA BARBOSA PEREIRA;INATIVO;6/13/1998;28;269.780.438-36;FEMININO;4/21/2023;(71) 90000-0041;Alimentos Vale Verde Ltda;Dra. Helena Matos',
  '20262518;LEANDRO CONCEIÇÃO BATISTA;ATIVO;7/27/1988;38;280.700.159-03;MASCULINO;11/15/2023;(71) 90000-0042;Cerâmica Pedra Azul Ltda;Dra. Beatriz Campos',
  '20262555;JÉSSICA REIS SILVA;INATIVO;6/21/1999;27;166.323.373-19;FEMININO;10/28/2025;(71) 90000-0043;Alimentos Vale Verde Ltda;Dr. Ricardo Fontes',
  '20262592;ALEXANDRE NUNES GOMES;INATIVO;6/21/1974;52;534.789.713-00;MASCULINO;5/17/2025;(71) 90000-0044;Cerâmica Pedra Azul Ltda;Dr. Ricardo Fontes',
  '20262629;FERNANDA REIS OLIVEIRA;INATIVO;12/10/1990;35;123.636.082-77;FEMININO;6/29/2026;(71) 90000-0045;Cerâmica Pedra Azul Ltda;Dra. Beatriz Campos',
  '20262666;FÁBIO BATISTA ARAÚJO;INATIVO;12/13/1988;37;874.572.128-02;MASCULINO;1/21/2023;(71) 90000-0046;Química Litoral Norte S.A.;Dra. Beatriz Campos',
  '20262703;SIMONE RIBEIRO TEIXEIRA;ATIVO;6/3/1978;48;854.177.588-86;FEMININO;4/30/2026;(71) 90000-0047;Plásticos Recôncavo Ltda;Dra. Helena Matos',
  '20262740;RODRIGO NASCIMENTO SANTOS;ATIVO;3/16/2003;23;187.916.979-82;MASCULINO;4/24/2026;(71) 90000-0048;Têxtil Horizonte Ltda;Dra. Helena Matos',
  '20262777;PATRÍCIA PINTO CARVALHO;INATIVO;10/16/2000;26;612.840.019-21;FEMININO;2/25/2023;(71) 90000-0049;Plásticos Recôncavo Ltda;Dra. Helena Matos',
  '20262814;CLEBER NUNES PINTO;ATIVO;10/17/1991;35;735.736.385-72;MASCULINO;11/11/2023;(71) 90000-0050;Têxtil Horizonte Ltda;Dra. Helena Matos',
  '20262851;ALINE RODRIGUES TEIXEIRA;ATIVO;7/20/1998;28;197.967.807-49;FEMININO;6/18/2025;(71) 90000-0051;Química Litoral Norte S.A.;Dr. Felipe Andrade',
  '20262888;CLEBER SANTOS DIAS;INATIVO;12/9/1985;40;385.469.059-34;MASCULINO;10/16/2023;(71) 90000-0052;Plásticos Recôncavo Ltda;Dr. Ricardo Fontes',
  '20262925;PRISCILA SOUZA CARDOSO;ATIVO;4/15/1990;36;182.761.166-08;FEMININO;3/21/2024;(71) 90000-0053;Metalúrgica Atlântida Ltda;Dr. Ricardo Fontes',
  '20262962;RAFAEL SANTOS ALMEIDA;ATIVO;2/4/1973;53;451.420.381-60;MASCULINO;12/14/2023;(71) 90000-0054;Têxtil Horizonte Ltda;Dra. Helena Matos',
  '20262999;VANESSA PINTO JESUS;ATIVO;11/14/1985;41;370.412.143-72;FEMININO;11/22/2025;(71) 90000-0055;Metalúrgica Atlântida Ltda;Dra. Beatriz Campos',
  '20263036;SÉRGIO BISPO SANTOS;ATIVO;9/2/1985;41;828.898.370-86;MASCULINO;6/16/2024;(71) 90000-0056;Plásticos Recôncavo Ltda;Dra. Beatriz Campos',
  '20263073;ADRIANA MOREIRA RIBEIRO;ATIVO;1/1/1986;40;006.681.792-89;FEMININO;6/30/2023;(71) 90000-0057;Química Litoral Norte S.A.;Dr. Ricardo Fontes',
  '20263110;ANTÔNIO MOREIRA COSTA;ATIVO;3/3/1984;42;427.105.129-30;MASCULINO;11/22/2024;(71) 90000-0058;Plásticos Recôncavo Ltda;Dr. Ricardo Fontes',
  '20263147;ALINE NUNES JESUS;INATIVO;2/19/2000;26;781.206.176-16;FEMININO;10/23/2024;(71) 90000-0059;Cerâmica Pedra Azul Ltda;Dra. Beatriz Campos',
  '20263184;THIAGO ARAÚJO OLIVEIRA;ATIVO;7/4/1973;53;431.634.999-71;MASCULINO;4/26/2026;(71) 90000-0060;Química Litoral Norte S.A.;Dra. Beatriz Campos',
  '20263221;SANDRA MOREIRA SILVA;INATIVO;7/15/2005;21;791.372.987-30;FEMININO;12/3/2024;(71) 90000-0061;Metalúrgica Atlântida Ltda;Dra. Helena Matos',
  '20263258;MARCOS SILVA TEIXEIRA;INATIVO;2/27/1983;43;640.794.260-99;MASCULINO;9/30/2024;(71) 90000-0062;Têxtil Horizonte Ltda;Dra. Helena Matos',
  '20263295;FERNANDA RODRIGUES FREITAS;INATIVO;4/1/1992;34;647.744.796-85;FEMININO;6/28/2025;(71) 90000-0063;Têxtil Horizonte Ltda;Dra. Beatriz Campos',
  '20263332;ANDERSON FREITAS PEREIRA;INATIVO;4/4/2002;24;033.463.521-80;MASCULINO;6/9/2026;(71) 90000-0064;Química Litoral Norte S.A.;Dr. Felipe Andrade',
  '20263369;PATRÍCIA TEIXEIRA CARVALHO;ATIVO;11/26/1977;48;398.488.645-57;FEMININO;1/4/2026;(71) 90000-0065;Têxtil Horizonte Ltda;Dr. Ricardo Fontes',
  '20263406;ANTÔNIO DIAS NASCIMENTO;INATIVO;2/19/2005;21;426.927.670-49;MASCULINO;6/27/2026;(71) 90000-0066;Plásticos Recôncavo Ltda;Dra. Beatriz Campos',
  '20263443;SANDRA SANTOS MENDES;ATIVO;1/20/1980;46;846.388.498-00;FEMININO;11/19/2025;(71) 90000-0067;Alimentos Vale Verde Ltda;Dra. Beatriz Campos',
  '20263480;DANILO RIBEIRO DIAS;ATIVO;12/3/1996;29;866.953.896-34;MASCULINO;1/29/2023;(71) 90000-0068;Alimentos Vale Verde Ltda;Dra. Helena Matos',
  '20263517;FERNANDA RODRIGUES COSTA;ATIVO;12/22/1998;27;726.835.081-41;FEMININO;10/2/2025;(71) 90000-0069;Metalúrgica Atlântida Ltda;Dra. Helena Matos',
  '20263554;RAFAEL RIBEIRO SOUZA;ATIVO;4/20/1986;40;816.354.011-88;MASCULINO;5/17/2026;(71) 90000-0070;Alimentos Vale Verde Ltda;Dr. Ricardo Fontes',
  '20263591;SIMONE BISPO GOMES;INATIVO;5/9/2002;24;387.592.115-22;FEMININO;8/12/2026;(71) 90000-0071;Química Litoral Norte S.A.;Dr. Ricardo Fontes',
  '20263628;LEANDRO BARBOSA NUNES;ATIVO;9/25/1965;61;621.076.177-26;MASCULINO;7/24/2023;(71) 90000-0072;Metalúrgica Atlântida Ltda;Dr. Felipe Andrade',
  '20263665;ALINE ARAÚJO BATISTA;INATIVO;5/25/2002;24;261.488.361-24;FEMININO;4/8/2023;(71) 90000-0073;Alimentos Vale Verde Ltda;Dr. Ricardo Fontes',
  '20263702;JOSÉ NUNES LIMA;ATIVO;10/16/1979;47;461.351.619-72;MASCULINO;5/27/2026;(71) 90000-0074;Plásticos Recôncavo Ltda;Dra. Beatriz Campos',
  '20263739;JÉSSICA GOMES NUNES;ATIVO;3/26/1979;47;398.286.408-09;FEMININO;3/31/2026;(71) 90000-0075;Plásticos Recôncavo Ltda;Dra. Beatriz Campos',
  '20263776;THIAGO BARBOSA NASCIMENTO;INATIVO;4/9/1988;38;972.584.441-75;MASCULINO;6/18/2024;(71) 90000-0076;Plásticos Recôncavo Ltda;Dr. Ricardo Fontes',
  '20263813;ANA CRUZ COSTA;ATIVO;11/12/1979;47;515.669.796-94;FEMININO;5/4/2026;(71) 90000-0077;Cerâmica Pedra Azul Ltda;Dra. Helena Matos',
  '20263850;EDSON NUNES FREITAS;INATIVO;7/3/1987;39;596.505.654-10;MASCULINO;7/17/2025;(71) 90000-0078;Têxtil Horizonte Ltda;Dra. Helena Matos',
  '20263887;VANESSA GOMES BARBOSA;INATIVO;11/3/2004;22;488.015.646-04;FEMININO;5/21/2026;(71) 90000-0079;Alimentos Vale Verde Ltda;Dra. Beatriz Campos',
  '20263924;JOSÉ COSTA COSTA;INATIVO;3/25/2004;22;205.987.198-16;MASCULINO;6/10/2023;(71) 90000-0080;Plásticos Recôncavo Ltda;Dra. Helena Matos',
  '20263961;DANIELA LIMA SOUZA;INATIVO;8/9/1967;59;111.196.027-60;FEMININO;5/7/2025;(71) 90000-0081;Plásticos Recôncavo Ltda;Dra. Helena Matos',
  '20263998;DANILO REIS NUNES;ATIVO;12/9/1993;32;873.064.248-68;MASCULINO;4/18/2025;(71) 90000-0082;Química Litoral Norte S.A.;Dr. Felipe Andrade',
  '20264035;ELAINE SANTOS OLIVEIRA;INATIVO;6/24/1986;40;772.041.263-10;FEMININO;3/22/2026;(71) 90000-0083;Alimentos Vale Verde Ltda;Dr. Felipe Andrade',
  '20264072;THIAGO TEIXEIRA LIMA;INATIVO;8/6/1997;29;401.376.156-57;MASCULINO;10/21/2024;(71) 90000-0084;Metalúrgica Atlântida Ltda;Dra. Helena Matos',
  '20264109;VANESSA CARDOSO CONCEIÇÃO;ATIVO;8/28/2002;24;335.414.881-17;FEMININO;7/21/2024;(71) 90000-0085;Plásticos Recôncavo Ltda;Dra. Helena Matos',
  '20264146;VALDIR RODRIGUES BARBOSA;ATIVO;10/10/1981;45;223.841.649-98;MASCULINO;12/14/2024;(71) 90000-0086;Cerâmica Pedra Azul Ltda;Dr. Felipe Andrade',
  '20264183;VANESSA COSTA COSTA;ATIVO;9/21/1972;54;719.294.808-16;FEMININO;1/1/2024;(71) 90000-0087;Alimentos Vale Verde Ltda;Dr. Ricardo Fontes',
  '20264220;CLEBER ALMEIDA ROCHA;ATIVO;4/29/1978;48;247.613.414-85;MASCULINO;3/12/2023;(71) 90000-0088;Cerâmica Pedra Azul Ltda;Dr. Felipe Andrade',
  '20264257;JULIANA ROCHA CARVALHO;ATIVO;1/29/1994;32;014.613.380-44;FEMININO;9/4/2024;(71) 90000-0089;Metalúrgica Atlântida Ltda;Dra. Beatriz Campos',
  '20264294;RAFAEL SILVA BISPO;ATIVO;2/6/1969;57;478.658.930-70;MASCULINO;10/15/2024;(71) 90000-0090;Alimentos Vale Verde Ltda;Dr. Felipe Andrade',
  '20264331;BRUNA ROCHA JESUS;ATIVO;7/30/1987;39;538.488.568-93;FEMININO;5/9/2023;(71) 90000-0091;Metalúrgica Atlântida Ltda;Dra. Helena Matos',
  '20264368;GUSTAVO BARBOSA CRUZ;ATIVO;3/20/1976;50;072.761.514-02;MASCULINO;4/19/2023;(71) 90000-0092;Metalúrgica Atlântida Ltda;Dr. Ricardo Fontes',
  '20264405;RENATA RODRIGUES BISPO;ATIVO;7/3/1997;29;701.087.526-17;FEMININO;7/24/2024;(71) 90000-0093;Cerâmica Pedra Azul Ltda;Dr. Ricardo Fontes',
  '20264442;RAFAEL JESUS TEIXEIRA;INATIVO;4/16/1993;33;646.686.316-73;MASCULINO;1/4/2024;(71) 90000-0094;Têxtil Horizonte Ltda;Dra. Beatriz Campos',
  '20264479;LUCIANA TEIXEIRA MOREIRA;INATIVO;9/10/1973;53;745.358.134-79;FEMININO;5/8/2026;(71) 90000-0095;Química Litoral Norte S.A.;Dra. Helena Matos',
  '20264516;LEANDRO PEREIRA RODRIGUES;ATIVO;6/10/1974;52;967.704.410-08;MASCULINO;4/7/2024;(71) 90000-0096;Alimentos Vale Verde Ltda;Dr. Felipe Andrade',
  '20264553;JÉSSICA JESUS MENDES;ATIVO;10/19/2003;23;865.611.410-85;FEMININO;3/5/2025;(71) 90000-0097;Plásticos Recôncavo Ltda;Dr. Ricardo Fontes',
  '20264590;LUCAS CARVALHO MENDES;ATIVO;12/5/1980;45;494.042.947-58;MASCULINO;10/13/2024;(71) 90000-0098;Alimentos Vale Verde Ltda;Dr. Felipe Andrade',
  '20264627;PRISCILA REIS JESUS;ATIVO;7/19/1973;53;244.602.619-38;FEMININO;6/3/2023;(71) 90000-0099;Alimentos Vale Verde Ltda;Dr. Felipe Andrade',
  '20264664;DANILO MOREIRA JESUS;INATIVO;6/23/2006;20;100.052.007-35;MASCULINO;2/20/2026;(71) 90000-0100;Metalúrgica Atlântida Ltda;Dra. Helena Matos',
];

function formatTitleCase(raw: string): string {
  const lowerWords = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
  return raw
    .toLowerCase()
    .split(' ')
    .map((word, idx) => {
      if (idx > 0 && lowerWords.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function usDateToIso(usDate: string): string {
  const parts = usDate.split('/');
  if (parts.length !== 3) return '1988-01-01';
  const [m, d, y] = parts;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

interface ClinicalTemplate {
  riskLevel: RiskLevel;
  initialRiskLevel: RiskLevel;
  returnRule: ReturnRule;
  lastVisit: string;
  nextVisit: string;
  lastNutritionDate: string;
  lastPsychologyDate: string;
  multiTeamCare: boolean;
  summaryLine: string;
  lastMedicalDemands: string;
  clinicalNotes: string;
  habits: string[];
  conditions: string[];
  medsAndScreening: string[];
  pciRecommendations: string[];
  pciExams: string[];
  goalsAdhesionStatus: string;
  carePlanStatus: string;
  examResultsAndPrescriptions: ExamPrescriptionEntry[];
}

const ACCOMPANIED_TEMPLATES: ClinicalTemplate[] = [
  {
    riskLevel: 4,
    initialRiskLevel: 4,
    returnRule: 'Quinzenal',
    lastVisit: '2026-10-25',
    nextVisit: '2026-11-09',
    lastNutritionDate: '2026-10-20',
    lastPsychologyDate: '2026-10-18',
    multiTeamCare: true,
    summaryLine: 'Risco 4 Crítico • HAS Estágio 2 (PA 168x104 mmHg) + DM2 (HbA1c 9,1%) • Retorno quinzenal',
    lastMedicalDemands: 'Ajuste de anti-hipertensivo, solicitação de MAPA 24h, HbA1c e acompanhamento nutricional.',
    clinicalNotes:
      'Paciente acompanhado pela equipe multiprofissional da APS. Apresentou pico pressórico no início do turno e controle glicêmico fora da meta. Pactuado retorno quinzenal em janela protegida do turno.',
    habits: ['Sedentarismo', 'Consumo elevado de sódio no turno', 'Sono irregular (5h30/noite)'],
    conditions: ['Hipertensão Arterial Sistêmica descompensada (Risco 4)', 'Diabetes Mellitus Tipo 2 (HbA1c 9,1%)'],
    medsAndScreening: ['Losartana 50mg 12/12h', 'Anlodipino 5mg/dia', 'Metformina XR 500mg 2x/dia'],
    pciRecommendations: ['Monitorar PA 3x/semana na enfermagem', 'Reduzir sal de adição e embutidos', 'Comparecer ao retorno quinzenal na janela protegida'],
    pciExams: ['MAPA 24h', 'Hemoglobina Glicada (HbA1c) e Creatinina', 'Fundo de olho'],
    goalsAdhesionStatus: '2026-11-09',
    carePlanStatus: 'ADERIU PARCIALMENTE',
    examResultsAndPrescriptions: [
      {
        id: 'ex-1',
        date: '2026-10-25',
        category: 'Resultado de Exame',
        title: 'Painel Glicêmico e Pressórico',
        details: 'PA 168/104 mmHg • Glicemia jejum 194 mg/dL • HbA1c 9,1%',
        sourceMethod: 'OCR',
        validatedBy: 'Equipe Médica APS',
      },
      {
        id: 'ex-2',
        date: '2026-10-25',
        category: 'Prescrição Médica',
        title: 'Ajuste Terapêutico Anti-hipertensivo',
        details: 'Losartana Potássica 50mg 12/12h + Anlodipino 5mg 1x/dia • Retorno em 15 dias',
        sourceMethod: 'Manual',
        validatedBy: 'Equipe Médica APS',
      },
    ],
  },
  {
    riskLevel: 4,
    initialRiskLevel: 4,
    returnRule: 'Mensal (Critério Médico)',
    lastVisit: '2026-10-14',
    nextVisit: '2026-11-13',
    lastNutritionDate: '',
    lastPsychologyDate: '2026-10-22',
    multiTeamCare: true,
    summaryLine: 'Risco 4 Crítico • Lombalgia aguda recorrente + Sobrecarga emocional de turno • Retorno mensal',
    lastMedicalDemands: 'Fisioterapia/ergonomia ocupacional, psicoterapia breve APS e reavaliação médica em 30 dias.',
    clinicalNotes:
      'Relato de travamento lombar recorrente na linha operacional associado a insônia e ansiedade. Em acompanhamento conjunto com Psicologia e Enfermagem.',
    habits: ['Sobrecarga postural no turno', 'Uso prévio de anti-inflamatórios sem receita', 'Sono fragmentado'],
    conditions: ['Lombalgia mecânica aguda recorrente (Risco 4)', 'Transtorno misto ansioso e depressivo em estabilização'],
    medsAndScreening: ['Ciclobenzaprina 5mg à noite por 7 dias', 'Escitalopram 10mg/dia'],
    pciRecommendations: ['Pausas ergonômicas a cada 2h', 'Sessões quinzenais com Psicologia APS', 'Suspender automedicação com AINEs'],
    pciExams: ['Radiografia de coluna lombossacra', 'Avaliação ergonômica do posto'],
    goalsAdhesionStatus: '2026-11-13',
    carePlanStatus: 'AGUARDANDO RESPOSTA',
    examResultsAndPrescriptions: [
      {
        id: 'ex-3',
        date: '2026-10-14',
        category: 'Prescrição Médica',
        title: 'Conduta Analgésica e Saúde Mental',
        details: 'Escitalopram 10mg 1 cp manhã + Reabilitação postural na APS',
        sourceMethod: 'OCR',
        validatedBy: 'Equipe Médica APS',
      },
    ],
  },
  {
    riskLevel: 3,
    initialRiskLevel: 4,
    returnRule: 'A cada 3 meses',
    lastVisit: '2026-08-20',
    nextVisit: '2026-11-18',
    lastNutritionDate: '2026-09-10',
    lastPsychologyDate: '2026-09-15',
    multiTeamCare: true,
    summaryLine: 'Risco 3 Compensado • Saúde Mental (Ansiedade de turno controlada) + HAS Estágio 1 • Retorno 3 meses',
    lastMedicalDemands: 'Manutenção de plano terapêutico, higiene do sono e retorno trimestral obrigatório.',
    clinicalNotes:
      'Paciente evoluiu de Risco 4 para Risco 3 após adesão ao Plano de Cuidado. Pressão arterial controlada (128x82 mmHg) e remissão das crises de ansiedade.',
    habits: ['Caminhada 3x/semana (30 min)', 'Redução de cafeína após 16h', 'Boa adesão medicamentosa'],
    conditions: ['Hipertensão Arterial controlada (Risco 3)', 'Ansiedade ocupacional estabilizada'],
    medsAndScreening: ['Losartana 50mg 1x/dia', 'Vacinação ocupacional atualizada'],
    pciRecommendations: ['Manter rotina de caminhada', 'Retorno trimestral com Médico de Família', 'Acompanhamento nutricional de manutenção'],
    pciExams: ['Perfil lipídico e glicemia de jejum semestral'],
    goalsAdhesionStatus: '2026-11-18',
    carePlanStatus: 'ADERIU TOTALMENTE',
    examResultsAndPrescriptions: [
      {
        id: 'ex-4',
        date: '2026-08-20',
        category: 'Resultado de Exame',
        title: 'Controle Pressórico e Laboratorial',
        details: 'PA 128/82 mmHg • Colesterol Total 186 mg/dL • Glicemia 92 mg/dL',
        sourceMethod: 'OCR',
        validatedBy: 'Equipe Médica APS',
      },
    ],
  },
  {
    riskLevel: 3,
    initialRiskLevel: 3,
    returnRule: 'A cada 3 meses',
    lastVisit: '2026-09-05',
    nextVisit: '2026-12-04',
    lastNutritionDate: '2026-09-12',
    lastPsychologyDate: '',
    multiTeamCare: true,
    summaryLine: 'Risco 3 Compensado • Pré-diabetes (HbA1c 6,1%) + Dislipidemia em tratamento • Retorno 3 meses',
    lastMedicalDemands: 'Reeducação alimentar para refeitório industrial e controle laboratorial em 90 dias.',
    clinicalNotes:
      'Acompanhamento regular de DCNT compensada. Reduziu 3,2 kg nos últimos 60 dias com plano nutricional adaptado ao restaurante da unidade.',
    habits: ['Alimentação fracionada no turno', 'Cessação de refrigerantes', 'Caminhada leve nos fins de semana'],
    conditions: ['Pré-diabetes em controle (HbA1c 6,1%)', 'Dislipidemia mista compensada'],
    medsAndScreening: ['Sinvastatina 20mg à noite', 'Rastreio cardiovascular em dia'],
    pciRecommendations: ['Redução de carboidratos simples no almoço', 'Repetir HbA1c e lipidograma no retorno de 90 dias'],
    pciExams: ['Hemoglobina Glicada (HbA1c)', 'Colesterol total e frações + Triglicerídeos'],
    goalsAdhesionStatus: '2026-12-04',
    carePlanStatus: 'ADERIU PARCIALMENTE',
    examResultsAndPrescriptions: [],
  },
  {
    riskLevel: 2,
    initialRiskLevel: 3,
    returnRule: 'A cada 6 meses',
    lastVisit: '2026-06-15',
    nextVisit: '2026-12-12',
    lastNutritionDate: '2026-06-22',
    lastPsychologyDate: '',
    multiTeamCare: true,
    summaryLine: 'Risco 2 • Sobrepeso (IMC 27,8) e dor miofascial leve em ombros • Retorno semestral',
    lastMedicalDemands: 'Orientação nutricional preventiva, ginástica laboral e retorno em 180 dias.',
    clinicalNotes:
      'Trabalhador saudável com fator de risco modificável (sobrepeso e tensão escapular leve). Sem comorbidades crônicas descompensadas.',
    habits: ['Participa do alongamento no início do turno', 'Ingestão hídrica 2L/dia'],
    conditions: ['Sobrepeso grau I (IMC 27,8 kg/m²)', 'Tensão miofascial leve em cintura escapular'],
    medsAndScreening: ['Sem medicação de uso contínuo', 'Cartão vacinal completo (Dupla Adulto e Hepatite B)'],
    pciRecommendations: ['Manter meta de hidratação no posto', 'Check-up preventivo semestral na APS'],
    pciExams: ['Glicemia de jejum e Lipidograma anual'],
    goalsAdhesionStatus: '2026-12-12',
    carePlanStatus: 'ADERIU TOTALMENTE',
    examResultsAndPrescriptions: [],
  },
  {
    riskLevel: 1,
    initialRiskLevel: 1,
    returnRule: 'A cada 6 meses',
    lastVisit: '2026-07-10',
    nextVisit: '2027-01-06',
    lastNutritionDate: '',
    lastPsychologyDate: '',
    multiTeamCare: false,
    summaryLine: 'Risco 1 Hígido • Exames preventivos normais (PA 118x76 mmHg) • Retorno semestral',
    lastMedicalDemands: 'Manutenção de hábitos saudáveis e rastreio preventivo semestral.',
    clinicalNotes:
      'Colaborador hígido, assintomático, parâmetros clínicos e laboratoriais dentro da normalidade na última revisão periódica APS.',
    habits: ['Pratica atividade física 3x/semana', 'Não tabagista', 'Sono reparador (7h/noite)'],
    conditions: ['Hígido / Sem fatores de risco ativos (Risco 1)'],
    medsAndScreening: ['Rastreio preventivo anual realizado', 'Imunização atualizada'],
    pciRecommendations: ['Manter atividade física regular', 'Retorno preventivo em 6 meses'],
    pciExams: ['Exames periódicos anuais de rotina APS'],
    goalsAdhesionStatus: '2027-01-06',
    carePlanStatus: 'ADERIU TOTALMENTE',
    examResultsAndPrescriptions: [],
  },
];

function buildEmployeesFrom100Rows(): Employee[] {
  let activeIndex = 0;

  return RAW_SESI_100_ROWS.map((line, idx) => {
    const cols = line.split(';').map((c) => c.trim());
    const matricula = cols[0];
    const name = formatTitleCase(cols[1]);
    const status = (cols[2] === 'INATIVO' ? 'INATIVO' : 'ATIVO') as 'ATIVO' | 'INATIVO';
    const birthDate = usDateToIso(cols[3]);
    const age = parseInt(cols[4], 10) || 35;
    const cpf = cols[5];
    const sex = (cols[6] === 'FEMININO' ? 'FEMININO' : 'MASCULINO') as 'MASCULINO' | 'FEMININO';
    const admissionDate = usDateToIso(cols[7]);
    const phone = cols[8];
    const companyName = cols[9];
    const referenceDoctor = cols[10];

    const companyMeta = COMPANY_METADATA[companyName] || COMPANY_METADATA['Têxtil Horizonte Ltda'];
    const isShift1 = idx % 2 === 0;
    const shift = isShift1 ? '1º Turno (06h–14h)' : '2º Turno (14h–22h)';
    const sector = companyMeta.sectors[idx % companyMeta.sectors.length];
    const role = `Operador Industrial (${sector}) • ${shift}`;
    const protectedWindowSlot = isShift1 ? companyMeta.shift1Slot : companyMeta.shift2Slot;

    // Caso 1: Trabalhador INATIVO (40 registros da planilha)
    if (status === 'INATIVO') {
      return {
        id: `emp-${matricula}`,
        matricula,
        name,
        status: 'INATIVO',
        birthDate,
        age,
        cpf,
        sex,
        admissionDate,
        phone,
        companyId: companyMeta.id,
        companyName,
        companyUnit: companyMeta.unit,
        referenceDoctor,
        multiTeamCare: false,
        lastNutritionDate: '',
        lastPsychologyDate: '',
        lastVisit: '',
        contactHistory2026: 'Vínculo inativo no censo atual',
        monthlyContacts: { jul: '—', ago: '—', set: '—', out: '—', nov: '—', dez: '—' },
        returnRule: '1ª Consulta Inicial',
        nextVisit: 'Inativo',
        lastMedicalDemands: 'Sem demandas ativas (cadastro inativo)',
        riskLevel: 0,
        initialRiskLevel: 0,
        riskVerificationReturnDate: '',
        planSentDate: '',
        goalsAdhesionStatus: '',
        carePlanStatus: '',
        careCoordinationDate: '',
        nextCareCoordinationDate: '',
        sector,
        shift,
        role,
        neverScheduled: true,
        daysSinceActivation: 0,
        sentStatus: false,
        carePassCode: `PASSE-${matricula.slice(-4)}`,
        protectedWindowSlot,
        summaryLine: 'Cadastro Inativo na base assistencial • Fora da fila operacional',
        clinicalNotes: `Registro constante no censo assistencial (Matrícula ${matricula}) com status INATIVO.`,
        habits: [],
        conditions: ['Cadastro Inativo'],
        medsAndScreening: [],
        pciRecommendations: [],
        pciExams: [],
        examResultsAndPrescriptions: [],
        whatsappStatus: 'Inativo • Sem disparo programado',
        returnNotes: 'Filtrado automaticamente das filas operacionais ativas.',
      };
    }

    const currentActiveRank = activeIndex++;

    // Caso especial para Marcos Dias Mendes (Matrícula 20261186 — Persona central do estudo)
    if (matricula === '20261186') {
      return {
        id: `emp-${matricula}`,
        matricula,
        name,
        status: 'ATIVO',
        birthDate,
        age,
        cpf,
        sex,
        admissionDate,
        phone,
        companyId: companyMeta.id,
        companyName,
        companyUnit: companyMeta.unit,
        referenceDoctor,
        multiTeamCare: false,
        lastNutritionDate: '',
        lastPsychologyDate: '',
        lastVisit: '',
        contactHistory2026: 'Triagem rápida no turno (PA 150x90 mmHg); pendente 1ª consulta APS',
        monthlyContacts: {
          jul: 'Sem resposta',
          ago: 'Sem resposta',
          set: 'Recusa por turno',
          out: 'Triagem rápida PA',
          nov: 'Convocado Janela Protegida',
          dez: 'Programado',
        },
        returnRule: '1ª Consulta Inicial',
        nextVisit: 'Pendente 1ª Consulta',
        lastMedicalDemands: 'Acolhimento inicial APS: investigação de PA 150x90 mmHg e lombalgia mecânica.',
        riskLevel: 0,
        initialRiskLevel: 0,
        riskVerificationReturnDate: '2026-11-22',
        planSentDate: '',
        goalsAdhesionStatus: '',
        carePlanStatus: '',
        careCoordinationDate: '2026-11-15',
        nextCareCoordinationDate: '2026-11-30',
        sector: 'Linha de Produção A',
        shift: '1º Turno (06h–14h)',
        role: 'Operador de Produção • 1º Turno (06h–14h)',
        neverScheduled: true,
        daysSinceActivation: 184,
        sentStatus: false,
        carePassCode: `PASSE-${matricula.slice(-4)}`,
        protectedWindowSlot: companyMeta.shift1Slot,
        summaryLine: '184 dias sem 1ª consulta • PA 150x90 mmHg em ação rápida + dor lombar no turno',
        clinicalNotes:
          'Ativo há 184 dias sem agendar a 1ª consulta na APS por receio de se ausentar da linha de produção e perder o transporte fretado. Em ação preventiva rápida apresentou PA 150x90 mmHg e relatou dor lombar.',
        habits: ['1h10 de deslocamento em fretado', 'Acorda às 04h30', 'Não realiza atividade física regular'],
        conditions: ['Pico pressórico em triagem (PA 150x90 mmHg)', 'Lombalgia mecânica ocupacional', 'Histórico familiar de AVC paterno'],
        medsAndScreening: ['Uso esporádico de analgésicos', 'Pendente rastreio laboratorial de 1ª consulta'],
        pciRecommendations: [
          'Realizar 1ª consulta de acolhimento na janela protegida do 1º turno sem impacto em ponto',
          'Solicitar MAPA / curva pressórica e exames laboratoriais basais',
        ],
        pciExams: ['Glicemia de jejum, HbA1c, Creatinina, Lipidograma', 'Aferição seriada de PA'],
        examResultsAndPrescriptions: [],
        whatsappStatus: 'Aguardando envio do Passe de Cuidado na janela protegida',
        returnNotes: 'Prioridade de Busca Ativa (184 dias sem 1ª consulta).',
        checkIn60s: {
          submittedAt: '14/11/2026 05:45',
          painLevel: 'Moderada (Lombar/Ombros)',
          sleepQuality: 'Acorda cansado',
          energyLevel: 'Cansaço no fim do turno',
          stressAndMood: 'Ansioso / Pressionado',
          bloodPressureRef: '150x90 mmHg (triagem rápida na unidade)',
          suggestedTriage: 'Médico de Família',
        },
      };
    }

    // Os primeiros 36 ativos (exceto Marcos) já estão em acompanhamento na Fila 1 (Risco 4, 3, 2, 1)
    // e os outros 24 ativos estão na Fila 2 (Busca Ativa de 1ª Consulta, nunca agendaram)
    if (currentActiveRank < 37) {
      const tpl = ACCOMPANIED_TEMPLATES[currentActiveRank % ACCOMPANIED_TEMPLATES.length];
      // Pequeno ajuste de dias na data de próximo retorno para ordenação fina dentro do mesmo risco
      const baseNext = new Date(`${tpl.nextVisit}T12:00:00`);
      baseNext.setDate(baseNext.getDate() + (currentActiveRank % 9));
      const nextVisitIso = baseNext.toISOString().slice(0, 10);

      const monthlyContacts: MonthlyContacts2026 = {
        jul: currentActiveRank % 2 === 0 ? 'Realizado' : 'Contato WhatsApp',
        ago: 'Realizado',
        set: currentActiveRank % 3 === 0 ? 'Realizado' : 'Monitorado',
        out: 'Realizado',
        nov: 'Em acompanhamento',
        dez: 'Programado',
      };

      return {
        id: `emp-${matricula}`,
        matricula,
        name,
        status: 'ATIVO',
        birthDate,
        age,
        cpf,
        sex,
        admissionDate,
        phone,
        companyId: companyMeta.id,
        companyName,
        companyUnit: companyMeta.unit,
        referenceDoctor,
        multiTeamCare: tpl.multiTeamCare,
        lastNutritionDate: tpl.lastNutritionDate,
        lastPsychologyDate: tpl.lastPsychologyDate,
        lastVisit: tpl.lastVisit,
        contactHistory2026: 'Acompanhamento ativo com registro em prontuário APS',
        monthlyContacts,
        returnRule: tpl.returnRule,
        nextVisit: nextVisitIso,
        lastMedicalDemands: tpl.lastMedicalDemands,
        riskLevel: tpl.riskLevel,
        initialRiskLevel: tpl.initialRiskLevel,
        riskVerificationReturnDate: nextVisitIso,
        planSentDate: tpl.lastVisit,
        goalsAdhesionStatus: tpl.goalsAdhesionStatus,
        carePlanStatus: tpl.carePlanStatus,
        careCoordinationDate: '2026-11-10',
        nextCareCoordinationDate: nextVisitIso,
        sector,
        shift,
        role,
        neverScheduled: false,
        daysSinceActivation: 90 + ((currentActiveRank * 11) % 180),
        sentStatus: currentActiveRank % 3 === 0,
        carePassCode: `PASSE-${matricula.slice(-4)}`,
        protectedWindowSlot,
        summaryLine: tpl.summaryLine,
        clinicalNotes: tpl.clinicalNotes,
        habits: [...tpl.habits],
        conditions: [...tpl.conditions],
        medsAndScreening: [...tpl.medsAndScreening],
        pciRecommendations: [...tpl.pciRecommendations],
        pciExams: [...tpl.pciExams],
        examResultsAndPrescriptions: tpl.examResultsAndPrescriptions.map((item) => ({
          ...item,
          id: `${item.id}-${matricula}`,
        })),
        whatsappStatus:
          currentActiveRank % 3 === 0
            ? `✓ Passe de Cuidado (PASSE-${matricula.slice(-4)}) confirmado no turno`
            : 'Elegível para disparo de confirmação de retorno',
        returnNotes: `Acompanhado por ${referenceDoctor} • Retorno: ${tpl.returnRule}.`,
      };
    }

    // Fila 2 — Busca Ativa de 1ª Consulta (nunca agendaram)
    const daysSinceActivation = 215 - (currentActiveRank - 37) * 6;
    return {
      id: `emp-${matricula}`,
      matricula,
      name,
      status: 'ATIVO',
      birthDate,
      age,
      cpf,
      sex,
      admissionDate,
      phone,
      companyId: companyMeta.id,
      companyName,
      companyUnit: companyMeta.unit,
      referenceDoctor,
      multiTeamCare: false,
      lastNutritionDate: '',
      lastPsychologyDate: '',
      lastVisit: '',
      contactHistory2026: `${daysSinceActivation} dias ativo na base sem registro de 1ª consulta`,
      monthlyContacts: {
        jul: 'Pendente',
        ago: 'Pendente',
        set: 'Busca ativa',
        out: 'Busca ativa',
        nov: 'Aguardando agendamento',
        dez: 'Programado',
      },
      returnRule: '1ª Consulta Inicial',
      nextVisit: 'Pendente 1ª Consulta',
      lastMedicalDemands: 'Realizar 1ª consulta de acolhimento e estratificação de risco inicial.',
      riskLevel: 0,
      initialRiskLevel: 0,
      riskVerificationReturnDate: 'Pendente 1ª Consulta',
      planSentDate: '',
      goalsAdhesionStatus: 'Aguardando 1ª consulta',
      carePlanStatus: 'Pendente Acolhimento Inicial',
      careCoordinationDate: '2026-11-15',
      nextCareCoordinationDate: '2026-11-29',
      sector,
      shift,
      role,
      neverScheduled: true,
      daysSinceActivation,
      sentStatus: false,
      carePassCode: `PASSE-${matricula.slice(-4)}`,
      protectedWindowSlot,
      summaryLine: `${daysSinceActivation} dias ativo sem 1ª consulta • Prioridade de busca ativa (${shift})`,
      clinicalNotes: `Trabalhador ativo na unidade ${companyName} há ${daysSinceActivation} dias sem agendamento de 1ª consulta na APS. Médico de referência designado: ${referenceDoctor}.`,
      habits: ['Pendente coleta no acolhimento inicial'],
      conditions: ['Sem avaliação clínica inicial (Risco 0)'],
      medsAndScreening: ['Pendente conferência vacinal e triagem de enfermagem'],
      pciRecommendations: [
        'Enviar Passe de Cuidado via WhatsApp com horário na janela protegida do turno',
        'Realizar estratificação de risco (1 a 4) na 1ª consulta',
      ],
      pciExams: ['Aferição de PA, antropometria, glicemia de jejum e lipidograma inicial'],
      examResultsAndPrescriptions: [],
      whatsappStatus: 'Aguardando disparo do Passe de Cuidado',
      returnNotes: `Prioridade na Fila 2 (${daysSinceActivation} dias sem agendar).`,
    };
  });
}

export const INITIAL_EMPLOYEES: Employee[] = buildEmployeesFrom100Rows();
