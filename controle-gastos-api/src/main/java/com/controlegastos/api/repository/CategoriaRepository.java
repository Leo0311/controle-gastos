package com.controlegastos.api.repository;

import com.controlegastos.api.model.Categoria;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CategoriaRepository extends JpaRepository<Categoria, Integer> {

    // Categorias visíveis para o usuário: as do sistema (usuarioId nulo) + as dele próprio.
    @Query("SELECT c FROM Categoria c WHERE c.usuarioId IS NULL OR c.usuarioId = :usuarioId "
            + "ORDER BY c.nome ASC")
    List<Categoria> findVisiveis(@Param("usuarioId") Integer usuarioId);

    @Query("SELECT c FROM Categoria c WHERE c.id = :id AND (c.usuarioId IS NULL OR c.usuarioId = :usuarioId)")
    Optional<Categoria> findByIdVisivel(@Param("id") Integer id, @Param("usuarioId") Integer usuarioId);

    @Query("SELECT c FROM Categoria c WHERE (c.usuarioId IS NULL OR c.usuarioId = :usuarioId) "
            + "AND LOWER(c.nome) = LOWER(:nome) AND c.id <> :id")
    Optional<Categoria> findDuplicadaVisivel(
            @Param("usuarioId") Integer usuarioId, @Param("nome") String nome, @Param("id") Integer id);
}
