package com.controlegastos.api.controller;

import com.controlegastos.api.dto.ComparacaoMensalDTO;
import com.controlegastos.api.dto.GastoPaginaDTO;
import com.controlegastos.api.dto.RankingCategoriasDTO;
import com.controlegastos.api.dto.ResumoDTO;
import com.controlegastos.api.dto.TotalDiarioDTO;
import com.controlegastos.api.dto.TotalMensalDTO;
import com.controlegastos.api.model.Gasto;
import com.controlegastos.api.security.UsuarioPrincipal;
import com.controlegastos.api.service.GastoService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
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
    public List<Gasto> listarTodos(@AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.listarTodos(usuario.usuarioId());
    }

    // Listagem paginada da tela de Gastos (achado C1). Os filtros mes/ano/categoriaId
    // são opcionais. GET /api/gastos (acima) continua devolvendo tudo, para export,
    // importação e demais consumidores que precisam do histórico completo.
    @GetMapping("/pagina")
    public GastoPaginaDTO listarPaginado(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) Integer mes,
            @RequestParam(required = false) Integer ano,
            @RequestParam(required = false) Integer categoriaId,
            @AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.listarPaginado(usuario.usuarioId(), mes, ano, categoriaId, page, size);
    }

    @GetMapping("/{id}")
    public Gasto buscarPorId(@PathVariable Integer id, @AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.buscarPorId(id, usuario.usuarioId());
    }

    // deduplicar=true (só a importação de planilha usa) faz o backend recusar com
    // 409 uma linha logicamente idêntica a um gasto já cadastrado - rede de
    // segurança do achado M6. O cadastro manual não passa o parâmetro e continua
    // aceitando gastos iguais no mesmo dia.
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Gasto cadastrar(
            @RequestBody Gasto gasto,
            @RequestParam(name = "deduplicar", defaultValue = "false") boolean deduplicar,
            @AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.cadastrar(gasto, usuario.usuarioId(), deduplicar);
    }

    @PutMapping("/{id}")
    public Gasto atualizar(
            @PathVariable Integer id, @RequestBody Gasto gasto, @AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.atualizar(id, gasto, usuario.usuarioId());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable Integer id, @AuthenticationPrincipal UsuarioPrincipal usuario) {
        service.excluir(id, usuario.usuarioId());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/categoria/{categoria}")
    public List<Gasto> listarPorCategoria(
            @PathVariable String categoria, @AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.listarPorCategoria(categoria, usuario.usuarioId());
    }

    @GetMapping("/periodo")
    public List<Gasto> listarPorPeriodo(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate inicio,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fim,
            @AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.listarPorPeriodo(inicio, fim, usuario.usuarioId());
    }

    @GetMapping("/resumo")
    public ResumoDTO resumo(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate inicio,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fim,
            @AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.resumo(usuario.usuarioId(), inicio, fim);
    }

    @GetMapping("/totais-mensais")
    public List<TotalMensalDTO> totaisMensais(
            @RequestParam(defaultValue = "6") int meses, @AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.totaisMensais(meses, usuario.usuarioId());
    }

    @GetMapping("/totais-diarios")
    public List<TotalDiarioDTO> totaisDiarios(
            @RequestParam int mes, @RequestParam int ano, @AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.totaisDiarios(mes, ano, usuario.usuarioId());
    }

    @GetMapping("/ranking-categorias")
    public RankingCategoriasDTO rankingCategorias(
            @RequestParam int mes, @RequestParam int ano, @AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.rankingCategorias(mes, ano, usuario.usuarioId());
    }

    @GetMapping("/comparacao-mensal")
    public ComparacaoMensalDTO comparacaoMensal(
            @RequestParam int mes, @RequestParam int ano, @AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.comparacaoMensal(mes, ano, usuario.usuarioId());
    }
}
