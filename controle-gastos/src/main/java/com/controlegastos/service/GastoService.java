package com.controlegastos.service;

import com.controlegastos.dao.GastoDAO;
import com.controlegastos.model.Gasto;

import java.math.BigDecimal;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;

/**
 * Camada de regras de negócio, entre o menu (console) e o DAO.
 */
public class GastoService {

    private final GastoDAO dao = new GastoDAO();

    public Gasto cadastrar(String descricao, BigDecimal valor, String categoria, LocalDate data) throws SQLException {
        if (descricao == null || descricao.isBlank()) {
            throw new IllegalArgumentException("Descrição não pode ser vazia.");
        }
        if (valor == null || valor.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Valor deve ser maior que zero.");
        }
        if (categoria == null || categoria.isBlank()) {
            throw new IllegalArgumentException("Categoria não pode ser vazia.");
        }
        if (data == null) {
            data = LocalDate.now();
        }

        Gasto gasto = new Gasto(descricao.trim(), valor, categoria.trim(), data);
        return dao.salvar(gasto);
    }

    public List<Gasto> listarTodos() throws SQLException {
        return dao.listarTodos();
    }

    public List<Gasto> listarPorCategoria(String categoria) throws SQLException {
        return dao.listarPorCategoria(categoria);
    }

    public List<Gasto> listarPorPeriodo(LocalDate inicio, LocalDate fim) throws SQLException {
        return dao.listarPorPeriodo(inicio, fim);
    }

    public boolean atualizar(int id, String descricao, BigDecimal valor, String categoria, LocalDate data) throws SQLException {
        Gasto gasto = new Gasto(id, descricao.trim(), valor, categoria.trim(), data);
        return dao.atualizar(gasto);
    }

    public boolean excluir(int id) throws SQLException {
        return dao.excluir(id);
    }

    public BigDecimal totalGeral() throws SQLException {
        return dao.somarTotal();
    }

    public List<Object[]> totalPorCategoria() throws SQLException {
        return dao.somarPorCategoria();
    }

    public List<Object[]> totalPorCategoriaEPeriodo(LocalDate inicio, LocalDate fim) throws SQLException {
        return dao.somarPorCategoriaEPeriodo(inicio, fim);
    }

    public BigDecimal totalPorCategoriaNoPeriodo(String categoria, LocalDate inicio, LocalDate fim) throws SQLException {
        return dao.somarPorCategoriaNoPeriodo(categoria, inicio, fim);
    }
}
