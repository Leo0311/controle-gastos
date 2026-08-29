package com.controlegastos.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
public class ComparacaoCategoriaDTO {
    /** Nulo quando o gasto é legado e não tem uma categoria gerenciada vinculada. */
    private Integer categoriaId;
    private String categoria;
    private BigDecimal totalAtual;
    private BigDecimal totalAnterior;
    private BigDecimal variacaoAbsoluta;
    /** Nulo quando totalAnterior é zero (categoriaNova = true) - variação percentual não é definida nesse caso. */
    private BigDecimal variacaoPercentual;
    /** true quando a categoria não teve nenhum gasto no mês anterior. */
    private boolean categoriaNova;
}
