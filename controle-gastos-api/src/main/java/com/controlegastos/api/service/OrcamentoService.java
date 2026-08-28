package com.controlegastos.api.service;

import com.controlegastos.api.dto.OrcamentoMesDTO;
import com.controlegastos.api.exception.RecursoNaoEncontradoException;
import com.controlegastos.api.model.Categoria;
import com.controlegastos.api.model.Orcamento;
import com.controlegastos.api.model.Subcategoria;
import com.controlegastos.api.repository.CategoriaRepository;
import com.controlegastos.api.repository.GastoRepository;
import com.controlegastos.api.repository.OrcamentoRepository;
import com.controlegastos.api.repository.SubcategoriaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrcamentoService {

    private static final BigDecimal PERCENTUAL_ALERTA_PROXIMIDADE = new BigDecimal("0.8");

    // Sentinela para "nenhum ID a excluir" na checagem de duplicidade (create): os
    // IDs reais começam em 1 (SERIAL), então 0 nunca corresponde a um orçamento existente.
    private static final int SEM_ID = 0;

    private final OrcamentoRepository repository;
    private final GastoRepository gastoRepository;
    private final CategoriaRepository categoriaRepository;
    private final SubcategoriaRepository subcategoriaRepository;

    public List<Orcamento> listarTodos(Integer usuarioId) {
        return repository.findAllByUsuarioId(usuarioId);
    }

    public Orcamento definir(Orcamento orcamento, Integer usuarioId) {
        validar(orcamento);
        resolverCategoria(orcamento, usuarioId);

        boolean jaExiste = repository.findDuplicado(
                usuarioId, orcamento.getCategoriaId(), orcamento.getSubcategoriaId(),
                orcamento.getMes(), orcamento.getAno(), SEM_ID).isPresent();
        if (jaExiste) {
            throw new IllegalArgumentException(mensagemDuplicidade(orcamento));
        }

        orcamento.setId(null);
        orcamento.setUsuarioId(usuarioId);
        return repository.save(orcamento);
    }

    public Orcamento atualizar(Integer id, Orcamento dados, Integer usuarioId) {
        validar(dados);
        resolverCategoria(dados, usuarioId);

        Orcamento existente = repository.findByIdAndUsuarioId(id, usuarioId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Orçamento não encontrado com ID " + id));

        boolean jaExiste = repository.findDuplicado(
                usuarioId, dados.getCategoriaId(), dados.getSubcategoriaId(), dados.getMes(), dados.getAno(), id)
                .isPresent();
        if (jaExiste) {
            throw new IllegalArgumentException(mensagemDuplicidade(dados));
        }

        existente.setCategoria(dados.getCategoria());
        existente.setSubcategoria(dados.getSubcategoria());
        existente.setCategoriaId(dados.getCategoriaId());
        existente.setSubcategoriaId(dados.getSubcategoriaId());
        existente.setValorLimite(dados.getValorLimite());
        existente.setMes(dados.getMes());
        existente.setAno(dados.getAno());
        return repository.save(existente);
    }

    // Confirma que a categoria (e a subcategoria, se houver) escolhidas existem e são
    // visíveis para o usuário, e espelha o nome delas nas colunas de texto legadas -
    // mesma lógica usada em GastoService.
    private void resolverCategoria(Orcamento orcamento, Integer usuarioId) {
        Categoria categoria = categoriaRepository.findByIdVisivel(orcamento.getCategoriaId(), usuarioId)
                .orElseThrow(() -> new IllegalArgumentException("Categoria inválida ou não pertence ao usuário."));
        orcamento.setCategoria(categoria.getNome());

        if (orcamento.getSubcategoriaId() == null) {
            orcamento.setSubcategoria(null);
            return;
        }
        Subcategoria subcategoria = subcategoriaRepository
                .findByIdAndUsuarioId(orcamento.getSubcategoriaId(), usuarioId)
                .orElseThrow(() -> new IllegalArgumentException("Subcategoria inválida ou não pertence ao usuário."));
        if (!subcategoria.getCategoriaId().equals(categoria.getId())) {
            throw new IllegalArgumentException("Subcategoria não pertence à categoria selecionada.");
        }
        orcamento.setSubcategoria(subcategoria.getNome());
    }

    private String mensagemDuplicidade(Orcamento orcamento) {
        return orcamento.getSubcategoriaId() == null
                ? "Já existe um orçamento geral definido para essa categoria/mês/ano."
                : "Já existe um orçamento definido para essa categoria/subcategoria/mês/ano.";
    }

    public void excluir(Integer id, Integer usuarioId) {
        Orcamento existente = repository.findByIdAndUsuarioId(id, usuarioId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Orçamento não encontrado com ID " + id));
        repository.delete(existente);
    }

    public List<OrcamentoMesDTO> orcamentosDoMes(int mes, int ano, Integer usuarioId) {
        List<Orcamento> orcamentos = repository.findByUsuarioIdAndMesAndAno(usuarioId, mes, ano);

        return orcamentos.stream()
                .map(o -> {
                    // A soma vem do vínculo explícito (orcamento_id no gasto), não de uma
                    // comparação automática por categoria/subcategoria - por isso um gasto
                    // vinculado ao orçamento específico de uma subcategoria já soma só para
                    // ele, nunca para o orçamento geral da categoria (e vice-versa).
                    BigDecimal gasto = gastoRepository.somarPorOrcamento(o.getId());
                    boolean ultrapassou = gasto.compareTo(o.getValorLimite()) > 0;
                    boolean completo = gasto.compareTo(o.getValorLimite()) == 0;
                    boolean proximoDoLimite = !ultrapassou && !completo
                            && gasto.compareTo(o.getValorLimite().multiply(PERCENTUAL_ALERTA_PROXIMIDADE)) >= 0;
                    return new OrcamentoMesDTO(
                            o.getId(), o.getCategoriaId(), o.getCategoria(), o.getSubcategoriaId(), o.getSubcategoria(),
                            o.getValorLimite(), gasto, ultrapassou, completo, proximoDoLimite);
                })
                .collect(Collectors.toList());
    }

    private void validar(Orcamento orcamento) {
        if (orcamento.getCategoriaId() == null) {
            throw new IllegalArgumentException("Categoria não pode ser vazia.");
        }
        if (orcamento.getValorLimite() == null || orcamento.getValorLimite().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Valor limite deve ser maior que zero.");
        }
        if (orcamento.getMes() < 1 || orcamento.getMes() > 12) {
            throw new IllegalArgumentException("Mês inválido, informe um valor entre 1 e 12.");
        }
        if (orcamento.getAno() <= 0) {
            throw new IllegalArgumentException("Ano inválido.");
        }
    }
}
