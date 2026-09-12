export const environment = {
  production: true,
  apiBaseUrl: 'https://controle-gastos-leo.duckdns.org/api',
  // Client ID do OAuth do Google (Console Cloud > Credenciais) - NAO e segredo,
  // mas o valor abaixo e placeholder ate o Client ID de verdade ser criado.
  // Igual a apiBaseUrl acima: build estatico (Render Static Site) nao tem env
  // var em runtime, entao o valor vai hardcoded aqui mesmo (nao em arquivo
  // versionado separado nem em variavel de ambiente).
  googleClientId: 'SUBSTITUIR_PELO_CLIENT_ID_REAL.apps.googleusercontent.com'
};
