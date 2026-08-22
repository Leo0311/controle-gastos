package com.controlegastos.api.repository;

import com.controlegastos.api.model.Gasto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public interface GastoRepository extends JpaRepository<Gasto, Integer> {

    List<Gasto> findAllByOrderByDataDescIdDesc();

    List<Gasto> findByCategoriaIgnoreCaseOrderByDataDescIdDesc(String categoria);

    List<Gasto> findByDataBetweenOrderByDataDescIdDesc(LocalDate inicio, LocalDate fim);

    @Query("SELECT COALESCE(SUM(g.valor), 0) FROM Gasto g")
    BigDecimal somarTotal();

    @Query("SELECT g.categoria AS categoria, SUM(g.valor) AS total FROM Gasto g GROUP BY g.categoria ORDER BY SUM(g.valor) DESC")
    List<CategoriaTotal> somarPorCategoria();

    @Query("SELECT g.categoria AS categoria, SUM(g.valor) AS total FROM Gasto g "
            + "WHERE g.data BETWEEN :inicio AND :fim GROUP BY g.categoria")
    List<CategoriaTotal> somarPorCategoriaNoPeriodo(@Param("inicio") LocalDate inicio, @Param("fim") LocalDate fim);

    @Query("SELECT COALESCE(SUM(g.valor), 0) FROM Gasto g WHERE g.data BETWEEN :inicio AND :fim")
    BigDecimal somarNoPeriodo(@Param("inicio") LocalDate inicio, @Param("fim") LocalDate fim);

    interface CategoriaTotal {
        String getCategoria();

        BigDecimal getTotal();
    }
}
