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
        data: imageBuffer,
        transformation: { width: 100, height: 100 },
        type: "png",
      });
    } catch (e) { console.error("Erro ao processar foto para o Word", e); }
  }

  const titleStyle = { bold: true, size: 28 };
  const headerStyle = { bold: true, size: 22, color: "004B8D" };
  const labelStyle = { bold: true, size: 18 };
  const valueStyle = { size: 18 };

  const createField = (label: string, value: any) => {
    return new Paragraph({
      spacing: { before: 80 },
      children: [
        new TextRun({ text: `${label}: `, ...labelStyle }),
        new TextRun({ text: String(value || "Não informado"), ...valueStyle }),
      ],
    });
  };

  const createHeader = (text: string) => new Paragraph({
    spacing: { before: 240, after: 120 },
    border: { bottom: { color: "004B8D", space: 1, style: BorderStyle.SINGLE, size: 6 } },
    children: [new TextRun({ text: text.toUpperCase(), ...headerStyle })],
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // CABEÇALHO COM FOTO
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 80, type: WidthType.PERCENTAGE },
                  verticalAlign: VerticalAlign.CENTER,
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: "FICHA DE MATRÍCULA - PJU", ...titleStyle })],
                    }),
                    new Paragraph({
                      children: [new TextRun({ text: `Data de Cadastro: ${aluno.dataCriacao || new Date().toLocaleDateString('pt-BR')}`, size: 16 })],
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 20, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER, // Opcional: centraliza a foto na célula
                      children: [fotoImagePart], // Agora está correto: TextRun/ImageRun dentro de Paragraph
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),

        createHeader("Dados Pessoais"),
        createField("Nome Completo", aluno.nome),
        createField("CPF", aluno.cpf),
        createField("Data de Nascimento", aluno.dataNascimento),
        createField("E-mail", aluno.email),
        createField("WhatsApp", aluno.telefoneWhatsapp),
        createField("Telefone Secundário", aluno.telefoneSecundario),

        createHeader("Endereço"),
        createField("CEP", aluno.cep),
        createField("Logradouro", `${aluno.endereco}, Nº ${aluno.numero}`),
        createField("Complemento", aluno.complemento),
        createField("Bairro", aluno.bairro),
        createField("Cidade/Estado", `${aluno.cidade} - ${aluno.estado}`),

        createHeader("Socioeconômico"),
        createField("Identidade Racial", aluno.identidadeRacial),
        createField("Identidade de Gênero", aluno.identidadeGenero),
        createField("Possui Filhos", aluno.temFilhos),
        createField("Quantidade de Filhos", aluno.quantidadeFilhos),
        createField("Tipo de Moradia", aluno.tipoMoradia),
        createField("Moradores na Residência", aluno.quantidadeMoradores),
        createField("Renda Per Capita", aluno.rendaPerCapita),
        createField("Acesso à Internet", aluno.acessoInternet),
        createField("Dispositivos de Estudo", aluno.dispositivosEstudo),

        createHeader("Escolaridade"),
        createField("Concluiu Ensino Médio", aluno.concluiuEnsinoMedio),
        createField("Escola de Origem", aluno.instituicaoEnsinoMedio),
        createField("Ano de Conclusão", aluno.anoConclusaoEnsinoMedio),
        createField("Série Atual (se cursando)", aluno.serieAtual),

        createHeader("Saúde e Emergência"),
        createField("Tipo Sanguíneo", aluno.tipoSanguineo),
        createField("Possui Alergia", `${aluno.temAlergia} (${aluno.qualAlergia || 'N/A'})`),
        createField("Doença Crônica", `${aluno.temDoencaCronica} (${aluno.qualDoencaCronica || 'N/A'})`),
        createField("Usa Medicação", `${aluno.usaMedicacao} (${aluno.qualMedicacao || 'N/A'})`),
        createField("Contato de Emergência 1", `${aluno.nomeEmergencia1} (${aluno.parentescoEmergencia1}) - ${aluno.telefoneEmergencia1}`),

        createHeader("Responsável Legal"),
        createField("Aluno é o próprio responsável", aluno.alunoEProprioResponsavel),
        createField("Nome do Responsável", aluno.nomeResponsavel),
        createField("CPF do Responsável", aluno.cpfResponsavel),

        // --- NOVA SEÇÃO: REGISTRO DO OPERADOR ---
        createHeader("Registro de Cadastro Interno"),
        createField("Operador", aluno.operadorResponsavel), // Onde passamos "Nome (Cargo)"
        createField("Data do Cadastro", aluno.dataCriacao || new Date().toLocaleDateString('pt-BR')),



        new Paragraph({ spacing: { before: 400 }, children: [] }),

        // --- ÁREA DE ASSINATURAS ---
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE }
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      border: { top: { style: BorderStyle.SINGLE, size: 1 } },
                      spacing: { before: 100 },
                      children: [new TextRun({ text: "Assinatura do Aluno / Responsável", size: 16, bold: true })],
                      alignment: AlignmentType.CENTER
                    })
                  ]
                }),
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      border: { top: { style: BorderStyle.SINGLE, size: 1 } },
                      spacing: { before: 100 },
                      children: [new TextRun({ text: "Coordenação PJU", size: 16, bold: true })],
                      alignment: AlignmentType.CENTER
                    })
                  ]
                })
              ]
            })
          ]
        })
      ]
    }]
  });

  return await Packer.toBlob(doc);
}