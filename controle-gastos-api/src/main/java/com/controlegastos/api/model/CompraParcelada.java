package com.controlegastos.api.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Uma compra parcelada: ao ser cadastrada, gera IMEDIATAMENTE todas as parcelas
 * como gastos individuais (ver CompraParceladaService.gerarParcelas) - diferente
 * de GastoRecorrente, que lança um gasto por vez sob demanda, mês a mês.
 */
@Entity
@Table(name = "compras_parceladas")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CompraParcelada {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 150)
    private String descricao;

    @Column(name = "valor_total", nullable = false, precision = 12, scale = 2)
    private BigDecimal valorTotal;

    @Column(name = "numero_parcelas", nullable = false)
    private Integer numeroParcelas;

    @Column(name = "categoria_id", nullable = false)
    private Integer categoriaId;

    @Column(name = "subcategoria_id")
    private Integer subcategoriaId;

    @Column(name = "orcamento_id")
    private Integer orcamentoId;

    // 1-31. Mesmo clamping de GastoRecorrente.diaDoMes em meses mais curtos - ver
    // CompraParceladaService.gerarParcelas.
    @Column(name = "dia_do_mes", nullable = false)
    private Integer diaDoMes;

    // Boolean (não primitivo) pelo mesmo motivo de GastoRecorrente.ativo: o Jackson usa
    // o construtor @AllArgsConstructor pra desserializar, e "ativa" é sempre definido
    // pelo servidor (nunca enviado pelo cliente ao criar).
    @Column(nullable = false)
    private Boolean ativa;

    @Column(name = "usuario_id", nullable = false)
    private Integer usuarioId;

    @Column(name = "data_criacao", nullable = false)
    private LocalDateTime dataCriacao;

    // Quantos gastos estão realmente vinculados a esta compra hoje. Não é coluna
    // (por isso @Transient) - preenchido só na listagem (CompraParceladaService.
    // listarTodos) a partir de uma contagem agregada. Se ficar abaixo de
    // numeroParcelas, o parcelamento está incompleto: uma parcela foi removida
    // fora do fluxo, ou é dado anterior à trava de exclusão. Vem null nas demais
    // respostas (POST) e é ignorado na desserialização, igual a GastoRecorrente.mesesGerar.
    @Transient
    private Integer parcelasLancadas;
}
