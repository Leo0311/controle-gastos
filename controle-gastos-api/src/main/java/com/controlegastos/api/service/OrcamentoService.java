package com.controlegastos.api.service;

import com.controlegastos.api.dto.OrcamentoMesDTO;
import com.controlegastos.api.exception.RecursoNaoEncontradoException;
import com.controlegastos.api.model.Orcamento;
import com.controlegastos.api.repository.GastoRepository;
import com.controlegastos.api.repository.OrcamentoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrcamentoService {

    private static final BigDecimal PERCENTUAL_ALERTA_PROXIMIDADE = new BigDecimal("0.8");

    private final OrcamentoRepository repository;
    private final GastoRepository gastoRepository;

    public List<Orcamento> listarTodos(Integer usuarioId) {
        return repository.findAllByUsuarioId(usuarioId);
    }

    public Orcamento definir(Orcamento orcamento, Integer usuarioId) {
        validar(orcamento);
        orcamento.setId(null);
        orcamento.setUsuarioId(usuarioId);
        return repository.save(orcamento);
    }

    public Orcamento atualizar(Integer id, Orcamento dados, Integer usuarioId) {
        validar(dados);

        Orcamento existente = repository.findByIdAndUsuarioId(id, usuarioId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Orçamento não encontrado com ID " + id));

        boolean jaExiste = repository.findByUsuarioIdAndCategoriaIgnoreCaseAndMesAndAnoAndIdNot(
                usuarioId, dados.getCategoria(), dados.getMes(), dados.getAno(), id).isPresent();
        if (jaExiste) {
            throw new IllegalArgumentException("Já existe um orçamento definido para essa categoria/mês/ano.");
        }

        existente.setCategoria(dados.getCategoria());
        existente.setValorLimite(dados.getValorLimite());
        existente.setMes(dados.getMes());
        existente.setAno(dados.getAno());
        return repository.save(existente);
    }

    public void excluir(Integer id, Integer usuarioId) {
        Orcamento existente = repository.findByIdAndUsuarioId(id, usuarioId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Orçamento não encontrado com ID " + id));
        repository.delete(existente);
    }

    public List<OrcamentoMesDTO> orcamentosDoMes(int mes, int ano, Integer usuarioId) {
        List<Orcamento> orcamentos = repository.findByUsuarioIdAndMesAndAnoOrderByCategoria(usuarioId, mes, ano);

        return orcamentos.stream()
                .map(o -> {
                    BigDecimal gasto = gastoRepository.somarPorOrcamento(o.getId());
                    boolean ultrapassou = gasto.compareTo(o.getValorLimite()) > 0;
                    boolean completo = gasto.compareTo(o.getValorLimite()) == 0;
                    boolean proximoDoLimite = !ultrapassou && !completo
                            && gasto.compareTo(o.getValorLimite().multiply(PERCENTUAL_ALERTA_PROXIMIDADE)) >= 0;
                    return new OrcamentoMesDTO(
                            o.getId(), o.getCategoria(), o.getValorLimite(), gasto, ultrapassou, completo, proximoDoLimite);
                })
                .collect(Collectors.toList());
    }

    private void validar(Orcamento orcamento) {
        if (orcamento.getCategoria() == null || orcamento.getCategoria().isBlank()) {
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
