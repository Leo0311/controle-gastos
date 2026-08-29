package com.controlegastos.api.controller;

import com.controlegastos.api.model.CompraParcelada;
import com.controlegastos.api.security.UsuarioPrincipal;
import com.controlegastos.api.service.CompraParceladaService;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/compras-parceladas")
@RequiredArgsConstructor
public class CompraParceladaController {

    private final CompraParceladaService service;

    @GetMapping
    public List<CompraParcelada> listarTodos(@AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.listarTodos(usuario.usuarioId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CompraParcelada cadastrar(
            @RequestBody CompraParcelada dados, @AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.cadastrar(dados, usuario.usuarioId());
    }

    // Cancela a compra parcelada (marca como inativa e remove as parcelas futuras) -
    // ver CompraParceladaService.excluir. Usa DELETE por ser a ação destrutiva mais
    // próxima do ponto de vista do usuário, embora o registro em si não seja apagado.
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable Integer id, @AuthenticationPrincipal UsuarioPrincipal usuario) {
        service.excluir(id, usuario.usuarioId());
        return ResponseEntity.noContent().build();
    }
}
