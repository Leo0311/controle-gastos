package com.controlegastos.api.dto;

public record LoginResponseDTO(String token, Integer usuarioId, String nome, String email) {
}
