package com.controlegastos.api.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Um gasto fixo que deve ser lançado automaticamente todo mês, no dia
 * configurado (diaDoMes) - ver GastoRecorrenteService.lancarPendentes.
 */
@Entity
@Table(name = "gastos_recorrentes")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GastoRecorrente {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 150)
    private String descricao;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal valor;

    @Column(name = "categoria_id", nullable = false)
    private Integer categoriaId;

    @Column(name = "subcategoria_id")
    private Integer subcategoriaId;

    // 1-31. Em meses com menos dias (ex: fevereiro), o lançamento cai no último dia
    // válido do mês - ver GastoRecorrenteService.dataDoLancamento.
    @Column(name = "dia_do_mes", nullable = false)
    private Integer diaDoMes;

    @Column(name = "orcamento_id")
    private Integer orcamentoId;

    // Boolean (não boolean primitivo) de propósito: com um construtor @AllArgsConstructor
    // presente, o Jackson usa esse construtor pra desserializar o corpo da requisição, e um
    // campo primitivo não aceita ficar de fora do JSON (o que sempre acontece aqui - "ativo"
    // é sempre definido no servidor, nunca enviado pelo cliente ao criar/editar).
    @Column(nullable = false)
    private Boolean ativo;

    @Column(name = "usuario_id", nullable = false)
    private Integer usuarioId;

    @Column(name = "data_criacao", nullable = false)
    private LocalDateTime dataCriacao;
}
