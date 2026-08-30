package com.controlegastos.api.repository;

import com.controlegastos.api.model.CategoriaOrdemUsuario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CategoriaOrdemUsuarioRepository extends JpaRepository<CategoriaOrdemUsuario, Integer> {

    List<CategoriaOrdemUsuario> findByUsuarioId(Integer usuarioId);
}
