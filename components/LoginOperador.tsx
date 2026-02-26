import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { Operador } from '@/types';

interface LoginOperadorProps {
  onLogin: (dados: Operador) => void;
}

export default function LoginOperador({ onLogin }: LoginOperadorProps) {
  const [loginNome, setLoginNome] = useState("");
  const [loginCargo, setLoginCargo] = useState("");

  const confirmarOperador = () => {
    if (loginNome.trim() && loginCargo.trim()) {
      onLogin({ nome: loginNome, cargo: loginCargo });
    } else {
      Swal.fire("Erro", "Preencha o nome e o cargo para prosseguir.", "error");
    }
  };

  return (
    <div className="login-overlay">
      <div className="login-card">
        <img 
          src="/pju.png" 
          alt="Logo PJU" 
          style={{ width: "120px", marginBottom: "20px" }} 
        />
        <h2 style={{ marginBottom: "20px"}}>Acesso do Operador</h2>        
        <input
          type="text"
          placeholder="Nome Completo do Operador"
          value={loginNome}
          onChange={(e) => setLoginNome(e.target.value)}
          style={{ 
            marginBottom: "15px", 
            padding: "12px", 
            borderRadius: "8px", 
            border: "1px solid #ccc", 
            width: "100%" 
          }}
        />
        
        <input
          type="text"
          placeholder="Cargo no PJU (Ex: Coordenador, Voluntário)"
          value={loginCargo}
          onChange={(e) => setLoginCargo(e.target.value)}
          style={{ 
            marginBottom: "20px", 
            padding: "12px", 
            borderRadius: "8px", 
            border: "1px solid #ccc", 
            width: "100%" 
          }}
        />

        <button 
          onClick={confirmarOperador} 
          className="btn-primary" 
          style={{ width: "100%" }}
        >
          ENTRAR NO SISTEMA
        </button>
      </div>
    </div>
  );
}