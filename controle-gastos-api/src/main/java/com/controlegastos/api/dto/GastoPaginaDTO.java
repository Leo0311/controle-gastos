package com.controlegastos.api.dto;

import com.controlegastos.api.model.Gasto;

import java.util.List;

/**
 * Uma página da listagem de gastos da tela (ver GastoService.listarPaginado /
 * achado C1). Shape enxuto de propósito - o frontend só precisa do conteúdo e de
 * saber se ainda há mais para carregar; totalPaginas/totalItens vão junto para um
 * eventual rótulo "N gastos", sem custo extra (já vêm do Page do Spring Data).
 */
public record GastoPaginaDTO(
        List<Gasto> conteudo,
        int pagina,
        int totalPaginas,
        long totalItens,
        boolean ultima) {
}
