package com.controlegastos.api.repository;

import com.controlegastos.api.model.Gasto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface GastoRepository extends JpaRepository<Gasto, Integer> {

    List<Gasto> findAllByUsuarioIdOrderByDataDescIdDesc(Integer usuarioId);

    // Página de gastos do usuário para a listagem da tela (achado C1 da auditoria
    // 2026-09-05: "Ver todos os meses" trazia a tabela inteira numa resposta só).
    // Os três filtros são opcionais: categoriaId nulo = todas; inicio/fim nulos =
    // todo o histórico (a tela deriva inicio/fim de mês/ano no service). A ordenação
    // (data desc, id desc) vem no Pageable, montado no service - não do cliente.
    // O CAST(:inicio AS date) é o que deixa o Postgres inferir o tipo do parâmetro
    // quando ele chega nulo (senão: "could not determine data type of parameter").
    @Query("SELECT g FROM Gasto g WHERE g.usuarioId = :usuarioId "
            + "AND (:categoriaId IS NULL OR g.categoriaId = :categoriaId) "
            + "AND (CAST(:inicio AS date) IS NULL OR g.data >= :inicio) "
            + "AND (CAST(:fim AS date) IS NULL OR g.data <= :fim)")
    Page<Gasto> buscarPagina(
            @Param("usuarioId") Integer usuarioId,
            @Param("categoriaId") Integer categoriaId,
            @Param("inicio") LocalDate inicio,
            @Param("fim") LocalDate fim,
            Pageable pageable);

    Optional<Gasto> findByIdAndUsuarioId(Integer id, Integer usuarioId);

    List<Gasto> findByUsuarioIdAndCategoriaIgnoreCaseOrderByDataDescIdDesc(Integer usuarioId, String categoria);

    List<Gasto> findByUsuarioIdAndDataBetweenOrderByDataDescIdDesc(Integer usuarioId, LocalDate inicio, LocalDate fim);

    // Rede de segurança do backend contra reimportação de planilha (achado M6): a
    // detecção de duplicata da importação vive no frontend (classificar-linhas.ts)
    // e depende de listarTodos(); se essa chamada falha, o orquestrador trata toda
    // a planilha como linhas novas e recria tudo. Uma chave lógica
    // (usuário + data + valor + descrição normalizada) identifica um gasto
    // equivalente já cadastrado. TRIM/LOWER na descrição casa variações de caixa e
    // espaço; o valor é comparado exato (numeric), que é o que uma reimportação
    // reproduz. Cobre gastos de qualquer origem (avulso, recorrência, parcela),
    // igual à checagem do frontend, que compara com todo o histórico.
    @Query("""
            SELECT COUNT(g) > 0 FROM Gasto g
            WHERE g.usuarioId = :usuarioId
              AND g.data = :data
              AND g.valor = :valor
              AND LOWER(TRIM(g.descricao)) = LOWER(TRIM(:descricao))
            """)
    boolean existeGastoEquivalente(
            @Param("usuarioId") Integer usuarioId,
            @Param("data") LocalDate data,
            @Param("valor") BigDecimal valor,
            @Param("descricao") String descricao);

    long countByCategoriaId(Integer categoriaId);

    // IDs das categorias com pelo menos um gasto cadastrado pelo usuário (qualquer
    // período) - usado pra filtrar o dropdown de categoria em Gastos, mostrando só
    // categorias realmente em uso. Gastos legados sem categoriaId (nunca migrados)
    // ficam de fora, já que não correspondem a nenhuma categoria gerida específica.
    @Query("SELECT DISTINCT g.categoriaId FROM Gasto g WHERE g.usuarioId = :usuarioId AND g.categoriaId IS NOT NULL")
    List<Integer> categoriaIdsComGasto(@Param("usuarioId") Integer usuarioId);

    long countBySubcategoriaId(Integer subcategoriaId);

    // Usado pra checar se uma recorrência já foi lançada no mês/ano atual antes de
    // criar um novo gasto a partir dela - ver GastoRecorrenteService.lancarPendentes.
    boolean existsByGastoRecorrenteIdAndDataBetween(Integer gastoRecorrenteId, LocalDate inicio, LocalDate fim);

    // Parcelas ainda não vencidas (data futura) de uma compra parcelada - removidas ao
    // cancelar a compra, mantendo intactas as parcelas com data igual ou anterior a
    // hoje (histórico do que já foi pago) - ver CompraParceladaService.excluir.
    List<Gasto> findByCompraParceladaIdAndDataAfter(Integer compraParceladaId, LocalDate data);

    // Gastos de uma recorrência a partir de hoje (inclusive) - removidos ao excluir a
    // recorrência, mantendo intactos os gastos de meses passados (histórico) - ver
    // GastoRecorrenteService.excluir. Diferente de compras parceladas (que preservam o
    // gasto do dia de hoje como "já vencido"), aqui hoje conta como futuro/removível.
    List<Gasto> findByGastoRecorrenteIdAndDataGreaterThanEqual(Integer gastoRecorrenteId, LocalDate data);

    // Agrupa por categoriaId quando presente (fonte de verdade); GROUP BY também por
    // LOWER(categoria) porque categoriaId nulo (gastos legados, sem categoria gerenciada
    // vinculada) não separa grupos no SQL - todo NULL cai no mesmo grupo por padrão.
    @Query("SELECT g.categoriaId AS categoriaId, LOWER(g.categoria) AS categoria, SUM(g.valor) AS total FROM Gasto g "
            + "WHERE g.usuarioId = :usuarioId AND g.data BETWEEN :inicio AND :fim "
            + "GROUP BY g.categoriaId, LOWER(g.categoria) ORDER BY SUM(g.valor) DESC")
    List<CategoriaTotal> somarPorCategoriaNoPeriodo(
            @Param("usuarioId") Integer usuarioId, @Param("inicio") LocalDate inicio, @Param("fim") LocalDate fim);

    // Soma dos gastos vinculados a cada orçamento (vínculo explícito orcamento_id no
    // gasto, não comparação automática por categoria/subcategoria) - uma query agregada
    // só para todos os orçamentos do mês, em vez de um SELECT por orçamento dentro de um
    // loop (era o único loop-de-query que sobrava no projeto - auditoria 2026-09-05,
    // achado R3; existia antes como somarPorOrcamento(Integer), chamado um a um).
    // Um orçamento sem nenhum gasto vinculado simplesmente não aparece no resultado
    // (GROUP BY não gera linha pra grupo vazio) - o chamador trata a ausência como zero.
    @Query("SELECT g.orcamentoId AS orcamentoId, SUM(g.valor) AS total FROM Gasto g "
            + "WHERE g.orcamentoId IN :orcamentoIds GROUP BY g.orcamentoId")
    List<OrcamentoTotal> somarPorOrcamentos(@Param("orcamentoIds") List<Integer> orcamentoIds);

    interface OrcamentoTotal {
        Integer getOrcamentoId();

        BigDecimal getTotal();
    }

    @Query("SELECT COALESCE(SUM(g.valor), 0) FROM Gasto g "
            + "WHERE g.usuarioId = :usuarioId AND g.data BETWEEN :inicio AND :fim")
    BigDecimal somarNoPeriodo(
            @Param("usuarioId") Integer usuarioId, @Param("inicio") LocalDate inicio, @Param("fim") LocalDate fim);

    // Mesmo agrupamento de somarPorCategoriaNoPeriodo, mas também por subcategoriaId/
    // LOWER(subcategoria) - usado no ranking de categorias com detalhamento por
    // subcategoria (ver GastoService.rankingCategorias). LOWER(NULL) continua NULL, então
    // gastos sem subcategoria caem todos no mesmo grupo "sem subcategoria" da categoria.
    @Query("SELECT g.categoriaId AS categoriaId, LOWER(g.categoria) AS categoria, "
            + "g.subcategoriaId AS subcategoriaId, LOWER(g.subcategoria) AS subcategoria, SUM(g.valor) AS total "
            + "FROM Gasto g WHERE g.usuarioId = :usuarioId AND g.data BETWEEN :inicio AND :fim "
            + "GROUP BY g.categoriaId, LOWER(g.categoria), g.subcategoriaId, LOWER(g.subcategoria) "
            + "ORDER BY SUM(g.valor) DESC")
    List<CategoriaSubcategoriaTotal> somarPorCategoriaESubcategoriaNoPeriodo(
            @Param("usuarioId") Integer usuarioId, @Param("inicio") LocalDate inicio, @Param("fim") LocalDate fim);

    // Quantos gastos estão vinculados a cada compra parcelada do usuário - uma query
    // agregada só, usada pra mostrar "N de M parcelas" na aba Parceladas e sinalizar
    // parcelamentos incompletos (ver CompraParceladaService.listarTodos).
    @Query("SELECT g.compraParceladaId AS compraId, COUNT(g) AS total FROM Gasto g "
            + "WHERE g.usuarioId = :usuarioId AND g.compraParceladaId IS NOT NULL "
            + "GROUP BY g.compraParceladaId")
    List<ParcelasPorCompra> contarParcelasPorCompra(@Param("usuarioId") Integer usuarioId);

    interface ParcelasPorCompra {
        Integer getCompraId();

        long getTotal();
    }

    interface CategoriaTotal {
        Integer getCategoriaId();

        String getCategoria();

        BigDecimal getTotal();
    }

    interface CategoriaSubcategoriaTotal {
        Integer getCategoriaId();

        String getCategoria();

        Integer getSubcategoriaId();

        String getSubcategoria();

        BigDecimal getTotal();
    }
}
