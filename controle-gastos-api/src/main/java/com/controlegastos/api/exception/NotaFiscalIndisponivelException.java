package com.controlegastos.api.exception;

/**
 * Lançada quando não é possível extrair os dados de uma nota fiscal (NFC-e) -
 * página fora do ar, formato inesperado, ou a SEFAZ pediu uma validação de
 * segurança (captcha) que não pode ser resolvida automaticamente. Nunca indica
 * um erro do cliente (por isso não é IllegalArgumentException) - a URL em si
 * pode estar correta, só não foi possível ler o conteúdo dela agora.
 */
public class NotaFiscalIndisponivelException extends RuntimeException {
    public NotaFiscalIndisponivelException(String mensagem) {
        super(mensagem);
    }
}
