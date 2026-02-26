import { Aluno } from "@/types";

export const ESTADO_INICIAL_FORM: Partial<Aluno> = {
  nome: "",
  telefoneWhatsapp: "",
  telefoneSecundario: "",
  dataNascimento: "",
  cpf: "",
  cep: "",
  endereco: "",
  numero: "",
  bairro: "",
  cidade: "",
  estado: "",
  temFilhos: "Não",
  identidadeRacial: "",
  identidadeGenero: "",
  areaRiscoAmbiental: "Não",
  areaRiscoSeguranca: "Não",
  tipoMoradia: "",
  quantidadeMoradores: 0,
  concluiuEnsinoMedio: "Não",
  instituicaoEnsinoMedio: "",
  anoConclusaoEnsinoMedio: "",
  tipoSanguineo: "",
  foto: null,
  documentos: []
};