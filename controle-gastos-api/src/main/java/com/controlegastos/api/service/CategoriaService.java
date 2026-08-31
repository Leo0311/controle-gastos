package com.controlegastos.api.service;

import com.controlegastos.api.exception.RecursoNaoEncontradoException;
import com.controlegastos.api.model.Categoria;
import com.controlegastos.api.model.CategoriaOrdemUsuario;
import com.controlegastos.api.repository.CategoriaOrdemUsuarioRepository;
import com.controlegastos.api.repository.CategoriaRepository;
import com.controlegastos.api.repository.GastoRepository;
import com.controlegastos.api.repository.SubcategoriaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CategoriaService {

    private static final String EMOJI_PADRAO = "📁";
    private static final int SEM_ID = 0;

    // Ordem padrão quando o usuário nunca personalizou nada (ou pra categorias
    // novas ainda sem posição salva): categorias do sistema primeiro, depois as
    // pessoais, cada grupo em ordem alfabética.
    private static final Comparator<Categoria> ORDEM_PADRAO = Comparator
            .comparing((Categoria c) -> c.getUsuarioId() != null)
            .thenComparing(Categoria::getNome, String.CASE_INSENSITIVE_ORDER);

    private final CategoriaRepository repository;
    private final CategoriaOrdemUsuarioRepository ordemRepository;
    private final SubcategoriaRepository subcategoriaRepository;
    private final GastoRepository gastoRepository;
    private final ContadorDeUso contadorDeUso;

    public List<Categoria> listarVisiveis(Integer usuarioId) {
        return ordenarPorPreferencia(repository.findVisiveis(usuarioId), usuarioId);
    }

    // Só as categorias visíveis para o usuário que têm pelo menos um gasto cadastrado
    // (qualquer período, não só o mês filtrado no momento, pra manter simples) - usado
    // pelo filtro de categoria em Gastos, pra não listar categorias nunca usadas. Mantém
    // a mesma ordem de listarVisiveis (preferência do usuário), só filtrando o resultado.
    public List<Categoria> listarComGastos(Integer usuarioId) {
        Set<Integer> idsComGasto = new HashSet<>(gastoRepository.categoriaIdsComGasto(usuarioId));
        return listarVisiveis(usuarioId).stream()
                .filter(c -> idsComGasto.contains(c.getId()))
                .collect(Collectors.toList());
    }

    // Aplica a preferência de ordem do usuário (se existir) às categorias visíveis:
    // as que já têm posição salva vêm primeiro, na ordem salva; as que ainda não têm
    // (usuário nunca mexeu, ou categoria criada/liberada depois da última vez que ele
    // reordenou) vêm no final, na ordem padrão - isso cobre tanto quem nunca
    // personalizou nada (todas caem no fallback) quanto quem já personalizou mas
    // ganhou uma categoria nova nesse meio tempo (só a nova cai no fallback).
    private List<Categoria> ordenarPorPreferencia(List<Categoria> visiveis, Integer usuarioId) {
        Map<Integer, Integer> posicoes = ordemRepository.findByUsuarioId(usuarioId).stream()
                .collect(Collectors.toMap(CategoriaOrdemUsuario::getCategoriaId, CategoriaOrdemUsuario::getPosicao));

        List<Categoria> comPosicao = visiveis.stream()
                .filter(c -> posicoes.containsKey(c.getId()))
                .sorted(Comparator.comparing(c -> posicoes.get(c.getId())))
                .collect(Collectors.toList());
        List<Categoria> semPosicao = visiveis.stream()
                .filter(c -> !posicoes.containsKey(c.getId()))
                .sorted(ORDEM_PADRAO)
                .collect(Collectors.toList());

        List<Categoria> resultado = new ArrayList<>(comPosicao);
        resultado.addAll(semPosicao);
        return resultado;
    }

    // Recebe a lista completa de IDs de categoria na ordem final desejada (o
    // drag & drop da tela) e persiste a posição de cada uma numa tacada só - mais
    // eficiente que repetir um "mover 1 passo" várias vezes. Materializa uma
    // posição explícita pra cada categoria visível (antes da primeira
    // personalização não havia nenhuma linha em categorias_ordem_usuario pro
    // usuário) e mantém tudo consistente nas vezes seguintes. Retorna a lista já
    // reordenada, pronta pra tela usar sem precisar recarregar tudo de novo.
    @Transactional
    public List<Categoria> reordenar(List<Integer> idsOrdenados, Integer usuarioId) {
        List<Categoria> visiveis = repository.findVisiveis(usuarioId);
        Map<Integer, Categoria> porId = visiveis.stream()
                .collect(Collectors.toMap(Categoria::getId, Function.identity()));

        // Primeiro as categorias citadas na ordem recebida (ignorando IDs
        // repetidos ou que não são visíveis pro usuário); depois qualquer
        // categoria visível que ficou de fora da lista, na ordem padrão - assim
        // uma requisição incompleta (ex: categoria criada em outra aba nesse
        // meio tempo) nunca faz uma categoria "sumir", só a joga pro fim.
        List<Categoria> ordenadas = new ArrayList<>();
        Set<Integer> jaAdicionadas = new HashSet<>();
        if (idsOrdenados != null) {
            for (Integer id : idsOrdenados) {
                Categoria categoria = porId.get(id);
                if (categoria != null && jaAdicionadas.add(id)) {
                    ordenadas.add(categoria);
                }
            }
        }
        visiveis.stream()
                .filter(c -> !jaAdicionadas.contains(c.getId()))
                .sorted(ORDEM_PADRAO)
                .forEach(ordenadas::add);

        persistirOrdem(ordenadas, usuarioId);
        return ordenadas;
    }

    private void persistirOrdem(List<Categoria> ordenadas, Integer usuarioId) {
        Map<Integer, CategoriaOrdemUsuario> existentes = ordemRepository.findByUsuarioId(usuarioId).stream()
                .collect(Collectors.toMap(CategoriaOrdemUsuario::getCategoriaId, Function.identity()));

        List<CategoriaOrdemUsuario> paraSalvar = new ArrayList<>();
        for (int i = 0; i < ordenadas.size(); i++) {
            Integer categoriaId = ordenadas.get(i).getId();
            CategoriaOrdemUsuario registro = existentes.get(categoriaId);
            if (registro == null) {
                registro = new CategoriaOrdemUsuario();
                registro.setUsuarioId(usuarioId);
                registro.setCategoriaId(categoriaId);
            }
            registro.setPosicao(i);
            paraSalvar.add(registro);
        }
        ordemRepository.saveAll(paraSalvar);
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

        // Bloqueia se ainda houver qualquer lançamento apontando pra ela (inclusive
        // compras parceladas, que a FK só rejeitaria com um erro cru de banco), e
        // diz exatamente quantos de cada tipo pro usuário resolver antes.
        contadorDeUso.descreverUsoCategoria(id).ifPresent(uso -> {
            throw new IllegalArgumentException(
                    "Não é possível excluir a categoria \"" + existente.getNome() + "\": " + uso
                    + ". Reclassifique ou remova esses lançamentos primeiro.");
        });

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
