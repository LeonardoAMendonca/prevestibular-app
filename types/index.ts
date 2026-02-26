export interface Aluno {
  // Dados Pessoais
  id?: string;
  nome: string;
  dataNascimento: string;
  cpf: string;
  email: string;
  telefoneWhatsapp: string;
  telefoneSecundario?: string;
  foto: string | null;
  
  
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
  temEsgoto: "Sim" | "Não" | "";
  areaRiscoAmbiental: "Sim" | "Não" | "";
  areaRiscoSeguranca: "Sim" | "Não" | "";
  temFilhos: "Sim" | "Não" | "";
  quantidadeFilhos: number;
  tipoMoradia: string
  dispositivosEstudo: string;
  acessoInternet: string;
  trabalha: "Sim" | "Não" | "";
  cargaHorariaTrabalho: string;
  quantidadeMoradores: number;
  concluiuEnsinoMedio: "Sim" | "Não" | "";
  temDeficiencia: "Sim" | "Não" | "";
  qualDeficiencia?: string;
  rendaFamiliar?: string;
  rendaPerCapita: string;

  //Escolaridade
  escolaPublica?: "Sim" | "Não" | "";
  serieAtual?: string;
  instituicaoEnsinoMedio?: string;
  anoConclusaoEnsinoMedio?: string;

  // Saúde
  tipoSanguineo: string;
  temAlergia: "Sim" | "Não" | "";
  qualAlergia?: string;
  temDoencaCronica: "Sim" | "Não" | "";
  qualDoencaCronica?: string;
  usaMedicacao: "Sim" | "Não" | "";
  qualMedicacao?: string;
  telefoneEmergencia1?: string;
  nomeEmergencia1?: string;
  parentescoEmergencia1?: string;
  telefoneEmergencia2?: string;
  nomeEmergencia2?: string;
  parentescoEmergencia2?: string;

  //Outros Dados
  observacoesInternas?: string;
  documentosConferidos?: boolean;
  operadorResponsavel?: string;
  dataCadastro?: string;
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

// Operador do Sistema
export interface Operador {
  nome: string;
  cargo: string;
}