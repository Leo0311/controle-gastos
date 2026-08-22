package com.controlegastos.api.security;

/**
 * Identidade do usuário autenticado, extraída do JWT e injetada nos
 * controllers via @AuthenticationPrincipal.
 */
public record UsuarioPrincipal(Integer usuarioId, String email) {
}
