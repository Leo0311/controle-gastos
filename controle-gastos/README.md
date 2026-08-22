# Controle de Gastos

Aplicação de console em Java (Maven) para controle de gastos pessoais, com persistência em PostgreSQL.

## Estrutura do projeto

```
controle-gastos/
├── pom.xml
├── README.md
└── src/main/
    ├── java/com/controlegastos/
    │   ├── Main.java              # Menu de console
    │   ├── model/Gasto.java       # Entidade Gasto
    │   ├── dao/GastoDAO.java      # Acesso ao banco (JDBC)
    │   ├── service/GastoService.java  # Regras de negócio/validações
    │   └── util/ConexaoBD.java    # Conexão com o PostgreSQL
    └── resources/
        ├── database.properties    # Configuração de conexão
        └── schema.sql             # Script de criação da tabela
```

## Como abrir no IntelliJ

1. Extraia o .zip em uma pasta de sua preferência.
2. No IntelliJ: **File > Open...** e selecione a pasta `controle-gastos`.
3. O IntelliJ vai detectar o `pom.xml` e importar como projeto Maven automaticamente
   (aguarde o download das dependências).

## Configurar o banco PostgreSQL

1. Crie o banco de dados:
   ```sql
   CREATE DATABASE controle_gastos;
   ```
2. Conectado a esse banco, rode o script `src/main/resources/schema.sql`
   (cria a tabela `gastos`).
3. Edite `src/main/resources/database.properties` com suas credenciais reais:
   ```properties
   db.url=jdbc:postgresql://localhost:5432/controle_gastos
   db.user=SEU_USUARIO
   db.password=SUA_SENHA
   ```

## Como rodar

**Pelo IntelliJ:** abra `Main.java` e clique no botão ▶ (Run) ao lado do método `main`.

**Pelo terminal:**
```bash
mvn clean compile exec:java
```

**Gerando um .jar executável:**
```bash
mvn clean package
java -jar target/controle-gastos.jar
```

## Funcionalidades

- Cadastrar gasto (descrição, valor, categoria, data)
- Listar todos os gastos
- Listar gastos por categoria
- Listar gastos por período
- Atualizar gasto
- Excluir gasto
- Resumo com total geral e total por categoria

## Requisitos

- Java 17+
- Maven 3.8+
- PostgreSQL 13+
