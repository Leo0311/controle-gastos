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
 * Preferência de ordem de categorias de UM usuário específico - nunca afeta a
 * visão de outros usuários, mesmo para categorias padrão do sistema
 * (compartilhadas). Só existe uma linha por categoria depois que o usuário
 * personaliza a ordem pela primeira vez - ver CategoriaService.mover.
 */
@Entity
@Table(name = "categorias_ordem_usuario")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CategoriaOrdemUsuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "usuario_id", nullable = false)
    private Integer usuarioId;

    @Column(name = "categoria_id", nullable = false)
    private Integer categoriaId;

    @Column(nullable = false)
    private Integer posicao;
}
