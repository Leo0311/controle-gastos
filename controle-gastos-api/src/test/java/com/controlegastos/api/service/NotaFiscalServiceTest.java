package com.controlegastos.api.service;

import com.controlegastos.api.dto.NotaFiscalDTO;
import com.controlegastos.api.exception.NotaFiscalIndisponivelException;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class NotaFiscalServiceTest {

    private final NotaFiscalService service = new NotaFiscalService();

    @Test
    void extrairDados_deveExtrairEstabelecimentoValorEDataDeUmaNotaValida() throws IOException {
        String html = lerFixture("nfce-sefaz-sc-exemplo.html");

        NotaFiscalDTO dados = service.extrairDados(html);

        assertEquals("MERCADO TESTE LTDA", dados.getEstabelecimento());
        assertEquals(0, new BigDecimal("123.45").compareTo(dados.getValor()));
        assertEquals(LocalDate.of(2026, 3, 15), dados.getDataEmissao());
    }

    // A URL pública real do QR Code da SEFAZ-SC costuma mostrar uma página de
    // "validação de segurança" (captcha) em vez da nota - a extração precisa
    // reconhecer isso e falhar de forma clara, não interpretar a página de captcha
    // como se fosse a nota (ou pior, quebrar com uma exceção não tratada).
    @Test
    void extrairDados_deveFalharComMensagemClaraQuandoPaginaEDeValidacaoDeSeguranca() throws IOException {
        String html = lerFixture("nfce-sefaz-sc-captcha.html");

        NotaFiscalIndisponivelException erro = assertThrows(
                NotaFiscalIndisponivelException.class, () -> service.extrairDados(html));
        assertEquals(
                "A SEFAZ-SC pediu uma validação de segurança antes de mostrar os dados da nota, "
                        + "e isso não pode ser feito automaticamente. Preencha os dados manualmente.",
                erro.getMessage());
    }

    @Test
    void extrairDados_deveFalharComMensagemClaraParaHtmlComFormatoInesperado() {
        NotaFiscalIndisponivelException erro = assertThrows(
                NotaFiscalIndisponivelException.class,
                () -> service.extrairDados("<html><body><p>Página fora do ar</p></body></html>"));
        assertEquals("Não consegui identificar os dados dessa nota fiscal. O formato da página pode ter mudado.",
                erro.getMessage());
    }

    // Proteção contra SSRF: nenhuma requisição HTTP deve ser feita pra um domínio
    // que não seja da SEFAZ-SC - a validação precisa acontecer ANTES de qualquer
    // tentativa de rede (por isso este teste não precisa de nenhum mock de rede: se
    // o método tentasse conectar, o teste ficaria lento/travaria em vez de retornar
    // IllegalArgumentException imediatamente).
    @Test
    void consultar_deveRejeitarUrlDeDominioDiferenteDaSefazSc() {
        IllegalArgumentException erro = assertThrows(
                IllegalArgumentException.class,
                () -> service.consultar("https://exemplo-malicioso.com.br/nfce/consulta?p=123"));
        assertEquals("Essa URL não pertence à SEFAZ-SC. Por enquanto só é possível ler notas fiscais catarinenses (NFC-e).",
                erro.getMessage());
    }

    @Test
    void consultar_deveRejeitarUrlComEsquemaDiferenteDeHttps() {
        assertThrows(IllegalArgumentException.class, () -> service.consultar("http://sat.sef.sc.gov.br/nfce/consulta?p=123"));
    }

    @Test
    void consultar_deveRejeitarUrlVazia() {
        assertThrows(IllegalArgumentException.class, () -> service.consultar(""));
        assertThrows(IllegalArgumentException.class, () -> service.consultar(null));
    }

    private String lerFixture(String nome) throws IOException {
        try (InputStream in = getClass().getClassLoader().getResourceAsStream(nome)) {
            if (in == null) {
                throw new IOException("Fixture não encontrada: " + nome);
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
