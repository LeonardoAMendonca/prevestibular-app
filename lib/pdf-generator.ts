import { PDFDocument, rgb, StandardFonts, PageSizes, PDFPage } from "pdf-lib";
import { Aluno } from "@/types";

const cmToPts = (cm: number) => cm * 28.346;
const inchToPts = (inch: number) => inch * 72;
const cardWidth = cmToPts(8.56);
const cardHeight = cmToPts(5.41);

async function fetchImage(path: string) {
  const res = await fetch(path);
  return await res.arrayBuffer();
}

export async function renderizarLadoNoPdf(pdfDoc: PDFDocument, page: PDFPage, aluno: Aluno, x: number, y: number, isVerso: boolean) {
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const colorText = rgb(0.15, 0.15, 0.15);

  try {
    const imgPath = isVerso ? '/baseback.png' : '/base.png';
    const bytes = await fetchImage(imgPath);
    const img = await pdfDoc.embedPng(bytes).catch(() => pdfDoc.embedJpg(bytes));
    page.drawImage(img, { x, y, width: cardWidth, height: cardHeight });
  } catch (e) { console.error("Erro base", e); }

  if (!isVerso) {
    // Lógica de Logos
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
      } catch (e) {}
    }

    // Foto
    if (aluno.foto) {
      const fBytes = Uint8Array.from(atob(aluno.foto.split(",")[1]), c => c.charCodeAt(0));
      const fImg = await pdfDoc.embedPng(fBytes);
      const fSize = cmToPts(3.37);
      page.drawImage(fImg, { x: x + cmToPts(0.5), y: y + cardHeight - cmToPts(1.0) - fSize, width: fSize, height: fSize });
    }

    // Nome e Dados (Lógica de Auto-ajuste)
    const nomeOriginal = aluno.nome.toUpperCase();
    const nomeX = x + inchToPts(1.688);
    const maxW = (x + cardWidth) - nomeX - inchToPts(0.177);
    let nSize = 5;
    let nLines: string[] = [nomeOriginal];

    while (nSize > 2) {
      const words = nomeOriginal.split(' ');
      let tmp = ['']; let curr = 0; let fit = true;
      for (const w of words) {
        const sp = tmp[curr] === '' ? '' : ' ';
        if (fontBold.widthOfTextAtSize(tmp[curr] + sp + w, nSize) <= maxW) { tmp[curr] += sp + w; }
        else { curr++; if (curr >= 2) { fit = false; break; } tmp[curr] = w; }
      }
      if (fit) { nLines = tmp.filter(l => l !== ''); break; }
      nSize -= 0.1;
    }
    
    nLines.forEach((l, i) => {
      page.drawText(l, { x: nomeX, y: (y + cardHeight) - inchToPts(0.647) - nSize - (i * (nSize + 1.5)), size: nSize, font: fontBold, color: colorText });
    });

    const dataFmt = aluno.dataNascimento.split('-').reverse().join('/');
    page.drawText(dataFmt, { x: x + inchToPts(1.690), y: y + cardHeight - inchToPts(0.977) - 5, size: 5, font: fontBold, color: colorText });
    page.drawText(aluno.telefoneWhatsapp, { x: x + inchToPts(1.688), y: y + cardHeight - inchToPts(1.316) - 5, size: 5, font: fontBold, color: colorText });
  }
}

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

      await renderizarLadoNoPdf(pdfDoc, pageF, lote[j], xF, y, false);
      const colV = col === 0 ? 1 : 0;
      const xV = startX + (colV * (cardWidth + gapX));
      await renderizarLadoNoPdf(pdfDoc, pageV, lote[j], xV, y, true);
    }
  }
  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
}