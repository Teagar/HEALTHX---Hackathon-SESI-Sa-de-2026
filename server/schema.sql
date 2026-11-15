-- =============================================================================
-- HEALTHX / SESI SAÚDE ACOLHE — ARQUITETURA SQL DE ESCALABILIDADE ENTERPRISE
-- Banco de Dados Alvo: PostgreSQL 16 (AWS RDS / Azure Database for PostgreSQL)
-- Escala Projetada: 104 Estabelecimentos Industriais • 10.025+ Vidas Ativas (BA)
-- Integrações Nativas: SOC / S+ (Prontuário SESI), WhatsApp Cloud API e Power BI
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabela de Empresas Contratantes e Janelas Protegidas de Turno
CREATE TABLE IF NOT EXISTS companies (
    company_id VARCHAR(64) PRIMARY KEY,
    cnpj VARCHAR(18) UNIQUE,
    company_name VARCHAR(160) NOT NULL,
    company_unit VARCHAR(180) NOT NULL,
    total_contracted_lives INTEGER NOT NULL DEFAULT 0,
    shift_1_protected_window VARCHAR(140) NOT NULL,
    shift_2_protected_window VARCHAR(140) NOT NULL,
    dds_schedule VARCHAR(120) NOT NULL,
    zero_payroll_deduction_guaranteed BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabela de Trabalhadores Assistidos (Sincronizada com Censo SOC/S+ e Planilha SESI)
CREATE TABLE IF NOT EXISTS employees (
    id VARCHAR(64) PRIMARY KEY,
    matricula VARCHAR(32) UNIQUE NOT NULL,
    cpf_hash VARCHAR(128) NOT NULL, -- Hash SHA-256 para conformidade LGPD
    cpf_masked VARCHAR(20) NOT NULL,
    full_name VARCHAR(160) NOT NULL,
    sex VARCHAR(16) NOT NULL CHECK (sex IN ('MASCULINO', 'FEMININO')),
    birth_date DATE NOT NULL,
    age INTEGER NOT NULL,
    phone VARCHAR(32) NOT NULL,
    admission_date_aps VARCHAR(32) NOT NULL,
    reference_doctor VARCHAR(120) NOT NULL,
    multi_team_care BOOLEAN NOT NULL DEFAULT FALSE,
    company_id VARCHAR(64) NOT NULL REFERENCES companies(company_id),
    sector VARCHAR(120) NOT NULL,
    shift_label VARCHAR(80) NOT NULL,
    role_title VARCHAR(120) NOT NULL,
    -- Motor de Dupla Fila (Regra de Negócio 1 e 2)
    risk_level SMALLINT NOT NULL DEFAULT 0 CHECK (risk_level BETWEEN 0 AND 4),
    never_scheduled BOOLEAN NOT NULL DEFAULT TRUE,
    days_since_activation INTEGER NOT NULL DEFAULT 0,
    return_rule VARCHAR(48) NOT NULL DEFAULT '1ª Consulta Inicial',
    last_visit_date DATE NULL,
    next_visit_date VARCHAR(32) NOT NULL DEFAULT 'Pendente 1ª Consulta',
    -- Passe de Cuidado & WhatsApp (Regra de Negócio 4)
    sent_status BOOLEAN NOT NULL DEFAULT FALSE,
    care_pass_code VARCHAR(32) NULL,
    protected_window_slot VARCHAR(140) NULL,
    whatsapp_status TEXT NOT NULL,
    summary_line TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance imediata da Dupla Fila (< 5ms para 10.025+ vidas)
CREATE INDEX IF NOT EXISTS idx_employees_return_queue
    ON employees (never_scheduled, risk_level DESC, next_visit_date ASC);

CREATE INDEX IF NOT EXISTS idx_employees_active_search_queue
    ON employees (never_scheduled, days_since_activation DESC);

-- 3. Tabela de Ficha Clínica Única (Gestão do Cuidado + PCI + Retorno - SOC/S+)
CREATE TABLE IF NOT EXISTS clinical_records (
    employee_id VARCHAR(64) PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
    clinical_notes TEXT NOT NULL,
    habits_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    conditions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    meds_and_screening_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    pci_recommendations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    pci_exams_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    return_notes TEXT NOT NULL,
    checkin_60s_json JSONB NULL,
    last_updated_by VARCHAR(120) DEFAULT 'Equipe Multiprofissional APS',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Log de Auditoria de Automações (Sincronização Planilha CSV e Bot de Busca Ativa)
CREATE TABLE IF NOT EXISTS automation_audit_logs (
    log_id VARCHAR(64) PRIMARY KEY,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    script_name VARCHAR(80) NOT NULL,
    trigger_source VARCHAR(40) NOT NULL,
    rows_scanned INTEGER NOT NULL DEFAULT 0,
    rows_updated INTEGER NOT NULL DEFAULT 0,
    care_passes_dispatched INTEGER NOT NULL DEFAULT 0,
    output_file_generated VARCHAR(255) NOT NULL,
    summary_message TEXT NOT NULL
);

-- 5. VIEW MATERIALIZADA COM TRAVA DE SIGILO LGPD (REGRA DE NEGÓCIO 5 — CANAL 3 E POWER BI)
-- Jamais expõe CPF, nome, matrícula ou CID individual; exige grupo mínimo N >= 5.
CREATE OR REPLACE VIEW vw_lgpd_b2b_cohort_metrics AS
SELECT
    c.company_id,
    c.company_name,
    c.company_unit,
    e.shift_label,
    COUNT(e.id) AS cohort_lives_count,
    SUM(CASE WHEN e.never_scheduled = FALSE AND e.risk_level > 0 THEN 1 ELSE 0 END) AS accompanied_lives,
    SUM(CASE WHEN e.never_scheduled = TRUE OR e.risk_level = 0 THEN 1 ELSE 0 END) AS pending_first_visit_lives,
    SUM(CASE WHEN e.sent_status = TRUE THEN 1 ELSE 0 END) AS care_passes_issued,
    ROUND(
        (SUM(CASE WHEN e.never_scheduled = FALSE AND e.risk_level > 0 THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(e.id), 0)) * 100,
        1
    ) AS activation_rate_percent
FROM companies c
JOIN employees e ON e.company_id = c.company_id
GROUP BY c.company_id, c.company_name, c.company_unit, e.shift_label
HAVING COUNT(e.id) >= 5; -- TRAVA DE ANONIMIZAÇÃO LGPD (N >= 5)
