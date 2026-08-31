package com.controlegastos.api.service;

import com.controlegastos.api.repository.CompraParceladaRepository;
import com.controlegastos.api.repository.GastoRecorrenteRepository;
import com.controlegastos.api.repository.GastoRepository;
import com.controlegastos.api.repository.OrcamentoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Conta em quantos gastos, orçamentos, gastos recorrentes e compras parceladas
 * uma categoria (ou subcategoria) ainda está sendo usada, e monta uma frase
 * amigável do tipo "em uso em 2 gastos, 1 orçamento e 1 gasto recorrente" - usada
 * para bloquear a exclusão explicando exatamente o que precisa ser resolvido
 * antes, em vez de deixar vazar um erro de violação de FK do banco.
 */
@Component
@RequiredArgsConstructor
public class ContadorDeUso {

    private final GastoRepository gastoRepository;
    private final OrcamentoRepository orcamentoRepository;
    private final GastoRecorrenteRepository gastoRecorrenteRepository;
    private final CompraParceladaRepository compraParceladaRepository;

    /** {@code Optional.empty()} = a categoria não está em uso em lugar nenhum. */
    public Optional<String> descreverUsoCategoria(Integer categoriaId) {
        return descrever(
                gastoRepository.countByCategoriaId(categoriaId),
                orcamentoRepository.countByCategoriaId(categoriaId),
                gastoRecorrenteRepository.countByCategoriaId(categoriaId),
                compraParceladaRepository.countByCategoriaId(categoriaId));
    }

    /** {@code Optional.empty()} = a subcategoria não está em uso em lugar nenhum. */
    public Optional<String> descreverUsoSubcategoria(Integer subcategoriaId) {
        return descrever(
                gastoRepository.countBySubcategoriaId(subcategoriaId),
                orcamentoRepository.countBySubcategoriaId(subcategoriaId),
                gastoRecorrenteRepository.countBySubcategoriaId(subcategoriaId),
                compraParceladaRepository.countBySubcategoriaId(subcategoriaId));
    }

    private Optional<String> descrever(long gastos, long orcamentos, long recorrentes, long parceladas) {
        List<String> partes = new ArrayList<>();
        adicionar(partes, gastos, "gasto", "gastos");
        adicionar(partes, orcamentos, "orçamento", "orçamentos");
        adicionar(partes, recorrentes, "gasto recorrente", "gastos recorrentes");
        adicionar(partes, parceladas, "compra parcelada", "compras parceladas");

        if (partes.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of("em uso em " + juntar(partes));
    }

    private void adicionar(List<String> partes, long quantidade, String singular, String plural) {
        if (quantidade > 0) {
            partes.add(quantidade + " " + (quantidade == 1 ? singular : plural));
        }
    }

    // ["a"] -> "a"; ["a","b"] -> "a e b"; ["a","b","c"] -> "a, b e c"
    private String juntar(List<String> partes) {
        if (partes.size() == 1) {
            return partes.get(0);
        }
        String tudoMenosUltimo = String.join(", ", partes.subList(0, partes.size() - 1));
        return tudoMenosUltimo + " e " + partes.get(partes.size() - 1);
    }
}
