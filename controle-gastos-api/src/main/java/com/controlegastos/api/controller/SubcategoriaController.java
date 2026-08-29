package com.controlegastos.api.controller;

import com.controlegastos.api.model.Subcategoria;
import com.controlegastos.api.security.UsuarioPrincipal;
import com.controlegastos.api.service.SubcategoriaService;
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
@RequiredArgsConstructor
public class SubcategoriaController {

    private final SubcategoriaService service;

    @GetMapping("/api/subcategorias")
    public List<Subcategoria> listarTodas(@AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.listarTodasVisiveis(usuario.usuarioId());
    }

    @GetMapping("/api/categorias/{categoriaId}/subcategorias")
    public List<Subcategoria> listarPorCategoria(
            @PathVariable Integer categoriaId, @AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.listarPorCategoria(categoriaId, usuario.usuarioId());
    }

    @PostMapping("/api/categorias/{categoriaId}/subcategorias")
    @ResponseStatus(HttpStatus.CREATED)
    public Subcategoria criar(
            @PathVariable Integer categoriaId, @RequestBody Subcategoria subcategoria,
            @AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.criar(categoriaId, subcategoria, usuario.usuarioId());
    }

    @PutMapping("/api/subcategorias/{id}")
    public Subcategoria atualizar(
            @PathVariable Integer id, @RequestBody Subcategoria subcategoria,
            @AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.atualizar(id, subcategoria, usuario.usuarioId());
    }

    @DeleteMapping("/api/subcategorias/{id}")
    public ResponseEntity<Void> excluir(@PathVariable Integer id, @AuthenticationPrincipal UsuarioPrincipal usuario) {
        service.excluir(id, usuario.usuarioId());
        return ResponseEntity.noContent().build();
    }
}
