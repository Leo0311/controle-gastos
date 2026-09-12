package com.controlegastos.api.security;

import com.controlegastos.api.exception.CredenciaisInvalidasException;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;

/**
 * Valida o access token do login com Google (popup OAuth via
 * {@code initTokenClient}, não FedCM/One Tap - trocado por ser bloqueado por
 * padrão em navegadores como a Brave e não suportado pelo Firefox). Diferente
 * do antigo ID token, o access token é uma string opaca do Google - não dá
 * pra verificar localmente (sem JWKS/assinatura), então a validação é feita
 * chamando dois endpoints REST do próprio Google:
 *
 * <ol>
 *   <li>{@code tokeninfo} confirma que o token é válido e devolve o client_id
 *       de quem o pediu ({@code aud}/{@code azp}) - sem essa checagem, um
 *       access token emitido pra OUTRO app Google (com escopo de e-mail/
 *       perfil) poderia ser reaproveitado aqui pra logar como o dono da
 *       conta, sem o usuário nunca ter autorizado ESTE app;</li>
 *   <li>{@code userinfo} devolve os dados da conta
 *       (sub/email/email_verified/name) usados por {@code UsuarioService}.</li>
 * </ol>
 *
 * Timeout curto nas duas chamadas (5s cada) - qualquer falha de rede, timeout
 * ou resposta que o Google recuse (token inválido/expirado) vira
 * {@link CredenciaisInvalidasException} (401), nunca vaza como 500.
 */
@Component
public class GoogleTokenVerifierOAuth2 implements GoogleTokenVerifier {

    private static final String TOKENINFO_URI = "https://oauth2.googleapis.com/tokeninfo";
    private static final String USERINFO_URI = "https://openidconnect.googleapis.com/v1/userinfo";

    private final RestClient restClient;
    private final String clientId;

    public GoogleTokenVerifierOAuth2(@Value("${app.google.client-id}") String clientId) {
        this.clientId = clientId;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(5));
        this.restClient = RestClient.builder().requestFactory(requestFactory).build();
    }

    @Override
    public GooglePayload verificar(String accessToken) {
        TokenInfoResponse tokenInfo = consultarTokenInfo(accessToken);

        // aud é a audiência pretendida do token, azp ("authorized party") é o
        // client_id de quem pediu - pro fluxo de access token do Google os dois
        // vêm iguais ao nosso client_id, mas a doc não garante qual dos dois
        // vem preenchido em toda resposta, então confere os dois.
        boolean audienciaValida = clientId.equals(tokenInfo.aud()) || clientId.equals(tokenInfo.azp());
        if (!audienciaValida) {
            throw new CredenciaisInvalidasException("Não foi possível validar o login do Google.");
        }

        UserInfoResponse userInfo = consultarUserInfo(accessToken);

        return new GooglePayload(userInfo.sub(), userInfo.email(),
                Boolean.TRUE.equals(userInfo.emailVerified()), userInfo.name());
    }

    private TokenInfoResponse consultarTokenInfo(String accessToken) {
        try {
            TokenInfoResponse resposta = restClient.get()
                    .uri(TOKENINFO_URI + "?access_token={token}", accessToken)
                    .retrieve()
                    .body(TokenInfoResponse.class);
            if (resposta == null) {
                throw new CredenciaisInvalidasException("Não foi possível validar o login do Google.");
            }
            return resposta;
        } catch (RestClientException e) {
            // Cobre token inválido/expirado (Google devolve 400) e falha de
            // rede/timeout - nenhum dos dois pode vazar como 500 pro cliente.
            throw new CredenciaisInvalidasException("Não foi possível validar o login do Google.");
        }
    }

    private UserInfoResponse consultarUserInfo(String accessToken) {
        try {
            UserInfoResponse resposta = restClient.get()
                    .uri(USERINFO_URI)
                    .header("Authorization", "Bearer " + accessToken)
                    .retrieve()
                    .body(UserInfoResponse.class);
            if (resposta == null || resposta.sub() == null) {
                throw new CredenciaisInvalidasException("Não foi possível validar o login do Google.");
            }
            return resposta;
        } catch (RestClientException e) {
            throw new CredenciaisInvalidasException("Não foi possível validar o login do Google.");
        }
    }

    private record TokenInfoResponse(String aud, String azp) {
    }

    private record UserInfoResponse(
            String sub,
            String email,
            @JsonProperty("email_verified") Boolean emailVerified,
            String name) {
    }
}
