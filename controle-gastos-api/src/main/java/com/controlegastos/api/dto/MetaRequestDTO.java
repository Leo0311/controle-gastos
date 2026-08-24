package com.controlegastos.api.dto;

import java.math.BigDecimal;

public record MetaRequestDTO(int mes, int ano, BigDecimal valorMeta) {
}
