package com.controlegastos.api.repository;

import com.controlegastos.api.model.Gasto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface GastoRepository extends JpaRepository<Gasto, Integer> {

    List<Gasto> findAllByUsuarioIdOrderByDataDescIdDesc(Integer usuarioId);

    Optional<Gasto> findByIdAndUsuarioId(Integer id, Integer usuarioId);

    List<Gasto> findByUsuarioIdAndCategoriaIgnoreCaseOrderByDataDescIdDesc(Integer usuarioId, String categoria);

    List<Gasto> findByUsuarioIdAndDataBetweenOrderByDataDescIdDesc(Integer usuarioId, LocalDate inicio, LocalDate fim);

    boolean existsByCategoriaId(Integer categoriaId);

    boolean existsBySubcategoriaId(Integer subcategoriaId);

    // Agrupa por categoriaId quando presente (fonte de verdade); GROUP BY também por
    // LOWER(categoria) porque categoriaId nulo (gastos legados, sem categoria gerenciada
    // vinculada) não separa grupos no SQL - todo NULL cai no mesmo grupo por padrão.
    @Query("SELECT g.categoriaId AS categoriaId, LOWER(g.categoria) AS categoria, SUM(g.valor) AS total FROM Gasto g "
            + "WHERE g.usuarioId = :usuarioId AND g.data BETWEEN :inicio AND :fim "
            + "GROUP BY g.categoriaId, LOWER(g.categoria) ORDER BY SUM(g.valor) DESC")
    List<CategoriaTotal> somarPorCategoriaNoPeriodo(
            @Param("usuarioId") Integer usuarioId, @Param("inicio") LocalDate inicio, @Param("fim") LocalDate fim);

    @Query("SELECT COALESCE(SUM(g.valor), 0) FROM Gasto g WHERE g.orcamentoId = :orcamentoId")
    BigDecimal somarPorOrcamento(@Param("orcamentoId") Integer orcamentoId);

    @Query("SELECT COALESCE(SUM(g.valor), 0) FROM Gasto g "
            + "WHERE g.usuarioId = :usuarioId AND g.data BETWEEN :inicio AND :fim")
    BigDecimal somarNoPeriodo(
            @Param("usuarioId") Integer usuarioId, @Param("inicio") LocalDate inicio, @Param("fim") LocalDate fim);

    interface CategoriaTotal {
        Integer getCategoriaId();

        String getCategoria();

        BigDecimal getTotal();
    }
}
