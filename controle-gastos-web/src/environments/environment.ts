export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8080/api',
  // Client ID do OAuth do Google (Console Cloud > Credenciais) - NAO e segredo
  // (Client ID e publico por natureza, vai no HTML/JS servido ao navegador),
  // mas o valor abaixo e placeholder ate o Client ID de verdade ser criado.
  googleClientId: 'SUBSTITUIR_PELO_CLIENT_ID_REAL.apps.googleusercontent.com'
};
