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
 * Limita a frequência de chamadas a endpoints públicos que são alvo natural de
 * abuso: os de autenticação (login/cadastro/esqueci-senha/google - força
 * bruta, enumeração de conta, bombardeio de e-mail de redefinição) e o probe
 * de saúde do SMTP (achado M7 - a cada chamada não cacheada ele abre uma
 * conexão de rede real e autentica no Gmail; sem limite por IP, muitos IPs
 * distintos batendo nele ao mesmo tempo poderiam gerar tentativas de
 * autenticação suficientes pro Gmail sinalizar a conta como suspeita, mesmo
 * com o {@code HealthController} cacheando o resultado por 30s).
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

    private static final Set<String> CAMINHOS_POST_LIMITADOS = Set.of(
            "/api/auth/login",
            "/api/auth/cadastro",
            "/api/auth/esqueci-senha",
            "/api/auth/google"
    );

    private static final String CAMINHO_HEALTH_SMTP = "/api/health/smtp";

    // Poda oportunista: quando o mapa passa disso, remove as janelas já
    // expiradas numa varredura. Evita crescimento ilimitado sob tráfego
    // distribuído por muitos IPs sem precisar de um agendador dedicado.
    private static final int LIMITE_PODA = 10_000;

    private final Map<String, Janela> contadores = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        String metodo = request.getMethod();
        String uri = request.getRequestURI();
        boolean autenticacao = "POST".equalsIgnoreCase(metodo) && CAMINHOS_POST_LIMITADOS.contains(uri);
        // GET e HEAD: SecurityConfig libera os dois (monitores de uptime mandam
        // HEAD quando não têm checagem de keyword) e @GetMapping responde a
        // ambos executando o mesmo handler - sem contar HEAD aqui, um monitor
        // configurado com HEAD testaria o SMTP de verdade sem limite nenhum.
        boolean healthSmtp = ("GET".equalsIgnoreCase(metodo) || "HEAD".equalsIgnoreCase(metodo))
                && CAMINHO_HEALTH_SMTP.equals(uri);
        return !(autenticacao || healthSmtp);
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

    // Achado de auditoria 2026-09-13: ler X-Forwarded-For direto aqui (versão
    // anterior) confiava cegamente no header - um cliente podia forjar um IP
    // novo a cada requisição e reiniciar a própria contagem à vontade. A
    // resolução do IP real agora acontece ANTES deste filtro, no RemoteIpValve
    // nativo do Tomcat (server.forward-headers-strategy=NATIVE, ver
    // application-prod.properties) - só aceita X-Forwarded-For de quem estiver
    // em server.tomcat.remoteip.internal-proxies (aqui, restrito a localhost,
    // onde o nginx desta VM roda). Fora dessa lista, o header é ignorado e
    // getRemoteAddr() é o IP real da conexão TCP - não forjável por header. Em
    // ambiente local (sem nginx/valve na frente), getRemoteAddr() já é o IP
    // real de qualquer forma, então o comportamento não muda.
    private String ipCliente(HttpServletRequest request) {
        return request.getRemoteAddr();
    }

    private record Janela(long inicioMs, int contador) {
    }
}
