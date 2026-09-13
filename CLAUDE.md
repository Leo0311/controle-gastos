# Controle de Gastos — Instruções do Projeto

Monorepo com três apps que compartilham um PostgreSQL: `controle-gastos/` (console
Java, legado/congelado), `controle-gastos-api/` (API Spring Boot 4, Java 17, :8080) e
`controle-gastos-web/` (Angular 18 + Material, :4200). Em produção: frontend no Render
(Static Site, auto-deploy no push), API numa VM da Oracle Cloud (systemd; deploy
automático por GitHub Actions — ver skill `banco-schema`), banco no Neon.

## Vale para qualquer tarefa

- **`git push` na `master` publica o frontend na hora** — Render Static Site, sem
  staging nem PR.
- **A API sobe por GitHub Actions**, no push na `master` que toque
  `controle-gastos-api/**` (ou `schema.sql`, ou o próprio workflow). Jobs, fallback
  manual e detalhes do CI: skill `banco-schema`.
- **Mudança de schema = migration nova do Flyway** (nunca edite um `V-n` já aplicado).
  Procedimento completo: skill `banco-schema`.
- **Antes de um push que envolva schema, migração de dados ou mexida em auth**, diga o
  que vai ao ar e confirme com o usuário.
- **Não atualize dependências reativamente.** Nada de `npm audit fix --force`,
  `ng update` ou bump de major sem uma tarefa dedicada. O Angular está no 18.2 de
  propósito; a maioria das vulnerabilidades do `npm audit` é do toolchain de build.
- **Repositório público: nunca escreva senha, token ou connection string em arquivo
  versionado nem no chat.** Use placeholder e peça o valor ao usuário na hora. Editar
  segredo em produção ou ler arquivo local com segredo: skill `producao-vm`.
- **Commits:** direto na `master` (sem PR), mensagem em português, presente, dizendo o
  quê + porquê. Quando a mudança for visível ao usuário, atualize a seção relevante do
  `README.md` (doc de usuário, por feature) no mesmo commit.
- A ferramenta Bash abre em `…\controle-gastos\controle-gastos\` (o módulo console),
  não na raiz do repo — `git` e os arquivos da raiz precisam de `../` ou caminho absoluto.

## Skills — leia a que casar com a tarefa

- **`backend-api`** — editar qualquer `.java` em `controle-gastos-api/`.
- **`frontend-angular`** — editar código em `controle-gastos-web/src/app/`. Decisão
  visual é `anti-ui-slop`, não essa.
- **`banco-schema`** — migration nova, mudança em `schema.sql`, entidade JPA, ou
  qualquer detalhe do pipeline de deploy da API.
- **`ambiente-local`** — subir/derrubar servidores, rodar testes, semear/limpar dados
  de teste, testar no navegador.
- **`anti-ui-slop`** — desenho de tela nova, redesign, layout/paleta, auditoria visual.
- **`producao-vm`** — editar segredo em produção (`/etc/controle-gastos.env`) ou ler
  arquivo local com segredo.
- **`handoff-docs`** — gerar/atualizar `ESTADO-ATUAL.html` ou um handoff de sessão.
