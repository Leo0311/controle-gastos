package com.controlegastos.api.service;

import com.controlegastos.api.exception.RecursoNaoEncontradoException;
import com.controlegastos.api.model.Categoria;
import com.controlegastos.api.model.CategoriaOrdemUsuario;
import com.controlegastos.api.repository.CategoriaOrdemUsuarioRepository;
import com.controlegastos.api.repository.CategoriaRepository;
import com.controlegastos.api.repository.GastoRepository;
import com.controlegastos.api.repository.SubcategoriaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Cobertura de CategoriaService - Mockito puro, mesmo padrão de OrcamentoServiceTest
 * / UsuarioServiceTest (achado M4 da auditoria 2026-09-05: zero testes).
 *
 * Foco: a proteção de buscarPropria() (categoria do sistema ou de outro usuário
 * nunca é editável/excluível), a normalização + duplicidade em criar/atualizar,
 * o bloqueio de exclusão por uso e a cascata nas subcategorias, e a matemática de
 * ordem de reordenar()/ordenarPorPreferencia() (ordem recebida, IDs inválidos
 * ignorados, categorias novas jogadas pro fim na ordem padrão, reaproveitamento
 * dos registros de posição existentes).
 */
class CategoriaServiceTest {

    private static final int USUARIO = 1;
    private static final String EMOJI_PADRAO = "📁";

    private final CategoriaRepository repository = mock(CategoriaRepository.class);
    private final CategoriaOrdemUsuarioRepository ordemRepository = mock(CategoriaOrdemUsuarioRepository.class);
    private final SubcategoriaRepository subcategoriaRepository = mock(SubcategoriaRepository.class);
    private final GastoRepository gastoRepository = mock(GastoRepository.class);
    private final ContadorDeUso contadorDeUso = mock(ContadorDeUso.class);

    private final CategoriaService service = new CategoriaService(
            repository, ordemRepository, subcategoriaRepository, gastoRepository, contadorDeUso);

    @BeforeEach
    void stubsPadrao() {
        when(repository.save(any(Categoria.class))).thenAnswer(invocacao -> invocacao.getArgument(0));
        when(repository.findDuplicadaVisivel(any(), any(), any())).thenReturn(Optional.empty());
        when(contadorDeUso.descreverUsoCategoria(any())).thenReturn(Optional.empty());
    }

    private Categoria categoria(Integer id, String nome, Integer usuarioId) {
        Categoria c = new Categoria();
        c.setId(id);
        c.setNome(nome);
        c.setEmoji("🏷️");
        c.setUsuarioId(usuarioId);
        return c;
    }

    // ---------- criar() ----------

    @Test
    void criar_rejeitaNomeVazio() {
        assertThatThrownBy(() -> service.criar(categoria(null, "   ", null), USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Nome da categoria não pode ser vazio");
    }

    @Test
    void criar_normalizaNomeEUsaEmojiPadraoQuandoAusente() {
        Categoria dados = new Categoria();
        dados.setNome("  Casa  ");
        dados.setEmoji("   ");

        service.criar(dados, USUARIO);

        ArgumentCaptor<Categoria> captor = ArgumentCaptor.forClass(Categoria.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getNome()).isEqualTo("Casa");
        assertThat(captor.getValue().getEmoji()).isEqualTo(EMOJI_PADRAO);
    }

    @Test
    void criar_normalizaEmojiComEspacos() {
        Categoria dados = new Categoria();
        dados.setNome("Casa");
        dados.setEmoji("  🏠  ");

        service.criar(dados, USUARIO);

        ArgumentCaptor<Categoria> captor = ArgumentCaptor.forClass(Categoria.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getEmoji()).isEqualTo("🏠");
    }

    @Test
    void criar_rejeitaNomeDuplicadoVisivelSemSalvar() {
        when(repository.findDuplicadaVisivel(USUARIO, "Casa", 0))
                .thenReturn(Optional.of(categoria(9, "Casa", null)));

        assertThatThrownBy(() -> service.criar(categoria(null, "Casa", null), USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Já existe uma categoria com esse nome");

        verify(repository, never()).save(any());
    }

    @Test
    void criar_forcaIdNuloAtribuiUsuarioEUsaSentinelaSemId() {
        Categoria dados = categoria(999, "Casa", 77);

        service.criar(dados, USUARIO);

        verify(repository).findDuplicadaVisivel(USUARIO, "Casa", 0);
        ArgumentCaptor<Categoria> captor = ArgumentCaptor.forClass(Categoria.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getId()).isNull();
        assertThat(captor.getValue().getUsuarioId()).isEqualTo(USUARIO);
    }

    // ---------- atualizar() / buscarPropria() ----------

    @Test
    void atualizar_lancaNaoEncontradoParaCategoriaDoSistema() {
        when(repository.findById(3)).thenReturn(Optional.of(categoria(3, "Alimentação", null)));

        assertThatThrownBy(() -> service.atualizar(3, categoria(null, "Outro nome", null), USUARIO))
                .isInstanceOf(RecursoNaoEncontradoException.class);

        verify(repository, never()).save(any());
    }

    @Test
    void atualizar_lancaNaoEncontradoParaCategoriaDeOutroUsuario() {
        when(repository.findById(3)).thenReturn(Optional.of(categoria(3, "Casa", 999)));

        assertThatThrownBy(() -> service.atualizar(3, categoria(null, "Outro nome", null), USUARIO))
                .isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void atualizar_lancaNaoEncontradoQuandoIdNaoExiste() {
        when(repository.findById(3)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.atualizar(3, categoria(null, "Casa", null), USUARIO))
                .isInstanceOf(RecursoNaoEncontradoException.class)
                .hasMessageContaining("ID 3");
    }

    @Test
    void atualizar_rejeitaNomeDuplicadoExcluindoOProprioId() {
        when(repository.findById(3)).thenReturn(Optional.of(categoria(3, "Casa", USUARIO)));
        when(repository.findDuplicadaVisivel(USUARIO, "Lazer", 3))
                .thenReturn(Optional.of(categoria(4, "Lazer", USUARIO)));

        assertThatThrownBy(() -> service.atualizar(3, categoria(null, "Lazer", null), USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Já existe uma categoria com esse nome");

        verify(repository, never()).save(any());
    }

    @Test
    void atualizar_alteraNomeEEmojiDaCategoriaPropria() {
        Categoria existente = categoria(3, "Casa", USUARIO);
        when(repository.findById(3)).thenReturn(Optional.of(existente));

        Categoria dados = new Categoria();
        dados.setNome("  Moradia  ");
        dados.setEmoji("🏡");

        Categoria salva = service.atualizar(3, dados, USUARIO);

        assertThat(salva.getNome()).isEqualTo("Moradia");
        assertThat(salva.getEmoji()).isEqualTo("🏡");
        assertThat(salva.getId()).isEqualTo(3);
    }

    // ---------- excluir() ----------

    @Test
    void excluir_lancaNaoEncontradoParaCategoriaDoSistema() {
        when(repository.findById(3)).thenReturn(Optional.of(categoria(3, "Alimentação", null)));

        assertThatThrownBy(() -> service.excluir(3, USUARIO))
                .isInstanceOf(RecursoNaoEncontradoException.class);

        verify(repository, never()).delete(any());
    }

    @Test
    void excluir_bloqueiaQuandoCategoriaEstaEmUso() {
        when(repository.findById(3)).thenReturn(Optional.of(categoria(3, "Casa", USUARIO)));
        when(contadorDeUso.descreverUsoCategoria(3)).thenReturn(Optional.of("em uso em 2 gastos e 1 orçamento"));

        assertThatThrownBy(() -> service.excluir(3, USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Casa")
                .hasMessageContaining("em uso em 2 gastos e 1 orçamento");

        verify(repository, never()).delete(any());
        verify(subcategoriaRepository, never()).excluirTodasDaCategoria(any(), any());
    }

    @Test
    void excluir_apagaCategoriaPropriaEEmCascataAsSubcategoriasNumSoDelete() {
        // Achado de performance (rodada 2026-09-11): antes buscava as subcategorias
        // e apagava uma a uma (findByUsuarioIdAndCategoriaIdOrderByNomeAsc + N
        // deleteById); agora é 1 DELETE em lote - não importa quantas existam.
        Categoria existente = categoria(3, "Casa", USUARIO);
        when(repository.findById(3)).thenReturn(Optional.of(existente));

        service.excluir(3, USUARIO);

        verify(subcategoriaRepository).excluirTodasDaCategoria(USUARIO, 3);
        verify(subcategoriaRepository, never()).findByUsuarioIdAndCategoriaIdOrderByNomeAsc(any(), any());
        verify(subcategoriaRepository, never()).deleteById(any());
        verify(repository).delete(existente);
    }

    // ---------- reordenar() ----------

    @SuppressWarnings("unchecked")
    private List<CategoriaOrdemUsuario> capturarSaveAll() {
        ArgumentCaptor<List<CategoriaOrdemUsuario>> captor = ArgumentCaptor.forClass(List.class);
        verify(ordemRepository).saveAll(captor.capture());
        return captor.getValue();
    }

    @Test
    void reordenar_persisteNaOrdemRecebidaEIgnoraIdsInvalidos() {
        Categoria c1 = categoria(1, "Alimentação", USUARIO);
        Categoria c2 = categoria(2, "Bares", USUARIO);
        Categoria c3 = categoria(3, "Casa", USUARIO);
        when(repository.findVisiveis(USUARIO)).thenReturn(List.of(c1, c2, c3));

        List<Categoria> ordenadas = service.reordenar(List.of(3, 999, 1), USUARIO);

        assertThat(ordenadas).containsExactly(c3, c1, c2);
        List<CategoriaOrdemUsuario> salvos = capturarSaveAll();
        assertThat(salvos).extracting(CategoriaOrdemUsuario::getCategoriaId).containsExactly(3, 1, 2);
        assertThat(salvos).extracting(CategoriaOrdemUsuario::getPosicao).containsExactly(0, 1, 2);
        assertThat(salvos).allSatisfy(r -> assertThat(r.getUsuarioId()).isEqualTo(USUARIO));
    }

    @Test
    void reordenar_categoriasForaDaListaVaoParaOFimNaOrdemPadrao() {
        Categoria sistemaB = categoria(10, "Zebra", null);
        Categoria sistemaA = categoria(11, "Abelha", null);
        Categoria propria = categoria(12, "Minha", USUARIO);
        when(repository.findVisiveis(USUARIO)).thenReturn(List.of(sistemaB, sistemaA, propria));

        List<Categoria> ordenadas = service.reordenar(List.of(12), USUARIO);

        // A própria vem primeiro (foi citada); o resto cai no fallback: sistema
        // antes de pessoal, cada grupo alfabético -> Abelha, Zebra.
        assertThat(ordenadas).containsExactly(propria, sistemaA, sistemaB);
    }

    @Test
    void reordenar_listaNulaColocaTudoNaOrdemPadrao() {
        Categoria sistema = categoria(10, "Sistema", null);
        Categoria propriaZ = categoria(11, "Zzz", USUARIO);
        Categoria propriaA = categoria(12, "Aaa", USUARIO);
        when(repository.findVisiveis(USUARIO)).thenReturn(List.of(propriaZ, sistema, propriaA));

        List<Categoria> ordenadas = service.reordenar(null, USUARIO);

        assertThat(ordenadas).containsExactly(sistema, propriaA, propriaZ);
    }

    @Test
    void reordenar_ignoraIdsRepetidos() {
        Categoria c1 = categoria(1, "Um", USUARIO);
        Categoria c2 = categoria(2, "Dois", USUARIO);
        when(repository.findVisiveis(USUARIO)).thenReturn(List.of(c1, c2));

        List<Categoria> ordenadas = service.reordenar(List.of(1, 1, 2), USUARIO);

        assertThat(ordenadas).containsExactly(c1, c2);
    }

    @Test
    void reordenar_reaproveitaRegistroDePosicaoExistenteEmVezDeCriarOutro() {
        Categoria c1 = categoria(1, "Um", USUARIO);
        when(repository.findVisiveis(USUARIO)).thenReturn(List.of(c1));
        CategoriaOrdemUsuario existente = new CategoriaOrdemUsuario();
        existente.setId(100);
        existente.setUsuarioId(USUARIO);
        existente.setCategoriaId(1);
        existente.setPosicao(5);
        when(ordemRepository.findByUsuarioId(USUARIO)).thenReturn(List.of(existente));

        service.reordenar(List.of(1), USUARIO);

        List<CategoriaOrdemUsuario> salvos = capturarSaveAll();
        assertThat(salvos).hasSize(1);
        assertThat(salvos.get(0).getId()).isEqualTo(100);
        assertThat(salvos.get(0).getPosicao()).isZero();
    }

    // ---------- listarVisiveis() / ordenarPorPreferencia() ----------

    @Test
    void listarVisiveis_aplicaPreferenciaDoUsuarioEJogaCategoriasNovasNoFim() {
        Categoria cA = categoria(1, "Alimentação", USUARIO);
        Categoria cB = categoria(2, "Bares", USUARIO);
        Categoria cNova = categoria(3, "Casa", USUARIO);
        when(repository.findVisiveis(USUARIO)).thenReturn(List.of(cA, cB, cNova));
        CategoriaOrdemUsuario posB = ordem(2, 0);
        CategoriaOrdemUsuario posA = ordem(1, 1);
        when(ordemRepository.findByUsuarioId(USUARIO)).thenReturn(List.of(posB, posA));

        List<Categoria> visiveis = service.listarVisiveis(USUARIO);

        // cB e cA na ordem salva; cNova (sem posição) no fim.
        assertThat(visiveis).containsExactly(cB, cA, cNova);
    }

    @Test
    void listarVisiveis_semPreferenciaUsaOrdemPadrao() {
        Categoria propriaZ = categoria(1, "Zzz", USUARIO);
        Categoria sistemaB = categoria(2, "Bares", null);
        Categoria sistemaA = categoria(3, "Abelha", null);
        when(repository.findVisiveis(USUARIO)).thenReturn(List.of(propriaZ, sistemaB, sistemaA));
        when(ordemRepository.findByUsuarioId(USUARIO)).thenReturn(List.of());

        List<Categoria> visiveis = service.listarVisiveis(USUARIO);

        assertThat(visiveis).containsExactly(sistemaA, sistemaB, propriaZ);
    }

    @Test
    void listarComGastos_semMesAno_consultaQualquerPeriodoEFiltraSoAsComGasto() {
        Categoria cA = categoria(1, "Alimentação", USUARIO);
        Categoria cB = categoria(2, "Bares", USUARIO);
        Categoria cC = categoria(3, "Casa", USUARIO);
        when(repository.findVisiveis(USUARIO)).thenReturn(List.of(cA, cB, cC));
        when(gastoRepository.categoriaIdsComGasto(eq(USUARIO), any(), any())).thenReturn(List.of(1, 3));

        List<Categoria> comGastos = service.listarComGastos(USUARIO, null, null);

        assertThat(comGastos).containsExactly(cA, cC);
        // mes/ano nulos -> janela de datas aberta (modo "Ver todos os meses").
        verify(gastoRepository).categoriaIdsComGasto(USUARIO, null, null);
    }

    @Test
    void listarComGastos_comMesAno_escopaNaJanelaDoMes() {
        Categoria cA = categoria(1, "Alimentação", USUARIO);
        when(repository.findVisiveis(USUARIO)).thenReturn(List.of(cA));
        when(gastoRepository.categoriaIdsComGasto(eq(USUARIO), any(), any())).thenReturn(List.of(1));

        service.listarComGastos(USUARIO, 2, 2026);

        // Fevereiro de 2026: 1 a 28.
        verify(gastoRepository).categoriaIdsComGasto(
                USUARIO, LocalDate.of(2026, 2, 1), LocalDate.of(2026, 2, 28));
    }

    @Test
    void listarComGastos_soAno_escopaNoAnoInteiro() {
        when(repository.findVisiveis(USUARIO)).thenReturn(List.of());
        when(gastoRepository.categoriaIdsComGasto(eq(USUARIO), any(), any())).thenReturn(List.of());

        service.listarComGastos(USUARIO, null, 2026);

        verify(gastoRepository).categoriaIdsComGasto(
                USUARIO, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31));
    }

    @Test
    void listarComGastos_mesInvalido_lancaSemConsultarRepositorio() {
        assertThatThrownBy(() -> service.listarComGastos(USUARIO, 13, 2026))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Mês inválido");

        verify(gastoRepository, never()).categoriaIdsComGasto(any(), any(), any());
    }

    private CategoriaOrdemUsuario ordem(int categoriaId, int posicao) {
        CategoriaOrdemUsuario o = new CategoriaOrdemUsuario();
        o.setUsuarioId(USUARIO);
        o.setCategoriaId(categoriaId);
        o.setPosicao(posicao);
        return o;
    }
}
