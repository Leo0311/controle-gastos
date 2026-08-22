package com.controlegastos.api.controller;

import com.controlegastos.api.dto.ResumoDTO;
import com.controlegastos.api.dto.TotalMensalDTO;
import com.controlegastos.api.model.Gasto;
import com.controlegastos.api.service.GastoService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/gastos")
@RequiredArgsConstructor
public class GastoController {

    private final GastoService service;

    @GetMapping
    public List<Gasto> listarTodos() {
        return service.listarTodos();
    }

    @GetMapping("/{id}")
    public Gasto buscarPorId(@PathVariable Integer id) {
        return service.buscarPorId(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Gasto cadastrar(@RequestBody Gasto gasto) {
        return service.cadastrar(gasto);
    }

    @PutMapping("/{id}")
    public Gasto atualizar(@PathVariable Integer id, @RequestBody Gasto gasto) {
        return service.atualizar(id, gasto);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable Integer id) {
        service.excluir(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/categoria/{categoria}")
    public List<Gasto> listarPorCategoria(@PathVariable String categoria) {
        return service.listarPorCategoria(categoria);
    }

    @GetMapping("/periodo")
    public List<Gasto> listarPorPeriodo(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate inicio,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fim) {
        return service.listarPorPeriodo(inicio, fim);
    }

    @GetMapping("/resumo")
    public ResumoDTO resumo() {
        return service.resumo();
    }

    @GetMapping("/totais-mensais")
    public List<TotalMensalDTO> totaisMensais(@RequestParam(defaultValue = "6") int meses) {
        return service.totaisMensais(meses);
    }
}
