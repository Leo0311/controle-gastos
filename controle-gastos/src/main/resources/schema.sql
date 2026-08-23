-- Script de criação do banco de dados e da tabela de gastos
-- Execute primeiro (se o banco ainda não existir):
--   CREATE DATABASE controle_gastos;
--
-- Depois, conectado ao banco controle_gastos, rode o restante deste script.

CREATE TABLE IF NOT EXISTS gastos (
    id          SERIAL PRIMARY KEY,
    descricao   VARCHAR(150)   NOT NULL,
    valor       NUMERIC(12,2)  NOT NULL CHECK (valor > 0),
    categoria   VARCHAR(60)    NOT NULL,
    data        DATE           NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS idx_gastos_categoria ON gastos (categoria);
CREATE INDEX IF NOT EXISTS idx_gastos_data ON gastos (data);

CREATE TABLE IF NOT EXISTS orcamentos (
    id           SERIAL PRIMARY KEY,
    categoria    VARCHAR(60)    NOT NULL,
    valor_limite NUMERIC(12,2)  NOT NULL CHECK (valor_limite > 0),
    mes          INT            NOT NULL CHECK (mes BETWEEN 1 AND 12),
    ano          INT            NOT NULL CHECK (ano > 0)
);

CREATE INDEX IF NOT EXISTS idx_orcamentos_mes_ano ON orcamentos (mes, ano);

-- Usuários da API/frontend (o console acima não usa login; grava direto no banco).
CREATE TABLE IF NOT EXISTS usuarios (
    id                            SERIAL PRIMARY KEY,
    nome                          VARCHAR(150)  NOT NULL,
    email                         VARCHAR(150)  NOT NULL UNIQUE,
    senha                         VARCHAR(255)  NOT NULL,
    data_criacao                  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    token_redefinicao_senha       VARCHAR(255),
    token_redefinicao_expiracao   TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_token_redefinicao ON usuarios (token_redefinicao_senha)
    WHERE token_redefinicao_senha IS NOT NULL;

-- Nullable de propósito: gastos/orçamentos criados pelo console (acima) não têm
-- usuário. A API sempre preenche usuario_id ao criar e sempre filtra por ele.
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS usuario_id INT REFERENCES usuarios(id);
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS usuario_id INT REFERENCES usuarios(id);

CREATE INDEX IF NOT EXISTS idx_gastos_usuario ON gastos (usuario_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_usuario ON orcamentos (usuario_id);

ALTER TABLE orcamentos DROP CONSTRAINT IF EXISTS uq_orcamento_categoria_mes_ano;
ALTER TABLE orcamentos ADD CONSTRAINT uq_orcamento_usuario_categoria_mes_ano
    UNIQUE (usuario_id, categoria, mes, ano);

-- Vínculo explícito e opcional de um gasto a um orçamento (substitui a comparação
-- automática por categoria+mês). ON DELETE SET NULL: excluir um orçamento apenas
-- desvincula os gastos associados, nunca os apaga.
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS orcamento_id INT REFERENCES orcamentos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_gastos_orcamento ON gastos (orcamento_id);
