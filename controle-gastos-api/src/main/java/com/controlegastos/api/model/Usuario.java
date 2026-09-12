package com.controlegastos.api.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "usuarios")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 150)
    private String nome;

    @Column(nullable = false, unique = true, length = 150)
    private String email;

    // Nullable desde V2__login_google.sql: conta criada via "Entrar com Google" não
    // tem senha real - null é o próprio marcador de "login só por Google", sem
    // precisar de uma coluna boolean à parte (ver googleId abaixo). Uma conta pode
    // ganhar senha depois via "esqueci minha senha" (não há restrição nesse fluxo).
    @Column(length = 255)
    private String senha;

    @Column(name = "data_criacao", nullable = false)
    private LocalDateTime dataCriacao;

    @Column(name = "token_redefinicao_senha", length = 255)
    private String tokenRedefinicaoSenha;

    @Column(name = "token_redefinicao_expiracao")
    private LocalDateTime tokenRedefinicaoExpiracao;

    @Column(name = "renda_mensal", precision = 12, scale = 2)
    private BigDecimal rendaMensal;

    // Incrementado sempre que a senha é alterada (ver UsuarioService.redefinirSenha).
    // O valor no momento do login vai embutido no JWT como claim "tokenVersion" e é
    // reconferido a cada requisição (ver JwtAuthFilter): um token emitido antes da
    // troca de senha carrega a versão antiga e deixa de ser aceito, forçando logout.
    @Column(name = "token_version", nullable = false)
    private Integer tokenVersion = 0;

    // "sub" da conta Google (identificador estável, devolvido pelo userinfo do
    // Google - ver GoogleTokenVerifier), preenchido no 1º login/vínculo via
    // Google (ver UsuarioService). Null pra quem nunca usou "Entrar com Google".
    // Unique (V2__login_google.sql): duas contas nunca podem apontar pro mesmo
    // usuário Google.
    @Column(name = "google_id", unique = true, length = 255)
    private String googleId;
}
