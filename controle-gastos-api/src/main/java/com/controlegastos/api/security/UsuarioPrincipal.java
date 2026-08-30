package com.controlegastos.api.security;

/**
 * Identidade do usuário autenticado, injetada nos controllers via
 * @AuthenticationPrincipal. Só carrega o id: toda autorização é por usuário,
 * e os dados do usuário (nome, e-mail) vêm do banco quando necessário.
 */
public record UsuarioPrincipal(Integer usuarioId) {
}
