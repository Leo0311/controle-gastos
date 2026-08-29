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
 * Sempre pertence a uma categoria específica - o dropdown de subcategoria no
 * formulário depende da categoria escolhida primeiro. usuarioId nulo = subcategoria
 * padrão do sistema, visível a todos (mesmo padrão de Categoria) - ver
 * SubcategoriaRepository.findVisiveis.
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

    // NULL = subcategoria padrão do sistema (definida na migração do banco em
    // schema.sql), visível a todos - nunca editável/excluível via API, só as
    // pessoais (usuarioId preenchido) podem ser alteradas pelo próprio dono.
    @Column(name = "usuario_id")
    private Integer usuarioId;

    @Column(nullable = false, length = 60)
    private String nome;

    @Column(nullable = false, length = 16)
    private String emoji;
}
