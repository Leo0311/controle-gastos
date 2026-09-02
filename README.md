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
- **`controle-gastos-web/`** — SPA em Angular que consome a API para oferecer telas de Login/Cadastro, Dashboard, Gastos, Orçamentos, Análises, Categorias e Recorrentes, responsiva em mobile. A navegação entre as seções é por abas no topo em desktop; no mobile é por uma barra fixa no rodapé (bottom navigation, estilo apps nativos) com acesso direto a Dashboard/Gastos/Orçamentos/Análises e um item "Mais" que abre um menu com Categorias e Recorrentes (as 6 seções não cabem bem lado a lado em telas de 375px) — também dá pra trocar de seção deslizando o dedo pra esquerda/direita (mesma ordem, incluindo as agrupadas em "Mais") em telas até 600px, gesto que é ignorado perto das bordas da tela (evita brigar com o "voltar" nativo do navegador/sistema) e nunca interrompe a rolagem vertical normal da página.

## Funcionalidades

### Autenticação
Cadastro e login com senha (hash BCrypt no banco), sessão persistida em `localStorage` (sobrevive a F5 e a fechar/reabrir a aba) com token JWT válido por 6 horas, logout automático quando o token expira, e recuperação de senha por e-mail (link com token válido por 1 hora).

Os endpoints públicos de autenticação (`/api/auth/login`, `/api/auth/cadastro`, `/api/auth/esqueci-senha`) têm **rate limiting** por IP de origem — no máximo 5 requisições por minuto por endpoint; ao exceder, a API responde `429 Too Many Requests` com um cabeçalho `Retry-After`. Isso limita força bruta de senha, enumeração de contas e uso do endpoint de recuperação para bombardeio de e-mail.

Trocar a senha (pelo link de recuperação) **invalida na hora qualquer token JWT emitido antes da troca**: cada usuário tem uma "versão de token" (`token_version`) que vai embutida no JWT no login e é reconferida a cada requisição — um token roubado deixa de funcionar assim que a vítima redefine a senha, sem depender da expiração de 6 horas.

### Categorias e subcategorias
Categoria e subcategoria são entidades geridas (não mais texto livre), cada uma com um emoji, escolhidas via dropdown nos formulários de gasto e orçamento. Existem **categorias padrão do sistema** (Alimentação, Transporte, Moradia, Saúde, Educação, Lazer, Compras, Contas e serviços, Trabalho, Viagens, Outros — visíveis para todos os usuários, fixas) e **categorias personalizadas** (criadas por cada usuário, privadas — só quem criou vê e pode editar/excluir). Subcategoria é sempre filha de uma categoria específica e segue a mesma distinção: existem **subcategorias padrão do sistema** (um conjunto amplo pré-cadastrado em cada categoria padrão, ex. Cafés e lanches/Bebidas em Alimentação, Fatura do cartão/Empréstimos em Finanças) e **subcategorias personalizadas** (criadas por cada usuário, privadas). Na tela **Gerenciar Categorias**, itens padrão do sistema aparecem com um chip "Sistema" e não podem ser editados nem excluídos; itens personalizados mostram os botões de editar/excluir normalmente, cada um abrindo o mesmo mini-diálogo de nome + emoji (com a mesma paleta curada de sugestões) usado tanto para categoria quanto para subcategoria. Dá para criar uma categoria ou subcategoria nova sem sair do formulário de gasto/orçamento (opção "+ Nova..." no fim do dropdown, com esse mesmo mini-diálogo), além da tela dedicada **Gerenciar Categorias** para editar/excluir as próprias e organizar as subcategorias de cada uma. Uma categoria ou subcategoria ainda em uso não pode ser excluída — a checagem cobre gastos, orçamentos, gastos recorrentes **e compras parceladas**, inclusive lançamentos de meses passados ou recorrentes pausados que não aparecem na tela atual. Quando a exclusão é bloqueada, um diálogo mostra exatamente o que está usando (ex.: "em uso em 2 gastos, 1 orçamento e 1 gasto recorrente"), para o usuário saber o que reclassificar ou remover primeiro.

As **categorias** (só categorias por enquanto, não subcategorias) podem ser reordenadas manualmente na tela **Gerenciar Categorias** arrastando e soltando (drag & drop, via Angular CDK): cada linha tem uma alça (ícone ⋮⋮ à esquerda) que se segura para arrastar a categoria para a posição desejada — funciona com o mouse e com o toque no celular. Categorias do sistema e pessoais são reordenadas juntas, sem distinção. Ao soltar, a lista já se reorganiza na hora e a ordem completa é enviada de uma vez para o backend (`PUT /api/categorias/ordem`); se a gravação falhar, a ordem anterior é restaurada. A ordem escolhida é uma preferência pessoal de cada usuário — como categorias padrão do sistema são compartilhadas entre todos, a ordem que um usuário define nunca afeta o que outro usuário vê. Sem nenhuma personalização, a ordem padrão é: categorias do sistema primeiro, depois as pessoais, cada grupo em ordem alfabética. A ordem escolhida persiste entre sessões e é refletida automaticamente em todo o app: dropdown de categoria no formulário de gasto/orçamento, e o filtro "Filtrar por categoria" na tela de Gastos.

### Gastos
CRUD completo (descrição, valor, categoria, subcategoria opcional, data), listagem por categoria/período/mês, exportação e importação em lote via planilha `.xlsx` (ver abaixo). Cada gasto pode ser vinculado a um orçamento do mês/categoria (ou categoria+subcategoria) correspondente. A seção **Filtros** reúne um seletor de Mês/Ano no topo (com o mês atual como padrão), um botão que alterna entre "Ver todos os meses" e "Ver mês atual", e um dropdown "Filtrar por categoria" (listando só categorias com pelo menos um gasto cadastrado, para não poluir com categorias nunca usadas) — os dois filtros funcionam em conjunto. No mobile os filtros empilham em largura total e o "Filtrar por categoria" sobe para o topo da faixa, pra o painel de opções abrir normalmente pra baixo (colado no rodapé fixo, o overlay abria pra cima, por cima do próprio campo). Gastos gerados por recorrência (🔁) ou parcela (💳) trazem esses ícones com `aria-label` (não só `title`), pra funcionar no toque e em leitor de tela.

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
mudar para outra). Tudo é resolvido no navegador, a partir da lista de gastos que a
API já devolve — sem endpoint novo. Não aparece ao **editar** um gasto existente.

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
O histórico pessoal **sempre** tem prioridade: o dicionário só é consultado quando
o histórico não encontra nada, e termos sem correspondência em nenhum dos dois
continuam sem mostrar sugestão.

### Gastos recorrentes
Um gasto fixo (aluguel, assinatura etc.) pode ser marcado como recorrente — no próprio formulário de gasto ("Tornar recorrente (todo mês)") ou na tela dedicada **Recorrentes** — informando o dia do mês em que deve ser lançado e "Gerar para os próximos meses" (1 a 12, padrão 12): ao salvar, os gastos desses meses já são lançados imediatamente (a partir do mês atual), então meses futuros já aparecem no Dashboard/Análises sem precisar esperar o usuário abrir aquele mês depois que ele chegar. Passado esse horizonte pré-gerado, a recorrência continua lançando os meses seguintes normalmente conforme o tempo passa: como o backend roda no plano gratuito do Render (o serviço "dorme" e não tem cron job garantido), esse lançamento é verificado sob demanda, de forma transparente (sem popup), toda vez que o Dashboard ou a tela de Gastos são abertos — nunca duplica nenhum lançamento. Em meses com menos dias que o dia configurado (ex: dia 31 em fevereiro), o lançamento cai no último dia válido do mês. Gastos gerados automaticamente aparecem marcados com 🔁 na listagem. A tela **Recorrentes** lista as recorrências ativas (chip verde) e pausadas (chip cinza), com opção de editar, pausar/reativar (sem excluir) e excluir — excluir uma recorrência remove os gastos a partir de hoje (incluindo os pré-gerados de meses futuros que ainda não venceram), mas mantém intactos os gastos de meses passados como histórico.

### Compras parceladas
Diferente de um gasto recorrente (que se repete indefinidamente), uma compra parcelada tem número de parcelas definido — no formulário de gasto, a opção "Parcelar compra" (mutuamente exclusiva com "Tornar recorrente") informa o valor total, o número de parcelas e o dia do mês. Ao salvar, TODAS as parcelas já são lançadas de uma vez, como gastos individuais datadas em meses consecutivos a partir da PRÓXIMA ocorrência futura do dia escolhido — se esse dia já passou (ou é hoje) no mês atual, a primeira parcela começa no mês seguinte, nunca "retroativa" num dia que já ficou no passado deste mês (mesmo ajuste de dia inválido em meses curtos dos gastos recorrentes), com a descrição sufixada (ex: "Tênis (1/3)", "Tênis (2/3)", "Tênis (3/3)") e o valor dividido em partes iguais — a última parcela é ajustada centavo a centavo para a soma bater exatamente com o valor total. Parcelas aparecem marcadas com 💳 na listagem de Gastos. A aba **Parceladas** (dentro da tela Recorrentes) lista as compras parceladas com opção de excluir — diferente de excluir uma recorrência, é uma ação definitiva (a compra não pode ser reativada) que remove o registro por completo (nunca fica como um estado "cancelada" pendurado na lista) e as parcelas futuras (ainda não vencidas); as parcelas já vencidas continuam na listagem de Gastos como histórico.

### Calendário de contas a pagar
A tela **Recorrentes e Parceladas** tem uma terceira aba, **"Próximas contas"**, com a
visão cronológica de tudo que já está comprometido para o futuro: todos os gastos com
data igual ou posterior a hoje que vieram de uma recorrência (🔁) ou de uma parcela
(💳), em ordem de data e **agrupados por mês**, com o **total de cada mês** no
cabeçalho do grupo. Cada mês é um painel expansível (`mat-expansion-panel`, mesmo
padrão do ranking de Análises): o cabeçalho com o nome do mês e o total fica sempre
visível, e clicar nele abre/fecha a lista de lançamentos daquele mês (dia, ícone da
origem, descrição e valor). O **mês mais próximo já abre expandido**; os demais
começam colapsados, para a agenda inteira caber numa olhada. É uma lista/agenda (não
uma grade de calendário), pensada para funcionar bem no mobile. Usa os campos
`gastoRecorrenteId`/`compraParceladaId` que a API já devolve — sem endpoint novo.

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
Dois cards de totais do mês/ano selecionado (o card do mês também mostra quantos gastos estão cadastrados no período), gráfico de pizza (distribuição por categoria, sempre do mês/ano selecionado, independente do toggle abaixo) e um gráfico de barras que muda de acordo com o toggle "Destacar mês"/"Destacar ano": com "Destacar mês" (padrão), mostra o total gasto em cada dia do mês selecionado (dia 1 até o último dia); com "Destacar ano", mostra os 12 meses (Jan-Dez) do ano selecionado — com rolagem horizontal quando as barras não cabem na tela, especialmente no mobile. Os cards de total e ambos os gráficos são clicáveis (os cards também respondem a Enter e Espaço quando focados pelo teclado), abrindo o detalhamento dos gastos do dia/mês/categoria selecionado.

### Estado de erro de carregamento
Quando uma chamada à API falha (backend fora do ar, erro de rede), Dashboard, Gastos, Orçamentos, Análises, Recorrentes e Categorias mostram um **estado de erro claro** no lugar do conteúdo — ícone, "Não foi possível carregar [X]. Verifique se a API está no ar." e um botão **"Tentar novamente"** que refaz o carregamento — em vez de cair no _empty state_ ("Nenhum gasto cadastrado ainda."), que parecia "sem dados" quando na verdade houve uma falha. É um componente compartilhado (`app-erro-carregamento`, contrapartida do `app-empty-state`). Ao refiltrar (mês/ano/categoria) e a chamada falhar, os dados antigos são limpos antes de mostrar o erro, pra não exibir informação desatualizada com o filtro errado. Na tela de Recorrentes/Parceladas/Próximas contas, cada aba carrega e trata o erro separadamente, com seu próprio botão de repetir. Importante porque o backend roda no plano gratuito do Render e "dorme" — a primeira requisição depois de um tempo ocioso pode demorar ~30–50s ou falhar, e agora isso aparece como uma falha explícita, não como "você não tem nada cadastrado".

### Análises
Tela dedicada com três recursos de análise do mês/ano selecionado (mesmo seletor do Dashboard): um **ranking de categorias** (maior para o menor gasto, com emoji, valor e percentual do total do mês), expansível para ver o ranking de subcategorias dentro de cada categoria; uma **comparação com o mês anterior**, categoria a categoria, mostrando a variação em valor e percentual com uma seta ↑/↓ indicando alta ou queda — sem cor: gastar mais numa categoria não é intrinsecamente "ruim", e o vermelho/verde fica reservado aos status de orçamento — e uma marcação "Nova" para categorias sem gasto no mês anterior — cada linha é um painel expansível (mesmo padrão do ranking) que abre um detalhamento com os totais dos dois meses lado a lado e a variação em valor absoluto; e um **alerta visual** (badge laranja) quando uma categoria sozinha consome mais de 30% da renda mensal já cadastrada (feature de Metas de Economia) — sem renda cadastrada, o alerta simplesmente não aparece, sem afetar o resto da tela.

### Exportação e importação de planilhas (.xlsx)
Exportação de todos os gastos para `.xlsx` (incluindo a coluna Subcategoria), download de um modelo de planilha para importação, e um fluxo guiado de importação que revisa cada linha, detecta duplicatas e possíveis edições de gastos já cadastrados, e sugere automaticamente o vínculo com orçamentos existentes (priorizando o orçamento específico da subcategoria da linha, com o geral da categoria como alternativa) antes de confirmar a gravação em lote. Na exportação (e no modelo), qualquer campo de texto que comece com `=`, `+`, `-`, `@` ou tab é prefixado com um apóstrofo antes de ir para a célula, para que o Excel/LibreOffice o trate como texto puro e nunca execute o conteúdo como fórmula (proteção contra _CSV/formula injection_). Categoria e subcategoria na planilha continuam sendo texto simples (sem emoji): ao importar, cada texto é resolvido contra as categorias/subcategorias já existentes do usuário (sem diferenciar maiúsculas/minúsculas) e, se não houver uma correspondente, uma categoria/subcategoria privada nova é criada automaticamente (com emoji padrão, editável depois em "Gerenciar Categorias"). Planilhas antigas, de antes da coluna Subcategoria existir, continuam sendo importadas normalmente.

### Campos de valor monetário
Todos os campos de valor (Valor do gasto, Valor Limite do orçamento, Renda mensal, Meta de economia) usam uma máscara de digitação estilo "caixa registradora": os dígitos entram da direita para a esquerda (centavos primeiro), com suporte completo a Backspace, seleção de texto e colar — funcionando de forma idêntica em desktop e mobile.

### Campo de data
O campo Data do formulário de gasto aceita tanto a digitação manual quanto a seleção pelo calendário. Ao digitar, uma máscara insere as barras automaticamente (`dd/mm/aaaa`) e ignora caracteres não numéricos; o texto é interpretado por um `DateAdapter` pt-BR próprio (aceita `/`, `-` ou `.` como separador, ano com 2 ou 4 dígitos e os 8 dígitos colados), que devolve uma data válida ou nada — nunca uma data inválida que passe despercebida (o `NativeDateAdapter` do Angular Material faz `Date.parse` no texto e, para `dd/mm/aaaa`, produzia um `Invalid Date` que só quebrava na hora de salvar).

### Identidade visual e tema claro/escuro
A interface usa uma **paleta neutra quente** (cinzas com viés bege, não azulados) com um **acento único azul-petróleo** que substitui o roxo/índigo padrão do Angular Material em toda parte: aba ativa, botão primário, link, foco de campo, item ativo da bottom nav. O verde, o âmbar e o vermelho ficam reservados aos **indicadores de status** ("bom / alerta / ruim": orçamento, meta de economia, recorrência ativa, validação de importação) — não como enfeite. Como o acento é azul, o verde de "em dia" nunca compete com ele. A toolbar é uma superfície neutra com uma borda inferior sutil, não uma faixa colorida de largura total.

O acento e as superfícies vêm do theming M3 do Angular Material (`mat.define-theme`), com as paletas geradas em `src/m3-theme.scss` (`ng generate @angular/material:m3-theme`, primary `#1F6F8B` + neutral quente) — cobre toolbar, abas, cards, tabelas, diálogos, campos e a bottom nav do mobile, inclusive as telas de autenticação (Login, Cadastro, Esqueci/Redefinir senha), que herdam o tema mesmo fora do "shell" principal porque ele é aplicado no `<html>` antes do Angular carregar. Um botão no cabeçalho (ícone de sol/lua) alterna claro/escuro; o app **abre sempre no claro** até a pessoa escolher escuro dentro dele (não segue o `prefers-color-scheme` do sistema). Feita a escolha, ela é salva no `localStorage` e reaplicada por um script inline no `index.html` antes do Angular subir, então a página já abre no tema escolhido, sem "flash".

Elementos que não são componentes Material (bottom nav, cards custom, caixa de informação, trilha de barra de progresso, borda do card em destaque, sombras) usam **tokens CSS próprios** definidos em `styles.scss` com valor por tema — `--fundo-pagina`/`--fundo-superficie`, `--texto-pagina`/`--texto-secundario`/`--texto-terciario`, `--borda`, `--acento-primario`, `--fundo-aviso`/`--texto-aviso`, `--trilha-neutra`, `--sombra-cartao`/`--sombra-hover`/`--sombra-nav` — alinhados à paleta neutra que o Material gera, em vez de cores fixas. As **cores semânticas de status** (badges OK/Atenção/Ultrapassou dos orçamentos, barra da Meta de Economia, chip "Ativo" de um gasto recorrente, alerta de % da renda em Análises, contagem de linhas válidas/com erro no fluxo de importação) passam pelos tokens `--status-ok-*`, `--status-atencao-*`, `--status-critico-*`: no claro são tint claro + texto forte; no escuro viram tint translúcido + texto claro, pra não brilharem como blocos pastel sobre o fundo escuro. Verde/âmbar/vermelho aparecem só nesses indicadores de "bom/alerta/ruim" — não como enfeite (a variação de gasto em Análises, por exemplo, indica direção só com uma seta ↑/↓, sem cor). Status "Completo" de um orçamento de mês encerrado é neutro (estado arquivado). Os gráficos do Dashboard (Chart.js, que desenha em canvas e não lê variável CSS) recebem cores equivalentes por código, adaptadas ao tema — texto, eixos, grade. As fatias da pizza usam uma paleta qualitativa "retrô" de 10 cores (base ColorBrewer Dark2, com dois tons escurecidos: o petróleo pra não repetir o acento, e o ocre pra separar do verde-oliva sob daltonismo); os pares vizinhos na ordem foram checados para deuteranopia/protanopia. Ao passar o cursor, a fatia só clareia a própria cor e "salta" um pouco (`hoverBackgroundColor` + `hoverOffset` explícitos) — o realce automático do Chart.js satura e escurece, o que aproximava fatias vizinhas.

### PWA (app instalável)
O frontend é um Progressive Web App: pode ser instalado a partir do navegador e abre em janela própria, sem a barra de endereço do navegador. Um botão "Instalar app" (cabeçalho no desktop, menu "Mais" no mobile) aparece automaticamente quando o navegador sinaliza que a instalação é possível (evento `beforeinstallprompt`, Chrome/Edge/Android) e o app ainda não está instalado, e dispara o prompt nativo de instalação ao ser clicado — some sozinho depois de instalado (evento `appinstalled`) ou depois de usado. No iOS Safari, que não dispara esse evento, o botão aparece do mesmo jeito mas o clique mostra instruções de instalação manual ("Compartilhar" → "Adicionar à Tela de Início"), já que lá não dá pra disparar a instalação por código. Um service worker (gerado pelo `@angular/service-worker`) faz cache apenas dos arquivos estáticos da build (JS, CSS, HTML, ícones) para carregamento mais rápido em visitas repetidas; chamadas à API nunca são cacheadas, sempre vão direto para o backend. Só funciona em contexto seguro (HTTPS ou `localhost`) — em produção já funciona automaticamente, já que o Render Static Site serve com HTTPS.

## Tecnologias

- **Backend**: Java 17, Maven, Spring Boot 4, Spring Data JPA, Spring Security + JWT (jjwt), Spring Mail
- **Banco de dados**: PostgreSQL (Neon em produção)
- **Frontend**: Angular 18 (standalone components), Angular Material, Chart.js/ng2-charts (gráficos), xlsx-js-style (exportação/importação de planilhas), `@angular/service-worker` (PWA instalável)
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

O script é idempotente: pode (e deve) ser reexecutado num banco já existente ao atualizar a aplicação, para aplicar migrações incrementais. A mais recente adiciona a coluna `usuarios.token_version` (usada na revogação de JWT ao trocar a senha) — usuários já existentes assumem versão `0` (`DEFAULT 0`), então reexecutar o script não desloga ninguém.

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
