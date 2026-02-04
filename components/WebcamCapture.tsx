"use client";
import { useRef } from "react";
import Webcam from "react-webcam";

interface Props {
  onCapture: (img: string) => void;
  onCancel: () => void;
}

export default function WebcamCapture({ onCapture, onCancel }: Props) {
  const webcamRef = useRef<Webcam>(null);

  const capture = () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) onCapture(imageSrc);
  };

  return (
    <div style={{backgroundColor: '#000', padding: '15px', borderRadius: '10px', display: 'inline-block'}}>
      <div style={{position: 'relative', width: '320px', height: '240px', overflow: 'hidden', borderRadius: '5px'}}>
        <Webcam ref={webcamRef} screenshotFormat="image/png" width={320} height={240} videoConstraints={{ aspectRatio: 4/3 }} />
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '160px', height: '160px', border: '2px solid #2ecc71',
          boxShadow: '0 0 0 999px rgba(0,0,0,0.6)', pointerEvents: 'none'
        }}>
          <span style={{color: '#fff', fontSize: '10px', position: 'absolute', bottom: '-20px', width: '100%', textAlign: 'center'}}>Centralize o rosto aqui</span>
        </div>
      </div>
      <div style={{marginTop: '10px', display: 'flex', gap: '10px', justifyContent: 'center'}}>
        <button onClick={capture} style={{backgroundColor: '#2ecc71', color: 'white', padding: '10px'}}>Capturar</button>
        <button onClick={onCancel} style={{backgroundColor: '#e74c3c', color: 'white', padding: '10px'}}>Cancelar</button>
      </div>
    </div>
  );
}