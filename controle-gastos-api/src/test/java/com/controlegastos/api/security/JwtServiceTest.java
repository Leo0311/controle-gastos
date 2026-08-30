package com.controlegastos.api.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    // 64 bytes -> suficiente para HS512 (mesmo tamanho do segredo real do ambiente).
    private static final String SEGREDO = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef!!";

    private final JwtService jwtService = new JwtService(SEGREDO);

    @Test
    void tokenCarregaUsuarioIdEmailEVersao() {
        String token = jwtService.gerarToken(42, "user@exemplo.com", 3);

        assertThat(jwtService.tokenValido(token)).isTrue();
        assertThat(jwtService.extrairUsuarioId(token)).isEqualTo(42);
        assertThat(jwtService.extrairEmail(token)).isEqualTo("user@exemplo.com");
        assertThat(jwtService.extrairTokenVersion(token)).isEqualTo(3);
    }

    @Test
    void tokenComVersaoDiferenteContinuaComAssinaturaValida() {
        // A checagem de versão é responsabilidade do filtro; o token em si
        // permanece "válido" (assinatura/expiração) - é o filtro que o rejeita.
        String token = jwtService.gerarToken(1, "a@b.com", 0);

        assertThat(jwtService.tokenValido(token)).isTrue();
        assertThat(jwtService.extrairTokenVersion(token)).isZero();
    }

    @Test
    void tokenAdulteradoOuComOutroSegredoEhInvalido() {
        String token = jwtService.gerarToken(1, "a@b.com", 0);

        assertThat(jwtService.tokenValido(token + "x")).isFalse();

        JwtService outroSegredo = new JwtService("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
        assertThat(outroSegredo.tokenValido(token)).isFalse();
    }
}
