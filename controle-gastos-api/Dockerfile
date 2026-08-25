# Estágio 1: build do .jar com Maven + Java 17.
# Copia o pom.xml primeiro e baixa as dependências antes de copiar o código-fonte,
# para que o cache de camadas do Docker só invalide essa etapa quando o pom mudar.
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline
COPY src ./src
RUN mvn clean package -DskipTests

# Estágio 2: imagem final, só com o JRE e o .jar já empacotado (sem Maven, sem código-fonte).
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
