package com.controlegastos.api.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Limita a frequência de escrita nos endpoints autenticados que fazem trabalho
 * pesado no banco (achado M2 da auditoria 2026-09-05). Diferente do
 * {@link RateLimitFilter} (endpoints públicos de auth, por IP), aqui a contagem
 * é <b>por usuário autenticado</b> - o requisito é só cortar um loop
 * descontrolado ou uma conta comprometida martelando o banco, não atrapalhar
 * uso real, então os limites são folgados.
 *
 * Roda DEPOIS do {@link JwtAuthFilter} na cadeia do Spring Security (ver
 * SecurityConfig), então já há um {@link UsuarioPrincipal} no contexto. Sem
 * autenticação, não faz nada - a própria cadeia de segurança devolve 401.
 *
 * <p><b>Calibração:</b> "gastos-escrita" (POST /api/gastos e PUT
 * /api/gastos/{id}) tem o teto mais alto porque a importação de planilha faz um
 * request por linha, sequencialmente (ver executarImportacao no frontend);
 * mesmo uma planilha grande não chega perto de 400 em 10 s. As outras duas são
 * ações que ninguém dispara em rajada de propósito.
 */
public class RateLimitAutenticadoFilter extends OncePerRequestFilter {

    record Regra(String bucket, int maxRequisicoes, Duration janela) { }

    static final Regra GASTOS_ESCRITA = new Regra("gastos-escrita", 400, Duration.ofSeconds(10));
    static final Regra COMPRAS_PARCELADAS = new Regra("compras-parceladas", 20, Duration.ofMinutes(1));
    static final Regra LANCAR_PENDENTES = new Regra("lancar-pendentes", 60, Duration.ofMinutes(1));

    private static final int LIMITE_PODA = 10_000;

    private final Map<String, Janela> contadores = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        return regraPara(request) == null || usuarioAutenticado() == null;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        Regra regra = regraPara(request);
        Integer usuarioId = usuarioAutenticado();
        String chave = usuarioId + ":" + regra.bucket();

        if (excedeuLimite(chave, regra)) {
            response.setStatus(429); // 429 Too Many Requests (sem constante em jakarta.servlet)
            response.setContentType("application/json;charset=UTF-8");
            response.setHeader("Retry-After", String.valueOf(regra.janela().toSeconds()));
            response.getWriter().write(
                    "{\"erro\":\"Muitas requisições em pouco tempo. Aguarde um instante e tente de novo.\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private static Regra regraPara(HttpServletRequest request) {
        String metodo = request.getMethod();
        String uri = request.getRequestURI();

        boolean escrita = "POST".equalsIgnoreCase(metodo) || "PUT".equalsIgnoreCase(metodo);
        if (escrita && (uri.equals("/api/gastos") || uri.startsWith("/api/gastos/"))) {
            return GASTOS_ESCRITA;
        }
        if ("POST".equalsIgnoreCase(metodo) && uri.equals("/api/compras-parceladas")) {
            return COMPRAS_PARCELADAS;
        }
        if ("POST".equalsIgnoreCase(metodo) && uri.equals("/api/gastos-recorrentes/lancar-pendentes")) {
            return LANCAR_PENDENTES;
        }
        return null;
    }

    private static Integer usuarioAutenticado() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UsuarioPrincipal principal) {
            return principal.usuarioId();
        }
        return null;
    }

    private boolean excedeuLimite(String chave, Regra regra) {
        long agora = System.currentTimeMillis();
        long janelaMs = regra.janela().toMillis();

        if (contadores.size() > LIMITE_PODA) {
            contadores.values().removeIf(j -> agora - j.inicioMs() >= janelaMs);
        }

        Janela janela = contadores.compute(chave, (k, atual) -> {
            if (atual == null || agora - atual.inicioMs() >= janelaMs) {
                return new Janela(agora, 1);
            }
            return new Janela(atual.inicioMs(), atual.contador() + 1);
        });

        return janela.contador() > regra.maxRequisicoes();
    }

    private record Janela(long inicioMs, int contador) {
    }
}
