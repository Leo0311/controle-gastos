package com.controlegastos.api.repository;

import com.controlegastos.api.model.Subcategoria;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SubcategoriaRepository extends JpaRepository<Subcategoria, Integer> {

    List<Subcategoria> findByUsuarioIdAndCategoriaIdOrderByNomeAsc(Integer usuarioId, Integer categoriaId);

    List<Subcategoria> findByUsuarioIdOrderByNomeAsc(Integer usuarioId);

    Optional<Subcategoria> findByIdAndUsuarioId(Integer id, Integer usuarioId);

    @Query("SELECT s FROM Subcategoria s WHERE s.usuarioId = :usuarioId AND s.categoriaId = :categoriaId "
            + "AND LOWER(s.nome) = LOWER(:nome) AND s.id <> :id")
    Optional<Subcategoria> findDuplicada(
            @Param("usuarioId") Integer usuarioId, @Param("categoriaId") Integer categoriaId,
            @Param("nome") String nome, @Param("id") Integer id);
}
