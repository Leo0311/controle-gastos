package com.controlegastos.api.dto;

/**
 * Contadores agregados de uma fonte de contas (uma recorrência ou uma compra
 * parcelada) para os badges das abas Recorrentes/Parceladas e o "N lançamentos
 * futuros" da aba Recorrentes - resposta de GET /api/gastos/status-por-fonte.
 *
 * @param tipo      "RECORRENTE" ou "PARCELADA"
 * @param id        id da recorrência ou da compra parcelada
 * @param pendentes ocorrências PENDENTES ainda não vencidas
 * @param atrasadas ocorrências PENDENTES com vencimento no passado
 * @param futuros   lançamentos já gerados com data de hoje em diante (qualquer
 *                  status); só usado pela aba Recorrentes
 */
public record StatusPorFonteDTO(
        String tipo,
        Integer id,
        long pendentes,
        long atrasadas,
        long futuros) {
}
