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
Cadastro e login com senha (hash no banco), sessão persistida em `localStorage` (sobrevive a F5 e a fechar/reabrir a aba) com token JWT válido por 6 horas, logout automático quando o token expira, e recuperação de senha por e-mail (link com token válido por 1 hora).

### Categorias e subcategorias
Categoria e subcategoria são entidades geridas (não mais texto livre), cada uma com um emoji, escolhidas via dropdown nos formulários de gasto e orçamento. Existem **categorias padrão do sistema** (Alimentação, Transporte, Moradia, Saúde, Educação, Lazer, Compras, Contas e serviços, Trabalho, Viagens, Outros — visíveis para todos os usuários, fixas) e **categorias personalizadas** (criadas por cada usuário, privadas — só quem criou vê e pode editar/excluir). Subcategoria é sempre filha de uma categoria específica e segue a mesma distinção: existem **subcategorias padrão do sistema** (um conjunto amplo pré-cadastrado em cada categoria padrão, ex. Cafés e lanches/Bebidas em Alimentação, Fatura do cartão/Empréstimos em Finanças) e **subcategorias personalizadas** (criadas por cada usuário, privadas). Na tela **Gerenciar Categorias**, itens padrão do sistema aparecem com um chip "Sistema" e não podem ser editados nem excluídos; itens personalizados mostram os botões de editar/excluir normalmente, cada um abrindo o mesmo mini-diálogo de nome + emoji (com a mesma paleta curada de sugestões) usado tanto para categoria quanto para subcategoria. Dá para criar uma categoria ou subcategoria nova sem sair do formulário de gasto/orçamento (opção "+ Nova..." no fim do dropdown, com esse mesmo mini-diálogo), além da tela dedicada **Gerenciar Categorias** para editar/excluir as próprias e organizar as subcategorias de cada uma. Uma categoria ou subcategoria em uso em algum gasto ou orçamento não pode ser excluída.

As **categorias** (só categorias por enquanto, não subcategorias) podem ser reordenadas manualmente na tela **Gerenciar Categorias**, com setas de mover pra cima/pra baixo ao lado de cada uma (a seta pra cima some na primeira categoria da lista, a pra baixo some na última). A ordem escolhida é uma preferência pessoal de cada usuário — como categorias padrão do sistema são compartilhadas entre todos, a ordem que um usuário define nunca afeta o que outro usuário vê. Sem nenhuma personalização, a ordem padrão é: categorias do sistema primeiro, depois as pessoais, cada grupo em ordem alfabética. A ordem escolhida persiste entre sessões e é refletida automaticamente em todo o app: dropdown de categoria no formulário de gasto/orçamento, e o filtro "Filtrar por categoria" na tela de Gastos.

### Gastos
CRUD completo (descrição, valor, categoria, subcategoria opcional, data), listagem por categoria/período/mês, exportação e importação em lote via planilha `.xlsx` (ver abaixo). Cada gasto pode ser vinculado a um orçamento do mês/categoria (ou categoria+subcategoria) correspondente. A seção **Filtros** reúne um seletor de Mês/Ano no topo (com o mês atual como padrão), um botão que alterna entre "Ver todos os meses" e "Ver mês atual", e um dropdown "Filtrar por categoria" (listando só categorias com pelo menos um gasto cadastrado, para não poluir com categorias nunca usadas) — os dois filtros funcionam em conjunto.

### Gastos recorrentes
Um gasto fixo (aluguel, assinatura etc.) pode ser marcado como recorrente — no próprio formulário de gasto ("Tornar recorrente (todo mês)") ou na tela dedicada **Recorrentes** — informando o dia do mês em que deve ser lançado e "Gerar para os próximos meses" (1 a 12, padrão 12): ao salvar, os gastos desses meses já são lançados imediatamente (a partir do mês atual), então meses futuros já aparecem no Dashboard/Análises sem precisar esperar o usuário abrir aquele mês depois que ele chegar. Passado esse horizonte pré-gerado, a recorrência continua lançando os meses seguintes normalmente conforme o tempo passa: como o backend roda no plano gratuito do Render (o serviço "dorme" e não tem cron job garantido), esse lançamento é verificado sob demanda, de forma transparente (sem popup), toda vez que o Dashboard ou a tela de Gastos são abertos — nunca duplica nenhum lançamento. Em meses com menos dias que o dia configurado (ex: dia 31 em fevereiro), o lançamento cai no último dia válido do mês. Gastos gerados automaticamente aparecem marcados com 🔁 na listagem. A tela **Recorrentes** lista as recorrências ativas (chip verde) e pausadas (chip cinza), com opção de editar, pausar/reativar (sem excluir) e excluir — excluir uma recorrência remove os gastos a partir de hoje (incluindo os pré-gerados de meses futuros que ainda não venceram), mas mantém intactos os gastos de meses passados como histórico.

### Compras parceladas
Diferente de um gasto recorrente (que se repete indefinidamente), uma compra parcelada tem número de parcelas definido — no formulário de gasto, a opção "Parcelar compra" (mutuamente exclusiva com "Tornar recorrente") informa o valor total, o número de parcelas e o dia do mês. Ao salvar, TODAS as parcelas já são lançadas de uma vez, como gastos individuais datadas em meses consecutivos a partir da PRÓXIMA ocorrência futura do dia escolhido — se esse dia já passou (ou é hoje) no mês atual, a primeira parcela começa no mês seguinte, nunca "retroativa" num dia que já ficou no passado deste mês (mesmo ajuste de dia inválido em meses curtos dos gastos recorrentes), com a descrição sufixada (ex: "Tênis (1/3)", "Tênis (2/3)", "Tênis (3/3)") e o valor dividido em partes iguais — a última parcela é ajustada centavo a centavo para a soma bater exatamente com o valor total. Parcelas aparecem marcadas com 💳 na listagem de Gastos. A aba **Parceladas** (dentro da tela Recorrentes) lista as compras parceladas com opção de excluir — diferente de excluir uma recorrência, é uma ação definitiva (a compra não pode ser reativada) que remove o registro por completo (nunca fica como um estado "cancelada" pendurado na lista) e as parcelas futuras (ainda não vencidas); as parcelas já vencidas continuam na listagem de Gastos como histórico.

### Orçamentos
Limite de valor por categoria e mês/ano, com edição. A subcategoria é opcional: um orçamento pode ser **geral** (sem subcategoria, cobrindo a categoria inteira) ou **específico** de uma subcategoria — os dois podem coexistir no mesmo mês para a mesma categoria (ex: um orçamento geral de "Lazer" e outro só para "Lazer/Cinema"), sem conflito. Um gasto vinculado ao orçamento específico de uma subcategoria conta só para ele, nunca para o orçamento geral da categoria. O uso de cada orçamento (soma dos gastos vinculados a ele) é classificado em 4 status, exibidos com barra de progresso colorida: **OK** (< 80%), **Atenção** (80–99%), **Completo** (exatamente 100%) e **Ultrapassou** (> 100%).

### Metas de economia
No Dashboard, o usuário define uma renda mensal (global, vale para todos os meses) e, por mês, uma meta de economia (valor que deseja ter sobrando no fim daquele mês). O app calcula `renda − total gasto no mês = economia projetada` e compara com a meta, mostrando o progresso numa barra colorida (verde/amarelo/vermelho) que leva em conta quantos dias do mês já passaram. O aviso exibido quando falta informação deixa claro qual dos dois falta: se a renda (global) já está definida mas falta só a meta do mês selecionado, ou se falta definir a renda primeiro.

### Dashboard
Cards de totais do mês/ano selecionado, gráfico de pizza (distribuição por categoria, sempre do mês/ano selecionado, independente do toggle abaixo) e um gráfico de barras que muda de acordo com o toggle "Destacar mês"/"Destacar ano": com "Destacar mês" (padrão), mostra o total gasto em cada dia do mês selecionado (dia 1 até o último dia); com "Destacar ano", mostra os 12 meses (Jan-Dez) do ano selecionado — com rolagem horizontal quando as barras não cabem na tela, especialmente no mobile. Ambos os gráficos são clicáveis, abrindo o detalhamento dos gastos do dia/mês/categoria selecionado.

### Análises
Tela dedicada com três recursos de análise do mês/ano selecionado (mesmo seletor do Dashboard): um **ranking de categorias** (maior para o menor gasto, com emoji, valor e percentual do total do mês), expansível para ver o ranking de subcategorias dentro de cada categoria; uma **comparação com o mês anterior**, categoria a categoria, mostrando a variação em valor e percentual com seta e cor indicando alta (vermelho) ou queda (verde), e uma marcação "Nova" para categorias sem gasto no mês anterior; e um **alerta visual** (badge laranja) quando uma categoria sozinha consome mais de 30% da renda mensal já cadastrada (feature de Metas de Economia) — sem renda cadastrada, o alerta simplesmente não aparece, sem afetar o resto da tela.

### Exportação e importação de planilhas (.xlsx)
Exportação de todos os gastos para `.xlsx` (incluindo a coluna Subcategoria), download de um modelo de planilha para importação, e um fluxo guiado de importação que revisa cada linha, detecta duplicatas e possíveis edições de gastos já cadastrados, e sugere automaticamente o vínculo com orçamentos existentes (priorizando o orçamento específico da subcategoria da linha, com o geral da categoria como alternativa) antes de confirmar a gravação em lote. Categoria e subcategoria na planilha continuam sendo texto simples (sem emoji): ao importar, cada texto é resolvido contra as categorias/subcategorias já existentes do usuário (sem diferenciar maiúsculas/minúsculas) e, se não houver uma correspondente, uma categoria/subcategoria privada nova é criada automaticamente (com emoji padrão, editável depois em "Gerenciar Categorias"). Planilhas antigas, de antes da coluna Subcategoria existir, continuam sendo importadas normalmente.

### Campos de valor monetário
Todos os campos de valor (Valor do gasto, Valor Limite do orçamento, Renda mensal, Meta de economia) usam uma máscara de digitação estilo "caixa registradora": os dígitos entram da direita para a esquerda (centavos primeiro), com suporte completo a Backspace, seleção de texto e colar — funcionando de forma idêntica em desktop e mobile.

### Tema claro/escuro
Um botão no cabeçalho (ícone de sol/lua, ao lado do nome do usuário) alterna entre tema claro e escuro, usando as capacidades de theming M3 do Angular Material (`mat.define-theme`), cobrindo toolbar, abas, cards, tabelas, diálogos e a bottom nav do mobile — inclusive as telas de autenticação (Login, Cadastro, Esqueci/Redefinir senha), que ficam fora do "shell" principal mas herdam o tema corretamente, já que ele é aplicado no `<html>` antes do Angular carregar. Os gráficos do Dashboard (Chart.js) também adaptam a cor do texto, dos eixos e da grade para continuarem legíveis no escuro. A preferência é salva no `localStorage` e aplicada antes do Angular carregar (via script inline no `index.html`), então a página já abre no tema certo, sem "flash" do tema errado.

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
