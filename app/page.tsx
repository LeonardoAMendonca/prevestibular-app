"use client";

import { useState, useEffect } from "react";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import Swal from 'sweetalert2'; 

import { Aluno } from "@/types";

// --- IMPORTS DOS GERADORES ---
// Importamos o gerador de Word para a Ficha e o de PDF para a Carteirinha
import { gerarFichaMatriculaWord } from "@/lib/docx-generator"; 
import { gerarPdfLote } from "@/lib/pdf-generator";

import { maskPhone, maskCEP, maskCPF, buscarDadosCEP } from "@/lib/utils";
import WebcamCapture from "@/components/WebcamCapture";
import ListaAlunos from "@/components/ListaAlunos";

// --- DADOS ESTÁTICOS ---
const ESTADOS_BRASIL = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

// --- INTERFACE ESTENDIDA ---
interface AlunoEstendido extends Aluno {
  // Pessoais Extras
  rg?: string;
  email?: string;
  
  // Dados do Responsável
  nomeResponsavel?: string;
  parentescoResponsavel?: string;
  cpfResponsavel?: string;
  telefoneResponsavel?: string;
  responsavelMoraComAluno?: "Sim" | "Não" | "";
  cepResponsavel?: string;
  enderecoResponsavel?: string;
  numeroResponsavel?: string;

  // Socioeconômico / Escolaridade
  dispositivosEstudo?: string;
  acessoInternet?: string;
  trabalha?: "Sim" | "Não" | "";
  cargaHorariaTrabalho?: string;
  rendaFamiliar?: string;
  rendaPerCapita?: string;
  
  // Escolaridade Detalhada
  escolaPublica?: "Sim" | "Não" | "";
  serieAtual?: string;
  instituicaoEnsinoMedio?: string;
  anoConclusaoEnsinoMedio?: string;
  
  // Saúde
  qualAlergia?: string;
  qualDoencaCronica?: string;
  qualMedicacao?: string;

  // Admin
  observacoesInternas?: string;
  documentosConferidos?: boolean;
  operadorResponsavel?: string;
  dataCadastro?: string;
  
  // Arquivos extras (Para download na sessão)
  documentosAnexos?: File[]; 
}

// --- ESTADO INICIAL ---
const INITIAL_FORM_STATE: Partial<AlunoEstendido> = {
  nome: "", telefoneWhatsapp: "", telefoneSecundario: "", email: "", 
  dataNascimento: "", cpf: "", rg: "",
  cep: "", endereco: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "",
  
  // Responsável
  alunoEProprioResponsavel: "Sim", responsavelMoraComAluno: "",
  nomeResponsavel: "", cpfResponsavel: "", telefoneResponsavel: "", 
  cepResponsavel: "", enderecoResponsavel: "", numeroResponsavel: "",

  // Novos Campos Pessoais
  possuiFilhos: "", identidadeRacial: "", identidadeGenero: "",
  areaRiscoAmbiental: "", areaRiscoSeguranca: "", tipoMoradia: "", quantidadeMoradores: 1,
  
  // Escolaridade
  concluiuEnsinoMedio: "", 
  escolaPublica: "", serieAtual: "", instituicaoEnsinoMedio: "", anoConclusaoEnsinoMedio: "",
  
  // Saúde/Outros
  tipoSanguineo: "", temAlergia: "", qualAlergia: "", temDoencaCronica: "", qualDoencaCronica: "", usaMedicacao: "", qualMedicacao: "",
  dispositivosEstudo: "", acessoInternet: "", trabalha: "", cargaHorariaTrabalho: "",
  rendaFamiliar: "0,00", rendaPerCapita: "0,00",
  
  observacoesInternas: "", documentosConferidos: false,
  documentosAnexos: []
};

export default function Home() {
  // Estados principais
  const [alunos, setAlunos] = useState<AlunoEstendido[]>([]);
  const [form, setForm] = useState<Partial<AlunoEstendido>>(INITIAL_FORM_STATE);
  const [foto, setFoto] = useState<string | null>(null);
  const [documentos, setDocumentos] = useState<File[]>([]);
  
  // Controles de UI
  const [mostrarWebcam, setMostrarWebcam] = useState(false);
  const [indiceEdicao, setIndiceEdicao] = useState<number | null>(null);
  const [carregandoCep, setCarregandoCep] = useState(false);

  // Carregar dados locais ao iniciar
  useEffect(() => {
    const salvos = localStorage.getItem("alunos_db");
    if (salvos) setAlunos(JSON.parse(salvos));
  }, []);

  // Salvar no localStorage sempre que a lista mudar
  useEffect(() => {
    // Nota: Arquivos (File objects) não persistem no LocalStorage.
    // Eles só estarão disponíveis para download na mesma sessão em que foram adicionados.
    localStorage.setItem("alunos_db", JSON.stringify(alunos));
  }, [alunos]);

  // Cálculo Automático de Renda Per Capita
  useEffect(() => {
    const qtd = Number(form.quantidadeMoradores) || 1;
    const rendaString = form.rendaFamiliar ? form.rendaFamiliar.replace(/\./g, '').replace(',', '.') : "0";
    const renda = parseFloat(rendaString);
    
    if (!isNaN(renda) && qtd > 0) {
      const perCapita = renda / qtd;
      setForm(prev => ({ 
        ...prev, 
        rendaPerCapita: perCapita.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
      }));
    }
  }, [form.rendaFamiliar, form.quantidadeMoradores]);

  // --- FUNÇÕES DE MANIPULAÇÃO ---

  const handleCEPChange = async (cepInput: string) => {
    const cepMasked = maskCEP(cepInput);
    setForm(prev => ({ ...prev, cep: cepMasked }));

    if (cepMasked.length === 10) {
      setCarregandoCep(true);
      const dados = await buscarDadosCEP(cepMasked);
      setCarregandoCep(false);
      if (dados) {
        setForm(prev => ({
          ...prev,
          endereco: dados.logradouro,
          bairro: dados.bairro,
          cidade: dados.localidade,
          estado: dados.uf
        }));
      }
    }
  };

  const handleCEPResponsavelChange = async (cepInput: string) => {
    const cepMasked = maskCEP(cepInput);
    setForm(prev => ({ ...prev, cepResponsavel: cepMasked }));

    if (cepMasked.length === 10) {
      setCarregandoCep(true);
      const dados = await buscarDadosCEP(cepMasked);
      setCarregandoCep(false);
      if (dados) {
        setForm(prev => ({
          ...prev,
          enderecoResponsavel: dados.logradouro,
        }));
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setDocumentos(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const salvarOuAtualizarAluno = () => {
    if (!form.nome || !form.cpf || !foto) {
      Swal.fire("Erro", "Preencha Nome, CPF e tire a Foto para salvar.", "error");
      return;
    }

    const alunoCompleto: AlunoEstendido = {
      ...form as AlunoEstendido,
      foto: foto,
      // Salva os documentos anexados na memória do objeto
      documentosAnexos: documentos,
      dataCriacao: new Date().toLocaleDateString('pt-BR'),
      id: indiceEdicao !== null && alunos[indiceEdicao] ? alunos[indiceEdicao].id : crypto.randomUUID(),
    };

    if (indiceEdicao !== null) {
      const novaLista = [...alunos];
      novaLista[indiceEdicao] = alunoCompleto;
      setAlunos(novaLista);
      Swal.fire("Sucesso", "Cadastro atualizado!", "success");
      setIndiceEdicao(null);
    } else {
      setAlunos([...alunos, alunoCompleto]);
      Swal.fire("Sucesso", "Aluno cadastrado!", "success");
    }

    setForm(INITIAL_FORM_STATE);
    setFoto(null);
    setDocumentos([]);
  };

  const carregarParaEdicao = (index: number) => {
    const aluno = alunos[index];
    setForm(aluno);
    setFoto(aluno.foto || null);
    // Tenta recuperar documentos se ainda estiverem em memória
    setDocumentos(aluno.documentosAnexos || []); 
    setIndiceEdicao(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const excluirAluno = (index: number) => {
    Swal.fire({
      title: 'Tem certeza?',
      text: "Não será possível reverter isso!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sim, excluir!'
    }).then((result) => {
      if (result.isConfirmed) {
        const novaLista = alunos.filter((_, i) => i !== index);
        setAlunos(novaLista);
        Swal.fire('Excluído!', 'O registro foi apagado.', 'success');
      }
    })
  };

  const cancelarEdicao = () => {
    setIndiceEdicao(null);
    setForm(INITIAL_FORM_STATE);
    setFoto(null);
    setDocumentos([]);
  };

  // --- FUNÇÃO DE DOWNLOAD DO ZIP (CORRIGIDA) ---
  const baixarZipIndividual = async (aluno: AlunoEstendido) => {
    const zip = new JSZip();

    try {
        // 1. Ficha de Matrícula (WORD / .docx)
        // Usando o gerador correto docx-generator
        const fichaBlob = await gerarFichaMatriculaWord(aluno);
        zip.file(`Ficha_Matricula_${aluno.nome}.docx`, fichaBlob);

        // 2. Carteirinha Individual (PDF)
        // Usamos a função de lote, mas passamos um array com apenas 1 aluno
        const carteirinhaBlob = await gerarPdfLote([aluno]);
        zip.file(`Carteirinha_${aluno.nome}.pdf`, carteirinhaBlob);
        
        // 3. Foto Original (PNG/JPG)
        if (aluno.foto) {
            const imgData = aluno.foto.split(',')[1];
            zip.file(`Foto_Original_${aluno.nome}.png`, imgData, { base64: true });
        }

        // 4. Documentos Anexados
        // Itera sobre os arquivos reais anexados (File Objects)
        if (aluno.documentosAnexos && aluno.documentosAnexos.length > 0) {
            aluno.documentosAnexos.forEach((doc, i) => {
                 // Verificação de segurança para garantir que é um arquivo
                 if (doc && doc.name) {
                     zip.file(`Anexo_${i+1}_${doc.name}`, doc);
                 }
            });
        }
        
        // Gera e baixa o arquivo ZIP final
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `Documentos_${aluno.nome}.zip`);

    } catch (error) {
        console.error("Erro ao gerar documentos:", error);
        Swal.fire("Erro", "Houve um problema ao gerar os arquivos do aluno.", "error");
    }
  };

  return (
    <main className="container">
      <header style={{ textAlign: "center", marginBottom: "30px" }}>
        <h1 style={{ color: "#2c3e50" }}>Sistema de Matrícula</h1>
        <p style={{ color: "#7f8c8d" }}>Cadastro de Alunos e Emissão de Carteirinhas</p>
      </header>

      {/* --- FORMULÁRIO: DADOS PESSOAIS --- */}
      <section className="form-section">
        <h3>Dados Pessoais e Contato</h3>
        
        <div className="input-block">
          <label>Nome Completo</label>
          <input type="text" value={form.nome || ""} onChange={e => setForm({...form, nome: e.target.value})} />
        </div>

        <div className="grid-3">
          <div className="input-block">
            <label>WhatsApp</label>
            <input type="text" placeholder="(XX) XXXXX-XXXX" value={form.telefoneWhatsapp || ""} onChange={e => setForm({...form, telefoneWhatsapp: maskPhone(e.target.value)})} />
          </div>
          <div className="input-block">
            <label>Tel. Secundário</label>
            <input type="text" placeholder="(XX) XXXXX-XXXX" value={form.telefoneSecundario || ""} onChange={e => setForm({...form, telefoneSecundario: maskPhone(e.target.value)})} />
          </div>
          <div className="input-block">
            <label>E-mail (Caso possua)</label>
            <input 
                type="email" 
                placeholder="email@exemplo.com" 
                value={form.email || ""} 
                onChange={e => setForm({...form, email: e.target.value})}
            />
          </div>
        </div>
        
        <div className="grid-2">
            <div className="input-block">
                <label>CPF</label>
                <input type="text" placeholder="000.000.000-00" value={form.cpf || ""} onChange={e => setForm({...form, cpf: maskCPF(e.target.value)})} />
            </div>
             <div className="input-block">
                <label>Data Nascimento</label>
                <input type="date" value={form.dataNascimento || ""} onChange={e => setForm({...form, dataNascimento: e.target.value})} />
            </div>
        </div>

        <div className="grid-2">
            <div className="input-block">
                <label>Identidade de Gênero</label>
                <select value={form.identidadeGenero || ""} onChange={e => setForm({...form, identidadeGenero: e.target.value})}>
                    <option value="">Selecione...</option>
                    <option value="Cisgênero">Cisgênero</option>
                    <option value="Transgênero">Transgênero</option>
                    <option value="Não-Binário">Não-Binário</option>
                    <option value="Prefiro não informar">Prefiro não informar</option>
                </select>
            </div>
            <div className="input-block">
                <label>Raça/Cor</label>
                <select value={form.identidadeRacial || ""} onChange={e => setForm({...form, identidadeRacial: e.target.value as any})}>
                    <option value="">Selecione...</option>
                    <option value="Branca">Branca</option>
                    <option value="Preta">Preta</option>
                    <option value="Parda">Parda</option>
                    <option value="Amarela">Amarela</option>
                    <option value="Indígena">Indígena</option>
                </select>
            </div>
        </div>

        <hr style={{ margin: "25px 0", border: "0", borderTop: "1px solid #eee" }} />
        
        <h4 style={{ color: "var(--primary-blue)", marginBottom: "15px" }}>Endereço Residencial</h4>
        <div className="grid-3">
          <div className="input-block">
            <label>CEP</label>
            <div style={{ position: 'relative' }}>
                <input type="text" placeholder="00.000-000" value={form.cep || ""} onChange={e => handleCEPChange(e.target.value)} />
                {carregandoCep && <span style={{ position: 'absolute', right: 10, top: 10, fontSize: '12px' }}>Bus..</span>}
            </div>
          </div>
          <div className="input-block">
            <label>Logradouro</label>
            <input type="text" value={form.endereco || ""} onChange={e => setForm({...form, endereco: e.target.value})} />
          </div>
          <div className="input-block">
            <label>Nº</label>
            <input type="text" value={form.numero || ""} onChange={e => setForm({...form, numero: e.target.value})} />
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
          <div className="input-block" style={{ flex: 2 }}>
            <label>Bairro</label>
            <input type="text" value={form.bairro || ""} onChange={e => setForm({...form, bairro: e.target.value})} />
          </div>
          <div className="input-block" style={{ flex: 2 }}>
            <label>Complemento</label>
            <input type="text" placeholder="Apto, Bloco..." value={form.complemento || ""} onChange={e => setForm({...form, complemento: e.target.value})} />
          </div>
          <div className="input-block" style={{ flex: 2 }}>
             <label>Cidade</label>
             <input type="text" value={form.cidade || ""} onChange={e => setForm({...form, cidade: e.target.value})} />
          </div>
          <div className="input-block" style={{ width: "90px" }}>
             <label>UF</label>
             <select value={form.estado || ""} onChange={e => setForm({...form, estado: e.target.value})} style={{ height: '48px' }}>
               <option value="">UF</option>
               {ESTADOS_BRASIL.map(uf => <option key={uf} value={uf}>{uf}</option>)}
             </select>
          </div>
        </div>
      </section>

      {/* --- RESPONSÁVEL LEGAL --- */}
      <section className="form-section">
         <h3>Responsável Legal</h3>
         <div className="input-block">
           <label>O aluno é o seu próprio responsável (Maior de idade)?</label>
           <select value={form.alunoEProprioResponsavel || ""} onChange={e => setForm({...form, alunoEProprioResponsavel: e.target.value as any})}>
             <option value="">Selecione...</option><option value="Sim">Sim</option><option value="Não">Não</option>
           </select>
         </div>
         {form.alunoEProprioResponsavel === "Não" && (
            <div className="anime-fade-in" style={{ marginTop: "20px", borderTop: "1px solid #eee", paddingTop: "20px" }}>
                <div className="input-block">
                    <label>Nome do Responsável</label>
                    <input type="text" value={form.nomeResponsavel || ""} onChange={e => setForm({...form, nomeResponsavel: e.target.value})} />
                </div>
                <div className="grid-3">
                    <div className="input-block">
                        <label>Parentesco</label>
                        <select value={form.parentescoResponsavel || ""} onChange={e => setForm({...form, parentescoResponsavel: e.target.value})}>
                            <option value="">Selecione...</option><option value="Mãe/Pai">Mãe/Pai</option><option value="Avô/Avó">Avô/Avó</option><option value="Tio/Tia">Tio/Tia</option><option value="Padrinho/Madrinha">Padrinho/Madrinha</option><option value="Outro">Outro</option>
                        </select>
                    </div>
                    <div className="input-block">
                        <label>CPF Resp.</label>
                        <input type="text" placeholder="000.000.000-00" value={form.cpfResponsavel || ""} onChange={e => setForm({...form, cpfResponsavel: maskCPF(e.target.value)})} />
                    </div>
                    <div className="input-block">
                        <label>Tel. Resp.</label>
                        <input type="text" placeholder="(XX) XXXXX-XXXX" value={form.telefoneResponsavel || ""} onChange={e => setForm({...form, telefoneResponsavel: maskPhone(e.target.value)})} />
                    </div>
                </div>
                
                <div className="input-block">
                  <label>Mora com o aluno?</label>
                  <select value={form.responsavelMoraComAluno || ""} onChange={e => setForm({...form, responsavelMoraComAluno: e.target.value as any})}>
                    <option value="">Selecione...</option><option value="Sim">Sim</option><option value="Não">Não</option>
                  </select>
                </div>

                {form.responsavelMoraComAluno === "Não" && (
                  <div style={{ background: "#f8f9fa", padding: "15px", borderRadius: "8px", marginTop: "10px" }}>
                    <h4 style={{marginBottom: "10px"}}>Endereço do Responsável</h4>
                    <div className="grid-3">
                      <div className="input-block">
                          <label>CEP</label>
                          <input type="text" placeholder="00.000-000" value={form.cepResponsavel || ""} onChange={e => handleCEPResponsavelChange(e.target.value)} />
                      </div>
                      <div className="input-block"><label>Endereço</label><input type="text" value={form.enderecoResponsavel || ""} onChange={e => setForm({...form, enderecoResponsavel: e.target.value})} /></div>
                      <div className="input-block"><label>Nº</label><input type="text" value={form.numeroResponsavel || ""} onChange={e => setForm({...form, numeroResponsavel: e.target.value})} /></div>
                    </div>
                  </div>
                )}
            </div>
         )}
      </section>

      {/* --- QUESTIONÁRIO SOCIOECONÔMICO & ESCOLARIDADE --- */}
      <section className="form-section">
        <h3>Socioeconômico e Escolaridade</h3>
        
        <div className="grid-2">
            <div className="input-block">
                <label>Possui Filhos?</label>
                <select value={form.possuiFilhos || ""} onChange={e => setForm({...form, possuiFilhos: e.target.value as any})}>
                    <option value="">Selecione...</option><option value="Sim">Sim</option><option value="Não">Não</option>
                </select>
            </div>
            <div className="input-block">
                <label>Tipo de Moradia</label>
                <select value={form.tipoMoradia || ""} onChange={e => setForm({...form, tipoMoradia: e.target.value})}>
                    <option value="">Selecione...</option>
                    <option value="Própria">Própria</option>
                    <option value="Alugada">Alugada</option>
                    <option value="Cedida/Favor">Cedida/Favor</option>
                    <option value="Ocupação">Ocupação</option>
                </select>
            </div>
        </div>

        <div className="grid-2">
            <div className="input-block">
                <label>Mora em área de Risco Ambiental?</label>
                <select value={form.areaRiscoAmbiental || ""} onChange={e => setForm({...form, areaRiscoAmbiental: e.target.value})}>
                    <option value="">Selecione...</option><option value="Sim">Sim</option><option value="Não">Não</option>
                </select>
            </div>
            <div className="input-block">
                <label>Mora em área de Risco de Segurança?</label>
                <select value={form.areaRiscoSeguranca || ""} onChange={e => setForm({...form, areaRiscoSeguranca: e.target.value})}>
                    <option value="">Selecione...</option><option value="Sim">Sim</option><option value="Não">Não</option>
                </select>
            </div>
        </div>

        <div style={{ background: "#e8f8f5", padding: "15px", borderRadius: "8px", margin: "15px 0", border: "1px solid #d1f2eb" }}>
            <h4 style={{ marginBottom: "10px", color: "#16a085" }}>🎓 Escolaridade</h4>
            
            <div className="input-block">
                <label>Já concluiu o Ensino Médio?</label>
                <select 
                    value={form.concluiuEnsinoMedio || ""} 
                    onChange={e => setForm({...form, concluiuEnsinoMedio: e.target.value as any})}
                    style={{ fontWeight: "bold" }}
                >
                    <option value="">Selecione...</option>
                    <option value="Sim">Sim, já concluí</option>
                    <option value="Não">Não, ainda estou cursando</option>
                    <option value="Parou">Não, parei de estudar</option>
                </select>
            </div>

            {form.concluiuEnsinoMedio === "Sim" && (
                <div className="grid-2 anime-fade-in">
                    <div className="input-block">
                        <label>Instituição de Ensino</label>
                        <input type="text" placeholder="Nome da Escola" value={form.instituicaoEnsinoMedio || ""} onChange={e => setForm({...form, instituicaoEnsinoMedio: e.target.value})} />
                    </div>
                    <div className="input-block">
                        <label>Ano de Conclusão</label>
                        <input type="text" placeholder="Ex: 2023" value={form.anoConclusaoEnsinoMedio || ""} onChange={e => setForm({...form, anoConclusaoEnsinoMedio: e.target.value})} />
                    </div>
                </div>
            )}

            {form.concluiuEnsinoMedio === "Não" && (
                <div className="grid-2 anime-fade-in">
                    <div className="input-block">
                        <label>Série Atual</label>
                        <select value={form.serieAtual || ""} onChange={e => setForm({...form, serieAtual: e.target.value})}>
                            <option value="">Selecione...</option>
                            <option value="1º Ano EM">1º Ano EM</option>
                            <option value="2º Ano EM">2º Ano EM</option>
                            <option value="3º Ano EM">3º Ano EM</option>
                            <option value="EJA">EJA</option>
                        </select>
                    </div>
                    <div className="input-block">
                        <label>Estuda em Escola Pública?</label>
                        <select value={form.escolaPublica || ""} onChange={e => setForm({...form, escolaPublica: e.target.value as any})}>
                            <option value="">Selecione...</option><option value="Sim">Sim</option><option value="Não">Não</option>
                        </select>
                    </div>
                </div>
            )}
        </div>

        <div className="grid-2">
            <div className="input-block">
                <label>Dispositivo para Estudo</label>
                <select value={form.dispositivosEstudo || ""} onChange={e => setForm({...form, dispositivosEstudo: e.target.value})}>
                    <option value="">Selecione...</option>
                    <option value="Celular Próprio">Apenas Celular Próprio</option>
                    <option value="Celular Compartilhado">Celular Compartilhado</option>
                    <option value="Computador/Notebook">Computador ou Notebook</option>
                    <option value="Tablet">Tablet</option>
                    <option value="Apenas Impresso">Material impresso</option>
                </select>
            </div>
            <div className="input-block">
                <label>Internet em Casa</label>
                <select value={form.acessoInternet || ""} onChange={e => setForm({...form, acessoInternet: e.target.value})}>
                    <option value="">Selecione...</option>
                    <option value="Wi-Fi Estável">Wi-Fi Estável</option>
                    <option value="Dados Móveis">Dados Móveis</option>
                    <option value="Sem Internet">Sem Internet</option>
                </select>
            </div>
        </div>

        <div className="grid-2">
            <div className="input-block">
                <label>Trabalha atualmente?</label>
                <select value={form.trabalha || ""} onChange={e => setForm({...form, trabalha: e.target.value as any})}>
                    <option value="">Selecione...</option> <option value="Sim">Sim</option> <option value="Não">Não</option>
                </select>
            </div>
            {form.trabalha === "Sim" && (
                <div className="input-block">
                    <label>Carga Horária</label>
                    <input type="text" placeholder="Ex: 6h/dia" value={form.cargaHorariaTrabalho || ""} onChange={e => setForm({...form, cargaHorariaTrabalho: e.target.value})} />
                </div>
            )}
        </div>

        <div style={{ background: "#f1f2f6", padding: "15px", borderRadius: "8px", margin: "15px 0" }}>
            <h4 style={{marginBottom: "10px", color: "var(--text-dark)"}}>Composição de Renda</h4>
            <div className="grid-3">
                <div className="input-block">
                    <label>Qtd. Pessoas</label>
                    <input type="number" min="1" value={form.quantidadeMoradores || ""} onChange={e => setForm({...form, quantidadeMoradores: parseInt(e.target.value)})} />
                </div>
                <div className="input-block">
                    <label>Renda Familiar (R$)</label>
                    <input type="text" placeholder="1412.00" value={form.rendaFamiliar || ""} onChange={e => setForm({...form, rendaFamiliar: e.target.value})} />
                </div>
                <div className="input-block">
                    <label>Per Capita (R$)</label>
                    <input type="text" disabled value={form.rendaPerCapita} style={{ fontWeight: "bold", color: "var(--primary-blue)", backgroundColor: "#e8eff5" }} />
                </div>
            </div>
        </div>
      </section>

      {/* --- SAÚDE --- */}
      <section className="form-section">
        <h3>Saúde</h3>
        <div className="input-block">
            <label>Tipo Sanguíneo</label>
            <select value={form.tipoSanguineo || ""} onChange={e => setForm({...form, tipoSanguineo: e.target.value})}>
                <option value="">Selecione...</option><option value="A+">A+</option><option value="A-">A-</option><option value="B+">B+</option><option value="B-">B-</option><option value="AB+">AB+</option><option value="AB-">AB-</option><option value="O+">O+</option><option value="O-">O-</option><option value="Não Sabe">Não Sabe</option>
            </select>
        </div>
        <div className="grid-2">
            <div className="input-block">
                <label>Possui Alergia?</label>
                <select value={form.temAlergia || ""} onChange={e => setForm({...form, temAlergia: e.target.value as any})}>
                    <option value="">Selecione...</option><option value="Sim">Sim</option><option value="Não">Não</option>
                </select>
            </div>
            <div className="input-block">
                <label>Qual Alergia?</label>
                <input type="text" placeholder="Especifique..." disabled={form.temAlergia !== "Sim"} value={form.qualAlergia || ""} onChange={e => setForm({...form, qualAlergia: e.target.value})} />
            </div>
        </div>
        <div className="grid-2">
            <div className="input-block">
                <label>Possui Doença Crônica?</label>
                <select value={form.temDoencaCronica || ""} onChange={e => setForm({...form, temDoencaCronica: e.target.value as any})}>
                    <option value="">Selecione...</option><option value="Sim">Sim</option><option value="Não">Não</option>
                </select>
            </div>
            <div className="input-block">
                <label>Qual Doença?</label>
                <input type="text" placeholder="Especifique..." disabled={form.temDoencaCronica !== "Sim"} value={form.qualDoencaCronica || ""} onChange={e => setForm({...form, qualDoencaCronica: e.target.value})} />
            </div>
        </div>
        <div className="grid-2">
            <div className="input-block">
                <label>Usa Medicação Regular?</label>
                <select value={form.usaMedicacao || ""} onChange={e => setForm({...form, usaMedicacao: e.target.value as any})}>
                    <option value="">Selecione...</option><option value="Sim">Sim</option><option value="Não">Não</option>
                </select>
            </div>
            <div className="input-block">
                <label>Qual Medicação?</label>
                <input type="text" placeholder="Especifique..." disabled={form.usaMedicacao !== "Sim"} value={form.qualMedicacao || ""} onChange={e => setForm({...form, qualMedicacao: e.target.value})} />
            </div>
        </div>
      </section>

      {/* --- ÁREA ADMINISTRATIVA --- */}
      <section className="form-section">
          <div style={{ borderLeft: "5px solid var(--accent-orange)", paddingLeft: "15px", marginBottom: "20px" }}>
             <h3 style={{ margin: 0, color: "var(--accent-orange)" }}>🔒 Área Administrativa</h3>
          </div>
          <div className="input-block">
              <label>Observações Internas (Não sai no recibo do aluno)</label>
              <textarea 
                rows={4} 
                placeholder="Ex: Documentação pendente; Relato sobre vulnerabilidade..." 
                value={form.observacoesInternas || ""} 
                onChange={e => setForm({...form, observacoesInternas: e.target.value})}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ccc" }}
              />
          </div>
          <div style={{ marginTop: "15px", display: "flex", alignItems: "center", gap: "10px", padding: "15px", background: "#fff3cd", borderRadius: "8px" }}>
              <input 
                type="checkbox" 
                id="checkDocs" 
                style={{ width: "20px", height: "20px" }} 
                checked={form.documentosConferidos || false}
                onChange={e => setForm({...form, documentosConferidos: e.target.checked})}
              />
              <label htmlFor="checkDocs" style={{ fontWeight: "bold", cursor: "pointer" }}>
                  Declaro que CONFERI OS DOCUMENTOS FÍSICOS originais do aluno e do responsável neste ato.
              </label>
          </div>
      </section>

      {/* --- FOTO WEBCAM --- */}
      <section className="form-section">
        <h3>Foto do Aluno 3x4</h3>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            
            {!foto && !mostrarWebcam && (
                <div 
                    className={`photo-card`} 
                    onClick={() => {
                        if (!form.nome || !form.cpf) {
                            Swal.fire('Atenção', 'Preencha Nome e CPF antes da foto.', 'warning');
                        } else {
                            setMostrarWebcam(true);
                        }
                    }} 
                    style={{ cursor: 'pointer', width: '100%', maxWidth: '300px' }}
                >
                    <div style={{ textAlign: 'center', color: '#7f8c8d' }}>
                        <span style={{ fontSize: '40px' }}>📸</span><br/><strong>Tirar Foto</strong>
                    </div>
                </div>
            )}

            {mostrarWebcam && (
                <WebcamCapture 
                    onCapture={img => { setFoto(img); setMostrarWebcam(false); }} 
                    onClose={() => setMostrarWebcam(false)} 
                />
            )}

            {foto && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                <img 
                    src={foto} 
                    style={{ 
                        width: "150px", 
                        borderRadius: "50%", 
                        border: "4px solid #fff",
                        boxShadow: "0 4px 10px rgba(0,0,0,0.2)"
                    }} 
                    alt="Captura" 
                />
                <button 
                    className="btn-danger" 
                    onClick={() => setFoto(null)} 
                    style={{display:"block", marginTop:"10px"}}
                >
                    Remover Foto
                </button>
            </div>
            )}
        </div>
      </section>

      {/* --- DOCUMENTOS E ANEXOS --- */}
      <section className="form-section">
          <h3>Documentos e Arquivos</h3>
          <div className="input-block">
              <label>Anexar PDFs ou Imagens (Opcional)</label>
              <input type="file" multiple onChange={handleFileChange} />
              
              {documentos.length > 0 && (
                  <ul style={{ listStyle: "none", marginTop: "20px", textAlign: "left" }}>
                      {documentos.map((doc, i) => (
                          <li key={i} style={{ padding: "5px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
                              📄 {doc.name} 
                              <button onClick={() => setDocumentos(prev => prev.filter((_, idx) => idx !== i))} style={{ color: "red", border: "none", background: "none", cursor: "pointer" }}>✖</button>
                          </li>
                      ))}
                  </ul>
              )}
          </div>
      </section>

      {/* --- BOTÕES DE AÇÃO --- */}
      <div style={{ marginTop: "30px", display: "flex", gap: "10px" }}>
        {indiceEdicao !== null && (
          <button onClick={cancelarEdicao} className="btn-danger" style={{ flex: 1, backgroundColor: "#95a5a6" }}>CANCELAR</button>
        )}
        <button onClick={salvarOuAtualizarAluno} className="btn-primary" style={{ flex: 2 }}>
          {indiceEdicao !== null ? "ATUALIZAR DADOS" : "SALVAR CADASTRO"}
        </button>
      </div>

      <ListaAlunos 
        alunos={alunos} 
        onDownloadZip={baixarZipIndividual} 
        onDownloadLote={() => gerarPdfLote(alunos).then(blob => saveAs(blob, "LOTE_CARTEIRINHAS.pdf"))}
        onDownloadAll={() => Swal.fire("Em breve", "Funcionalidade de backup completo será implementada.", "info")}
        onEdit={carregarParaEdicao}
        onDelete={excluirAluno}
      />
    </main>
  );
}