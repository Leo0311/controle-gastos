package com.controlegastos.api.repository;

import com.controlegastos.api.model.GastoRecorrente;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GastoRecorrenteRepository extends JpaRepository<GastoRecorrente, Integer> {

    List<GastoRecorrente> findAllByUsuarioIdOrderByDescricaoAsc(Integer usuarioId);

    Optional<GastoRecorrente> findByIdAndUsuarioId(Integer id, Integer usuarioId);

    List<GastoRecorrente> findByUsuarioIdAndAtivoTrue(Integer usuarioId);

    long countByCategoriaId(Integer categoriaId);

    long countBySubcategoriaId(Integer subcategoriaId);
}
