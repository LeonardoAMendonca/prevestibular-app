import React, { useRef, useCallback, useState } from "react";
import Webcam from "react-webcam";

interface WebcamCaptureProps {
  onCapture: (imgSrc: string) => void;
  onClose: () => void;
}

const WebcamCapture: React.FC<WebcamCaptureProps> = ({ onCapture, onClose }) => {
  const webcamRef = useRef<Webcam>(null);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  
  // Novo estado para guardar a foto temporariamente antes de confirmar
  const [imagemTemporaria, setImagemTemporaria] = useState<string | null>(null);

  const handleDevices = useCallback((mediaDevices: MediaDeviceInfo[]) => {
    setDevices(mediaDevices.filter(({ kind }) => kind === "videoinput"));
  }, []);

  React.useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(handleDevices);
  }, [handleDevices]);

  // 1. Tira a foto, mas NÃO fecha o modal. Apenas mostra o preview.
  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setImagemTemporaria(imageSrc);
    }
  }, [webcamRef]);

  // 2. O usuário gostou? Envia para o pai e fecha.
  const confirmarFoto = () => {
    if (imagemTemporaria) {
      onCapture(imagemTemporaria);
      onClose();
    }
  };

  // 3. O usuário não gostou? Limpa a foto e volta para a webcam.
  const tentarNovamente = () => {
    setImagemTemporaria(null);
  };

  // --- CÁLCULOS DE POSIÇÃO (Idênticos ao anterior) ---
  const cardAspectRatio = 8.56 / 5.41;
  const cssWidth = (2.5275 / 8.56) * 100; 
  const cssHeight = (3.37 / 5.41) * 100;  
  const cssLeft = (0.5 / 8.56) * 100;     
  const cssTop = (1.04 / 5.41) * 100;     

  return (
    <div style={styles.overlay}>
      <div style={styles.modalContent}>
        <h3 style={styles.title}>
          {imagemTemporaria ? "Pré-visualização" : "Tirar Foto"}
        </h3>
        <p style={styles.subtitle}>
          {imagemTemporaria 
            ? "Veja como ficará na carteirinha. Se gostar, confirme." 
            : "Encaixe o rosto na área oval abaixo"}
        </p>

        {/* ÁREA DA CARTEIRINHA */}
        <div style={{...styles.cardContainer, aspectRatio: `${cardAspectRatio}` }}>
          
          {/* Fundo da Carteirinha */}
          <img src="/base.png" alt="Base" style={styles.cardImage} />

          {/* O "Buraco" onde fica a câmera OU a foto tirada */}
          <div style={{
            position: 'absolute',
            left: `${cssLeft}%`,
            top: `${cssTop}%`,
            width: `${cssWidth}%`,
            height: `${cssHeight}%`,
            borderRadius: '50%', // Visualização Oval
            overflow: 'hidden',
            border: imagemTemporaria ? '2px solid #27ae60' : '2px solid #e74c3c', // Verde se tirou, Vermelho se gravando
            zIndex: 10,
            backgroundColor: '#000',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            
            {/* Lógica Condicional: Mostra Imagem Congelada OU Webcam Ao Vivo */}
            {imagemTemporaria ? (
              <img 
                src={imagemTemporaria} 
                alt="Foto Capturada" 
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: "scaleX(-1)" // Mantém o espelhamento para consistência visual
                }} 
              />
            ) : (
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ 
                   deviceId: deviceId,
                   facingMode: "user",
                   aspectRatio: 1 
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: "scaleX(-1)" 
                }}
              />
            )}
          </div>
        </div>

        {/* CONTROLES */}
        <div style={styles.controls}>
          
          {/* Seletor de Câmera (Só mostra se estiver no modo Câmera e tiver > 1 opção) */}
          {!imagemTemporaria && devices.length > 1 && (
            <select 
              onChange={(e) => setDeviceId(e.target.value)}
              style={styles.select}
            >
              {devices.map((device, key) => (
                <option key={key} value={device.deviceId}>
                  {device.label || `Câmera ${key + 1}`}
                </option>
              ))}
            </select>
          )}

          <div style={styles.buttonGroup}>
            {/* Botão de Cancelar sempre disponível para fechar tudo */}
            <button onClick={onClose} style={styles.btnCancel}>Cancelar</button>

            {/* Alterna entre Botão de Captura e Botões de Ação (Retake/Confirm) */}
            {!imagemTemporaria ? (
              <button onClick={capture} style={styles.btnCapture}>📸 CAPTURAR</button>
            ) : (
              <>
                <button onClick={tentarNovamente} style={styles.btnRetake}>🔄 Tentar Novamente</button>
                <button onClick={confirmarFoto} style={styles.btnConfirm}>✅ CONFIRMAR</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.85)",
    display: "flex", justifyContent: "center", alignItems: "center",
    zIndex: 9999,
  },
  modalContent: {
    backgroundColor: "#fff", padding: "20px", borderRadius: "12px",
    width: "90%", maxWidth: "600px",
    display: "flex", flexDirection: "column", alignItems: "center",
    boxShadow: "0 10px 25px rgba(0,0,0,0.5)"
  },
  title: { marginBottom: "5px", color: "#333" },
  subtitle: { marginBottom: "15px", color: "#666", fontSize: "0.9rem" },
  cardContainer: {
    width: "100%", position: "relative", backgroundColor: "#eee",
    borderRadius: "8px", overflow: "hidden", boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
    marginBottom: "20px"
  },
  cardImage: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  logoSimulado: { position: 'absolute', opacity: 0.8 },
  controls: { width: "100%", display: "flex", flexDirection: "column", gap: "10px" },
  select: { padding: "8px", borderRadius: "6px", border: "1px solid #ccc", width: "100%" },
  buttonGroup: { display: "flex", gap: "10px", justifyContent: "center", width: "100%" },
  
  // Estilos dos Botões
  btnCapture: {
    backgroundColor: "#2980b9", color: "#fff", border: "none", padding: "12px 20px",
    borderRadius: "6px", cursor: "pointer", fontWeight: "bold", flex: 2
  },
  btnConfirm: {
    backgroundColor: "#27ae60", color: "#fff", border: "none", padding: "12px 20px",
    borderRadius: "6px", cursor: "pointer", fontWeight: "bold", flex: 2
  },
  btnRetake: {
    backgroundColor: "#f39c12", color: "#fff", border: "none", padding: "12px 20px",
    borderRadius: "6px", cursor: "pointer", fontWeight: "bold", flex: 1
  },
  btnCancel: {
    backgroundColor: "#95a5a6", color: "#fff", border: "none", padding: "12px 20px",
    borderRadius: "6px", cursor: "pointer", fontWeight: "bold", flex: 0.5
  }
};

export default WebcamCapture;