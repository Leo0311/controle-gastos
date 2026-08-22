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
    ano          INT            NOT NULL CHECK (ano > 0),
    CONSTRAINT uq_orcamento_categoria_mes_ano UNIQUE (categoria, mes, ano)
);

CREATE INDEX IF NOT EXISTS idx_orcamentos_mes_ano ON orcamentos (mes, ano);
