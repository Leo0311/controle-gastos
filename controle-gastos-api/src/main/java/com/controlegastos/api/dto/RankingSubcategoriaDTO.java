package com.controlegastos.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
public class RankingSubcategoriaDTO {
    /** Nulo quando os gastos da categoria não têm subcategoria vinculada. */
    private Integer subcategoriaId;
    private String subcategoria;
    private BigDecimal total;
    /** Percentual do total da CATEGORIA (não do total geral do mês). */
    private BigDecimal percentual;
}
