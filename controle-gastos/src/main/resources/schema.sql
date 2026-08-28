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

-- Dropa por ambos os nomes (o antigo, de antes do usuario_id, e o atual) para que
-- este script continue idempotente e possa ser reexecutado em qualquer banco.
ALTER TABLE orcamentos DROP CONSTRAINT IF EXISTS uq_orcamento_categoria_mes_ano;
ALTER TABLE orcamentos DROP CONSTRAINT IF EXISTS uq_orcamento_usuario_categoria_mes_ano;
ALTER TABLE orcamentos ADD CONSTRAINT uq_orcamento_usuario_categoria_mes_ano
    UNIQUE (usuario_id, categoria, mes, ano);

-- Vínculo explícito e opcional de um gasto a um orçamento (substitui a comparação
-- automática por categoria+mês). ON DELETE SET NULL: excluir um orçamento apenas
-- desvincula os gastos associados, nunca os apaga.
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS orcamento_id INT REFERENCES orcamentos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_gastos_orcamento ON gastos (orcamento_id);

-- Renda mensal esperada, usada para calcular a economia real (renda - gasto) nas Metas.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS renda_mensal NUMERIC(12,2);

-- Meta de economia mensal: quanto o usuário quer economizar em um mês/ano específico.
CREATE TABLE IF NOT EXISTS metas (
    id          SERIAL PRIMARY KEY,
    usuario_id  INT           NOT NULL REFERENCES usuarios(id),
    mes         INT           NOT NULL CHECK (mes BETWEEN 1 AND 12),
    ano         INT           NOT NULL CHECK (ano > 0),
    valor_meta  NUMERIC(12,2) NOT NULL CHECK (valor_meta > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_metas_usuario_mes_ano ON metas (usuario_id, mes, ano);

-- Subcategoria: campo opcional, texto livre, complementar à categoria (mesma regra
-- de "sem lista fixa" da categoria). Nullable de propósito - gastos/orçamentos
-- antigos continuam válidos sem subcategoria (orçamento "geral" da categoria).
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS subcategoria VARCHAR(60);
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS subcategoria VARCHAR(60);

CREATE INDEX IF NOT EXISTS idx_gastos_subcategoria ON gastos (subcategoria);

-- A constraint antiga (categoria, mes, ano) não permitia um orçamento "geral" da
-- categoria coexistir com um orçamento de subcategoria específica no mesmo mês.
-- Troca por um índice único por expressão: COALESCE(subcategoria, '') trata os
-- dois NULLs (dois orçamentos "gerais" da mesma categoria) como iguais entre si
-- -- ao contrário de uma UNIQUE constraint comum, em que o padrão SQL trata cada
-- NULL como distinto e permitiria duplicar orçamentos gerais sem erro nenhum.
ALTER TABLE orcamentos DROP CONSTRAINT IF EXISTS uq_orcamento_categoria_mes_ano;
ALTER TABLE orcamentos DROP CONSTRAINT IF EXISTS uq_orcamento_usuario_categoria_mes_ano;
DROP INDEX IF EXISTS uq_orcamento_usuario_categoria_mes_ano;
DROP INDEX IF EXISTS uq_orcamento_usuario_categoria_subcategoria_mes_ano;
CREATE UNIQUE INDEX uq_orcamento_usuario_categoria_subcategoria_mes_ano
    ON orcamentos (usuario_id, categoria, COALESCE(subcategoria, ''), mes, ano);

-- ============================================================================
-- Categorias e subcategorias gerenciadas (com emoji), substituindo a categoria
-- em texto livre por uma entidade selecionável em dropdown. As colunas de texto
-- "categoria"/"subcategoria" em gastos/orcamentos são mantidas (ver comentário
-- mais abaixo) só como legado/fallback - a app de console continua gravando
-- nelas diretamente, sem noção de categoria gerenciada, e nunca deve quebrar.
-- ============================================================================

CREATE TABLE IF NOT EXISTS categorias (
    id          SERIAL PRIMARY KEY,
    usuario_id  INT REFERENCES usuarios(id),  -- NULL = categoria padrão do sistema, visível a todos
    nome        VARCHAR(60) NOT NULL,
    emoji       VARCHAR(16) NOT NULL DEFAULT '📁'
);

-- COALESCE(usuario_id, 0) trata todas as categorias do sistema (usuario_id NULL)
-- como um único grupo entre si para fins de nome único - sem isso, o padrão SQL
-- trata cada NULL como distinto e permitiria duplicar nomes de categoria do
-- sistema sem erro nenhum (mesmo problema já resolvido em orçamentos).
CREATE UNIQUE INDEX IF NOT EXISTS uq_categorias_usuario_nome
    ON categorias (COALESCE(usuario_id, 0), LOWER(nome));

CREATE INDEX IF NOT EXISTS idx_categorias_usuario ON categorias (usuario_id);

INSERT INTO categorias (usuario_id, nome, emoji) VALUES
    (NULL, 'Alimentação', '🍽️'),
    (NULL, 'Transporte', '🚗'),
    (NULL, 'Moradia', '🏠'),
    (NULL, 'Saúde', '🏥'),
    (NULL, 'Educação', '📚'),
    (NULL, 'Lazer', '🎮'),
    (NULL, 'Compras', '🛍️'),
    (NULL, 'Contas e serviços', '💡'),
    (NULL, 'Outros', '📦')
ON CONFLICT (COALESCE(usuario_id, 0), LOWER(nome)) DO NOTHING;

-- Sempre pertence a um usuário (não existem subcategorias padrão do sistema) e a
-- uma categoria específica.
CREATE TABLE IF NOT EXISTS subcategorias (
    id           SERIAL PRIMARY KEY,
    categoria_id INT NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
    usuario_id   INT NOT NULL REFERENCES usuarios(id),
    nome         VARCHAR(60) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_subcategorias_usuario_categoria_nome
    ON subcategorias (usuario_id, categoria_id, LOWER(nome));

CREATE INDEX IF NOT EXISTS idx_subcategorias_categoria ON subcategorias (categoria_id);

-- Vínculo com a categoria/subcategoria gerenciada. Nullable de propósito: gastos e
-- orçamentos gravados pela app de console (sem usuario_id) nunca terão essas
-- colunas preenchidas, e continuam funcionando exibindo o texto legado.
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS categoria_id INT REFERENCES categorias(id);
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS subcategoria_id INT REFERENCES subcategorias(id);
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS categoria_id INT REFERENCES categorias(id);
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS subcategoria_id INT REFERENCES subcategorias(id);

CREATE INDEX IF NOT EXISTS idx_gastos_categoria_id ON gastos (categoria_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_categoria_id ON orcamentos (categoria_id);

-- Migração dos dados existentes: cada valor distinto de categoria/subcategoria em
-- texto livre (por usuário) vira uma categoria/subcategoria gerenciada de verdade,
-- e os gastos/orçamentos antigos são religados a ela automaticamente. Todo passo
-- abaixo só age sobre linhas ainda não migradas (categoria_id/subcategoria_id nulos),
-- então é seguro reexecutar este script em qualquer banco (idempotente).

-- Passo 1: cria uma categoria privada para cada texto de categoria de um usuário
-- que ainda não bate (sem diferenciar maiúsculas/minúsculas) com nenhuma categoria
-- já visível para ele (nem do sistema, nem uma sua já migrada em uma execução
-- anterior) - assim evita duplicar "Alimentação" quando o texto já usado bate com
-- uma categoria padrão do sistema.
INSERT INTO categorias (usuario_id, nome, emoji)
SELECT DISTINCT ON (t.usuario_id, LOWER(t.categoria)) t.usuario_id, t.categoria, '📁'
FROM (
    SELECT usuario_id, categoria FROM gastos WHERE usuario_id IS NOT NULL AND categoria_id IS NULL
    UNION
    SELECT usuario_id, categoria FROM orcamentos WHERE usuario_id IS NOT NULL AND categoria_id IS NULL
) t
WHERE NOT EXISTS (
    SELECT 1 FROM categorias c
    WHERE LOWER(c.nome) = LOWER(t.categoria) AND (c.usuario_id IS NULL OR c.usuario_id = t.usuario_id)
)
ORDER BY t.usuario_id, LOWER(t.categoria), t.categoria;

-- Passo 2: religa cada gasto/orçamento à categoria (do sistema ou recém-criada no
-- passo 1) cujo nome bate com o texto legado, sem diferenciar maiúsculas/minúsculas.
UPDATE gastos g SET categoria_id = c.id
FROM categorias c
WHERE g.usuario_id IS NOT NULL AND g.categoria_id IS NULL
  AND LOWER(c.nome) = LOWER(g.categoria) AND (c.usuario_id IS NULL OR c.usuario_id = g.usuario_id);

UPDATE orcamentos o SET categoria_id = c.id
FROM categorias c
WHERE o.usuario_id IS NOT NULL AND o.categoria_id IS NULL
  AND LOWER(c.nome) = LOWER(o.categoria) AND (c.usuario_id IS NULL OR c.usuario_id = o.usuario_id);

-- Passo 3: mesma lógica dos passos 1-2, mas para subcategoria - já em cima da
-- categoria_id resolvida acima, então nunca cria uma subcategoria "órfã".
INSERT INTO subcategorias (categoria_id, usuario_id, nome)
SELECT DISTINCT ON (t.categoria_id, t.usuario_id, LOWER(t.subcategoria)) t.categoria_id, t.usuario_id, t.subcategoria
FROM (
    SELECT categoria_id, usuario_id, subcategoria FROM gastos
        WHERE usuario_id IS NOT NULL AND categoria_id IS NOT NULL
          AND subcategoria IS NOT NULL AND subcategoria_id IS NULL
    UNION
    SELECT categoria_id, usuario_id, subcategoria FROM orcamentos
        WHERE usuario_id IS NOT NULL AND categoria_id IS NOT NULL
          AND subcategoria IS NOT NULL AND subcategoria_id IS NULL
) t
WHERE NOT EXISTS (
    SELECT 1 FROM subcategorias s
    WHERE s.categoria_id = t.categoria_id AND s.usuario_id = t.usuario_id AND LOWER(s.nome) = LOWER(t.subcategoria)
)
ORDER BY t.categoria_id, t.usuario_id, LOWER(t.subcategoria), t.subcategoria;

UPDATE gastos g SET subcategoria_id = s.id
FROM subcategorias s
WHERE g.categoria_id IS NOT NULL AND g.subcategoria IS NOT NULL AND g.subcategoria_id IS NULL
  AND s.categoria_id = g.categoria_id AND s.usuario_id = g.usuario_id AND LOWER(s.nome) = LOWER(g.subcategoria);

UPDATE orcamentos o SET subcategoria_id = s.id
FROM subcategorias s
WHERE o.categoria_id IS NOT NULL AND o.subcategoria IS NOT NULL AND o.subcategoria_id IS NULL
  AND s.categoria_id = o.categoria_id AND s.usuario_id = o.usuario_id AND LOWER(s.nome) = LOWER(o.subcategoria);

-- A checagem de duplicidade de orçamento (geral vs. específico) agora é feita por
-- categoria_id/subcategoria_id, não mais pelo texto - substitui o índice único
-- baseado em texto por um equivalente baseado em ID (mesmo critério de COALESCE).
DROP INDEX IF EXISTS uq_orcamento_usuario_categoria_subcategoria_mes_ano;
CREATE UNIQUE INDEX uq_orcamento_usuario_categoria_subcategoria_mes_ano
    ON orcamentos (usuario_id, categoria_id, COALESCE(subcategoria_id, 0), mes, ano);
