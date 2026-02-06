import { Aluno } from "@/types";

interface ListaAlunosProps {
  alunos: Aluno[];
  onDownloadZip: (aluno: Aluno) => void;
  onDownloadLote: () => void;
  onDownloadAll: () => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
}

export default function ListaAlunos({ alunos, onDownloadZip, onDownloadLote, onDownloadAll, onEdit, onDelete }: ListaAlunosProps) {
  return (
    <div className="lote-section" style={{ marginTop: "40px", borderTop: "2px solid #eee", paddingTop: "20px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", gap: "10px" }}>
        <h3>Alunos Cadastrados no Lote ({alunos.length})</h3>
        
        <div style={{ display: "flex", gap: "10px" }}>
            {alunos.length > 0 && (
            <button onClick={onDownloadAll} style={{ backgroundColor: "#8e44ad", width: "auto", color: "white", padding: "10px 15px", borderRadius: "5px", border: "none", cursor: "pointer", fontWeight: "bold" }}>
                🗂️ BAIXAR TUDO (ZIP)
            </button>
            )}
            {alunos.length > 0 && (
            <button onClick={onDownloadLote} style={{ backgroundColor: "#e67e22", width: "auto", color: "white", padding: "10px 15px", borderRadius: "5px", border: "none", cursor: "pointer", fontWeight: "bold" }}>
                🖨️ IMPRIMIR CARTEIRINHAS (PDF)
            </button>
            )}
        </div>
      </div>

      {alunos.length === 0 && (
        <p style={{ color: "#7f8c8d", fontStyle: "italic" }}>Nenhum aluno adicionado ainda.</p>
      )}

      {alunos.map((aluno, index) => (
        <div key={index} className="item-aluno" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee' }}>
          
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <img src={aluno.foto || ""} style={{ width: "50px", height: "50px", borderRadius: "50%", objectFit: "cover" }} alt={aluno.nome} />
            <div>
              <strong>{aluno.nome}</strong>
              <div style={{ fontSize: "12px", color: "#666" }}>CPF: {aluno.cpf}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '5px' }}>
            <button onClick={() => onEdit(index)} title="Editar" style={{ width: "auto", padding: "8px 12px", fontSize: "16px", backgroundColor: "#2980b9", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>✏️</button>
            <button onClick={() => onDelete(index)} title="Excluir" style={{ width: "auto", padding: "8px 12px", fontSize: "16px", backgroundColor: "#c0392b", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>🗑️</button>
            <button onClick={() => onDownloadZip(aluno)} style={{ width: "auto", padding: "8px 15px", fontSize: "12px", cursor: "pointer", marginLeft: "5px" }}>BAIXAR</button>
          </div>
          
        </div>
      ))}
    </div>
  );
}