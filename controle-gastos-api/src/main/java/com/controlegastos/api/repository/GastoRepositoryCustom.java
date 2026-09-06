package com.controlegastos.api.repository;

import com.controlegastos.api.model.Gasto;

import java.util.List;

/**
 * Métodos de {@link GastoRepository} que não dão pra expressar como um método
 * derivado nem uma {@code @Query} JPQL. Spring Data acopla esta interface ao
 * repositório pelo {@code Impl} de mesmo prefixo ({@link GastoRepositoryCustomImpl}).
 */
public interface GastoRepositoryCustom {

    /**
     * Insere vários gastos numa tacada só (JDBC batch), sem passar pelo Hibernate.
     * Usado na pré-geração de gastos recorrentes (achado 2.3): a entidade
     * {@code Gasto} usa {@code GenerationType.IDENTITY}, que desliga o batching de
     * insert do Hibernate - então o lote é feito no nível do JDBC.
     *
     * <p>Não popula o id gerado de volta nos objetos (o chamador não precisa) e
     * <b>não</b> revalida os campos - quem monta a lista já resolveu categoria/
     * subcategoria e validou tudo uma vez.
     */
    void inserirEmLote(List<Gasto> gastos);
}
