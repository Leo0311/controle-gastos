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
 * usuarioId nulo = categoria padrão do sistema, visível para todos os usuários.
 * usuarioId preenchido = categoria personalizada, visível só para quem criou.
 */
@Entity
@Table(name = "categorias")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Categoria {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 60)
    private String nome;

    @Column(nullable = false, length = 16)
    private String emoji;

    @Column(name = "usuario_id")
    private Integer usuarioId;
}
