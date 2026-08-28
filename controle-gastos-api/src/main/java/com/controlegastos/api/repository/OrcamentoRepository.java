package com.controlegastos.api.repository;

import com.controlegastos.api.model.Orcamento;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface OrcamentoRepository extends JpaRepository<Orcamento, Integer> {

    List<Orcamento> findAllByUsuarioId(Integer usuarioId);

    Optional<Orcamento> findByIdAndUsuarioId(Integer id, Integer usuarioId);

    List<Orcamento> findByUsuarioIdAndMesAndAno(Integer usuarioId, int mes, int ano);

    boolean existsByCategoriaId(Integer categoriaId);

    boolean existsBySubcategoriaId(Integer subcategoriaId);

    // COALESCE(..., 0) trata dois orçamentos "gerais" (subcategoriaId nulo) da mesma
    // categoria/mês/ano como duplicados entre si, mas não conflita com um orçamento
    // de subcategoria específica - mesmo critério do índice único no banco.
    @Query("SELECT o FROM Orcamento o WHERE o.usuarioId = :usuarioId "
            + "AND o.categoriaId = :categoriaId "
            + "AND COALESCE(o.subcategoriaId, 0) = COALESCE(:subcategoriaId, 0) "
            + "AND o.mes = :mes AND o.ano = :ano AND o.id <> :id")
    Optional<Orcamento> findDuplicado(
            @Param("usuarioId") Integer usuarioId,
            @Param("categoriaId") Integer categoriaId,
            @Param("subcategoriaId") Integer subcategoriaId,
            @Param("mes") int mes,
            @Param("ano") int ano,
            @Param("id") Integer id);
}
