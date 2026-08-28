package com.controlegastos.api.service;

import com.controlegastos.api.exception.RecursoNaoEncontradoException;
import com.controlegastos.api.model.Categoria;
import com.controlegastos.api.model.Subcategoria;
import com.controlegastos.api.repository.CategoriaRepository;
import com.controlegastos.api.repository.GastoRepository;
import com.controlegastos.api.repository.OrcamentoRepository;
import com.controlegastos.api.repository.SubcategoriaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SubcategoriaService {

    private static final int SEM_ID = 0;

    private final SubcategoriaRepository repository;
    private final CategoriaRepository categoriaRepository;
    private final GastoRepository gastoRepository;
    private final OrcamentoRepository orcamentoRepository;

    public List<Subcategoria> listarPorCategoria(Integer categoriaId, Integer usuarioId) {
        buscarCategoriaVisivel(categoriaId, usuarioId);
        return repository.findByUsuarioIdAndCategoriaIdOrderByNomeAsc(usuarioId, categoriaId);
    }

    public List<Subcategoria> listarTodasDoUsuario(Integer usuarioId) {
        return repository.findByUsuarioIdOrderByNomeAsc(usuarioId);
    }

    public Subcategoria criar(Integer categoriaId, Subcategoria dados, Integer usuarioId) {
        buscarCategoriaVisivel(categoriaId, usuarioId);
        normalizar(dados);
        validar(dados);

        boolean jaExiste = repository.findDuplicada(usuarioId, categoriaId, dados.getNome(), SEM_ID).isPresent();
        if (jaExiste) {
            throw new IllegalArgumentException("Já existe uma subcategoria com esse nome nessa categoria.");
        }

        dados.setId(null);
        dados.setUsuarioId(usuarioId);
        dados.setCategoriaId(categoriaId);
        return repository.save(dados);
    }

    public Subcategoria atualizar(Integer id, Subcategoria dados, Integer usuarioId) {
        normalizar(dados);
        validar(dados);

        Subcategoria existente = repository.findByIdAndUsuarioId(id, usuarioId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Subcategoria não encontrada com ID " + id));

        boolean jaExiste = repository
                .findDuplicada(usuarioId, existente.getCategoriaId(), dados.getNome(), id).isPresent();
        if (jaExiste) {
            throw new IllegalArgumentException("Já existe uma subcategoria com esse nome nessa categoria.");
        }

        existente.setNome(dados.getNome());
        return repository.save(existente);
    }

    public void excluir(Integer id, Integer usuarioId) {
        Subcategoria existente = repository.findByIdAndUsuarioId(id, usuarioId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Subcategoria não encontrada com ID " + id));

        boolean emUso = gastoRepository.existsBySubcategoriaId(id) || orcamentoRepository.existsBySubcategoriaId(id);
        if (emUso) {
            throw new IllegalArgumentException(
                    "Essa subcategoria está em uso em gastos ou orçamentos e não pode ser excluída.");
        }

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
    }

    private void validar(Subcategoria subcategoria) {
        if (subcategoria.getNome() == null || subcategoria.getNome().isBlank()) {
            throw new IllegalArgumentException("Nome da subcategoria não pode ser vazio.");
        }
    }
}
