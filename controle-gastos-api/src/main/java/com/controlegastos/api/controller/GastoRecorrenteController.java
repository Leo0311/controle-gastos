package com.controlegastos.api.controller;

import com.controlegastos.api.model.Gasto;
import com.controlegastos.api.model.GastoRecorrente;
import com.controlegastos.api.security.UsuarioPrincipal;
import com.controlegastos.api.service.GastoRecorrenteService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/gastos-recorrentes")
@RequiredArgsConstructor
public class GastoRecorrenteController {

    private final GastoRecorrenteService service;

    @GetMapping
    public List<GastoRecorrente> listarTodos(@AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.listarTodos(usuario.usuarioId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public GastoRecorrente cadastrar(
            @RequestBody GastoRecorrente dados, @AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.cadastrar(dados, usuario.usuarioId());
    }

    @PutMapping("/{id}")
    public GastoRecorrente atualizar(
            @PathVariable Integer id,
            @RequestBody GastoRecorrente dados,
            @AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.atualizar(id, dados, usuario.usuarioId());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable Integer id, @AuthenticationPrincipal UsuarioPrincipal usuario) {
        service.excluir(id, usuario.usuarioId());
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/ativar-desativar")
    public GastoRecorrente alternarAtivo(@PathVariable Integer id, @AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.alternarAtivo(id, usuario.usuarioId());
    }

    // Chamado pelo frontend ao carregar o Dashboard ou a tela de Gastos (não há cron
    // job garantido no Render free tier) - lança os gastos pendentes do mês atual e
    // devolve só os que foram criados nesta chamada (lista vazia se nada pendente).
    @PostMapping("/lancar-pendentes")
    public List<Gasto> lancarPendentes(@AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.lancarPendentes(usuario.usuarioId());
    }
}
