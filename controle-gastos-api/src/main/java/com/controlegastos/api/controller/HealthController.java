package com.controlegastos.api.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Health check público para monitoramento externo de uptime (achado 1.3 do
 * handoff rev.3): um serviço gratuito (UptimeRobot etc.) bate aqui a cada poucos
 * minutos e alerta quando a API cai - queda da VM, restart travado no deploy
 * manual, ou banco (Neon) fora do ar.
 *
 * <p>É o único endpoint fora de {@code /api/auth/**} liberado sem autenticação
 * (ver {@link com.controlegastos.api.config.SecurityConfig}). Além de responder,
 * confirma a conexão com o banco: se o {@code SELECT 1} falha, devolve 503 para
 * o monitor acusar mesmo com a JVM de pé.
 */
@RestController
@RequestMapping("/api/health")
@RequiredArgsConstructor
public class HealthController {

    private final JdbcTemplate jdbcTemplate;

    @GetMapping
    public ResponseEntity<Map<String, String>> health() {
        try {
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            return ResponseEntity.ok(Map.of("status", "UP"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(503).body(Map.of("status", "DOWN"));
        }
    }
}
