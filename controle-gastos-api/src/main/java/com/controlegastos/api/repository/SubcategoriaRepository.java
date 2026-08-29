package com.controlegastos.api.repository;

import com.controlegastos.api.model.Subcategoria;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SubcategoriaRepository extends JpaRepository<Subcategoria, Integer> {

    // Estritas (só do próprio usuário) - usadas só onde a intenção é "posso editar/
    // excluir isso?", nunca pra decidir o que é exibido (ver as *Visiveis abaixo).
    List<Subcategoria> findByUsuarioIdAndCategoriaIdOrderByNomeAsc(Integer usuarioId, Integer categoriaId);

    Optional<Subcategoria> findByIdAndUsuarioId(Integer id, Integer usuarioId);

    // Visíveis pro usuário: as padrão do sistema (usuarioId nulo) + as dele próprio -
    // mesmo padrão de CategoriaRepository. Usadas pra listar/validar subcategoria em
    // qualquer contexto que não seja "posso editar/excluir isso?".
    @Query("SELECT s FROM Subcategoria s WHERE (s.usuarioId IS NULL OR s.usuarioId = :usuarioId) "
            + "AND s.categoriaId = :categoriaId ORDER BY s.nome ASC")
    List<Subcategoria> findVisiveisPorCategoria(
            @Param("usuarioId") Integer usuarioId, @Param("categoriaId") Integer categoriaId);

    @Query("SELECT s FROM Subcategoria s WHERE s.usuarioId IS NULL OR s.usuarioId = :usuarioId ORDER BY s.nome ASC")
    List<Subcategoria> findVisiveis(@Param("usuarioId") Integer usuarioId);

    @Query("SELECT s FROM Subcategoria s WHERE s.id = :id AND (s.usuarioId IS NULL OR s.usuarioId = :usuarioId)")
    Optional<Subcategoria> findByIdVisivel(@Param("id") Integer id, @Param("usuarioId") Integer usuarioId);

    @Query("SELECT s FROM Subcategoria s WHERE (s.usuarioId IS NULL OR s.usuarioId = :usuarioId) "
            + "AND s.categoriaId = :categoriaId AND LOWER(s.nome) = LOWER(:nome) AND s.id <> :id")
    Optional<Subcategoria> findDuplicadaVisivel(
            @Param("usuarioId") Integer usuarioId, @Param("categoriaId") Integer categoriaId,
            @Param("nome") String nome, @Param("id") Integer id);
}
