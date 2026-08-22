# Controle de Gastos

Sistema de controle de gastos pessoais composto por três aplicações independentes que compartilham o mesmo banco de dados PostgreSQL: uma aplicação de console em Java, uma API REST em Spring Boot e um frontend web em Angular.

## Estrutura do repositório

```
controle-gastos/            (raiz do repositório)
├── controle-gastos/         # Aplicação de console em Java (Maven), acesso direto ao banco via JDBC
├── controle-gastos-api/     # API REST em Spring Boot, mapeando as mesmas tabelas via JPA
└── controle-gastos-web/     # Frontend em Angular 18 + Angular Material, consumindo a API REST
```

- **`controle-gastos/`** — aplicação de linha de comando (menu interativo) para cadastrar e consultar gastos e orçamentos diretamente no PostgreSQL, sem depender da API.
- **`controle-gastos-api/`** — API REST (Java 17 + Spring Boot) que expõe os mesmos dados via HTTP/JSON, usada pelo frontend Angular.
- **`controle-gastos-web/`** — SPA em Angular que consome a API para oferecer telas de Dashboard, Gastos e Orçamentos.

## Funcionalidades

- Cadastro, edição e exclusão de gastos (descrição, valor, categoria, data)
- Listagem de gastos por categoria, período ou mês/ano
- Definição de orçamento por categoria/mês, com alerta visual quando o gasto ultrapassa o valor orçado
- Dashboard com cards de totais (mês/ano atual) e gráficos (distribuição por categoria e evolução dos últimos meses)
- Exportação de gastos para CSV
- Exportação de um modelo `.xlsx` para importação e importação de planilha de gastos, com revisão e validação linha a linha antes de confirmar

## Tecnologias

- **Backend**: Java 17, Maven, Spring Boot (API REST), Spring Data JPA, JDBC puro (console)
- **Banco de dados**: PostgreSQL
- **Frontend**: Angular 18, Angular Material, Chart.js/ng2-charts (gráficos), xlsx-js-style (exportação/importação de planilhas)

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

Depois, conectado a esse banco, rode o script `controle-gastos/src/main/resources/schema.sql`, que cria as tabelas `gastos` e `orcamentos`.

## Como rodar cada parte

### 1. Console (`controle-gastos/`)

Copie `src/main/resources/database.properties.example` para `database.properties` e ajuste usuário/senha do PostgreSQL. Depois:

```bash
cd controle-gastos
mvn clean compile exec:java
```

Mais detalhes em [`controle-gastos/README.md`](controle-gastos/README.md).

### 2. API REST (`controle-gastos-api/`)

Copie `src/main/resources/application.properties.example` para `application.properties` e ajuste usuário/senha do PostgreSQL. Depois:

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
