package com.controlegastos.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@AllArgsConstructor
public class RankingCategoriasDTO {
    private BigDecimal totalGeral;
    private List<RankingCategoriaDTO> categorias;
}
