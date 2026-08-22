package com.controlegastos.api.controller;

import com.controlegastos.api.dto.OrcamentoMesDTO;
import com.controlegastos.api.model.Orcamento;
import com.controlegastos.api.service.OrcamentoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/orcamentos")
@RequiredArgsConstructor
public class OrcamentoController {

    private final OrcamentoService service;

    @GetMapping
    public List<Orcamento> listarTodos() {
        return service.listarTodos();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Orcamento definir(@RequestBody Orcamento orcamento) {
        return service.definir(orcamento);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable Integer id) {
        service.excluir(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/mes")
    public List<OrcamentoMesDTO> orcamentosDoMes(@RequestParam int mes, @RequestParam int ano) {
        return service.orcamentosDoMes(mes, ano);
    }
}
