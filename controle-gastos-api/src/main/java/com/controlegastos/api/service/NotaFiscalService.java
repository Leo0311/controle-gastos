package com.controlegastos.api.service;

import com.controlegastos.api.dto.NotaFiscalDTO;
import com.controlegastos.api.exception.NotaFiscalIndisponivelException;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Lê os dados de uma NFC-e (nota fiscal de consumidor eletrônica) a partir da URL
 * decodificada do QR Code impresso nela - hoje só a SEFAZ-SC (Santa Catarina) é
 * suportada. A URL aponta pra uma página HTML pública da própria SEFAZ (não existe
 * API JSON oficial), então os dados são extraídos via parsing de HTML (Jsoup) em
 * vez de uma chamada estruturada.
 */
@Service
public class NotaFiscalService {

    // Domínios oficiais da consulta pública de NFC-e da SEFAZ-SC (produção e
    // homologação) - qualquer URL fora dessa lista é rejeitada antes de qualquer
    // requisição HTTP, pra este endpoint nunca virar um jeito de fazer o servidor
    // buscar uma URL arbitrária por conta de terceiros (SSRF). Comparação por
    // igualdade exata do host, nunca contains/endsWith (evita truques como
    // "sat.sef.sc.gov.br.dominio-malicioso.com" ou "malicioso-sat.sef.sc.gov.br").
    private static final Set<String> DOMINIOS_PERMITIDOS = Set.of("sat.sef.sc.gov.br", "hom.sat.sef.sc.gov.br");

    // Ex: "Emissão: 21/11/2024 10:35:22" (o texto normalizado pelo Jsoup colapsa
    // espaços/quebras de linha em um só espaço) - captura só a data.
    private static final Pattern PADRAO_DATA_EMISSAO = Pattern.compile("Emiss\u00e3o:\\s*(\\d{2}/\\d{2}/\\d{4})");
    private static final DateTimeFormatter FORMATO_DATA_BR = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final HttpClient httpClient = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NORMAL)
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public NotaFiscalDTO consultar(String urlNota) {
        URI uri = validarUrl(urlNota);
        String html = buscarHtml(uri);
        return extrairDados(html);
    }

    // Visibilidade de pacote (não private) só pra ser testável diretamente (ver
    // NotaFiscalServiceTest) sem precisar de rede.
    URI validarUrl(String urlNota) {
        if (urlNota == null || urlNota.isBlank()) {
            throw new IllegalArgumentException("Informe a URL da nota fiscal.");
        }
        String bruta = urlNota.trim();

        // O parâmetro "p" do QR Code de NFC-e real traz a chave de acesso e outros
        // campos separados por "|" (ex: "chave|versaoQR|tpAmb|hash") - um caractere
        // não permitido em URI, então essa string bruta nunca é uma URI válida por
        // si só: o construtor de um único argumento de URI é estrito e lança
        // URISyntaxException pra ela (confirmado contra uma nota fiscal real).
        // Por isso a query é separada do resto da URL aqui e recombinada com o
        // construtor de 5 argumentos, que ESCAPA automaticamente qualquer caractere
        // fora do permitido (em vez de exigir que a entrada já venha escapada) -
        // "|" vira "%7C", que a SEFAZ decodifica de volta corretamente do outro lado.
        int indiceQuery = bruta.indexOf('?');
        String semQuery = indiceQuery >= 0 ? bruta.substring(0, indiceQuery) : bruta;
        String query = indiceQuery >= 0 ? bruta.substring(indiceQuery + 1) : null;

        URI base;
        try {
            base = new URI(semQuery);
        } catch (URISyntaxException e) {
            throw new IllegalArgumentException("URL da nota fiscal inválida.");
        }

        if (!"https".equalsIgnoreCase(base.getScheme())) {
            throw new IllegalArgumentException("A URL da nota fiscal deve usar HTTPS.");
        }
        String host = base.getHost();
        if (host == null || !DOMINIOS_PERMITIDOS.contains(host.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException(
                    "Essa URL não pertence à SEFAZ-SC. Por enquanto só é possível ler notas fiscais catarinenses (NFC-e).");
        }

        try {
            return new URI(base.getScheme(), base.getAuthority(), base.getPath(), query, null);
        } catch (URISyntaxException e) {
            throw new IllegalArgumentException("URL da nota fiscal inválida.");
        }
    }

    private String buscarHtml(URI uri) {
        HttpRequest request = HttpRequest.newBuilder(uri)
                .header("User-Agent", "Mozilla/5.0 (compatible; ControleGastos/1.0)")
                .timeout(Duration.ofSeconds(15))
                .GET()
                .build();
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new NotaFiscalIndisponivelException(
                        "A SEFAZ-SC respondeu com erro (HTTP " + response.statusCode() + "). Tente novamente mais tarde.");
            }
            return response.body();
        } catch (IOException e) {
            throw new NotaFiscalIndisponivelException("Não foi possível acessar a SEFAZ-SC agora. Tente novamente mais tarde.");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new NotaFiscalIndisponivelException("A consulta à SEFAZ-SC foi interrompida. Tente novamente.");
        }
    }

    // Extrai os três campos usados pelo formulário de gasto (estabelecimento, valor,
    // data de emissão) a partir do HTML da página de consulta. Os seletores
    // (div.txtTopo, span.totalNumb.txtMax, "Emissão:" dentro das informações gerais)
    // foram confirmados contra notas reais da SEFAZ-SC - mas a página pública de
    // consulta (a mesma URL do QR Code) às vezes exige uma validação de segurança
    // (captcha) antes de mostrar a nota de verdade, que este serviço não tenta
    // resolver; nesse caso (e em qualquer formato inesperado) a extração falha de
    // forma clara em vez de devolver dado incompleto ou incorreto.
    // Visibilidade de pacote (não private) só pra ser testável diretamente com um
    // HTML de exemplo (ver NotaFiscalServiceTest), sem precisar de rede.
    NotaFiscalDTO extrairDados(String html) {
        Document doc = Jsoup.parse(html);

        if (indicaValidacaoDeSeguranca(doc)) {
            throw new NotaFiscalIndisponivelException(
                    "A SEFAZ-SC pediu uma validação de segurança antes de mostrar os dados da nota, "
                            + "e isso não pode ser feito automaticamente. Preencha os dados manualmente.");
        }

        String estabelecimento = textoOuNulo(doc.selectFirst("#conteudo .txtTopo"));
        String valorTexto = textoOuNulo(doc.selectFirst("span.totalNumb.txtMax"));
        String dataTexto = extrairDataEmissao(doc);

        if (estabelecimento == null || valorTexto == null || dataTexto == null) {
            throw new NotaFiscalIndisponivelException(
                    "Não consegui identificar os dados dessa nota fiscal. O formato da página pode ter mudado.");
        }

        BigDecimal valor = converterValor(valorTexto);
        // Bug real observado: às vezes a SEFAZ-SC devolve a página com os campos
        // presentes na estrutura HTML, mas ainda vazios de conteúdo real (ex: o rótulo
        // do valor renderizado como "0,00", sem o total de fato ter sido preenchido do
        // lado do servidor) - isso passava pelo null-check acima (o texto não é null)
        // e virava uma extração "bem-sucedida" com formulário parcialmente vazio, sem
        // cair no fallback de abrir a nota numa aba. Um valor zero ou negativo nunca é
        // uma nota real, então trata como falha de extração igual a qualquer outra.
        if (valor.compareTo(BigDecimal.ZERO) <= 0) {
            throw new NotaFiscalIndisponivelException(
                    "Não consegui identificar os dados dessa nota fiscal. O formato da página pode ter mudado.");
        }

        return new NotaFiscalDTO(estabelecimento, valor, converterData(dataTexto));
    }

    private boolean indicaValidacaoDeSeguranca(Document doc) {
        String titulo = doc.title();
        return (titulo != null && titulo.toLowerCase(Locale.ROOT).contains("verifica"))
                || doc.selectFirst(":containsOwn(Efetue a validação de segurança)") != null;
    }

    private String extrairDataEmissao(Document doc) {
        for (Element candidato : doc.select("li")) {
            Matcher m = PADRAO_DATA_EMISSAO.matcher(candidato.text());
            if (m.find()) {
                return m.group(1);
            }
        }
        return null;
    }

    private String textoOuNulo(Element elemento) {
        if (elemento == null) {
            return null;
        }
        // Jsoup converte "&nbsp;" em espaço não separável (U+00A0), que passa
        // despercebido por String.isBlank()/trim() (que só reconhecem espaços comuns,
        // até U+0020) - sem essa normalização, um campo visualmente vazio da página
        // (ex: um placeholder "&nbsp;" onde o valor real ainda não foi preenchido do
        // lado do servidor) seria tratado como "texto encontrado" em vez de ausente,
        // um dos jeitos como o bug de formulário parcialmente vazio acontecia.
        String texto = elemento.text().replace('\u00A0', ' ').trim();
        return texto.isBlank() ? null : texto;
    }

    private BigDecimal converterValor(String valorTexto) {
        try {
            // Formato brasileiro: milhar com ponto, decimal com vírgula (ex: "1.234,56").
            String normalizado = valorTexto.replace(".", "").replace(",", ".");
            return new BigDecimal(normalizado);
        } catch (NumberFormatException e) {
            throw new NotaFiscalIndisponivelException("Não consegui interpretar o valor total dessa nota fiscal.");
        }
    }

    private LocalDate converterData(String dataTexto) {
        try {
            return LocalDate.parse(dataTexto, FORMATO_DATA_BR);
        } catch (DateTimeParseException e) {
            throw new NotaFiscalIndisponivelException("Não consegui interpretar a data de emissão dessa nota fiscal.");
        }
    }
}
