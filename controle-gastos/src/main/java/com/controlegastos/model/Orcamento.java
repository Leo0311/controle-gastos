package com.controlegastos.model;

import java.math.BigDecimal;

/**
 * Representa o orçamento (valor limite) definido para uma categoria em um mês/ano.
 */
public class Orcamento {

    private Integer id;
    private String categoria;
    private BigDecimal valorLimite;
    private int mes;
    private int ano;

    public Orcamento() {
    }

    public Orcamento(String categoria, BigDecimal valorLimite, int mes, int ano) {
        this.categoria = categoria;
        this.valorLimite = valorLimite;
        this.mes = mes;
        this.ano = ano;
    }

    public Orcamento(Integer id, String categoria, BigDecimal valorLimite, int mes, int ano) {
        this.id = id;
        this.categoria = categoria;
        this.valorLimite = valorLimite;
        this.mes = mes;
        this.ano = ano;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getCategoria() {
        return categoria;
    }

    public void setCategoria(String categoria) {
        this.categoria = categoria;
    }

    public BigDecimal getValorLimite() {
        return valorLimite;
    }

    public void setValorLimite(BigDecimal valorLimite) {
        this.valorLimite = valorLimite;
    }

    public int getMes() {
        return mes;
    }

    public void setMes(int mes) {
        this.mes = mes;
    }

    public int getAno() {
        return ano;
    }

    public void setAno(int ano) {
        this.ano = ano;
    }

    @Override
    public String toString() {
        return String.format("#%-4d %-15s limite R$ %-10s %02d/%d",
                id, categoria, valorLimite.toPlainString(), mes, ano);
    }
}
