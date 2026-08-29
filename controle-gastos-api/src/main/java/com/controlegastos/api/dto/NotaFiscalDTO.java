package com.controlegastos.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@AllArgsConstructor
public class NotaFiscalDTO {
    private String estabelecimento;
    private BigDecimal valor;
    private LocalDate dataEmissao;
}
