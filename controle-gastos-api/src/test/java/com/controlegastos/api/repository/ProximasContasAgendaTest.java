package com.controlegastos.api.repository;

import com.controlegastos.api.model.Categoria;
import com.controlegastos.api.model.CompraParcelada;
import com.controlegastos.api.model.Gasto;
import com.controlegastos.api.model.GastoRecorrente;
import com.controlegastos.api.model.StatusPagamento;
import com.controlegastos.api.model.Usuario;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Queries da aba "Próximas contas" (abordagem B+D, 2026-09-09): a agenda
 * (agendaProximasContas, com teto de meses) e os contadores agregados
 * (contarStatusPorRecorrente / contarStatusPorParcelada). @SpringBootTest com o
 * Postgres local - mesmo padrão do GastoRecorrenteConcorrenciaTest.
 *
 * Datas são relativas a hoje (a query é só aritmética de data, então o teste vale
 * em qualquer dia); os IDs de gasto ficam guardados pra as asserções.
 */
@SpringBootTest
class ProximasContasAgendaTest {

    @Autowired private GastoRepository gastoRepository;
    @Autowired private GastoRecorrenteRepository gastoRecorrenteRepository;
    @Autowired private CompraParceladaRepository compraParceladaRepository;
    @Autowired private CategoriaRepository categoriaRepository;
    @Autowired private UsuarioRepository usuarioRepository;

    private static final LocalDate HOJE = LocalDate.now();

    private Integer usuarioId;
    private Integer categoriaId;
    private Integer recorrenteId;
    private Integer parceladaId;

    // Gastos da recorrência
    private Integer rPagaAntiga;
    private Integer rAtrasada;
    private Integer rProxMes;
    private Integer rDaquiA5Meses;
    // Gastos da parcelada
    private Integer pPagaAntiga;
    private Integer pProxMes;
    private Integer pDaquiA2Meses;
    private Integer pDaquiA3Meses;

    @BeforeEach
    void semear() {
        Usuario usuario = new Usuario();
        usuario.setNome("QA Proximas Contas");
        usuario.setEmail("qa-proximas-contas-test@example.com");
        usuario.setSenha("hash-nao-usado");
        usuario.setDataCriacao(LocalDateTime.now());
        usuarioId = usuarioRepository.save(usuario).getId();

        Categoria categoria = new Categoria();
        categoria.setUsuarioId(usuarioId);
        categoria.setNome("QA Categoria Proximas");
        categoria.setEmoji("🧪");
        categoriaId = categoriaRepository.save(categoria).getId();

        GastoRecorrente recorrente = new GastoRecorrente();
        recorrente.setUsuarioId(usuarioId);
        recorrente.setDescricao("QA Assinatura");
        recorrente.setValor(new BigDecimal("30.00"));
        recorrente.setCategoriaId(categoriaId);
        recorrente.setDiaDoMes(10);
        recorrente.setMesesGerar(12);
        recorrente.setAtivo(true);
        recorrente.setDataCriacao(LocalDateTime.now());
        recorrenteId = gastoRecorrenteRepository.save(recorrente).getId();

        CompraParcelada compra = new CompraParcelada();
        compra.setUsuarioId(usuarioId);
        compra.setDescricao("QA Geladeira");
        compra.setValorTotal(new BigDecimal("400.00"));
        compra.setNumeroParcelas(4);
        compra.setCategoriaId(categoriaId);
        compra.setDiaDoMes(10);
        compra.setAtiva(true);
        compra.setDataCriacao(LocalDateTime.now());
        parceladaId = compraParceladaRepository.save(compra).getId();

        rPagaAntiga = salvarRecorrente(HOJE.minusMonths(2), StatusPagamento.PAGO);
        rAtrasada = salvarRecorrente(HOJE.minusMonths(1), StatusPagamento.PENDENTE);
        rProxMes = salvarRecorrente(HOJE.plusMonths(1), StatusPagamento.PENDENTE);
        rDaquiA5Meses = salvarRecorrente(HOJE.plusMonths(5), StatusPagamento.PENDENTE);

        pPagaAntiga = salvarParcela(HOJE.minusMonths(1), StatusPagamento.PAGO);
        pProxMes = salvarParcela(HOJE.plusMonths(1), StatusPagamento.PENDENTE);
        pDaquiA2Meses = salvarParcela(HOJE.plusMonths(2), StatusPagamento.PENDENTE);
        pDaquiA3Meses = salvarParcela(HOJE.plusMonths(3), StatusPagamento.PENDENTE);
    }

    @AfterEach
    void limpar() {
        gastoRepository.findAll().stream()
                .filter(g -> usuarioId.equals(g.getUsuarioId()))
                .forEach(g -> gastoRepository.deleteById(g.getId()));
        compraParceladaRepository.deleteById(parceladaId);
        gastoRecorrenteRepository.deleteById(recorrenteId);
        categoriaRepository.deleteById(categoriaId);
        usuarioRepository.deleteById(usuarioId);
    }

    private Integer salvarRecorrente(LocalDate vencimento, StatusPagamento status) {
        return salvar(vencimento, status, recorrenteId, null);
    }

    private Integer salvarParcela(LocalDate vencimento, StatusPagamento status) {
        return salvar(vencimento, status, null, parceladaId);
    }

    private Integer salvar(LocalDate vencimento, StatusPagamento status, Integer recId, Integer parcId) {
        Gasto g = new Gasto();
        g.setDescricao("QA lançamento " + vencimento);
        g.setValor(new BigDecimal("30.00"));
        g.setCategoria("QA Categoria Proximas");
        g.setCategoriaId(categoriaId);
        g.setUsuarioId(usuarioId);
        g.setData(vencimento);
        g.setVencimentoOriginal(vencimento);
        g.setStatusPagamento(status);
        g.setGastoRecorrenteId(recId);
        g.setCompraParceladaId(parcId);
        return gastoRepository.save(g).getId();
    }

    @Test
    void agenda_comMeses1_soTrazAtrasadasMaisOProximoMes() {
        LocalDate fim = YearMonth.from(HOJE).plusMonths(1).atEndOfMonth();

        List<Integer> ids = gastoRepository.agendaProximasContas(usuarioId, fim).stream().map(Gasto::getId).toList();

        assertThat(ids).contains(rAtrasada, rProxMes, pProxMes);
        assertThat(ids).doesNotContain(
                rPagaAntiga, pPagaAntiga,     // pagas nunca entram
                rDaquiA5Meses, pDaquiA2Meses, pDaquiA3Meses); // fora da janela de 1 mês
    }

    @Test
    void agenda_comMeses12_trazTodasAsPendentesEAtrasadas() {
        LocalDate fim = YearMonth.from(HOJE).plusMonths(12).atEndOfMonth();

        List<Integer> ids = gastoRepository.agendaProximasContas(usuarioId, fim).stream().map(Gasto::getId).toList();

        assertThat(ids).contains(rAtrasada, rProxMes, rDaquiA5Meses, pProxMes, pDaquiA2Meses, pDaquiA3Meses);
        assertThat(ids).doesNotContain(rPagaAntiga, pPagaAntiga);
    }

    @Test
    void contadores_recorrente_batemComHistoricoMisto() {
        List<GastoRepository.ContagemStatusFonte> contagem =
                gastoRepository.contarStatusPorRecorrente(usuarioId, HOJE);

        assertThat(contagem).hasSize(1);
        GastoRepository.ContagemStatusFonte c = contagem.get(0);
        assertThat(c.getFonteId()).isEqualTo(recorrenteId);
        assertThat(c.getAtrasadas()).as("1 ocorrência vencida e não paga").isEqualTo(1L);
        assertThat(c.getPendentes()).as("2 ocorrências futuras ainda pendentes").isEqualTo(2L);
        assertThat(c.getFuturos()).as("2 lançamentos com data de hoje em diante").isEqualTo(2L);
    }

    @Test
    void contadores_parcelada_batemComAsParcelasEmAberto() {
        List<GastoRepository.ContagemStatusFonte> contagem =
                gastoRepository.contarStatusPorParcelada(usuarioId, HOJE);

        assertThat(contagem).hasSize(1);
        GastoRepository.ContagemStatusFonte c = contagem.get(0);
        assertThat(c.getFonteId()).isEqualTo(parceladaId);
        assertThat(c.getAtrasadas()).isEqualTo(0L);
        assertThat(c.getPendentes()).as("3 parcelas em aberto").isEqualTo(3L);
        assertThat(c.getFuturos()).isEqualTo(3L);
    }
}
