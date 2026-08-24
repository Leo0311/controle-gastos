package com.controlegastos.api.service;

import com.controlegastos.api.dto.MetaMesDTO;
import com.controlegastos.api.dto.MetaRequestDTO;
import com.controlegastos.api.exception.RecursoNaoEncontradoException;
import com.controlegastos.api.model.Meta;
import com.controlegastos.api.model.Usuario;
import com.controlegastos.api.repository.GastoRepository;
import com.controlegastos.api.repository.MetaRepository;
import com.controlegastos.api.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class MetaService {

    private final MetaRepository repository;
    private final UsuarioRepository usuarioRepository;
    private final GastoRepository gastoRepository;

    public Meta definir(MetaRequestDTO dados, Integer usuarioId) {
        validar(dados);

        Meta meta = repository.findByUsuarioIdAndMesAndAno(usuarioId, dados.mes(), dados.ano())
                .orElseGet(Meta::new);
        meta.setUsuarioId(usuarioId);
        meta.setMes(dados.mes());
        meta.setAno(dados.ano());
        meta.setValorMeta(dados.valorMeta());
        return repository.save(meta);
    }

    public void excluir(Integer id, Integer usuarioId) {
        Meta existente = repository.findByIdAndUsuarioId(id, usuarioId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Meta não encontrada com ID " + id));
        repository.delete(existente);
    }

    public MetaMesDTO metaDoMes(int mes, int ano, Integer usuarioId) {
        Usuario usuario = usuarioRepository.findById(usuarioId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Usuário não encontrado."));

        LocalDate inicio = LocalDate.of(ano, mes, 1);
        LocalDate fim = inicio.withDayOfMonth(inicio.lengthOfMonth());
        BigDecimal totalGasto = gastoRepository.somarNoPeriodo(usuarioId, inicio, fim);

        BigDecimal rendaMensal = usuario.getRendaMensal();
        BigDecimal economiaReal = rendaMensal != null ? rendaMensal.subtract(totalGasto) : null;

        Meta meta = repository.findByUsuarioIdAndMesAndAno(usuarioId, mes, ano).orElse(null);
        Integer metaId = meta != null ? meta.getId() : null;
        BigDecimal valorMeta = meta != null ? meta.getValorMeta() : null;

        BigDecimal percentualMeta = null;
        if (valorMeta != null && economiaReal != null && valorMeta.compareTo(BigDecimal.ZERO) > 0) {
            percentualMeta = economiaReal.multiply(BigDecimal.valueOf(100))
                    .divide(valorMeta, 2, RoundingMode.HALF_UP);
        }

        return new MetaMesDTO(rendaMensal, totalGasto, economiaReal, metaId, valorMeta, percentualMeta);
    }

    private void validar(MetaRequestDTO dados) {
        if (dados.valorMeta() == null || dados.valorMeta().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Valor da meta deve ser maior que zero.");
        }
        if (dados.mes() < 1 || dados.mes() > 12) {
            throw new IllegalArgumentException("Mês inválido, informe um valor entre 1 e 12.");
        }
        if (dados.ano() <= 0) {
            throw new IllegalArgumentException("Ano inválido.");
        }
    }
}
