package com.controlegastos.api.repository;

import com.controlegastos.api.model.Orcamento;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OrcamentoRepository extends JpaRepository<Orcamento, Integer> {

    List<Orcamento> findAllByUsuarioId(Integer usuarioId);

    Optional<Orcamento> findByIdAndUsuarioId(Integer id, Integer usuarioId);

    List<Orcamento> findByUsuarioIdAndMesAndAnoOrderByCategoria(Integer usuarioId, int mes, int ano);
}
