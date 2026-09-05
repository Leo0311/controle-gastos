package com.controlegastos.api.exception;

/**
 * Lançada quando uma criação de gasto com deduplicação pedida (importação de
 * planilha) esbarra num gasto logicamente idêntico já cadastrado (achado M6).
 * Mapeada para 409 no {@link GlobalExceptionHandler}.
 */
public class GastoDuplicadoException extends RuntimeException {
    public GastoDuplicadoException(String mensagem) {
        super(mensagem);
    }
}
