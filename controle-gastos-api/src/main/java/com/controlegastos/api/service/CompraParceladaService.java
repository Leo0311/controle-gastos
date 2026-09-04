package com.controlegastos.api.service;

import com.controlegastos.api.exception.OrcamentoInvalidoException;
import com.controlegastos.api.exception.RecursoNaoEncontradoException;
import com.controlegastos.api.model.Categoria;
import com.controlegastos.api.model.CompraParcelada;
import com.controlegastos.api.model.Gasto;
import com.controlegastos.api.model.Subcategoria;
import com.controlegastos.api.repository.CategoriaRepository;
import com.controlegastos.api.repository.CompraParceladaRepository;
import com.controlegastos.api.repository.GastoRepository;
import com.controlegastos.api.repository.OrcamentoRepository;
import com.controlegastos.api.repository.SubcategoriaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CompraParceladaService {

    private final CompraParceladaRepository repository;
    private final GastoRepository gastoRepository;
    private final GastoService gastoService;
    private final CategoriaRepository categoriaRepository;
    private final SubcategoriaRepository subcategoriaRepository;
    private final OrcamentoRepository orcamentoRepository;

    public List<CompraParcelada> listarTodos(Integer usuarioId) {
        List<CompraParcelada> compras = repository.findAllByUsuarioIdOrderByDataCriacaoDesc(usuarioId);
        // Contagem agregada (uma query) de quantas parcelas cada compra ainda tem -
        // pra a UI mostrar "N de M parcelas" e sinalizar parcelamento incompleto.
        Map<Integer, Long> lancadasPorCompra = gastoRepository.contarParcelasPorCompra(usuarioId).stream()
                .collect(Collectors.toMap(
                        GastoRepository.ParcelasPorCompra::getCompraId,
                        GastoRepository.ParcelasPorCompra::getTotal));
        compras.forEach(compra ->
                compra.setParcelasLancadas(lancadasPorCompra.getOrDefault(compra.getId(), 0L).intValue()));
        return compras;
    }

    @Transactional
    public CompraParcelada cadastrar(CompraParcelada dados, Integer usuarioId) {
        validar(dados);
        // Resolve categoria/subcategoria/orçamento uma vez só, aqui - antes de
        // qualquer escrita. gerarParcelas reaproveita os nomes já resolvidos em
        // todas as N parcelas, em vez de o GastoService revalidar por parcela.
        CategoriaResolvida categoria = resolverCategoria(dados, usuarioId);
        validarOrcamento(dados.getOrcamentoId(), usuarioId);
        dados.setId(null);
        dados.setUsuarioId(usuarioId);
        dados.setAtiva(true);
        dados.setDataCriacao(LocalDateTime.now());
        CompraParcelada salva = repository.save(dados);
        gerarParcelas(salva, categoria, usuarioId);
        return salva;
    }

    // Exclui a compra parcelada de verdade (ação definitiva, sem reativar - diferente
    // do pausar/reativar de gastos recorrentes): remove o registro por completo (nunca
    // fica como um estado "cancelada" fantasma na listagem) e os gastos das parcelas
    // com data futura (ainda não vencidas). Parcelas cuja data já passou (ou é hoje)
    // continuam intactas como histórico do que já foi pago - a FK
    // gastos.compra_parcelada_id é ON DELETE SET NULL (ver schema.sql), então excluir
    // a compra automaticamente desvincula (sem apagar) essas parcelas passadas.
    @Transactional
    public void excluir(Integer id, Integer usuarioId) {
        CompraParcelada existente = buscarPorId(id, usuarioId);

        List<Gasto> parcelasFuturas = gastoRepository.findByCompraParceladaIdAndDataAfter(id, LocalDate.now());
        gastoRepository.deleteAll(parcelasFuturas);

        repository.delete(existente);
    }

    // Gera as N parcelas como gastos individuais, uma por mês consecutivo a partir da
    // PRÓXIMA ocorrência futura do dia escolhido (ver mesDaPrimeiraParcela) - a compra
    // parcelada é lançada de uma vez, diferente da recorrência, que só lança o gasto
    // do mês quando o dia configurado chega. Divide valorTotal em centavos (evita erro
    // de arredondamento de ponto flutuante) e ajusta a ÚLTIMA parcela pra soma bater
    // exatamente com valorTotal, sem perder nem sobrar centavo.
    private void gerarParcelas(CompraParcelada compra, CategoriaResolvida categoria, Integer usuarioId) {
        long totalCentavos = totalEmCentavos(compra.getValorTotal());
        int numeroParcelas = compra.getNumeroParcelas();
        long parcelaBaseCentavos = totalCentavos / numeroParcelas;

        LocalDate referencia = mesDaPrimeiraParcela(compra.getDiaDoMes());
        List<Gasto> parcelas = new ArrayList<>(numeroParcelas);
        for (int i = 0; i < numeroParcelas; i++) {
            YearMonth mesParcela = YearMonth.from(referencia).plusMonths(i);
            int dia = Math.min(compra.getDiaDoMes(), mesParcela.lengthOfMonth());
            LocalDate data = mesParcela.atDay(dia);

            boolean ultimaParcela = i == numeroParcelas - 1;
            long valorCentavos = ultimaParcela ? (totalCentavos - parcelaBaseCentavos * (numeroParcelas - 1)) : parcelaBaseCentavos;

            Gasto gasto = new Gasto();
            gasto.setDescricao(compra.getDescricao() + " (" + (i + 1) + "/" + numeroParcelas + ")");
            gasto.setValor(BigDecimal.valueOf(valorCentavos, 2));
            gasto.setCategoriaId(compra.getCategoriaId());
            gasto.setCategoria(categoria.categoriaNome());
            gasto.setSubcategoriaId(compra.getSubcategoriaId());
            gasto.setSubcategoria(categoria.subcategoriaNome());
            gasto.setOrcamentoId(compra.getOrcamentoId());
            gasto.setData(data);
            gasto.setCompraParceladaId(compra.getId());
            parcelas.add(gasto);
        }
        gastoService.salvarParcelas(parcelas, usuarioId);
    }

    // Converte o valor total (reais) para centavos inteiros - evita erro de ponto
    // flutuante na divisão das parcelas. Extraído pra a validação (validar) e a
    // geração (gerarParcelas) usarem exatamente a mesma conta e nunca divergirem.
    private long totalEmCentavos(BigDecimal valorTotal) {
        return valorTotal.movePointRight(2).setScale(0, RoundingMode.HALF_UP).longValueExact();
    }

    // Bug real corrigido: antes, a primeira parcela sempre caía no mês atual mesmo
    // quando o dia escolhido já tinha passado (ex: hoje dia 29, dia escolhido 10 -
    // lançava uma parcela "retroativa" no dia 10 deste mês, que já ficou no passado).
    // Agora a primeira parcela sempre começa na PRÓXIMA ocorrência futura do dia
    // escolhido: se esse dia (já ajustado pro último dia válido do mês atual, mesmo
    // clamping usado no loop de gerarParcelas) ainda não chegou este mês, a primeira
    // parcela continua no mês atual; se já passou (ou é hoje), pula pro mês seguinte.
    // Só o mês importa aqui - o dia exato de cada parcela é recalculado no loop acima.
    private LocalDate mesDaPrimeiraParcela(int diaDoMes) {
        LocalDate hoje = LocalDate.now();
        LocalDate primeiraOcorrenciaNoMesAtual = hoje.withDayOfMonth(Math.min(diaDoMes, hoje.lengthOfMonth()));
        return primeiraOcorrenciaNoMesAtual.isAfter(hoje) ? hoje : hoje.plusMonths(1);
    }

    private CompraParcelada buscarPorId(Integer id, Integer usuarioId) {
        return repository.findByIdAndUsuarioId(id, usuarioId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Compra parcelada não encontrada com ID " + id));
    }

    // Nomes de categoria/subcategoria já resolvidos, pra gerarParcelas gravar em cada
    // parcela sem o GastoService ter que buscar de novo (subcategoriaNome é null
    // quando a compra não tem subcategoria).
    private record CategoriaResolvida(String categoriaNome, String subcategoriaNome) { }

    private CategoriaResolvida resolverCategoria(CompraParcelada dados, Integer usuarioId) {
        Categoria categoria = categoriaRepository.findByIdVisivel(dados.getCategoriaId(), usuarioId)
                .orElseThrow(() -> new IllegalArgumentException("Categoria inválida ou não pertence ao usuário."));
        if (dados.getSubcategoriaId() == null) {
            return new CategoriaResolvida(categoria.getNome(), null);
        }
        Subcategoria subcategoria = subcategoriaRepository
                .findByIdVisivel(dados.getSubcategoriaId(), usuarioId)
                .orElseThrow(() -> new IllegalArgumentException("Subcategoria inválida ou não pertence ao usuário."));
        if (!subcategoria.getCategoriaId().equals(categoria.getId())) {
            throw new IllegalArgumentException("Subcategoria não pertence à categoria selecionada.");
        }
        return new CategoriaResolvida(categoria.getNome(), subcategoria.getNome());
    }

    private void validarOrcamento(Integer orcamentoId, Integer usuarioId) {
        if (orcamentoId == null) {
            return;
        }
        orcamentoRepository.findByIdAndUsuarioId(orcamentoId, usuarioId)
                .orElseThrow(() -> new OrcamentoInvalidoException("Orçamento não encontrado ou não pertence ao usuário."));
    }

    private void validar(CompraParcelada dados) {
        if (dados.getDescricao() == null || dados.getDescricao().isBlank()) {
            throw new IllegalArgumentException("Descrição não pode ser vazia.");
        }
        if (dados.getValorTotal() == null || dados.getValorTotal().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Valor total deve ser maior que zero.");
        }
        if (dados.getCategoriaId() == null) {
            throw new IllegalArgumentException("Categoria não pode ser vazia.");
        }
        if (dados.getNumeroParcelas() == null || dados.getNumeroParcelas() < 2 || dados.getNumeroParcelas() > 120) {
            throw new IllegalArgumentException("Número de parcelas deve estar entre 2 e 120.");
        }
        // Cada parcela precisa fechar em pelo menos 1 centavo - senão a divisão em
        // centavos (ver gerarParcelas) zera as parcelas base, o CHECK (valor > 0) do
        // banco rejeita a primeira parcela e a compra_parcelada fica gravada sem
        // parcela nenhuma. Roda antes de qualquer escrita.
        if (totalEmCentavos(dados.getValorTotal()) / dados.getNumeroParcelas() < 1) {
            throw new IllegalArgumentException(
                    "Valor total muito baixo para dividir em " + dados.getNumeroParcelas()
                    + " parcelas: cada parcela ficaria abaixo de R$ 0,01.");
        }
        if (dados.getDiaDoMes() == null || dados.getDiaDoMes() < 1 || dados.getDiaDoMes() > 31) {
            throw new IllegalArgumentException("Dia do mês deve estar entre 1 e 31.");
        }
    }
}
