package com.controlegastos.api.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Mapeia a tabela "orcamentos" já existente no banco controle_gastos
 * (criada pelo schema.sql do projeto de console controle-gastos).
 */
@Entity
@Table(name = "orcamentos")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Orcamento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 60)
    private String categoria;

    @Column(length = 60)
    private String subcategoria;

    @Column(name = "valor_limite", nullable = false, precision = 12, scale = 2)
    private BigDecimal valorLimite;

    @Column(nullable = false)
    private int mes;

    @Column(nullable = false)
    private int ano;

    @Column(name = "usuario_id")
    private Integer usuarioId;
}
