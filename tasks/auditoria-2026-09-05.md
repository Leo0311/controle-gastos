# Auditoria técnica — Controle de Gastos (2026-09-05)

Revisão de leitura, sem nenhuma alteração de código. Cobre `controle-gastos-api/`
(9 controllers, 10 services, todos os repositories) e `controle-gastos-web/`
(componentes, services, specs). Cada achado tem local exato, consequência prática
e um plano de correção — organizados por custo (rápido/médio/complexo), do mais
grave pro mais leve dentro de cada nível.

---

## Não há nada crítico/urgente pendente

Verifiquei especificamente por IDOR (autorização quebrada por objeto), segredo
vazado no repositório, XSS e vazamento de stack trace — **nenhum dos quatro
apareceu**. Os dois achados que eu atacaria primeiro, se fosse eu, não são falhas
de segurança clássicas, mas têm consequência real e concreta hoje:

1. ~~**Duas abas abertas podem duplicar um gasto recorrente** (achado #1, médio)~~
   — **resolvido em 2026-09-05** (ver M1). Era o único achado desta auditoria que
   corrompia dado financeiro silenciosamente, sem qualquer aviso ao usuário.
2. **`GET /api/gastos` sem paginação** (achado #2, complexo) — o único que já tem
   caminho de uso real na tela (Gastos → "Ver todos os meses") que puxa a tabela
   inteira do usuário de uma vez. Ainda pendente.

O restante é validação incompleta, uma N+1 já conhecida, cobertura de teste
desigual e duplicação de código — importante, mas nada que exija ação imediata.

**Primeira leva de correções (2026-09-05):** M1, R1, R2 e R3 foram implementados,
testados e medidos — ver o status em cada achado abaixo. Ainda não commitados
nem enviados à VM no momento desta atualização do relatório.

---

## Rápido

### R1 — `GastoService.validar` não valida a data do gasto

> **Status: ✅ Resolvido em 2026-09-05.** Janela adicionada em `validar(Gasto)`:
> **100 anos no passado / 15 anos no futuro** — mais larga que os "20 anos/2 meses"
> cogitados abaixo, porque `validar()` também roda em cada parcela de
> `salvarParcelas()` (via `cadastrarVinculadoARecorrente`/`salvarParcelas`), e a
> última parcela de uma compra parcelada legítima (1ª parcela em +2 meses, 120
> parcelas) pode cair em ~121 meses no futuro; 2 meses pra frente teria quebrado
> esse caso. 100 anos pra trás porque o próprio app sugere lançar dívida antiga
> como gasto avulso. 5 testes novos em `GastoServiceTest`, incluindo um cobrindo
> esse pior caso de parcelada. Suíte completa (44 testes) verde.

**Onde:** `controle-gastos-api/.../service/GastoService.java`, método `validar`
(linha ~323).

**Por quê importa:** `CompraParceladaService.validar` (mesmo pacote) rejeita uma
`dataPrimeiraParcela` mais de 12 meses no passado ou 2 no futuro — mas o gasto
avulso comum (`POST /api/gastos`, o endpoint mais usado do sistema) não valida
`data` nenhuma. Um valor absurdo (ano 999999999, por exemplo) passa pelo
`LocalDate` sem erro e só falha ao chegar no Postgres, cujo tipo `DATE` tem limite
próprio (4713 a.C.–5874897 d.C.); esse erro específico do driver não é
necessariamente traduzido para `DataIntegrityViolationException` pelo Spring, e
pode não cair em nenhum `@ExceptionHandler` existente (ver R2). Também não há
teste cobrindo esse caminho.

**Como corrigir:** adicionar ao `validar(Gasto)` uma janela razoável pra `data`
(pode ser mais larga que a de parcelas — histórico legado existe — mas finita,
ex.: não mais que uns 20 anos pra trás/2 meses pra frente), rejeitando com
`IllegalArgumentException` antes de chegar no banco.

**Custo:** rápido.

---

### R2 — Nenhum `@ExceptionHandler` genérico no `GlobalExceptionHandler`

> **Status: ✅ Resolvido em 2026-09-05.** Adicionado `@ExceptionHandler(Exception.class)`
> por último na cadeia (só pega o que nenhum handler específico tratou). Loga a
> exceção inteira (`log.error(..., e)`) no servidor; devolve ao cliente sempre
> `{"erro": "Ocorreu um erro inesperado."}`, 500, sem nenhum detalhe interno — as
> duas coisas verificadas separadamente num teste novo que joga uma exceção com
> uma connection string com senha na mensagem e confirma que nada disso vaza no
> corpo da resposta. Suíte completa verde.

**Onde:** `controle-gastos-api/.../exception/GlobalExceptionHandler.java` — lista
7 handlers específicos, nenhum para `Exception`/`RuntimeException` genérico.

**Por quê importa:** confirmei que isso **não vaza stack trace nem mensagem
interna hoje** — nem `application.properties` nem `application-prod.properties`
alteram `server.error.include-message`/`include-stacktrace` (ambos ficam no
padrão seguro do Spring Boot, `never`). O problema é outro: qualquer exceção sem
handler específico (conexão com o banco caindo no meio de um request, um
`NumberFormatException` de parâmetro mal formado, o erro de data do achado R1)
cai no handler *default* do Spring Boot, que devolve `{"error": "Internal Server
Error", ...}` — formato diferente do `{"erro": "..."}` que todo o resto da API
(e o frontend, via `mensagemErro` copiado em 7 componentes — ver M5) espera. Na
prática o usuário só vê a mensagem genérica de fallback do frontend, mas o
status sempre é 500 mesmo quando a causa é um dado malformado que devia ser 400,
e nada disso fica logado de forma estruturada pelo lado da aplicação.

**Como corrigir:** adicionar um `@ExceptionHandler(Exception.class)` que loga em
nível ERROR (com stack trace só no log, nunca na resposta) e devolve
`{"erro": "Ocorreu um erro inesperado."}` com 500 — mantém o contrato consistente
e dá um lugar central pra notar problemas de infraestrutura (ex.: Neon fora do
ar) que hoje passam batido.

**Custo:** rápido.

---

### R3 — N+1 confirmado em `OrcamentoService.orcamentosDoMes`

> **Status: ✅ Resolvido em 2026-09-05.** Implementado exatamente como proposto:
> `somarPorOrcamentos(List<Integer>)` com `GROUP BY orcamento_id`, `Map` montado
> antes do loop; `somarPorOrcamento(Integer)` removido por ficar sem chamador.
> **Medido, não assumido**, como pedido: com 5 orçamentos no mesmo mês e o log de
> SQL do Hibernate ligado, contei **6 queries antes** (1 + 1 por orçamento) e
> **2 depois** (1 + 1 batch), revertendo e restaurando a correção pra comparar
> as duas execuções. Suíte completa verde.

**Onde:** `controle-gastos-api/.../service/OrcamentoService.java`, método
`orcamentosDoMes` (linha ~111) — `gastoRepository.somarPorOrcamento(o.getId())`
dentro do `.map()` sobre `orcamentos`.

**Por quê importa:** é o único loop-de-query que sobrou no projeto (a própria
skill `backend-api` já documenta isso). Para um usuário com orçamento definido
em várias categorias/subcategorias no mesmo mês, esse endpoint (chamado toda vez
que a tela Orçamentos carrega) dispara uma query `SUM` **por orçamento**, em vez
de uma agregada. Com o volume atual (poucos orçamentos por usuário) o custo é
baixo, mas é o tipo de coisa que piora sozinha conforme a base cresce, sem
nenhum sinal visível até ficar lento.

**Como corrigir:** trocar `somarPorOrcamento(Integer)` por uma query agregada
que recebe a lista de IDs dos orçamentos do mês e devolve `GROUP BY orcamento_id`
de uma vez (`List<OrcamentoTotal> somarPorOrcamentos(List<Integer> ids)`), e
montar um `Map<Integer, BigDecimal>` antes do loop em vez de consultar dentro
dele.

**Custo:** rápido.

---

### R4 — Validação de e-mail no cadastro é só `contains("@")`

**Onde:** `controle-gastos-api/.../service/UsuarioService.java`, método
`validarCadastro` (linha ~129).

**Por quê importa:** aceita `"a@"`, `"@@@"` ou `"x@y"` como e-mail válido. Não é
um risco de segurança (o único efeito prático é o usuário nunca receber o link
de redefinição de senha, já que o `EmailService` vai falhar silenciosamente ao
tentar enviar pra um endereço inválido — mesma categoria do achado M6), mas é
uma validação claramente mais fraca do que o resto do arquivo.

**Como corrigir:** trocar por uma regex simples de formato de e-mail
(`^[^\s@]+@[^\s@]+\.[^\s@]+$` já resolve os casos óbvios) — não precisa de
verificação de entrega, só de formato razoável.

**Custo:** rápido.

---

## Médio

### M1 — Corrida entre requisições pode duplicar o lançamento de um gasto recorrente

> **Status: ✅ Resolvido em 2026-09-05.** Índice único parcial
> `uq_gastos_recorrente_mes` em `schema.sql` (com `data::timestamp` explícito —
> sem o cast, `date_trunc` cai na variante dependente de fuso e o Postgres rejeita
> a expressão do índice). `tentarLancar`/`lancarParaMesFuturo` agora capturam
> `DataIntegrityViolationException` separadamente do catch genérico. **Verificado
> antes de criar o índice: zero duplicados em produção** (query rodada pelo
> usuário no Neon). Teste novo (`GastoRecorrenteConcorrenciaTest`, `@SpringBootTest`,
> 8 threads reais via `CountDownLatch`) prova os dois lados: sem o índice, 8
> chamadas concorrentes geram 8 gastos duplicados (reprodução 100% consistente);
> com o índice, geram 1. Pendente: migrar o Neon (`schema.sql`) **antes** do
> próximo deploy manual da API na VM — sem isso a proteção não existe em produção
> ainda. Suíte completa (44 testes) verde.

**Onde:** `controle-gastos-api/.../service/GastoRecorrenteService.java`, métodos
`tentarLancar` (linha ~175) e `lancarParaMesFuturo` (linha ~143) — o padrão é
"verifica se já existe" (`existsByGastoRecorrenteIdAndDataBetween`) e só depois
insere, sem nenhuma constraint de banco nem lock protegendo o intervalo entre as
duas operações.

**Por quê importa:** `lancarPendentes` é chamado automaticamente toda vez que o
Dashboard ou a tela de Gastos carrega (não é uma ação explícita do usuário) — se
duas abas abrirem ao mesmo tempo, ou o usuário atualizar a página rápido demais,
duas requisições concorrentes podem **ambas** passar pelo `existsBy...` antes de
qualquer uma commitar o `INSERT`, gerando dois gastos idênticos pro mesmo mês da
mesma recorrência. Confirmei que não existe nenhum índice único em
`gastos(gasto_recorrente_id, ...)` no `schema.sql` que impediria isso no nível
do banco. O teste existente
(`GastoRecorrenteServiceTest.idempotencia_lancarPendentesDuasVezesNaoDuplicaOGastoDoMes`)
só cobre duas chamadas **sequenciais** dentro do mesmo teste com um mock
determinístico — ele não testa (e não pode, sendo Mockito puro) o cenário de
concorrência real que é exatamente onde o bug vive.

**Como corrigir:** adicionar um índice único parcial em `schema.sql`
(`CREATE UNIQUE INDEX ... ON gastos (gasto_recorrente_id, date_trunc('month', data)) WHERE gasto_recorrente_id IS NOT NULL`,
mesma ideia pra `compra_parcelada_id` se aplicável) e capturar a
`DataIntegrityViolationException` resultante dentro do próprio service como
"já lançado" (idempotente, sem propagar erro) em vez de deixar a corrida
acontecer. É mudança de schema — segue o procedimento da skill `banco-schema`
(SQL + Neon de produção antes do próximo deploy manual da API).

**Custo:** médio.

---

### M2 — Rate limiting cobre só os 3 endpoints públicos de auth

**Onde:** `controle-gastos-api/.../security/RateLimitFilter.java` — `CAMINHOS_LIMITADOS`
lista só `/api/auth/login`, `/api/auth/cadastro`, `/api/auth/esqueci-senha`.

**Por quê importa:** endpoints autenticados que fazem trabalho pesado —
`POST /api/gastos` (chamado em loop pelo fluxo de importação, um request por
linha da planilha, sem limite de linhas), `POST /api/compras-parceladas` (gera
até 120 gastos numa `@Transactional` só), `POST /api/gastos-recorrentes/lancar-pendentes`
(roda a cada carregamento de tela) — não têm nenhum limite de frequência. O
requisito é menor que nos endpoints públicos (precisa de uma conta válida
primeiro), mas nada impede uma conta comprometida ou um script do próprio
usuário de martelar esses endpoints e gerar carga desproporcional no banco.

**Como corrigir:** um rate limit separado, por `usuarioId` (não por IP, já que é
autenticado) e com janela/limite mais generosos que o de auth, aplicado pelo
menos em `POST /api/gastos`, `POST /api/compras-parceladas` e
`POST /api/gastos-recorrentes/lancar-pendentes`. Cuidado pra não bloquear uma
importação legítima de planilha grande — o limite precisa ser calibrado pra isso.

**Custo:** médio (chave por usuário em vez de IP, e calibrar limites sem quebrar
importação legítima).

---

### M3 — Duas cópias fazem drift de validação: janela de data e nº de parcelas

**Onde:** `controle-gastos-api/.../service/CompraParceladaService.java` (`validar`,
linha ~167) e `controle-gastos-web/.../gasto-form-dialog.component.ts` (linhas
~96–103 e 248) — mesma janela de 12 meses atrás / 2 meses à frente, e o mesmo
intervalo 2–120 parcelas, escritos separadamente nos dois lados.

**Por quê importa:** os comentários dos dois lados já reconhecem a duplicação
("Mesma janela validada no frontend" / "validado no backend") — é uma
duplicação **intencional** (UX no cliente, autoridade no servidor), então o
risco não é segurança (o backend sempre tem a palavra final), só UX: se alguém
mudar um lado sem lembrar do outro, o formulário aceita algo que o servidor vai
rejeitar (ou vice-versa), e o usuário só descobre depois de tentar salvar.

**Como corrigir:** menor prioridade que os outros médios — não precisa de ação
imediata, mas seria mais seguro se o backend expusesse esses limites (janela de
data, min/max parcelas) num endpoint ou constante compartilhada, em vez de dois
números mágicos coincidindo por convenção.

**Custo:** médio (não é urgente).

---

### M4 — Cobertura de teste desigual: Orçamentos e o fluxo de autenticação sem nenhum teste

> **Status: ✅ Resolvido em 2026-09-05** (Orçamentos + fluxo de auth).
> - `OrcamentoServiceTest` — **32 testes**: os quatro ramos de `validar()`, os
>   quatro de `resolverCategoria()`, a checagem de duplicidade (sentinela `SEM_ID`
>   no create, auto-exclusão pelo próprio id no update, mensagens distintas
>   geral × subcategoria), o escopo por usuário em `atualizar`/`excluir` (404), e
>   os três status de `orcamentosDoMes()` nas fronteiras — limiar exato de 80%,
>   `completo` com escalas de `BigDecimal` diferentes, e o vínculo por
>   `orcamento_id` da agregação do R3.
> - `UsuarioServiceTest` — **24 testes**: normalização e unicidade de e-mail no
>   cadastro, verificação de senha e mensagem genérica no login (incl. senha nula
>   sem chamar o encoder, e-mail nulo sem NPE), o silêncio deliberado de
>   `esqueciSenha` para e-mail inexistente e o engolir de `MailException`, a
>   validade/expiração do token de redefinição e o incremento de `tokenVersion`
>   que desloga os JWTs antigos, mais `atualizarRenda`.
> - `CategoriaServiceTest` — **22 testes**: a proteção de `buscarPropria()`
>   (categoria do sistema ou de outro usuário nunca é editável/excluível),
>   normalização + duplicidade em `criar`/`atualizar`, bloqueio de exclusão por
>   uso e cascata nas subcategorias, e a ordem de `reordenar()`/
>   `ordenarPorPreferencia()` (ordem recebida, IDs inválidos/repetidos ignorados,
>   categorias novas no fim na ordem padrão, reaproveitamento dos registros de
>   posição).
> - `SubcategoriaServiceTest` — **14 testes**: categoria-pai visível antes de
>   qualquer operação, a restrição estrita de `findByIdAndUsuarioId`, a
>   duplicidade checada contra a categoria do registro existente (não a do
>   payload), e o bloqueio de exclusão por uso.
> - `GastoRecorrenteServiceTest` — **+5 testes** (3 → 8): `atualizar` (404 fora do
>   usuário, validação antes de alterar, cópia de campos + reaplicação da
>   pré-geração pelo horizonte informado, idempotência ao reeditar) e o
>   `catch (RuntimeException)` de `lancarParaMesFuturo` (recorrência com orçamento
>   excluído não trava a edição).
>
> Suíte de backend: 44 → 141 testes, todos verdes. Todo o M4 está feito —
> plano numerado e a observação do bullet "Recorrentes".

**Onde:** `controle-gastos-api/src/test/java/.../service/` — 7 arquivos, 36
métodos `@Test` no total (a auditoria pediu pra eu contar: são 36, não 34 nem
~20 — ambos os números que eu tinha visto antes estavam desatualizados).

**Por quê importa, com a prioridade que você pediu (parceladas, recorrentes,
orçamentos, importação):**

- **Parceladas** — `CompraParceladaServiceTest`, 12 testes: cobre limites de
  valor/parcelas, arredondamento em centavos, datas retroativas, virada de ano,
  clamping de dia. **Bem coberto, sem problema encontrado aqui.**
- **Recorrentes** — `GastoRecorrenteServiceTest`, 8 testes (era 3): clamping de
  dia, idempotência sequencial, "não lança antes do dia chegar", mais os 5
  adicionados em 2026-09-05 — `atualizar` (404, validação, cópia de campos +
  reaplicação de `gerarProximosMeses`, idempotência ao reeditar) e o
  `catch (RuntimeException)` de `lancarParaMesFuturo`. A corrida do M1 é coberta
  à parte em `GastoRecorrenteConcorrenciaTest`. **Sem lacuna restante.**
- **Orçamentos** — `OrcamentoService`: **zero testes.** Nenhuma cobertura para
  os três status financeiros (`ultrapassou`/`completo`/`proximoDoLimite`,
  incluindo o limiar de 80%), pra checagem de duplicidade
  categoria/subcategoria/mês/ano, nem pro N+1 do achado R3 (um teste não pegaria
  performance, mas pegaria uma regressão funcional na agregação).
- **Importação** — não existe endpoint de backend dedicado (a lógica é toda
  frontend, ver M6); não há teste de backend aplicável aqui além dos que já
  cobrem `POST /api/gastos` indiretamente (que também são poucos — ver abaixo).
- **Fora da lista, mas achei relevante:** `UsuarioService` (cadastro, login,
  esqueci-senha, redefinir-senha, `tokenVersion`) tem **zero testes de service**
  — só existe `JwtServiceTest`, que testa geração/validação do token, não a
  lógica de negócio em volta (rejeição de e-mail duplicado, verificação de
  senha, incremento de `tokenVersion` ao redefinir). `CategoriaService` e
  `SubcategoriaService` também têm zero testes, incluindo a lógica de
  `buscarPropria` que é quem impede editar categoria de outro usuário.
  `GastoServiceTest` tem só 4 testes, focados em regras de parcela — nada cobre
  `rankingCategorias`/`comparacaoMensal` (cálculo de percentual, detecção de
  "categoria nova").

**Como corrigir:** priorizar nessa ordem: (1) ~~um teste de concorrência/idempotência
pra M1 depois que a constraint existir~~ ✅ (`GastoRecorrenteConcorrenciaTest`);
(2) ~~`OrcamentoServiceTest` cobrindo os três status e duplicidade~~ ✅;
(3) ~~`UsuarioServiceTest` cobrindo o fluxo de auth inteiro~~ ✅;
(4) ~~`CategoriaServiceTest`/`SubcategoriaServiceTest` cobrindo `buscarPropria`~~ ✅.
Plano completo — ver o bloco de status no topo deste achado.

**Custo:** médio (é trabalho de escrever testes Mockito seguindo o padrão já
estabelecido pelos arquivos existentes, não precisa de infraestrutura nova).

---

### M5 — Cinco helpers idênticos copiados entre 4 a 7 componentes do frontend

**Onde:** já documentado como dívida conhecida na skill `frontend-angular`, mas
confirmei os números exatos:

- `mensagemErro` — **7 cópias** (`login`, `cadastro`, `redefinir-senha`,
  `categorias`, `gastos`, `gastos-recorrentes`, `orcamentos`), byte a byte
  idênticas (conferi 3 delas lado a lado).
- `mostrarSucesso`/`mostrarErro` — 4 cópias (`categorias`, `gastos`,
  `gastos-recorrentes`, `orcamentos`).
- `NOMES_MESES` — 6 cópias (`app.component`, `analises`, `dashboard`,
  `dashboard-detalhe-dialog`, `gastos`, `gastos-recorrentes`).
- `categoriaEmoji` — copiado de forma parecida (não recontei, já citado na skill).

**Por quê importa:** é exatamente o tipo de duplicação que o pedido de auditoria
descreve — "lógica que poderia divergir". Hoje as cópias são idênticas, mas
qualquer ajuste futuro (ex.: o backend passar a devolver um novo formato de
erro, ou a lista de meses precisar de abreviação diferente em algum lugar) tem
7 (ou 6, ou 4) lugares pra lembrar de mudar, e nenhum teste pegaria uma cópia
esquecida.

**Como corrigir:** extrair `mensagemErro`/`mostrarSucesso`/`mostrarErro` para um
`NotificacaoService` (ou função utilitária pura pro `mensagemErro`, que não
depende de `MatSnackBar`), e `NOMES_MESES`/`categoriaEmoji` para um arquivo de
constantes compartilhado em `core/` ou `shared/`. Refatoração mecânica, mas
toca 7+ arquivos — testar a build depois.

**Custo:** médio (mecânico, mas espalhado).

---

### M6 — Idempotência de importação depende inteiramente do frontend

**Onde:** `controle-gastos-web/.../gastos/gastos.component.ts`, método
`gastoMudou` (linha ~834) e o uso em `prepararAtualizacao` (linha ~696) — a
checagem de "já existe" compara a planilha contra `gastosAtuais`, uma lista
buscada do backend **uma vez**, no início do fluxo de importação. Não existe
nenhuma proteção equivalente no `POST /api/gastos` do backend.

**Por quê importa:** reimportar a **mesma planilha duas vezes em sequência**
(a primeira importação termina completamente antes da segunda começar) é seguro
— na segunda vez, toda linha bate com um gasto já salvo e cai em
`duplicataExata`, sem criar nada novo. O risco real é mais estreito do que a
pergunta sugere: só aparece se o usuário disparar **duas importações
genuinamente em paralelo** (duas abas, ou dois cliques rápidos que cada um abre
seu próprio diálogo de revisão) — aí a segunda leitura de `gastosAtuais` pode
não incluir ainda as linhas que a primeira está no meio de salvar, e ambas
tentam criar a mesma linha. Como o backend não tem nenhuma restrição de
duplicidade em `gastos` (nem deveria ter uma rígida — duas compras idênticas no
mesmo dia são um caso legítimo), esse cenário estreito realmente cria
duplicata.

**Como corrigir:** menor prioridade — o caso comum (reimportar em sequência) já
funciona. Se quiser fechar o caso estreito, a opção mais simples é desabilitar o
botão de importar assim que o fluxo começa, impedindo um segundo diálogo de
abrir antes do primeiro terminar (client-side, resolve o caso realista sem
mexer no contrato do backend).

**Custo:** médio (se decidir fechar o caso estreito; a fiação de estado do
diálogo precisa de cuidado pra não travar o botão se o usuário cancelar no
meio).

---

### M7 — SMTP fora do ar na recuperação de senha falha em silêncio total

**Onde:** `controle-gastos-api/.../service/UsuarioService.java`, método
`esqueciSenha` (linha ~65) — `catch (MailException e) { log.error(...); }`, sem
mais nenhuma ação.

**Por quê importa:** o design de "não revelar se o e-mail existe" (mesma
resposta sempre, ver comentário no código) é uma decisão de segurança correta —
não é isso que está errado. O problema é que, se o SMTP cair por um período
(Gmail limitando a conta, credencial expirada, etc.), **toda** recuperação de
senha do sistema falha silenciosamente, sem nenhum sinal além de uma linha de
log que ninguém está olhando ativamente — o único log de toda a aplicação
backend é justamente esse. O usuário simplesmente nunca recebe o e-mail e não
tem como saber se foi ele que errou o endereço ou se o sistema está com
problema.

**Como corrigir:** não dá pra mudar a resposta ao usuário sem reabrir o
problema de enumeração de conta — a correção certa é observabilidade, não UX:
um alerta (ou métrica monitorada) quando `MailException` acontecer, pra alguém
saber que o SMTP caiu antes que um usuário reclame.

**Custo:** médio (depende de que canal de alerta/monitoramento o projeto quiser
usar — hoje não existe nenhum).

---

### M8 — Componentes grandes demais: os 5 maiores de cada lado

**Backend** (services — a skill já explica por que não há relacionamento JPA
nem camada de repositório com lógica, então o tamanho todo é regra de negócio):

| Arquivo | Linhas | Justificado? |
|---|---|---|
| `GastoService.java` | 334 | Parcialmente — CRUD + 5 métodos de agregação (resumo, totais, ranking, comparação) num arquivo só. Dá pra separar as agregações de dashboard num `GastoEstatisticaService`. |
| `GastoRecorrenteService.java` | 251 | Sim — a lógica de geração/idempotência é genuinamente complexa e coesa. |
| `CategoriaService.java` | 216 | Sim — CRUD + ordenação por drag-and-drop são duas responsabilidades relacionadas, tamanho razoável. |
| `CompraParceladaService.java` | 206 | Sim — mesma лógica que justifica o de recorrentes. |
| `UsuarioService.java` | 136 | Sim, tamanho pequeno pro que faz (auth completo). |

**Frontend** (por linhas, incluindo `dicionario-categorias.ts` que entra na
contagem mas é dado estático, não lógica):

| Arquivo | Linhas | Justificado? |
|---|---|---|
| `gastos.component.ts` | 1052 | **Não** — CRUD da tela + toda a orquestração de importação (7 métodos encadeados: `resolverCategorias` → `prepararAtualizacao` → `confirmarAtualizacoes` → `confirmarLinhasSuspeitas` → `confirmarLinhasPossivelEdicao` → `prepararVinculoOrcamento` → `executarImportacao`) num componente só. É de longe o maior arquivo do repositório inteiro. |
| `dashboard.component.ts` | 547 | Parcialmente — 2 gráficos + cards + meta de economia; a lógica de cor da pizza (`coresCategorias`, `montarPizza`) já é auto-contida e daria pra extrair. |
| `gasto-form-dialog.component.ts` | 518 | Sim — um forms com 3 modos (gasto/recorrente/parcelada) é inerentemente maior, mas está no limite. |
| `dicionario-categorias.ts` | 470 | Sim — é uma tabela de dados (termos → categoria), não lógica; tamanho não é um problema de arquitetura aqui. |
| `gastos-recorrentes.component.ts` | 424 | **Não** — 3 sub-telas num componente só: recorrentes, parceladas e "próximas contas" (calendário). Cada uma já é internamente coesa (métodos agrupados), então a extração em 3 componentes seria relativamente direta. |

**Como corrigir:** os dois "não justificados" (`gastos.component.ts` e
`gastos-recorrentes.component.ts`) são os candidatos reais. Pra
`gastos.component.ts`: extrair a orquestração de importação inteira pra um
`ImportacaoGastosService` ou orquestrador dedicado — é a maior parte do
tamanho do arquivo. Pra `gastos-recorrentes.component.ts`: separar em 3
componentes de aba (recorrentes / parceladas / próximas contas), cada um já
quase pronto pela forma como os métodos estão agrupados hoje.

**Custo:** médio pra `gastos-recorrentes.component.ts` (extração mecânica);
**complexo** pra `gastos.component.ts` (ver C2 abaixo — a extração da
importação é grande o suficiente, e toca fluxo demais usado, pra entrar como
item próprio nos complexos).

---

## Complexo

### C1 — `GET /api/gastos` sem paginação, e a tela "Ver todos os meses" carrega tudo de uma vez

> **Status: ✅ Resolvido em 2026-09-05.** Feito exatamente como o "como corrigir"
> propõe: novo `GET /api/gastos/pagina?page=&size=&mes=&ano=&categoriaId=`
> (`GastoService.listarPaginado` + `GastoRepository.buscarPagina` com `Pageable`,
> ordenação `data desc, id desc` montada no servidor, `size` limitado a 200,
> DTO enxuto `{conteudo, pagina, totalPaginas, totalItens, ultima}`).
> `GET /api/gastos` (sem paginação) **fica intacto** — export e checagem de
> duplicata da importação seguem usando ele. Na tela, `carregar()` passou a
> chamar o endpoint paginado (mês/ano/categoria viram filtro do servidor, não
> mais filtro client-side), com botão **"Carregar mais"** que anexa a próxima
> página; o dropdown "Filtrar por categoria" passou a vir de
> `GET /api/categorias/com-gastos` — o que **também tira esse endpoint da lista
> de órfãos** (ver seção de itens abertos). +8 testes de service
> (`GastoServiceTest`, 149 no total); verificado no navegador (desktop + 375px)
> com 65 gastos semeados. **API precisa de redeploy manual na VM** (mudou `.java`;
> sem mudança de schema).

**Onde:** `controle-gastos-api/.../controller/GastoController.java` (`listarTodos`)
→ `GastoService.listarTodos` → `GastoRepository.findAllByUsuarioIdOrderByDataDescIdDesc`
(sem `Pageable` em nenhum ponto da cadeia). No frontend, chamado direto por
`gastos.component.ts` (modo "Ver todos os meses"), por `exportarTodos()` (CSV,
uso intencional de tudo) e pelo fluxo de importação (para checar duplicatas
contra o histórico completo).

**Por quê importa:** com 10 mil gastos, o modo "Ver todos os meses" da tela
Gastos — que é uma navegação normal, não uma exportação — traz a tabela inteira
do usuário numa resposta só: sem paginação no banco (a query nem limita linhas),
sem lazy-loading na tela (o Angular Material `mat-table`/lista de cartões
renderiza a lista inteira de uma vez). É o único ponto desta auditoria onde dá
pra apontar um caminho de uso real, hoje, que escala mal.

**Como corrigir:** dividir por caso de uso em vez de tentar uma solução única:
(1) o modo "Ver todos os meses" da tela ganha paginação de verdade
(`Pageable` no backend, "carregar mais"/scroll infinito no frontend);
(2) exportação e checagem de duplicata na importação continuam usando uma rota
"tudo" separada (que já é o uso correto pra esses dois casos) — não precisam de
paginação, só não deveriam ser a mesma rota que a tela usa pra navegação normal.

**Custo:** complexo — muda contrato de API, precisa de UI nova de
paginação/scroll, e tem 3 consumidores diferentes (tela, export, import) que
precisam continuar funcionando cada um do seu jeito depois da mudança.

---

### C2 — Extrair a orquestração de importação de `gastos.component.ts`

**Onde:** `controle-gastos-web/.../gastos/gastos.component.ts`, os métodos
citados no achado M8 (linhas ~608–930, quase 1/3 do arquivo).

**Por quê importa:** é a maior concentração de lógica de negócio complexa do
frontend inteiro — 7 métodos encadeados via callback de diálogo
(`afterClosed().subscribe(...)` aninhado), decidindo entre "atualizar",
"suspeita", "possível edição" e "novo" pra cada linha da planilha. Está tudo
dentro do componente de tela, misturado com o resto do CRUD de Gastos — difícil
de testar isoladamente (nenhum teste cobre esse fluxo hoje) e difícil de
entender sem ler o arquivo inteiro.

**Como corrigir:** extrair pra uma classe/serviço dedicado
(`ImportacaoGastosOrquestrador` ou similar) que recebe as dependências que já
usa (`GastoService`, `CategoriaService`, os diálogos) via injeção, e o
componente só dispara `orquestrador.importar(arquivo)`. Isso também abre
caminho pra testar a lógica de decisão (novo/suspeita/edição/atualização) sem
precisar montar o componente inteiro.

**Custo:** complexo — é a lógica mais intrincada do frontend, muitos estados
intermediários (`categoriasResolvidas`, diálogos em cadeia), risco real de
regressão num fluxo que hoje funciona; precisa de um ciclo de teste manual
completo (os cenários de novo/suspeita/edição/atualização) depois da extração,
já que não há teste automatizado pra validar a extração de graça.

**Custo:** complexo.

---

## O que foi verificado e **não** apresentou problema

Pra não deixar por omissão, como pedido:

- **IDOR/autorização por recurso** — os 9 controllers e todos os services
  correspondentes usam `findByIdAndUsuarioId` (ou o equivalente
  `findByIdVisivel`/checagem manual em `CategoriaService.buscarPropria`) em
  todo ponto que recebe um ID pela URL. Nenhum `findById` cru num fluxo de
  usuário.
- **CORS** — `SecurityConfig.corsConfigurationSource` usa lista explícita de
  origens (sem `*`), sem `allowCredentials`, métodos e headers razoáveis. Nada
  mais aberto do que precisa.
- **JWT** — segredo vem de variável de ambiente em produção (nunca hardcoded
  no `application-prod.properties`, que só tem placeholders `${...}`),
  expiração de 6h bate com a documentação, e a revogação por `tokenVersion` é
  checada em **toda** requisição autenticada via `JwtAuthFilter` — cobre login,
  troca de senha e qualquer token antigo, sem exceção.
- **Segredos no git** — o `application.properties` local (com senha de e-mail e
  segredo JWT reais) **nunca foi commitado**, em nenhum branch, em toda a
  história do repositório (`git log --all --full-history` vazio) — está
  corretamente no `.gitignore` desde sempre.
- **Dados sensíveis em log** — só existe **uma** chamada de log em todo o
  backend (`UsuarioService`, falha de e-mail), e ela loga o endereço de e-mail,
  não senha nem token.
- **Injeção de fórmula em planilha exportada** (XLSX/CSV injection) — não foi
  pedido explicitamente, mas é um risco comum em qualquer feature de export;
  `xlsx-sanitizacao.ts` neutraliza células que começam com `=`, `+`, `-`, `@`
  ou tab, e tem teste cobrindo especificamente esse caso
  (`xlsx-sanitizacao.spec.ts`). Bem resolvido.
- **XSS via `innerHTML`** — não foi pedido explicitamente, mas é rápido de
  checar: nenhuma ocorrência de `innerHTML`, `[innerHTML]` ou
  `bypassSecurityTrust` em todo o frontend. Angular escapa interpolação por
  padrão e o projeto não abre nenhuma exceção a isso.
- **Componentes/services mortos no frontend** — o endpoint `GET /api/categorias/com-gastos`
  (antes órfão, registrado em `tasks/divida-tecnica.md`) **voltou a ter uso** na
  correção do C1 (alimenta o dropdown "Filtrar por categoria"). Fora ele, não
  encontrei outro componente ou service sem
  nenhuma referência (`selector` não usado em template nem classe nunca
  importada).
- **Transações em escrita múltipla** — toda operação que grava em mais de uma
  tabela/linha (`CompraParceladaService.cadastrar/excluir`,
  `GastoRecorrenteService.cadastrar/atualizar/excluir`,
  `CategoriaService.excluir/reordenar`) está com `@Transactional`. A exceção
  (`lancarPendentes`) é deliberada e documentada (lote *best-effort* que precisa
  engolir erro por recorrência, não pode estourar rollback do lote inteiro).

---

## Contagem por categoria

| Categoria | Rápido | Médio | Complexo | Total |
|---|---|---|---|---|
| 1. Segurança | 2 (R1 ✅, R2 ✅) | 2 (M1 ✅, M2) | 0 | 4 |
| 2. Banco e performance | 1 (R3 ✅) | 0 | 1 (C1 ✅) | 2 |
| 3. Robustez | 0 | 3 (M1 ✅*, M6, M7) | 0 | 3 |
| 4. Qualidade de código | 0 | 2 (M5, M8) | 1 (C2) | 3 |
| 5. Cobertura de teste | 0 | 1 (M4 ✅) | 0 | 1 |
| **Total (achados únicos)** | **4** | **8** | **2** | **14** |

*M1 aparece em Segurança/Robustez porque é simultaneamente uma corrida de
concorrência (robustez) com efeito de duplicidade de dado financeiro (por isso
também citado no topo) — contado uma vez só no total.

**Status em 2026-09-05: 6 de 14 achados resolvidos** (R1, R2, R3, M1, M4, C1 —
primeira leva de correções, a bateria de testes de service
(`OrcamentoServiceTest`, `UsuarioServiceTest`, `CategoriaServiceTest`,
`SubcategoriaServiceTest`) e a paginação de `GET /api/gastos`; tudo implementado
e testado; suíte de backend 44 → 149 testes; ver o status em cada achado acima).
Faltam: M2, M3, M5, M6, M7, M8, C2 (e R4, validação de e-mail).

## Se fosse minha decisão

Nesta ordem:

1. ~~**R2** (handler genérico) e **R1** (validar data do gasto)~~ — ✅ feitos.
2. ~~**M1** (corrida do gasto recorrente)~~ — ✅ feito. Era o único achado que
   corrompia dado real silenciosamente, numa ação que o usuário nem escolhe
   fazer (roda sozinha ao abrir a tela).
3. ~~**R3** (N+1 de orçamentos)~~ — ✅ feito.
4. ~~**M4** — `OrcamentoServiceTest` (32), `UsuarioServiceTest` (24),
   `CategoriaServiceTest` (22), `SubcategoriaServiceTest` (14),
   `GastoRecorrenteServiceTest` (+5)~~ — ✅ feito, completo (suíte 44 → 141).
5. ~~**C1** (paginação de `GET /api/gastos`)~~ — ✅ feito. **C2** (extrair a
   orquestração de importação) eu deixaria pra a próxima vez que alguém precisar
   mexer no fluxo de importação — é a mudança mais arriscada da lista e não tem
   urgência hoje.
