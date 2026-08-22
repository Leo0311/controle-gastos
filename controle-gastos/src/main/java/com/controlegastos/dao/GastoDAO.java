package com.controlegastos.dao;

import com.controlegastos.model.Gasto;
import com.controlegastos.util.ConexaoBD;

import java.math.BigDecimal;
import java.sql.*;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Camada de acesso a dados (DAO) para a entidade Gasto.
 * Executa as operações de CRUD diretamente contra o PostgreSQL via JDBC.
 */
public class GastoDAO {

    public Gasto salvar(Gasto gasto) throws SQLException {
        String sql = "INSERT INTO gastos (descricao, valor, categoria, data) VALUES (?, ?, ?, ?) RETURNING id";

        try (Connection conn = ConexaoBD.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setString(1, gasto.getDescricao());
            stmt.setBigDecimal(2, gasto.getValor());
            stmt.setString(3, gasto.getCategoria());
            stmt.setDate(4, Date.valueOf(gasto.getData()));

            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    gasto.setId(rs.getInt("id"));
                }
            }
        }
        return gasto;
    }

    public List<Gasto> listarTodos() throws SQLException {
        String sql = "SELECT id, descricao, valor, categoria, data FROM gastos ORDER BY data DESC, id DESC";
        List<Gasto> gastos = new ArrayList<>();

        try (Connection conn = ConexaoBD.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {

            while (rs.next()) {
                gastos.add(mapear(rs));
            }
        }
        return gastos;
    }

    public List<Gasto> listarPorCategoria(String categoria) throws SQLException {
        String sql = "SELECT id, descricao, valor, categoria, data FROM gastos " +
                     "WHERE LOWER(categoria) = LOWER(?) ORDER BY data DESC, id DESC";
        List<Gasto> gastos = new ArrayList<>();

        try (Connection conn = ConexaoBD.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setString(1, categoria);
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    gastos.add(mapear(rs));
                }
            }
        }
        return gastos;
    }

    public List<Gasto> listarPorPeriodo(LocalDate inicio, LocalDate fim) throws SQLException {
        String sql = "SELECT id, descricao, valor, categoria, data FROM gastos " +
                     "WHERE data BETWEEN ? AND ? ORDER BY data DESC, id DESC";
        List<Gasto> gastos = new ArrayList<>();

        try (Connection conn = ConexaoBD.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setDate(1, Date.valueOf(inicio));
            stmt.setDate(2, Date.valueOf(fim));
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    gastos.add(mapear(rs));
                }
            }
        }
        return gastos;
    }

    public boolean atualizar(Gasto gasto) throws SQLException {
        String sql = "UPDATE gastos SET descricao = ?, valor = ?, categoria = ?, data = ? WHERE id = ?";

        try (Connection conn = ConexaoBD.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setString(1, gasto.getDescricao());
            stmt.setBigDecimal(2, gasto.getValor());
            stmt.setString(3, gasto.getCategoria());
            stmt.setDate(4, Date.valueOf(gasto.getData()));
            stmt.setInt(5, gasto.getId());

            return stmt.executeUpdate() > 0;
        }
    }

    public boolean excluir(int id) throws SQLException {
        String sql = "DELETE FROM gastos WHERE id = ?";

        try (Connection conn = ConexaoBD.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setInt(1, id);
            return stmt.executeUpdate() > 0;
        }
    }

    public BigDecimal somarTotal() throws SQLException {
        String sql = "SELECT COALESCE(SUM(valor), 0) AS total FROM gastos";

        try (Connection conn = ConexaoBD.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {

            if (rs.next()) {
                return rs.getBigDecimal("total");
            }
        }
        return BigDecimal.ZERO;
    }

    public List<Object[]> somarPorCategoria() throws SQLException {
        String sql = "SELECT categoria, SUM(valor) AS total FROM gastos " +
                     "GROUP BY categoria ORDER BY total DESC";
        List<Object[]> resultado = new ArrayList<>();

        try (Connection conn = ConexaoBD.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {

            while (rs.next()) {
                resultado.add(new Object[]{rs.getString("categoria"), rs.getBigDecimal("total")});
            }
        }
        return resultado;
    }

    public List<Object[]> somarPorCategoriaEPeriodo(LocalDate inicio, LocalDate fim) throws SQLException {
        String sql = "SELECT categoria, SUM(valor) AS total FROM gastos " +
                     "WHERE data BETWEEN ? AND ? GROUP BY categoria ORDER BY total DESC";
        List<Object[]> resultado = new ArrayList<>();

        try (Connection conn = ConexaoBD.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setDate(1, Date.valueOf(inicio));
            stmt.setDate(2, Date.valueOf(fim));
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    resultado.add(new Object[]{rs.getString("categoria"), rs.getBigDecimal("total")});
                }
            }
        }
        return resultado;
    }

    public BigDecimal somarPorCategoriaNoPeriodo(String categoria, LocalDate inicio, LocalDate fim) throws SQLException {
        String sql = "SELECT COALESCE(SUM(valor), 0) AS total FROM gastos " +
                     "WHERE LOWER(categoria) = LOWER(?) AND data BETWEEN ? AND ?";

        try (Connection conn = ConexaoBD.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setString(1, categoria);
            stmt.setDate(2, Date.valueOf(inicio));
            stmt.setDate(3, Date.valueOf(fim));

            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    return rs.getBigDecimal("total");
                }
            }
        }
        return BigDecimal.ZERO;
    }

    private Gasto mapear(ResultSet rs) throws SQLException {
        return new Gasto(
                rs.getInt("id"),
                rs.getString("descricao"),
                rs.getBigDecimal("valor"),
                rs.getString("categoria"),
                rs.getDate("data").toLocalDate()
        );
    }
}
