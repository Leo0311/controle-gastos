package com.controlegastos.api.repository;

import com.controlegastos.api.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UsuarioRepository extends JpaRepository<Usuario, Integer> {

    Optional<Usuario> findByEmailIgnoreCase(String email);

    Optional<Usuario> findByTokenRedefinicaoSenha(String token);
}
