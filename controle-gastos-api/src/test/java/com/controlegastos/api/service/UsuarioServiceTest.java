package com.controlegastos.api.service;

import com.controlegastos.api.dto.CadastroRequestDTO;
import com.controlegastos.api.dto.LoginRequestDTO;
import com.controlegastos.api.dto.LoginResponseDTO;
import com.controlegastos.api.dto.RendaDTO;
import com.controlegastos.api.exception.CredenciaisInvalidasException;
import com.controlegastos.api.exception.EmailJaCadastradoException;
import com.controlegastos.api.exception.RecursoNaoEncontradoException;
import com.controlegastos.api.exception.TokenInvalidoException;
import com.controlegastos.api.model.Usuario;
import com.controlegastos.api.repository.UsuarioRepository;
import com.controlegastos.api.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.MailSendException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Cobertura de UsuarioService - o fluxo de autenticação inteiro (cadastro, login,
 * esqueci-senha, redefinir-senha) mais atualizarRenda - Mockito puro, mesmo padrão
 * de OrcamentoServiceTest / GastoServiceTest (achado M4 da auditoria 2026-09-05:
 * o service não tinha nenhum teste; só JwtServiceTest cobria a geração do token,
 * não a lógica de negócio em volta).
 *
 * Foco: normalização e unicidade de e-mail no cadastro, verificação de senha e
 * mensagem genérica no login, o silêncio deliberado de esqueci-senha para e-mail
 * inexistente (e o engolir de falha de e-mail), a validade/expiração do token de
 * redefinição e o incremento de tokenVersion que desloga os JWTs antigos.
 */
class UsuarioServiceTest {

    private final UsuarioRepository repository = mock(UsuarioRepository.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final JwtService jwtService = mock(JwtService.class);
    private final EmailService emailService = mock(EmailService.class);

    private final UsuarioService service = new UsuarioService(
            repository, passwordEncoder, jwtService, emailService);

    @BeforeEach
    void stubsPadrao() {
        when(repository.findByEmailIgnoreCase(anyString())).thenReturn(Optional.empty());
        when(repository.save(any(Usuario.class))).thenAnswer(invocacao -> {
            Usuario u = invocacao.getArgument(0);
            if (u.getId() == null) {
                u.setId(42);
            }
            return u;
        });
        when(passwordEncoder.encode(anyString())).thenAnswer(invocacao -> "hash(" + invocacao.getArgument(0) + ")");
        when(jwtService.gerarToken(any(), anyString(), any())).thenReturn("jwt-de-teste");
    }

    private CadastroRequestDTO cadastroValido() {
        return new CadastroRequestDTO("  Léo  ", "  Leo@Example.com  ", "segredo123");
    }

    private Usuario usuarioExistente(String senhaHash) {
        Usuario u = new Usuario();
        u.setId(7);
        u.setNome("Léo");
        u.setEmail("leo@example.com");
        u.setSenha(senhaHash);
        u.setTokenVersion(3);
        u.setDataCriacao(LocalDateTime.now().minusDays(10));
        return u;
    }

    // ---------- cadastrar() ----------

    @Test
    void cadastrar_rejeitaNomeVazio() {
        CadastroRequestDTO dados = new CadastroRequestDTO("   ", "leo@example.com", "segredo123");

        assertThatThrownBy(() -> service.cadastrar(dados))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Nome não pode ser vazio");
    }

    @Test
    void cadastrar_rejeitaEmailSemArroba() {
        CadastroRequestDTO dados = new CadastroRequestDTO("Léo", "leo-example.com", "segredo123");

        assertThatThrownBy(() -> service.cadastrar(dados))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("E-mail inválido");
    }

    @Test
    void cadastrar_rejeitaSenhaComMenosDeSeisCaracteres() {
        CadastroRequestDTO dados = new CadastroRequestDTO("Léo", "leo@example.com", "12345");

        assertThatThrownBy(() -> service.cadastrar(dados))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("pelo menos 6 caracteres");
    }

    @Test
    void cadastrar_rejeitaEmailJaCadastradoSemSalvar() {
        when(repository.findByEmailIgnoreCase("leo@example.com")).thenReturn(Optional.of(usuarioExistente("hash")));

        assertThatThrownBy(() -> service.cadastrar(new CadastroRequestDTO("Léo", "leo@example.com", "segredo123")))
                .isInstanceOf(EmailJaCadastradoException.class);

        verify(repository, never()).save(any());
    }

    @Test
    void cadastrar_normalizaNomeEEmailECodificaSenhaComTokenVersionZero() {
        service.cadastrar(cadastroValido());

        ArgumentCaptor<Usuario> captor = ArgumentCaptor.forClass(Usuario.class);
        verify(repository).save(captor.capture());
        Usuario salvo = captor.getValue();
        assertThat(salvo.getNome()).isEqualTo("Léo");
        assertThat(salvo.getEmail()).isEqualTo("leo@example.com");
        assertThat(salvo.getSenha()).isEqualTo("hash(segredo123)");
        assertThat(salvo.getTokenVersion()).isZero();
        assertThat(salvo.getDataCriacao()).isNotNull();
    }

    @Test
    void cadastrar_retornaRespostaComOTokenEOsDadosDoUsuario() {
        when(jwtService.gerarToken(eq(42), eq("leo@example.com"), eq(0))).thenReturn("jwt-novo");

        LoginResponseDTO resposta = service.cadastrar(cadastroValido());

        assertThat(resposta.token()).isEqualTo("jwt-novo");
        assertThat(resposta.usuarioId()).isEqualTo(42);
        assertThat(resposta.email()).isEqualTo("leo@example.com");
    }

    // ---------- login() ----------

    @Test
    void login_rejeitaEmailInexistente() {
        assertThatThrownBy(() -> service.login(new LoginRequestDTO("naoexiste@example.com", "segredo123")))
                .isInstanceOf(CredenciaisInvalidasException.class)
                .hasMessageContaining("E-mail ou senha inválidos");
    }

    @Test
    void login_rejeitaSenhaIncorretaComAMesmaMensagemGenerica() {
        when(repository.findByEmailIgnoreCase("leo@example.com")).thenReturn(Optional.of(usuarioExistente("hash-correto")));
        when(passwordEncoder.matches("errada", "hash-correto")).thenReturn(false);

        assertThatThrownBy(() -> service.login(new LoginRequestDTO("leo@example.com", "errada")))
                .isInstanceOf(CredenciaisInvalidasException.class)
                .hasMessageContaining("E-mail ou senha inválidos");
    }

    @Test
    void login_rejeitaSenhaNulaSemConsultarOEncoder() {
        when(repository.findByEmailIgnoreCase("leo@example.com")).thenReturn(Optional.of(usuarioExistente("hash")));

        assertThatThrownBy(() -> service.login(new LoginRequestDTO("leo@example.com", null)))
                .isInstanceOf(CredenciaisInvalidasException.class);

        verify(passwordEncoder, never()).matches(any(), any());
    }

    @Test
    void login_trataEmailNuloSemQuebrar() {
        assertThatThrownBy(() -> service.login(new LoginRequestDTO(null, "segredo123")))
                .isInstanceOf(CredenciaisInvalidasException.class);

        verify(repository).findByEmailIgnoreCase("");
    }

    @Test
    void login_aceitaCredenciaisValidasERetornaToken() {
        Usuario usuario = usuarioExistente("hash-correto");
        when(repository.findByEmailIgnoreCase("leo@example.com")).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches("segredo123", "hash-correto")).thenReturn(true);
        when(jwtService.gerarToken(7, "leo@example.com", 3)).thenReturn("jwt-login");

        LoginResponseDTO resposta = service.login(new LoginRequestDTO("  leo@example.com ", "segredo123"));

        assertThat(resposta.token()).isEqualTo("jwt-login");
        assertThat(resposta.usuarioId()).isEqualTo(7);
    }

    // ---------- esqueciSenha() ----------

    @Test
    void esqueciSenha_emailNuloOuEmBrancoNaoFazNada() {
        service.esqueciSenha(null);
        service.esqueciSenha("   ");

        verify(repository, never()).findByEmailIgnoreCase(any());
        verify(repository, never()).save(any());
    }

    @Test
    void esqueciSenha_emailInexistenteNaoGravaNemEnvia() {
        service.esqueciSenha("naoexiste@example.com");

        verify(repository, never()).save(any());
        verify(emailService, never()).enviarEmailRedefinicaoSenha(any(), any(), any());
    }

    @Test
    void esqueciSenha_emailExistenteGravaTokenComExpiracaoDeUmaHoraEEnvia() {
        Usuario usuario = usuarioExistente("hash");
        when(repository.findByEmailIgnoreCase("leo@example.com")).thenReturn(Optional.of(usuario));
        LocalDateTime antes = LocalDateTime.now();

        service.esqueciSenha("  leo@example.com ");

        ArgumentCaptor<Usuario> captor = ArgumentCaptor.forClass(Usuario.class);
        verify(repository).save(captor.capture());
        Usuario salvo = captor.getValue();
        assertThat(salvo.getTokenRedefinicaoSenha()).isNotBlank();
        assertThat(salvo.getTokenRedefinicaoExpiracao())
                .isAfter(antes.plusMinutes(59))
                .isBefore(antes.plusMinutes(61));
        verify(emailService).enviarEmailRedefinicaoSenha(
                eq("leo@example.com"), eq("Léo"), eq(salvo.getTokenRedefinicaoSenha()));
    }

    @Test
    void esqueciSenha_falhaDeEnvioDeEmailNaoPropaga() {
        Usuario usuario = usuarioExistente("hash");
        when(repository.findByEmailIgnoreCase("leo@example.com")).thenReturn(Optional.of(usuario));
        doThrow(new MailSendException("SMTP fora do ar"))
                .when(emailService).enviarEmailRedefinicaoSenha(any(), any(), any());

        assertThatCode(() -> service.esqueciSenha("leo@example.com")).doesNotThrowAnyException();

        verify(repository).save(any());
    }

    // ---------- redefinirSenha() ----------

    @Test
    void redefinirSenha_rejeitaTokenNuloOuVazio() {
        assertThatThrownBy(() -> service.redefinirSenha(null, "novasenha1"))
                .isInstanceOf(TokenInvalidoException.class);
        assertThatThrownBy(() -> service.redefinirSenha("  ", "novasenha1"))
                .isInstanceOf(TokenInvalidoException.class);
    }

    @Test
    void redefinirSenha_rejeitaTokenInexistente() {
        when(repository.findByTokenRedefinicaoSenha("tok")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.redefinirSenha("tok", "novasenha1"))
                .isInstanceOf(TokenInvalidoException.class)
                .hasMessageContaining("inválido ou já utilizado");
    }

    @Test
    void redefinirSenha_rejeitaTokenExpiradoSemTrocarSenha() {
        Usuario usuario = usuarioExistente("hash-antigo");
        usuario.setTokenRedefinicaoSenha("tok");
        usuario.setTokenRedefinicaoExpiracao(LocalDateTime.now().minusMinutes(1));
        when(repository.findByTokenRedefinicaoSenha("tok")).thenReturn(Optional.of(usuario));

        assertThatThrownBy(() -> service.redefinirSenha("tok", "novasenha1"))
                .isInstanceOf(TokenInvalidoException.class)
                .hasMessageContaining("expirado");

        verify(repository, never()).save(any());
    }

    @Test
    void redefinirSenha_rejeitaTokenSemExpiracaoDefinida() {
        Usuario usuario = usuarioExistente("hash-antigo");
        usuario.setTokenRedefinicaoSenha("tok");
        usuario.setTokenRedefinicaoExpiracao(null);
        when(repository.findByTokenRedefinicaoSenha("tok")).thenReturn(Optional.of(usuario));

        assertThatThrownBy(() -> service.redefinirSenha("tok", "novasenha1"))
                .isInstanceOf(TokenInvalidoException.class);
    }

    @Test
    void redefinirSenha_rejeitaNovaSenhaCurtaSemSalvar() {
        Usuario usuario = usuarioExistente("hash-antigo");
        usuario.setTokenRedefinicaoSenha("tok");
        usuario.setTokenRedefinicaoExpiracao(LocalDateTime.now().plusMinutes(30));
        when(repository.findByTokenRedefinicaoSenha("tok")).thenReturn(Optional.of(usuario));

        assertThatThrownBy(() -> service.redefinirSenha("tok", "curta"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("pelo menos 6 caracteres");

        verify(repository, never()).save(any());
    }

    @Test
    void redefinirSenha_trocaSenhaLimpaOTokenEIncrementaTokenVersion() {
        Usuario usuario = usuarioExistente("hash-antigo");
        usuario.setTokenRedefinicaoSenha("tok");
        usuario.setTokenRedefinicaoExpiracao(LocalDateTime.now().plusMinutes(30));
        when(repository.findByTokenRedefinicaoSenha("tok")).thenReturn(Optional.of(usuario));

        service.redefinirSenha("tok", "novasenha1");

        ArgumentCaptor<Usuario> captor = ArgumentCaptor.forClass(Usuario.class);
        verify(repository).save(captor.capture());
        Usuario salvo = captor.getValue();
        assertThat(salvo.getSenha()).isEqualTo("hash(novasenha1)");
        assertThat(salvo.getTokenRedefinicaoSenha()).isNull();
        assertThat(salvo.getTokenRedefinicaoExpiracao()).isNull();
        assertThat(salvo.getTokenVersion()).isEqualTo(4); // era 3
    }

    // ---------- atualizarRenda() ----------

    @Test
    void atualizarRenda_rejeitaValorNuloOuNaoPositivo() {
        assertThatThrownBy(() -> service.atualizarRenda(null, 7))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.atualizarRenda(BigDecimal.ZERO, 7))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.atualizarRenda(new BigDecimal("-10"), 7))
                .isInstanceOf(IllegalArgumentException.class);
        verify(repository, never()).save(any());
    }

    @Test
    void atualizarRenda_rejeitaUsuarioInexistente() {
        when(repository.findById(99)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.atualizarRenda(new BigDecimal("3000"), 99))
                .isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void atualizarRenda_gravaERetornaARenda() {
        Usuario usuario = usuarioExistente("hash");
        when(repository.findById(7)).thenReturn(Optional.of(usuario));

        RendaDTO resposta = service.atualizarRenda(new BigDecimal("3000.00"), 7);

        assertThat(resposta.rendaMensal()).isEqualByComparingTo("3000.00");
        ArgumentCaptor<Usuario> captor = ArgumentCaptor.forClass(Usuario.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getRendaMensal()).isEqualByComparingTo("3000.00");
    }
}
