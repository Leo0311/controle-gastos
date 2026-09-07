package com.controlegastos.api.model;

/**
 * Estado de pagamento de um gasto (coluna gastos.status_pagamento).
 *
 * <ul>
 *   <li>{@code PAGO} - gasto efetivamente pago. Todo gasto avulso nasce PAGO
 *       (usa a própria data informada no cadastro); um gasto de recorrência/
 *       parcela vira PAGO ao confirmar o pagamento (ver GastoService.pagar).</li>
 *   <li>{@code PENDENTE} - gasto previsto mas ainda não pago. Só existe em gastos
 *       originados de uma recorrência ou de uma compra parcelada.</li>
 * </ul>
 *
 * "Atrasada" não é um valor gravado - é calculado na leitura (PENDENTE +
 * vencimento_original no passado), no frontend.
 */
public enum StatusPagamento {
    PENDENTE,
    PAGO
}
