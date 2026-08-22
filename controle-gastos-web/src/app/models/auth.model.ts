export interface CadastroRequest {
  nome: string;
  email: string;
  senha: string;
}

export interface LoginRequest {
  email: string;
  senha: string;
}

export interface LoginResponse {
  token: string;
  usuarioId: number;
  nome: string;
  email: string;
}

export interface UsuarioLogado {
  nome: string;
  email: string;
}
