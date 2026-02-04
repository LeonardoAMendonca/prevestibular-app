export type Aluno = {
  // Dados Pessoais
  dataCriacao: string;
  nome: string;
  dataNascimento: string;
  telefoneWhatsapp: string;
  telefoneSecundario?: string;
  cep: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cpf: string;
  possuiFilhos: "Sim" | "Não";

  // Dados Socioeconômicos
  identidadeRacial: "Preto" | "Pardo" | "Branco" | "Indígena" | "Amarelo";
  identidadeGenero: string; 
  areaRiscoAmbiental: "Sim" | "Não";
  areaRiscoSeguranca: "Sim" | "Não";
  tipoMoradia: "Própria" | "Alugada" | "Cedida" | "Posse" | "Ocupação" | "Outro";
  tratamentoEsgoto: "Sim" | "Não";
  quantidadeMoradores: number;
  rendaFamiliar: string;
  tipoEscola: "Pública" | "Privada";
  concluiuEnsinoMedio: "Sim" | "Não";
  instituicaoEnsinoMedio?: string;
  anoConclusaoEnsinoMedio?: string;

  // Dados de Saúde
  tipoSanguineo: string;
  pcd: "Sim" | "Não";
  pcdDescricao?: string;
  medicamentoRegular: "Sim" | "Não";
  medicamentoDescricao?: string;
  doencaCronica: "Sim" | "Não";
  doencaDescricao?: string;
  contatoEmergencia1: { nome: string; telefone: string };
  contatoEmergencia2: { nome: string; telefone: string };

  // Arquivos e Foto
  documentos: File[];
  foto: string | null;
};