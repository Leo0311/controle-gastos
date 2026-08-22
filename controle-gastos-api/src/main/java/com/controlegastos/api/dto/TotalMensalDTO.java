package com.controlegastos.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
public class TotalMensalDTO {
    private int mes;
    private int ano;
    private BigDecimal total;
}
