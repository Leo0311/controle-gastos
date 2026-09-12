package com.controlegastos.api.repository;

import com.controlegastos.api.model.Gasto;
import com.controlegastos.api.model.StatusPagamento;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface GastoRepository extends JpaRepository<Gasto, Integer>, GastoRepositoryCustom {

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

    // IDs das categorias com pelo menos um gasto cadastrado pelo usuário no período
    // informado - usado pra filtrar o dropdown de categoria em Gastos, mostrando só
    // categorias com gasto no recorte que a tela está exibindo. inicio/fim nulos =
    // qualquer período (modo "Ver todos os meses"). Mesmo truque de CAST(...AS date)
    // de buscarPagina pra o Postgres inferir o tipo do parâmetro quando chega nulo.
    // Gastos legados sem categoriaId (nunca migrados) ficam de fora, já que não
    // correspondem a nenhuma categoria gerida específica.
    @Query("SELECT DISTINCT g.categoriaId FROM Gasto g WHERE g.usuarioId = :usuarioId "
            + "AND g.categoriaId IS NOT NULL "
            + "AND (CAST(:inicio AS date) IS NULL OR g.data >= :inicio) "
            + "AND (CAST(:fim AS date) IS NULL OR g.data <= :fim)")
    List<Integer> categoriaIdsComGasto(
            @Param("usuarioId") Integer usuarioId,
            @Param("inicio") LocalDate inicio,
            @Param("fim") LocalDate fim);

    long countBySubcategoriaId(Integer subcategoriaId);

    // Checa se uma recorrência já tem ocorrência pro mês (por VENCIMENTO ORIGINAL,
    // não pela data do gasto: um pagamento em regime de caixa move a data pra outro
    // mês, mas o vencimento é preservado - a idempotência do lançamento automático e
    // o índice único uq_gastos_recorrente_mes são ambos por mês de vencimento).
    boolean existsByGastoRecorrenteIdAndVencimentoOriginalBetween(
            Integer gastoRecorrenteId, LocalDate inicio, LocalDate fim);

    // Vencimentos originais dos gastos de uma recorrência a partir de um mês - a
    // pré-geração (gerarProximosMeses) usa pra saber, numa edição, quais meses do
    // horizonte já têm ocorrência, numa query só em vez de um exists por mês.
    @Query("SELECT g.vencimentoOriginal FROM Gasto g "
            + "WHERE g.gastoRecorrenteId = :recorrenteId AND g.vencimentoOriginal >= :aPartirDe")
    List<LocalDate> vencimentosDosGastosDaRecorrente(
            @Param("recorrenteId") Integer recorrenteId, @Param("aPartirDe") LocalDate aPartirDe);

    // Parcelas ainda não vencidas (data futura) de uma compra parcelada - removidas ao
    // cancelar a compra, mantendo intactas as parcelas com data igual ou anterior a
    // hoje (histórico do que já foi pago) - ver CompraParceladaService.excluir.
    List<Gasto> findByCompraParceladaIdAndDataAfter(Integer compraParceladaId, LocalDate data);

    // Ocorrências de uma recorrência / parcelas de uma compra num dado status -
    // usado pela ação em lote "marcar contas vencidas como pagas" (filtra os
    // PENDENTE com vencimento já chegado) - ver GastoRecorrenteService.pagarVencidas
    // e CompraParceladaService.pagarVencidas.
    List<Gasto> findByGastoRecorrenteIdAndStatusPagamento(Integer gastoRecorrenteId, StatusPagamento statusPagamento);

    List<Gasto> findByCompraParceladaIdAndStatusPagamento(Integer compraParceladaId, StatusPagamento statusPagamento);

    // Todas as parcelas de uma compra, em ordem cronológica - para o detalhe da
    // compra (GET /api/compras-parceladas/{id}/detalhe): progresso, valor
    // pago/restante e a lista completa (o agrupamento por ano é no cliente).
    // Chamado só depois de buscarPorId(id, usuarioId) já validar o dono, mesmo
    // padrão de findByCompraParceladaIdAndStatusPagamento/AndDataAfter acima.
    List<Gasto> findByCompraParceladaIdOrderByDataAsc(Integer compraParceladaId);

    // Contas atrasadas do usuário: PENDENTE com vencimento no passado, em qualquer
    // mês (uma conta vencida há 2 meses continua atrasada). Ordenadas do vencimento
    // mais antigo pro mais recente. Usado no destaque de atrasadas do Dashboard.
    @Query("SELECT g FROM Gasto g WHERE g.usuarioId = :usuarioId "
            + "AND g.statusPagamento = com.controlegastos.api.model.StatusPagamento.PENDENTE "
            + "AND g.vencimentoOriginal < :hoje ORDER BY g.vencimentoOriginal ASC, g.id ASC")
    List<Gasto> atrasadas(@Param("usuarioId") Integer usuarioId, @Param("hoje") LocalDate hoje);

    // Contas que vencem HOJE: PENDENTE com vencimento_original = hoje. Disjunto de
    // atrasadas() (que é estritamente < hoje). Destaque âmbar no Dashboard.
    @Query("SELECT g FROM Gasto g WHERE g.usuarioId = :usuarioId "
            + "AND g.statusPagamento = com.controlegastos.api.model.StatusPagamento.PENDENTE "
            + "AND g.vencimentoOriginal = :hoje ORDER BY g.id ASC")
    List<Gasto> venceHoje(@Param("usuarioId") Integer usuarioId, @Param("hoje") LocalDate hoje);

    // Contas a vencer nos próximos dias: PENDENTE com vencimento_original entre
    // :inicio e :fim (o service passa hoje+1 e hoje+3). Disjunto de venceHoje()
    // (= hoje) e de atrasadas() (< hoje). Os limites vêm calculados do service
    // porque aritmética de data em JPQL não é portável. Destaque azul no Dashboard.
    @Query("SELECT g FROM Gasto g WHERE g.usuarioId = :usuarioId "
            + "AND g.statusPagamento = com.controlegastos.api.model.StatusPagamento.PENDENTE "
            + "AND g.vencimentoOriginal BETWEEN :inicio AND :fim "
            + "ORDER BY g.vencimentoOriginal ASC, g.id ASC")
    List<Gasto> aVencer(
            @Param("usuarioId") Integer usuarioId,
            @Param("inicio") LocalDate inicio,
            @Param("fim") LocalDate fim);

    // Agenda da aba "Próximas contas": ocorrências de recorrência/parcela ainda
    // PENDENTES com vencimento até :fimHorizonte. Como o horizonte é sempre >= hoje,
    // um único teto pega tanto as ATRASADAS (vencimento < hoje) quanto as futuras
    // dentro da janela de meses escolhida na tela - mesma noção de "atrasada" das
    // queries atrasadas()/venceHoje() (PENDENTE + vencimento_original), sem repetir
    // regra. Ordenadas por vencimento; o agrupamento por mês é no cliente.
    @Query("SELECT g FROM Gasto g WHERE g.usuarioId = :usuarioId "
            + "AND (g.gastoRecorrenteId IS NOT NULL OR g.compraParceladaId IS NOT NULL) "
            + "AND g.statusPagamento = com.controlegastos.api.model.StatusPagamento.PENDENTE "
            + "AND g.vencimentoOriginal <= :fimHorizonte "
            + "ORDER BY g.vencimentoOriginal ASC, g.id ASC")
    List<Gasto> agendaProximasContas(
            @Param("usuarioId") Integer usuarioId, @Param("fimHorizonte") LocalDate fimHorizonte);

    // Contadores agregados por recorrência: numa query só (GROUP BY), quantas
    // ocorrências dela estão atrasadas, quantas pendentes ainda não vencidas, e
    // quantos lançamentos futuros já foram gerados (data >= hoje, qualquer status -
    // um pré-gerado pago cedo continua sendo um lançamento futuro que a pausa não
    // remove). "atrasada"/"pendente" usam PENDENTE + vencimento_original, igual às
    // queries atrasadas()/venceHoje(). Alimenta os badges e o "N lançamentos
    // futuros" da aba Recorrentes sem baixar a lista inteira de gastos no cliente.
    @Query("SELECT g.gastoRecorrenteId AS fonteId, "
            + "SUM(CASE WHEN g.statusPagamento = com.controlegastos.api.model.StatusPagamento.PENDENTE "
            + "         AND g.vencimentoOriginal < :hoje THEN 1 ELSE 0 END) AS atrasadas, "
            + "SUM(CASE WHEN g.statusPagamento = com.controlegastos.api.model.StatusPagamento.PENDENTE "
            + "         AND g.vencimentoOriginal >= :hoje THEN 1 ELSE 0 END) AS pendentes, "
            + "SUM(CASE WHEN g.data >= :hoje THEN 1 ELSE 0 END) AS futuros "
            + "FROM Gasto g WHERE g.usuarioId = :usuarioId AND g.gastoRecorrenteId IS NOT NULL "
            + "GROUP BY g.gastoRecorrenteId")
    List<ContagemStatusFonte> contarStatusPorRecorrente(
            @Param("usuarioId") Integer usuarioId, @Param("hoje") LocalDate hoje);

    // Igual a contarStatusPorRecorrente, mas por compra parcelada. `futuros` vem
    // junto pela simetria da projeção; a tela Parceladas usa só atrasadas/pendentes.
    @Query("SELECT g.compraParceladaId AS fonteId, "
            + "SUM(CASE WHEN g.statusPagamento = com.controlegastos.api.model.StatusPagamento.PENDENTE "
            + "         AND g.vencimentoOriginal < :hoje THEN 1 ELSE 0 END) AS atrasadas, "
            + "SUM(CASE WHEN g.statusPagamento = com.controlegastos.api.model.StatusPagamento.PENDENTE "
            + "         AND g.vencimentoOriginal >= :hoje THEN 1 ELSE 0 END) AS pendentes, "
            + "SUM(CASE WHEN g.data >= :hoje THEN 1 ELSE 0 END) AS futuros "
            + "FROM Gasto g WHERE g.usuarioId = :usuarioId AND g.compraParceladaId IS NOT NULL "
            + "GROUP BY g.compraParceladaId")
    List<ContagemStatusFonte> contarStatusPorParcelada(
            @Param("usuarioId") Integer usuarioId, @Param("hoje") LocalDate hoje);

    // Apaga TODOS os gastos de uma recorrência (passados e futuros) numa tacada -
    // parte da exclusão em cascata da recorrência (ver
    // GastoService.excluirRecorrenciaEmCascata). Roda antes do delete da própria
    // recorrência: a FK gastos.gasto_recorrente_id é ON DELETE SET NULL, então se a
    // recorrência sumisse primeiro os gastos ficariam órfãos em vez de removidos.
    @Modifying
    @Query("DELETE FROM Gasto g WHERE g.gastoRecorrenteId = :recorrenteId")
    int excluirTodosDaRecorrente(@Param("recorrenteId") Integer recorrenteId);

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

    // COUNT via SQL em vez de buscar a lista inteira só pra contar - usado por
    // GastoService.resumo (achado de performance, rodada 2026-09-11: o Dashboard
    // baixava a lista completa de gastos do mês/ano só pra somar/contar no cliente).
    @Query("SELECT COUNT(g) FROM Gasto g WHERE g.usuarioId = :usuarioId AND g.data BETWEEN :inicio AND :fim")
    long contarNoPeriodo(
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

    // Projeção de contarStatusPorRecorrente/contarStatusPorParcelada: id da fonte
    // (recorrência ou compra) + contagens. fonteId nunca é null (as queries filtram
    // IS NOT NULL antes do GROUP BY).
    interface ContagemStatusFonte {
        Integer getFonteId();

        long getAtrasadas();

        long getPendentes();

        long getFuturos();
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
