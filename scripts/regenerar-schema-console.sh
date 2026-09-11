#!/usr/bin/env bash
# Regenera controle-gastos/src/main/resources/schema.sql a partir do estado
# REAL das migrations do Flyway (controle-gastos-api/src/main/resources/db/migration/),
# aplicadas do zero num Postgres 18 (mesma major version do Neon de produção -
# nunca o Postgres local, que é 14 e pode gerar DDL sutilmente diferente).
#
# O arquivo passa a ser um artefato GERADO, nunca editado à mão - serve só pro
# app de console Java (controle-gastos/), que não usa Spring nem Flyway.
#
# Uso:
#   scripts/regenerar-schema-console.sh
#       Sobe um Postgres 18 descartável via Docker, aplica as migrations do
#       zero, gera o dump e SOBRESCREVE o schema.sql. Uso local, antes de
#       commitar uma migration nova.
#
#   scripts/regenerar-schema-console.sh --check
#       Não sobe container nenhum: usa um Postgres 18 já migrado que o
#       chamador aponta (autodetectado via `docker ps --filter ancestor=postgres:18`,
#       ou passado com --container). Gera o dump em memória e compara com o
#       schema.sql commitado - falha (exit 1) sem escrever nada se divergir.
#       Uso do CI (job migration-guard, cenário fresh).
#
#   --container ID   Usa este container específico em vez de autodetectar
#                     (nos dois modos). Escape hatch pra quando há mais de um
#                     postgres:18 rodando na máquina.
set -euo pipefail

MODO="gerar"
CONTAINER_INFORMADO=""
while [ $# -gt 0 ]; do
  case "$1" in
    --check) MODO="check"; shift ;;
    --container) CONTAINER_INFORMADO="$2"; shift 2 ;;
    *) echo "Argumento desconhecido: $1" >&2; exit 2 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
API_DIR="$REPO_ROOT/controle-gastos-api"
SCHEMA_FILE="$REPO_ROOT/controle-gastos/src/main/resources/schema.sql"

CONTAINER_NAME="controle-gastos-schema-regen-pg"
DB_PORT=55432
DB_PASSWORD="regen"
CONTAINER_SUBIU_AQUI=0
TMP_FILE=""
DIFF_FILE=""

# Um único trap pros três motivos de limpeza (container que este script subiu +
# os dois arquivos temporários do modo --check) - um segundo `trap ... EXIT`
# substituiria este, não empilha. Cobre também saída anormal no meio do processo
# (ex: gerar_conteudo falhar depois do mktemp), não só o caminho feliz.
cleanup() {
  if [ "$CONTAINER_SUBIU_AQUI" = "1" ]; then
    docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
  fi
  [ -n "$TMP_FILE" ] && rm -f "$TMP_FILE"
  [ -n "$DIFF_FILE" ] && rm -f "$DIFF_FILE"
}
trap cleanup EXIT

# --- container: sobe um novo (modo "gerar") ou usa um já existente (--check) ---
if [ "$MODO" = "gerar" ]; then
  if [ -n "$CONTAINER_INFORMADO" ]; then
    CONTAINER="$CONTAINER_INFORMADO"
  else
    echo "Subindo Postgres 18 efêmero (porta $DB_PORT)..." >&2
    docker run -d --rm \
      --name "$CONTAINER_NAME" \
      -e POSTGRES_USER=postgres \
      -e POSTGRES_PASSWORD="$DB_PASSWORD" \
      -e POSTGRES_DB=controle_gastos \
      -p "$DB_PORT":5432 \
      postgres:18 >/dev/null
    CONTAINER="$CONTAINER_NAME"
    CONTAINER_SUBIU_AQUI=1

    echo "Aguardando o Postgres ficar pronto..." >&2
    tentativas=0
    until docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; do
      tentativas=$((tentativas + 1))
      if [ "$tentativas" -gt 60 ]; then
        echo "ERRO: o Postgres efêmero não ficou pronto em 60s." >&2
        exit 1
      fi
      sleep 1
    done

    echo "Aplicando as migrations do Flyway do zero (via contexto Spring de teste)..." >&2
    (
      cd "$API_DIR"
      SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:$DB_PORT/controle_gastos" \
      SPRING_DATASOURCE_PASSWORD="$DB_PASSWORD" \
        ./mvnw -q -ntp test -Dtest=ControleGastosApiApplicationTests
    )
  fi
else
  if [ -n "$CONTAINER_INFORMADO" ]; then
    CONTAINER="$CONTAINER_INFORMADO"
  else
    CONTAINER="$(docker ps -q --filter ancestor=postgres:18)"
    if [ -z "$CONTAINER" ]; then
      echo "ERRO (--check): nenhum container postgres:18 rodando pra usar como fonte." >&2
      echo "Este modo espera um Postgres 18 já migrado de pé (ver job migration-guard, cenário fresh)." >&2
      exit 1
    fi
    linhas="$(echo "$CONTAINER" | wc -l)"
    if [ "$linhas" -gt 1 ]; then
      echo "ERRO (--check): mais de um container postgres:18 rodando - use --container ID pra desambiguar." >&2
      exit 1
    fi
  fi
fi

# --- gera o conteúdo (cabeçalho fixo + dump limpo) ---
gerar_conteudo() {
  cat <<'HEADER'
-- ============================================================================
-- ARQUIVO GERADO AUTOMATICAMENTE - NÃO EDITE À MÃO.
--
-- Dump (pg_dump --schema-only) do schema resultante de aplicar TODAS as
-- migrations do Flyway do zero, num Postgres 18 (mesma major version do Neon
-- de produção). Serve só pro app de console Java (controle-gastos/), que não
-- usa Spring nem Flyway - pra criar as tabelas num banco novo:
--   psql -d controle_gastos -f schema.sql
--
-- Fonte de verdade real: controle-gastos-api/src/main/resources/db/migration/.
-- Depois de criar ou mudar uma migration, regenere este arquivo com:
--   scripts/regenerar-schema-console.sh
-- O CI (job migration-guard, cenário fresh) falha se este arquivo divergir do
-- que as migrations realmente produzem.
-- ============================================================================

HEADER
  # Só as duas linhas de versão são removidas - carregam a versão exata do
  # pg_dump (ex: "18.6"), que pode avançar sozinha (patch release da tag
  # `postgres:18`) sem NENHUMA mudança de schema real, o que faria o --check
  # do CI acusar divergência por um motivo errado. O resto do preâmbulo do
  # pg_dump (banners "-- PostgreSQL database dump", os SET de sessão) é texto
  # fixo, sempre idêntico independente da versão - mantido como está.
  docker exec "$CONTAINER" pg_dump -U postgres -d controle_gastos \
    --schema-only --no-owner --no-privileges \
    | grep -v '^-- Dumped from database version' \
    | grep -v '^-- Dumped by pg_dump version'
}

if [ "$MODO" = "gerar" ]; then
  gerar_conteudo > "$SCHEMA_FILE"
  echo "OK: $SCHEMA_FILE regenerado a partir do container $CONTAINER." >&2
else
  TMP_FILE="$(mktemp)"
  DIFF_FILE="$(mktemp)"
  gerar_conteudo > "$TMP_FILE"
  if diff -u "$SCHEMA_FILE" "$TMP_FILE" > "$DIFF_FILE" 2>&1; then
    echo "OK: schema.sql bate com o que as migrations produzem." >&2
    rm -f "$DIFF_FILE"
  else
    echo "::error::controle-gastos/src/main/resources/schema.sql está DESATUALIZADO em relação às migrations do Flyway." >&2
    echo "Rode 'scripts/regenerar-schema-console.sh' localmente, confira o diff e commite o resultado." >&2
    echo "--- diff (commitado vs. gerado agora) ---" >&2
    cat "$DIFF_FILE" >&2
    rm -f "$DIFF_FILE"
    exit 1
  fi
fi
