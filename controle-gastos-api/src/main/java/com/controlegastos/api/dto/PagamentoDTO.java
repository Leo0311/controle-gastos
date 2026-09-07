package com.controlegastos.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Corpo de PATCH /api/gastos/{id}/pagar: valor efetivamente pago (pré-preenchido
 * no frontend com o previsto, mas editável) e data real do pagamento (padrão
 * hoje, editável). {@code data} nula = hoje (o service resolve).
 */
public record PagamentoDTO(BigDecimal valor, LocalDate data) {
}
