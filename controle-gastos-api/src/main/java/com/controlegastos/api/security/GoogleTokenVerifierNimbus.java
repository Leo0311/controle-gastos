package com.controlegastos.api.security;

import com.controlegastos.api.exception.CredenciaisInvalidasException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtAudienceValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Valida o ID token do Google via {@link NimbusJwtDecoder} apontado pro JWKS
 * público do Google - o decoder cuida de buscar/cachear/rotacionar as chaves
 * RSA e conferir a assinatura; este componente só adiciona os dois checks que o
 * Nimbus não faz sozinho (emissor e audiência) e traduz o resultado pro shape
 * que o resto do app usa ({@link GooglePayload}).
 *
 * Não configura esta API como OAuth2 Resource Server de verdade - é só um
 * decoder usado como utilitário dentro de um service comum. A autenticação de
 * toda requisição continua 100% pelo JwtAuthFilter/JwtService próprios.
 */
@Component
public class GoogleTokenVerifierNimbus implements GoogleTokenVerifier {

    private static final String JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";

    // O Google emite ID tokens com qualquer uma das duas formas - documentado
    // assim pelo próprio Google, não é inconsistência a normalizar.
    private static final List<String> EMISSORES_VALIDOS = List.of(
            "accounts.google.com", "https://accounts.google.com");

    private final JwtDecoder decoder;

    public GoogleTokenVerifierNimbus(@Value("${app.google.client-id}") String clientId) {
        NimbusJwtDecoder nimbusDecoder = NimbusJwtDecoder.withJwkSetUri(JWKS_URI).build();

        OAuth2TokenValidator<Jwt> validadorPadrao = JwtValidators.createDefault(); // exp/nbf
        OAuth2TokenValidator<Jwt> validadorAudiencia = new JwtAudienceValidator(clientId);
        // JwtIssuerValidator (Spring) só aceita UM emissor - o Google usa 2 formas
        // válidas pro mesmo emissor, então este validador é custom mesmo.
        OAuth2TokenValidator<Jwt> validadorEmissor = jwt -> EMISSORES_VALIDOS.contains(jwt.getIssuer() != null
                ? jwt.getIssuer().toString() : null)
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error(
                        "invalid_token", "Emissor do token não é o Google.", null));

        nimbusDecoder.setJwtValidator(
                new DelegatingOAuth2TokenValidator<>(validadorPadrao, validadorAudiencia, validadorEmissor));
        this.decoder = nimbusDecoder;
    }

    @Override
    public GooglePayload verificar(String idToken) {
        Jwt jwt;
        try {
            jwt = decoder.decode(idToken);
        } catch (JwtException e) {
            throw new CredenciaisInvalidasException("Não foi possível validar o login do Google.");
        }

        boolean emailVerificado = Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified"));
        return new GooglePayload(jwt.getSubject(), jwt.getClaimAsString("email"), emailVerificado,
                jwt.getClaimAsString("name"));
    }
}
