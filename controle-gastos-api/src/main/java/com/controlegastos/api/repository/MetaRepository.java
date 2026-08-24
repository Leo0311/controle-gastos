package com.controlegastos.api.repository;

import com.controlegastos.api.model.Meta;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MetaRepository extends JpaRepository<Meta, Integer> {

    Optional<Meta> findByUsuarioIdAndMesAndAno(Integer usuarioId, int mes, int ano);

    Optional<Meta> findByIdAndUsuarioId(Integer id, Integer usuarioId);
}
