package com.controlegastos.api.service;

import com.controlegastos.api.dto.CategoriaTotalDTO;
import com.controlegastos.api.dto.ResumoDTO;
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
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
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
        // gastoRecorrenteId só pode ser setado internamente por GastoRecorrenteService
        // (ver cadastrarVinculadoARecorrente) - nunca por uma criação vinda da API pública,
        // senão qualquer cliente poderia marcar um gasto como "gerado automaticamente".
        gasto.setGastoRecorrenteId(null);
        return salvar(gasto, usuarioId);
    }

    // Usado só por GastoRecorrenteService pra criar o gasto já vinculado à recorrência
    // de origem (gasto.gastoRecorrenteId) - nunca exposto diretamente via endpoint público.
    public Gasto cadastrarVinculadoARecorrente(Gasto gasto, Integer usuarioId) {
        return salvar(gasto, usuarioId);
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
        existente.setDescricao(dados.getDescricao());
        existente.setValor(dados.getValor());
        existente.setCategoria(dados.getCategoria());
        existente.setSubcategoria(dados.getSubcategoria());
        existente.setCategoriaId(dados.getCategoriaId());
        existente.setSubcategoriaId(dados.getSubcategoriaId());
        existente.setData(dados.getData() != null ? dados.getData() : existente.getData());
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
        Subcategoria subcategoria = subcategoriaRepository.findByIdAndUsuarioId(gasto.getSubcategoriaId(), usuarioId)
                .orElseThrow(() -> new IllegalArgumentException("Subcategoria inválida ou não pertence ao usuário."));
        if (!subcategoria.getCategoriaId().equals(categoria.getId())) {
            throw new IllegalArgumentException("Subcategoria não pertence à categoria selecionada.");
        }
        gasto.setSubcategoria(subcategoria.getNome());
    }

    public void excluir(Integer id, Integer usuarioId) {
        Gasto existente = buscarPorId(id, usuarioId);
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
