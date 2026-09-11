package com.controlegastos.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@AllArgsConstructor
public class ResumoDTO {
    private BigDecimal totalGeral;
    // Quantidade de gastos no período - poupa o frontend de baixar a lista inteira
    // só pra fazer .length (achado de performance, rodada 2026-09-11).
    private long quantidadeGastos;
    private List<CategoriaTotalDTO> porCategoria;
}
