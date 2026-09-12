package com.controlegastos.api.dto;

import com.controlegastos.api.model.Gasto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Detalhe completo de uma compra parcelada: totais e a lista de parcelas (os
 * gastos individuais), para a tela de "ver detalhe" (progresso de pagamento,
 * valor pago/restante em R$; o agrupamento por ano é feito no cliente a partir de
 * `parcelas`) - resposta de GET /api/compras-parceladas/{id}/detalhe. Só leitura -
 * nenhuma ação de pagamento vive aqui (isso continua em Gastos/Recorrentes).
 *
 * @param parcelasLancadas quantas parcelas (gastos vinculados) existem de fato
 *                         hoje - pode ser menor que numeroParcelas se uma foi
 *                         removida fora do fluxo (parcelamento incompleto, mesma
 *                         noção de CompraParcelada.parcelasLancadas)
 * @param parcelasPagas    quantas das parcelas lançadas já estão PAGAS
 * @param valorPago        soma do valor das parcelas PAGAS
 * @param valorRestante    soma do valor das parcelas PENDENTES
 * @param parcelas         as parcelas (gastos), ordenadas por data crescente
 */
public record CompraParceladaDetalheDTO(
        Integer id,
        String descricao,
        BigDecimal valorTotal,
        Integer numeroParcelas,
        int parcelasLancadas,
        int parcelasPagas,
        BigDecimal valorPago,
        BigDecimal valorRestante,
        List<Gasto> parcelas) {
}
