package com.controlegastos.api.repository;

import com.controlegastos.api.model.Orcamento;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrcamentoRepository extends JpaRepository<Orcamento, Integer> {

    List<Orcamento> findByMesAndAnoOrderByCategoria(int mes, int ano);
}
