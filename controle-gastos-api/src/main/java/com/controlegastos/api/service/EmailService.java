package com.controlegastos.api.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.frontend.url}")
    private String frontendUrl;

    public void enviarEmailRedefinicaoSenha(String destinatario, String nome, String token) {
        String link = frontendUrl + "/redefinir-senha?token=" + token;

        SimpleMailMessage mensagem = new SimpleMailMessage();
        mensagem.setTo(destinatario);
        mensagem.setSubject("Redefinição de senha - Controle de Gastos");
        mensagem.setText(
                "Olá, " + nome + "!\n\n"
                        + "Recebemos uma solicitação para redefinir sua senha no Controle de Gastos.\n"
                        + "Clique no link abaixo para criar uma nova senha (válido por 1 hora):\n\n"
                        + link + "\n\n"
                        + "Se você não solicitou isso, ignore este e-mail."
        );

        mailSender.send(mensagem);
    }
}
