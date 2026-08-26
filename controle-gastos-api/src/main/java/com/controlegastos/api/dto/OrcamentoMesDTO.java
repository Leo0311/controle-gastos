package com.controlegastos.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
public class OrcamentoMesDTO {
    private Integer id;
    private String categoria;
    private BigDecimal valorLimite;
    private BigDecimal gasto;
    private boolean ultrapassou;
    private boolean completo;
    private boolean proximoDoLimite;
}
