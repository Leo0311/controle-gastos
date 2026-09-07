package com.controlegastos.api.repository;

import com.controlegastos.api.model.Gasto;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.List;

@RequiredArgsConstructor
public class GastoRepositoryCustomImpl implements GastoRepositoryCustom {

    private static final String INSERT_GASTO = """
            INSERT INTO gastos
                (descricao, valor, categoria, subcategoria, categoria_id, subcategoria_id,
                 data, usuario_id, orcamento_id, gasto_recorrente_id,
                 status_pagamento, vencimento_original)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """;

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void inserirEmLote(List<Gasto> gastos) {
        if (gastos.isEmpty()) {
            return;
        }
        // Participa da transação do chamador (mesmo DataSource, conexão vinculada
        // à transação). Com reWriteBatchedInserts=true no pool (ver
        // application*.properties), o pgjdbc reescreve o lote num único INSERT
        // multi-linha - 1 ida ao banco no lugar de N.
        jdbcTemplate.batchUpdate(INSERT_GASTO, new BatchPreparedStatementSetter() {
            @Override
            public int getBatchSize() {
                return gastos.size();
            }

            @Override
            public void setValues(PreparedStatement ps, int i) throws SQLException {
                Gasto g = gastos.get(i);
                ps.setString(1, g.getDescricao());
                ps.setBigDecimal(2, g.getValor());
                ps.setString(3, g.getCategoria());
                ps.setString(4, g.getSubcategoria());
                ps.setObject(5, g.getCategoriaId());
                ps.setObject(6, g.getSubcategoriaId());
                ps.setObject(7, g.getData());
                ps.setObject(8, g.getUsuarioId());
                ps.setObject(9, g.getOrcamentoId());
                ps.setObject(10, g.getGastoRecorrenteId());
                // A pré-geração de recorrência sempre entra como PENDENTE; o
                // vencimento original é a própria data do lançamento pré-gerado.
                ps.setString(11, g.getStatusPagamento().name());
                ps.setObject(12, g.getVencimentoOriginal());
            }
        });
    }
}
