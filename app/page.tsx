"use client";

import { useState, useRef } from "react";
import Webcam from "react-webcam";
import { PDFDocument } from "pdf-lib";
import { saveAs } from "file-saver";

type Aluno = {
  nome: string;
  tipoSanguineo: string;
  documentos: File[];
  foto: string | null;
};

export default function Home() {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [nome, setNome] = useState("");
  const [tipoSanguineo, setTipoSanguineo] = useState("");
  const [documentos, setDocumentos] = useState<File[]>([]);
  const [foto, setFoto] = useState<string | null>(null);

  const webcamRef = useRef<Webcam>(null);

  const capturarFoto = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setFoto(imageSrc);
    }
  };

  const adicionarAluno = () => {
    const novoAluno: Aluno = { nome, tipoSanguineo, documentos, foto };
    setAlunos([...alunos, novoAluno]);
    setNome("");
    setTipoSanguineo("");
    setDocumentos([]);
    setFoto(null);
  };

  const gerarPdfAluno = async (aluno: Aluno) => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 400]);
    page.drawText(`Nome: ${aluno.nome}`, { x: 50, y: 350, size: 20 });
    page.drawText(`Tipo sanguíneo: ${aluno.tipoSanguineo}`, { x: 50, y: 320, size: 20 });

    if (aluno.foto) {
      const imgBytes = Uint8Array.from(atob(aluno.foto.split(",")[1]), c => c.charCodeAt(0));
      const img = await pdfDoc.embedPng(imgBytes);
      page.drawImage(img, { x: 400, y: 200, width: 150, height: 150 });
    }

    // Adicionar documentos anexados (se forem PDFs)
    for (const doc of aluno.documentos) {
      const bytes = await doc.arrayBuffer();
      try {
        const docPdf = await PDFDocument.load(bytes);
        const copiedPages = await pdfDoc.copyPages(docPdf, docPdf.getPageIndices());
        copiedPages.forEach((p) => pdfDoc.addPage(p));
      } catch {
        // Se não for PDF, ignora
      }
    }

    const pdfBytes: Uint8Array = await pdfDoc.save();
saveAs(new Blob([pdfBytes as BlobPart], { type: "application/pdf" }), `${aluno.nome}.pdf`);

  };

  const gerarCarteirinhas = async () => {
    const pdfDoc = await PDFDocument.create();
    for (const aluno of alunos) {
      const page = pdfDoc.addPage([300, 200]);
      page.drawText(aluno.nome, { x: 20, y: 160, size: 16 });
      page.drawText(`Tipo sanguíneo: ${aluno.tipoSanguineo}`, { x: 20, y: 140, size: 14 });

      if (aluno.foto) {
        const imgBytes = Uint8Array.from(atob(aluno.foto.split(",")[1]), c => c.charCodeAt(0));
        const img = await pdfDoc.embedPng(imgBytes);
        page.drawImage(img, { x: 180, y: 50, width: 100, height: 100 });
      }
    }
    const pdfBytes: Uint8Array = await pdfDoc.save();
saveAs(new Blob([pdfBytes as BlobPart], { type: "application/pdf" }), "carteirinhas.pdf");

  };

  return (
    <div>
      <h1>Cadastro de Alunos</h1>
      <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" />
      <input value={tipoSanguineo} onChange={(e) => setTipoSanguineo(e.target.value)} placeholder="Tipo sanguíneo" />
      <input type="file" multiple onChange={(e) => setDocumentos(Array.from(e.target.files || []))} />
      <Webcam ref={webcamRef} screenshotFormat="image/png" />
      <button onClick={capturarFoto}>Capturar Foto</button>
      <button onClick={adicionarAluno}>Adicionar Aluno</button>

      {alunos.map((aluno, idx) => (
        <div key={idx} className="aluno-card">
          <p><strong>{aluno.nome}</strong></p>
          <p>Tipo sanguíneo: {aluno.tipoSanguineo}</p>
          {aluno.foto && <img src={aluno.foto} alt="Foto do aluno" width="100" />}
          <button onClick={() => gerarPdfAluno(aluno)}>Gerar PDF do Aluno</button>
        </div>
      ))}

      {alunos.length > 0 && (
        <button onClick={gerarCarteirinhas}>Gerar Carteirinhas PDF</button>
      )}
    </div>
  );
}
