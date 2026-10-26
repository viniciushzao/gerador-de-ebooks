/**
 * Tabela Oficial e Restrita de Categorias Editoriais para Catalogação Comercial de E-books.
 * Nenhuma categoria fora desta lista é permitida.
 */
export const ALLOWED_CATEGORIES = [
  "Administração, Negócios e Economia",
  "Arte, Cinema e Fotografia",
  "Artesanato, Casa e Estilo de Vida",
  "Autoajuda",
  "Biografias e Histórias Reais",
  "Ciências e Matemática",
  "Computação, Informática e Mídias Digitais",
  "Direito",
  "eBooks Infantis",
  "Educação e Referência",
  "Engenharia e Transporte",
  "Esportes e Lazer",
  "Família e relacionamentos",
  "Ficção Científica e Fantasia",
  "História",
  "HQs, Mangás e Graphic Novels",
  "Humor",
  "Inglês e Outras Línguas",
  "Jovens e Adolescentes",
  "LGBT",
  "Literatura e Ficção",
  "Livros de Receitas, Comida e Vinho",
  "Medicina",
  "Não-ficção",
  "Policial, Suspense e Mistério",
  "Política e Ciências Sociais",
  "Referência",
  "Religião e Espiritualidade",
  "Romance",
  "Saúde, Fitness e Dietas",
  "Turismo e Viagem",
  "Não classificável",
] as const;

export type AllowedCategory = typeof ALLOWED_CATEGORIES[number];
