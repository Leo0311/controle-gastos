package com.controlegastos.api.config;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * Comportamento de fronteira que o login com Google passou a depender de:
 * usuarios.senha é nullable desde V2__login_google.sql (conta só-Google não tem
 * senha real). UsuarioService.login() chama passwordEncoder.matches(senhaDigitada,
 * usuario.getSenha()) sem checar nulidade antes - se o 2º argumento nulo lançasse
 * exceção em vez de simplesmente não bater, uma tentativa de login por senha numa
 * conta só-Google devolveria 500 em vez do 401 esperado. Confirmado aqui contra o
 * bean de verdade (não um mock) antes de construir qualquer lógica em cima disso.
 */
class SecurityConfigTest {

    // Mesma classe concreta que SecurityConfig.passwordEncoder() devolve como bean -
    // instanciada direto aqui pra não precisar de um JwtAuthFilter só pro construtor
    // de SecurityConfig (que este teste não usa).
    private final PasswordEncoder encoder = new BCryptPasswordEncoder();

    @Test
    void matches_comSenhaCodificadaNula_devolveFalseSemLancarExcecao() {
        assertThatCode(() -> encoder.matches("qualquercoisa", null)).doesNotThrowAnyException();
        assertThat(encoder.matches("qualquercoisa", null)).isFalse();
    }
}
