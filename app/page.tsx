"use client";

import { useState, useEffect } from "react";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { PDFDocument, PageSizes } from "pdf-lib";

// Importações dos arquivos de suporte
import { Aluno } from "@/types";
import { gerarPdfLote, renderizarLadoNoPdf } from "@/lib/pdf-generator";
import WebcamCapture from "@/components/WebcamCapture";

export default function Home() {
  // --- Estado Inicial para Reset Completo ---
  const estadoInicialForm: Partial<Aluno> = {
    nome: "",
    telefoneWhatsapp: "",
    telefoneSecundario: "",
    cep: "",
    endereco: "",
    numero: "",
    bairro: "",
    cidade: "",
    estado: "",
    cpf: "",
    dataNascimento: "",
    possuiFilhos: "Não",
    identidadeRacial: "Pardo",
    identidadeGenero: "",
    areaRiscoAmbiental: "Não",
    areaRiscoSeguranca: "Não",
    tipoMoradia: "Própria",
    tratamentoEsgoto: "Não",
    quantidadeMoradores: 0,
    rendaFamiliar: "",
    concluiuEnsinoMedio: "Não",
    instituicaoEnsinoMedio: "",
    anoConclusaoEnsinoMedio: "",
    tipoSanguineo: "",
    pcd: "Não",
    pcdDescricao: "",
    medicamentoRegular: "Não",
    medicamentoDescricao: "",
    doencaCronica: "Não",
    doencaDescricao: "",
    contatoEmergencia1: { nome: "", telefone: "" },
    contatoEmergencia2: { nome: "", telefone: "" },
  };

  // --- Estados do Componente ---
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [foto, setFoto] = useState<string | null>(null);
  const [mostrarWebcam, setMostrarWebcam] = useState(false);
  const [documentos, setDocumentos] = useState<File[]>([]);
  const [form, setForm] = useState<Partial<Aluno>>(estadoInicialForm);

  // Define a data de criação interna ao carregar
  useEffect(() => {
    const dataAtual = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    setForm(prev => ({ ...prev, dataCriacao: dataAtual }));
  }, []);

  // --- Máscaras de Formatação ---
  const maskPhone = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1)$2-$3");
  };

  const maskCEP = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/^(\d{2})(\d{3})(\d{3}).*/, "$1.$2-$3");
  };

  // --- Busca Automática de CEP (ViaCEP) ---
  const buscarCEP = async (cep: string) => {
    const cepLimpo = cep.replace(/\D/g, "");
    if (cepLimpo.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setForm(prev => ({
            ...prev,
            endereco: data.logradouro,
            bairro: data.bairro,
            cidade: data.localidade,
            estado: data.uf
          }));
        }
      } catch (error) {
        console.error("Erro ao buscar CEP:", error);
      }
    }
  };

  // --- Validações ---
  const foneLimpo = form.telefoneWhatsapp?.replace(/\D/g, "") || "";
  const podeLiberarFoto = !!(form.nome && foneLimpo.length >= 11);
  
  const podeCadastrar = !!(podeLiberarFoto && foto && 
    form.dataNascimento && form.cpf && form.endereco && form.bairro && form.cidade);

  // --- Funções de Ação ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setDocumentos((prev) => [...prev, ...Array.from(e.target.files || [])]);
    }
  };

  const adicionarAluno = () => {
    if (!podeCadastrar) {
      alert("⚠️ Certifique-se de preencher os dados obrigatórios e tirar a foto.");
      return;
    }

    const novoAluno: Aluno = { ...(form as Aluno), foto, documentos };
    setAlunos([...alunos, novoAluno]);

    // RESET COMPLETO DE CAMPOS
    setForm({ 
      ...estadoInicialForm, 
      dataCriacao: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) 
    });
    setFoto(null);
    setDocumentos([]);
    alert("✅ Aluno adicionado ao lote!");
  };

  const baixarZipIndividual = async (aluno: Aluno) => {
    const zip = new JSZip();
    const folder = zip.folder(aluno.nome.replace(/ /g, "_"));
    if (!folder) return;

    const pdfDoc = await PDFDocument.create();
    const p1 = pdfDoc.addPage(PageSizes.A4);
    const p2 = pdfDoc.addPage(PageSizes.A4);
    const sX = (p1.getWidth() - 242.6) / 2;
    const sY = (p1.getHeight() - 153.3) / 2;

    await renderizarLadoNoPdf(pdfDoc, p1, aluno, sX, sY, false);
    await renderizarLadoNoPdf(pdfDoc, p2, aluno, sX, sY, true);

    folder.file("Carteirinha.pdf", await pdfDoc.save());
    aluno.documentos.forEach((doc) => folder.file(`Anexo_${doc.name}`, doc));

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `Registo_${aluno.nome}.zip`);
  };

  const baixarLoteImpressao = async () => {
    if (alunos.length === 0) return;
    const blob = await gerarPdfLote(alunos);
    saveAs(blob, "LOTE_PARA_IMPRESSAO_A4.pdf");
  };

  return (
    <div className="container">
      <h1>Sistema de Matrícula v7.4</h1>

      {/* DADOS PESSOAIS */}
      <section className="form-section">
        <h3>Dados Pessoais</h3>
        <div className="form-group">
          <input type="text" placeholder="Nome Completo" value={form.nome || ""} onChange={e => setForm({...form, nome: e.target.value})} />
          
          <div className="grid-2">
            <input type="text" placeholder="WhatsApp (XX)XXXXX-XXXX" value={form.telefoneWhatsapp || ""} onChange={e => setForm({...form, telefoneWhatsapp: maskPhone(e.target.value)})} />
            <input type="text" placeholder="Telefone Secundário" value={form.telefoneSecundario || ""} onChange={e => setForm({...form, telefoneSecundario: maskPhone(e.target.value)})} />
          </div>

          <div className="grid-2">
            <input type="date" value={form.dataNascimento || ""} onChange={e => setForm({...form, dataNascimento: e.target.value})} />
            <input type="text" placeholder="CPF" value={form.cpf || ""} onChange={e => setForm({...form, cpf: e.target.value})} />
          </div>

          <div className="grid-3">
            <input 
              type="text" 
              placeholder="CEP XX.XXX-XXX" 
              value={form.cep || ""} 
              onChange={e => {
                const v = maskCEP(e.target.value);
                setForm({...form, cep: v});
                if (v.replace(/\D/g, "").length === 8) buscarCEP(v);
              }} 
            />
            <input type="text" placeholder="Endereço" value={form.endereco || ""} onChange={e => setForm({...form, endereco: e.target.value})} />
            <input type="text" placeholder="Nº" value={form.numero || ""} onChange={e => setForm({...form, numero: e.target.value})} />
          </div>

          <div className="grid-3">
            <input type="text" placeholder="Bairro" value={form.bairro || ""} onChange={e => setForm({...form, bairro: e.target.value})} />
            <input type="text" placeholder="Cidade" value={form.cidade || ""} onChange={e => setForm({...form, cidade: e.target.value})} />
            <input type="text" placeholder="Estado" value={form.estado || ""} onChange={e => setForm({...form, estado: e.target.value})} />
          </div>

          <label>Possui filhos?</label>
          <select value={form.possuiFilhos || "Não"} onChange={e => setForm({...form, possuiFilhos: e.target.value as any})}>
            <option value="Sim">Sim</option>
            <option value="Não">Não</option>
          </select>
        </div>
      </section>

      {/* DADOS SOCIOECONÔMICOS */}
      <section className="form-section">
        <h3>Dados Socioeconômicos</h3>
        <div className="form-group">
          <label>Identidade Racial</label>
          <select value={form.identidadeRacial || " "} onChange={e => setForm({...form, identidadeRacial: e.target.value as any})}>
            <option value="Preto">Preto</option>
            <option value="Pardo">Pardo</option>
            <option value="Branco">Branco</option>
            <option value="Indígena">Indígena</option>
            <option value="Amarelo">Amarelo</option>
          </select>

          <label>Identidade de Gênero</label>
          <select value={form.identidadeGenero || ""} onChange={e => setForm({...form, identidadeGenero: e.target.value})}>
            <option value="">Selecione...</option>
            <option value="Masculino">Masculino</option>
            <option value="Feminino">Feminino</option>
            <option value="Não-binário">Não-binário</option>
            <option value="Transgênero">Transgênero</option>
            <option value="Outro">Outro</option>
          </select>

          <div className="grid-2">
            <div>
              <label>Sua residência possui risco ambiental?</label>
              <select style={{ width: "100%" }} value={form.areaRiscoAmbiental || "Não"} onChange={e => setForm({...form, areaRiscoAmbiental: e.target.value as any})}><option value="Sim">Sim</option><option value="Não">Não</option></select>
            </div>
            <div>
              <label>Sua residência possui risco em segurança?</label>
              <select style={{ width: "100%" }} value={form.areaRiscoSeguranca || "Não"} onChange={e => setForm({...form, areaRiscoSeguranca: e.target.value as any})}><option value="Sim">Sim</option><option value="Não">Não</option></select>
            </div>
          </div>

          <label>Sua casa é:</label>
          <select value={form.tipoMoradia || "Própria"} onChange={e => setForm({...form, tipoMoradia: e.target.value as any})}>
            <option value="Própria">Própria</option>
            <option value="Alugada">Alugada</option>
            <option value="Cedida">Cedida</option>
            <option value="Posse">Posse</option>
            <option value="Ocupação">Ocupação</option>
            <option value="Outro">Outro</option>
          </select>

          <label>Quantas pessoas moram na sua casa?</label>
          <input type="text" value={form.quantidadeMoradores || ""} onChange={e => setForm({...form, quantidadeMoradores: Number(e.target.value.replace(/\D/g, ""))})} />

          <input type="text" placeholder="Renda Familiar Total" value={form.rendaFamiliar || ""} onChange={e => setForm({...form, rendaFamiliar: e.target.value})} />

          <label>Concluiu Ensino Médio?</label>
          <select value={form.concluiuEnsinoMedio || "Não"} onChange={e => setForm({...form, concluiuEnsinoMedio: e.target.value as any})}><option value="Sim">Sim</option><option value="Não">Não</option></select>
          
          <input type="text" placeholder="Instituição de Ensino" disabled={form.concluiuEnsinoMedio === "Não"} value={form.instituicaoEnsinoMedio || ""} onChange={e => setForm({...form, instituicaoEnsinoMedio: e.target.value})} />
          <input type="text" placeholder="Ano de Conclusão" disabled={form.concluiuEnsinoMedio === "Não"} value={form.anoConclusaoEnsinoMedio || ""} onChange={e => setForm({...form, anoConclusaoEnsinoMedio: e.target.value})} />
        </div>
      </section>

      {/* DADOS DE SAÚDE */}
      <section className="form-section">
        <h3>Dados de Saúde</h3>
        <div className="form-group">
          <label>Tipo Sanguíneo</label>
          <select value={form.tipoSanguineo || ""} onChange={e => setForm({...form, tipoSanguineo: e.target.value})}>
            <option value="">Selecione...</option>
            <option value="A+">A+</option><option value="A-">A-</option>
            <option value="B+">B+</option><option value="B-">B-</option>
            <option value="AB+">AB+</option><option value="AB-">AB-</option>
            <option value="O+">O+</option><option value="O-">O-</option>
            <option value="Não Sabe">Não Sabe</option>
          </select>

          <label>Você é uma pessoa com deficiência?</label>
          <select value={form.pcd || "Não"} onChange={e => setForm({...form, pcd: e.target.value as any})}><option value="Sim">Sim</option><option value="Não">Não</option></select>
          <input type="text" placeholder="Qual deficiência?" disabled={form.pcd === "Não"} value={form.pcdDescricao || ""} onChange={e => setForm({...form, pcdDescricao: e.target.value})} />

          <label>Faz uso regular de algum medicamento?</label>
          <select value={form.medicamentoRegular || "Não"} onChange={e => setForm({...form, medicamentoRegular: e.target.value as any})}><option value="Sim">Sim</option><option value="Não">Não</option></select>
          <input type="text" placeholder="Qual medicamento?" disabled={form.medicamentoRegular === "Não"} value={form.medicamentoDescricao || ""} onChange={e => setForm({...form, medicamentoDescricao: e.target.value})} />

          <label>Contatos de Emergência</label>
          <div className="grid-2">
            <input type="text" placeholder="Nome Emergência 1" value={form.contatoEmergencia1?.nome || ""} onChange={e => setForm({...form, contatoEmergencia1: {...form.contatoEmergencia1!, nome: e.target.value}})} />
            <input type="text" placeholder="Telefone (XX)XXXXX-XXXX" value={form.contatoEmergencia1?.telefone || ""} onChange={e => setForm({...form, contatoEmergencia1: {...form.contatoEmergencia1!, telefone: maskPhone(e.target.value)}})} />
          </div>

          <input type="file" multiple onChange={handleFileChange} style={{ marginTop: "15px" }} />
        </div>
      </section>

      {/* ÁREA DA FOTO */}
      <div style={{ textAlign: "center", margin: "30px 0", opacity: podeLiberarFoto ? 1 : 0.5, pointerEvents: podeLiberarFoto ? "all" : "none" }}>
        {!foto && !mostrarWebcam && <button onClick={() => setMostrarWebcam(true)}>📸 Abrir Câmara</button>}
        {mostrarWebcam && <WebcamCapture onCapture={img => { setFoto(img); setMostrarWebcam(false); }} onCancel={() => setMostrarWebcam(false)} />}
        {foto && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <img src={foto} style={{ width: "250px", borderRadius: "12px", border: "4px solid #0070f3" }} />
            <button onClick={() => setFoto(null)} style={{ marginTop: "15px", backgroundColor: "#e74c3c", color: "white" }}>🔄 Trocar Foto</button>
          </div>
        )}
      </div>

      <button 
        onClick={adicionarAluno} 
        className="btn-add" 
        disabled={!podeCadastrar}
        style={{ backgroundColor: podeCadastrar ? "#0070f3" : "#95a5a6", width: "100%", padding: "20px" }}
      >
        {!foto ? "📸 TIRE A FOTO PARA FINALIZAR" : "+ ADICIONAR ALUNO AO LOTE"}
      </button>

      {/* LISTAGEM DO LOTE */}
      <div className="lote-section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "40px 0 20px" }}>
          <h3>Alunos Cadastrados no Lote ({alunos.length})</h3>
          {alunos.length > 0 && <button onClick={baixarLoteImpressao} style={{ backgroundColor: "#e67e22" }}>🖨️ BAIXAR LOTE (PDF GRID)</button>}
        </div>

        {alunos.map((aluno, index) => (
          <div key={index} className="item-aluno" style={{ display: "flex", justifyContent: "space-between", padding: "10px", borderBottom: "1px solid #eee" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
              <img src={aluno.foto || ""} style={{ width: "50px", height: "50px", borderRadius: "50%", objectFit: "cover" }} />
              <strong>{aluno.nome}</strong>
            </div>
            <button onClick={() => baixarZipIndividual(aluno)} className="btn-zip">Download ZIP</button>
          </div>
        ))}
      </div>
    </div>
  );
}