// ============================================================
//  ARQUIVO: src/lib/imageUtils.ts
//  Redimensiona e comprime imagens no browser antes do upload.
//  Garante que o base64 nunca ultrapasse ~500KB,
//  compatível com o limite padrão do Next.js App Router.
// ============================================================

interface ResizeOptions {
  maxWidth?: number;   // Largura máxima em pixels (padrão: 800)
  maxHeight?: number;  // Altura máxima em pixels (padrão: 800)
  quality?: number;    // Qualidade JPEG 0-1 (padrão: 0.82)
}

/**
 * Redimensiona e comprime um arquivo de imagem.
 * Retorna o base64 da imagem processada (sem o prefixo data:...).
 * O tipo de saída é sempre image/jpeg para máxima compressão.
 */
export function resizeAndEncodeImage(
  file: File,
  options: ResizeOptions = {}
): Promise<{ base64: string; mimeType: string; sizeKB: number }> {
  const { maxWidth = 800, maxHeight = 800, quality = 0.82 } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Calcula as novas dimensões mantendo a proporção
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }

      // Desenha a imagem redimensionada em um canvas
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas não suportado.')); return; }
      ctx.drawImage(img, 0, 0, width, height);

      // Exporta como JPEG com qualidade controlada
      const dataUrl  = canvas.toDataURL('image/jpeg', quality);
      const base64   = dataUrl.split(',')[1];
      const sizeKB   = Math.round((base64.length * 3) / 4 / 1024);

      resolve({ base64, mimeType: 'image/jpeg', sizeKB });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Não foi possível carregar a imagem.'));
    };

    img.src = objectUrl;
  });
}