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

-- ============================================================================
-- Gastos recorrentes: lançamento automático de um gasto fixo (aluguel,
-- assinatura etc.) todo mês, no dia configurado, sem precisar cadastrar
-- manualmente. Não existe cron job no Render free tier (o serviço "dorme"),
-- então o lançamento dos pendentes é verificado sob demanda a partir do
-- frontend (ao abrir Dashboard/Gastos) - ver GastoRecorrenteService.
-- ============================================================================

CREATE TABLE IF NOT EXISTS gastos_recorrentes (
    id              SERIAL PRIMARY KEY,
    usuario_id      INT NOT NULL REFERENCES usuarios(id),
    descricao       VARCHAR(150) NOT NULL,
    valor           NUMERIC(12,2) NOT NULL CHECK (valor > 0),
    categoria_id    INT NOT NULL REFERENCES categorias(id),
    subcategoria_id INT REFERENCES subcategorias(id),
    -- Dia do mês em que o gasto deve ser lançado. Em meses com menos dias que o
    -- configurado (ex: 31 em fevereiro), o lançamento cai no último dia válido do
    -- mês - ver GastoRecorrenteService.dataDoLancamento.
    dia_do_mes      INT NOT NULL CHECK (dia_do_mes BETWEEN 1 AND 31),
    orcamento_id    INT REFERENCES orcamentos(id) ON DELETE SET NULL,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    data_criacao    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gastos_recorrentes_usuario ON gastos_recorrentes (usuario_id);

-- Rastreia qual gasto foi lançado automaticamente a partir de qual recorrência -
-- usado tanto pra evitar duplicar o lançamento do mesmo mês (checando se já existe
-- um gasto com esse gasto_recorrente_id no mês atual) quanto pra indicar na tela de
-- Gastos quais lançamentos são automáticos. ON DELETE SET NULL: excluir a
-- recorrência nunca apaga nem desfigura gastos já lançados, só desvincula (perdem
-- só a indicação visual de "gerado automaticamente").
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS gasto_recorrente_id INT REFERENCES gastos_recorrentes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_gastos_gasto_recorrente ON gastos (gasto_recorrente_id);

-- ============================================================================
-- Compras parceladas: ao cadastrar, gera IMEDIATAMENTE todas as parcelas como
-- gastos individuais, uma por mês consecutivo a partir do mês atual, no dia
-- configurado (mesmo clamping de dia inválido em meses curtos usado nos gastos
-- recorrentes). Diferente de gastos recorrentes: não há lançamento sob demanda -
-- tudo é gerado de uma vez no cadastro. Cancelar marca a compra como inativa
-- (histórico preservado, nunca reativa) e remove só as parcelas com data futura
-- (ainda não vencidas) - ver CompraParceladaService.
-- ============================================================================

CREATE TABLE IF NOT EXISTS compras_parceladas (
    id              SERIAL PRIMARY KEY,
    usuario_id      INT NOT NULL REFERENCES usuarios(id),
    descricao       VARCHAR(150) NOT NULL,
    valor_total     NUMERIC(12,2) NOT NULL CHECK (valor_total > 0),
    numero_parcelas INT NOT NULL CHECK (numero_parcelas BETWEEN 2 AND 60),
    categoria_id    INT NOT NULL REFERENCES categorias(id),
    subcategoria_id INT REFERENCES subcategorias(id),
    orcamento_id    INT REFERENCES orcamentos(id) ON DELETE SET NULL,
    -- Mesmo significado/clamping de gastos_recorrentes.dia_do_mes.
    dia_do_mes      INT NOT NULL CHECK (dia_do_mes BETWEEN 1 AND 31),
    ativa           BOOLEAN NOT NULL DEFAULT TRUE,
    data_criacao    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_compras_parceladas_usuario ON compras_parceladas (usuario_id);

-- Rastreia qual gasto é a parcela de qual compra parcelada - usado pra indicar na
-- tela de Gastos quais lançamentos são parcelas (badge "i/N") e pra excluir só as
-- parcelas futuras ao cancelar a compra (ver CompraParceladaService.excluir).
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS compra_parcelada_id INT REFERENCES compras_parceladas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_gastos_compra_parcelada ON gastos (compra_parcelada_id);

-- Migração: excluir já foi corrigido para remover a compra parcelada de verdade em
-- vez de só marcar "ativa = FALSE" (que deixava um estado "cancelada" fantasma pra
-- sempre na listagem) - limpa qualquer registro já cancelado dessa forma antes da
-- correção. A FK acima (ON DELETE SET NULL) preserva as parcelas passadas já
-- lançadas, só desvinculando-as. Idempotente: não há mais nada a apagar depois da
-- primeira execução, já que excluir() nunca mais grava ativa = FALSE.
DELETE FROM compras_parceladas WHERE ativa = FALSE;

-- ============================================================================
-- Expansão das categorias/subcategorias padrão do sistema: além das
-- subcategorias que o próprio usuário já criava (sempre pessoais, ligadas ao
-- seu usuario_id), agora também existem subcategorias padrão do sistema
-- (usuario_id NULL, visíveis a todos - mesmo padrão já usado em categorias) e
-- cada subcategoria (padrão ou pessoal) ganha um emoji próprio, igual às
-- categorias. Nenhuma subcategoria/categoria pessoal já existente é alterada
-- ou removida por esta migração.
-- ============================================================================

-- DROP NOT NULL e ADD COLUMN são idempotentes (seguros de rodar de novo num
-- banco já migrado). Subcategorias pessoais já existentes ganham o emoji
-- padrão 📁 (mesmo default usado em categorias pessoais novas sem emoji
-- escolhido) - continuam intactas e vinculadas do jeito que já estavam.
ALTER TABLE subcategorias ALTER COLUMN usuario_id DROP NOT NULL;
ALTER TABLE subcategorias ADD COLUMN IF NOT EXISTS emoji VARCHAR(16) NOT NULL DEFAULT '📁';

-- O índice único original não tratava usuario_id NULL como um grupo único
-- entre si (cada NULL é distinto pro Postgres por padrão) - sem esse ajuste,
-- o ON CONFLICT dos INSERTs de subcategoria padrão abaixo nunca detectaria uma
-- já existente, duplicando a cada vez que este script rodasse. Mesmo problema
-- (e solução) já aplicado ao índice de categorias mais acima.
DROP INDEX IF EXISTS uq_subcategorias_usuario_categoria_nome;
CREATE UNIQUE INDEX IF NOT EXISTS uq_subcategorias_usuario_categoria_nome
    ON subcategorias (COALESCE(usuario_id, 0), categoria_id, LOWER(nome));

-- Categorias novas do sistema (mesmo padrão idempotente do INSERT original de
-- categorias, lá em cima) - "Contas e serviços" já existia, por isso não
-- aparece aqui de novo, só ganha subcategorias novas abaixo.
INSERT INTO categorias (usuario_id, nome, emoji) VALUES
    (NULL, 'Trabalho', '💼'),
    (NULL, 'Viagens', '✈️')
ON CONFLICT (COALESCE(usuario_id, 0), LOWER(nome)) DO NOTHING;

-- Subcategorias padrão do sistema, complementando as categorias já existentes
-- e preenchendo as categorias novas acima - um INSERT por categoria alvo,
-- localizada pelo nome (o id é um SERIAL, não é previsível). Idempotente via
-- ON CONFLICT: rodar este script de novo nunca duplica nem falha.
INSERT INTO subcategorias (categoria_id, usuario_id, nome, emoji)
SELECT c.id, NULL, v.nome, v.emoji
FROM categorias c
CROSS JOIN (VALUES
    ('Cafés e lanches', '☕'),
    ('Bebidas', '🥤')
) AS v(nome, emoji)
WHERE c.usuario_id IS NULL AND LOWER(c.nome) = LOWER('Alimentação')
ON CONFLICT (COALESCE(usuario_id, 0), categoria_id, LOWER(nome)) DO NOTHING;

INSERT INTO subcategorias (categoria_id, usuario_id, nome, emoji)
SELECT c.id, NULL, v.nome, v.emoji
FROM categorias c
CROSS JOIN (VALUES
    ('Móveis', '🪑'),
    ('Eletrodomésticos', '📺'),
    ('Produtos de limpeza', '🧹'),
    ('IPTU', '🏠')
) AS v(nome, emoji)
WHERE c.usuario_id IS NULL AND LOWER(c.nome) = LOWER('Moradia')
ON CONFLICT (COALESCE(usuario_id, 0), categoria_id, LOWER(nome)) DO NOTHING;

INSERT INTO subcategorias (categoria_id, usuario_id, nome, emoji)
SELECT c.id, NULL, v.nome, v.emoji
FROM categorias c
CROSS JOIN (VALUES
    ('Pneus', '🛞'),
    ('Seguro', '🛡️'),
    ('IPVA', '📄'),
    ('Licenciamento', '🚘'),
    ('Lavagem', '🚿')
) AS v(nome, emoji)
WHERE c.usuario_id IS NULL AND LOWER(c.nome) = LOWER('Transporte')
ON CONFLICT (COALESCE(usuario_id, 0), categoria_id, LOWER(nome)) DO NOTHING;

INSERT INTO subcategorias (categoria_id, usuario_id, nome, emoji)
SELECT c.id, NULL, v.nome, v.emoji
FROM categorias c
CROSS JOIN (VALUES
    ('Dentista', '🦷'),
    ('Óculos', '👓')
) AS v(nome, emoji)
WHERE c.usuario_id IS NULL AND LOWER(c.nome) = LOWER('Saúde')
ON CONFLICT (COALESCE(usuario_id, 0), categoria_id, LOWER(nome)) DO NOTHING;

INSERT INTO subcategorias (categoria_id, usuario_id, nome, emoji)
SELECT c.id, NULL, v.nome, v.emoji
FROM categorias c
CROSS JOIN (VALUES
    ('Faculdade', '🎓'),
    ('Certificações', '📝'),
    ('Idiomas', '🌎')
) AS v(nome, emoji)
WHERE c.usuario_id IS NULL AND LOWER(c.nome) = LOWER('Educação')
ON CONFLICT (COALESCE(usuario_id, 0), categoria_id, LOWER(nome)) DO NOTHING;

INSERT INTO subcategorias (categoria_id, usuario_id, nome, emoji)
SELECT c.id, NULL, v.nome, v.emoji
FROM categorias c
CROSS JOIN (VALUES
    ('Shows', '🎵'),
    ('Hobbies', '🎨'),
    ('Passeios', '🏖️'),
    ('Bares', '🍻'),
    ('Esportes', '⚽'),
    ('Eventos', '🎟️')
) AS v(nome, emoji)
WHERE c.usuario_id IS NULL AND LOWER(c.nome) = LOWER('Lazer')
ON CONFLICT (COALESCE(usuario_id, 0), categoria_id, LOWER(nome)) DO NOTHING;

INSERT INTO subcategorias (categoria_id, usuario_id, nome, emoji)
SELECT c.id, NULL, v.nome, v.emoji
FROM categorias c
CROSS JOIN (VALUES
    ('Calçados', '👟'),
    ('Casa', '🪑'),
    ('Cosméticos', '💄')
) AS v(nome, emoji)
WHERE c.usuario_id IS NULL AND LOWER(c.nome) = LOWER('Compras')
ON CONFLICT (COALESCE(usuario_id, 0), categoria_id, LOWER(nome)) DO NOTHING;

INSERT INTO subcategorias (categoria_id, usuario_id, nome, emoji)
SELECT c.id, NULL, v.nome, v.emoji
FROM categorias c
CROSS JOIN (VALUES
    ('Internet', '🌐'),
    ('Celular', '📱'),
    ('TV', '📺'),
    ('Streaming', '🎬'),
    ('Serviços online', '☁️'),
    ('Outros serviços', '🧾')
) AS v(nome, emoji)
WHERE c.usuario_id IS NULL AND LOWER(c.nome) = LOWER('Contas e serviços')
ON CONFLICT (COALESCE(usuario_id, 0), categoria_id, LOWER(nome)) DO NOTHING;

INSERT INTO subcategorias (categoria_id, usuario_id, nome, emoji)
SELECT c.id, NULL, v.nome, v.emoji
FROM categorias c
CROSS JOIN (VALUES
    ('Alimentação no trabalho', '🍽️'),
    ('Transporte', '🚗'),
    ('Roupas profissionais', '👔'),
    ('Equipamentos', '💻'),
    ('Cursos', '📚'),
    ('Coworking', '🏢'),
    ('Materiais', '💼')
) AS v(nome, emoji)
WHERE c.usuario_id IS NULL AND LOWER(c.nome) = LOWER('Trabalho')
ON CONFLICT (COALESCE(usuario_id, 0), categoria_id, LOWER(nome)) DO NOTHING;

INSERT INTO subcategorias (categoria_id, usuario_id, nome, emoji)
SELECT c.id, NULL, v.nome, v.emoji
FROM categorias c
CROSS JOIN (VALUES
    ('Passagens', '✈️'),
    ('Hospedagem', '🏨'),
    ('Alimentação', '🍽️'),
    ('Transporte', '🚗'),
    ('Passeios', '🎟️'),
    ('Compras', '🛍️'),
    ('Outros', '🧳')
) AS v(nome, emoji)
WHERE c.usuario_id IS NULL AND LOWER(c.nome) = LOWER('Viagens')
ON CONFLICT (COALESCE(usuario_id, 0), categoria_id, LOWER(nome)) DO NOTHING;

-- "Finanças"/"Financeiro" nunca foi uma categoria padrão do sistema - é uma
-- categoria PESSOAL que o usuário já usa. Em vez de criar uma categoria de
-- sistema redundante com esse nome (categoria de sistema e pessoal com o
-- mesmo nome coexistiriam sem conflito - o índice único é por dono - só que
-- apareceriam duplicadas na tela), esta migração complementa a categoria
-- pessoal já existente (de qualquer usuário, localizada pelo nome) com as
-- subcategorias que ainda faltam, preservando as que já existirem (ex:
-- Investimentos, Taxas bancárias) - nunca duplica, nunca remove.
INSERT INTO subcategorias (categoria_id, usuario_id, nome, emoji)
SELECT c.id, c.usuario_id, v.nome, v.emoji
FROM categorias c
CROSS JOIN (VALUES
    ('Fatura do cartão', '💳'),
    ('Empréstimos', '📉'),
    ('Financiamentos', '💸'),
    ('Transferências', '🔄'),
    ('Saques', '💵')
) AS v(nome, emoji)
WHERE c.usuario_id IS NOT NULL AND LOWER(c.nome) IN ('finanças', 'financeiro')
ON CONFLICT (COALESCE(usuario_id, 0), categoria_id, LOWER(nome)) DO NOTHING;

-- ============================================================================
-- Segunda leva de subcategorias padrão do sistema, complementando as
-- categorias que já receberam a primeira leva acima - preenche as lacunas
-- identificadas numa auditoria comparando o que já existia contra uma lista
-- de referência mais completa. Emojis de categoria (Alimentação, Saúde etc.)
-- não são alterados aqui, só subcategorias novas são adicionadas. "Manutenção"
-- aparece em Moradia (🛠️) e Transporte (🔧) como itens distintos - sem
-- conflito, já que o nome só precisa ser único dentro da mesma categoria.
-- ============================================================================

INSERT INTO subcategorias (categoria_id, usuario_id, nome, emoji)
SELECT c.id, NULL, v.nome, v.emoji
FROM categorias c
CROSS JOIN (VALUES
    ('Mercado', '🛒'),
    ('Restaurantes', '🍽️'),
    ('Delivery', '🛵'),
    ('Padaria', '🥖')
) AS v(nome, emoji)
WHERE c.usuario_id IS NULL AND LOWER(c.nome) = LOWER('Alimentação')
ON CONFLICT (COALESCE(usuario_id, 0), categoria_id, LOWER(nome)) DO NOTHING;

INSERT INTO subcategorias (categoria_id, usuario_id, nome, emoji)
SELECT c.id, NULL, v.nome, v.emoji
FROM categorias c
CROSS JOIN (VALUES
    ('Aluguel', '🏡'),
    ('Condomínio', '🏢'),
    ('Energia elétrica', '💡'),
    ('Água', '💧'),
    ('Gás', '🔥'),
    ('Manutenção', '🛠️')
) AS v(nome, emoji)
WHERE c.usuario_id IS NULL AND LOWER(c.nome) = LOWER('Moradia')
ON CONFLICT (COALESCE(usuario_id, 0), categoria_id, LOWER(nome)) DO NOTHING;

INSERT INTO subcategorias (categoria_id, usuario_id, nome, emoji)
SELECT c.id, NULL, v.nome, v.emoji
FROM categorias c
CROSS JOIN (VALUES
    ('Combustível', '⛽'),
    ('Uber/Táxi', '🚕'),
    ('Transporte público', '🚌'),
    ('Estacionamento', '🅿️'),
    ('Manutenção', '🔧')
) AS v(nome, emoji)
WHERE c.usuario_id IS NULL AND LOWER(c.nome) = LOWER('Transporte')
ON CONFLICT (COALESCE(usuario_id, 0), categoria_id, LOWER(nome)) DO NOTHING;

INSERT INTO subcategorias (categoria_id, usuario_id, nome, emoji)
SELECT c.id, NULL, v.nome, v.emoji
FROM categorias c
CROSS JOIN (VALUES
    ('Tarifas bancárias', '💳')
) AS v(nome, emoji)
WHERE c.usuario_id IS NULL AND LOWER(c.nome) = LOWER('Contas e serviços')
ON CONFLICT (COALESCE(usuario_id, 0), categoria_id, LOWER(nome)) DO NOTHING;

INSERT INTO subcategorias (categoria_id, usuario_id, nome, emoji)
SELECT c.id, NULL, v.nome, v.emoji
FROM categorias c
CROSS JOIN (VALUES
    ('Roupas', '👕'),
    ('Eletrônicos', '📱'),
    ('Presentes', '🎁'),
    ('Outros', '🛒')
) AS v(nome, emoji)
WHERE c.usuario_id IS NULL AND LOWER(c.nome) = LOWER('Compras')
ON CONFLICT (COALESCE(usuario_id, 0), categoria_id, LOWER(nome)) DO NOTHING;

INSERT INTO subcategorias (categoria_id, usuario_id, nome, emoji)
SELECT c.id, NULL, v.nome, v.emoji
FROM categorias c
CROSS JOIN (VALUES
    ('Consultas', '🏥'),
    ('Medicamentos', '💊'),
    ('Exames', '🧪'),
    ('Academia', '🏋️'),
    ('Plano de saúde', '🩺')
) AS v(nome, emoji)
WHERE c.usuario_id IS NULL AND LOWER(c.nome) = LOWER('Saúde')
ON CONFLICT (COALESCE(usuario_id, 0), categoria_id, LOWER(nome)) DO NOTHING;

INSERT INTO subcategorias (categoria_id, usuario_id, nome, emoji)
SELECT c.id, NULL, v.nome, v.emoji
FROM categorias c
CROSS JOIN (VALUES
    ('Escola', '🏫'),
    ('Cursos', '💻'),
    ('Livros', '📖'),
    ('Material escolar', '✏️')
) AS v(nome, emoji)
WHERE c.usuario_id IS NULL AND LOWER(c.nome) = LOWER('Educação')
ON CONFLICT (COALESCE(usuario_id, 0), categoria_id, LOWER(nome)) DO NOTHING;

INSERT INTO subcategorias (categoria_id, usuario_id, nome, emoji)
SELECT c.id, NULL, v.nome, v.emoji
FROM categorias c
CROSS JOIN (VALUES
    ('Cinema', '🎬'),
    ('Jogos', '🎮')
) AS v(nome, emoji)
WHERE c.usuario_id IS NULL AND LOWER(c.nome) = LOWER('Lazer')
ON CONFLICT (COALESCE(usuario_id, 0), categoria_id, LOWER(nome)) DO NOTHING;

-- ============================================================================
-- Reordenação manual de categorias: como categorias padrão do sistema são
-- compartilhadas entre todos os usuários (usuario_id NULL), a ordem escolhida
-- por um usuário não pode afetar a visão de outros - cada usuário tem sua
-- própria preferência de ordem, guardada aqui. Só existe uma linha por
-- categoria visível para o usuário DEPOIS que ele mexe pela primeira vez
-- (mover uma categoria materializa a posição de todas as categorias visíveis
-- naquele momento - ver CategoriaService.mover); enquanto o usuário nunca
-- personalizou nada, não há linha nenhuma aqui e a ordem cai no padrão
-- (sistema primeiro, depois pessoais, cada grupo em ordem alfabética).
-- ON DELETE CASCADE em categoria_id: excluir uma categoria pessoal (a
-- categoria só pode ser excluída pelo próprio dono, e só se não estiver em
-- uso - ver CategoriaService.excluir) remove automaticamente a preferência de
-- posição dela, sem deixar linha órfã apontando pra uma categoria inexistente.
-- ============================================================================
CREATE TABLE IF NOT EXISTS categorias_ordem_usuario (
    id           SERIAL PRIMARY KEY,
    usuario_id   INT NOT NULL REFERENCES usuarios(id),
    categoria_id INT NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
    posicao      INT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_categorias_ordem_usuario ON categorias_ordem_usuario (usuario_id, categoria_id);
CREATE INDEX IF NOT EXISTS idx_categorias_ordem_usuario_usuario ON categorias_ordem_usuario (usuario_id);

-- ============================================================================
-- Revogação de JWT ao trocar a senha: cada usuário tem uma "versão de token"
-- que é embutida no JWT no login e reconferida a cada requisição pela API.
-- Redefinir a senha (via link de e-mail) incrementa esse valor, invalidando
-- na hora qualquer token emitido antes - um token roubado deixa de funcionar
-- assim que a vítima troca a senha, sem esperar a expiração de 6h.
-- DEFAULT 0 + NOT NULL: usuários já existentes assumem a versão 0 (a mesma que
-- vai nos tokens já emitidos, tratados como versão 0 pela API), então aplicar
-- esta migração não desloga ninguém que esteja logado.
-- ============================================================================
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0;
