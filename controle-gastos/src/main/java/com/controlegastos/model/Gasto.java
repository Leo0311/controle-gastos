package com.controlegastos.model;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Representa um gasto/despesa lançado pelo usuário.
 */
public class Gasto {

    private Integer id;
    private String descricao;
    private BigDecimal valor;
    private String categoria;
    private LocalDate data;

    public Gasto() {
    }

    public Gasto(String descricao, BigDecimal valor, String categoria, LocalDate data) {
        this.descricao = descricao;
        this.valor = valor;
        this.categoria = categoria;
        this.data = data;
    }

    public Gasto(Integer id, String descricao, BigDecimal valor, String categoria, LocalDate data) {
        this.id = id;
        this.descricao = descricao;
        this.valor = valor;
        this.categoria = categoria;
        this.data = data;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getDescricao() {
        return descricao;
    }

    public void setDescricao(String descricao) {
        this.descricao = descricao;
    }

    public BigDecimal getValor() {
        return valor;
    }

    public void setValor(BigDecimal valor) {
        this.valor = valor;
    }

    public String getCategoria() {
        return categoria;
    }

    public void setCategoria(String categoria) {
        this.categoria = categoria;
    }

    public LocalDate getData() {
        return data;
    }

    public void setData(LocalDate data) {
        this.data = data;
    }

    @Override
    public String toString() {
        return String.format("#%-4d %-12s R$ %-10s %-15s %s",
                id, data, valor.toPlainString(), categoria, descricao);
    }
}
