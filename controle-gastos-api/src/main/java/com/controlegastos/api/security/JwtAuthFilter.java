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

@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UsuarioRepository usuarioRepository;

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

        usuarioRepository.findById(usuarioId)
                .filter(usuario -> Objects.equals(usuario.getTokenVersion(), versaoTokenNormalizada))
                .ifPresent(usuario -> {
                    UsuarioPrincipal principal = new UsuarioPrincipal(usuario.getId());

                    var authentication = new UsernamePasswordAuthenticationToken(principal, null, List.of());
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                });
    }
}
