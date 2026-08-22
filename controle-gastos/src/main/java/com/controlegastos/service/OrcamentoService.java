package com.controlegastos.service;

import com.controlegastos.dao.OrcamentoDAO;
import com.controlegastos.model.Orcamento;

import java.math.BigDecimal;
import java.sql.SQLException;
import java.util.List;

/**
 * Camada de regras de negócio, entre o menu (console) e o DAO.
 */
public class OrcamentoService {

    private final OrcamentoDAO dao = new OrcamentoDAO();

    public Orcamento definir(String categoria, BigDecimal valorLimite, int mes, int ano) throws SQLException {
        if (categoria == null || categoria.isBlank()) {
            throw new IllegalArgumentException("Categoria não pode ser vazia.");
        }
        if (valorLimite == null || valorLimite.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Valor limite deve ser maior que zero.");
        }
        if (mes < 1 || mes > 12) {
            throw new IllegalArgumentException("Mês inválido, informe um valor entre 1 e 12.");
        }
        if (ano <= 0) {
            throw new IllegalArgumentException("Ano inválido.");
        }

        Orcamento orcamento = new Orcamento(categoria.trim(), valorLimite, mes, ano);
        return dao.salvar(orcamento);
    }

    public Orcamento buscarPorCategoriaMesAno(String categoria, int mes, int ano) throws SQLException {
        return dao.buscarPorCategoriaMesAno(categoria, mes, ano);
    }

    public List<Orcamento> listarPorMesAno(int mes, int ano) throws SQLException {
        return dao.listarPorMesAno(mes, ano);
    }

    public boolean excluir(int id) throws SQLException {
        return dao.excluir(id);
    }
}
