package com.controlegastos.api.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Limita a frequência de chamadas aos endpoints de autenticação
 * (login/cadastro/esqueci-senha), que são públicos e alvo natural de força
 * bruta, enumeração de conta e bombardeio de e-mail de redefinição.
 *
 * Janela fixa de {@value #MAX_REQUISICOES} requisições por
 * {@link #JANELA} por IP de origem + caminho. Ao exceder, responde
 * 429 (Too Many Requests) com o mesmo formato de corpo ({@code {"erro": ...}})
 * usado pelo GlobalExceptionHandler e um cabeçalho {@code Retry-After}.
 *
 * Contagem em memória: suficiente para a app (instância única no Render free
 * tier). Não é instanciado como bean para não ser registrado também na cadeia
 * de filtros padrão do servlet - é adicionado explicitamente à cadeia do
 * Spring Security em SecurityConfig.
 */
public class RateLimitFilter extends OncePerRequestFilter {

    static final int MAX_REQUISICOES = 5;
    static final Duration JANELA = Duration.ofMinutes(1);

    private static final Set<String> CAMINHOS_LIMITADOS = Set.of(
            "/api/auth/login",
            "/api/auth/cadastro",
            "/api/auth/esqueci-senha"
    );

    // Poda oportunista: quando o mapa passa disso, remove as janelas já
    // expiradas numa varredura. Evita crescimento ilimitado sob tráfego
    // distribuído por muitos IPs sem precisar de um agendador dedicado.
    private static final int LIMITE_PODA = 10_000;

    private final Map<String, Janela> contadores = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        return !"POST".equalsIgnoreCase(request.getMethod())
                || !CAMINHOS_LIMITADOS.contains(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        String chave = ipCliente(request) + " " + request.getRequestURI();

        if (excedeuLimite(chave)) {
            response.setStatus(429); // 429 Too Many Requests (sem constante em jakarta.servlet)
            response.setContentType("application/json;charset=UTF-8");
            response.setHeader("Retry-After", String.valueOf(JANELA.toSeconds()));
            response.getWriter().write(
                    "{\"erro\":\"Muitas tentativas. Aguarde um minuto e tente novamente.\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private boolean excedeuLimite(String chave) {
        long agora = System.currentTimeMillis();
        long janelaMs = JANELA.toMillis();

        if (contadores.size() > LIMITE_PODA) {
            contadores.values().removeIf(j -> agora - j.inicioMs() >= janelaMs);
        }

        Janela janela = contadores.compute(chave, (k, atual) -> {
            if (atual == null || agora - atual.inicioMs() >= janelaMs) {
                return new Janela(agora, 1);
            }
            return new Janela(atual.inicioMs(), atual.contador() + 1);
        });

        return janela.contador() > MAX_REQUISICOES;
    }

    // Atrás do proxy do Render, getRemoteAddr() é sempre o proxy - o IP real do
    // cliente é o primeiro da lista em X-Forwarded-For. Cai para getRemoteAddr()
    // no ambiente local (sem proxy, sem esse cabeçalho).
    private String ipCliente(HttpServletRequest request) {
        String encaminhado = request.getHeader("X-Forwarded-For");
        if (encaminhado != null && !encaminhado.isBlank()) {
            return encaminhado.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private record Janela(long inicioMs, int contador) {
    }
}
