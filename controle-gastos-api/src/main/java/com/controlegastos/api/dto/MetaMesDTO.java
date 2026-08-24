package com.controlegastos.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
public class MetaMesDTO {
    private BigDecimal rendaMensal;
    private BigDecimal totalGasto;
    private BigDecimal economiaReal;
    private Integer metaId;
    private BigDecimal valorMeta;
    private BigDecimal percentualMeta;
}
