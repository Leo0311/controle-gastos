package com.controlegastos.api.security;

/**
 * Valida um ID token do login com Google e extrai os dados dele. Interface
 * separada da implementação (ver {@link GoogleTokenVerifierNimbus}) só pra
 * {@code UsuarioService} poder ser testado com Mockito puro, sem tocar rede nem
 * depender do Google de verdade - mesmo motivo de JwtService/PasswordEncoder já
 * serem injetados em vez de instanciados direto.
 */
public interface GoogleTokenVerifier {

    // Lança CredenciaisInvalidasException se o token for inválido, expirado, ou
    // não for deste app (audiência errada) - nunca devolve um GooglePayload
    // "parcial" nem null.
    GooglePayload verificar(String idToken);
}
