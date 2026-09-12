package com.controlegastos.api.controller;

import jakarta.mail.MessagingException;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class HealthControllerTest {

    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
    private final JavaMailSenderImpl mailSender = mock(JavaMailSenderImpl.class);
    private final HealthController controller = new HealthController(jdbcTemplate, mailSender);

    @Test
    void bancoRespondendo_devolve200ComStatusUp() {
        when(jdbcTemplate.queryForObject("SELECT 1", Integer.class)).thenReturn(1);

        ResponseEntity<Map<String, String>> resposta = controller.health();

        assertThat(resposta.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resposta.getBody()).containsEntry("status", "UP");
    }

    @Test
    void bancoForaDoAr_devolve503ComStatusDown() {
        when(jdbcTemplate.queryForObject("SELECT 1", Integer.class))
                .thenThrow(new DataAccessResourceFailureException("connection refused"));

        ResponseEntity<Map<String, String>> resposta = controller.health();

        assertThat(resposta.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(resposta.getBody()).containsEntry("status", "DOWN");
    }

    // Achado M7 (tasks/auditoria-2026-09-05.md): SMTP fora do ar não derruba
    // /api/health (banco/JVM continuam de pé) - por isso o endpoint dedicado
    // abaixo, pra um monitor externo (UptimeRobot) conseguir alertar sobre isso
    // também.

    @Test
    void smtpRespondendo_devolve200ComStatusUp() throws MessagingException {
        ResponseEntity<Map<String, String>> resposta = controller.smtp();

        assertThat(resposta.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resposta.getBody()).containsEntry("status", "UP");
        verify(mailSender, times(1)).testConnection();
    }

    @Test
    void smtpForaDoAr_devolve503ComStatusDown() throws MessagingException {
        doThrow(new MessagingException("connection refused")).when(mailSender).testConnection();

        ResponseEntity<Map<String, String>> resposta = controller.smtp();

        assertThat(resposta.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(resposta.getBody()).containsEntry("status", "DOWN");
    }

    @Test
    void chamadasRepetidasDentroDaJanelaDeCache_naoTestamNovaConexaoSmtp() throws MessagingException {
        controller.smtp();
        controller.smtp();
        controller.smtp();

        // As três caem na mesma janela de 30s - só a primeira deve realmente ter
        // testado a conexão; as outras duas reaproveitam o resultado cacheado.
        // Sem essa cache, o endpoint público forçaria autenticação repetida no
        // Gmail a cada request.
        verify(mailSender, times(1)).testConnection();
    }
}
