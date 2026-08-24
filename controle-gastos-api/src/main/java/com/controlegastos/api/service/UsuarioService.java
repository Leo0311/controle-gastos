package com.controlegastos.api.service;

import com.controlegastos.api.dto.CadastroRequestDTO;
import com.controlegastos.api.dto.LoginRequestDTO;
import com.controlegastos.api.dto.LoginResponseDTO;
import com.controlegastos.api.dto.RendaDTO;
import com.controlegastos.api.exception.CredenciaisInvalidasException;
import com.controlegastos.api.exception.EmailJaCadastradoException;
import com.controlegastos.api.exception.RecursoNaoEncontradoException;
import com.controlegastos.api.exception.TokenInvalidoException;
import com.controlegastos.api.model.Usuario;
import com.controlegastos.api.repository.UsuarioRepository;
import com.controlegastos.api.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.MailException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class UsuarioService {

    private static final int TAMANHO_MINIMO_SENHA = 6;

    private final UsuarioRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final EmailService emailService;

    public LoginResponseDTO cadastrar(CadastroRequestDTO dados) {
        validarCadastro(dados);

        if (repository.findByEmailIgnoreCase(dados.email()).isPresent()) {
            throw new EmailJaCadastradoException("Já existe uma conta com esse e-mail.");
        }

        Usuario usuario = new Usuario();
        usuario.setNome(dados.nome().trim());
        usuario.setEmail(dados.email().trim().toLowerCase());
        usuario.setSenha(passwordEncoder.encode(dados.senha()));
        usuario.setDataCriacao(LocalDateTime.now());
        usuario = repository.save(usuario);

        return gerarResposta(usuario);
    }

    public LoginResponseDTO login(LoginRequestDTO dados) {
        Usuario usuario = repository.findByEmailIgnoreCase(dados.email() == null ? "" : dados.email().trim())
                .orElseThrow(() -> new CredenciaisInvalidasException("E-mail ou senha inválidos."));

        if (dados.senha() == null || !passwordEncoder.matches(dados.senha(), usuario.getSenha())) {
            throw new CredenciaisInvalidasException("E-mail ou senha inválidos.");
        }

        return gerarResposta(usuario);
    }

    public void esqueciSenha(String email) {
        if (email == null || email.isBlank()) {
            return;
        }
        repository.findByEmailIgnoreCase(email.trim()).ifPresent(usuario -> {
            String token = UUID.randomUUID().toString();
            usuario.setTokenRedefinicaoSenha(token);
            usuario.setTokenRedefinicaoExpiracao(LocalDateTime.now().plusHours(1));
            repository.save(usuario);
            try {
                emailService.enviarEmailRedefinicaoSenha(usuario.getEmail(), usuario.getNome(), token);
            } catch (MailException e) {
                log.error("Falha ao enviar e-mail de redefinição de senha para {}", usuario.getEmail(), e);
            }
        });
        // Não revela se o e-mail existe ou não: a resposta é sempre a mesma
        // no controller, independente do e-mail ser encontrado aqui.
    }

    public void redefinirSenha(String token, String novaSenha) {
        if (token == null || token.isBlank()) {
            throw new TokenInvalidoException("Link de redefinição inválido.");
        }

        Usuario usuario = repository.findByTokenRedefinicaoSenha(token)
                .orElseThrow(() -> new TokenInvalidoException("Link de redefinição inválido ou já utilizado."));

        if (usuario.getTokenRedefinicaoExpiracao() == null
                || usuario.getTokenRedefinicaoExpiracao().isBefore(LocalDateTime.now())) {
            throw new TokenInvalidoException("Link de redefinição expirado. Solicite um novo.");
        }

        if (novaSenha == null || novaSenha.length() < TAMANHO_MINIMO_SENHA) {
            throw new IllegalArgumentException("A nova senha deve ter pelo menos 6 caracteres.");
        }

        usuario.setSenha(passwordEncoder.encode(novaSenha));
        usuario.setTokenRedefinicaoSenha(null);
        usuario.setTokenRedefinicaoExpiracao(null);
        repository.save(usuario);
    }

    public RendaDTO atualizarRenda(BigDecimal rendaMensal, Integer usuarioId) {
        if (rendaMensal == null || rendaMensal.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Renda mensal deve ser maior que zero.");
        }
        Usuario usuario = repository.findById(usuarioId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Usuário não encontrado."));
        usuario.setRendaMensal(rendaMensal);
        repository.save(usuario);
        return new RendaDTO(rendaMensal);
    }

    private LoginResponseDTO gerarResposta(Usuario usuario) {
        String token = jwtService.gerarToken(usuario.getId(), usuario.getEmail());
        return new LoginResponseDTO(token, usuario.getId(), usuario.getNome(), usuario.getEmail());
    }

    private void validarCadastro(CadastroRequestDTO dados) {
        if (dados.nome() == null || dados.nome().isBlank()) {
            throw new IllegalArgumentException("Nome não pode ser vazio.");
        }
        if (dados.email() == null || dados.email().isBlank() || !dados.email().contains("@")) {
            throw new IllegalArgumentException("E-mail inválido.");
        }
        if (dados.senha() == null || dados.senha().length() < TAMANHO_MINIMO_SENHA) {
            throw new IllegalArgumentException("A senha deve ter pelo menos 6 caracteres.");
        }
    }
}
