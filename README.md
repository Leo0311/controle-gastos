# Controle de Gastos

Sistema de controle de gastos pessoais com autenticação, categorias e subcategorias geridas (com emoji), orçamentos vinculados aos gastos, metas de economia mensais e dashboard com gráficos. Composto por três aplicações que compartilham o mesmo banco PostgreSQL: uma aplicação de console em Java, uma API REST em Spring Boot e um frontend web em Angular.

## Produção

- **Frontend**: https://controle-gastos-web-v8wf.onrender.com
- **API**: https://controle-gastos-api-cfr4.onrender.com/api

Hospedados no [Render](https://render.com) (frontend como Static Site via Blueprint em `render.yaml`, API como Web Service via Docker); banco PostgreSQL gerenciado pelo [Neon](https://neon.tech).

## Estrutura do repositório

```
controle-gastos/            (raiz do repositório)
├── controle-gastos/         # Aplicação de console em Java (Maven), acesso direto ao banco via JDBC
├── controle-gastos-api/     # API REST em Spring Boot, com autenticação JWT
└── controle-gastos-web/     # Frontend em Angular 18 + Angular Material, consumindo a API REST
```

- **`controle-gastos/`** — aplicação de linha de comando (menu interativo) para cadastrar e consultar gastos e orçamentos diretamente no PostgreSQL, sem depender da API.
- **`controle-gastos-api/`** — API REST (Java 17 + Spring Boot) com autenticação JWT, usada pelo frontend Angular.
- **`controle-gastos-web/`** — SPA em Angular que consome a API para oferecer telas de Login/Cadastro, Dashboard, Gastos, Orçamentos e Categorias, responsiva em mobile.

## Funcionalidades

### Autenticação
Cadastro e login com senha (hash no banco), sessão persistida em `localStorage` (sobrevive a F5 e a fechar/reabrir a aba) com token JWT válido por 6 horas, logout automático quando o token expira, e recuperação de senha por e-mail (link com token válido por 1 hora).

### Categorias e subcategorias
Categoria e subcategoria são entidades geridas (não mais texto livre), cada categoria com um emoji, escolhidas via dropdown nos formulários de gasto e orçamento. Existem **categorias padrão do sistema** (Alimentação, Transporte, Moradia, Saúde, Educação, Lazer, Compras, Contas e serviços, Outros — visíveis para todos os usuários, fixas) e **categorias personalizadas** (criadas por cada usuário, privadas — só quem criou vê e pode editar/excluir). Subcategoria é sempre filha de uma categoria específica e sempre personalizada (não há subcategorias padrão do sistema). Dá para criar uma categoria ou subcategoria nova sem sair do formulário de gasto/orçamento (opção "+ Nova..." no fim do dropdown, com um mini-diálogo de nome + emoji), além de uma tela dedicada **Gerenciar Categorias** para editar/excluir as próprias e organizar as subcategorias de cada uma. Uma categoria ou subcategoria em uso em algum gasto ou orçamento não pode ser excluída.

### Gastos
CRUD completo (descrição, valor, categoria, subcategoria opcional, data), listagem por categoria/período/mês, exportação e importação em lote via planilha `.xlsx` (ver abaixo). Cada gasto pode ser vinculado a um orçamento do mês/categoria (ou categoria+subcategoria) correspondente.

### Orçamentos
Limite de valor por categoria e mês/ano, com edição. A subcategoria é opcional: um orçamento pode ser **geral** (sem subcategoria, cobrindo a categoria inteira) ou **específico** de uma subcategoria — os dois podem coexistir no mesmo mês para a mesma categoria (ex: um orçamento geral de "Lazer" e outro só para "Lazer/Cinema"), sem conflito. Um gasto vinculado ao orçamento específico de uma subcategoria conta só para ele, nunca para o orçamento geral da categoria. O uso de cada orçamento (soma dos gastos vinculados a ele) é classificado em 4 status, exibidos com barra de progresso colorida: **OK** (< 80%), **Atenção** (80–99%), **Completo** (exatamente 100%) e **Ultrapassou** (> 100%).

### Metas de economia
No Dashboard, o usuário define uma renda mensal e uma meta de economia (valor que deseja ter sobrando no fim do mês). O app calcula `renda − total gasto no mês = economia projetada` e compara com a meta, mostrando o progresso numa barra colorida (verde/amarelo/vermelho) que leva em conta quantos dias do mês já passaram.

### Dashboard
Cards de totais do mês/ano selecionado, gráfico de pizza (distribuição por categoria) e gráfico de barras (evolução dos últimos 6 meses) — ambos clicáveis, abrindo o detalhamento dos gastos do período/categoria selecionado.

### Exportação e importação de planilhas (.xlsx)
Exportação de todos os gastos para `.xlsx` (incluindo a coluna Subcategoria), download de um modelo de planilha para importação, e um fluxo guiado de importação que revisa cada linha, detecta duplicatas e possíveis edições de gastos já cadastrados, e sugere automaticamente o vínculo com orçamentos existentes (priorizando o orçamento específico da subcategoria da linha, com o geral da categoria como alternativa) antes de confirmar a gravação em lote. Categoria e subcategoria na planilha continuam sendo texto simples (sem emoji): ao importar, cada texto é resolvido contra as categorias/subcategorias já existentes do usuário (sem diferenciar maiúsculas/minúsculas) e, se não houver uma correspondente, uma categoria/subcategoria privada nova é criada automaticamente (com emoji padrão, editável depois em "Gerenciar Categorias"). Planilhas antigas, de antes da coluna Subcategoria existir, continuam sendo importadas normalmente.

### Campos de valor monetário
Todos os campos de valor (Valor do gasto, Valor Limite do orçamento, Renda mensal, Meta de economia) usam uma máscara de digitação estilo "caixa registradora": os dígitos entram da direita para a esquerda (centavos primeiro), com suporte completo a Backspace, seleção de texto e colar — funcionando de forma idêntica em desktop e mobile.

## Tecnologias

- **Backend**: Java 17, Maven, Spring Boot 4, Spring Data JPA, Spring Security + JWT (jjwt), Spring Mail
- **Banco de dados**: PostgreSQL (Neon em produção)
- **Frontend**: Angular 18 (standalone components), Angular Material, Chart.js/ng2-charts (gráficos), xlsx-js-style (exportação/importação de planilhas)
- **Deploy**: Render (frontend como Static Site, API como Web Service via Docker)

## Pré-requisitos

- Java 17+
- Maven 3.8+ (ou o wrapper `mvnw` incluso em `controle-gastos-api/`)
- Node.js 18+ e npm
- PostgreSQL 13+

## Banco de dados

As três partes usam o mesmo banco `controle_gastos`. Crie o banco:

```sql
CREATE DATABASE controle_gastos;
```

Depois, conectado a esse banco, rode o script `controle-gastos/src/main/resources/schema.sql`, que cria as tabelas usadas pela aplicação (`usuarios`, `gastos`, `orcamentos`, `metas`, `categorias`, `subcategorias`, etc.) e, se já houver dados de uma versão anterior à existência de categorias geridas, migra automaticamente a categoria/subcategoria em texto livre de cada gasto/orçamento para uma categoria/subcategoria gerida correspondente.

## Como rodar cada parte localmente

### 1. Console (`controle-gastos/`)

Copie `src/main/resources/database.properties.example` para `database.properties` e ajuste usuário/senha do PostgreSQL. Depois:

```bash
cd controle-gastos
mvn clean compile exec:java
```

Mais detalhes em [`controle-gastos/README.md`](controle-gastos/README.md).

### 2. API REST (`controle-gastos-api/`)

Copie `src/main/resources/application.properties.example` para `application.properties` e ajuste: usuário/senha do PostgreSQL, um segredo JWT (`app.jwt.secret`) e as credenciais SMTP usadas para o e-mail de recuperação de senha (`spring.mail.*` — o arquivo de exemplo tem instruções para gerar ambos). Depois:

```bash
cd controle-gastos-api
mvn spring-boot:run
```

A API sobe em `http://localhost:8080/api` (CORS liberado para `http://localhost:4200`).

### 3. Frontend (`controle-gastos-web/`)

Requer a API rodando em paralelo.

```bash
cd controle-gastos-web
npm install
ng serve
```

Acesse em `http://localhost:4200`.

### Ordem recomendada para rodar tudo

1. PostgreSQL no ar, com o banco e as tabelas criadas (`schema.sql`)
2. API (`controle-gastos-api`) — porta 8080
3. Frontend (`controle-gastos-web`) — porta 4200

O console (`controle-gastos`) é independente e pode ser executado sem a API ou o frontend, desde que o banco esteja disponível.
