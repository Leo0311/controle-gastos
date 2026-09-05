package com.controlegastos.api.service;

import com.controlegastos.api.exception.RecursoNaoEncontradoException;
import com.controlegastos.api.model.Categoria;
import com.controlegastos.api.model.Subcategoria;
import com.controlegastos.api.repository.CategoriaRepository;
import com.controlegastos.api.repository.SubcategoriaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Cobertura de SubcategoriaService - Mockito puro, mesmo padrão de
 * OrcamentoServiceTest / CategoriaServiceTest (achado M4 da auditoria 2026-09-05:
 * zero testes).
 *
 * Foco: a categoria-pai tem que ser visível pro usuário antes de qualquer
 * operação, a restrição estrita de findByIdAndUsuarioId (subcategoria do sistema
 * ou de outro usuário nunca é editável/excluível), a checagem de duplicidade
 * contra as visíveis usando a categoria do registro existente (não a do payload),
 * e o bloqueio de exclusão por uso.
 */
class SubcategoriaServiceTest {

    private static final int USUARIO = 1;
    private static final int CATEGORIA = 5;
    private static final String EMOJI_PADRAO = "📁";

    private final SubcategoriaRepository repository = mock(SubcategoriaRepository.class);
    private final CategoriaRepository categoriaRepository = mock(CategoriaRepository.class);
    private final ContadorDeUso contadorDeUso = mock(ContadorDeUso.class);

    private final SubcategoriaService service = new SubcategoriaService(
            repository, categoriaRepository, contadorDeUso);

    @BeforeEach
    void stubsPadrao() {
        Categoria categoria = new Categoria();
        categoria.setId(CATEGORIA);
        categoria.setNome("Alimentação");
        when(categoriaRepository.findByIdVisivel(CATEGORIA, USUARIO)).thenReturn(Optional.of(categoria));

        when(repository.save(any(Subcategoria.class))).thenAnswer(invocacao -> invocacao.getArgument(0));
        when(repository.findDuplicadaVisivel(any(), any(), any(), any())).thenReturn(Optional.empty());
        when(contadorDeUso.descreverUsoSubcategoria(any())).thenReturn(Optional.empty());
    }

    private Subcategoria subcategoria(Integer id, String nome, Integer usuarioId, Integer categoriaId) {
        Subcategoria s = new Subcategoria();
        s.setId(id);
        s.setNome(nome);
        s.setEmoji("🍔");
        s.setUsuarioId(usuarioId);
        s.setCategoriaId(categoriaId);
        return s;
    }

    // ---------- criar() ----------

    @Test
    void criar_lancaNaoEncontradoQuandoCategoriaNaoEhVisivel() {
        when(categoriaRepository.findByIdVisivel(99, USUARIO)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.criar(99, subcategoria(null, "Uber", null, null), USUARIO))
                .isInstanceOf(RecursoNaoEncontradoException.class);

        verify(repository, never()).save(any());
    }

    @Test
    void criar_rejeitaNomeVazio() {
        assertThatThrownBy(() -> service.criar(CATEGORIA, subcategoria(null, "  ", null, null), USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Nome da subcategoria não pode ser vazio");
    }

    @Test
    void criar_normalizaNomeUsaEmojiPadraoEAmarraCategoriaEUsuario() {
        Subcategoria dados = new Subcategoria();
        dados.setNome("  Uber  ");
        dados.setEmoji("   ");

        service.criar(CATEGORIA, dados, USUARIO);

        ArgumentCaptor<Subcategoria> captor = ArgumentCaptor.forClass(Subcategoria.class);
        verify(repository).save(captor.capture());
        Subcategoria salva = captor.getValue();
        assertThat(salva.getNome()).isEqualTo("Uber");
        assertThat(salva.getEmoji()).isEqualTo(EMOJI_PADRAO);
        assertThat(salva.getId()).isNull();
        assertThat(salva.getUsuarioId()).isEqualTo(USUARIO);
        assertThat(salva.getCategoriaId()).isEqualTo(CATEGORIA);
    }

    @Test
    void criar_rejeitaDuplicadaVisivelNaCategoriaSemSalvar() {
        when(repository.findDuplicadaVisivel(USUARIO, CATEGORIA, "Uber", 0))
                .thenReturn(Optional.of(subcategoria(9, "Uber", null, CATEGORIA)));

        assertThatThrownBy(() -> service.criar(CATEGORIA, subcategoria(null, "Uber", null, null), USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Já existe uma subcategoria com esse nome nessa categoria");

        verify(repository, never()).save(any());
    }

    @Test
    void criar_usaSentinelaSemIdNaChecagemDeDuplicidade() {
        service.criar(CATEGORIA, subcategoria(null, "Uber", null, null), USUARIO);

        verify(repository).findDuplicadaVisivel(USUARIO, CATEGORIA, "Uber", 0);
    }

    // ---------- atualizar() ----------

    @Test
    void atualizar_lancaNaoEncontradoParaSubcategoriaNaoPropria() {
        // findByIdAndUsuarioId é estrita: nunca encontra uma do sistema (usuarioId
        // nulo) nem a de outro usuário.
        when(repository.findByIdAndUsuarioId(3, USUARIO)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.atualizar(3, subcategoria(null, "Novo", null, null), USUARIO))
                .isInstanceOf(RecursoNaoEncontradoException.class)
                .hasMessageContaining("ID 3");

        verify(repository, never()).save(any());
    }

    @Test
    void atualizar_checaDuplicidadeContraACategoriaDoRegistroExistente() {
        Subcategoria existente = subcategoria(3, "Uber", USUARIO, CATEGORIA);
        when(repository.findByIdAndUsuarioId(3, USUARIO)).thenReturn(Optional.of(existente));

        Subcategoria dados = new Subcategoria();
        dados.setNome("99");
        dados.setEmoji("🚗");
        dados.setCategoriaId(999); // ignorado - a categoria vem do registro existente

        service.atualizar(3, dados, USUARIO);

        verify(repository).findDuplicadaVisivel(USUARIO, CATEGORIA, "99", 3);
    }

    @Test
    void atualizar_rejeitaNomeDuplicadoExcluindoOProprioIdSemSalvar() {
        Subcategoria existente = subcategoria(3, "Uber", USUARIO, CATEGORIA);
        when(repository.findByIdAndUsuarioId(3, USUARIO)).thenReturn(Optional.of(existente));
        when(repository.findDuplicadaVisivel(USUARIO, CATEGORIA, "99", 3))
                .thenReturn(Optional.of(subcategoria(4, "99", USUARIO, CATEGORIA)));

        assertThatThrownBy(() -> service.atualizar(3, subcategoria(null, "99", null, null), USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Já existe uma subcategoria com esse nome nessa categoria");

        verify(repository, never()).save(any());
    }

    @Test
    void atualizar_alteraNomeEEmojiDaSubcategoriaPropria() {
        Subcategoria existente = subcategoria(3, "Uber", USUARIO, CATEGORIA);
        when(repository.findByIdAndUsuarioId(3, USUARIO)).thenReturn(Optional.of(existente));

        Subcategoria dados = new Subcategoria();
        dados.setNome("  99 Pop  ");
        dados.setEmoji("🚕");

        Subcategoria salva = service.atualizar(3, dados, USUARIO);

        assertThat(salva.getNome()).isEqualTo("99 Pop");
        assertThat(salva.getEmoji()).isEqualTo("🚕");
        assertThat(salva.getCategoriaId()).isEqualTo(CATEGORIA);
    }

    // ---------- excluir() ----------

    @Test
    void excluir_lancaNaoEncontradoParaSubcategoriaNaoPropria() {
        when(repository.findByIdAndUsuarioId(3, USUARIO)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.excluir(3, USUARIO))
                .isInstanceOf(RecursoNaoEncontradoException.class);

        verify(repository, never()).delete(any());
    }

    @Test
    void excluir_bloqueiaQuandoSubcategoriaEstaEmUso() {
        Subcategoria existente = subcategoria(3, "Uber", USUARIO, CATEGORIA);
        when(repository.findByIdAndUsuarioId(3, USUARIO)).thenReturn(Optional.of(existente));
        when(contadorDeUso.descreverUsoSubcategoria(3)).thenReturn(Optional.of("em uso em 1 orçamento"));

        assertThatThrownBy(() -> service.excluir(3, USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Uber")
                .hasMessageContaining("em uso em 1 orçamento");

        verify(repository, never()).delete(any());
    }

    @Test
    void excluir_apagaSubcategoriaPropriaLivre() {
        Subcategoria existente = subcategoria(3, "Uber", USUARIO, CATEGORIA);
        when(repository.findByIdAndUsuarioId(3, USUARIO)).thenReturn(Optional.of(existente));

        service.excluir(3, USUARIO);

        verify(repository).delete(existente);
    }

    // ---------- listarPorCategoria() ----------

    @Test
    void listarPorCategoria_lancaNaoEncontradoQuandoCategoriaNaoEhVisivel() {
        when(categoriaRepository.findByIdVisivel(99, USUARIO)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.listarPorCategoria(99, USUARIO))
                .isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void listarPorCategoria_delegaAoRepositorioQuandoCategoriaEhVisivel() {
        List<Subcategoria> esperado = List.of(subcategoria(1, "Uber", null, CATEGORIA));
        when(repository.findVisiveisPorCategoria(USUARIO, CATEGORIA)).thenReturn(esperado);

        assertThat(service.listarPorCategoria(CATEGORIA, USUARIO)).isEqualTo(esperado);
    }
}
