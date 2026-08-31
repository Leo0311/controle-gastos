package com.controlegastos.api.service;

import com.controlegastos.api.exception.RecursoNaoEncontradoException;
import com.controlegastos.api.model.Categoria;
import com.controlegastos.api.model.Subcategoria;
import com.controlegastos.api.repository.CategoriaRepository;
import com.controlegastos.api.repository.SubcategoriaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SubcategoriaService {

    private static final String EMOJI_PADRAO = "📁";
    private static final int SEM_ID = 0;

    private final SubcategoriaRepository repository;
    private final CategoriaRepository categoriaRepository;
    private final ContadorDeUso contadorDeUso;

    // Subcategorias visíveis da categoria: as padrão do sistema + as próprias do
    // usuário - mesmo padrão de CategoriaService.listarVisiveis.
    public List<Subcategoria> listarPorCategoria(Integer categoriaId, Integer usuarioId) {
        buscarCategoriaVisivel(categoriaId, usuarioId);
        return repository.findVisiveisPorCategoria(usuarioId, categoriaId);
    }

    public List<Subcategoria> listarTodasVisiveis(Integer usuarioId) {
        return repository.findVisiveis(usuarioId);
    }

    public Subcategoria criar(Integer categoriaId, Subcategoria dados, Integer usuarioId) {
        buscarCategoriaVisivel(categoriaId, usuarioId);
        normalizar(dados);
        validar(dados);

        // Contra visíveis (não só as próprias): evita criar uma subcategoria pessoal
        // com o mesmo nome de uma já padrão do sistema na mesma categoria.
        boolean jaExiste = repository.findDuplicadaVisivel(usuarioId, categoriaId, dados.getNome(), SEM_ID).isPresent();
        if (jaExiste) {
            throw new IllegalArgumentException("Já existe uma subcategoria com esse nome nessa categoria.");
        }

        dados.setId(null);
        dados.setUsuarioId(usuarioId);
        dados.setCategoriaId(categoriaId);
        return repository.save(dados);
    }

    // Só permite editar subcategorias que o próprio usuário criou (findByIdAndUsuarioId
    // é estrita, nunca encontra uma padrão do sistema - usuarioId nulo nunca bate com
    // um usuarioId real) - subcategorias do sistema são fixas, igual às categorias.
    public Subcategoria atualizar(Integer id, Subcategoria dados, Integer usuarioId) {
        normalizar(dados);
        validar(dados);

        Subcategoria existente = repository.findByIdAndUsuarioId(id, usuarioId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Subcategoria não encontrada com ID " + id));

        boolean jaExiste = repository
                .findDuplicadaVisivel(usuarioId, existente.getCategoriaId(), dados.getNome(), id).isPresent();
        if (jaExiste) {
            throw new IllegalArgumentException("Já existe uma subcategoria com esse nome nessa categoria.");
        }

        existente.setNome(dados.getNome());
        existente.setEmoji(dados.getEmoji());
        return repository.save(existente);
    }

    // Mesma restrição de atualizar(): só a própria subcategoria do usuário, nunca
    // uma padrão do sistema.
    public void excluir(Integer id, Integer usuarioId) {
        Subcategoria existente = repository.findByIdAndUsuarioId(id, usuarioId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Subcategoria não encontrada com ID " + id));

        // Bloqueia se ainda houver qualquer lançamento apontando pra ela (inclusive
        // compras parceladas, que a FK só rejeitaria com um erro cru de banco), e
        // diz exatamente quantos de cada tipo pro usuário resolver antes.
        contadorDeUso.descreverUsoSubcategoria(id).ifPresent(uso -> {
            throw new IllegalArgumentException(
                    "Não é possível excluir a subcategoria \"" + existente.getNome() + "\": " + uso
                    + ". Reclassifique ou remova esses lançamentos primeiro.");
        });

        repository.delete(existente);
    }

    private Categoria buscarCategoriaVisivel(Integer categoriaId, Integer usuarioId) {
        return categoriaRepository.findByIdVisivel(categoriaId, usuarioId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Categoria não encontrada com ID " + categoriaId));
    }

    private void normalizar(Subcategoria subcategoria) {
        if (subcategoria.getNome() != null) {
            subcategoria.setNome(subcategoria.getNome().trim());
        }
        if (subcategoria.getEmoji() == null || subcategoria.getEmoji().isBlank()) {
            subcategoria.setEmoji(EMOJI_PADRAO);
        } else {
            subcategoria.setEmoji(subcategoria.getEmoji().trim());
        }
    }

    private void validar(Subcategoria subcategoria) {
        if (subcategoria.getNome() == null || subcategoria.getNome().isBlank()) {
            throw new IllegalArgumentException("Nome da subcategoria não pode ser vazio.");
        }
    }
}
