package com.controlegastos.api.repository;

import com.controlegastos.api.model.Categoria;
import com.controlegastos.api.model.CompraParcelada;
import com.controlegastos.api.model.Gasto;
import com.controlegastos.api.model.GastoRecorrente;
import com.controlegastos.api.model.StatusPagamento;
import com.controlegastos.api.model.Usuario;
import com.controlegastos.api.service.GastoService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Aba "Próximas contas" (abordagem B+D): a agenda e os contadores agregados.
 * @SpringBootTest com o Postgres local - mesmo padrão do
 * GastoRecorrenteConcorrenciaTest.
 *
 * A agenda é testada pelo GastoService de verdade (não pela query direto), porque
 * o off-by-one da janela mora no cálculo do horizonte do service: `meses` conta o
 * MÊS CORRENTE como o primeiro (meses=1 -> só o mês corrente, nada do mês
 * seguinte). Datas são relativas a hoje; a ocorrência "do mês corrente" usa a data
 * de hoje (>= hoje em qualquer dia -> sempre PENDENTE, nunca atrasada, o que
 * mantém as contagens determinísticas).
 */
@SpringBootTest
class ProximasContasAgendaTest {

    @Autowired private GastoService gastoService;
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
    private Integer rMesCorrente;
    private Integer rMesSeguinte;
    private Integer rDaquiA5Meses;
    // Gastos da parcelada
    private Integer pPagaAntiga;
    private Integer pMesCorrente;
    private Integer pMesSeguinte;
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
        rMesCorrente = salvarRecorrente(HOJE, StatusPagamento.PENDENTE);
        rMesSeguinte = salvarRecorrente(HOJE.plusMonths(1), StatusPagamento.PENDENTE);
        rDaquiA5Meses = salvarRecorrente(HOJE.plusMonths(5), StatusPagamento.PENDENTE);

        pPagaAntiga = salvarParcela(HOJE.minusMonths(1), StatusPagamento.PAGO);
        pMesCorrente = salvarParcela(HOJE, StatusPagamento.PENDENTE);
        pMesSeguinte = salvarParcela(HOJE.plusMonths(1), StatusPagamento.PENDENTE);
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

    private List<Integer> agenda(int meses) {
        return gastoService.proximasContas(usuarioId, meses).stream().map(Gasto::getId).toList();
    }

    @Test
    void agenda_meses1_soOMesCorrenteMaisAtrasadas_naoOMesSeguinte() {
        List<Integer> ids = agenda(1);

        assertThat(ids).contains(rAtrasada, rMesCorrente, pMesCorrente);
        assertThat(ids).doesNotContain(
                rPagaAntiga, pPagaAntiga,                              // pagas nunca entram
                rMesSeguinte, pMesSeguinte,                            // mês seguinte fica fora com meses=1
                rDaquiA5Meses, pDaquiA2Meses, pDaquiA3Meses);
    }

    @Test
    void agenda_meses2_passaAIncluirOMesSeguinte_masNaoOTerceiro() {
        List<Integer> ids = agenda(2);

        assertThat(ids).contains(rAtrasada, rMesCorrente, pMesCorrente, rMesSeguinte, pMesSeguinte);
        assertThat(ids).doesNotContain(
                pDaquiA2Meses, pDaquiA3Meses, rDaquiA5Meses,           // 3º mês em diante fica fora
                rPagaAntiga, pPagaAntiga);
    }

    @Test
    void agenda_meses12_trazTodasAsPendentesEAtrasadas() {
        List<Integer> ids = agenda(12);

        assertThat(ids).contains(
                rAtrasada, rMesCorrente, rMesSeguinte, rDaquiA5Meses,
                pMesCorrente, pMesSeguinte, pDaquiA2Meses, pDaquiA3Meses);
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
        assertThat(c.getPendentes()).as("mês corrente + mês seguinte + daqui a 5 meses").isEqualTo(3L);
        assertThat(c.getFuturos()).as("3 lançamentos com data de hoje em diante").isEqualTo(3L);
    }

    @Test
    void contadores_parcelada_batemComAsParcelasEmAberto() {
        List<GastoRepository.ContagemStatusFonte> contagem =
                gastoRepository.contarStatusPorParcelada(usuarioId, HOJE);

        assertThat(contagem).hasSize(1);
        GastoRepository.ContagemStatusFonte c = contagem.get(0);
        assertThat(c.getFonteId()).isEqualTo(parceladaId);
        assertThat(c.getAtrasadas()).isEqualTo(0L);
        assertThat(c.getPendentes()).as("4 parcelas em aberto (corrente + 3 seguintes)").isEqualTo(4L);
        assertThat(c.getFuturos()).isEqualTo(4L);
    }
}
