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

/**
 * Sempre pertence a um usuário (não existem subcategorias padrão do sistema) e a
 * uma categoria específica - o dropdown de subcategoria no formulário depende da
 * categoria escolhida primeiro.
 */
@Entity
@Table(name = "subcategorias")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Subcategoria {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "categoria_id", nullable = false)
    private Integer categoriaId;

    @Column(name = "usuario_id", nullable = false)
    private Integer usuarioId;

    @Column(nullable = false, length = 60)
    private String nome;
}
