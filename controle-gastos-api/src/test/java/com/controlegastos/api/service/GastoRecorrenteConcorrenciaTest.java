package com.controlegastos.api.service;

import com.controlegastos.api.model.Categoria;
import com.controlegastos.api.model.Gasto;
import com.controlegastos.api.model.GastoRecorrente;
import com.controlegastos.api.model.Usuario;
import com.controlegastos.api.repository.CategoriaRepository;
import com.controlegastos.api.repository.GastoRecorrenteRepository;
import com.controlegastos.api.repository.GastoRepository;
import com.controlegastos.api.repository.UsuarioRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Reproduz de verdade a corrida do achado M1 (auditoria 2026-09-05): duas
 * requisições simultâneas de lancarPendentes para a MESMA recorrência não podem
 * gerar dois gastos no mesmo mês. Diferente de GastoRecorrenteServiceTest (Mockito
 * puro, chamadas sequenciais), aqui é @SpringBootTest com o Postgres local de
 * verdade e duas threads reais disparadas ao mesmo tempo via CountDownLatch - só
 * assim o índice único uq_gastos_recorrente_mes (schema.sql) entra em jogo.
 * Antes da constraint, este teste falhava de forma intermitente (a corrida às
 * vezes "ganhava" e produzia 2 gastos); depois, é impossível produzir mais de 1,
 * porque a segunda inserção esbarra em DataIntegrityViolationException, capturada
 * em GastoRecorrenteService.tentarLancar.
 *
 * Precisa do Postgres local no ar (ver skill ambiente-local) - usa a mesma
 * application.properties da aplicação, sem banco em memória.
 */
@SpringBootTest
class GastoRecorrenteConcorrenciaTest {

    @Autowired
    private GastoRecorrenteService service;
    @Autowired
    private UsuarioRepository usuarioRepository;
    @Autowired
    private CategoriaRepository categoriaRepository;
    @Autowired
    private GastoRecorrenteRepository gastoRecorrenteRepository;
    @Autowired
    private GastoRepository gastoRepository;

    private Integer usuarioId;
    private Integer categoriaId;
    private Integer recorrenteId;

    @BeforeEach
    void criarDadosDeTeste() {
        Usuario usuario = new Usuario();
        usuario.setNome("QA Concorrência Recorrente");
        usuario.setEmail("qa-concorrencia-recorrente-test@example.com");
        usuario.setSenha("hash-nao-usado-neste-teste");
        usuario.setDataCriacao(LocalDateTime.now());
        usuarioId = usuarioRepository.save(usuario).getId();

        Categoria categoria = new Categoria();
        categoria.setUsuarioId(usuarioId);
        categoria.setNome("QA Categoria Concorrência");
        categoria.setEmoji("🧪");
        categoriaId = categoriaRepository.save(categoria).getId();

        // Inserida direto pelo repository (não por service.cadastrar) pra não disparar
        // gerarProximosMeses - o teste só quer o cenário de lancarPendentes concorrente
        // do mês atual, sem pré-geração de meses futuros no caminho.
        GastoRecorrente recorrente = new GastoRecorrente();
        recorrente.setUsuarioId(usuarioId);
        recorrente.setDescricao("QA Assinatura Concorrência");
        recorrente.setValor(new BigDecimal("29.90"));
        recorrente.setCategoriaId(categoriaId);
        recorrente.setDiaDoMes(1); // dia 1: já chegou em qualquer data do mês
        recorrente.setMesesGerar(1);
        recorrente.setAtivo(true);
        recorrente.setDataCriacao(LocalDateTime.now());
        recorrenteId = gastoRecorrenteRepository.save(recorrente).getId();
    }

    @AfterEach
    void limparDadosDeTeste() {
        gastoRepository.findAll().stream()
                .filter(g -> recorrenteId.equals(g.getGastoRecorrenteId()))
                .forEach(g -> gastoRepository.deleteById(g.getId()));
        gastoRecorrenteRepository.deleteById(recorrenteId);
        categoriaRepository.deleteById(categoriaId);
        usuarioRepository.deleteById(usuarioId);
    }

    @Test
    void duasRequisicoesSimultaneasNaoDuplicamOLancamentoDoMes() throws InterruptedException {
        int threads = 8;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch prontos = new CountDownLatch(threads);
        CountDownLatch largada = new CountDownLatch(1);

        List<Exception> falhasInesperadas = Collections.synchronizedList(new ArrayList<>());

        IntStream.range(0, threads).forEach(i -> pool.submit(() -> {
            try {
                prontos.countDown();
                largada.await();
                service.lancarPendentes(usuarioId);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (Exception e) {
                // lancarPendentes não deve propagar nada mesmo sob corrida - se
                // propagar, é a asserção abaixo que captura a regressão.
                falhasInesperadas.add(e);
            }
        }));

        prontos.await(5, TimeUnit.SECONDS);
        largada.countDown();
        pool.shutdown();
        assertThat(pool.awaitTermination(15, TimeUnit.SECONDS))
                .as("as 8 chamadas concorrentes deveriam terminar dentro do timeout")
                .isTrue();

        assertThat(falhasInesperadas)
                .as("lancarPendentes nunca deve propagar exceção, nem sob corrida")
                .isEmpty();

        long gastosLancados = gastoRepository.findAll().stream()
                .filter(g -> recorrenteId.equals(g.getGastoRecorrenteId()))
                .count();

        assertThat(gastosLancados)
                .as("8 chamadas concorrentes pra mesma recorrência/mês devem produzir 1 gasto só")
                .isEqualTo(1);
    }
}
