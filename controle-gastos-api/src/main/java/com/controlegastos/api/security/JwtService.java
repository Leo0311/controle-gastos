package com.controlegastos.api.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtService {

    private static final long VALIDADE_MS = 1000L * 60 * 60 * 6; // 6 horas

    private final SecretKey chave;

    public JwtService(@Value("${app.jwt.secret}") String segredo) {
        this.chave = Keys.hmacShaKeyFor(segredo.getBytes(StandardCharsets.UTF_8));
    }

    public String gerarToken(Integer usuarioId, String email, Integer tokenVersion) {
        Date agora = new Date();
        Date expiracao = new Date(agora.getTime() + VALIDADE_MS);
        return Jwts.builder()
                .subject(email)
                .claim("usuarioId", usuarioId)
                .claim("tokenVersion", tokenVersion)
                .issuedAt(agora)
                .expiration(expiracao)
                .signWith(chave)
                .compact();
    }

    public boolean tokenValido(String token) {
        try {
            extrairClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public Integer extrairUsuarioId(String token) {
        return extrairClaims(token).get("usuarioId", Integer.class);
    }

    // Tokens emitidos antes da introdução do claim retornam null; o filtro trata
    // esse caso como versão 0 (o mesmo default de quem nunca trocou de senha).
    public Integer extrairTokenVersion(String token) {
        return extrairClaims(token).get("tokenVersion", Integer.class);
    }

    private Claims extrairClaims(String token) {
        return Jwts.parser()
                .verifyWith(chave)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
