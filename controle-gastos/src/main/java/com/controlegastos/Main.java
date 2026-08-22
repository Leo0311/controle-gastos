package com.controlegastos;

import com.controlegastos.model.Gasto;
import com.controlegastos.model.Orcamento;
import com.controlegastos.service.GastoService;
import com.controlegastos.service.OrcamentoService;
import com.controlegastos.util.CsvExporter;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Scanner;

/**
 * Aplicação de console para controle de gastos pessoais.
 * Dados persistidos em um banco PostgreSQL via JDBC.
 */
public class Main {

    private static final Scanner scanner = new Scanner(System.in);
    private static final GastoService service = new GastoService();
    private static final OrcamentoService orcamentoService = new OrcamentoService();
    private static final DateTimeFormatter FORMATO_DATA = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public static void main(String[] args) {
        System.out.println("=========================================");
        System.out.println("   CONTROLE DE GASTOS - v1.0");
        System.out.println("=========================================");

        boolean rodando = true;
        while (rodando) {
            exibirMenu();
            String opcao = scanner.nextLine().trim();

            try {
                switch (opcao) {
                    case "1" -> cadastrarGasto();
                    case "2" -> listarTodos();
                    case "3" -> listarPorCategoria();
                    case "4" -> listarPorPeriodo();
                    case "5" -> atualizarGasto();
                    case "6" -> excluirGasto();
                    case "7" -> exibirResumo();
                    case "8" -> listarPorMesAno();
                    case "9" -> definirOrcamento();
                    case "10" -> verOrcamentosDoMes();
                    case "11" -> excluirOrcamento();
                    case "12" -> exportarCsv();
                    case "0" -> {
                        rodando = false;
                        System.out.println("Até logo!");
                    }
                    default -> System.out.println(">> Opção inválida.");
                }
            } catch (SQLException e) {
                System.out.println(">> Erro ao acessar o banco de dados: " + e.getMessage());
            } catch (IllegalArgumentException e) {
                System.out.println(">> " + e.getMessage());
            } catch (Exception e) {
                System.out.println(">> Erro inesperado: " + e.getMessage());
            }

            System.out.println();
        }
        scanner.close();
    }

    private static void exibirMenu() {
        System.out.println("-----------------------------------------");
        System.out.println("1 - Cadastrar gasto");
        System.out.println("2 - Listar todos os gastos");
        System.out.println("3 - Listar gastos por categoria");
        System.out.println("4 - Listar gastos por período");
        System.out.println("5 - Atualizar gasto");
        System.out.println("6 - Excluir gasto");
        System.out.println("7 - Resumo (totais)");
        System.out.println("8 - Listar gastos por mês/ano");
        System.out.println("9 - Definir orçamento de categoria");
        System.out.println("10 - Ver orçamentos e gastos do mês");
        System.out.println("11 - Excluir orçamento");
        System.out.println("12 - Exportar gastos para CSV");
        System.out.println("0 - Sair");
        System.out.print("Escolha uma opção: ");
    }

    private static void cadastrarGasto() throws SQLException {
        System.out.print("Descrição: ");
        String descricao = scanner.nextLine();

        System.out.print("Valor (ex: 49.90): ");
        BigDecimal valor = lerValor();

        System.out.print("Categoria (ex: Alimentação, Transporte, Lazer): ");
        String categoria = scanner.nextLine();

        System.out.print("Data (dd/MM/yyyy) [ENTER para hoje]: ");
        LocalDate data = lerData();

        Gasto gasto = service.cadastrar(descricao, valor, categoria, data);
        System.out.println(">> Gasto cadastrado com sucesso! ID: " + gasto.getId());
        verificarOrcamento(gasto);
    }

    private static void verificarOrcamento(Gasto gasto) throws SQLException {
        int mes = gasto.getData().getMonthValue();
        int ano = gasto.getData().getYear();

        Orcamento orcamento = orcamentoService.buscarPorCategoriaMesAno(gasto.getCategoria(), mes, ano);
        if (orcamento == null) {
            return;
        }

        YearMonth mesAno = YearMonth.of(ano, mes);
        BigDecimal totalGasto = service.totalPorCategoriaNoPeriodo(
                gasto.getCategoria(), mesAno.atDay(1), mesAno.atEndOfMonth());

        if (totalGasto.compareTo(orcamento.getValorLimite()) > 0) {
            BigDecimal excedente = totalGasto.subtract(orcamento.getValorLimite());
            System.out.printf(new Locale("pt", "BR"),
                    ">> ALERTA: orçamento de %s em %02d/%d estourado! Limite R$ %.2f, gasto R$ %.2f (excedeu em R$ %.2f)%n",
                    gasto.getCategoria(), mes, ano, orcamento.getValorLimite(), totalGasto, excedente);
        }
    }

    private static void listarTodos() throws SQLException {
        List<Gasto> gastos = service.listarTodos();
        exibirLista(gastos);
    }

    private static void listarPorCategoria() throws SQLException {
        System.out.print("Categoria: ");
        String categoria = scanner.nextLine();
        List<Gasto> gastos = service.listarPorCategoria(categoria);
        exibirLista(gastos);
    }

    private static void listarPorPeriodo() throws SQLException {
        System.out.print("Data inicial (dd/MM/yyyy): ");
        LocalDate inicio = LocalDate.parse(scanner.nextLine().trim(), FORMATO_DATA);

        System.out.print("Data final (dd/MM/yyyy): ");
        LocalDate fim = LocalDate.parse(scanner.nextLine().trim(), FORMATO_DATA);

        List<Gasto> gastos = service.listarPorPeriodo(inicio, fim);
        exibirLista(gastos);
    }

    private static void listarPorMesAno() throws SQLException {
        System.out.print("Mês (1-12): ");
        int mes = Integer.parseInt(scanner.nextLine().trim());
        if (mes < 1 || mes > 12) {
            throw new IllegalArgumentException("Mês inválido, informe um valor entre 1 e 12.");
        }

        System.out.print("Ano (ex: 2026): ");
        int ano = Integer.parseInt(scanner.nextLine().trim());

        YearMonth mesAno = YearMonth.of(ano, mes);
        List<Gasto> gastos = service.listarPorPeriodo(mesAno.atDay(1), mesAno.atEndOfMonth());
        exibirLista(gastos);
    }

    private static void definirOrcamento() throws SQLException {
        System.out.print("Categoria: ");
        String categoria = scanner.nextLine();

        System.out.print("Valor limite (ex: 500.00): ");
        BigDecimal valorLimite = lerValor();

        System.out.print("Mês (1-12): ");
        int mes = Integer.parseInt(scanner.nextLine().trim());

        System.out.print("Ano (ex: 2026): ");
        int ano = Integer.parseInt(scanner.nextLine().trim());

        Orcamento orcamento = orcamentoService.definir(categoria, valorLimite, mes, ano);
        System.out.println(">> Orçamento definido com sucesso! ID: " + orcamento.getId());
    }

    private static void verOrcamentosDoMes() throws SQLException {
        System.out.print("Mês (1-12): ");
        int mes = Integer.parseInt(scanner.nextLine().trim());
        if (mes < 1 || mes > 12) {
            throw new IllegalArgumentException("Mês inválido, informe um valor entre 1 e 12.");
        }

        System.out.print("Ano (ex: 2026): ");
        int ano = Integer.parseInt(scanner.nextLine().trim());

        List<Orcamento> orcamentos = orcamentoService.listarPorMesAno(mes, ano);
        if (orcamentos.isEmpty()) {
            System.out.printf(">> Nenhum orçamento definido para %02d/%d.%n", mes, ano);
            return;
        }

        YearMonth mesAno = YearMonth.of(ano, mes);
        List<Object[]> gastosPorCategoria = service.totalPorCategoriaEPeriodo(mesAno.atDay(1), mesAno.atEndOfMonth());
        Map<String, BigDecimal> totaisPorCategoria = new HashMap<>();
        for (Object[] linha : gastosPorCategoria) {
            totaisPorCategoria.put(((String) linha[0]).toLowerCase(), (BigDecimal) linha[1]);
        }

        System.out.printf(">> Orçamentos de %02d/%d:%n", mes, ano);
        for (Orcamento o : orcamentos) {
            BigDecimal gasto = totaisPorCategoria.getOrDefault(o.getCategoria().toLowerCase(), BigDecimal.ZERO);
            String status = gasto.compareTo(o.getValorLimite()) > 0 ? "ULTRAPASSOU" : "OK";
            System.out.printf(new Locale("pt", "BR"), "   #%-4d %-15s limite R$ %-10s gasto R$ %-10s [%s]%n",
                    o.getId(), o.getCategoria(), o.getValorLimite().toPlainString(), gasto.toPlainString(), status);
        }
    }

    private static void excluirOrcamento() throws SQLException {
        System.out.print("ID do orçamento a excluir: ");
        int id = Integer.parseInt(scanner.nextLine().trim());
        boolean excluido = orcamentoService.excluir(id);
        System.out.println(excluido ? ">> Orçamento excluído com sucesso!" : ">> Nenhum orçamento encontrado com esse ID.");
    }

    private static void exportarCsv() throws SQLException, IOException {
        System.out.println("Exportar:");
        System.out.println("1 - Todos os gastos");
        System.out.println("2 - Por categoria");
        System.out.println("3 - Por mês/ano");
        System.out.print("Escolha uma opção: ");
        String opcao = scanner.nextLine().trim();

        List<Gasto> gastos;
        switch (opcao) {
            case "1" -> gastos = service.listarTodos();
            case "2" -> {
                System.out.print("Categoria: ");
                String categoria = scanner.nextLine();
                gastos = service.listarPorCategoria(categoria);
            }
            case "3" -> {
                System.out.print("Mês (1-12): ");
                int mes = Integer.parseInt(scanner.nextLine().trim());
                if (mes < 1 || mes > 12) {
                    throw new IllegalArgumentException("Mês inválido, informe um valor entre 1 e 12.");
                }

                System.out.print("Ano (ex: 2026): ");
                int ano = Integer.parseInt(scanner.nextLine().trim());

                YearMonth mesAno = YearMonth.of(ano, mes);
                gastos = service.listarPorPeriodo(mesAno.atDay(1), mesAno.atEndOfMonth());
            }
            default -> {
                System.out.println(">> Opção inválida.");
                return;
            }
        }

        if (gastos.isEmpty()) {
            System.out.println(">> Nenhum gasto encontrado para exportar.");
            return;
        }

        Path arquivo = CsvExporter.exportarGastos(gastos);
        System.out.println(">> Arquivo CSV gerado: " + arquivo);
    }

    private static void atualizarGasto() throws SQLException {
        System.out.print("ID do gasto a atualizar: ");
        int id = Integer.parseInt(scanner.nextLine().trim());

        System.out.print("Nova descrição: ");
        String descricao = scanner.nextLine();

        System.out.print("Novo valor: ");
        BigDecimal valor = lerValor();

        System.out.print("Nova categoria: ");
        String categoria = scanner.nextLine();

        System.out.print("Nova data (dd/MM/yyyy) [ENTER para hoje]: ");
        LocalDate data = lerData();

        boolean atualizado = service.atualizar(id, descricao, valor, categoria, data);
        System.out.println(atualizado ? ">> Gasto atualizado com sucesso!" : ">> Nenhum gasto encontrado com esse ID.");
    }

    private static void excluirGasto() throws SQLException {
        System.out.print("ID do gasto a excluir: ");
        int id = Integer.parseInt(scanner.nextLine().trim());
        boolean excluido = service.excluir(id);
        System.out.println(excluido ? ">> Gasto excluído com sucesso!" : ">> Nenhum gasto encontrado com esse ID.");
    }

    private static void exibirResumo() throws SQLException {
        BigDecimal total = service.totalGeral();
        System.out.printf(new Locale("pt", "BR"), ">> Total geral gasto: R$ %.2f%n", total);

        List<Object[]> porCategoria = service.totalPorCategoria();
        if (!porCategoria.isEmpty()) {
            System.out.println(">> Total por categoria:");
            for (Object[] linha : porCategoria) {
                System.out.printf("   - %-15s R$ %s%n", linha[0], linha[1]);
            }
        }
    }

    private static void exibirLista(List<Gasto> gastos) {
        if (gastos.isEmpty()) {
            System.out.println(">> Nenhum gasto encontrado.");
            return;
        }
        System.out.println(">> " + gastos.size() + " gasto(s) encontrado(s):");
        for (Gasto g : gastos) {
            System.out.println("   " + g);
        }
    }

    private static BigDecimal lerValor() {
        String texto = scanner.nextLine().trim().replace(",", ".");
        try {
            return new BigDecimal(texto);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Valor inválido: " + texto);
        }
    }

    private static LocalDate lerData() {
        String texto = scanner.nextLine().trim();
        if (texto.isEmpty()) {
            return LocalDate.now();
        }
        try {
            return LocalDate.parse(texto, FORMATO_DATA);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Data inválida, use o formato dd/MM/yyyy.");
        }
    }
}
