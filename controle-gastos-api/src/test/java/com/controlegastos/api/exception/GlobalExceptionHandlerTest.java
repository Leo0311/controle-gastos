package com.controlegastos.api.exception;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cobre só o handler genérico adicionado na auditoria 2026-09-05 (achado R2) -
 * os handlers específicos (IllegalArgumentException, DataIntegrityViolationException,
 * etc.) já são exercitados indiretamente pelos testes de service/controller.
 */
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void erroInesperado_devolve500ComMensagemGenerica_semVazarDetalheInterno() {
        Exception original = new RuntimeException("connection refused: postgres://usuario:senha123@host/db");

        ResponseEntity<Map<String, String>> resposta = handler.tratarErroInesperado(original);

        assertThat(resposta.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(resposta.getBody()).containsEntry("erro", "Ocorreu um erro inesperado.");
        assertThat(resposta.getBody().toString()).doesNotContain("senha123", "postgres://", "connection refused");
    }

    @Test
    void erroInesperado_naoQuebraComExceptionSemMensagem() {
        ResponseEntity<Map<String, String>> resposta = handler.tratarErroInesperado(new NullPointerException());

        assertThat(resposta.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(resposta.getBody()).containsEntry("erro", "Ocorreu um erro inesperado.");
    }
}
