"use client";

import { useState, useEffect, useMemo } from "react";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { PDFDocument, PageSizes } from "pdf-lib";
import Swal from 'sweetalert2'; 

import { Aluno } from "@/types";
import { gerarFichaMatriculaWord } from "@/lib/docx-generator"; 
import { gerarPdfLote, renderizarLadoNoPdf } from "@/lib/pdf-generator";
import { maskPhone, maskCEP, maskCPF, buscarDadosCEP } from "@/lib/utils";
import WebcamCapture from "@/components/WebcamCapture";
import ListaAlunos from "@/components/ListaAlunos";

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


const INITIAL_FORM_STATE: Partial<AlunoEstendido> = {
  nome: "", telefoneWhatsapp: "", telefoneSecundario: "", email: "", dataNascimento: "", cpf: "",
  cep: "", endereco: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "",
  possuiFilhos: "", identidadeRacial: "", identidadeGenero: "",
  areaRiscoAmbiental: "", areaRiscoSeguranca: "", tipoMoradia: "", quantidadeMoradores: 0,
  concluiuEnsinoMedio: "", 
  tipoSanguineo: "", temAlergia: "", temDoencaCronica: "", usaMedicacao: "", 
  alunoEProprioResponsavel: "", responsavelMoraComAluno: "",
  dispositivosEstudo: "", acessoInternet: "", trabalha: "", cargaHorariaTrabalho: "",
  rendaFamiliar: "0", rendaPerCapita: "0,00",
  observacoesInternas: "", documentosConferidos: false
};

const ESTADOS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", 
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const STORAGE_KEY = "sistema_matricula_v15_final"; 

export default function Home() {
  // --- Estados Globais ---
  const [operador, setOperador] = useState<{nome: string, cpf: string} | null>(null);
  const [totalVagas, setTotalVagas] = useState<number>(100); // Default 100
  const [alunos, setAlunos] = useState<AlunoEstendido[]>([]);
  
  // --- Estados do Formulário ---
  const [foto, setFoto] = useState<string | null>(null);
  const [mostrarWebcam, setMostrarWebcam] = useState(false);
  const [documentos, setDocumentos] = useState<File[]>([]);
  const [form, setForm] = useState<Partial<AlunoEstendido>>(INITIAL_FORM_STATE);
  const [indiceEdicao, setIndiceEdicao] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // 1. Carregar Operador e Dados
  useEffect(() => {
    const opSalvo = sessionStorage.getItem("operador_atual");
    const vagasSalvas = sessionStorage.getItem("total_vagas");
    
    if (opSalvo) setOperador(JSON.parse(opSalvo));
    if (vagasSalvas) setTotalVagas(Number(vagasSalvas));

    const dadosSalvos = localStorage.getItem(STORAGE_KEY);
    if (dadosSalvos) {
      try {
        const parsed = JSON.parse(dadosSalvos);
        setAlunos(parsed.map((a: any) => ({ ...a, documentos: [] })));
      } catch (error) { console.error(error); }
    }
    
    if (indiceEdicao === null) {
      const dataAtual = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      setForm(prev => ({ ...prev, dataCadastro: dataAtual }));
    }
  }, []);

  // Salvar LocalStorage
  useEffect(() => {
    const dadosParaSalvar = alunos.map(({ documentos, ...resto }) => resto);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dadosParaSalvar));
  }, [alunos]);

  // Cálculo Automático de Renda
  useEffect(() => {
    const rendaTotal = parseFloat(form.rendaFamiliar?.replace(",", ".") || "0");
    const numPessoas = Number(form.quantidadeMoradores) || 1;
    
if (form.rendaFamiliar != null) {
  const rendaTotal = parseInt(form.rendaFamiliar || "0", 10) / 100; // número em reais
  const numPessoas = Number(form.quantidadeMoradores) || 0;

  if (rendaTotal >= 0 && numPessoas > 0) {
    const perCapita = rendaTotal / numPessoas;
    setForm(prev => ({
      ...prev,
      rendaPerCapita: perCapita.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }));
  }
}

  }, [form.rendaFamiliar, form.quantidadeMoradores]);

  // Proteção de saída
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (documentos.length > 0 || alunos.some(a => a.documentos && a.documentos.length > 0)) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [documentos, alunos]);

  // Funções Auxiliares
  const handleCEPChange = async (valor: string) => {
    const cepFormatado = maskCEP(valor);
    setForm(prev => ({ ...prev, cep: cepFormatado }));
    if (cepFormatado.replace(/\D/g, "").length === 8) {
      const dados = await buscarDadosCEP(cepFormatado);
      if (dados) {
        setForm(prev => ({ 
          ...prev, endereco: dados.logradouro, bairro: dados.bairro, cidade: dados.localidade, estado: dados.uf 
        }));
      }
    }
  };

  const handleCEPResponsavelChange = async (valor: string) => {
      const cepFormatado = maskCEP(valor);
      setForm(prev => ({ ...prev, cepResponsavel: cepFormatado }));
      if (cepFormatado.replace(/\D/g, "").length === 8) {
        const dados = await buscarDadosCEP(cepFormatado);
        if (dados) {
          setForm(prev => ({ 
            ...prev, enderecoResponsavel: dados.logradouro, bairroResponsavel: dados.bairro, cidadeResponsavel: dados.localidade, estadoResponsavel: dados.uf 
          }));
        }
      }
  };

  // --- Login do Operador (Com Vagas) ---
  const handleLoginOperador = (e: React.FormEvent) => {
      e.preventDefault();
      const nomeInput = (document.getElementById('opNome') as HTMLInputElement).value;
      const cpfInput = (document.getElementById('opCpf') as HTMLInputElement).value;
      const vagasInput = (document.getElementById('opVagas') as HTMLInputElement).value; // Novo Campo
      
      if(nomeInput && cpfInput && vagasInput) {
          const opData = { nome: nomeInput, cpf: cpfInput };
          const vagasNum = parseInt(vagasInput) || 100;

          setOperador(opData);
          setTotalVagas(vagasNum);

          sessionStorage.setItem("operador_atual", JSON.stringify(opData));
          sessionStorage.setItem("total_vagas", vagasNum.toString());
      } else {
          Swal.fire("Erro", "Preencha todos os campos para acessar.", "error");
      }
  };

  // --- Correção do Erro TypeScript no Upload ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Converte FileList para Array explicitamente
      const filesArray = Array.from(e.target.files);
      setDocumentos(prev => [...prev, ...filesArray]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      setDocumentos(prev => [...prev, ...filesArray]);
      Swal.fire({ 
        icon: 'success', 
        title: 'Arquivos Recebidos!', 
        toast: true, position: 'top-end', timer: 3000, showConfirmButton: false
      });
    }
  };

  // --- Dashboard Stats Atualizado ---
  const stats = useMemo(() => {
      const total = alunos.length;
      // Item 3: Alunos que Trabalham (Dado mais relevante para coordenação pedagógica)
      const trabalhadores = alunos.filter(a => a.trabalha === "Sim").length;
      const rendaMedia = alunos.reduce((acc, curr) => acc + parseFloat(curr.rendaPerCapita?.replace(".", "").replace(",", ".") || "0"), 0) / (total || 1);
      
      return { total, vagasRestantes: totalVagas - total, trabalhadores, rendaMedia: rendaMedia.toFixed(2) };
  }, [alunos, totalVagas]);


  // --- Salvar ---
  const salvarOuAtualizarAluno = async () => {
    if (!form.nome || !form.cpf) { Swal.fire('Erro', 'Nome e CPF obrigatórios.', 'error'); return; }
    
    // Validação de Email (Item 2)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (form.email && !emailRegex.test(form.email)) {
        Swal.fire('E-mail Inválido', 'Por favor, insira um e-mail válido ou deixe em branco.', 'error');
        return;
    }

    if (!form.documentosConferidos) {
        Swal.fire('Atenção', 'Você deve conferir os documentos físicos e marcar a caixa de confirmação.', 'warning');
        return;
    }

    const alunoCompleto: AlunoEstendido = { 
        ...(form as AlunoEstendido), 
        foto, 
        documentos,
        operadorResponsavel: operador?.nome, 
    };

    if (indiceEdicao !== null) {
      setAlunos(prev => { const n = [...prev]; n[indiceEdicao] = alunoCompleto; return n; });
      Swal.fire('Atualizado!', 'Dados atualizados.', 'success');
    } else {
      if (stats.vagasRestantes <= 0) {
          Swal.fire("Turma Lotada", "Não há mais vagas definidas no sistema.", "warning");
          // Permite salvar mesmo assim se desejar, ou bloquear return;
      }
      setAlunos(prev => [...prev, alunoCompleto]);
      Swal.fire('Sucesso!', 'Aluno cadastrado.', 'success');
    }
    cancelarEdicao();
  };

  const cancelarEdicao = () => {
    setForm({ ...INITIAL_FORM_STATE, dataCadastro: new Date().toLocaleString("pt-BR") });
    setFoto(null); setDocumentos([]); setIndiceEdicao(null);
  };
  
  const carregarParaEdicao = (index: number) => {
      const aluno = alunos[index];
      setForm(aluno); setFoto(aluno.foto); setDocumentos(aluno.documentos || []); setIndiceEdicao(index);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const excluirAluno = (index: number) => {
    Swal.fire({
      title: 'Excluir?', text: "Irreversível.", icon: 'warning', showCancelButton: true, confirmButtonText: 'Sim'
    }).then((r) => { if(r.isConfirmed) setAlunos(prev => prev.filter((_, i) => i !== index)); });
  };

  // Funções de Download (Mantidas e Resumidas)
  const baixarZipIndividual = async (aluno: AlunoEstendido) => {
    const zip = new JSZip();
    const folder = zip.folder(aluno.nome.replace(/ /g, "_"));
    if (!folder) return;
    
    // PDF Carteirinha
    const pdfDoc = await PDFDocument.create();
    const p1 = pdfDoc.addPage(PageSizes.A4);
    const p2 = pdfDoc.addPage(PageSizes.A4);
    const sX = (p1.getWidth() - 242.6) / 2; const sY = (p1.getHeight() - 153.3) / 2;
    await renderizarLadoNoPdf(pdfDoc, p1, aluno, sX, sY, false);
    await renderizarLadoNoPdf(pdfDoc, p2, aluno, sX, sY, true);
    folder.file("Carteirinha.pdf", await pdfDoc.save());

    // Ficha
    const fichaBlob = await gerarFichaMatriculaWord(aluno);
    folder.file("FICHA_INTERNA.docx", fichaBlob);

    // Recibo
    const reciboTexto = `COMPROVANTE DE INSCRIÇÃO\nAluno: ${aluno.nome}\nCPF: ${aluno.cpf}\nCadastro por: ${aluno.operadorResponsavel}\nData: ${aluno.dataCadastro}`;
    folder.file("RECIBO_ALUNO.txt", reciboTexto);

    if (aluno.documentos) aluno.documentos.forEach(doc => folder.file(`Anexo_${doc.name}`, doc));
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `Registro_${aluno.nome}.zip`);
  };

  // --- TELA DE LOGIN DO OPERADOR ---
  if (!operador) {
      return (
          <div style={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "var(--bg-page)" }}>
              <div style={{ background: "white", padding: "40px", borderRadius: "12px", boxShadow: "0 4px 15px rgba(0,0,0,0.1)", textAlign: "center", maxWidth: "400px" }}>
                  <h2 style={{ color: "var(--primary-blue)", marginBottom: "20px" }}>🔐 Acesso do Operador</h2>
                  <p style={{ marginBottom: "20px", color: "#666" }}>Identifique-se para iniciar os trabalhos.</p>
                  <form onSubmit={handleLoginOperador} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                      <input id="opNome" type="text" placeholder="Seu Nome Completo" className="input-block" required style={{ width: "100%", padding: "12px", border: "1px solid #ccc", borderRadius: "8px" }} />
                      <input id="opCpf" type="text" placeholder="Seu CPF" className="input-block" required style={{ width: "100%", padding: "12px", border: "1px solid #ccc", borderRadius: "8px" }} onChange={(e) => e.target.value = maskCPF(e.target.value)} />
                      
                      {/* Item 1: Definir Número de Vagas */}
                      <label style={{textAlign:"left", fontSize:"0.8rem", color:"#666", marginBottom:"-10px"}}>Total de Vagas da Turma:</label>
                      <input id="opVagas" type="number" defaultValue="100" min="1" className="input-block" required style={{ width: "100%", padding: "12px", border: "1px solid #ccc", borderRadius: "8px" }} />
                      
                      <button type="submit" className="btn-primary" style={{ width: "100%" }}>ENTRAR</button>
                  </form>
              </div>
          </div>
      );
  }

  // --- TELA PRINCIPAL ---
  return (
    <div className="container">
      {/* DASHBOARD ATUALIZADO */}
      <div className="dashboard-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginBottom: "30px" }}>
          <div className="card-stat" style={{ background: "white", padding: "20px", borderRadius: "10px", borderLeft: "5px solid var(--primary-blue)", boxShadow: "var(--shadow-sm)" }}>
              <h3 style={{ fontSize: "2rem", color: "var(--primary-blue)" }}>{stats.total}</h3>
              <p style={{ color: "#666" }}>Alunos Cadastrados</p>
          </div>
          <div className="card-stat" style={{ background: "white", padding: "20px", borderRadius: "10px", borderLeft: "5px solid var(--success-green)", boxShadow: "var(--shadow-sm)" }}>
              <h3 style={{ fontSize: "2rem", color: "var(--success-green)" }}>{stats.vagasRestantes}</h3>
              <p style={{ color: "#666" }}>Vagas Restantes</p>
          </div>
          <div className="card-stat" style={{ background: "white", padding: "20px", borderRadius: "10px", borderLeft: "5px solid var(--accent-orange)", boxShadow: "var(--shadow-sm)" }}>
              <h3 style={{ fontSize: "1.5rem", color: "var(--accent-orange)" }}>R$ {stats.rendaMedia}</h3>
              <p style={{ color: "#666" }}>Renda Média Per Capita</p>
          </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ color: indiceEdicao !== null ? "var(--accent-orange)" : "var(--primary-blue)" }}>
            {indiceEdicao !== null ? `✏️ Editando: ${form.nome}` : "Pré-Vestibular da Juventude"}
        </h1>
        <p style={{ color: "var(--text-light)", fontSize: "0.9rem" }}>
            Operador: <strong>{operador.nome}</strong> | <button onClick={() => {sessionStorage.clear(); window.location.reload()}} style={{border:"none", background:"none", color:"red", cursor:"pointer", textDecoration:"underline"}}>Sair</button>
        </p>
      </div>

      {/* --- FORMULÁRIO --- */}
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
          {/* Item 2: Formatação de E-mail */}
          <div className="input-block">
            <label>E-mail (Caso possua)</label>
            <input 
                type="email" 
                placeholder="email@exemplo.com" 
                value={form.email || ""} 
                onChange={e => setForm({...form, email: e.target.value})}
                // Aplica borda vermelha se tiver texto E não for válido. 
                // Caso contrário, deixa o CSS controlar (undefined)
                style={
                  (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) 
                  ? { borderColor: "var(--danger-red)", outlineColor: "var(--danger-red)" } 
                  : undefined
                }
            />
             {/* Pequeno aviso visual opcional */}
             {form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) && (
               <span style={{color: "var(--danger-red)", fontSize: "0.8rem", marginTop: "4px"}}>E-mail inválido</span>
             )}
          </div>
        </div>

        <div className="grid-2">
          <div className="input-block">
            <label>Data Nascimento</label>
            <input
  type="text"
  placeholder="DD/MM/AAAA"
  inputMode="numeric"
  value={
    // se for ISO válido (YYYY-MM-DD) converte para exibição DD/MM/AAAA;
    // se já for string no formato parcial DD/MM/AAAA, mostra como está
    typeof form.dataNascimento === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(form.dataNascimento)
      ? new Date(form.dataNascimento).toLocaleDateString('pt-BR')
      : (typeof form.dataNascimento === 'string' ? form.dataNascimento : '')
  }
  onChange={e => {
    const raw = e.target.value || '';
    const digits = raw.replace(/\D/g, '').slice(0,8);
    let formatted = digits;
    if (digits.length >= 3) formatted = digits.slice(0,2) + '/' + digits.slice(2);
    if (digits.length >= 5) formatted = digits.slice(0,2) + '/' + digits.slice(2,4) + '/' + digits.slice(4);
    let iso = '';
    if (digits.length === 8) {
      const dd = digits.slice(0,2);
      const mm = digits.slice(2,4);
      const yyyy = digits.slice(4);
      const date = new Date(`${yyyy}-${mm}-${dd}`);
      if (!isNaN(date.getTime()) &&
          date.getFullYear() === Number(yyyy) &&
          (date.getMonth() + 1) === Number(mm) &&
          date.getDate() === Number(dd)) {
        iso = `${yyyy}-${mm}-${dd}`; // string ISO válida
      } else {
        iso = ''; // inválida
      }
    }
    // salva ISO quando válida; caso contrário salva a string parcial formatada (DD/MM/AAAA)
    setForm(prev => ({ ...prev, dataNascimento: iso || formatted }));
  }}
/>

          </div>
          <div className="input-block">
            <label>CPF</label>
            <input type="text" placeholder="000.000.000-00" value={form.cpf || ""} onChange={e => setForm({...form, cpf: maskCPF(e.target.value)})} />
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
            <input type="text" placeholder="00.000-000" value={form.cep || ""} onChange={e => handleCEPChange(e.target.value)} />
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
                            <option value="1º Ano EM">1º Ano Ensino Médio</option>
                            <option value="2º Ano EM">2º Ano Ensino Médio</option>
                            <option value="3º Ano EM">3º Ano Ensino Médio</option>
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
                <label>Tipo de internet em Casa</label>
                <select value={form.acessoInternet || ""} onChange={e => setForm({...form, acessoInternet: e.target.value})}>
                    <option value="">Selecione...</option>
                    <option value="Fixa e Móvel - Estável">Ambos estáveis (fixa + móvel)</option>
                    <option value="Fixa e Móvel - Instável">Ambos instáveis (fixa + móvel)</option>
                    <option value="Internet fixa estável">Internet fixa estável (ADSL/cabo/fibra)</option>
                    <option value="Internet fixa instável">Internet fixa instável (ADSL/cabo/fibra)</option>
                    <option value="Internet móvel estável">Internet móvel estável (celular)</option>
                    <option value="Internet móvel instável">Internet móvel instável (celular)</option>
                    <option value="Sem acesso">Não tenho internet em casal</option>
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
  <input
    type="text"
    placeholder="R$ 1.412,00"
    inputMode="numeric"
    value={
      form.rendaFamiliar
        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
            parseInt(form.rendaFamiliar, 10) / 100
          )
        : ""
    }
    onChange={e => {
      const digits = (e.target.value || "").replace(/\D/g, "");
      setForm({ ...form, rendaFamiliar: digits });
    }}
  />
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

        {/* Alergias */}
        <div className="grid-2">
            <div className="input-block">
                <label>Possui Alergia?</label>
                <select value={form.temAlergia || ""} onChange={e => setForm({...form, temAlergia: e.target.value as any})}>
                    <option value="">Selecione...</option><option value="Sim">Sim</option><option value="Não">Não</option>
                </select>
            </div>
            <div className="input-block">
                <label>Qual Alergia?</label>
                <input 
                    type="text" 
                    placeholder="Especifique..." 
                    disabled={form.temAlergia !== "Sim"} 
                    value={form.qualAlergia || ""} 
                    onChange={e => setForm({...form, qualAlergia: e.target.value})} 
                />
            </div>
        </div>

        {/* Doenças Crônicas */}
        <div className="grid-2">
            <div className="input-block">
                <label>Possui Doença Crônica?</label>
                <select value={form.temDoencaCronica || ""} onChange={e => setForm({...form, temDoencaCronica: e.target.value as any})}>
                    <option value="">Selecione...</option><option value="Sim">Sim</option><option value="Não">Não</option>
                </select>
            </div>
            <div className="input-block">
                <label>Qual Doença?</label>
                <input 
                    type="text" 
                    placeholder="Especifique..." 
                    disabled={form.temDoencaCronica !== "Sim"} 
                    value={form.qualDoencaCronica || ""} 
                    onChange={e => setForm({...form, qualDoencaCronica: e.target.value})} 
                />
            </div>
        </div>

        {/* Medicamento Controlado */}
        <div className="grid-2">
            <div className="input-block">
                <label>Usa Medicação Regular?</label>
                <select value={form.usaMedicacao || ""} onChange={e => setForm({...form, usaMedicacao: e.target.value as any})}>
                    <option value="">Selecione...</option><option value="Sim">Sim</option><option value="Não">Não</option>
                </select>
            </div>
            <div className="input-block">
                <label>Qual Medicação?</label>
                <input 
                    type="text" 
                    placeholder="Especifique..." 
                    disabled={form.usaMedicacao !== "Sim"} 
                    value={form.qualMedicacao || ""} 
                    onChange={e => setForm({...form, qualMedicacao: e.target.value})} 
                />
            </div>
        </div>
      </section>



      {/* --- ÁREA ADMINISTRATIVA (Item 4: Formatação Corrigida) --- */}
      {/* Removido o style inline de border-left que causava duplicidade se já houvesse classe CSS */}
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
            
            {/* Botão para abrir a câmera (Só aparece se não tiver foto e não estiver com a câmera aberta) */}
            {!foto && !mostrarWebcam && (
                <div 
                    className={`photo-card`} 
                    // Se você tiver a função de validação criada antes, use: onClick={handleAbrirWebcam}
                    // Caso contrário, use direto: onClick={() => setMostrarWebcam(true)}
                    onClick={() => {
                        // Validação rápida inline (opcional, baseada no seu pedido anterior)
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

            {/* AQUI ESTAVA O ERRO: Mudamos de onCancel para onClose */}
            {mostrarWebcam && (
                <WebcamCapture 
                    onCapture={img => { setFoto(img); setMostrarWebcam(false); }} 
                    onClose={() => setMostrarWebcam(false)} // <--- CORREÇÃO AQUI
                />
            )}

            {/* Visualização da Foto capturada */}
            {foto && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                {/* Mostra a foto com uma borda arredondada para simular o recorte */}
                <img 
                    src={foto} 
                    style={{ 
                        width: "150px", 
                        borderRadius: "50%", // Visual arredondado aqui também
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

      {/* --- UPLOAD --- */}
      <section className="form-section">
          <h3>Anexar Documentos</h3>
          <div 
            onDragOver={e => {e.preventDefault(); setIsDragging(true);}}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            style={{ 
                border: isDragging ? "3px dashed var(--success-green)" : "2px dashed #ccc", 
                backgroundColor: isDragging ? "#e8f8f5" : "#fafafa",
                padding: "30px", textAlign: "center", borderRadius: "10px", transition: "all 0.3s"
            }}
          >
              <p>{isDragging ? "Solte!" : "Arraste arquivos aqui ou clique"}</p>
              
              {/* CORREÇÃO DO ERRO TYPESCRIPT AQUI */}
              <input 
                  type="file" 
                  multiple 
                  onChange={handleFileChange} 
                  style={{ marginTop: "10px" }} 
              />
              
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
        onDownloadAll={() => Swal.fire("Em breve", "Função Backup JSON", "info")}
        onEdit={carregarParaEdicao} 
        onDelete={excluirAluno} 
      />
    </div>
  );
}