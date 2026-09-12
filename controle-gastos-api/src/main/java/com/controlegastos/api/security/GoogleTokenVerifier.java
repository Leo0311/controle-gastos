package com.controlegastos.api.security;

/**
 * Valida um access token do login com Google (obtido via popup OAuth no
 * frontend, {@code initTokenClient}) e extrai os dados da conta. Interface
 * separada da implementação (ver {@link GoogleTokenVerifierOAuth2}) só pra
 * {@code UsuarioService} poder ser testado com Mockito puro, sem tocar rede nem
 * depender do Google de verdade - mesmo motivo de JwtService/PasswordEncoder já
 * serem injetados em vez de instanciados direto.
 */
public interface GoogleTokenVerifier {

    // Lança CredenciaisInvalidasException se o token for inválido, expirado, ou
    // não for deste app (audiência errada) - nunca devolve um GooglePayload
    // "parcial" nem null.
    GooglePayload verificar(String accessToken);
}
