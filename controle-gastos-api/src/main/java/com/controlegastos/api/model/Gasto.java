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
import java.time.LocalDate;

/**
 * Mapeia a tabela "gastos" já existente no banco controle_gastos
 * (criada pelo schema.sql do projeto de console controle-gastos).
 */
@Entity
@Table(name = "gastos")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Gasto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 150)
    private String descricao;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal valor;

    // Espelham o nome da categoria/subcategoria gerenciada (categoriaId/subcategoriaId
    // abaixo) no momento do salvamento - mantidos por compatibilidade com a coluna
    // NOT NULL já existente e como fallback de exibição para gastos legados (criados
    // pelo console, que não tem noção de categoria gerenciada) sem categoriaId.
    @Column(nullable = false, length = 60)
    private String categoria;

    @Column(length = 60)
    private String subcategoria;

    @Column(name = "categoria_id")
    private Integer categoriaId;

    @Column(name = "subcategoria_id")
    private Integer subcategoriaId;

    @Column(nullable = false)
    private LocalDate data;

    @Column(name = "usuario_id")
    private Integer usuarioId;

    @Column(name = "orcamento_id")
    private Integer orcamentoId;
}
