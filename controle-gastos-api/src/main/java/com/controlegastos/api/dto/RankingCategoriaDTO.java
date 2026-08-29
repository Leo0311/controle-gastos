package com.controlegastos.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@AllArgsConstructor
public class RankingCategoriaDTO {
    /** Nulo quando o gasto é legado e não tem uma categoria gerenciada vinculada. */
    private Integer categoriaId;
    private String categoria;
    private BigDecimal total;
    /** Percentual do total geral do mês. */
    private BigDecimal percentual;
    private List<RankingSubcategoriaDTO> subcategorias;
}
