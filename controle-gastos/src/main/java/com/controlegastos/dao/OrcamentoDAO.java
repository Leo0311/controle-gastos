package com.controlegastos.dao;

import com.controlegastos.model.Orcamento;
import com.controlegastos.util.ConexaoBD;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

/**
 * Camada de acesso a dados (DAO) para a entidade Orcamento.
 * Executa as operações de CRUD diretamente contra o PostgreSQL via JDBC.
 */
public class OrcamentoDAO {

    public Orcamento salvar(Orcamento orcamento) throws SQLException {
        String sql = "INSERT INTO orcamentos (categoria, valor_limite, mes, ano) VALUES (?, ?, ?, ?) " +
                     "ON CONFLICT (categoria, mes, ano) DO UPDATE SET valor_limite = EXCLUDED.valor_limite " +
                     "RETURNING id";

        try (Connection conn = ConexaoBD.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setString(1, orcamento.getCategoria());
            stmt.setBigDecimal(2, orcamento.getValorLimite());
            stmt.setInt(3, orcamento.getMes());
            stmt.setInt(4, orcamento.getAno());

            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    orcamento.setId(rs.getInt("id"));
                }
            }
        }
        return orcamento;
    }

    public Orcamento buscarPorCategoriaMesAno(String categoria, int mes, int ano) throws SQLException {
        String sql = "SELECT id, categoria, valor_limite, mes, ano FROM orcamentos " +
                     "WHERE LOWER(categoria) = LOWER(?) AND mes = ? AND ano = ?";

        try (Connection conn = ConexaoBD.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setString(1, categoria);
            stmt.setInt(2, mes);
            stmt.setInt(3, ano);

            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    return mapear(rs);
                }
            }
        }
        return null;
    }

    public List<Orcamento> listarPorMesAno(int mes, int ano) throws SQLException {
        String sql = "SELECT id, categoria, valor_limite, mes, ano FROM orcamentos " +
                     "WHERE mes = ? AND ano = ? ORDER BY categoria";
        List<Orcamento> orcamentos = new ArrayList<>();

        try (Connection conn = ConexaoBD.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setInt(1, mes);
            stmt.setInt(2, ano);

            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    orcamentos.add(mapear(rs));
                }
            }
        }
        return orcamentos;
    }

    public boolean excluir(int id) throws SQLException {
        String sql = "DELETE FROM orcamentos WHERE id = ?";

        try (Connection conn = ConexaoBD.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setInt(1, id);
            return stmt.executeUpdate() > 0;
        }
    }

    private Orcamento mapear(ResultSet rs) throws SQLException {
        return new Orcamento(
                rs.getInt("id"),
                rs.getString("categoria"),
                rs.getBigDecimal("valor_limite"),
                rs.getInt("mes"),
                rs.getInt("ano")
        );
    }
}
