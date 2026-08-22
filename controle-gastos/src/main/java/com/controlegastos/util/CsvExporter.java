package com.controlegastos.util;

import com.controlegastos.model.Gasto;

import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

/**
 * Exporta listas de gastos para arquivos CSV compatíveis com o Excel em pt-BR
 * (separador ';', decimal com vírgula, BOM UTF-8).
 */
public class CsvExporter {

    private static final DateTimeFormatter NOME_ARQUIVO = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");
    private static final DateTimeFormatter DATA_CSV = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final Locale LOCALE_BR = new Locale("pt", "BR");
    private static final byte[] BOM_UTF8 = {(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};

    public static Path exportarGastos(List<Gasto> gastos) throws IOException {
        String base = "gastos_exportados_" + LocalDateTime.now().format(NOME_ARQUIVO);
        Path caminho = Path.of(base + ".csv").toAbsolutePath();
        int sufixo = 2;
        while (Files.exists(caminho)) {
            caminho = Path.of(base + "_" + sufixo + ".csv").toAbsolutePath();
            sufixo++;
        }

        try (FileOutputStream saida = new FileOutputStream(caminho.toFile())) {
            saida.write(BOM_UTF8);
            try (Writer writer = new OutputStreamWriter(saida, StandardCharsets.UTF_8)) {
                writer.write("ID;Descrição;Valor;Categoria;Data\n");
                for (Gasto gasto : gastos) {
                    writer.write(linha(gasto));
                }
            }
        }
        return caminho;
    }

    private static String linha(Gasto gasto) {
        return String.join(";",
                String.valueOf(gasto.getId()),
                escapar(gasto.getDescricao()),
                String.format(LOCALE_BR, "%.2f", gasto.getValor()),
                escapar(gasto.getCategoria()),
                gasto.getData().format(DATA_CSV)
        ) + "\n";
    }

    private static String escapar(String texto) {
        if (texto == null) {
            return "";
        }
        if (texto.contains(";") || texto.contains("\"") || texto.contains("\n")) {
            return "\"" + texto.replace("\"", "\"\"") + "\"";
        }
        return texto;
    }
}
