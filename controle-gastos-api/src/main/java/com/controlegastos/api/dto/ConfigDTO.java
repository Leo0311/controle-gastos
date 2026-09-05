package com.controlegastos.api.dto;

/**
 * Limites de validação que o frontend precisa conhecer para checar os formulários
 * antes de enviar (achado M3 da auditoria 2026-09-05: hoje esses números são
 * copiados nos dois lados e podem divergir). O backend continua sendo a
 * autoridade - isto só evita que a UX aceite algo que o servidor vai rejeitar.
 * Objeto aninhado por área para poder crescer sem quebrar o contrato.
 */
public record ConfigDTO(CompraParceladaLimites compraParcelada) {

    public record CompraParceladaLimites(
            int parcelasMin,
            int parcelasMax,
            int primeiraParcelaMesesAtrasMax,
            int primeiraParcelaMesesFrenteMax) {
    }
}
