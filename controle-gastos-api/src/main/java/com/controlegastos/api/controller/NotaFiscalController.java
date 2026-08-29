package com.controlegastos.api.controller;

import com.controlegastos.api.dto.NotaFiscalConsultaRequestDTO;
import com.controlegastos.api.dto.NotaFiscalDTO;
import com.controlegastos.api.security.UsuarioPrincipal;
import com.controlegastos.api.service.NotaFiscalService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notas-fiscais")
@RequiredArgsConstructor
public class NotaFiscalController {

    private final NotaFiscalService service;

    // usuario não é usado além de exigir autenticação (mesmo padrão de todo o resto
    // da API) - a consulta em si não é escopada por usuário, nenhum dado é salvo aqui.
    @PostMapping("/consultar")
    public NotaFiscalDTO consultar(
            @RequestBody NotaFiscalConsultaRequestDTO dados, @AuthenticationPrincipal UsuarioPrincipal usuario) {
        return service.consultar(dados.url());
    }
}
