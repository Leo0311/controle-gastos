package com.controlegastos.api.controller;

import com.controlegastos.api.dto.ReordenarCategoriasRequestDTO;
import com.controlegastos.api.model.Categoria;
import com.controlegastos.api.security.UsuarioPrincipal;
import com.controlegastos.api.service.CategoriaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/categorias")
@RequiredArgsConstructor
public class CategoriaController {

    private final CategoriaService service;

    @GetMapping
    public List<Categoria> listarVisiveis(@AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.listarVisiveis(usuario.usuarioId());
    }

    @GetMapping("/com-gastos")
    public List<Categoria> listarComGastos(@AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.listarComGastos(usuario.usuarioId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Categoria criar(@RequestBody Categoria categoria, @AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.criar(categoria, usuario.usuarioId());
    }

    @PutMapping("/{id}")
    public Categoria atualizar(
            @PathVariable Integer id, @RequestBody Categoria categoria, @AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.atualizar(id, categoria, usuario.usuarioId());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable Integer id, @AuthenticationPrincipal UsuarioPrincipal usuario) {
        service.excluir(id, usuario.usuarioId());
        return ResponseEntity.noContent().build();
    }

    // Recebe a lista completa de IDs de categoria na ordem final desejada (o
    // drag & drop da tela de Categorias) e persiste a posição de cada uma de uma
    // vez. Retorna a lista inteira de categorias visíveis já reordenada, pronta
    // pra tela substituir o que tinha sem precisar recarregar tudo de novo.
    @PutMapping("/ordem")
    public List<Categoria> reordenar(
            @RequestBody ReordenarCategoriasRequestDTO dados,
            @AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.reordenar(dados.ids(), usuario.usuarioId());
    }
}
