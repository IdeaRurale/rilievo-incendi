/**
 * Genera un PDF A4 da un elemento del DOM e lo condivide (iOS) o lo scarica.
 * Funziona anche come PWA installata su iPhone, dove window.print() non è affidabile.
 * jsPDF e html2canvas-pro sono importati dinamicamente: pesano solo quando servono.
 */
export async function elementoToPdf(
  element: HTMLElement,
  filename: string,
  titolo?: string
): Promise<void> {
  const [{ default: jsPDF }, html2canvasMod] = await Promise.all([
    import('jspdf'),
    import('html2canvas-pro')
  ]);
  const html2canvas = html2canvasMod.default;

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    windowWidth: element.scrollWidth
  });

  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const imgW = pageW - margin * 2;
  const imgH = (canvas.height * imgW) / canvas.width;
  const usableH = pageH - margin * 2;
  const imgData = canvas.toDataURL('image/jpeg', 0.92);

  let heightLeft = imgH;
  let position = 0;
  pdf.addImage(imgData, 'JPEG', margin, margin, imgW, imgH);
  heightLeft -= usableH;
  while (heightLeft > 0) {
    position -= usableH;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', margin, margin + position, imgW, imgH);
    heightLeft -= usableH;
  }

  const blob = pdf.output('blob');
  const file = new File([blob], filename, { type: 'application/pdf' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: titolo });
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return; // annullato
      // altrimenti prosegue col download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
