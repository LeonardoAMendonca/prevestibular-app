export const maskPhone = (value: string) => {
  return value
    .replace(/\D/g, "")
    .replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
};

export const maskCEP = (value: string) => {
  return value
    .replace(/\D/g, "")
    .replace(/^(\d{2})(\d{3})(\d{3}).*/, "$1.$2-$3");
};

export const maskCPF = (value: string) => {
  return value
    .replace(/\D/g, "")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})/, "$1-$2")
    .replace(/(-\d{2})\d+?$/, "$1");
};

export const buscarDadosCEP = async (cep: string) => {
  const cepLimpo = cep.replace(/\D/g, "");
  if (cepLimpo.length !== 8) return null;
  
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    const data = await response.json();
    return data.erro ? null : data;
  } catch (error) {
    console.error("Erro ao buscar CEP:", error);
    return null;
  }
};