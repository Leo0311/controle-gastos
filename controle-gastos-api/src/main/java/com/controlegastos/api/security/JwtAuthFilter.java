package com.controlegastos.api.security;

import com.controlegastos.api.repository.UsuarioRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    // Dívida técnica de performance: sem isto, toda requisição autenticada pagava
    // 1 SELECT só pra conferir token_version (achado de perf, rodada 2026-09-11).
    // Cache em memória por usuarioId, TTL curto - custo aceito: um token recém-
    // revogado (troca de senha) continua autenticando por até TTL_VERSAO_MS depois
    // da troca, em vez de cair na primeira requisição seguinte. Só guarda o caminho
    // feliz (usuário encontrado); usuário ausente (raro - conta deletada) sempre
    // bate no banco, não vale cachear "negativo" aqui.
    private static final long TTL_VERSAO_MS = 30_000; // 30s

    private final JwtService jwtService;
    private final UsuarioRepository usuarioRepository;
    private final ConcurrentHashMap<Integer, VersaoCacheada> cacheVersao = new ConcurrentHashMap<>();

    private record VersaoCacheada(int versao, long expiraEm) {
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        String header = request.getHeader("Authorization");

        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);

            if (jwtService.tokenValido(token)) {
                autenticarSeVersaoConfere(token, request);
            }
        }

        filterChain.doFilter(request, response);
    }

    // Além da assinatura/expiração já checadas por tokenValido(), confirma que a
    // versão do token bate com a do usuário no banco. Trocar a senha incrementa
    // essa versão (UsuarioService.redefinirSenha), então qualquer token emitido
    // antes da troca deixa de autenticar. Tokens sem o claim (emitidos antes
    // desta funcionalidade) contam como versão 0, o mesmo default de quem nunca
    // trocou de senha - assim o deploy não desloga sessões válidas na hora.
    private void autenticarSeVersaoConfere(String token, HttpServletRequest request) {
        Integer usuarioId = jwtService.extrairUsuarioId(token);
        Integer versaoToken = jwtService.extrairTokenVersion(token);
        int versaoTokenNormalizada = versaoToken != null ? versaoToken : 0;

        Integer versaoAtual = versaoAtualDoUsuario(usuarioId);
        if (versaoAtual == null || !Objects.equals(versaoAtual, versaoTokenNormalizada)) {
            return;
        }

        UsuarioPrincipal principal = new UsuarioPrincipal(usuarioId);
        var authentication = new UsernamePasswordAuthenticationToken(principal, null, List.of());
        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    // Lê do cache em memória se ainda válido (TTL_VERSAO_MS); senão busca no banco
    // e recacheia. Retorna null quando o usuário não existe (não cacheia esse caso).
    private Integer versaoAtualDoUsuario(Integer usuarioId) {
        long agora = System.currentTimeMillis();
        VersaoCacheada cacheada = cacheVersao.get(usuarioId);
        if (cacheada != null && cacheada.expiraEm() > agora) {
            return cacheada.versao();
        }

        return usuarioRepository.findById(usuarioId)
                .map(usuario -> {
                    cacheVersao.put(usuarioId, new VersaoCacheada(usuario.getTokenVersion(), agora + TTL_VERSAO_MS));
                    return usuario.getTokenVersion();
                })
                .orElse(null);
    }
}
