package com.controlegastos.api.controller;

import com.controlegastos.api.dto.ConfigDTO;
import com.controlegastos.api.service.CompraParceladaService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Configuração/limites que o frontend lê para validar formulários (achado M3).
 * Igual para todos os usuários - não recebe/usa o usuário autenticado, mas fica
 * atrás de autenticação como o resto da API (não é público).
 */
@RestController
@RequestMapping("/api/config")
@RequiredArgsConstructor
public class ConfigController {

    private final CompraParceladaService compraParceladaService;

    @GetMapping
    public ConfigDTO config() {
        return new ConfigDTO(compraParceladaService.limites());
    }
}
