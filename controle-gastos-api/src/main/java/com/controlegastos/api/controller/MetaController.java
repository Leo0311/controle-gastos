package com.controlegastos.api.controller;

import com.controlegastos.api.dto.MetaMesDTO;
import com.controlegastos.api.dto.MetaRequestDTO;
import com.controlegastos.api.model.Meta;
import com.controlegastos.api.security.UsuarioPrincipal;
import com.controlegastos.api.service.MetaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/metas")
@RequiredArgsConstructor
public class MetaController {

    private final MetaService service;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Meta definir(@RequestBody MetaRequestDTO dados, @AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.definir(dados, usuario.usuarioId());
    }

    @GetMapping("/mes")
    public MetaMesDTO metaDoMes(
            @RequestParam int mes, @RequestParam int ano, @AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.metaDoMes(mes, ano, usuario.usuarioId());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable Integer id, @AuthenticationPrincipal UsuarioPrincipal usuario) {
        service.excluir(id, usuario.usuarioId());
        return ResponseEntity.noContent().build();
    }
}
