package com.controlegastos.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class ComparacaoMensalDTO {
    private int mes;
    private int ano;
    private int mesAnterior;
    private int anoAnterior;
    private List<ComparacaoCategoriaDTO> categorias;
}
