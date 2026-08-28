package com.controlegastos.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
public class CategoriaTotalDTO {
    /** Nulo quando o gasto é legado e não tem uma categoria gerenciada vinculada. */
    private Integer categoriaId;
    private String categoria;
    private BigDecimal total;
}
