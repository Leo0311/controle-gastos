package com.controlegastos.api.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Mapeia a tabela "gastos" já existente no banco controle_gastos
 * (criada pelo schema.sql do projeto de console controle-gastos).
 */
@Entity
@Table(name = "gastos")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Gasto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 150)
    private String descricao;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal valor;

    // Espelham o nome da categoria/subcategoria gerenciada (categoriaId/subcategoriaId
    // abaixo) no momento do salvamento - mantidos por compatibilidade com a coluna
    // NOT NULL já existente e como fallback de exibição para gastos legados (criados
    // pelo console, que não tem noção de categoria gerenciada) sem categoriaId.
    @Column(nullable = false, length = 60)
    private String categoria;

    @Column(length = 60)
    private String subcategoria;

    @Column(name = "categoria_id")
    private Integer categoriaId;

    @Column(name = "subcategoria_id")
    private Integer subcategoriaId;

    @Column(nullable = false)
    private LocalDate data;

    @Column(name = "usuario_id")
    private Integer usuarioId;

    @Column(name = "orcamento_id")
    private Integer orcamentoId;

    // Preenchido só quando este gasto foi criado automaticamente por uma recorrência
    // (ver GastoRecorrenteService.lancarPendentes) - null para gastos cadastrados
    // manualmente. Nunca é alterado por uma edição manual do gasto depois de criado.
    @Column(name = "gasto_recorrente_id")
    private Integer gastoRecorrenteId;

    // Preenchido só quando este gasto é uma parcela gerada automaticamente por uma
    // compra parcelada (ver CompraParceladaService.gerarParcelas) - null para gastos
    // avulsos e para gastos gerados por recorrência.
    @Column(name = "compra_parcelada_id")
    private Integer compraParceladaId;

    // PENDENTE (previsto) x PAGO (efetivamente pago). Gasto avulso nasce sempre
    // PAGO; só gasto de recorrência/parcela pode ficar PENDENTE. Nunca vem do
    // cliente - o service define (ver GastoService.salvar/pagar). O console grava
    // sem esta coluna e o DEFAULT 'PAGO' do schema resolve.
    @Enumerated(EnumType.STRING)
    @Column(name = "status_pagamento", nullable = false, length = 10)
    private StatusPagamento statusPagamento;

    // Dia do vencimento original, preservado mesmo depois de pago (data real do
    // pagamento passa a viver em data). Permite "desfazer" um pagamento voltando
    // data ao vencimento. Null para gasto avulso (não tem vencimento).
    @Column(name = "vencimento_original")
    private LocalDate vencimentoOriginal;

    // Data real do pagamento. Para avulso é a própria data informada no cadastro;
    // para gasto de recorrência/parcela é preenchida ao confirmar o pagamento e
    // zerada ao desfazer.
    @Column(name = "data_pagamento")
    private LocalDate dataPagamento;
}
