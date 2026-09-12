# Controle de Gastos

Sistema de controle de gastos pessoais com autenticação, categorias e subcategorias geridas (com emoji), orçamentos vinculados aos gastos, metas de economia mensais e dashboard com gráficos. Composto por três aplicações que compartilham o mesmo banco PostgreSQL: uma aplicação de console em Java, uma API REST em Spring Boot e um frontend web em Angular.

## Produção

- **Frontend**: https://controle-gastos-web-v8wf.onrender.com — [Render](https://render.com) Static Site (Blueprint em `render.yaml`), **auto-deploy a cada push na `master`, sem filtro de path** — diferente do deploy da API (abaixo), que só roda em push que toque `controle-gastos-api/**`. Um push que mexa só em teste de frontend, documentação ou até só no console Java também gera build no Render (inofensivo — mesmo HTML/JS de sempre — mas esperado, não é bug).
- **API**: https://controle-gastos-leo.duckdns.org (base dos endpoints: `/api`) — VM na [Oracle Cloud](https://www.oracle.com/cloud/) (Always Free). Roda como serviço `systemd` (`controle-gastos`); nginx faz o proxy reverso com TLS via Let's Encrypt; as variáveis de ambiente (banco, JWT, e-mail) ficam em `/etc/controle-gastos.env`. **O deploy é automático** via GitHub Actions a cada push na `master` que mexa em `controle-gastos-api/` — ver ["Deploy da API"](#deploy-da-api) abaixo. (O deploy em container pro Render foi descontinuado em setembro de 2026 — o `Dockerfile` correspondente saiu do repo, mas continua no histórico do Git.)
- **Banco**: PostgreSQL gerenciado pelo [Neon](https://neon.tech).
- **Monitoramento**: `GET /api/health` (público, sem autenticação) responde `{"status":"UP"}` com HTTP 200 quando a API e o banco estão no ar, e `{"status":"DOWN"}` com HTTP 503 se a conexão com o banco falha. É o endpoint que um serviço externo de uptime (UptimeRobot etc.) consulta para alertar quando a API cai.

### Deploy da API

O deploy da API é feito pelo workflow **`.github/workflows/deploy-api.yml`** (GitHub Actions), que dispara:

- **automaticamente** em todo push na `master` cujo diff toque em `controle-gastos-api/**` (ou no próprio arquivo do workflow) — um push que mexa só no frontend, no `README.md` ou no módulo de console **não** roda o deploy;
- **à mão**, pelo botão *Run workflow* na aba **Actions** do GitHub (`workflow_dispatch`) — útil pra reimplantar sem um commit novo.

O workflow tem **dois jobs em sequência**:

**1. `migration-guard`** — antes de qualquer coisa tocar a VM, sobe um PostgreSQL 18 descartável e roda `./mvnw test` (com o Flyway ativo) em dois cenários de matriz: **banco vazio** (o Flyway aplica todas as migrations do zero) e **banco pré-carregado com o `schema.sql` atual** (o Flyway grava o baseline e aplica só as migrations novas por cima). Uma migration quebrada falha aqui e o `deploy` **nem roda**.

**2. `deploy`** — só executa se o `migration-guard` passar. Conecta na VM por SSH (chave privada guardada como secret do GitHub, nunca no repo) e:

1. `git pull --ff-only` na raiz do repo na VM (falha de propósito se a working tree da VM tiver mudança local pendente);
2. `cd controle-gastos-api && ./mvnw clean package -DskipTests`;
3. `sudo systemctl restart controle-gastos` — **no restart, o Flyway aplica automaticamente no Neon as migrations pendentes**, antes do `ddl-auto=validate`;
4. consulta `GET /api/health` pela URL pública, repetindo por até ~2 min. Se não vier `{"status":"UP"}`, **o workflow falha** — e a falha dispara o e-mail padrão de "workflow failed" do GitHub (sem configuração extra).

**Mudança de schema não tem mais passo manual no Neon.** Crie um `controle-gastos-api/src/main/resources/db/migration/V{próximo número}__descricao.sql` (o `V1__baseline.sql` já reflete o schema atual), commite junto com o `@Column` da entidade e dê push — o `migration-guard` valida e o `deploy` aplica. Ver `controle-gastos-api` / skill `banco-schema`.

#### Secrets necessários (Settings ▸ Secrets and variables ▸ Actions ▸ *New repository secret*)

| Secret | Conteúdo | Obrigatório |
| --- | --- | --- |
| `VM_SSH_HOST` | host ou IP da VM (ex.: `controle-gastos-leo.duckdns.org`) | sim |
| `VM_SSH_USER` | usuário SSH da VM (ex.: `ubuntu`) | sim |
| `VM_SSH_KEY` | **chave privada** de deploy, PEM completo (`-----BEGIN …`) — um par dedicado, não a sua chave pessoal | sim |
| `VM_REPO_PATH` | caminho absoluto da raiz do repo clonado na VM (ex.: `/home/ubuntu/controle-gastos`) | sim |
| `VM_SSH_PORT` | porta SSH, se não for a 22 | não (default `22`) |
| `VM_SSH_KNOWN_HOSTS` | saída de `ssh-keyscan <host>` rodado numa máquina confiável — fixa a identidade da VM. Sem esse secret, a host key é buscada por `ssh-keyscan` a cada execução (TOFU, mais frágil a MITM) | não (recomendado) |
| `CI_DB_PASSWORD` | senha do PostgreSQL efêmero do job `migration-guard` — qualquer string aleatória, não toca produção. Se vazio, o container não sobe e o guard falha | sim |

#### Preparo na VM (uma vez)

- gere um par dedicado (`ssh-keygen -t ed25519 -f deploy_key -C github-actions-deploy`), acrescente `deploy_key.pub` ao `~/.ssh/authorized_keys` do usuário SSH e cadastre o conteúdo de `deploy_key` (privada) no secret `VM_SSH_KEY`;
- libere `sudo` sem senha **só** pro restart, em `/etc/sudoers.d/controle-gastos-deploy`:

  ```
  <VM_SSH_USER> ALL=(root) NOPASSWD: /usr/bin/systemctl restart controle-gastos
  ```

  (confira o caminho com `which systemctl` — em algumas distros é `/bin/systemctl`);
- garanta que o repo já está clonado em `VM_REPO_PATH` com a working tree limpa.

#### Fallback manual

Se o workflow falhar (ou pra rodar o deploy à mão por qualquer motivo), os mesmos passos direto na VM:

```
git pull --ff-only                                   # na raiz do repo
cd controle-gastos-api && ./mvnw clean package -DskipTests
sudo systemctl restart controle-gastos
curl -s https://controle-gastos-leo.duckdns.org/api/health   # espera {"status":"UP"}
```

## Estrutura do repositório

```
controle-gastos/            (raiz do repositório)
├── controle-gastos/         # Aplicação de console em Java (Maven), acesso direto ao banco via JDBC
├── controle-gastos-api/     # API REST em Spring Boot, com autenticação JWT
└── controle-gastos-web/     # Frontend em Angular 18 + Angular Material, consumindo a API REST
```

- **`controle-gastos/`** — aplicação de linha de comando (menu interativo) para cadastrar e consultar gastos e orçamentos diretamente no PostgreSQL, sem depender da API.
- **`controle-gastos-api/`** — API REST (Java 17 + Spring Boot) com autenticação JWT, usada pelo frontend Angular.
- **`controle-gastos-web/`** — SPA em Angular que consome a API para oferecer telas de Login/Cadastro, Dashboard, Gastos, Orçamentos, Análises, Categorias e Recorrentes, responsiva em mobile. A navegação entre as seções é por abas no topo em desktop; no mobile é por uma barra fixa no rodapé (bottom navigation, estilo apps nativos) com acesso direto a Dashboard/Gastos/Orçamentos/Análises e um item "Mais" que abre um menu com Categorias e Recorrentes (as 6 seções não cabem bem lado a lado em telas de 375px) — também dá pra trocar de seção deslizando o dedo pra esquerda/direita (mesma ordem, incluindo as agrupadas em "Mais") em telas até 600px, gesto que é ignorado perto das bordas da tela (evita brigar com o "voltar" nativo do navegador/sistema) e nunca interrompe a rolagem vertical normal da página. No cabeçalho, o ícone + nome do app é um link clicável de volta pro Dashboard (convenção padrão de canto superior esquerdo) — no mobile só o ícone aparece (o nome some pra não disputar espaço), mas a área de toque é a mesma dos dois. Quando um diálogo/modal está aberto, o gesto/botão "voltar" do sistema **fecha o modal e fica na tela onde estava**, em vez de navegar pra rota anterior (ao abrir o 1º diálogo o app registra uma entrada de histórico própria, que o "voltar" consome; fechar por backdrop/X/Esc também a consome).

## Funcionalidades

### Autenticação
Cadastro e login com senha (hash BCrypt no banco), sessão persistida em `localStorage` (sobrevive a F5 e a fechar/reabrir a aba) com token JWT válido por 6 horas, logout automático quando o token expira, e recuperação de senha por e-mail (link com token válido por 1 hora).

Também dá para entrar/cadastrar com **"Continuar com o Google"** (Google Identity Services), nas telas de Login e Cadastro, acima de um divisor "ou" e no mesmo estilo outline do resto do app. O clique abre um **popup OAuth tradicional** do Google (seleção de conta + confirmação) — não o One Tap/FedCM (bloqueado por padrão na Brave e não suportado pelo Firefox); compatível com Chrome, Edge, Opera, Firefox e Brave. Login com Google **vincula automaticamente** a uma conta já existente com o mesmo e-mail (o `email_verified` do Google confirma a posse do e-mail, algo que o próprio cadastro por senha nunca checa) e invalida qualquer sessão anterior nesse 1º vínculo, como proteção extra; um e-mail do Google sem verificação é sempre recusado. Uma conta criada só pelo Google não tem senha (login por senha nela simplesmente não bate, sem erro).

Os endpoints públicos de autenticação (`/api/auth/login`, `/api/auth/cadastro`, `/api/auth/esqueci-senha`, `/api/auth/google`) têm **rate limiting** por IP de origem — no máximo 5 requisições por minuto por endpoint; ao exceder, a API responde `429 Too Many Requests` com um cabeçalho `Retry-After`. Isso limita força bruta de senha, enumeração de contas e uso do endpoint de recuperação para bombardeio de e-mail.

Trocar a senha (pelo link de recuperação) **invalida na hora qualquer token JWT emitido antes da troca**: cada usuário tem uma "versão de token" (`token_version`) que vai embutida no JWT no login e é reconferida a cada requisição — um token roubado deixa de funcionar assim que a vítima redefine a senha, sem depender da expiração de 6 horas.

### Categorias e subcategorias
Categoria e subcategoria são entidades geridas (não mais texto livre), cada uma com um emoji, escolhidas via dropdown nos formulários de gasto e orçamento. Existem **categorias padrão do sistema** (Alimentação, Transporte, Moradia, Saúde, Educação, Lazer, Compras, Contas e serviços, Trabalho, Viagens, Pets, Beleza e cuidados pessoais, Outros — visíveis para todos os usuários, fixas) e **categorias personalizadas** (criadas por cada usuário, privadas — só quem criou vê e pode editar/excluir). Subcategoria é sempre filha de uma categoria específica e segue a mesma distinção: existem **subcategorias padrão do sistema** (um conjunto amplo pré-cadastrado em cada categoria padrão, ex. Cafés e lanches/Bebidas em Alimentação, Fatura do cartão/Empréstimos em Finanças) e **subcategorias personalizadas** (criadas por cada usuário, privadas). Na tela **Gerenciar Categorias**, itens padrão do sistema aparecem com um chip "Sistema" e não podem ser editados nem excluídos; itens personalizados mostram os botões de editar/excluir normalmente, cada um abrindo o mesmo mini-diálogo de nome + emoji (com a mesma paleta curada de sugestões) usado tanto para categoria quanto para subcategoria. Dá para criar uma categoria ou subcategoria nova sem sair do formulário de gasto/orçamento (opção "+ Nova..." no fim do dropdown, com esse mesmo mini-diálogo), além da tela dedicada **Gerenciar Categorias** para editar/excluir as próprias e organizar as subcategorias de cada uma. Uma categoria ou subcategoria ainda em uso não pode ser excluída — a checagem cobre gastos, orçamentos, gastos recorrentes **e compras parceladas**, inclusive lançamentos de meses passados ou recorrentes pausados que não aparecem na tela atual. Quando a exclusão é bloqueada, um diálogo mostra exatamente o que está usando (ex.: "em uso em 2 gastos, 1 orçamento e 1 gasto recorrente"), para o usuário saber o que reclassificar ou remover primeiro.

As **categorias** (só categorias por enquanto, não subcategorias) podem ser reordenadas manualmente na tela **Gerenciar Categorias** arrastando e soltando (drag & drop, via Angular CDK): cada linha tem uma alça (ícone ⋮⋮ à esquerda) que se segura para arrastar a categoria para a posição desejada — funciona com o mouse e com o toque no celular. Categorias do sistema e pessoais são reordenadas juntas, sem distinção. Ao soltar, a lista já se reorganiza na hora e a ordem completa é enviada de uma vez para o backend (`PUT /api/categorias/ordem`); se a gravação falhar, a ordem anterior é restaurada. A ordem escolhida é uma preferência pessoal de cada usuário — como categorias padrão do sistema são compartilhadas entre todos, a ordem que um usuário define nunca afeta o que outro usuário vê. Sem nenhuma personalização, a ordem padrão é: categorias do sistema primeiro, depois as pessoais, cada grupo em ordem alfabética. A ordem escolhida persiste entre sessões e é refletida automaticamente em todo o app: dropdown de categoria no formulário de gasto/orçamento, e o filtro "Filtrar por categoria" na tela de Gastos.

### Gastos
CRUD completo (descrição, valor, categoria, subcategoria opcional, data), listagem por categoria/período/mês, exportação e importação em lote via planilha `.xlsx` (ver abaixo). Cada gasto pode ser vinculado a um orçamento do mês/categoria (ou categoria+subcategoria) correspondente. A listagem carrega **50 gastos por vez** — quando há mais, um botão **"Carregar mais"** no fim da lista busca a próxima leva e a anexa (o filtro de Mês/Ano/categoria é aplicado no servidor, então mudar de filtro sempre recomeça do topo). "Exportar todos os gastos" e a checagem de duplicatas da importação continuam trazendo o histórico completo de uma vez; só a navegação da tela é paginada. No topo da tela, só **"Novo gasto"** tem destaque de ação primária; as ações de planilha (exportar todos os gastos, exportar só os exibidos, baixar o modelo de importação e importar) ficam agrupadas num único menu **"Planilha"**, secundário. No mobile os dois botões ficam lado a lado (não empilhados em largura total): o "Planilha" colapsa para só o ícone e o "Novo gasto" mantém o texto e ocupa o resto, deixando claro qual é a ação principal. Quando não há nenhum gasto no período/filtro, o _empty state_ traz o próprio botão de ação ("Cadastrar primeiro gasto" quando a conta está vazia, "Novo gasto" quando é só o filtro que não retornou nada), para a pessoa não precisar procurar a ação no topo. A seção **Filtros** reúne um seletor de Mês/Ano (com o mês atual como padrão), um dropdown "Filtrar por categoria" (listando só categorias com gasto **no mês/ano exibido** — ou em qualquer período no modo "Ver todos os meses" — para não poluir com categorias sem lançamento naquele recorte) e, no fim da faixa, um botão que alterna entre "Ver todos os meses" e "Ver mês atual" — os dois filtros funcionam em conjunto. Ao trocar de mês para um período onde a categoria filtrada não tem gasto, o filtro de categoria volta sozinho para "Todas", em vez de deixar a lista vazia sem explicação. Sempre que algo estiver fora do padrão (mês/ano diferente do atual, categoria selecionada, ou modo "todo o histórico"), aparece também um botão discreto **"Limpar filtros"**, numa linha própria acima dos campos, que zera tudo de uma vez (mês/ano atuais, sem categoria) — some sozinho quando não há nada para limpar, e também no caso em que seria idêntico a "Ver mês atual" (modo histórico sem categoria selecionada). No mobile os filtros ficam dentro de um **painel colapsável**, fechado por padrão: um botão mostra um resumo do filtro ativo (ex. "Agosto/2026 · Alimentação", ou só "Filtros" quando o próprio painel está aberto) e abre sozinho quando o filtro atual não retorna nenhum gasto — nunca fecha sozinho. Aberto, os filtros empilham em largura total **na mesma ordem do desktop** (Mês, Ano, categoria, alternar mês); o dropdown de categoria não é mais o último controle da faixa, então o painel de opções abre normalmente para baixo. Gastos gerados por recorrência (🔁) ou parcela (💳) trazem esses ícones com `aria-label` (não só `title`), pra funcionar no toque e em leitor de tela.

No desktop a listagem é uma tabela (com um menu ⋮ por linha para Editar/Excluir); **abaixo de 600px vira uma lista de cartões expansíveis** (`mat-expansion-panel`, mesmo padrão do ranking de Análises). Colapsado, o cartão mostra o essencial: descrição em uma linha (com reticências se não couber), valor em destaque à direita, categoria/subcategoria e data como linha secundária, e a seta (chevron) indicando que é expansível. **Tocar em qualquer parte do cartão** o expande, revelando a descrição completa, o orçamento vinculado (se houver), o contexto de recorrência/parcela, e os botões **Editar** e **Excluir**. No mobile não há menu ⋮ no cartão — ele faria exatamente o mesmo que tocar no cartão, então seria redundante. A tabela espremida em 375px (colunas capadas, fonte minúscula, "Sup…" no lugar de "Supermercado Extra") deixou de existir no mobile.

### Auto-categorização inteligente
No formulário de **Novo gasto**, enquanto o usuário digita a **Descrição** (a partir
de 3 caracteres, com um pequeno atraso de ~400 ms para não rodar a cada tecla), o app
procura nos gastos anteriores **do próprio usuário** por descrições parecidas —
correspondência simples por substring, sem diferenciar maiúsculas/minúsculas nem
acentos, nos dois sentidos (o texto digitado aparece dentro de uma descrição
anterior, ou vice-versa). Entre os gastos parecidos, identifica a combinação
**categoria + subcategoria** mais usada (empate desempata pelo gasto mais recente) e
mostra um chip discreto abaixo do campo (ex.: "Sugestão: 🚗 Transporte > 🚕
Uber/Táxi"). Clicar no chip preenche os campos Categoria/Subcategoria do formulário;
o "x" ignora a sugestão. Nunca aplica nada sozinho, nunca trava a escolha manual, e o
chip some quando a combinação já selecionada é a sugerida (reaparecendo se o usuário
mudar para outra). Se o usuário apagar a Descrição por completo depois de ter
aplicado uma sugestão — e sem ter mexido nos dropdowns desde então — a
Categoria/Subcategoria também são limpas, voltando ao "nada escolhido ainda";
mas se ele já tinha ajustado a categoria à mão, essa escolha é preservada. Tudo
é resolvido no navegador, a partir da lista de gastos que a API já devolve —
sem endpoint novo. Não aparece ao **editar** um gasto existente.

Quando o histórico pessoal não tem nada parecido (termos que o usuário nunca
cadastrou, como "café da manhã", "pizza", "cerveja com amigos" ou "dentista"),
entra um **plano B**: a descrição é casada contra um dicionário amplo de
palavras-chave do dia a dia brasileiro (`dicionario-categorias.ts`, um arquivo à
parte, fácil de editar — centenas de termos de comida, transporte, contas, saúde,
compras, lazer, educação e viagens, incluindo marcas comuns como iFood, Uber,
Netflix, Enel) que aponta sempre para categoria/subcategoria **padrão do sistema**
— garantidas existir para todo usuário (ex.: "farmácia" → Saúde > Medicamentos,
"seguro do carro" → Transporte > Seguro, "assinatura netflix" → Contas e serviços
> Streaming). Cada entrada liga uma lista de termos a um par
categoria/subcategoria: termo de uma palavra casa como palavra inteira ("água" não
casa dentro de "aguardar"), termo com várias palavras casa como trecho contíguo, e
quando vários casam vence o mais específico. Se a subcategoria do dicionário não
existir naquela categoria, a sugestão degrada para só a categoria — nunca quebra.
O histórico pessoal **sempre** tem prioridade na categoria: o dicionário só é
consultado quando o histórico não encontra nada — ou, quando o histórico acha a
categoria mas nunca uma subcategoria (ex.: gastos de "aluguel" lançados só como
Moradia), para **completar** a subcategoria, e só ela, se concordar na categoria.
A categoria que veio do histórico nunca é trocada pela do dicionário. Termos sem
correspondência em nenhum dos dois continuam sem mostrar sugestão.

### Status de pagamento (Pendente / Pago / Atrasada)
Gastos que vêm de uma **recorrência** ou de uma **compra parcelada** passaram do regime de competência para o de **caixa**: ao serem pré-gerados eles entram como **Pendente** (previsto, ainda não pago), não mais já quitados. A única exceção é a **compra parcelada retroativa**: parcelas cujo vencimento já está **estritamente no passado** (uma compra em curso registrada só agora) nascem **Pago**, com a data de pagamento igual ao próprio vencimento; parcela que vence **hoje ou no futuro** nasce Pendente. Cada um guarda o **vencimento original** e, quando pago, a **data real do pagamento**. "Atrasada" não é um estado gravado — é calculado na leitura: Pendente cujo vencimento **já passou**. A conta continua **Pendente durante todo o dia do vencimento** e só vira **Atrasada a partir do dia seguinte** (uma conta que vence dia 10 fica Pendente o dia 10 inteiro e só fica Atrasada no dia 11); o "hoje" dessa comparação é o horário de Brasília no servidor (Dashboard) e o fuso local do aparelho no navegador (Gastos, Próximas contas). Um **gasto avulso** (sem vínculo com recorrência/parcela) não tem vencimento: nasce direto **Pago** com a própria data informada no cadastro, exibe o chip "Pago" por consistência visual, mas não tem nenhuma ação de pagamento.

O chip de status (Pendente âmbar / Pago verde / Atrasada vermelho) aparece na tela de **Gastos**, na aba **Próximas contas** e — como badge agregado ("N atrasada(s)", "N pendente(s)" ou "em dia", além do chip Ativo/Pausado) — nas abas **Recorrentes** e **Parceladas**.

**Marcar como paga** (no menu ⋮ de Gastos — mesmo menu no desktop e no cartão do mobile — e por item, também num menu ⋮, em Próximas contas) abre um diálogo com o **valor** (pré-preenchido com o previsto, editável) e a **data** (padrão hoje, editável). Ao confirmar, o status vira Pago e a **data do gasto é substituída pela data real do pagamento** — o que pode mover o gasto de mês nos totais do Dashboard/Análises/Orçamentos (é o comportamento desejado do regime de caixa); o vencimento original fica preservado à parte. É **reversível**: "Desfazer pagamento" volta o status para Pendente e a data para o vencimento original (o valor não é alterado). "Editar pagamento" reabre o mesmo diálogo para um gasto já pago. Um gasto Pendente/Atrasada continua contando no total do mês do vencimento, igual aos pré-gerados sempre contaram — pagar só o realoca pela data real.

**Ação em lote:** na aba Recorrentes, "Marcar contas vencidas como pagas" quita de uma vez as ocorrências já vencidas (vencimento ≤ hoje) e ainda pendentes daquela recorrência — as ocorrências futuras não são tocadas (uma recorrência é aberta; não se paga o que ainda não venceu). Na aba Parceladas, "Marcar parcelas restantes como pagas" quita **todas** as parcelas em aberto (vencidas e futuras) — um parcelamento é um compromisso fechado, então "paguei tudo" (a fatura, a loja) é um fluxo comum; cada parcela fica na sua própria data prevista. Em Próximas contas, "Marcar mês como pago" quita as contas vencidas de um mês. Nenhum desses fluxos pede confirmação item a item.

### Gastos recorrentes
Um gasto fixo (aluguel, assinatura etc.) pode ser marcado como recorrente — no próprio formulário de gasto ("Tornar recorrente (todo mês)") ou na tela dedicada **Recorrentes** — informando o dia do mês em que deve ser lançado e "Gerar para os próximos meses" (1 a 12, padrão 12): ao salvar, os gastos desses meses já são lançados imediatamente, **a partir do mês atual — inclusive quando o dia do vencimento ainda não chegou** (uma recorrência "todo dia 10" criada no dia 6 já entra no mês corrente, datada no dia 10). Assim ela aparece de imediato na tela de Gastos, em "Próximas contas" e no total do mês no Dashboard/Análises, em vez de ficar invisível até o dia chegar — o mesmo que já acontece com os meses futuros pré-gerados e com a 1ª parcela de uma compra parcelada. Passado esse horizonte pré-gerado, a recorrência continua lançando os meses seguintes normalmente conforme o tempo passa: como não há um job agendado que rode isso periodicamente, o lançamento é verificado sob demanda, de forma transparente (sem popup), toda vez que o Dashboard ou a tela de Gastos são abertos — nunca duplica nenhum lançamento (nem o do mês corrente já pré-gerado). Em meses com menos dias que o dia configurado (ex: dia 31 em fevereiro), o lançamento cai no último dia válido do mês. Gastos gerados automaticamente aparecem marcados com 🔁 na listagem. A tela **Recorrentes** lista as recorrências ativas (chip verde) e pausadas (chip cinza), com opção de editar, pausar/reativar (sem excluir) e excluir — excluir uma recorrência remove **todos** os lançamentos gerados por ela (passados e futuros) e a própria recorrência, numa transação única; excluir um lançamento dela pela tela de Gastos dispara exatamente a mesma cascata (a interface confirma isso antes). É definitiva — não há como desfazer nem reativar depois.

**Pausar não é o mesmo que apagar o futuro.** Pausar só impede a geração de *novos* lançamentos daqui pra frente — os lançamentos futuros que já foram pré-gerados continuam na lista de Gastos, no Dashboard e em "Próximas contas". Por isso, ao pausar, um diálogo de confirmação diz exatamente quantos lançamentos futuros seguem valendo e lembra que **Excluir** é a ação que remove todos os lançamentos da recorrência — passados e futuros — junto com a própria recorrência. O card de uma recorrência pausada mostra uma linha "Sem novos lançamentos · N lançamento(s) futuro(s) já gerado(s)" — o N vem da mesma leitura de gastos que a aba "Próximas contas" já faz, sem requisição extra. Reativar não recupera os meses que passaram durante a pausa nem re-estende a pré-geração: retoma o lançamento do mês corrente em diante (editar a recorrência é o que reamplia o horizonte pré-gerado).

### Compras parceladas
Diferente de um gasto recorrente (que se repete indefinidamente), uma compra parcelada tem número de parcelas definido (de 2 a 120 — cobre financiamentos de até ~10 anos, não só carro) — no formulário de gasto, a opção "Parcelar compra" (mutuamente exclusiva com "Tornar recorrente") informa o valor total, o número de parcelas e a **data da 1ª parcela** (campo de data, padrão hoje). Ao salvar, TODAS as parcelas já são lançadas de uma vez, como gastos individuais datadas em meses consecutivos **a partir dessa data** — a 1ª cai exatamente na data informada e as seguintes no mesmo dia dos meses seguintes (em meses mais curtos, no último dia válido — ex.: dia 31 em fevereiro), com a descrição sufixada (ex: "Tênis (1/3)", "Tênis (2/3)", "Tênis (3/3)") e o valor dividido em partes iguais — a última parcela é ajustada centavo a centavo para a soma bater exatamente com o valor total. A data da 1ª parcela **pode ser retroativa**: uma compra feita há um mês, só agora lançada, tem a 1ª parcela já vencida (entra como histórico) e as seguintes em "Próximas contas" — o extrato reflete a realidade da compra, não a data em que foi digitada. Limite: a 1ª parcela não pode ser há mais de **12 meses** (um erro de digitação de ano não cria gasto em 2019 — para uma compra mais antiga, lance as parcelas passadas como gastos avulsos) nem a mais de 2 meses no futuro; o backend e o formulário validam a mesma janela. O "dia do mês" da compra (rótulo "Todo dia X" na aba Parceladas) é derivado da data da 1ª parcela. Parcelas aparecem marcadas com 💳 na listagem de Gastos. Uma parcela **não pode ser excluída sozinha** pela listagem de Gastos — isso deixaria o parcelamento permanentemente incoerente (some do extrato, mas a compra continua marcada com o número original de parcelas). O backend rejeita a exclusão e a interface nem oferece a ação: o menu ⋮ de ações do gasto (o mesmo no desktop e no cartão expandido do mobile) mostra o item "Excluir" substituído por um desabilitado — "Parcela: exclua a compra em Parceladas". Para remover, exclua a compra parcelada inteira (abaixo). Editar uma parcela também é restrito: **descrição, valor e data ficam travados** no diálogo (mudá-los quebraria o "(k/N)", a soma das parcelas ou a sequência de meses) — só categoria, subcategoria e orçamento continuam editáveis. O backend ignora mudanças nesses três campos mesmo por chamada direta à API. O app não "repara" parcelamentos já incompletos — parcelas apagadas antes dessas travas continuam ausentes; a compra segue mostrando o número original. A aba **Parceladas** (dentro da tela Recorrentes) lista cada compra com **"N de M parcelas"** logo abaixo dos detalhes (a contagem vem de uma query agregada no backend, no próprio GET da listagem) — quando N < M, um selo âmbar de atenção ("5 de 6 parcelas — uma foi removida") sinaliza o parcelamento incompleto, sem oferecer correção automática. Cada compra tem opção de excluir. Diferente de uma recorrência — que pode ser pausada e reativada — uma compra parcelada não tem esse estado: excluir é a única forma de removê-la, e não há como reativá-la depois. A exclusão remove o registro por completo (nunca fica como um estado "cancelada" pendurado na lista) e as parcelas futuras (ainda não vencidas); as parcelas já vencidas continuam na listagem de Gastos como histórico — e nisso ela difere de excluir uma recorrência, que apaga também os lançamentos já passados.

**Ver detalhe de uma compra parcelada:** o menu ⋮ de cada item na aba Parceladas
tem, como primeira opção, **"Ver detalhe"** — abre um diálogo só de visualização
(nenhuma ação de pagamento aqui; isso continua no próprio menu ⋮ e em Gastos) com
o valor total/parcelas, uma barra de progresso, **quanto já foi pago e quanto
falta pagar em R$** (não só a contagem de parcelas) e a lista das parcelas.
Parcelamentos de até 12x mostram a lista inteira. Acima disso (o caso de um
financiamento em 104x, ~8,6 anos), em vez de um painel por ano até o fim da
compra, só **o ano atual e o ano seguinte** viram painel mês a mês (o atual já
aberto; se ele não existir — 1ª parcela só cai no ano seguinte —, o seguinte é
quem abre). **Tudo a partir de 2 anos à frente** consolida numa única linha final
— "Restante da compra: mais X anos e Y meses · Z parcelas · R\$ total" —, sem
seta, sem clique: é resumo, não mais um painel pra abrir. Dados vêm de
`GET /api/compras-parceladas/{id}/detalhe` (valor pago/restante somados no
backend a partir do status de cada parcela).

### Calendário de contas a pagar
A tela **Recorrentes e Parceladas** tem uma terceira aba, **"Próximas contas"**, com a
visão cronológica das contas ainda **não pagas**: os gastos de uma recorrência (🔁) ou
de uma parcela (💳) que vencem daqui pra frente **mais os já vencidos (atrasados)** —
gastos já pagos não entram (o dinheiro já saiu). Em ordem de data e **agrupados por
mês**, com o **total de cada mês** e a contagem de vencidas no cabeçalho do grupo. Cada
item tem o chip de status e um botão **"Marcar como paga"**; quando o mês tem contas
vencidas, o cabeçalho ganha **"Marcar mês como pago"**. Cada mês é um painel expansível (`mat-expansion-panel`, mesmo
padrão do ranking de Análises): o cabeçalho com o nome do mês e o total fica sempre
visível, e clicar nele abre/fecha a lista de lançamentos daquele mês (dia, ícone da
origem, descrição e valor). O **mês mais próximo já abre expandido**; os demais
começam colapsados, para a agenda inteira caber numa olhada. É uma lista/agenda (não
uma grade de calendário), pensada para funcionar bem no mobile.

Ao abrir, a aba mostra só o **mês corrente** (mais as atrasadas). Um seletor no topo
— **"1 mês"** (padrão) / **"3 meses"** / **"6 meses"** / **"12 meses"** — amplia a
janela; trocar a opção busca de novo, com o spinner só na área da lista. A opção
conta o **mês corrente como o primeiro**: "3 meses" mostra o mês corrente e os dois
seguintes. O **backend** já devolve só o recorte pedido
(`GET /api/gastos/proximas-contas?meses=N`, 1 a 12) em vez do histórico inteiro,
então uma parcelada de 120x não traz nem renderiza os 120 meses de uma vez. As
**atrasadas aparecem em qualquer opção** do seletor — a janela de meses limita só o
que ainda vai vencer. O agrupamento por mês é no cliente,
a partir dos campos que a API devolve; o registro do pagamento (`PATCH /api/gastos/{id}/pagar`
e as ações em lote) usa endpoint próprio. Os badges "N atrasada(s)/N pendente(s)" das
abas Recorrentes e Parceladas e o "N lançamentos futuros já gerados" vêm de um segundo
endpoint agregado (`GET /api/gastos/status-por-fonte`), contado no banco.

No mobile, as três abas dessa tela não cabem lado a lado. Além das setinhas `<` `>`
de paginação do Angular Material, o cabeçalho de abas também rola arrastando o dedo
na horizontal: a diretiva `appAbasArrastaveis` (em `shared/`) libera o
`overflow-x: auto` do container do cabeçalho e converte o deslocamento por
`transform` que o Material usa nas setinhas em rolagem nativa, para os dois
mecanismos não brigarem entre si.

### Orçamentos
Limite de valor por categoria e mês/ano, com edição. A subcategoria é opcional: um orçamento pode ser **geral** (sem subcategoria, cobrindo a categoria inteira) ou **específico** de uma subcategoria — os dois podem coexistir no mesmo mês para a mesma categoria (ex: um orçamento geral de "Lazer" e outro só para "Lazer/Cinema"), sem conflito. Um gasto vinculado ao orçamento específico de uma subcategoria conta só para ele, nunca para o orçamento geral da categoria. O uso de cada orçamento (soma dos gastos vinculados a ele) é classificado em 4 status, exibidos com barra de progresso colorida: **OK** (< 80%), **Atenção** (80–99%), **Completo** (exatamente 100%) e **Ultrapassou** (> 100%). No desktop é uma tabela; **abaixo de 600px vira lista de cartões**, com a barra de progresso em largura total do cartão (na tabela ela ficava numa célula minúscula) e o badge de status sem quebrar linha.

### Metas de economia
No Dashboard, o usuário define uma renda mensal (global, vale para todos os meses) e, por mês, uma meta de economia (valor que deseja ter sobrando no fim daquele mês). O app calcula `renda − total gasto no mês = economia projetada` e compara com a meta, mostrando o progresso numa barra colorida (verde/amarelo/vermelho) que leva em conta quantos dias do mês já passaram. O aviso exibido quando falta informação deixa claro qual dos dois falta: se a renda (global) já está definida mas falta só a meta do mês selecionado, ou se falta definir a renda primeiro.

### Dashboard
No topo aparecem até **três cards de alerta de contas a pagar** (Pendente, de recorrência ou parcela), cada um mostrando o **contador e o valor total** e abrindo uma lista de quitação (marcar cada conta como paga sem sair do Dashboard), do mais urgente ao menos: **contas atrasadas** (vencimento no passado, de qualquer mês — vermelho), **contas que vencem hoje** (âmbar) e **contas a vencer** (vencimento nos próximos 3 dias — azul). Os três são independentes e podem aparecer ao mesmo tempo. Dois cards de totais do mês/ano selecionado (o card do mês também mostra quantos gastos estão cadastrados no período), gráfico de pizza (distribuição por categoria, sempre do mês/ano selecionado, independente do toggle abaixo) e um gráfico de barras que muda de acordo com o toggle "Destacar mês"/"Destacar ano": com "Destacar mês" (padrão), mostra o total gasto em cada dia do mês selecionado (dia 1 até o último dia); com "Destacar ano", mostra os 12 meses (Jan-Dez) do ano selecionado — com rolagem horizontal quando as barras não cabem na tela, especialmente no mobile. Os cards de total e ambos os gráficos são clicáveis (os cards também respondem a Enter e Espaço quando focados pelo teclado), abrindo o detalhamento dos gastos do dia/mês/categoria selecionado.

### Estado de erro de carregamento
Quando uma chamada à API falha (backend fora do ar, erro de rede), Dashboard, Gastos, Orçamentos, Análises, Recorrentes e Categorias mostram um **estado de erro claro** no lugar do conteúdo — ícone, "Não foi possível carregar [X]. Verifique se a API está no ar." e um botão **"Tentar novamente"** que refaz o carregamento — em vez de cair no _empty state_ ("Nenhum gasto cadastrado ainda."), que parecia "sem dados" quando na verdade houve uma falha. É um componente compartilhado (`app-erro-carregamento`, contrapartida do `app-empty-state`). Ao refiltrar (mês/ano/categoria) e a chamada falhar, os dados antigos são limpos antes de mostrar o erro, pra não exibir informação desatualizada com o filtro errado. Na tela de Recorrentes/Parceladas/Próximas contas, cada aba carrega e trata o erro separadamente, com seu próprio botão de repetir. Importante porque qualquer indisponibilidade da API — restart durante o deploy, queda da VM, erro de rede — precisa aparecer como falha explícita, não como "você não tem nada cadastrado".

### Análises
Tela dedicada com três recursos de análise do mês/ano selecionado (mesmo seletor do Dashboard): um **ranking de categorias** (maior para o menor gasto, com emoji, valor e percentual do total do mês), expansível para ver o ranking de subcategorias dentro de cada categoria; uma **comparação com o mês anterior**, categoria a categoria, mostrando a variação em valor e percentual com uma seta ↑/↓ indicando alta ou queda — sem cor: gastar mais numa categoria não é intrinsecamente "ruim", e o vermelho/verde fica reservado aos status de orçamento — e uma marcação "Nova" para categorias sem gasto no mês anterior — cada linha é um painel expansível (mesmo padrão do ranking) que abre um detalhamento com os totais dos dois meses lado a lado e a variação em valor absoluto; e um **alerta visual** (badge laranja) quando uma categoria sozinha consome mais de 30% da renda mensal já cadastrada (feature de Metas de Economia) — sem renda cadastrada, o alerta simplesmente não aparece, sem afetar o resto da tela.

### Exportação e importação de planilhas (.xlsx)
Exportação de todos os gastos para `.xlsx` (incluindo a coluna Subcategoria), download de um modelo de planilha para importação, e um fluxo guiado de importação que revisa cada linha, detecta duplicatas e possíveis edições de gastos já cadastrados, e sugere automaticamente o vínculo com orçamentos existentes (priorizando o orçamento específico da subcategoria da linha, com o geral da categoria como alternativa) antes de confirmar a gravação em lote. Na exportação (e no modelo), qualquer campo de texto que comece com `=`, `+`, `-`, `@` ou tab é prefixado com um apóstrofo antes de ir para a célula, para que o Excel/LibreOffice o trate como texto puro e nunca execute o conteúdo como fórmula (proteção contra _CSV/formula injection_). Categoria e subcategoria na planilha continuam sendo texto simples (sem emoji): ao importar, cada texto é resolvido contra as categorias/subcategorias já existentes do usuário (sem diferenciar maiúsculas/minúsculas) e, se não houver uma correspondente, uma categoria/subcategoria privada nova é criada automaticamente (com emoji padrão, editável depois em "Gerenciar Categorias"). Planilhas antigas, de antes da coluna Subcategoria existir, continuam sendo importadas normalmente.

Além da revisão no navegador, o **backend tem uma checagem própria de duplicata** na importação: cada linha é enviada com `?deduplicar=true` e, se já existir um gasto com a mesma descrição (ignorando caixa e espaços), o mesmo valor e a mesma data, a API recusa a linha com `409` e ela é contada como "já cadastrada", não como falha. É uma rede de segurança para o caso de a detecção do navegador não ter rodado (ex.: a busca do histórico falhou e todas as linhas foram tratadas como novas) — sem ela, reimportar a mesma planilha nesse cenário criaria cópias de tudo. O cadastro manual de um gasto (**"Novo gasto"**) não passa por essa checagem e continua aceitando dois gastos idênticos no mesmo dia de propósito.

### Campos de valor monetário
Todos os campos de valor (Valor do gasto, Valor Limite do orçamento, Renda mensal, Meta de economia) usam uma máscara de digitação estilo "caixa registradora": os dígitos entram da direita para a esquerda (centavos primeiro), com suporte completo a Backspace, seleção de texto e colar — funcionando de forma idêntica em desktop e mobile.

### Campo de data
O campo Data do formulário de gasto aceita tanto a digitação manual quanto a seleção pelo calendário. Ao digitar, uma máscara insere as barras automaticamente (`dd/mm/aaaa`) e ignora caracteres não numéricos; o texto é interpretado por um `DateAdapter` pt-BR próprio (aceita `/`, `-` ou `.` como separador, ano com 2 ou 4 dígitos e os 8 dígitos colados), que devolve uma data válida ou nada — nunca uma data inválida que passe despercebida (o `NativeDateAdapter` do Angular Material faz `Date.parse` no texto e, para `dd/mm/aaaa`, produzia um `Invalid Date` que só quebrava na hora de salvar).

### Identidade visual e tema claro/escuro
A interface usa uma **paleta neutra quente** (cinzas com viés bege, não azulados) com um **acento único azul-petróleo** que substitui o roxo/índigo padrão do Angular Material em toda parte: aba ativa, botão primário, link, foco de campo, item ativo da bottom nav. O verde, o âmbar e o vermelho ficam reservados aos **indicadores de status** ("bom / alerta / ruim": orçamento, meta de economia, recorrência ativa, validação de importação) — não como enfeite. Como o acento é azul, o verde de "em dia" nunca compete com ele. A toolbar é uma superfície neutra com uma borda inferior sutil, não uma faixa colorida de largura total.

O acento e as superfícies vêm do theming M3 do Angular Material (`mat.define-theme`), com as paletas geradas em `src/m3-theme.scss` (`ng generate @angular/material:m3-theme`, primary `#1F6F8B` + neutral quente) — cobre toolbar, abas, cards, tabelas, diálogos, campos e a bottom nav do mobile, inclusive as telas de autenticação (Login, Cadastro, Esqueci/Redefinir senha), que herdam o tema mesmo fora do "shell" principal porque ele é aplicado no `<html>` antes do Angular carregar. Um botão no cabeçalho (ícone de sol/lua) alterna claro/escuro; o app **abre sempre no claro** até a pessoa escolher escuro dentro dele (não segue o `prefers-color-scheme` do sistema). Feita a escolha, ela é salva no `localStorage` e reaplicada por um script inline no `index.html` antes do Angular subir, então a página já abre no tema escolhido, sem "flash".

Elementos que não são componentes Material (bottom nav, cards custom, caixa de informação, trilha de barra de progresso, borda do card em destaque, sombras) usam **tokens CSS próprios** definidos em `styles.scss` com valor por tema — `--fundo-pagina`/`--fundo-superficie`, `--texto-pagina`/`--texto-secundario`/`--texto-terciario`, `--borda`, `--acento-primario`, `--fundo-aviso`/`--texto-aviso`, `--trilha-neutra`, `--sombra-cartao`/`--sombra-hover`/`--sombra-nav` — alinhados à paleta neutra que o Material gera, em vez de cores fixas. As **cores semânticas de status** (badges OK/Atenção/Ultrapassou dos orçamentos, barra da Meta de Economia, chip "Ativo" de um gasto recorrente, alerta de % da renda em Análises, contagem de linhas válidas/com erro no fluxo de importação) passam pelos tokens `--status-ok-*`, `--status-atencao-*`, `--status-critico-*`: no claro são tint claro + texto forte; no escuro viram tint translúcido + texto claro, pra não brilharem como blocos pastel sobre o fundo escuro. Verde/âmbar/vermelho aparecem só nesses indicadores de "bom/alerta/ruim" — não como enfeite (a variação de gasto em Análises, por exemplo, indica direção só com uma seta ↑/↓, sem cor). Status "Completo" de um orçamento de mês encerrado é neutro (estado arquivado). Os gráficos do Dashboard (Chart.js, que desenha em canvas e não lê variável CSS) recebem cores equivalentes por código, adaptadas ao tema — texto, eixos, grade. Na pizza de distribuição por categoria, **a cor é fixa por posição no gráfico**, não pela identidade da categoria: a fatia de maior gasto do mês é sempre o azul-petróleo da identidade visual, a segunda maior é sempre a próxima cor da paleta, e assim por diante — então a mesma categoria pode sair com cor diferente de um mês pro outro (num mês só com "Lazer" a fatia é azul; num mês em que "Alimentação" gasta mais, "Lazer" pode sair laranja). Troca consciente: antes a cor era fixa por categoria, e o azul só aparecia quando a categoria na 1ª posição da lista do usuário tinha gasto naquele mês — podendo sumir por meses seguidos. São 12 cores numa paleta qualitativa "retrô" (base ColorBrewer Dark2), o suficiente pras 11 categorias padrão do sistema sem repetir; da 13ª em diante as cores se repetem. Os 66 pares foram checados para deuteranopia/protanopia (dois tons foram escurecidos por causa disso: o tijolo e o ocre) — como a ordem das fatias segue o gasto (não mais a identidade da categoria), qualquer par de cores pode ficar adjacente na pizza, cenário que a checagem já cobria. Gastos legados sem categoria gerida caem num cinza neutro fora da paleta e não disputam posição nessa contagem (não deslocam a cor das categorias reais). A fatia de maior gasto do mês fica destacada saindo do anel (`offset`) além de ser sempre o azul-petróleo — os dois destaques (geométrico e de cor) sempre coincidem na mesma fatia. Ao passar o cursor, a fatia só clareia a própria cor e "salta" mais um pouco (`hoverBackgroundColor` + `hoverOffset` explícitos, sem depender do realce automático do Chart.js, que satura e escurece).

### PWA (app instalável)
O frontend é um Progressive Web App: pode ser instalado a partir do navegador e abre em janela própria, sem a barra de endereço do navegador. Um botão "Instalar app" (cabeçalho no desktop, menu "Mais" no mobile) aparece automaticamente quando o navegador sinaliza que a instalação é possível (evento `beforeinstallprompt`, Chrome/Edge/Android) e o app ainda não está instalado, e dispara o prompt nativo de instalação ao ser clicado — some sozinho depois de instalado (evento `appinstalled`) ou depois de usado. Tanto no iOS Safari quanto no Android/Chrome, que não garantem esse evento (o Safari nunca dispara; o Chrome também suprime por um tempo depois que o app é instalado e desinstalado), o botão aparece do mesmo jeito e o clique mostra instruções de instalação manual — "Compartilhar" → "Adicionar à Tela de Início" no iOS, menu ⋮ do Chrome no Android (sem citar o nome exato da opção, que varia entre versões) — já que nesses casos não dá pra disparar a instalação por código. No Chrome/Android o prompt de instalação aparece na versão "rica" (com nome, descrição e capturas de tela do app) porque o `manifest.json` declara o campo `screenshots` — uma imagem `wide` (desktop) e uma `narrow` (celular) do Dashboard, em `public/screenshots/`. Um service worker (gerado pelo `@angular/service-worker`) faz cache apenas dos arquivos estáticos da build (JS, CSS, HTML, ícones) para carregamento mais rápido em visitas repetidas; chamadas à API nunca são cacheadas, sempre vão direto para o backend. Só funciona em contexto seguro (HTTPS ou `localhost`) — em produção já funciona automaticamente, já que o Render Static Site serve com HTTPS.

Quando uma build nova é publicada, o app detecta a versão nova assim que o service worker termina de baixá-la (`SwUpdate`, verificado tanto na abertura do app quanto pelo Angular periodicamente) e avisa com um snackbar "Atualizar" — não recarrega sozinho, pra não interromper um cadastro ou uma importação de planilha em andamento. Se o cache do service worker ficar num estado inconsistente e o app não conseguir se recuperar sozinho, ele recarrega a página automaticamente.

## Tecnologias

- **Backend**: Java 17, Maven, Spring Boot 4, Spring Data JPA, Spring Security + JWT (jjwt), Spring Mail
- **Banco de dados**: PostgreSQL (Neon em produção)
- **Frontend**: Angular 18 (standalone components), Angular Material, Chart.js/ng2-charts (gráficos), xlsx-js-style (exportação/importação de planilhas), `@angular/service-worker` (PWA instalável)
- **Deploy**: frontend no Render (Static Site, auto-deploy no push); API numa VM da Oracle Cloud (systemd + nginx), deploy automático via GitHub Actions no push que toque em `controle-gastos-api/` — ver seção "Produção"

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

**API (`controle-gastos-api`):** o schema é versionado com [Flyway](https://flywaydb.org/). A API aplica as migrations (`src/main/resources/db/migration/V*.sql`) sozinha no boot — num banco vazio o Flyway cria tudo do zero; num banco que já tem as tabelas ele grava o baseline (`V1`) e aplica só o que falta. Não é preciso rodar nada à mão, nem localmente nem em produção.

**Console Java (`controle-gastos`):** não usa Spring nem Flyway. Rode o script `controle-gastos/src/main/resources/schema.sql` à mão nesse banco — ele cria as mesmas tabelas (`usuarios`, `gastos`, `orcamentos`, `metas`, `categorias`, `subcategorias`, etc.), é idempotente e espelha o conteúdo do `V1__baseline.sql` da API.

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

1. PostgreSQL no ar, com o banco `controle_gastos` criado (a API cria as tabelas via Flyway no boot; o console precisa do `schema.sql` rodado à mão)
2. API (`controle-gastos-api`) — porta 8080
3. Frontend (`controle-gastos-web`) — porta 4200

O console (`controle-gastos`) é independente e pode ser executado sem a API ou o frontend, desde que o banco esteja disponível.
