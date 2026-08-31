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
 * de "cafeteria" — inclua "cafeteria" à parte); um termo com várias palavras casa
 * como trecho contíguo ("cafe da manha"). Hífen conta como espaço, então tanto
 * faz "lava jato" ou "lava-jato". Quando vários termos casam, vence o mais
 * específico (o mais longo).
 *
 * Se a `subcategoria` não existir naquela categoria do sistema (ex.: Transporte
 * não tem "Outros"), a sugestão degrada pra só a categoria — não quebra.
 */
export interface EntradaDicionario {
  termos: string[];
  categoria: string;
  subcategoria: string;
}

export const DICIONARIO_CATEGORIAS: EntradaDicionario[] = [
  // ─── Alimentação ────────────────────────────────────────────────────────────
  {
    termos: [
      'cafe', 'cafe da manha', 'cafezinho', 'cafeteria', 'starbucks',
      'lanche', 'lanchonete', 'padoca', 'salgado', 'salgados', 'pastel', 'pastelaria',
      'coxinha', 'esfiha', 'esfirra', 'sanduiche', 'sanduba', 'misto quente',
      'acai', 'sorvete', 'sorveteria', 'milkshake', 'picole',
      'doce', 'doceria', 'confeitaria', 'bolo', 'brigadeiro', 'cupcake', 'pipoca'
    ],
    categoria: 'Alimentação',
    subcategoria: 'Cafés e lanches'
  },
  {
    termos: [
      'almoco', 'jantar', 'janta', 'restaurante', 'refeicao', 'marmita',
      'self service', 'buffet', 'rodizio', 'a la carte',
      'prato feito', 'pf', 'comida japonesa', 'japones', 'sushi', 'temaki', 'sashimi',
      'yakisoba', 'pizza', 'pizzaria', 'hamburguer', 'hamburgueria', 'x-burguer', 'xis',
      'churrasco', 'churrascaria', 'espetinho', 'espeto', 'feijoada', 'lasanha',
      'comida arabe', 'comida mexicana', 'praca de alimentacao'
    ],
    categoria: 'Alimentação',
    subcategoria: 'Restaurantes'
  },
  {
    termos: [
      'mercado', 'supermercado', 'feira', 'feira livre', 'hortifruti', 'sacolao',
      'acougue', 'mercearia', 'quitanda', 'emporio', 'atacado', 'atacadao',
      'assai', 'carrefour', 'pao de acucar', 'compras do mes', 'compra do mes',
      'rancho', 'compras do mercado',
      // Frutas
      'fruta', 'frutas', 'morango', 'melancia', 'uva', 'melao', 'banana', 'maca',
      'laranja', 'mamao', 'abacaxi', 'manga', 'pera', 'kiwi', 'abacate', 'goiaba',
      'maracuja', 'limao', 'tangerina', 'mexerica', 'ameixa', 'caqui', 'figo',
      'acerola', 'pessego', 'cereja', 'jabuticaba',
      // Verduras, legumes e itens de despensa
      'verdura', 'verduras', 'legume', 'legumes', 'tomate', 'cebola', 'batata',
      'cenoura', 'alface', 'brocolis', 'abobrinha', 'ovos', 'ovo', 'leite', 'arroz',
      'feijao', 'macarrao', 'farinha', 'acucar', 'oleo', 'cafe em po', 'carne',
      'frango', 'frango assado', 'peixe', 'linguica'
    ],
    categoria: 'Alimentação',
    subcategoria: 'Mercado'
  },
  {
    termos: [
      'delivery', 'ifood', 'rappi', 'uber eats', 'aiqfome', 'ze delivery',
      'james delivery', 'tele entrega', 'entrega de comida'
    ],
    categoria: 'Alimentação',
    subcategoria: 'Delivery'
  },
  {
    termos: ['padaria', 'pao', 'pao frances', 'pao de queijo', 'panificadora', 'panetteria'],
    categoria: 'Alimentação',
    subcategoria: 'Padaria'
  },
  {
    termos: ['refrigerante', 'refri', 'suco', 'agua de coco', 'energetico', 'coca cola', 'guarana'],
    categoria: 'Alimentação',
    subcategoria: 'Bebidas'
  },

  // ─── Transporte ─────────────────────────────────────────────────────────────
  {
    termos: [
      'uber', '99', '99pop', '99 pop', 'taxi', 'corrida', 'corrida de app',
      'cabify', 'indriver', 'motorista particular', 'aplicativo de transporte'
    ],
    categoria: 'Transporte',
    subcategoria: 'Uber/Táxi'
  },
  {
    termos: [
      'gasolina', 'combustivel', 'posto', 'posto de gasolina', 'etanol', 'alcool',
      'diesel', 'gnv', 'abastecer', 'abastecimento', 'encher o tanque',
      'shell', 'ipiranga', 'petrobras'
    ],
    categoria: 'Transporte',
    subcategoria: 'Combustível'
  },
  {
    termos: [
      'onibus', 'metro', 'trem', 'brt', 'vlt', 'cptm', 'bilhete unico', 'bilhete',
      'passagem de onibus', 'cartao de transporte', 'transporte publico',
      'riocard', 'bilhete metro', 'sptrans'
    ],
    categoria: 'Transporte',
    subcategoria: 'Transporte público'
  },
  {
    termos: ['estacionamento', 'zona azul', 'vaga', 'valet', 'estapar', 'estacionar'],
    categoria: 'Transporte',
    subcategoria: 'Estacionamento'
  },
  {
    termos: [
      'seguro do carro', 'seguro auto', 'seguro do automovel', 'seguro do veiculo',
      'seguro veicular', 'seguro do veiculo'
    ],
    categoria: 'Transporte',
    subcategoria: 'Seguro'
  },
  {
    termos: [
      'mecanico', 'oficina', 'oficina mecanica', 'revisao do carro', 'troca de oleo',
      'alinhamento', 'balanceamento', 'pastilha de freio', 'funilaria', 'auto center'
    ],
    categoria: 'Transporte',
    subcategoria: 'Manutenção'
  },
  { termos: ['pneu', 'pneus', 'borracharia', 'calibragem'], categoria: 'Transporte', subcategoria: 'Pneus' },
  { termos: ['ipva'], categoria: 'Transporte', subcategoria: 'IPVA' },
  { termos: ['licenciamento', 'crlv', 'detran'], categoria: 'Transporte', subcategoria: 'Licenciamento' },
  { termos: ['lava jato', 'lavagem do carro', 'lavar o carro'], categoria: 'Transporte', subcategoria: 'Lavagem' },
  // "Outros" não existe em Transporte -> vira sugestão só da categoria.
  {
    termos: ['pedagio', 'sem parar', 'conectcar', 'veloe', 'tag de pedagio', 'praca de pedagio'],
    categoria: 'Transporte',
    subcategoria: 'Outros'
  },

  // ─── Saúde ──────────────────────────────────────────────────────────────────
  {
    termos: [
      'farmacia', 'remedio', 'medicamento', 'drogaria', 'drogasil', 'droga raia',
      'pacheco', 'pague menos', 'generico', 'antibiotico', 'vitamina', 'dipirona'
    ],
    categoria: 'Saúde',
    subcategoria: 'Medicamentos'
  },
  {
    termos: [
      'medico', 'consulta', 'consulta medica', 'psicologo', 'psiquiatra', 'terapia',
      'fisioterapia', 'nutricionista', 'dermatologista', 'cardiologista', 'pediatra',
      'ginecologista'
    ],
    categoria: 'Saúde',
    subcategoria: 'Consultas'
  },
  { termos: ['dentista', 'ortodontista', 'aparelho nos dentes', 'canal', 'clareamento dental'], categoria: 'Saúde', subcategoria: 'Dentista' },
  { termos: ['oculos', 'oculos de grau', 'lentes de contato', 'armacao', 'otica', 'oculos escuros'], categoria: 'Saúde', subcategoria: 'Óculos' },
  {
    termos: [
      'exame', 'exames', 'laboratorio', 'hemograma', 'raio x', 'ultrassom',
      'tomografia', 'ressonancia', 'endoscopia', 'checkup', 'exame de sangue'
    ],
    categoria: 'Saúde',
    subcategoria: 'Exames'
  },
  {
    termos: [
      'academia', 'gym', 'crossfit', 'personal', 'personal trainer', 'musculacao',
      'pilates', 'funcional', 'smartfit', 'smart fit', 'bluefit', 'bioritmo', 'yoga'
    ],
    categoria: 'Saúde',
    subcategoria: 'Academia'
  },
  {
    termos: [
      'plano de saude', 'convenio', 'convenio medico', 'unimed', 'amil', 'hapvida',
      'sulamerica', 'notredame', 'bradesco saude', 'mensalidade do plano'
    ],
    categoria: 'Saúde',
    subcategoria: 'Plano de saúde'
  },

  // ─── Moradia ────────────────────────────────────────────────────────────────
  { termos: ['aluguel', 'aluguel do apartamento', 'aluguel da casa'], categoria: 'Moradia', subcategoria: 'Aluguel' },
  { termos: ['condominio', 'taxa de condominio', 'boleto do condominio'], categoria: 'Moradia', subcategoria: 'Condomínio' },
  {
    termos: [
      'luz', 'energia', 'energia eletrica', 'conta de luz', 'conta de energia',
      'cemig', 'enel', 'light', 'cpfl', 'copel', 'celesc', 'coelba', 'energisa', 'equatorial'
    ],
    categoria: 'Moradia',
    subcategoria: 'Energia elétrica'
  },
  {
    termos: [
      'agua', 'conta de agua', 'saneamento', 'sabesp', 'copasa', 'sanepar',
      'cedae', 'caesb', 'embasa', 'aegea'
    ],
    categoria: 'Moradia',
    subcategoria: 'Água'
  },
  { termos: ['gas', 'botijao', 'gas de cozinha', 'comgas', 'ultragaz', 'liquigas', 'gas encanado'], categoria: 'Moradia', subcategoria: 'Gás' },
  { termos: ['iptu', 'imposto do imovel'], categoria: 'Moradia', subcategoria: 'IPTU' },
  {
    termos: [
      'encanador', 'eletricista', 'pedreiro', 'reforma', 'pintura da casa',
      'conserto em casa', 'marido de aluguel', 'chaveiro', 'dedetizacao'
    ],
    categoria: 'Moradia',
    subcategoria: 'Manutenção'
  },
  { termos: ['sofa', 'guarda roupa', 'mesa de jantar', 'estante', 'colchao', 'cama box'], categoria: 'Moradia', subcategoria: 'Móveis' },
  {
    termos: [
      'geladeira', 'fogao', 'microondas', 'micro-ondas', 'maquina de lavar',
      'lava e seca', 'ar condicionado', 'ventilador', 'air fryer', 'airfryer', 'cafeteira'
    ],
    categoria: 'Moradia',
    subcategoria: 'Eletrodomésticos'
  },
  {
    termos: [
      'produto de limpeza', 'produtos de limpeza', 'detergente', 'sabao', 'amaciante',
      'desinfetante', 'agua sanitaria', 'papel higienico', 'esponja', 'saco de lixo'
    ],
    categoria: 'Moradia',
    subcategoria: 'Produtos de limpeza'
  },

  // ─── Contas e serviços ──────────────────────────────────────────────────────
  {
    termos: [
      'internet', 'wifi', 'banda larga', 'fibra', 'vivo fibra', 'net virtua',
      'oi fibra', 'claro net', 'gvt', 'conta de internet'
    ],
    categoria: 'Contas e serviços',
    subcategoria: 'Internet'
  },
  {
    termos: [
      'celular', 'telefone', 'recarga', 'plano do celular', 'conta do celular',
      'credito do celular', 'vivo', 'claro', 'tim', 'oi'
    ],
    categoria: 'Contas e serviços',
    subcategoria: 'Celular'
  },
  {
    termos: [
      'netflix', 'spotify', 'streaming', 'disney', 'disney plus', 'amazon prime',
      'prime video', 'hbo', 'hbo max', 'max', 'globoplay', 'youtube premium',
      'deezer', 'paramount', 'star plus', 'apple tv', 'crunchyroll', 'telecine', 'assinatura'
    ],
    categoria: 'Contas e serviços',
    subcategoria: 'Streaming'
  },
  { termos: ['tv a cabo', 'sky', 'claro tv', 'net tv'], categoria: 'Contas e serviços', subcategoria: 'TV' },
  {
    termos: [
      'tarifa bancaria', 'taxa do banco', 'anuidade do cartao', 'anuidade', 'iof',
      'juros do cheque especial', 'tarifa de manutencao de conta'
    ],
    categoria: 'Contas e serviços',
    subcategoria: 'Tarifas bancárias'
  },
  {
    termos: [
      'icloud', 'google one', 'dropbox', 'chatgpt', 'openai', 'notion', 'canva',
      'adobe', 'office 365', 'microsoft 365', 'github'
    ],
    categoria: 'Contas e serviços',
    subcategoria: 'Serviços online'
  },

  // ─── Lazer ──────────────────────────────────────────────────────────────────
  { termos: ['cinema', 'filme', 'ingresso', 'sessao de cinema', 'cinemark'], categoria: 'Lazer', subcategoria: 'Cinema' },
  {
    termos: [
      'jogo', 'game', 'games', 'steam', 'playstation', 'ps5', 'ps4', 'xbox',
      'nintendo', 'game pass', 'jogo online', 'skin'
    ],
    categoria: 'Lazer',
    subcategoria: 'Jogos'
  },
  { termos: ['show', 'festival', 'concerto', 'rock in rio', 'lollapalooza'], categoria: 'Lazer', subcategoria: 'Shows' },
  {
    termos: [
      'bar', 'cerveja', 'chopp', 'chope', 'boteco', 'botequim', 'happy hour',
      'balada', 'drinks', 'drink', 'pub', 'cervejaria', 'caipirinha',
      'cachaca', 'pinga', 'gin tonica', 'aperol', 'negroni', 'whisky', 'vodka',
      'tequila', 'sake', 'long neck', 'lata de cerveja', 'brahma', 'heineken',
      // Petiscos de bar
      'petisco', 'petiscos', 'tira gosto', 'fritas', 'batata frita', 'frango frito',
      'porcao', 'porcoes', 'iscas de peixe', 'bolinho de bacalhau', 'calabresa acebolada'
    ],
    categoria: 'Lazer',
    subcategoria: 'Bares'
  },
  { termos: ['parque', 'zoologico', 'museu', 'exposicao', 'teatro', 'passeio', 'parque de diversoes'], categoria: 'Lazer', subcategoria: 'Passeios' },
  {
    termos: [
      'boliche', 'quadra', 'aluguel de quadra', 'futebol', 'futsal', 'society', 'pelada',
      'bola', 'volei', 'voleibol', 'futevolei', 'beach tennis', 'basquete', 'basquetebol',
      'handebol', 'natacao', 'nadar', 'ciclismo', 'pedalada', 'bike', 'skate', 'surf',
      'escalada', 'boxe', 'jiu jitsu', 'jiujitsu', 'muay thai', 'judo', 'karate',
      'tenis de mesa', 'ping pong', 'aula de tenis', 'quadra de tenis', 'jogar tenis',
      'corrida de rua', 'corrida na esteira', 'maratona', 'meia maratona',
      'xadrez', 'damas', 'gamao', 'jogo de tabuleiro', 'tabuleiro', 'truco', 'domino'
    ],
    categoria: 'Lazer',
    subcategoria: 'Esportes'
  },

  // ─── Educação ───────────────────────────────────────────────────────────────
  {
    termos: [
      'curso', 'curso online', 'udemy', 'alura', 'coursera', 'aula particular',
      'professor particular', 'reforco escolar', 'preparatorio'
    ],
    categoria: 'Educação',
    subcategoria: 'Cursos'
  },
  {
    termos: ['faculdade', 'mensalidade da faculdade', 'semestre', 'pos graduacao', 'mba', 'cursinho'],
    categoria: 'Educação',
    subcategoria: 'Faculdade'
  },
  { termos: ['escola', 'colegio', 'mensalidade escolar', 'matricula escolar', 'creche'], categoria: 'Educação', subcategoria: 'Escola' },
  { termos: ['livro', 'livraria', 'ebook', 'apostila'], categoria: 'Educação', subcategoria: 'Livros' },
  { termos: ['material escolar', 'caderno', 'mochila escolar', 'papelaria', 'lapis de cor'], categoria: 'Educação', subcategoria: 'Material escolar' },
  { termos: ['ingles', 'espanhol', 'curso de ingles', 'aula de ingles', 'wizard', 'ccaa', 'cultura inglesa', 'fisk'], categoria: 'Educação', subcategoria: 'Idiomas' },

  // ─── Compras ────────────────────────────────────────────────────────────────
  {
    termos: [
      'roupa', 'roupas', 'camisa', 'camiseta', 'calca', 'jaqueta', 'casaco',
      'blusa', 'vestido', 'saia', 'bermuda', 'moletom', 'loja de roupa', 'loja', 'renner', 'riachuelo', 'zara'
    ],
    categoria: 'Compras',
    subcategoria: 'Roupas'
  },
  {
    termos: ['calcado', 'tenis', 'sapato', 'sandalia', 'chinelo', 'bota', 'sapatilha', 'havaianas'],
    categoria: 'Compras',
    subcategoria: 'Calçados'
  },
  {
    termos: [
      'presente', 'presentes', 'lembrancinha', 'aniversario', 'dia das maes',
      'dia dos pais', 'natal', 'amigo secreto', 'amigo oculto'
    ],
    categoria: 'Compras',
    subcategoria: 'Presentes'
  },
  {
    termos: [
      'eletronico', 'celular novo', 'smartphone', 'notebook', 'computador', 'pc',
      'monitor', 'fone', 'fone de ouvido', 'headphone', 'mouse', 'teclado',
      'tablet', 'ipad', 'smartwatch', 'kindle', 'caixa de som', 'carregador'
    ],
    categoria: 'Compras',
    subcategoria: 'Eletrônicos'
  },
  {
    termos: [
      'cosmetico', 'maquiagem', 'batom', 'perfume', 'hidratante', 'protetor solar',
      'shampoo', 'condicionador', 'esmalte', 'creme facial'
    ],
    categoria: 'Compras',
    subcategoria: 'Cosméticos'
  },
  { termos: ['panela', 'jogo de cama', 'toalha de banho', 'cortina', 'tapete', 'utensilios de cozinha'], categoria: 'Compras', subcategoria: 'Casa' },

  // ─── Viagens ────────────────────────────────────────────────────────────────
  {
    termos: [
      'passagem', 'passagem aerea', 'passagem de aviao', 'voo', 'bilhete aereo',
      'latam', 'milhas', 'decolar', 'maxmilhas', '123 milhas'
    ],
    categoria: 'Viagens',
    subcategoria: 'Passagens'
  },
  {
    termos: ['hospedagem', 'hotel', 'pousada', 'airbnb', 'hostel', 'resort', 'diaria do hotel', 'booking'],
    categoria: 'Viagens',
    subcategoria: 'Hospedagem'
  },
  { termos: ['city tour', 'excursao', 'passeio turistico', 'ingresso turistico'], categoria: 'Viagens', subcategoria: 'Passeios' },
  { termos: ['viagem', 'viajar', 'mochilao', 'roteiro de viagem'], categoria: 'Viagens', subcategoria: 'Outros' }
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
 * Hífen é tratado como espaço nos dois lados, então "lava-jato" no dicionário
 * também casa "lava jato" digitado (e vice-versa).
 */
function termoCasa(termo: string, alvo: string, palavras: Set<string>): boolean {
  const t = termo.replace(/-/g, ' ');
  return t.includes(' ') ? alvo.replace(/-/g, ' ').includes(t) : palavras.has(t);
}
