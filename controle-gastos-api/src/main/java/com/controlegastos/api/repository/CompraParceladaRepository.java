package com.controlegastos.api.repository;

import com.controlegastos.api.model.CompraParcelada;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CompraParceladaRepository extends JpaRepository<CompraParcelada, Integer> {

    List<CompraParcelada> findAllByUsuarioIdOrderByDataCriacaoDesc(Integer usuarioId);

    Optional<CompraParcelada> findByIdAndUsuarioId(Integer id, Integer usuarioId);

    boolean existsByCategoriaId(Integer categoriaId);

    boolean existsBySubcategoriaId(Integer subcategoriaId);
}
