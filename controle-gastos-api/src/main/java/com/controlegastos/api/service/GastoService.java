package com.controlegastos.api.service;

import com.controlegastos.api.dto.CategoriaTotalDTO;
import com.controlegastos.api.dto.ComparacaoCategoriaDTO;
import com.controlegastos.api.dto.ComparacaoMensalDTO;
import com.controlegastos.api.dto.RankingCategoriaDTO;
import com.controlegastos.api.dto.RankingCategoriasDTO;
import com.controlegastos.api.dto.RankingSubcategoriaDTO;
import com.controlegastos.api.dto.ResumoDTO;
import com.controlegastos.api.dto.TotalDiarioDTO;
import com.controlegastos.api.dto.TotalMensalDTO;
import com.controlegastos.api.exception.OrcamentoInvalidoException;
import com.controlegastos.api.exception.RecursoNaoEncontradoException;
import com.controlegastos.api.model.Categoria;
import com.controlegastos.api.model.Gasto;
import com.controlegastos.api.model.Subcategoria;
import com.controlegastos.api.repository.CategoriaRepository;
import com.controlegastos.api.repository.GastoRepository;
import com.controlegastos.api.repository.OrcamentoRepository;
import com.controlegastos.api.repository.SubcategoriaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GastoService {

    private final GastoRepository repository;
    private final OrcamentoRepository orcamentoRepository;
    private final CategoriaRepository categoriaRepository;
    private final SubcategoriaRepository subcategoriaRepository;

    public List<Gasto> listarTodos(Integer usuarioId) {
        return repository.findAllByUsuarioIdOrderByDataDescIdDesc(usuarioId);
    }

    public Gasto buscarPorId(Integer id, Integer usuarioId) {
        return repository.findByIdAndUsuarioId(id, usuarioId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Gasto não encontrado com ID " + id));
    }

    public List<Gasto> listarPorCategoria(String categoria, Integer usuarioId) {
        return repository.findByUsuarioIdAndCategoriaIgnoreCaseOrderByDataDescIdDesc(usuarioId, categoria);
    }

    public List<Gasto> listarPorPeriodo(LocalDate inicio, LocalDate fim, Integer usuarioId) {
        return repository.findByUsuarioIdAndDataBetweenOrderByDataDescIdDesc(usuarioId, inicio, fim);
    }

    public Gasto cadastrar(Gasto gasto, Integer usuarioId) {
        // gastoRecorrenteId/compraParceladaId só podem ser setados internamente por
        // GastoRecorrenteService/CompraParceladaService (ver cadastrarVinculadoA*) -
        // nunca por uma criação vinda da API pública, senão qualquer cliente poderia
        // marcar um gasto como "gerado automaticamente".
        gasto.setGastoRecorrenteId(null);
        gasto.setCompraParceladaId(null);
        return salvar(gasto, usuarioId);
    }

    // Usado só por GastoRecorrenteService pra criar o gasto já vinculado à recorrência
    // de origem (gasto.gastoRecorrenteId) - nunca exposto diretamente via endpoint público.
    public Gasto cadastrarVinculadoARecorrente(Gasto gasto, Integer usuarioId) {
        return salvar(gasto, usuarioId);
    }

    // Persiste em lote as parcelas de uma compra parcelada. Categoria, subcategoria
    // (nomes já preenchidos em cada Gasto) e orçamento foram resolvidos e validados
    // UMA única vez pelo chamador (CompraParceladaService.cadastrar), então aqui NÃO
    // se repete a resolução por parcela - antes era 1 findByIdVisivel de categoria (+
    // 1 de subcategoria, + 1 de orçamento) para cada uma das N parcelas. A validação
    // dos campos básicos roda para TODAS as parcelas antes de qualquer escrita, pra
    // uma parcela inválida não deixar meia compra gravada. Nunca exposto via endpoint.
    public List<Gasto> salvarParcelas(List<Gasto> parcelas, Integer usuarioId) {
        parcelas.forEach(this::validar);
        List<Gasto> salvos = new ArrayList<>(parcelas.size());
        for (Gasto parcela : parcelas) {
            parcela.setId(null);
            parcela.setUsuarioId(usuarioId);
            if (parcela.getData() == null) {
                parcela.setData(LocalDate.now());
            }
            salvos.add(repository.save(parcela));
        }
        return salvos;
    }

    private Gasto salvar(Gasto gasto, Integer usuarioId) {
        validar(gasto);
        resolverCategoria(gasto, usuarioId);
        validarOrcamento(gasto.getOrcamentoId(), usuarioId);
        gasto.setId(null);
        gasto.setUsuarioId(usuarioId);
        if (gasto.getData() == null) {
            gasto.setData(LocalDate.now());
        }
        return repository.save(gasto);
    }

    public Gasto atualizar(Integer id, Gasto dados, Integer usuarioId) {
        Gasto existente = buscarPorId(id, usuarioId);
        validar(dados);
        resolverCategoria(dados, usuarioId);
        validarOrcamento(dados.getOrcamentoId(), usuarioId);
        // Parcela de compra parcelada: descrição, valor e data são definidos pela
        // compra e não podem mudar aqui (quebrariam o "(k/N)", a soma das parcelas
        // ou a sequência de meses). O frontend já trava esses campos; isto garante
        // o mesmo por chamada direta à API. Categoria/subcategoria/orçamento seguem
        // editáveis (recategorizar ou revincular a orçamento não quebra o parcelamento).
        if (existente.getCompraParceladaId() == null) {
            existente.setDescricao(dados.getDescricao());
            existente.setValor(dados.getValor());
            existente.setData(dados.getData() != null ? dados.getData() : existente.getData());
        }
        existente.setCategoria(dados.getCategoria());
        existente.setSubcategoria(dados.getSubcategoria());
        existente.setCategoriaId(dados.getCategoriaId());
        existente.setSubcategoriaId(dados.getSubcategoriaId());
        existente.setOrcamentoId(dados.getOrcamentoId());
        return repository.save(existente);
    }

    // Confirma que a categoria (e a subcategoria, se houver) escolhidas existem e são
    // visíveis para o usuário, e espelha o nome delas nas colunas de texto legadas -
    // ver comentário na entidade Gasto sobre por que essas colunas continuam existindo.
    private void resolverCategoria(Gasto gasto, Integer usuarioId) {
        Categoria categoria = categoriaRepository.findByIdVisivel(gasto.getCategoriaId(), usuarioId)
                .orElseThrow(() -> new IllegalArgumentException("Categoria inválida ou não pertence ao usuário."));
        gasto.setCategoria(categoria.getNome());

        if (gasto.getSubcategoriaId() == null) {
            gasto.setSubcategoria(null);
            return;
        }
        Subcategoria subcategoria = subcategoriaRepository.findByIdVisivel(gasto.getSubcategoriaId(), usuarioId)
                .orElseThrow(() -> new IllegalArgumentException("Subcategoria inválida ou não pertence ao usuário."));
        if (!subcategoria.getCategoriaId().equals(categoria.getId())) {
            throw new IllegalArgumentException("Subcategoria não pertence à categoria selecionada.");
        }
        gasto.setSubcategoria(subcategoria.getNome());
    }

    public void excluir(Integer id, Integer usuarioId) {
        Gasto existente = buscarPorId(id, usuarioId);
        // Excluir uma parcela isolada deixaria o parcelamento permanentemente
        // incoerente (some do extrato, mas a compra continua marcada com o número
        // original de parcelas). Só a compra parcelada inteira pode ser removida -
        // via CompraParceladaService.excluir, que apaga as parcelas futuras em
        // bloco e mantém as já vencidas como histórico.
        if (existente.getCompraParceladaId() != null) {
            throw new IllegalArgumentException(
                    "Esta é uma parcela de uma compra parcelada e não pode ser excluída sozinha. "
                    + "Para desfazer, exclua a compra parcelada inteira na aba \"Parceladas\" (tela Recorrentes).");
        }
        repository.delete(existente);
    }

    public ResumoDTO resumo(Integer usuarioId, LocalDate inicio, LocalDate fim) {
        BigDecimal totalGeral = repository.somarNoPeriodo(usuarioId, inicio, fim);
        List<CategoriaTotalDTO> porCategoria = repository.somarPorCategoriaNoPeriodo(usuarioId, inicio, fim).stream()
                .map(c -> new CategoriaTotalDTO(c.getCategoriaId(), c.getCategoria(), c.getTotal()))
                .collect(Collectors.toList());
        return new ResumoDTO(totalGeral, porCategoria);
    }

    public List<TotalMensalDTO> totaisMensais(int meses, Integer usuarioId) {
        List<TotalMensalDTO> resultado = new ArrayList<>();
        YearMonth atual = YearMonth.now();

        for (int i = meses - 1; i >= 0; i--) {
            YearMonth mesAno = atual.minusMonths(i);
            BigDecimal total = repository.somarNoPeriodo(usuarioId, mesAno.atDay(1), mesAno.atEndOfMonth());
            resultado.add(new TotalMensalDTO(mesAno.getMonthValue(), mesAno.getYear(), total));
        }
        return resultado;
    }

    // Total gasto em cada dia do mês/ano informado (dia 1 até o último dia do mês) -
    // usado pelo gráfico de barras "diário" do Dashboard quando "Destacar mês" está
    // ativo. Uma única consulta ao período inteiro, agregada em memória por dia, em
    // vez de uma query por dia (até 31 idas ao banco por carregamento).
    public List<TotalDiarioDTO> totaisDiarios(int mes, int ano, Integer usuarioId) {
        validarMesAno(mes, ano);
        LocalDate inicio = LocalDate.of(ano, mes, 1);
        LocalDate fim = inicio.withDayOfMonth(inicio.lengthOfMonth());

        Map<Integer, BigDecimal> totalPorDia = new LinkedHashMap<>();
        for (int dia = 1; dia <= fim.getDayOfMonth(); dia++) {
            totalPorDia.put(dia, BigDecimal.ZERO);
        }
        repository.findByUsuarioIdAndDataBetweenOrderByDataDescIdDesc(usuarioId, inicio, fim)
                .forEach(g -> totalPorDia.merge(g.getData().getDayOfMonth(), g.getValor(), BigDecimal::add));

        return totalPorDia.entrySet().stream()
                .map(e -> new TotalDiarioDTO(e.getKey(), e.getValue()))
                .collect(Collectors.toList());
    }

    // Chave de agrupamento por categoria usada no ranking e na comparação mensal - a
    // mesma dupla (categoriaId, nome legado em minúsculas) usada como GROUP BY nas
    // queries de agregação, pra tratar corretamente gastos legados sem categoriaId
    // (ver comentário em GastoRepository.somarPorCategoriaNoPeriodo).
    private record CategoriaChave(Integer categoriaId, String categoria) {
    }

    public RankingCategoriasDTO rankingCategorias(int mes, int ano, Integer usuarioId) {
        validarMesAno(mes, ano);
        LocalDate inicio = LocalDate.of(ano, mes, 1);
        LocalDate fim = inicio.withDayOfMonth(inicio.lengthOfMonth());

        BigDecimal totalGeral = repository.somarNoPeriodo(usuarioId, inicio, fim);
        List<GastoRepository.CategoriaSubcategoriaTotal> linhas =
                repository.somarPorCategoriaESubcategoriaNoPeriodo(usuarioId, inicio, fim);

        Map<CategoriaChave, List<GastoRepository.CategoriaSubcategoriaTotal>> porCategoria = linhas.stream()
                .collect(Collectors.groupingBy(
                        l -> new CategoriaChave(l.getCategoriaId(), l.getCategoria()),
                        LinkedHashMap::new, Collectors.toList()));

        List<RankingCategoriaDTO> categorias = new ArrayList<>();
        for (Map.Entry<CategoriaChave, List<GastoRepository.CategoriaSubcategoriaTotal>> entrada : porCategoria.entrySet()) {
            BigDecimal totalCategoria = entrada.getValue().stream()
                    .map(GastoRepository.CategoriaSubcategoriaTotal::getTotal)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            List<RankingSubcategoriaDTO> subcategorias = entrada.getValue().stream()
                    .map(l -> new RankingSubcategoriaDTO(
                            l.getSubcategoriaId(), l.getSubcategoria(), l.getTotal(),
                            percentual(l.getTotal(), totalCategoria)))
                    .sorted(Comparator.comparing(RankingSubcategoriaDTO::getTotal).reversed())
                    .collect(Collectors.toList());

            categorias.add(new RankingCategoriaDTO(
                    entrada.getKey().categoriaId(), entrada.getKey().categoria(), totalCategoria,
                    percentual(totalCategoria, totalGeral), subcategorias));
        }
        categorias.sort(Comparator.comparing(RankingCategoriaDTO::getTotal).reversed());

        return new RankingCategoriasDTO(totalGeral, categorias);
    }

    public ComparacaoMensalDTO comparacaoMensal(int mes, int ano, Integer usuarioId) {
        validarMesAno(mes, ano);
        LocalDate inicioAtual = LocalDate.of(ano, mes, 1);
        LocalDate fimAtual = inicioAtual.withDayOfMonth(inicioAtual.lengthOfMonth());

        YearMonth mesAnteriorYm = YearMonth.of(ano, mes).minusMonths(1);
        LocalDate inicioAnterior = mesAnteriorYm.atDay(1);
        LocalDate fimAnterior = mesAnteriorYm.atEndOfMonth();

        Map<CategoriaChave, BigDecimal> totalAtualPorCategoria = totalPorCategoria(usuarioId, inicioAtual, fimAtual);
        Map<CategoriaChave, BigDecimal> totalAnteriorPorCategoria =
                totalPorCategoria(usuarioId, inicioAnterior, fimAnterior);

        // LinkedHashSet preserva a ordem de chegada (mês atual primeiro) antes do sort final.
        Set<CategoriaChave> todasCategorias = new LinkedHashSet<>(totalAtualPorCategoria.keySet());
        todasCategorias.addAll(totalAnteriorPorCategoria.keySet());

        List<ComparacaoCategoriaDTO> categorias = new ArrayList<>();
        for (CategoriaChave chave : todasCategorias) {
            BigDecimal totalAtual = totalAtualPorCategoria.getOrDefault(chave, BigDecimal.ZERO);
            BigDecimal totalAnterior = totalAnteriorPorCategoria.getOrDefault(chave, BigDecimal.ZERO);
            BigDecimal variacaoAbsoluta = totalAtual.subtract(totalAnterior);

            // Sem gasto nenhum no mês anterior: variação percentual não é definida (não dá
            // pra calcular "aumento de X%" a partir de uma base zero) - o front mostra "Nova".
            boolean categoriaNova = totalAnterior.compareTo(BigDecimal.ZERO) == 0;
            BigDecimal variacaoPercentual = categoriaNova ? null : percentual(variacaoAbsoluta, totalAnterior);

            categorias.add(new ComparacaoCategoriaDTO(
                    chave.categoriaId(), chave.categoria(), totalAtual, totalAnterior,
                    variacaoAbsoluta, variacaoPercentual, categoriaNova));
        }
        categorias.sort(Comparator.comparing(ComparacaoCategoriaDTO::getTotalAtual).reversed());

        return new ComparacaoMensalDTO(mes, ano, mesAnteriorYm.getMonthValue(), mesAnteriorYm.getYear(), categorias);
    }

    private Map<CategoriaChave, BigDecimal> totalPorCategoria(Integer usuarioId, LocalDate inicio, LocalDate fim) {
        return repository.somarPorCategoriaNoPeriodo(usuarioId, inicio, fim).stream()
                .collect(Collectors.toMap(
                        c -> new CategoriaChave(c.getCategoriaId(), c.getCategoria()),
                        GastoRepository.CategoriaTotal::getTotal,
                        BigDecimal::add, LinkedHashMap::new));
    }

    private BigDecimal percentual(BigDecimal valor, BigDecimal total) {
        if (total == null || total.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        return valor.multiply(BigDecimal.valueOf(100)).divide(total, 2, RoundingMode.HALF_UP);
    }

    private void validarMesAno(int mes, int ano) {
        if (mes < 1 || mes > 12) {
            throw new IllegalArgumentException("Mês inválido, informe um valor entre 1 e 12.");
        }
        if (ano <= 0) {
            throw new IllegalArgumentException("Ano inválido.");
        }
    }

    private void validarOrcamento(Integer orcamentoId, Integer usuarioId) {
        if (orcamentoId == null) {
            return;
        }
        orcamentoRepository.findByIdAndUsuarioId(orcamentoId, usuarioId)
                .orElseThrow(() -> new OrcamentoInvalidoException("Orçamento não encontrado ou não pertence ao usuário."));
    }

    private void validar(Gasto gasto) {
        if (gasto.getDescricao() == null || gasto.getDescricao().isBlank()) {
            throw new IllegalArgumentException("Descrição não pode ser vazia.");
        }
        if (gasto.getValor() == null || gasto.getValor().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Valor deve ser maior que zero.");
        }
        if (gasto.getCategoriaId() == null) {
            throw new IllegalArgumentException("Categoria não pode ser vazia.");
        }
    }
}
