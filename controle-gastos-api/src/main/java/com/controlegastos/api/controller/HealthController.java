package com.controlegastos.api.controller;

import jakarta.mail.MessagingException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

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
@Slf4j
public class HealthController {

    // Achado M7 da auditoria (tasks/auditoria-2026-09-05.md): o /api/health acima
    // não cobre SMTP fora do ar - a API e o banco continuam de pé, só o e-mail de
    // redefinição de senha para de sair (log "evento=falha_envio_email", sem
    // alerta ativo). Endpoint dedicado em vez de embutir no /api/health principal
    // de propósito: aquele é consultado pelo deploy-api.yml logo após todo
    // restart (§ "deploy" do workflow) - um SMTP lento/instável não pode derrubar
    // um deploy que só mexeu em outra parte do sistema.
    private static final Duration CACHE_SMTP = Duration.ofSeconds(30);

    private final JdbcTemplate jdbcTemplate;
    private final JavaMailSenderImpl mailSender;

    private final AtomicReference<StatusSmtpCache> cacheSmtp = new AtomicReference<>();

    @GetMapping
    public ResponseEntity<Map<String, String>> health() {
        try {
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            return ResponseEntity.ok(Map.of("status", "UP"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(503).body(Map.of("status", "DOWN"));
        }
    }

    /**
     * Testa a conexão SMTP de verdade (handshake + autenticação, sem enviar
     * e-mail nenhum) a cada chamada, mas cacheada por {@link #CACHE_SMTP} - o
     * endpoint é público e sem essa cache um monitor mal configurado (ou
     * qualquer request repetido) forçaria autenticações repetidas contra o
     * Gmail, o que pode fazer a conta ser sinalizada como suspeita.
     *
     * <p>Duas camadas, não uma: esta cache é por instância e cobre qualquer
     * volume de requests (de um IP só ou de muitos ao mesmo tempo), mas
     * depende de o código continuar correto. Por isso o {@code RateLimitFilter}
     * (mesmo limite de 5/min por IP dos endpoints de auth) também cobre este
     * caminho - camada independente, não redundante: se a cache tiver um bug
     * ou for removida num refactor futuro, o rate limit ainda segura o abuso.
     */
    @GetMapping("/smtp")
    public ResponseEntity<Map<String, String>> smtp() {
        StatusSmtpCache cache = cacheSmtp.get();
        Instant agora = Instant.now();
        if (cache == null || Duration.between(cache.verificadoEm(), agora).compareTo(CACHE_SMTP) > 0) {
            cache = new StatusSmtpCache(verificarConexaoSmtp(), agora);
            cacheSmtp.set(cache);
        }
        return cache.up()
                ? ResponseEntity.ok(Map.of("status", "UP"))
                : ResponseEntity.status(503).body(Map.of("status", "DOWN"));
    }

    private boolean verificarConexaoSmtp() {
        try {
            mailSender.testConnection();
            return true;
        } catch (MessagingException e) {
            log.warn("evento=smtp_health_check_falhou causa=\"{}\"", e.getMessage());
            return false;
        }
    }

    private record StatusSmtpCache(boolean up, Instant verificadoEm) {
    }
}
