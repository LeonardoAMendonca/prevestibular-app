export interface Aluno {
  // Dados Pessoais
  id?: string;
  nome: string;
  telefoneWhatsapp: string;
  telefoneSecundario?: string;
  dataNascimento: string;
  cpf: string;
  possuiFilhos: "Sim" | "Não" | "";
  
  // Endereço
  cep: string;
  endereco: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;

  // Socioeconômico
  identidadeRacial: "Preto" | "Pardo" | "Branco" | "Indígena" | "Amarelo" | "";
  identidadeGenero: string;
  areaRiscoAmbiental: "Sim" | "Não" | "";
  areaRiscoSeguranca: "Sim" | "Não" | "";
  tipoMoradia: "Própria" | "Alugada" | "Cedida" | "Posse" | "Ocupação" | "";
  quantidadeMoradores: number;
  concluiuEnsinoMedio: "Sim" | "Não" | "";
  instituicaoEnsinoMedio?: string;
  anoConclusaoEnsinoMedio?: string;

  // Saúdez
  tipoSanguineo: string;
  temAlergia: "Sim" | "Não" | "";
  qualAlergia?: string;
  temDoencaCronica: "Sim" | "Não" | "";
  qualDoencaCronica?: string;
  usaMedicacao: "Sim" | "Não" | "";
  qualMedicacao?: string;

  foto: string | null;
  documentos?: File[];
  dataCriacao?: string;

  // Responsável
  alunoEProprioResponsavel?: "Sim" | "Não" | "";
  nomeResponsavel?: string;
  parentescoResponsavel?: string;
  cpfResponsavel?: string;
  telefoneResponsavel?: string;
  responsavelMoraComAluno?: "Sim" | "Não" | "";
  cepResponsavel?: string;
  enderecoResponsavel?: string;
  numeroResponsavel?: string;
  complementoResponsavel?: string;
  bairroResponsavel?: string;
  cidadeResponsavel?: string;
  estadoResponsavel?: string;
}