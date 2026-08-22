package com.controlegastos.api.controller;

import com.controlegastos.api.dto.CadastroRequestDTO;
import com.controlegastos.api.dto.EsqueciSenhaRequestDTO;
import com.controlegastos.api.dto.LoginRequestDTO;
import com.controlegastos.api.dto.LoginResponseDTO;
import com.controlegastos.api.dto.RedefinirSenhaRequestDTO;
import com.controlegastos.api.service.UsuarioService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UsuarioService service;

    @PostMapping("/cadastro")
    @ResponseStatus(HttpStatus.CREATED)
    public LoginResponseDTO cadastro(@RequestBody CadastroRequestDTO dados) {
        return service.cadastrar(dados);
    }

    @PostMapping("/login")
    public LoginResponseDTO login(@RequestBody LoginRequestDTO dados) {
        return service.login(dados);
    }

    @PostMapping("/esqueci-senha")
    public ResponseEntity<Void> esqueciSenha(@RequestBody EsqueciSenhaRequestDTO dados) {
        service.esqueciSenha(dados.email());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/redefinir-senha")
    public ResponseEntity<Void> redefinirSenha(@RequestBody RedefinirSenhaRequestDTO dados) {
        service.redefinirSenha(dados.token(), dados.novaSenha());
        return ResponseEntity.ok().build();
    }
}
