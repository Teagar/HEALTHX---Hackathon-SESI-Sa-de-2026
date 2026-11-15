# Prompt de Auditoria Técnica, Funcional e LGPD — SESI Saúde Acolhe (HealthX)

Copie e cole o texto abaixo na janela do **Claude Opus** para executar a auditoria completa das alterações implementadas:

---

```markdown
Você é um Auditor Técnico Sênior (Arquitetura Fullstack React/TypeScript, UX Clínica e Conformidade LGPD).
Realize uma auditoria minuciosa do repositório `C:\Users\fell_\orca\HEALTHX---Hackathon-SESI-Sa-de-2026-CalysonB` comparando o código atual com as regras do `AGENTS.md` e os requisitos estruturais solicitados abaixo.

## 1. Escopo da Auditoria (O que deve ser verificado linha a linha)

### A. Arquitetura de Rotas e Página Inicial (Sem Abas)
- Verifique `src/types.ts`, `src/App.tsx`, `src/components/LandingPortal.tsx` e `src/components/TopBar.tsx`:
  - A rota raiz `/` deve exibir a página inicial (`LandingPortal`) com cartões/botões direcionando para as 3 rotas distintas: `/home` (Equipe de Saúde APS), `/admin` (Coordenação & Inteligência APS) e `/gestor` (Portal do Gestor / RH).
  - A navegação deve usar `window.history.pushState` + listener `popstate` (sem abas de canal no topo).
  - Na rota `/home`:
    - O botão **"+ Nova Ficha / Importar Documentos"** deve estar na barra superior (`TopBar.tsx`) e **removido** da barra lateral (`SidebarTree.tsx`).
    - O botão **"Recarregar Base"** deve estar **ausente** na rota `/home` e mantido **apenas** na rota `/admin` (`TopBar.tsx` e `AdminChannel.tsx`).
    - Na barra lateral (`SidebarTree.tsx`), todos os containers de empresa devem iniciar **colapsados por padrão** (`expandedCompanies` vazio inicialmente), expandindo apenas mediante clique do usuário ou durante busca ativa.

### B. Leitor/Editor OCR em 3 Colunas (Baseado em `secilita_planilhas`) & Cadastro Completo
- Verifique `src/secilitaEngine.ts`, `src/components/NewEmployeeOcrModal.tsx` e os 14 anexos em `public/demo/`:
  - Confirme que a estrutura do modal de importação deixou de ser estática e opera em **3 colunas simultâneas**:
    1. **Esquerda:** Fila de documentos inseridos em lote (drag & drop, múltiplos arquivos, texto colado, barra de progresso `X de Y conferidos` e carregamento dos 14 anexos de teste do `secilita_planilhas` + Ficha Cadastral Completa).
    2. **Centro:** Visualização interativa do documento (`Documento` visual: imagem, balões WhatsApp, registro estruturado XML/JSON/CSV ou folha clínica vs `Texto lido (OCR)`), com banner de origem e destaque `<mark>` do trecho de evidência ao focar/clicar em um campo da direita.
    3. **Direita:** Campos extraídos mapeados às **32 colunas da planilha SESI Saúde Acolhe**, com badges `Novo` / `Muda` / `Igual`, opção *"Manter o que estava"* / *"Usar o do documento"*, troca de vínculo ou modo `+ Novo Cadastro`, e ações `Pular`, `Salvar`, `Desfazer` e `Salvar todos`.
  - Confirme que, para **novos funcionários**, o motor (`buildImportQueueItem` / `applyImportItemToEmployee`) supre todos os 11 campos cadastrais não-médicos (`matricula`, `nome`, `status`, `nascimento`, `idade`, `cpf`, `sexo`, `entradaAps`, `telefone`, `empresa`, `medico`) além de `setor`, `cargo` e `turno`.

### C. Leitura de Prontuário / Resultados de Exames + Custódia de Integridade (SHA-256)
- Verifique `src/components/EmployeeCockpit.tsx` e `src/types.ts`:
  - A leitura de prontuário, laudos laboratoriais e prescrições segue a estrutura em **3 colunas** adaptada ao contexto clínico (lote à esquerda, visualização com destaque `<mark>` ao centro, informações clínicas e de retorno à direita).
  - Todos os arquivos lidos são **armazenados no prontuário** (`storedDocuments?: StoredProntuarioDocument[]`) com `fileName`, `mimeType`, `sizeBytes`, `sha256IntegrityHash`, `importedAt`, `extractedText` imutável e log `fieldsUpdated` para controle de segurança e integridade da informação.

### D. Tela 2 (`/admin`) e Tela 3 (`/gestor` — LGPD Estrita + Economia de Produção)
- Verifique `src/components/AdminChannel.tsx`:
  - Avalie a adequação dos indicadores de eficiência operacional, cobertura multiprofissional e horas produtivas preservadas no turno (em vez de foco exclusivo em "Economia Assistencial").
- Verifique `src/queueService.ts` (`getLgpdAggregatedMetrics`), `src/types.ts` (`LgpdCompanyMetric`, `ProductionEconomyMetrics`) e `src/components/CompanyB2BChannel.tsx`:
  - Confirme **ausência total** de `riskBreakdown`, `careLinesDistribution`, nomes de doenças (`Hipertensão`, `Diabetes`, `Saúde Mental`, `DCNT`, etc.), nomes individuais, CPFs, matrículas ou "Economia Assistencial" na rota `/gestor`.
  - Confirme que o `/gestor` exibe apenas **Economia de Produção e Indicadores Operacionais da Carteira** (`productiveHoursPreservedTotal`, `productionValuePreservedBrl`, `equivalentWorkshiftsPreserved`, `attendanceRatePercent` vs `noShowRatePercent`, `multiTeamCoveragePercent`, `carePlanActiveAdhesionPercent`, evolução mensal e cobertura por turno), mantendo a trava de anonimato `N >= 5`.

## 2. Comandos de Verificação a Executar
1. Rode `npx tsc --noEmit -p .` e reporte se há algum erro de tipagem.
2. Rode `npx tsx scripts/auditRules.ts` e reporte o resultado de todas as regras `R0` a `R9`.
3. Inspecione eventuais riscos residuais, edge cases de UX/estado ou inconsistências entre `server/index.ts`, `src/App.tsx` e os componentes de UI, classificando achados por severidade (`Crítico`, `Alto`, `Médio`, `Baixo`) com arquivo e linha exatos.
```
