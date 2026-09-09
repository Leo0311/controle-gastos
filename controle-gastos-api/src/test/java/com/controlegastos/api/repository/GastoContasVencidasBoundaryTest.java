package com.controlegastos.api.repository;

import com.controlegastos.api.model.Categoria;
import com.controlegastos.api.model.Gasto;
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

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regra de borda de Pendente -> Atrasada (bug do fuso, 2026-09-08): uma conta
 * PENDENTE que vence numa data X continua Pendente durante TODO o dia X e só passa
 * a Atrasada a partir do dia X+1. As queries que o Dashboard usa - atrasadas()
 * (vencimento_original < hoje) e venceHoje() (vencimento_original = hoje) - recebem
 * o "hoje" como parâmetro, então este teste simula "hoje" em datas fixas em vez de
 * depender do relógio, provando a fronteira nos dois lados.
 *
 * @SpringBootTest com o Postgres local de verdade (mesmo padrão do
 * GastoRecorrenteConcorrenciaTest) - precisa do banco no ar (skill ambiente-local).
 */
@SpringBootTest
class GastoContasVencidasBoundaryTest {

    @Autowired
    private GastoRepository gastoRepository;
    @Autowired
    private UsuarioRepository usuarioRepository;
    @Autowired
    private CategoriaRepository categoriaRepository;

    private static final LocalDate VENCIMENTO = LocalDate.of(2026, 6, 10);

    private Integer usuarioId;
    private Integer categoriaId;
    private Integer gastoId;

    @BeforeEach
    void criarContaPendente() {
        Usuario usuario = new Usuario();
        usuario.setNome("QA Borda Vencimento");
        usuario.setEmail("qa-borda-vencimento-test@example.com");
        usuario.setSenha("hash-nao-usado-neste-teste");
        usuario.setDataCriacao(LocalDateTime.now());
        usuarioId = usuarioRepository.save(usuario).getId();

        Categoria categoria = new Categoria();
        categoria.setUsuarioId(usuarioId);
        categoria.setNome("QA Categoria Borda");
        categoria.setEmoji("🧪");
        categoriaId = categoriaRepository.save(categoria).getId();

        Gasto conta = new Gasto();
        conta.setDescricao("QA Conta que vence dia 10");
        conta.setValor(new BigDecimal("100.00"));
        conta.setCategoria(categoria.getNome());
        conta.setCategoriaId(categoriaId);
        conta.setData(VENCIMENTO);
        conta.setUsuarioId(usuarioId);
        conta.setStatusPagamento(StatusPagamento.PENDENTE);
        conta.setVencimentoOriginal(VENCIMENTO);
        gastoId = gastoRepository.save(conta).getId();
    }

    @AfterEach
    void limpar() {
        gastoRepository.deleteById(gastoId);
        categoriaRepository.deleteById(categoriaId);
        usuarioRepository.deleteById(usuarioId);
    }

    @Test
    void noProprioDiaDoVencimento_contaEhVenceHoje_naoAtrasada() {
        assertThat(idsDe(gastoRepository.atrasadas(usuarioId, VENCIMENTO)))
                .as("no dia do vencimento a conta ainda NAO esta atrasada")
                .doesNotContain(gastoId);
        assertThat(idsDe(gastoRepository.venceHoje(usuarioId, VENCIMENTO)))
                .as("no dia do vencimento a conta aparece em 'vence hoje'")
                .contains(gastoId);
    }

    @Test
    void noDiaSeguinteAoVencimento_contaViraAtrasada() {
        LocalDate diaSeguinte = VENCIMENTO.plusDays(1);
        assertThat(idsDe(gastoRepository.atrasadas(usuarioId, diaSeguinte)))
                .as("a partir do dia seguinte ao vencimento a conta esta atrasada")
                .contains(gastoId);
        assertThat(idsDe(gastoRepository.venceHoje(usuarioId, diaSeguinte)))
                .as("no dia seguinte a conta ja nao 'vence hoje'")
                .doesNotContain(gastoId);
    }

    @Test
    void vesperaDoVencimento_contaNaoEhAtrasadaNemVenceHoje() {
        LocalDate vespera = VENCIMENTO.minusDays(1);
        assertThat(idsDe(gastoRepository.atrasadas(usuarioId, vespera))).doesNotContain(gastoId);
        assertThat(idsDe(gastoRepository.venceHoje(usuarioId, vespera))).doesNotContain(gastoId);
    }

    private static java.util.List<Integer> idsDe(java.util.List<Gasto> gastos) {
        return gastos.stream().map(Gasto::getId).toList();
    }
}
