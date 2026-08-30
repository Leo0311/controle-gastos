# Controle de Gastos — Instruções do Projeto

Monorepo com três aplicações que compartilham o mesmo banco PostgreSQL:
`controle-gastos/` (console), `controle-gastos-api/` (API REST) e
`controle-gastos-web/` (frontend).

## Stack

| Parte | Tecnologia | Porta |
|-------|-----------|-------|
| Console | Java 17 + Maven — `controle-gastos/` | — |
| API | Spring Boot 4 + Java 17 + JPA — `controle-gastos-api/` | 8080 |
| Frontend | Angular 18 + Angular Material — `controle-gastos-web/` | 4200 |
| Banco | PostgreSQL — `controle_gastos` local / Neon em produção | 5432 (local) |
| Deploy | Render — frontend Static Site, API Web Service via Docker; auto-deploy a partir do GitHub | — |

## REGRA CRÍTICA: mudanças de schema

A API roda com `ddl-auto=validate` — **NUNCA cria ou altera tabelas sozinha**.
Sempre que `controle-gastos/src/main/resources/schema.sql` mudar (nova tabela ou
coluna):

1. **Aplicar localmente** para desenvolvimento/teste.
2. **Aplicar MANUALMENTE no banco Neon de produção** via `psql`. Quem faz isso é
   o usuário — peça a connection string **ou** entregue o comando exato para ele
   rodar. **NUNCA** peça para colar a senha aqui no chat; sempre ofereça a opção
   "rodar você mesmo".
3. Sem esse passo, o próximo deploy da API entra em **crash-loop** com erro de
   schema faltando (`Schema-validation: missing column [...]`).

O `schema.sql` é idempotente (`IF NOT EXISTS`, `ON CONFLICT ... DO NOTHING`),
então pode ser reexecutado inteiro com segurança.

## Convenções de trabalho

- Ao implementar uma funcionalidade nova ou mudança significativa, **atualize o
  `README.md`** como parte da tarefa, antes do commit final — sem o usuário
  precisar pedir.
- **Sempre finalize com commit + push**, a menos que o usuário peça o contrário.
- Ao testar várias mudanças pedidas juntas, faça **um único ciclo de teste**
  cobrindo tudo (web + mobile 375px) — não testes repetidos e isolados. O usuário
  valoriza economia de tokens.
- **Sempre limpe os dados de teste** (usuários, gastos, etc.) do banco ao final
  de qualquer teste.
- Antes de implementar algo que pode já existir, verifique/audite o código atual
  primeiro se valer a pena.

## Ambiente do usuário

- Windows + PowerShell; usa `nvm` para gerenciar versões do Node.
- Se um comando (`claude`, `psql`, `mvn`, etc.) der "não reconhecido", é falta do
  PATH na sessão atual do PowerShell — sugira `$env:Path += ";CAMINHO"` como
  solução rápida. Caminhos úteis:
  - `psql`: `C:\Program Files\PostgreSQL\14\bin`

## Segurança

- **NUNCA** sugira colar senhas, tokens ou connection strings diretamente no chat
  — oriente a rodar comandos localmente ou usar variáveis de ambiente.
- Se uma credencial aparecer em texto puro em algum lugar (chat, log, arquivo
  versionado), **avise para rotacionar**.
- Segredos locais ficam em `controle-gastos-api/src/main/resources/application.properties`
  (gitignored); produção usa env vars no Render.
