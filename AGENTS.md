# AGENTS.md — Master Blueprint & Contexto para Agentes de IA (v2.0 Fullstack + BI + Automações)
**Projeto:** HealthX / SESI Saúde Acolhe — Hackathon SESI Saúde 2026

> **Instrução Automática para Agentes (OpenCode, AGY, Orca Dev):**
> Este arquivo é a fonte única da verdade (*Single Source of Truth*) do projeto. Toda implementação, refatoração ou revisão deve obedecer estritamente às **5 Regras de Negócio**, à **Arquitetura Fullstack com Banco Simulado + Conector Enterprise (`server/` e `scripts/`)**, ao **Contrato de Dados (`src/types.ts`)** e ao Design System **Warm Clinical Slate & Sage** descritos abaixo.

---

## 1. Contexto do Problema (SESI Saúde Acolhe — APS Corporativa)

O programa **SESI Saúde Acolhe** oferece Atenção Primária à Saúde (APS) corporativa para **104 estabelecimentos industriais** na Bahia, cobrindo **10.025 vidas** (trabalhadores), com equipe multiprofissional (Médico de Família, Enfermagem, Psicologia e Nutrição), **94% de resolutividade**, **96% de satisfação** e **NPS 97**.

### As 3 Dores Críticas que Resolvemos
1. **Abismo da 1ª Consulta (Invisibilidade de Ativação):** A empresa contratante envia a planilha de trabalhadores ativos (`GESTÃO DO CUIDADO - APS SESI dados fictícios(Coordenação do cuidado).csv` — 100 linhas reais de censo) e paga por cada vida ativa, mas grande parte nunca agenda a 1ª consulta de acolhimento. Na planilha manual de 32 colunas, a equipe perde horas preenchendo células e não tem visibilidade imediata de há quantos dias um funcionário foi ativado sem nunca ter agendado.
2. **Índice Alarmante de *No-Show* (~50% de faltas):** Metade das consultas agendadas resulta em não comparecimento.
3. **Barreiras Reais do Trabalhador ("Persona Marcos, 38 anos, Operador de Produção, 1º Turno 06h–14h"):**
   - **Cultura da dor e presenteísmo:** Só procura médico quando "trava"; medo de perder prêmio de assiduidade ou parecer "corpo mole".
   - **Barreira de Turno e Liderança:** Sair da linha exige autorização do líder e cobertura; ir no contraturno significa perder o ônibus fretado (1h10 de viagem) estando exausto.
   - **Cansaço Decisório e Fricção Digital:** Desiste se precisar baixar app pesado, criar senha ou preencher cadastro longo.
   - **Desconfiança e Medo de Demissão (Sigilo):** Medo de que relatos de estresse, ansiedade ou hipertensão cheguem ao gestor e gerem demissão/inaptidão.

---

## 2. Regras de Negócio Inegociáveis (Core Business Rules)

A aplicação opera em **3 Canais Visuais Isolados** conectados ao Backend (`server/index.ts`) com persistência em banco local (`server/data/healthx_db.json`) e fallback resiliente em `localStorage`:

### Regra de Negócio 1: Dupla Fila de Priorização Automática (Canal 1 — Equipe Médica)
Quando **nenhum funcionário está selecionado** na tela da Equipe Médica (`selectedEmployeeId === null`), o painel central exibe obrigatoriamente **duas janelas internas dividindo a altura da tela (50% / 50%, `flex-1 min-h-0`)**:
1. **Janela Interna Superior — Prioridade Clínica de Retorno (`neverScheduled === false`):**
   - Lista os funcionários já acompanhados ordenados de forma **estritamente decrescente pela Classificação de Risco (`Risco 4 -> Risco 3 -> Risco 2 -> Risco 1`)**.
   - Critério de desempate: data prevista de retorno (`nextVisit`) mais antiga/atrasada primeiro.
   - Colunas fixas: `Risco` | `Funcionário e Empresa` | `Quadro Clínico e Prazo` | `[ Abrir Ficha ]` + `[ Enviar ]`.
2. **Janela Interna Inferior — Busca Ativa de 1ª Consulta (`neverScheduled === true`):**
   - Lista os funcionários ativos que **nunca agendaram a 1ª consulta**, ordenados de forma **estritamente decrescente pelo maior tempo (em dias) desde a ativação (`daysSinceActivation` decrescente: ex. `210d -> 184d -> 162d...`)**.
   - Colunas fixas: `Dias sem Agendar` | `Funcionário e Empresa` | `Situação na Busca Ativa` | `[ Abrir Ficha ]` + `[ Enviar ]`.

### Regra de Negócio 2: Protocolo de Classificação de Risco e Prazos de Retorno (APS SESI)
O nível de risco (`riskLevel`) determina a regra de retorno (`returnRule`) e o cálculo da próxima consulta (`nextVisit`):
- **Risco 4 (Crítico / Descompensado):** Retorno a **critério médico** (`Quinzenal` = 15 dias ou `Mensal (Critério Médico)` = 30 dias). Prioridade máxima no topo da Janela 1.
- **Risco 3 (Compensado com Comorbidade / Saúde Mental / DCNT):** Retorno obrigatório **`A cada 3 meses` (90 dias)**.
- **Risco 2 (Saudável com Fator de Risco — ex: Sobrepeso, Dislipidemia):** Retorno **`A cada 6 meses` (180 dias)**.
- **Risco 1 (Saudável / Hígido):** Retorno preventivo **`A cada 6 meses` (180 dias)**.
- **Risco 0 / Sem Avaliação (`neverScheduled === true`):** Permanece na Janela 2 (Inferior). Quando a 1ª consulta é registrada e um risco de `1` a `4` é salvo na ficha, `neverScheduled` passa a `false` e o funcionário **migra automaticamente da Janela 2 para a Janela 1**.

### Regra de Negócio 3: Ficha Única Editável ("Single-View Cockpit")
Ao clicar em um funcionário na árvore lateral ou no botão `[ Abrir Ficha ]`, as duas janelas dão lugar à **Ficha Completa do Funcionário**:
- **Proibido usar abas ocultas:** O médico/enfermeiro enxerga e edita simultaneamente na mesma tela os dados dos 3 documentos oficiais do SESI (SOC/S+):
  1. **Gestão do Cuidado:** Resumo da fila (`summaryLine`), Anamnese/Observações clínicas (`clinicalNotes`), e 3 blocos lado a lado: *Hábitos de Vida* (`habits`), *Condições/Doenças Crônicas/Saúde Mental* (`conditions`) e *Medicações/Vacinas/Rastreio* (`medsAndScreening`).
  2. **Plano de Cuidados Individual (PCI):** Recomendações/Metas pactuadas (`pciRecommendations`) e checklist dinâmico de Exames/Encaminhamentos (`pciExams`) com adição e remoção em tempo real.
  3. **Gestão de Retorno:** Seletor de regra de retorno (`returnRule`), Data da última consulta (`lastVisit`), Data prevista de retorno (`nextVisit`), Dias ativo no sistema (`daysSinceActivation`), Status do contato no WhatsApp (`whatsappStatus`), Observações do monitoramento (`returnNotes`) e botão de ação rápida **`[ Registrar 1ª Consulta Realizada ]`** (quando `neverScheduled === true`).
- **Barra de Topo Enxuta da Ficha (`60px`):** Nome editável, cargo/turno e empresa, seletor imediato de **Classificação de Risco (0 a 4)**, botão **`[ Salvar Alterações ]`**, botão **`[ Enviar ]`** e botão **`[ ✕ Fechar Ficha ]`**.
- **Grade de 2 Colunas Simultâneas:** Proporção **7/12 (ou 60% Esquerda)** para *Gestão do Cuidado + PCI* e **5/12 (ou 40% Direita)** para *Gestão de Retorno + Jornada WhatsApp/Check-in 60s*.

### Regra de Negócio 4: Ordem Obrigatória dos Botões e Disparo do "Passe de Cuidado"
- Em ambas as janelas de fila (Janela 1 e Janela 2), toda linha de funcionário deve exibir dois botões na extrema direita, **rigorosamente nesta ordem**:
  1. **`[ Abrir Ficha ]`** (à esquerda — primeiro botão)
  2. **`[ Enviar ]`** (à direita — segundo botão, depois do Abrir Ficha)
- Clicar em **`[ Enviar ]`** dispara o convite/agendamento via WhatsApp com o **"Passe de Cuidado"** (horário já pactuado dentro da janela protegida do turno, valendo como autorização logística para o líder sem revelar o motivo clínico) e muda imediatamente o botão para **`✓ Enviado`** (`sentStatus = true`).

### Regra de Negócio 5: Trava de Sigilo LGPD + Equivalência Power BI e Viabilidade (Canais 2 e 3)
- **Restrição Absoluta no Canal 3:** O **Canal 3 (Gestor da Empresa Contratada)** consome exclusivamente os agregadores anônimos (`getLgpdAggregatedMetrics`) com escopo isolado por unidade industrial (o gestor visualiza apenas os indicadores anônimos da sua própria empresa, com trava mínima `N >= 5`) e **JAMAIS** pode receber ou exibir nomes, CPFs, matrículas, cargos individuais, diagnósticos ou fichas clínicas.
- **Inteligência Epidemiológica & Economia em Saúde Ocupacional Baseada em Evidências (`CorporateHealthImpactMetrics`):**
  - Censo integral das **100 linhas** da planilha oficial do SESI (`60 Ativos` e `40 Inativos` distribuídos nas 6 empresas: *Têxtil Horizonte Ltda*, *Plásticos Recôncavo Ltda*, *Cerâmica Pedra Azul Ltda*, *Metalúrgica Atlântida Ltda*, *Alimentos Vale Verde Ltda* e *Química Litoral Norte S.A.*, `50 Masculino` / `50 Feminino`, idade média `38,2 anos`, cuidado multiprofissional calculado dinamicamente sobre a base ativa, linhas de cuidado APS, evolução mensal `Jul–Dez/2026` e carteira dos 4 médicos de referência: *Dr. Felipe Andrade* [21], *Dra. Helena Matos* [26], *Dr. Ricardo Fontes* [24] e *Dra. Beatriz Campos* [29]).
  - **Retorno Operacional e Economia em Saúde (`computeCorporateHealthImpact`):** Os custos internos do projeto (CAPEX, folha e payback) são de uso exclusivo do pitch deck e não aparecem na interface do sistema. No software, o impacto financeiro e produtivo é calculado de forma estritamente proporcional aos trabalhadores ativos inseridos, fundamentado em métricas reais e fontes oficiais: (1) *Horas Produtivas Preservadas no Turno* (*ANAMT / CNI-SESI*), (2) *Sinistralidade e Pronto-Socorro Evitados pela Resolutividade APS de 94%* (*SESI Saúde Acolhe & IESS/ANS*) e (3) *Redução de Dias de Absenteísmo por Manejo de Crônicos* (*OMS / OIT & Previdência Social FAP*).
  - **Ficha Alinhada às 32 Colunas + Leitor OCR Integrado:** A via interna da Equipe de Saúde conta com inserção de novos funcionários via **Leitor OCR de Fichas/ASO** (`NewEmployeeOcrModal.tsx`) e **Leitor OCR de Prescrições e Exames de Retorno** (`EmployeeCockpit.tsx`), convertendo documentos automaticamente nos 32 campos da planilha com validação do profissional e cálculo automático de prazos de retorno.

---

## 3. Arquitetura de Backend, Banco de Dados Simulado/Enterprise e Automações

1. **Backend Express + TypeScript (`server/index.ts` na porta `3001`):**
   - Conectado via proxy Vite (`/api`) no frontend (`vite.config.ts`).
   - Endpoints REST: `GET /api/health`, `GET /api/state`, `PUT /api/employees/:id`, `POST /api/employees/:id/send-pass`, `POST /api/employees/:id/first-visit`, `POST /api/automations/sync-spreadsheet`, `POST /api/automations/run-active-search-bot`, `POST /api/admin/test-connection`, `POST /api/admin/reset-demo`.
2. **Simulação de Banco de Dados + Escalabilidade Real (`server/dbConnector.ts` e `server/schema.sql`):**
   - **Modo Simulação Local Persistente:** Grava todas as alterações em tempo real em `server/data/healthx_db.json` e atualiza automaticamente a planilha consolidada em `data/GESTAO_DO_CUIDADO_ATUALIZADA_AUTO.csv`.
   - **Modo Escalabilidade Enterprise (`server/schema.sql`):** DDL completo em PostgreSQL 16 com tabelas normalizadas (`companies`, `employees`, `clinical_records`, `automation_audit_logs`), índices compostos de fila e View Materializada `vw_lgpd_b2b_cohort_metrics` com trava `HAVING COUNT(e.id) >= 5`, além de conectores simulados e testáveis no Painel Admin para **PostgreSQL Cloud**, **API SOC/S+** e **WhatsApp Cloud API / Z-API**.
3. **Scripts de Automação Executáveis (`scripts/`):**
   - `scripts/syncSesiSpreadsheet.ts` (`npm run sync:csv` ou botão no Painel Admin): Lê as 100 linhas de `data/gestao_do_cuidado_sesi_100.csv`, filtra inativos, sincroniza ativos na Janela 2 e gera `data/GESTAO_DO_CUIDADO_ATUALIZADA_AUTO.csv` com todas as colunas preenchidas automaticamente.
   - `scripts/activeSearchCron.ts` (`npm run cron:bot` ou botão no Painel Admin): Varre as filas, aloca horários nas janelas protegidas de 1º e 2º turno e dispara Passes de Cuidado em lote para casos críticos (Risco 4/3 e $>140$ dias sem 1ª consulta).

---

## 4. Diretrizes Visuais e Design System ("Warm Clinical Slate & Sage")

| Elemento | Hexadecimal | Uso |
| :--- | :--- | :--- |
| **Moldura da Área Central** | `#E2DDD3` | Fundo estrutural da área central para destacar as janelas brancas sem contraste agressivo |
| **Barra Lateral Esquerda** | `#EAE5DC` | Areia Suave com bordas `#D5CFC3` / `#D8D1C5` |
| **Superfície de Janelas / Cards** | `#FFFFFF` e `#FAF9F6` | Papel Quente para containers, tabelas de fila e painéis da ficha |
| **Texto Principal / Secundário** | `#1E2926` / `#5A6561` | Carvão clínico de alta legibilidade |
| **Cor Primária de Ação** | `#1F564C` (hover `#163F37`) | Verde Sálvia Clínico — botões primários, cabeçalhos ativos e confirmações |
| **Risco 4 (Crítico)** | Texto/Badge `#C84B31`, Fundo `#FDF2F0`, Borda `#F5C6BC` | Terracota Clínico |
| **Risco 3 (Compensado - 3m)** | Texto/Badge `#C26D27`, Fundo `#FDF7EC`, Borda `#F5DFB8` | Âmbar Quente |
| **Risco 2 (Saudável c/ Risco - 6m)** | Texto/Badge `#A16207`, Fundo `#FEFCE8`, Borda `#FDE68A` | Ouro Suave |
| **Risco 1 (Saudável - 6m)** | Texto/Badge `#1F564C`, Fundo `#EEF6F3`, Borda `#C6E4DA` | Verde Sálvia |
| **Risco 0 / Nunca Agendou** | Texto/Badge `#64748B`, Fundo `#F1F5F9`, Borda `#CBD5E1` | Ardósia Neutro |

---

## 5. Arquitetura de Diretórios do Repositório

```text
HEALTHX---Hackathon-SESI-Sa-de-2026-CalysonB/
├── AGENTS.md                         # Este documento mestre (lido automaticamente pelos agentes)
├── TASKS.md                          # Plano de tarefas atômicas numeradas para o OpenCode
├── package.json                      # Scripts fullstack (dev, dev:server, sync:csv, cron:bot)
├── vite.config.ts                    # Vite + Proxy /api -> http://localhost:3001
├── data/
│   ├── gestao_do_cuidado_sesi_100.csv          # Censo oficial SESI (100 registros, 32 colunas)
│   └── GESTAO_DO_CUIDADO_ATUALIZADA_AUTO.csv   # Planilha enriquecida gerada pelas automações
├── server/
│   ├── index.ts                      # API REST Express + Orquestrador de Automações e BI
│   ├── dbConnector.ts                # Persistência JSON local + Conectores Enterprise SQL/S+
│   ├── schema.sql                    # DDL PostgreSQL 16 + View Materializada LGPD (N >= 5)
│   └── data/
│       └── healthx_db.json           # Banco de dados local persistente (gerado automaticamente)
├── scripts/
│   ├── syncSesiSpreadsheet.ts        # Automação CLI/API de leitura e atualização da planilha SESI
│   └── activeSearchCron.ts           # Robô CLI/API de busca ativa e emissão de Passes de Cuidado
└── src/
    ├── types.ts                      # Contratos (Employee, PowerBiAnalyticsPayload, Viability, DB)
    ├── mockDatabase.ts               # Seed clínico realista extraído do CSV e PDFs do SESI
    ├── queueService.ts               # Motor de filas, cálculo de retorno, Power BI, Viabilidade e CSV
    ├── App.tsx                       # Shell principal conectado à API (/api/state) + fallback localStorage
    └── components/
        ├── TopBar.tsx                # Barra superior (56px) com status do Backend/DB e seletor de 3 Canais
        ├── SidebarTree.tsx           # Barra lateral (#EAE5DC, 288px) com busca e árvore Empresas -> Funcionários
        ├── DualQueueView.tsx         # Duas janelas 50/50 (Janela 1: Risco decrescente | Janela 2: Dias decrescente)
        ├── EmployeeCockpit.tsx       # Ficha Única Editável (2 colunas 7/12 + 5/12, sem abas ocultas)
        ├── AdminChannel.tsx          # Canal 2: Automação de Planilha, Bot Busca Ativa, Conexão DB/SQL, Power BI & Viabilidade
        └── CompanyB2BChannel.tsx     # Canal 3: Portal do Gestor 100% anônimo (LGPD N>=5), Power BI B2B, ROI e Kit DDS
```
