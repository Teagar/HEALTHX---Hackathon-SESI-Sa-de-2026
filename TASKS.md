# TASKS.md — Plano de Execução Atômica para o OpenCode (v2.0 Fullstack + Power BI + Automações)
**Projeto:** HealthX / SESI Saúde Acolhe — Hackathon SESI Saúde 2026

> **Como usar no fluxo Multi-Agente (Orca Dev):**
> 1. **Aba 1 (AGY Architect):** Já preparou toda a fundação de dados, censo real de 100 linhas (`data/gestao_do_cuidado_sesi_100.csv`), motor de filas e Power BI (`src/types.ts`, `src/mockDatabase.ts`, `src/queueService.ts`), Backend Express + Banco JSON + Schema PostgreSQL (`server/index.ts`, `server/dbConnector.ts`, `server/schema.sql`) e Scripts de Automação (`scripts/syncSesiSpreadsheet.ts`, `scripts/activeSearchCron.ts`).
> 2. **No OpenCode:** Copie e cole os prompts das **Fases 1 a 5** abaixo (um por vez) para o OpenCode construir os componentes visuais conectados ao Backend e validar a execução fullstack.
> 3. **Aba 2 (AGY Revisor — Claude/GPT):** Após cada fase ou ao final, peça ao Revisor para auditar o código contra o `AGENTS.md`.

---

## Status das Tarefas

- [x] **FASE 0 (Concluída pelo AGY Architect):**
  - Censo oficial de 100 registros do SESI (`data/gestao_do_cuidado_sesi_100.csv` e `public/dados_ficticios_sesi.csv`)
  - Contratos TypeScript com Power BI, Viabilidade Econômico-Financeira e Banco/Automações (`src/types.ts`)
  - Base realista de funcionários e janelas protegidas (`src/mockDatabase.ts`)
  - Motor de Dupla Fila, protocolo de retorno, exportador CSV de 32 colunas, cálculos de Viabilidade ($PEq$, $PEEq$, Payback Descontado a 8,5% a.a., ROI) e trava LGPD (`src/queueService.ts`)
  - Backend Express + Persistência JSON + Conector de Escalabilidade SQL (`server/index.ts`, `server/dbConnector.ts`, `server/schema.sql`)
  - Scripts de Automação Executáveis (`scripts/syncSesiSpreadsheet.ts` e `scripts/activeSearchCron.ts`)
- [ ] **FASE 1 (OpenCode):** Criar `src/components/TopBar.tsx` e `src/components/SidebarTree.tsx`
- [ ] **FASE 2 (OpenCode):** Criar `src/components/DualQueueView.tsx` (Duas Janelas 50%/50% com ordem estrita `[ Abrir Ficha ]` e `[ Enviar ]`)
- [ ] **FASE 3 (OpenCode):** Criar `src/components/EmployeeCockpit.tsx` (Ficha Única Editável em 2 colunas simultâneas sem abas ocultas)
- [ ] **FASE 4 (OpenCode):** Criar `src/components/AdminChannel.tsx` (Painel Admin com Gatilhos de Automação de Planilha/Bot, Status de Conexão DB/PostgreSQL/S+, Censo Power BI das 100 Vidas e Viabilidade Financeira) e `src/components/CompanyB2BChannel.tsx` (Canal 3 Gestor B2B com Trava LGPD $N \ge 5$, Power BI Executivo e Kit DDS)
- [ ] **FASE 5 (OpenCode):** Criar `src/App.tsx` e `src/main.tsx` integrando a API Backend (`/api/state`, `/api/automations/...`) com fallback resiliente em `localStorage`, testar scripts (`npm run sync:csv` e `npm run cron:bot`) e validar `npm run build`.

---

## Especificação Detalhada por Fase

### FASE 1: Barra Superior (`TopBar.tsx`) e Árvore Lateral (`SidebarTree.tsx`)
1. **`src/components/TopBar.tsx`**:
   - Altura fixa `h-14` (`56px`), fundo `#FFFFFF`, borda inferior `#D5CFC3`.
   - Esquerda: Identidade **SESI Saúde Acolhe • HealthX Coordenação do Cuidado**, badge de status do banco (`DB Local JSON + Conector SQL Pronto`) e contadores rápidos (`Em Retorno`, `Busca Ativa 1ª Consulta`, `Passes Enviados`).
   - Centro: Seletor de **3 Canais**:
     - `1. Equipe Médica (APS)` (`medical`)
     - `2. Painel Admin, BI & Automações` (`admin`)
     - `3. Gestor da Empresa (B2B • LGPD)` (`company_b2b`)
   - Direita: Botão **`Restaurar Demo Inicial`** (chama `onResetDemo`).
2. **`src/components/SidebarTree.tsx`**:
   - Largura fixa `w-72` (`288px`), fundo `#EAE5DC`, borda direita `#D5CFC3`.
   - Topo: Botão **`Painel de Filas (Início)`** que limpa `selectedEmployeeId` (`onSelectEmployee(null)`) para voltar às duas janelas 50/50.
   - Busca instantânea por nome, matrícula, empresa ou condição clínica + seletor de filtro por empresa.
   - Árvore expansível de **Empresas Assistidas $\rightarrow$ Funcionários** com bolinha colorida de risco e badge (`R4`, `R3`, `R2`, `R1` ou `184d`).

### FASE 2: Duas Janelas Internas 50% / 50% (`DualQueueView.tsx`)
1. **`src/components/DualQueueView.tsx`**:
   - Container pai `flex-1 min-h-0 flex flex-col gap-3 overflow-hidden`.
   - **Janela Interna 1 (Superior — 50% da altura, `flex-1 min-h-0 bg-white rounded-lg border border-[#D5CFC3] flex flex-col overflow-hidden`):**
     - Cabeçalho fixo: **"FILA 1 • PRIORIDADE CLÍNICA DE RETORNO (PACIENTES JÁ ACOMPANHADOS)"** + subtítulo explicando a ordenação `Risco 4 -> Risco 3 -> Risco 2 -> Risco 1`.
     - Tabela com rolagem interna (`overflow-y-auto`):
       - Coluna 1: Badge de Risco (`RISCO 4 • CRÍTICO`, `RISCO 3 • 3 MESES`, `RISCO 2 • 6 MESES`, `RISCO 1 • 6 MESES`).
       - Coluna 2: Nome do funcionário, idade, cargo/turno e nome da empresa.
       - Coluna 3: Quadro clínico resumido (`summaryLine`), médico de referência e data prevista de retorno (`nextVisit`).
       - Coluna 4 (Ações à direita — **ORDEM OBRIGATÓRIA DA REGRA 4**):
         1. Botão **`[ Abrir Ficha ]`** (primeiro botão, à esquerda) $\rightarrow$ chama `onOpenProfile(emp.id)`.
         2. Botão **`[ Enviar ]`** (segundo botão, à direita) $\rightarrow$ chama `onSendWhatsApp(emp.id)` e exibe **`✓ Enviado`** quando `emp.sentStatus === true`.
   - **Janela Interna 2 (Inferior — 50% da altura, `flex-1 min-h-0 bg-white rounded-lg border border-[#D5CFC3] flex flex-col overflow-hidden`):**
     - Cabeçalho fixo: **"FILA 2 • BUSCA ATIVA DE 1ª CONSULTA (TRABALHADORES QUE NUNCA AGENDARAM)"** + subtítulo explicando a ordenação decrescente por `daysSinceActivation` (`210d -> 184d -> 162d...`).
     - Tabela com rolagem interna (`overflow-y-auto`):
       - Coluna 1: Badge de Dias sem Agendar (`210 dias sem agendar`, `184 dias sem agendar`, etc. — destaque terracota se $\ge 150$ dias).
       - Coluna 2: Nome do funcionário, matrícula, cargo/turno e empresa.
       - Coluna 3: Situação na Busca Ativa (`summaryLine`), data de admissão na APS e janela protegida sugerida (`protectedWindowSlot`).
       - Coluna 4 (Ações à direita — **ORDEM OBRIGATÓRIA DA REGRA 4**):
         1. Botão **`[ Abrir Ficha ]`** (primeiro botão, à esquerda) $\rightarrow$ chama `onOpenProfile(emp.id)`.
         2. Botão **`[ Enviar ]`** (segundo botão, à direita) $\rightarrow$ chama `onSendWhatsApp(emp.id)` e exibe **`✓ Enviado`** quando `emp.sentStatus === true`.

### FASE 3: Ficha Única Editável — "Single-View Cockpit" (`EmployeeCockpit.tsx`)
1. **`src/components/EmployeeCockpit.tsx`**:
   - Ocupa 100% da área central quando um funcionário está selecionado (`flex-1 min-h-0 bg-white rounded-lg border border-[#D5CFC3] flex flex-col overflow-hidden`).
   - **Barra Superior da Ficha (`min-h-[60px]`):**
     - Input editável para o Nome do Funcionário, badges de Matrícula, CPF, Empresa, Cargo/Turno e Médico de Referência.
     - Seletor imediato de **Classificação de Risco (`0` a `4`)** que já recalcula automaticamente a regra de retorno e a próxima consulta.
     - Botão **`[ Salvar Alterações ]`** (primário `#1F564C`), botão **`[ Enviar ]`** (ou `✓ Passe Enviado`) e botão **`[ ✕ Fechar Ficha ]`**.
   - **Corpo em Grade de 2 Colunas Simultâneas (`grid-cols-12`, sem abas ocultas):**
     - **Coluna Esquerda (`col-span-12 lg:col-span-7`):**
       1. *Bloco 1 — Gestão do Cuidado (SOC/S+):* Campo editável de Resumo da Fila (`summaryLine`), Textarea de Anamnese/Observações Clínicas (`clinicalNotes`) e 3 cartões editáveis lado a lado (*Hábitos de Vida*, *Condições / Doenças Crônicas / Saúde Mental*, *Medicações / Vacinas / Rastreio*) com adição/remoção de itens.
       2. *Bloco 2 — Plano de Cuidados Individual (PCI):* Metas pactuadas (`pciRecommendations`) e Exames/Encaminhamentos (`pciExams`) com adição e exclusão rápida.
     - **Coluna Direita (`col-span-12 lg:col-span-5`):**
       1. *Bloco 3 — Gestão de Retorno e Protocolo APS:* Se `neverScheduled === true`, exibe banner de destaque com botão **`[ Registrar 1ª Consulta Realizada (Migrar para Fila 1) ]`**. Exibe seletor de `returnRule`, `lastVisit` (input date), `nextVisit` (calculado/editável), `daysSinceActivation`, `protectedWindowSlot`, `whatsappStatus` e `returnNotes`.
       2. *Bloco 4 — Pré-Consulta / Check-in de 60s (QR Code & WhatsApp):* Exibe as respostas do trabalhador (`painLevel`, `sleepQuality`, `energyLevel`, `stressAndMood`, `bloodPressureRef`, `suggestedTriage`) ou botão para simular recebimento do Check-in de 60s.

### FASE 4: Canal 2 (`AdminChannel.tsx` — Automação, DB/SQL, Power BI & Viabilidade) e Canal 3 (`CompanyB2BChannel.tsx` — LGPD)
1. **`src/components/AdminChannel.tsx` (Painel Admin, BI & Automações):**
   - **Seção A — Centro de Automações e Scripts Reais:**
     - Botão **`[ ⚡ Executar Script: Sincronizar Planilha SESI (100 linhas) ]`** $\rightarrow$ aciona `onRunSpreadsheetSync()` (`POST /api/automations/sync-spreadsheet`), lê `data/gestao_do_cuidado_sesi_100.csv`, atualiza `data/GESTAO_DO_CUIDADO_ATUALIZADA_AUTO.csv` e exibe o resultado no Log de Auditoria.
     - Botão **`[ 🤖 Executar Robô: Busca Ativa & Passe de Cuidado em Lote ]`** $\rightarrow$ aciona `onRunActiveSearchBot()` (`POST /api/automations/run-active-search-bot`), dispara Passes de Cuidado para casos críticos (Risco 4/3 e $>140$ dias sem agendar) e atualiza a fila.
     - Botão **`[ 📥 Baixar Planilha SESI Atualizada (.CSV 32 Colunas) ]`** $\rightarrow$ gera e baixa no navegador o CSV completo atualizado via `exportEmployeesToSesiCsvString(employees)`.
     - Importador manual/drag-and-drop de CSV (`parseSesiCsvContent`).
     - Tabela de **Logs de Auditoria de Automações** (`automationLogs`).
   - **Seção B — Arquitetura de Banco de Dados (Simulação JSON + Escalabilidade SQL/S+):**
     - Exibe status em tempo real do banco local (`server/data/healthx_db.json`) e os 4 Conectores de Escalabilidade Enterprise (`PostgreSQL 16 Cloud`, `API Bidirecional SOC/S+`, `Gateway WhatsApp Oficial`, `View Materializada Power BI vw_lgpd_b2b_cohort_metrics`).
     - Botão **`[ 🔌 Testar Conexão SQL & Webhook S+ ]`** que chama `onTestDbConnection()` (`POST /api/admin/test-connection`) e mostra latência e validação do schema `server/schema.sql`.
   - **Seção C — Inteligência Equivalente ao Power BI (Censo Real de 100 Vidas + Carteira Médica + Linhas de Cuidado):**
     - Cards e gráficos em barras do Censo da Planilha (`100 registros`, `60 Ativos`, `40 Inativos`, `50 M / 50 F`, idade média `38,2 anos`, `% multiprofissional` calculado ao vivo na base), Distribuição Epidemiológica (`Risco 4` a `Risco 0`), Prevalência das 6 Linhas de Cuidado APS, Carteira dos 4 Médicos de Referência (*Dr. Felipe Andrade* [21], *Dra. Helena Matos* [26], *Dr. Ricardo Fontes* [24], *Dra. Beatriz Campos* [29]) e Evolução Mensal `Jul–Dez/2026` (queda do No-Show de `50,0%` para `15,5%`).
   - **Seção D — Motor de Viabilidade Econômico-Financeira (Metodologia Prof. Antonio Carvalho):**
     - Painel executivo demonstrando Custos Fixos (`R$ 42.500/mês` c/ encargos 40,7% Lucro Real), Custo Variável Unitário (`R$ 2,40/vida`), Margem de Contribuição (`R$ 17,50/vida`), Ponto de Equilíbrio Contábil ($PEq = 2.429\text{ vidas}$) vs. Escala Atual ($10.025\text{ vidas}$), Ponto de Equilíbrio Econômico ($PEEq = 3.086\text{ vidas}$), Payback Descontado a $8,5\%\text{ a.a.}$ ($4,1\text{ meses}$, incluindo ramp-up de implantação no Mês 1; simples de $3,8\text{ meses}$) e ROI Anual ($318,4\%$).
2. **`src/components/CompanyB2BChannel.tsx` (Canal 3 — Gestor B2B com Trava LGPD):**
   - Consome exclusivamente `getLgpdAggregatedMetrics(employees)` e os dados coletivos de `getPowerBiAnalyticsPayload(employees)`.
   - **Regra 5 (Trava LGPD):** Banner verde-sálvia destacando **"Trava de Sigilo Ativa (LGPD • Grupo Mínimo N ≥ 5 • Zero Dados Clínicos Individuais)"**.
   - KPIs Executivos B2B: Vidas Ativas Mapeadas, Vidas Acolhidas (Taxa de Ativação), Queda do No-Show (`50% -> 15,5%`), Resolutividade APS (`94%`), NPS (`97`) e Economia Estimada em Absenteísmo/FAP.
   - Tabela e barras comparativas de adesão por Unidade Industrial e por Turno (`1º Turno` vs `2º Turno`), Escala de Janelas Protegidas sem desconto em folha e Kit de DDS de 2 minutos para líderes de produção.

### FASE 5: Integração Fullstack em `src/App.tsx` e `src/main.tsx`
1. **`src/App.tsx`**:
   - Ao iniciar, busca `GET /api/state` do backend Express (se disponível) e sincroniza `employees`, `shiftConfigs`, `automationLogs` e `dbStatus`. Caso o usuário esteja rodando apenas o Vite sem backend, opera de forma 100% funcional usando `localStorage` + `queueService.ts`.
   - Conecta todas as ações (`handleSaveEmployee`, `handleSendWhatsApp`, `handleRegisterFirstVisit`, `handleRunSpreadsheetSync`, `handleRunActiveSearchBot`, `handleTestDbConnection`, `handleResetDemo`) tanto à API REST quanto ao estado reativo local.
   - Exibe toast de confirmação em cada ação clínica ou automação executada.
