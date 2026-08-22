package com.controlegastos.util;

import java.io.IOException;
import java.io.InputStream;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Properties;

/**
 * Responsável por abrir conexões com o banco PostgreSQL.
 * As credenciais são lidas de src/main/resources/database.properties
 */
public class ConexaoBD {

    private static final Properties props = new Properties();

    static {
        try (InputStream input = ConexaoBD.class.getClassLoader()
                .getResourceAsStream("database.properties")) {
            if (input == null) {
                throw new RuntimeException(
                        "Arquivo database.properties não encontrado em src/main/resources");
            }
            props.load(input);
        } catch (IOException e) {
            throw new RuntimeException("Erro ao carregar database.properties", e);
        }
    }

    public static Connection getConnection() throws SQLException {
        String url = props.getProperty("db.url");
        String user = props.getProperty("db.user");
        String password = props.getProperty("db.password");
        return DriverManager.getConnection(url, user, password);
    }
}
