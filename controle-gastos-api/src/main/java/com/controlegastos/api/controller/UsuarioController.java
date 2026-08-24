package com.controlegastos.api.controller;

import com.controlegastos.api.dto.RendaDTO;
import com.controlegastos.api.security.UsuarioPrincipal;
import com.controlegastos.api.service.UsuarioService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/usuarios")
@RequiredArgsConstructor
public class UsuarioController {

    private final UsuarioService service;

    @PutMapping("/renda")
    public RendaDTO atualizarRenda(@RequestBody RendaDTO dados, @AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.atualizarRenda(dados.rendaMensal(), usuario.usuarioId());
    }
}
