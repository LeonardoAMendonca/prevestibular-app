import { 
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, 
  WidthType, AlignmentType, VerticalAlign, BorderStyle 
} from "docx";
import { Aluno } from "@/types";

export async function gerarFichaMatriculaWord(aluno: Aluno): Promise<Blob> {
  let fotoImagePart: ImageRun | TextRun = new TextRun("");
  if (aluno.foto) {
    try {
      const base64Data = aluno.foto.includes(',') ? aluno.foto.split(',')[1] : aluno.foto;
      const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      fotoImagePart = new ImageRun({
        data: imageBuffer, transformation: { width: 100, height: 100 }, type: "png",
      });
    } catch (e) { console.error(e); }
  }

  const titleStyle = { bold: true, size: 28 }; 
  const headerStyle = { bold: true, size: 22 };
  const labelStyle = { bold: true, size: 20 };
  const valueStyle = { size: 20 };

  const createField = (label: string, value: string | undefined) => {
    return new Paragraph({
      children: [
        new TextRun({ text: `${label}: `, ...labelStyle }),
        new TextRun({ text: value || "-", ...valueStyle }),
      ],
      spacing: { after: 100 },
    });
  };

  const createSectionTitle = (text: string) => {
    return new Paragraph({
      children: [new TextRun({ text: text.toUpperCase(), ...headerStyle })],
      spacing: { before: 200, after: 100 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 1 } }
    });
  };

  // --- RESPONSÁVEL ---
  const secaoResponsavel = [];
  if (aluno.alunoEProprioResponsavel === "Não") {
      secaoResponsavel.push(createSectionTitle("DADOS DO RESPONSÁVEL"));
      secaoResponsavel.push(createField("Nome", aluno.nomeResponsavel));
      secaoResponsavel.push(new Paragraph({
          children: [
              new TextRun({ text: "Parentesco: ", ...labelStyle }), new TextRun({ text: `${aluno.parentescoResponsavel}   `, ...valueStyle }),
              new TextRun({ text: "| CPF: ", ...labelStyle }), new TextRun({ text: `${aluno.cpfResponsavel}`, ...valueStyle }),
          ], spacing: { after: 100 }
      }));
      secaoResponsavel.push(createField("Contato", aluno.telefoneResponsavel));
      if (aluno.responsavelMoraComAluno === "Não") {
          secaoResponsavel.push(createField("Endereço", `${aluno.enderecoResponsavel || ''}, ${aluno.numeroResponsavel || ''} - ${aluno.bairroResponsavel || ''} - ${aluno.cidadeResponsavel || ''}`));
      } else {
          secaoResponsavel.push(createField("Endereço", "Mesmo do aluno"));
      }
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [new TextRun({ text: "FICHA DE MATRÍCULA", ...titleStyle })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),

        // Tabela Principal
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE } },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 75, type: WidthType.PERCENTAGE },
                  children: [
                    createSectionTitle("DADOS PESSOAIS"),
                    createField("Nome Completo", aluno.nome),
                    createField("CPF", aluno.cpf),
                    createField("Data Nascimento", aluno.dataNascimento?.split('-').reverse().join('/')),
                    createField("WhatsApp", aluno.telefoneWhatsapp),
                    createField("Tel. Secundário", aluno.telefoneSecundario),
                    
                    // Endereço (Movido para cá visualmente no Word também)
                    createField("Endereço", `${aluno.endereco || ''}, Nº ${aluno.numero || ''} - ${aluno.bairro || ''}`),
                    createField("Cidade/UF", `${aluno.cidade || ''} - ${aluno.estado || ''}`),
                    createField("Complemento", aluno.complemento),
                  ],
                }),
                new TableCell({
                  width: { size: 25, type: WidthType.PERCENTAGE },
                  verticalAlign: VerticalAlign.TOP,
                  children: [ new Paragraph({ alignment: AlignmentType.RIGHT, children: [fotoImagePart] }) ],
                }),
              ],
            }),
          ],
        }),

        ...secaoResponsavel,

        createSectionTitle("DADOS SOCIOECONÔMICOS"),
        new Paragraph({
            children: [
                new TextRun({ text: "Raca/Cor: ", ...labelStyle }), new TextRun({ text: `${aluno.identidadeRacial}   `, ...valueStyle }),
                new TextRun({ text: "| Gênero: ", ...labelStyle }), new TextRun({ text: `${aluno.identidadeGenero}`, ...valueStyle }),
            ], spacing: { after: 100 }
        }),
        createField("Possui Filhos", aluno.possuiFilhos),
        createField("Moradia", `Tipo: ${aluno.tipoMoradia} | Moradores: ${aluno.quantidadeMoradores}`),
        createField("Áreas de Risco", `Ambiental: ${aluno.areaRiscoAmbiental} | Segurança: ${aluno.areaRiscoSeguranca}`),
        createField("Escolaridade", aluno.concluiuEnsinoMedio === "Sim" ? `Ensino Médio Concluído em ${aluno.anoConclusaoEnsinoMedio} (${aluno.instituicaoEnsinoMedio})` : "Ensino Médio Não Concluído"),

        // SAÚDE ATUALIZADA
        createSectionTitle("SAÚDE"),
        createField("Tipo Sanguíneo", aluno.tipoSanguineo),
        createField("Alergias", aluno.temAlergia === "Sim" ? aluno.qualAlergia : "Não"),
        createField("Doenças Crônicas", aluno.temDoencaCronica === "Sim" ? aluno.qualDoencaCronica : "Não"),
        createField("Medicação Regular", aluno.usaMedicacao === "Sim" ? aluno.qualMedicacao : "Não"),

        new Paragraph({ text: "", spacing: { before: 800 } }), 
        new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [ new TextRun({ text: "Niterói, ______ de __________________________ de _______", ...valueStyle }) ],
            spacing: { after: 600 }
        }),

        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE } },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            width: { size: 50, type: WidthType.PERCENTAGE },
                            children: [
                                new Paragraph({ children: [new TextRun({ text: "_______________________________________" })], alignment: AlignmentType.CENTER }),
                                new Paragraph({ children: [new TextRun({ text: "Assinatura do Aluno / Responsável", size: 16, bold: true })], alignment: AlignmentType.CENTER })
                            ]
                        }),
                        new TableCell({
                            width: { size: 50, type: WidthType.PERCENTAGE },
                            children: [
                                new Paragraph({ children: [new TextRun({ text: "_______________________________________" })], alignment: AlignmentType.CENTER }),
                                new Paragraph({ children: [new TextRun({ text: "Coordenação Pré-Vestibular", size: 16, bold: true })], alignment: AlignmentType.CENTER }),
                                new Paragraph({ children: [new TextRun({ text: "da Juventude", size: 16, bold: true })], alignment: AlignmentType.CENTER })
                            ]
                        })
                    ]
                })
            ]
        })
      ],
    }],
  });
  return await Packer.toBlob(doc);
}