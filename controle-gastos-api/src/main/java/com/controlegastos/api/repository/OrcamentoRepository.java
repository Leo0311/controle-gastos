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

    List<Orcamento> findByUsuarioIdAndMesAndAnoOrderByCategoriaAscSubcategoriaAsc(Integer usuarioId, int mes, int ano);

    // COALESCE(..., '') trata dois orçamentos "gerais" (subcategoria nula) da mesma
    // categoria/mês/ano como duplicados entre si, mas não conflita com um orçamento
    // de subcategoria específica - mesmo critério do índice único no banco.
    @Query("SELECT o FROM Orcamento o WHERE o.usuarioId = :usuarioId "
            + "AND LOWER(o.categoria) = LOWER(:categoria) "
            + "AND COALESCE(LOWER(o.subcategoria), '') = COALESCE(LOWER(:subcategoria), '') "
            + "AND o.mes = :mes AND o.ano = :ano AND o.id <> :id")
    Optional<Orcamento> findDuplicado(
            @Param("usuarioId") Integer usuarioId,
            @Param("categoria") String categoria,
            @Param("subcategoria") String subcategoria,
            @Param("mes") int mes,
            @Param("ano") int ano,
            @Param("id") Integer id);
}
