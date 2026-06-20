const maxDimension = 512;
const outputQuality = 0.82;
const maxCompressedSize = 1024 * 1024;

export async function prepareBusinessLogo(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecione uma imagem válida.");
  }

  const image = await loadImage(file);
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Não foi possível preparar a imagem.");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, "image/webp", outputQuality);
  const prepared = new File([blob], "logo.webp", { type: blob.type, lastModified: Date.now() });

  if (prepared.size > maxCompressedSize) {
    throw new Error("A imagem ficou maior que 1MB. Tente uma foto mais leve.");
  }

  return prepared;
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem."));
    };

    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Não foi possível compactar a imagem."));
          return;
        }

        resolve(blob);
      },
      type,
      quality,
    );
  });
}
