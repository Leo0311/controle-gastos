package com.controlegastos.api.security;

/**
 * Dados da conta Google extraídos de um access token já validado (audiência
 * conferida, dados obtidos via userinfo - ver {@link GoogleTokenVerifier}) - o que
 * {@code UsuarioService} precisa pra decidir criar conta nova, vincular a uma
 * existente, ou recusar o login.
 *
 * @param sub             identificador estável da conta Google (o "subject" do
 *                        token) - vira {@code Usuario.googleId}
 * @param email           e-mail associado à conta Google
 * @param emailVerificado se o próprio Google confirma a posse do e-mail; se
 *                        false, o login tem que ser recusado - ver
 *                        UsuarioService.loginComGoogle
 * @param nome             nome da conta Google, usado ao criar um usuário novo
 */
public record GooglePayload(String sub, String email, boolean emailVerificado, String nome) {
}
