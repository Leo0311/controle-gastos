package com.controlegastos.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
public class TotalDiarioDTO {
    private int dia;
    private BigDecimal total;
}
