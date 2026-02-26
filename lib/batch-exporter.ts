import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Aluno } from "@/types";
import { gerarFichaMatriculaWord } from "./docx-generator";
import { renderizarLadoNoPdf } from "./pdf-generator";
import { PDFDocument, PageSizes } from "pdf-lib";
import Swal from "sweetalert2";

export async function exportarLoteCompletoZip(alunos: Aluno[]) {
  if (alunos.length === 0) {
    Swal.fire("Atenção", "Não há alunos para exportar.", "warning");
    return;
  }

  const zip = new JSZip();
  const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  const pastaRaiz = zip.folder(`LOTE_PJU_${dataAtual}`);

  Swal.fire({
    title: 'Gerando Lote de Documentos',
    html: `Processando <b>${alunos.length}</b> registros...`,
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });

  try {
    for (const aluno of alunos) {
      // Pasta: "NOME DO ALUNO - CPF"
      const nomePasta = `${aluno.nome.toUpperCase()} - ${aluno.cpf}`;
      const pastaAluno = pastaRaiz?.folder(nomePasta);

      // 1. Gerar Ficha de Matrícula (Word)
      const docxBlob = await gerarFichaMatriculaWord(aluno);
      pastaAluno?.file(`FICHA_MATRICULA_${aluno.nome.split(' ')[0]}.docx`, docxBlob);

      // 2. Gerar Carteirinha Individual (PDF)
      const pdfDoc = await PDFDocument.create();
      const pageF = pdfDoc.addPage(PageSizes.A4);
      const pageV = pdfDoc.addPage(PageSizes.A4);
      
      // Centraliza a carteirinha no A4 (dimensões baseadas no seu pdf-generator)
      const cardWidthPts = 242.6; 
      const xPos = (pageF.getWidth() - cardWidthPts) / 2;
      const yPos = (pageF.getHeight() - 153.3) / 2;

      await renderizarLadoNoPdf(pdfDoc, pageF, aluno, xPos, yPos, false); // Frente
      await renderizarLadoNoPdf(pdfDoc, pageV, aluno, xPos, yPos, true);  // Verso
      
      const pdfBytes = await pdfDoc.save();
      pastaAluno?.file(`CARTEIRINHA_${aluno.nome.split(' ')[0]}.pdf`, pdfBytes);

      // 3. Adicionar APENAS Documentos Anexados
      if (aluno.documentos && aluno.documentos.length > 0) {
        const pastaDocs = pastaAluno?.folder("ANEXOS");
        aluno.documentos.forEach((arquivo: File) => {
          pastaDocs?.file(arquivo.name, arquivo);
        });
      }
    }

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `EXPORTACAO_LOTE_${dataAtual}.zip`);

    Swal.fire({
      icon: 'success',
      title: 'Concluído',
      text: 'O arquivo compactado foi gerado com sucesso.',
      timer: 2000
    });

  } catch (error) {
    console.error(error);
    Swal.fire("Erro", "Falha ao gerar o lote.", "error");
  }
}