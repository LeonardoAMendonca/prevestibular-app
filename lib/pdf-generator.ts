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

// 2. FOTO COM RECORTE ELÍPTICO (Oval)
    if (aluno.foto) {
      try {
        const base64Data = aluno.foto.includes(',') ? aluno.foto.split(',')[1] : aluno.foto;
        const fBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const fImg = await pdfDoc.embedPng(fBytes).catch(() => pdfDoc.embedJpg(fBytes));
        
        // --- CONFIGURAÇÕES DE TAMANHO ---
        const fHeight = cmToPts(3.37); // Altura total (igual ao original)
        const fatorLargura = 0.75;     // <--- ALTERE AQUI (1.0 = Círculo, 0.75 = Oval mais estreito)
        const fWidth = fHeight * fatorLargura;

        // Posição (Centralizando horizontalmente na área original)
        // O original era: x + cmToPts(0.5). Vamos manter o centro alinhado.
        const centroOriginalX = x + cmToPts(0.5) + (fHeight / 2);
        const photoY = y + cardHeight - cmToPts(1.0) - fHeight;
        
        const cy = photoY + (fHeight / 2); // Centro Y
        const cx = centroOriginalX;        // Centro X

        const ry = fHeight / 2; // Raio Vertical
        const rx = fWidth / 2;  // Raio Horizontal (Controla a largura)

        const k = 0.5522847498; // Constante Kappa
        const cdX = rx * k;     // Distância de controle Horizontal
        const cdY = ry * k;     // Distância de controle Vertical

        // A. Fundo Branco (Agora Elíptico)
        page.drawEllipse({
            x: cx, y: cy, 
            xScale: rx, yScale: ry, // Raios diferentes
            color: rgb(1, 1, 1),
        });

        // B. Inicia o Recorte
        page.pushOperators(pushGraphicsState());

        // Constrói a Elipse manualmente
        page.pushOperators(
          moveTo(cx + rx, cy), // Ponto inicial (Direita)

          // Q1: Direita -> Topo
          appendBezierCurve(cx + rx, cy + cdY, cx + cdX, cy + ry, cx, cy + ry),
          
          // Q2: Topo -> Esquerda
          appendBezierCurve(cx - cdX, cy + ry, cx - rx, cy + cdY, cx - rx, cy),
          
          // Q3: Esquerda -> Baixo
          appendBezierCurve(cx - rx, cy - cdY, cx - cdX, cy - ry, cx, cy - ry),
          
          // Q4: Baixo -> Direita
          appendBezierCurve(cx + cdX, cy - ry, cx + rx, cy - cdY, cx + rx, cy),

          closePath(), 
          clip(),    
          endPath()  
        );

        // C. Lógica "Cover" (Ajustada para preencher a elipse)
        // Usamos fHeight como base para garantir que cubra a altura
        const imgDims = fImg.scale(1);
        const imgRatio = imgDims.width / imgDims.height;
        
        let drawW, drawH, drawX, drawY;

        // Lógica simplificada: Queremos que a imagem cubra o retângulo (fWidth x fHeight)
        // Mas para garantir cobertura total na elipse, focamos na maior dimensão ou no ratio
        const boxRatio = fWidth / fHeight;

        if (imgRatio > boxRatio) { 
             // Imagem mais larga que a elipse -> Ajusta pela altura
             drawH = fHeight;
             drawW = fHeight * imgRatio;
             drawX = cx - (drawW / 2);
             drawY = cy - (drawH / 2);
        } else { 
             // Imagem mais alta/estreita que a elipse -> Ajusta pela largura
             drawW = fWidth;
             drawH = fWidth / imgRatio;
             // Se mesmo ajustando pela largura, a altura ficar menor que a necessária (raro em elipse vertical), forçamos altura
             if (drawH < fHeight) {
                drawH = fHeight;
                drawW = fHeight * imgRatio;
             }
             drawX = cx - (drawW / 2);
             drawY = cy - (drawH / 2);
        }

        page.drawImage(fImg, { x: drawX, y: drawY, width: drawW, height: drawH });

        // D. Restaura estado
        page.pushOperators(popGraphicsState());

      } catch (e) { console.error("Erro foto", e); }
    }

    // 3. NOME (Lógica de Auto-ajuste original)
    const nomeOriginal = (aluno.nome || "").toUpperCase();
    const nomeX = x + inchToPts(1.688);
    const maxW = (x + cardWidth) - nomeX - inchToPts(0.177);
    let nSize = 8;
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

// 4. DADOS FINAIS (Posições Ajustadas para Nome de 2 Linhas)
    
    // --- LÓGICA DO CONTATO ---
    let zapFinal = aluno.telefoneWhatsapp || "";
    if (aluno.alunoEProprioResponsavel === "Não" && aluno.telefoneResponsavel) {
        zapFinal = aluno.telefoneResponsavel;
    }

    // --- LÓGICA DA VALIDADE ---
    let anoValidade = new Date().getFullYear().toString();
    if (aluno.dataCriacao) {
        const partes = aluno.dataCriacao.includes('/') 
            ? aluno.dataCriacao.split('/') 
            : aluno.dataCriacao.split('-');
        const parteAno = partes.find(p => p.length === 4);
        if (parteAno) anoValidade = parteAno;
    }
    const validadeFinal = `31/12/${anoValidade}`;

    // --- DESENHAR CONTATO ---
    // AJUSTE: Alterado de 0.977 para 1.15 (Desceu para dar espaço ao nome duplo)
    const yContato = y + cardHeight - inchToPts(1.15); 
    
    page.drawText("CONTATO:", { 
        x: x + inchToPts(1.690), 
        y: yContato, 
        size: 5, 
        font: fontBold, 
        color: colorText 
    });
    
    page.drawText(zapFinal, { 
        x: x + inchToPts(1.690), 
        y: yContato - 8, 
        size: 7, 
        color: colorText 
    });

    // --- DESENHAR VALIDADE ---
    // AJUSTE: Alterado de 1.316 para 1.50 (Desceu proporcionalmente)
    const yValidade = y + cardHeight - inchToPts(1.50);

    page.drawText("VALIDADE:", { 
        x: x + inchToPts(1.688), 
        y: yValidade, 
        size: 5, 
        font: fontBold, 
        color: colorText 
    });

    page.drawText(validadeFinal, { 
        x: x + inchToPts(1.688), 
        y: yValidade - 8,
        size: 7, 
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

// === NOVA FUNÇÃO: FICHA CADASTRAL A4 ===
export async function gerarFichaMatricula(aluno: Aluno) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage(PageSizes.A4);
  const { width, height } = page.getSize();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = height - 50;
  const margin = 50;
  const lineHeight = 18;

  // Título
  page.drawText('FICHA DE MATRÍCULA', { x: margin, y, size: 18, font: fontBold });
  y -= 30;

  // Foto no topo à direita
  if (aluno.foto) {
    try {
        const base64Data = aluno.foto.includes(',') ? aluno.foto.split(',')[1] : aluno.foto;
        const fBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const fImg = await pdfDoc.embedPng(fBytes).catch(() => pdfDoc.embedJpg(fBytes));
        page.drawImage(fImg, { x: width - 150, y: height - 160, width: 100, height: 110 });
    } catch(e) {}
  }

  // Função Auxiliar para escrever linhas
  const drawField = (label: string, value: string) => {
    page.drawText(`${label}:`, { x: margin, y, size: 10, font: fontBold });
    page.drawText(value || "-", { x: margin + 140, y, size: 10, font: fontRegular });
    y -= lineHeight;
  };

  const drawSection = (title: string) => {
    y -= 10;
    page.drawRectangle({ x: margin, y: y - 5, width: width - (margin*2), height: 20, color: rgb(0.9, 0.9, 0.9) });
    page.drawText(title, { x: margin + 5, y, size: 11, font: fontBold });
    y -= 25;
  };

  // Metadados
  page.drawText(`Data de Cadastro: ${aluno.dataCriacao}`, { x: margin, y, size: 8, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
  y -= 20;

  drawSection("DADOS PESSOAIS");
  drawField("Nome Completo", aluno.nome);
  drawField("CPF", aluno.cpf);
  drawField("Data de Nascimento", aluno.dataNascimento.split('-').reverse().join('/'));
  drawField("WhatsApp", aluno.telefoneWhatsapp);
  drawField("Tel. Secundário", aluno.telefoneSecundario);
  drawField("Possui Filhos", aluno.possuiFilhos);

  drawSection("ENDEREÇO");
  drawField("CEP", aluno.cep);
  drawField("Logradouro", `${aluno.endereco}, ${aluno.numero}`);
  drawField("Bairro", aluno.bairro);
  drawField("Cidade/UF", `${aluno.cidade} - ${aluno.estado}`);
  
  drawSection("DADOS SOCIOECONÔMICOS");
  drawField("Identidade Racial", aluno.identidadeRacial);
  drawField("Identidade de Gênero", aluno.identidadeGenero);
  drawField("Risco Ambiental", aluno.areaRiscoAmbiental);
  drawField("Risco Segurança", aluno.areaRiscoSeguranca);
  drawField("Tipo de Moradia", aluno.tipoMoradia);
  drawField("Qtd. Moradores", aluno.quantidadeMoradores.toString());
  drawField("Ensino Médio", aluno.concluiuEnsinoMedio === "Sim" ? "Concluído" : "Não Concluído");
  if(aluno.concluiuEnsinoMedio === "Sim") {
      drawField("Instituição", aluno.instituicaoEnsinoMedio);
      drawField("Ano Conclusão", aluno.anoConclusaoEnsinoMedio);
  }

  drawSection("SAÚDE");
  drawField("Tipo Sanguíneo", aluno.tipoSanguineo);

  // Rodapé
  page.drawText("Declaro que as informações acima são verdadeiras.", { 
      x: margin, y: 50, size: 8, font: fontRegular, color: rgb(0.4, 0.4, 0.4) 
  });
  page.drawLine({
      start: { x: margin, y: 80 }, end: { x: width - margin, y: 80 }, thickness: 1, color: rgb(0,0,0)
  });
  page.drawText("Assinatura do Aluno / Responsável", { 
    x: margin, y: 65, size: 8, font: fontRegular 
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}