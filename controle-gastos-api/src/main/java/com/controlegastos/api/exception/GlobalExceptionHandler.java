package com.controlegastos.api.exception;

import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.sql.SQLException;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestControllerAdvice
public class GlobalExceptionHandler {

    // Nomes das constraints/índices únicos definidos em schema.sql - usados para
    // identificar qual entidade causou o conflito e devolver uma mensagem específica
    // em vez de assumir que todo DataIntegrityViolationException é sobre orçamento.
    private static final String CONSTRAINT_ORCAMENTO = "uq_orcamento_usuario_categoria_subcategoria_mes_ano";
    private static final String CONSTRAINT_SUBCATEGORIA = "uq_subcategorias_usuario_categoria_nome";
    private static final String CONSTRAINT_CATEGORIA = "uq_categorias_usuario_nome";

    private static final Pattern NOME_ENTRE_ASPAS = Pattern.compile("\"([^\"]+)\"");

    @ExceptionHandler(RecursoNaoEncontradoException.class)
    public ResponseEntity<Map<String, String>> tratarNaoEncontrado(RecursoNaoEncontradoException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("erro", e.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> tratarArgumentoInvalido(IllegalArgumentException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("erro", e.getMessage()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> tratarConflito(DataIntegrityViolationException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("erro", mensagemConflito(e)));
    }

    private String mensagemConflito(DataIntegrityViolationException e) {
        String constraint = nomeConstraintViolada(e);
        if (CONSTRAINT_ORCAMENTO.equals(constraint)) {
            return "Já existe um orçamento definido para essa categoria/subcategoria/mês/ano.";
        }
        if (CONSTRAINT_SUBCATEGORIA.equals(constraint)) {
            return "Já existe uma subcategoria com esse nome nesta categoria.";
        }
        if (CONSTRAINT_CATEGORIA.equals(constraint)) {
            return "Já existe uma categoria com esse nome.";
        }
        return "Não foi possível salvar devido a um conflito de dados.";
    }

    // Hibernate normalmente preenche getConstraintName() a partir da mensagem de erro
    // do driver JDBC, mas isso depende do dialect/versão - por segurança, se vier nulo,
    // cai para extrair o nome citado entre aspas na mensagem bruta do SQLException
    // (formato usado pelo Postgres tanto para violação de UNIQUE quanto de FOREIGN KEY).
    private String nomeConstraintViolada(Throwable erro) {
        Throwable causa = erro;
        while (causa != null) {
            if (causa instanceof ConstraintViolationException cve && cve.getConstraintName() != null) {
                return cve.getConstraintName();
            }
            causa = causa.getCause();
        }

        causa = erro;
        while (causa != null) {
            if (causa instanceof SQLException && causa.getMessage() != null) {
                Matcher m = NOME_ENTRE_ASPAS.matcher(causa.getMessage());
                if (m.find()) {
                    return m.group(1);
                }
            }
            causa = causa.getCause();
        }
        return null;
    }

    @ExceptionHandler(CredenciaisInvalidasException.class)
    public ResponseEntity<Map<String, String>> tratarCredenciaisInvalidas(CredenciaisInvalidasException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("erro", e.getMessage()));
    }

    @ExceptionHandler(EmailJaCadastradoException.class)
    public ResponseEntity<Map<String, String>> tratarEmailJaCadastrado(EmailJaCadastradoException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("erro", e.getMessage()));
    }

    @ExceptionHandler(TokenInvalidoException.class)
    public ResponseEntity<Map<String, String>> tratarTokenInvalido(TokenInvalidoException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("erro", e.getMessage()));
    }

    @ExceptionHandler(OrcamentoInvalidoException.class)
    public ResponseEntity<Map<String, String>> tratarOrcamentoInvalido(OrcamentoInvalidoException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("erro", e.getMessage()));
    }
}
