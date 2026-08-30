import { Categoria, Subcategoria } from '../../../models/categoria.model';
import { normalizarDescricao, SugestaoCategoria } from './sugestao-categoria';

/**
 * Plano B da auto-categorização. Quando o histórico pessoal do usuário não
 * indica nada (ver `calcularSugestaoCategoria`), tenta casar a descrição digitada
 * contra este dicionário de palavras-chave comuns em português, sempre apontando
 * para categoria/subcategoria **padrão do sistema** — garantidas existir para
 * todo usuário. O histórico pessoal SEMPRE tem prioridade; este dicionário só
 * entra quando ele não encontra nada.
 *
 * Para editar depois: cada entrada liga uma lista de `termos` a um par
 * categoria/subcategoria do sistema, com os nomes EXATOS como estão no
 * `schema.sql` (a resolução ignora acento e caixa, mas não erros de digitação).
 * Um termo de uma palavra só casa como palavra inteira ("cafe" não casa dentro
 * de "cafeteria" — inclua "cafeteria" à parte); um termo com espaço casa como
 * trecho contíguo ("cafe da manha").
 */
export interface EntradaDicionario {
  termos: string[];
  categoria: string;
  subcategoria: string;
}

export const DICIONARIO_CATEGORIAS: EntradaDicionario[] = [
  // Alimentação
  {
    termos: ['cafe', 'cafe da manha', 'cafezinho', 'cafeteria', 'lanche', 'lanchonete', 'padoca'],
    categoria: 'Alimentação',
    subcategoria: 'Cafés e lanches'
  },
  {
    termos: ['almoco', 'jantar', 'restaurante', 'refeicao', 'marmita', 'self service', 'rodizio'],
    categoria: 'Alimentação',
    subcategoria: 'Restaurantes'
  },
  {
    termos: ['mercado', 'supermercado', 'feira', 'hortifruti', 'sacolao', 'acougue', 'compras do mes'],
    categoria: 'Alimentação',
    subcategoria: 'Mercado'
  },
  {
    termos: ['delivery', 'ifood', 'rappi', 'uber eats', 'aiqfome'],
    categoria: 'Alimentação',
    subcategoria: 'Delivery'
  },
  { termos: ['padaria', 'pao', 'panificadora'], categoria: 'Alimentação', subcategoria: 'Padaria' },

  // Transporte
  {
    termos: ['uber', '99', 'taxi', 'corrida', 'cabify', '99pop', '99 pop'],
    categoria: 'Transporte',
    subcategoria: 'Uber/Táxi'
  },
  {
    termos: ['gasolina', 'combustivel', 'posto', 'etanol', 'alcool', 'diesel', 'abastecer', 'abastecimento'],
    categoria: 'Transporte',
    subcategoria: 'Combustível'
  },
  {
    termos: ['onibus', 'metro', 'bilhete unico', 'passagem', 'brt', 'trem', 'bilhete'],
    categoria: 'Transporte',
    subcategoria: 'Transporte público'
  },
  {
    termos: ['estacionamento', 'zona azul', 'pedagio', 'sem parar', 'valet'],
    categoria: 'Transporte',
    subcategoria: 'Estacionamento'
  },

  // Saúde
  {
    termos: ['farmacia', 'remedio', 'medicamento', 'drogaria', 'drogasil', 'droga raia'],
    categoria: 'Saúde',
    subcategoria: 'Medicamentos'
  },
  { termos: ['medico', 'consulta', 'dentista', 'psicologo', 'terapia'], categoria: 'Saúde', subcategoria: 'Consultas' },
  { termos: ['exame', 'laboratorio', 'raio x', 'ultrassom', 'tomografia'], categoria: 'Saúde', subcategoria: 'Exames' },
  { termos: ['academia', 'gym', 'crossfit', 'personal', 'musculacao'], categoria: 'Saúde', subcategoria: 'Academia' },
  { termos: ['plano de saude', 'convenio', 'unimed', 'amil'], categoria: 'Saúde', subcategoria: 'Plano de saúde' },

  // Moradia
  { termos: ['aluguel'], categoria: 'Moradia', subcategoria: 'Aluguel' },
  { termos: ['condominio'], categoria: 'Moradia', subcategoria: 'Condomínio' },
  {
    termos: ['luz', 'energia', 'energia eletrica', 'conta de luz', 'cemig', 'enel', 'light', 'cpfl', 'copel'],
    categoria: 'Moradia',
    subcategoria: 'Energia elétrica'
  },
  {
    termos: ['agua', 'conta de agua', 'saneamento', 'sabesp', 'copasa', 'sanepar', 'cedae'],
    categoria: 'Moradia',
    subcategoria: 'Água'
  },
  { termos: ['gas', 'botijao', 'gas de cozinha', 'comgas', 'ultragaz'], categoria: 'Moradia', subcategoria: 'Gás' },
  { termos: ['iptu'], categoria: 'Moradia', subcategoria: 'IPTU' },

  // Contas e serviços
  { termos: ['internet', 'wifi', 'banda larga', 'fibra', 'vivo fibra'], categoria: 'Contas e serviços', subcategoria: 'Internet' },
  {
    termos: ['celular', 'telefone', 'recarga', 'plano do celular', 'vivo', 'claro', 'tim', 'oi'],
    categoria: 'Contas e serviços',
    subcategoria: 'Celular'
  },
  {
    termos: ['netflix', 'spotify', 'streaming', 'disney', 'prime video', 'hbo', 'globoplay', 'youtube premium', 'deezer'],
    categoria: 'Contas e serviços',
    subcategoria: 'Streaming'
  },

  // Lazer
  { termos: ['cinema', 'filme', 'ingresso'], categoria: 'Lazer', subcategoria: 'Cinema' },
  { termos: ['jogo', 'game', 'steam', 'playstation', 'xbox', 'nintendo'], categoria: 'Lazer', subcategoria: 'Jogos' },
  { termos: ['show', 'festival'], categoria: 'Lazer', subcategoria: 'Shows' },
  { termos: ['bar', 'cerveja', 'chopp', 'boteco', 'happy hour'], categoria: 'Lazer', subcategoria: 'Bares' },

  // Educação
  { termos: ['curso', 'faculdade', 'mensalidade', 'escola', 'colegio', 'udemy', 'alura'], categoria: 'Educação', subcategoria: 'Cursos' },
  { termos: ['livro', 'livraria', 'ebook'], categoria: 'Educação', subcategoria: 'Livros' },

  // Compras
  { termos: ['roupa', 'camisa', 'calca', 'vestido', 'blusa', 'loja de roupa'], categoria: 'Compras', subcategoria: 'Roupas' },
  { termos: ['calcado', 'tenis', 'sapato', 'sandalia', 'chinelo'], categoria: 'Compras', subcategoria: 'Calçados' },
  { termos: ['presente', 'lembrancinha'], categoria: 'Compras', subcategoria: 'Presentes' },
  { termos: ['eletronico', 'fone', 'notebook', 'carregador', 'mouse', 'teclado'], categoria: 'Compras', subcategoria: 'Eletrônicos' }
];

/**
 * Tenta sugerir uma combinação categoria+subcategoria do SISTEMA a partir do
 * dicionário de palavras-chave. Recebe as listas de categorias/subcategorias já
 * carregadas pela tela para resolver os nomes do dicionário em IDs reais.
 *
 * Em caso de vários termos casando, vence o mais específico (mais longo). Devolve
 * `null` quando nada casa ou quando a categoria/subcategoria do dicionário não
 * foi encontrada entre as do sistema (nome divergente, lista ainda carregando).
 */
export function sugerirPorDicionario(
  texto: string,
  categorias: Categoria[],
  subcategorias: Subcategoria[]
): SugestaoCategoria | null {
  const alvo = normalizarDescricao(texto);
  if (alvo.length < 2) {
    return null;
  }
  const palavras = new Set(alvo.split(/[^a-z0-9]+/).filter(Boolean));

  let melhorEntrada: EntradaDicionario | null = null;
  let melhorTamanho = 0;
  for (const entrada of DICIONARIO_CATEGORIAS) {
    for (const termoBruto of entrada.termos) {
      const termo = normalizarDescricao(termoBruto);
      if (termoCasa(termo, alvo, palavras) && termo.length > melhorTamanho) {
        melhorEntrada = entrada;
        melhorTamanho = termo.length;
      }
    }
  }
  if (!melhorEntrada) {
    return null;
  }

  const alvoCategoria = normalizarDescricao(melhorEntrada.categoria);
  const categoria = categorias.find((c) => c.usuarioId == null && normalizarDescricao(c.nome) === alvoCategoria);
  if (!categoria?.id) {
    return null;
  }

  const alvoSubcategoria = normalizarDescricao(melhorEntrada.subcategoria);
  const subcategoria = subcategorias.find(
    (s) => s.usuarioId == null && s.categoriaId === categoria.id && normalizarDescricao(s.nome) === alvoSubcategoria
  );
  return { categoriaId: categoria.id, subcategoriaId: subcategoria?.id ?? null };
}

/**
 * Termo com espaço precisa aparecer como trecho contíguo na descrição; termo de
 * uma palavra só casa como palavra inteira (evita "agua" casar em "aguardar").
 */
function termoCasa(termo: string, alvo: string, palavras: Set<string>): boolean {
  return termo.includes(' ') ? alvo.includes(termo) : palavras.has(termo);
}
