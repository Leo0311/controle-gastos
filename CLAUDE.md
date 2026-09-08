# Controle de Gastos — Instruções do Projeto

Monorepo com três apps que compartilham um PostgreSQL: `controle-gastos/` (console
Java, legado/congelado), `controle-gastos-api/` (API Spring Boot 4, Java 17, :8080) e
`controle-gastos-web/` (Angular 18 + Material, :4200). Em produção: frontend no Render
(Static Site, auto-deploy no push), API numa VM da Oracle Cloud (systemd; deploy
automático por GitHub Actions no push que toque em `controle-gastos-api/` — ver abaixo),
banco no Neon.

## Vale para qualquer tarefa

- **`git push` na `master` publica o frontend na hora** — Render Static Site, sem
  staging nem PR.
- **A API sobe por GitHub Actions** (`.github/workflows/deploy-api.yml`), no push na
  `master` que toque `controle-gastos-api/**` (ou `schema.sql`, ou o próprio workflow —
  push só de frontend/README não roda nada). Dois jobs: **`migration-guard`** roda a
  suíte com o Flyway ativo contra um Postgres descartável em dois cenários (banco vazio
  e banco com o `schema.sql` atual); **só se ele passar**, **`deploy`** faz SSH na VM →
  `git pull --ff-only` + `./mvnw clean package -DskipTests` + `sudo systemctl restart
  controle-gastos` → checa `GET /api/health` pela URL pública (se não voltar
  `{"status":"UP"}` em ~2min o workflow **falha** e o GitHub manda e-mail). Migration
  ruim para no `migration-guard` e nem chega na VM. Fallback manual na VM (se o
  workflow falhar): os mesmos três comandos, na raiz do repo.
- **Mudança de schema = migration do Flyway, aplicada sozinha no deploy.** Crie um novo
  `controle-gastos-api/src/main/resources/db/migration/V{próximo número}__descricao.sql`
  + o `@Column` correspondente na entidade, no mesmo commit; commite e dê push. O
  `migration-guard` valida a migration; no `systemctl restart` o Flyway aplica as
  pendentes no Neon **antes** do `ddl-auto=validate`. **Não existe mais passo manual no
  SQL Editor do Neon.** Nunca edite um `V-n` já aplicado — sempre um arquivo novo
  (`V1__baseline.sql` já reflete o schema atual). Migration nova não precisa ser
  idempotente. Antes de um push que envolva schema, migração de dados ou mexida em
  auth, diga o que vai ao ar e confirme. Ver skill `banco-schema`.
- **Nunca use `Stop-Process` por nome ou regex** (`java`, `node`, …) — já matou a shell
  da própria sessão e os JVMs dos testes. Mate pelo dono da porta (skill `ambiente-local`).
- **Não atualize dependências reativamente.** Nada de `npm audit fix --force`,
  `ng update` ou bump de major sem uma tarefa dedicada. O Angular está no 18.2 de
  propósito; a maioria das vulnerabilidades do `npm audit` é do toolchain de build.
- **Repositório público: nunca escreva senha, token ou connection string em arquivo
  versionado nem no chat.** Use placeholder e peça o valor ao usuário na hora.
  Credencial em texto puro em lugar versionado → avise para rotacionar.
- **Commits:** direto na `master` (sem PR), mensagem em português, presente, dizendo o
  quê + porquê. Quando a mudança for visível ao usuário, atualize a seção relevante do
  `README.md` (doc de usuário, por feature) no mesmo commit.
- A ferramenta Bash abre em `…\controle-gastos\controle-gastos\` (o módulo console),
  não na raiz do repo — `git` e os arquivos da raiz precisam de `../` ou caminho absoluto.

## Skills — leia a que casar com a tarefa

- **`backend-api`** — editar qualquer `.java` em `controle-gastos-api/`.
- **`frontend-angular`** — editar código em `controle-gastos-web/src/app/`. Decisão
  visual é `anti-ui-slop`, não essa.
- **`banco-schema`** — migration nova (`controle-gastos-api/src/main/resources/db/migration/V*.sql`),
  mudança em `schema.sql` ou numa entidade JPA (`model/`).
- **`ambiente-local`** — subir/derrubar servidores, rodar testes, semear/limpar dados
  de teste, testar no navegador.
- **`anti-ui-slop`** — desenho de tela nova, redesign, layout/paleta, auditoria visual.
