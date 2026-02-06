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
  appendBezierCurve, // Importação CORRETA para curvas
  closePath
} from "pdf-lib";
import { Aluno } from "@/types";

// Extensão de tipo para evitar erros de TypeScript com campos opcionais
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

  try {
    const imgPath = isVerso ? '/baseback.png' : '/base.png';
    const bytes = await fetchImage(imgPath);
    const img = await pdfDoc.embedPng(bytes).catch(() => pdfDoc.embedJpg(bytes));
    page.drawImage(img, { x, y, width: cardWidth, height: cardHeight });
  } catch (e) { console.error("Erro base", e); }

  if (!isVerso) {
    // 1. LOGOS (Posições exatas do seu código original)
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

    // 2. FOTO COM RECORTE CIRCULAR (CLIPPING MASK)
    if (aluno.foto) {
      try {
        // Tratamento do base64
        const base64Data = aluno.foto.includes(',') ? aluno.foto.split(',')[1] : aluno.foto;
        const fBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const fImg = await pdfDoc.embedPng(fBytes).catch(() => pdfDoc.embedJpg(fBytes));
        
        // Definições de tamanho e posição (3.37cm)
        const fSize = cmToPts(3.37); 
        const photoX = x + cmToPts(0.5);
        const photoY = y + cardHeight - cmToPts(1.0) - fSize;

        // Cálculos matemáticos para o círculo (Curvas de Bézier)
        const r = fSize / 2;       // Raio
        const cx = photoX + r;     // Centro X
        const cy = photoY + r;     // Centro Y
        const k = 0.5522847498;    // Constante "Kappa" para aproximar círculo perfeito
        const cd = r * k;          // Distância de controle

        // A. Fundo Branco (para garantir limpeza atrás da foto)
        page.drawEllipse({
            x: cx, y: cy, xScale: r, yScale: r,
            color: rgb(1, 1, 1),
        });

        // B. Inicia o Recorte
        page.pushOperators(pushGraphicsState());

        // Constrói o caminho do círculo manualmente usando appendBezierCurve
        // A ordem é: moveTo(inicio) -> 4 curvas -> closePath -> clip -> endPath
        page.pushOperators(
          moveTo(cx + r, cy), // Começa na direita (0 graus)

          // Quadrante 1: Direita -> Topo
          appendBezierCurve(cx + r, cy + cd, cx + cd, cy + r, cx, cy + r),
          
          // Quadrante 2: Topo -> Esquerda
          appendBezierCurve(cx - cd, cy + r, cx - r, cy + cd, cx - r, cy),
          
          // Quadrante 3: Esquerda -> Baixo
          appendBezierCurve(cx - r, cy - cd, cx - cd, cy - r, cx, cy - r),
          
          // Quadrante 4: Baixo -> Direita
          appendBezierCurve(cx + cd, cy - r, cx + r, cy - cd, cx + r, cy),

          closePath(), 
          clip(),    // Transforma o caminho desenhado acima em máscara
          endPath()  
        );

        // C. Lógica "Cover" (Preencher o círculo sem distorcer a imagem)
        const imgDims = fImg.scale(1);
        const imgRatio = imgDims.width / imgDims.height;
        
        let drawW = fSize;
        let drawH = fSize;
        let drawX = photoX;
        let drawY = photoY;

        if (imgRatio > 1) { 
             // Foto mais larga que alta (Landscape)
             drawH = fSize;
             drawW = fSize * imgRatio;
             drawX = photoX - (drawW - fSize) / 2; // Centraliza horizontalmente
        } else { 
             // Foto mais alta que larga (Portrait)
             drawW = fSize;
             drawH = fSize / imgRatio;
             drawY = photoY - (drawH - fSize) / 2; // Centraliza verticalmente
        }

        // Desenha a imagem (será cortada pelo clip)
        page.drawImage(fImg, { x: drawX, y: drawY, width: drawW, height: drawH });

        // D. Restaura estado (Remove o recorte para os próximos elementos)
        page.pushOperators(popGraphicsState());

      } catch (e) { console.error("Erro foto", e); }
    }

    // 3. NOME (Lógica de Auto-ajuste original)
    const nomeOriginal = (aluno.nome || "").toUpperCase();
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
      page.drawText(l, { 
        x: nomeX, 
        y: (y + cardHeight) - inchToPts(0.647) - nSize - (i * (nSize + 1.5)), 
        size: nSize, 
        font: fontBold, 
        color: colorText 
      });
    });

    // ... (Código anterior: Logos, Foto, Nome) ...

    // 4. DADOS FINAIS (Alterado: Contato e Validade)
    
    // --- LÓGICA DO CONTATO ---
    // Prioriza o telefone do responsável se o aluno não for o próprio responsável
    let zapFinal = aluno.telefoneWhatsapp || "";
    if (aluno.alunoEProprioResponsavel === "Não" && aluno.telefoneResponsavel) {
        zapFinal = aluno.telefoneResponsavel;
    }

    // --- LÓGICA DA VALIDADE ---
    // Pega o ano da data de criação e define como 31/12 daquele ano
    let anoValidade = new Date().getFullYear().toString(); // Fallback: Ano atual
    
    if (aluno.dataCriacao) {
        // Tenta extrair o ano da string (suporta DD/MM/YYYY ou YYYY-MM-DD)
        const partes = aluno.dataCriacao.includes('/') 
            ? aluno.dataCriacao.split('/') 
            : aluno.dataCriacao.split('-');
            
        // Se a string tem 4 dígitos, assumimos que é o ano
        const parteAno = partes.find(p => p.length === 4);
        if (parteAno) anoValidade = parteAno;
    }
    const validadeFinal = `31/12/${anoValidade}`;

    // --- DESENHAR CONTATO (Posição Superior) ---
    // Onde antes ficava o nascimento
    const yContato = y + cardHeight - inchToPts(0.977);
    
    page.drawText("CONTATO:", { 
        x: x + inchToPts(1.690), 
        y: yContato, 
        size: 4, // Rótulo menor
        font: fontBold, 
        color: colorText 
    });
    
    page.drawText(zapFinal, { 
        x: x + inchToPts(1.690), 
        y: yContato - 6, // Valor logo abaixo
        size: 5, 
        font: fontBold, 
        color: colorText 
    });

    // --- DESENHAR VALIDADE (Posição Inferior) ---
    // Onde antes ficava o telefone
    const yValidade = y + cardHeight - inchToPts(1.316);

    page.drawText("VALIDADE:", { 
        x: x + inchToPts(1.688), 
        y: yValidade, 
        size: 4, // Rótulo menor
        font: fontBold, 
        color: colorText 
    });

    page.drawText(validadeFinal, { 
        x: x + inchToPts(1.688), 
        y: yValidade - 6, // Valor logo abaixo
        size: 5, 
        font: fontBold, 
        color: colorText 
    });
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

      await renderizarLadoNoPdf(pdfDoc, pageF, lote[j] as AlunoPDF, xF, y, false);
      
      const colV = col === 0 ? 1 : 0;
      const xV = startX + (colV * (cardWidth + gapX));
      await renderizarLadoNoPdf(pdfDoc, pageV, lote[j] as AlunoPDF, xV, y, true);
    }
  }
  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes as any], { type: "application/pdf" });
}