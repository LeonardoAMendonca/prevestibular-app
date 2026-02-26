import {
  PDFDocument,
  rgb,
  StandardFonts,
  PageSizes,
  PDFPage,
  pushGraphicsState,
  popGraphicsState,
  clip,
  endPath,
  moveTo,
  appendBezierCurve,
  closePath
} from "pdf-lib";
import { Aluno } from "@/types";

type AlunoPDF = Aluno & {
  operadorResponsavel?: string;
  telefoneResponsavel?: string;
};

const cmToPts = (cm: number) => cm * 28.346;
const inchToPts = (inch: number) => inch * 72;
const cardWidth = cmToPts(8.56);
const cardHeight = cmToPts(5.41);

async function fetchImage(path: string) {
  const res = await fetch(path);
  return await res.arrayBuffer();
}

export async function renderizarLadoNoPdf(
  pdfDoc: PDFDocument,
  page: PDFPage,
  aluno: AlunoPDF,
  x: number,
  y: number,
  isVerso: boolean
) {
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const colorText = rgb(0.15, 0.15, 0.15);

  // Renderização da imagem de fundo (frente ou verso)
  try {
    const imgPath = isVerso ? '/baseback.png' : '/base.png';
    const bytes = await fetchImage(imgPath);
    const img = await pdfDoc.embedPng(bytes).catch(() => pdfDoc.embedJpg(bytes));
    page.drawImage(img, { x, y, width: cardWidth, height: cardHeight });
  } catch (e) { console.error("Erro base", e); }

  if (!isVerso) {
    // Inserção de logotipos institucionais
    const logos = [
      { path: '/pju.png', L: 0, T: 0, R: 2.736, B: 1.729 },
      { path: '/acao.png', L: 2.392, T: 1.844, R: 0.567, B: 0.026 },
      { path: '/unilasalle.png', L: 2.803, T: 1.818, R: 0.071, B: 0 }
    ];

    for (const logo of logos) {
      try {
        const b = await fetchImage(logo.path);
        const i = await pdfDoc.embedPng(b).catch(() => pdfDoc.embedJpg(b));
        page.drawImage(i, {
          x: x + inchToPts(logo.L),
          y: y + inchToPts(logo.B),
          width: cardWidth - inchToPts(logo.L) - inchToPts(logo.R),
          height: cardHeight - inchToPts(logo.T) - inchToPts(logo.B)
        });
      } catch (e) { }
    }

    // Processamento da foto do aluno com máscara de recorte oval
    if (aluno.foto) {
      try {
        const base64Data = aluno.foto.includes(',') ? aluno.foto.split(',')[1] : aluno.foto;
        const fBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const fImg = await pdfDoc.embedPng(fBytes).catch(() => pdfDoc.embedJpg(fBytes));

        const fWidth = cmToPts(2.6);
        const fHeight = cmToPts(3.8);
        const photoX = x + cmToPts(1);
        const photoY = y + cardHeight - cmToPts(0.8) - fHeight;

        const rx = fWidth / 2;
        const ry = fHeight / 2;
        const cx = photoX + rx;
        const cy = photoY + ry;
        const k = 0.5522847498;
        const cdx = rx * k;
        const cdy = ry * k;

        page.drawEllipse({
          x: cx, y: cy,
          xScale: rx, yScale: ry,
          color: rgb(1, 1, 1),
        });

        // Criação da máscara de recorte via curvas de Bézier
        page.pushOperators(pushGraphicsState());
        page.pushOperators(
          moveTo(cx + rx, cy),
          appendBezierCurve(cx + rx, cy + cdy, cx + cdx, cy + ry, cx, cy + ry),
          appendBezierCurve(cx - cdx, cy + ry, cx - rx, cy + cdy, cx - rx, cy),
          appendBezierCurve(cx - rx, cy - cdy, cx - cdx, cy - ry, cx, cy - ry),
          appendBezierCurve(cx + cdx, cy - ry, cx + rx, cy - cdy, cx + rx, cy),
          closePath(),
          clip(),
          endPath()
        );

        // Lógica de redimensionamento centralizado (Object-fit: cover)
        const imgDims = fImg.scale(1);
        const imgRatio = imgDims.width / imgDims.height;
        const ovalRatio = fWidth / fHeight;
        let drawW, drawH, drawX, drawY;

        if (imgRatio > ovalRatio) {
          drawH = fHeight;
          drawW = fHeight * imgRatio;
          drawX = photoX - (drawW - fWidth) / 2;
          drawY = photoY;
        } else {
          drawW = fWidth;
          drawH = fWidth / imgRatio;
          drawX = photoX;
          drawY = photoY - (drawH - fHeight) / 2;
        }

        page.drawImage(fImg, { x: drawX, y: drawY, width: drawW, height: drawH });
        page.pushOperators(popGraphicsState());
      } catch (e) { console.error("Erro foto", e); }
    }

    // Renderização do nome com ajuste automático de tamanho de fonte e quebra de linha
    const nomeOriginal = (aluno.nome || "").toUpperCase();
    const nomeX = x + inchToPts(1.55);
    
    // 1. Defina seus limites de caixa aqui
    const maxW = cmToPts(3.5); // Largura máxima da caixa
    const maxH = cmToPts(1); // Altura máxima da caixa (o limite vertical)
    
    let nSize = 9; // Tamanho inicial
    let nLines: string[] = [];
    let alturaTotal = 0;

    // Loop de "Best Fit" (Melhor Encaixe)
    while (nSize > 2) {
      const words = nomeOriginal.split(' ');
      let linhasTemporarias: string[] = [''];
      let curr = 0;

      // Tenta distribuir as palavras nas linhas respeitando a largura (maxW)
      for (const w of words) {
        const sp = linhasTemporarias[curr] === '' ? '' : ' ';
    const larguraTeste = fontBold.widthOfTextAtSize(linhasTemporarias[curr] + sp + w, nSize);
        
        if (larguraTeste <= maxW) {
          linhasTemporarias[curr] += sp + w;
        } else {
          curr++;
          linhasTemporarias[curr] = w;
        }
      }

      // 2. Calcula a altura que esse bloco de texto ocuparia
      // (Quantidade de linhas * tamanho da fonte) + (espaçamento entre linhas)
      const espacamento = 1.5;
      alturaTotal = (linhasTemporarias.length * nSize) + ((linhasTemporarias.length - 1) * espacamento);

      // 3. Condição de parada: se a altura total couber no limite vertical, aceitamos
      if (alturaTotal <= maxH) {
        nLines = linhasTemporarias;
        break; 
      }

      // Se não couber na altura, diminui a fonte e tenta distribuir tudo de novo
      nSize -= 0.2;
    }

    // Renderização
    nLines.forEach((l, i) => {
      page.drawText(l, {
        x: nomeX,
        // O texto começa no topo da caixa e desce conforme o índice da linha
        y: (y + cardHeight) - inchToPts(0.600) - (i * (nSize + 1.5)),
        size: nSize,
        font: fontBold,
        color: colorText
      });
    });

    // Lógica para definir contato prioritário (Responsável vs Aluno)
    let zapFinal = aluno.telefoneWhatsapp || "";
    if (aluno.alunoEProprioResponsavel === "Não" && aluno.telefoneResponsavel) {
      zapFinal = aluno.telefoneResponsavel;
    }
    let zapEmergencia = aluno.telefoneEmergencia1 || "";

    // Cálculo automático do ano de validade baseado na criação do registro
    let anoValidade = new Date().getFullYear().toString();
    if (aluno.dataCriacao) {
      const partes = aluno.dataCriacao.includes('/') ? aluno.dataCriacao.split('/') : aluno.dataCriacao.split('-');
      const parteAno = partes.find(p => p.length === 4);
      if (parteAno) anoValidade = parteAno;
    }
    const validadeFinal = `12/${anoValidade}`;

    // Desenho dos blocos de informações (Contato, Emergência e Validade)
    const yContato = y + cardHeight - inchToPts(0.977);
    page.drawText("Contato:", { x: x + inchToPts(1.55), y: yContato,size: 6, font: fontBold, color: colorText });
    page.drawText(zapFinal, { x: x + inchToPts(1.55), y: yContato - 8, size: 8, font: fontBold, color: colorText });

    const yEmergencia = y + cardHeight - inchToPts(1.316);
    page.drawText("Contato de emergência:", { x: x + inchToPts(1.55), y: yEmergencia, size: 6, font: fontBold, color: colorText });
    page.drawText(zapEmergencia, { x: x + inchToPts(1.55), y: yEmergencia - 8, size: 8, font: fontBold, color: colorText });

    const yValidade = y + cardHeight - inchToPts(1.655);
    page.drawText("Validade:", { x: x + inchToPts(1.55), y: yValidade, size: 6, font: fontBold, color: colorText });
    page.drawText(validadeFinal, { x: x + inchToPts(1.55), y: yValidade - 8, size: 8, font: fontBold, color: colorText });
  }
}

// Função principal para geração de múltiplas carteirinhas em papel A4
export async function gerarPdfLote(alunos: Aluno[]) {
  const pdfDoc = await PDFDocument.create();
  const gapX = cmToPts(0.5);
  const gapY = cmToPts(0.5);

  for (let i = 0; i < alunos.length; i += 8) {
    const pageF = pdfDoc.addPage(PageSizes.A4);
    const pageV = pdfDoc.addPage(PageSizes.A4);
    const startX = (pageF.getWidth() - (cardWidth * 2 + gapX)) / 2;
    const startY = (pageF.getHeight() - (cardHeight * 4 + gapY * 3)) / 2;
    const lote = alunos.slice(i, i + 8);

    for (let j = 0; j < lote.length; j++) {
      const col = j % 2;
      const row = Math.floor(j / 2);
      const xF = startX + (col * (cardWidth + gapX));
      const y = startY + ((3 - row) * (cardHeight + gapY));

      await renderizarLadoNoPdf(pdfDoc, pageF, lote[j] as AlunoPDF, xF, y, false);

      const colV = col === 0 ? 1 : 0;
      const xV = startX + (colV * (cardWidth + gapX));
      await renderizarLadoNoPdf(pdfDoc, pageV, lote[j] as AlunoPDF, xV, y, true);
    }
  }
  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes as any], { type: "application/pdf" });
}