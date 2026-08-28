package com.controlegastos.api.service;

import com.controlegastos.api.exception.RecursoNaoEncontradoException;
import com.controlegastos.api.model.Categoria;
import com.controlegastos.api.repository.CategoriaRepository;
import com.controlegastos.api.repository.GastoRecorrenteRepository;
import com.controlegastos.api.repository.GastoRepository;
import com.controlegastos.api.repository.OrcamentoRepository;
import com.controlegastos.api.repository.SubcategoriaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CategoriaService {

    private static final String EMOJI_PADRAO = "📁";
    private static final int SEM_ID = 0;

    private final CategoriaRepository repository;
    private final SubcategoriaRepository subcategoriaRepository;
    private final GastoRepository gastoRepository;
    private final OrcamentoRepository orcamentoRepository;
    private final GastoRecorrenteRepository gastoRecorrenteRepository;

    public List<Categoria> listarVisiveis(Integer usuarioId) {
        return repository.findVisiveis(usuarioId);
    }

    public Categoria criar(Categoria dados, Integer usuarioId) {
        normalizar(dados);
        validar(dados);

        boolean jaExiste = repository.findDuplicadaVisivel(usuarioId, dados.getNome(), SEM_ID).isPresent();
        if (jaExiste) {
            throw new IllegalArgumentException("Já existe uma categoria com esse nome.");
        }

        dados.setId(null);
        dados.setUsuarioId(usuarioId);
        return repository.save(dados);
    }

    public Categoria atualizar(Integer id, Categoria dados, Integer usuarioId) {
        normalizar(dados);
        validar(dados);

        Categoria existente = buscarPropria(id, usuarioId);

        boolean jaExiste = repository.findDuplicadaVisivel(usuarioId, dados.getNome(), id).isPresent();
        if (jaExiste) {
            throw new IllegalArgumentException("Já existe uma categoria com esse nome.");
        }

        existente.setNome(dados.getNome());
        existente.setEmoji(dados.getEmoji());
        return repository.save(existente);
    }

    public void excluir(Integer id, Integer usuarioId) {
        Categoria existente = buscarPropria(id, usuarioId);

        boolean emUso = gastoRepository.existsByCategoriaId(id) || orcamentoRepository.existsByCategoriaId(id)
                || gastoRecorrenteRepository.existsByCategoriaId(id);
        if (emUso) {
            throw new IllegalArgumentException(
                    "Essa categoria está em uso em gastos, orçamentos ou gastos recorrentes e não pode ser excluída.");
        }

        // Nenhuma subcategoria dela pode estar em uso sem a categoria também estar
        // (todo gasto/orçamento com subcategoria tem a categoria correspondente
        // preenchida), então a checagem acima já garante que é seguro apagar em cascata.
        subcategoriaRepository.findByUsuarioIdAndCategoriaIdOrderByNomeAsc(usuarioId, id)
                .forEach(s -> subcategoriaRepository.deleteById(s.getId()));
        repository.delete(existente);
    }

    // Só permite editar/excluir categorias que o próprio usuário criou - categorias do
    // sistema (usuarioId nulo) são fixas para todo mundo.
    private Categoria buscarPropria(Integer id, Integer usuarioId) {
        Categoria categoria = repository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Categoria não encontrada com ID " + id));
        if (categoria.getUsuarioId() == null || !categoria.getUsuarioId().equals(usuarioId)) {
            throw new RecursoNaoEncontradoException("Categoria não encontrada com ID " + id);
        }
        return categoria;
    }

    private void normalizar(Categoria categoria) {
        if (categoria.getNome() != null) {
            categoria.setNome(categoria.getNome().trim());
        }
        if (categoria.getEmoji() == null || categoria.getEmoji().isBlank()) {
            categoria.setEmoji(EMOJI_PADRAO);
        } else {
            categoria.setEmoji(categoria.getEmoji().trim());
        }
    }

    private void validar(Categoria categoria) {
        if (categoria.getNome() == null || categoria.getNome().isBlank()) {
            throw new IllegalArgumentException("Nome da categoria não pode ser vazio.");
        }
    }
}
