import {
  esitoLabel,
  UNITA_TIPI,
  type Classe,
  type ClasseConfig,
  type Foto,
  type Pianta,
  type Pratica,
  type Unita
} from '../db';
import { computeStats, esitoEffettivo, type Stats } from './stats';
import { blobToOrientedImage, hexToRgb, sharePdf } from './pdf';

export interface VerbaleData {
  pratica: Pratica;
  unitaList: Unita[];
  piante: Pianta[];
  foto: Foto[];
  classi: ClasseConfig[];
}

function fmtData(iso?: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Genera il verbale come PDF strutturato (testo selezionabile, niente tagli). */
export async function generaVerbalePdf(d: VerbaleData): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const { pratica, unitaList, piante, foto, classi } = d;
  const stats = computeStats(unitaList, piante, classi);
  const nomeUnita = new Map(unitaList.map((u) => [u.id!, u.nome]));

  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const mL = 15;
  const mR = 15;
  const mB = 16;
  const mT = 16;
  const cw = pageW - mL - mR;
  const VERDE: [number, number, number] = [20, 83, 45];
  let y = mT;

  const lh = (size: number) => size * 0.3528 * 1.18;

  function ensure(h: number) {
    if (y + h > pageH - mB) {
      doc.addPage();
      y = mT;
    }
  }

  function heading(text: string) {
    ensure(11);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(...VERDE);
    doc.text(text, mL, y);
    y += 2;
    doc.setDrawColor(...VERDE);
    doc.setLineWidth(0.4);
    doc.line(mL, y, mL + cw, y);
    y += 5;
    doc.setTextColor(30, 30, 30);
  }

  function paragraph(text: string, size = 10) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    doc.setTextColor(30, 30, 30);
    const lines = doc.splitTextToSize(text, cw) as string[];
    const step = lh(size);
    for (const line of lines) {
      ensure(step);
      doc.text(line, mL, y);
      y += step;
    }
    y += 1.5;
  }

  const afterTable = () => {
    // @ts-expect-error lastAutoTable è aggiunto da jspdf-autotable
    y = (doc.lastAutoTable?.finalY ?? y) + 5;
  };

  /* ---------- Intestazione ---------- */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(90, 90, 90);
  doc.text((pratica.tecnico || 'Tecnico rilevatore').toUpperCase(), pageW / 2, y, { align: 'center' });
  y += 7;
  doc.setFontSize(19);
  doc.setTextColor(20, 20, 20);
  doc.text('VERBALE DI SOPRALLUOGO', pageW / 2, y, { align: 'center' });
  y += 6.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text('Rilievo dei danni da incendio alla vegetazione arborea', pageW / 2, y, { align: 'center' });
  y += 3;
  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(0.6);
  doc.line(mL, y, mL + cw, y);
  y += 7;

  /* ---------- Dati generali ---------- */
  const labelCol = { fontStyle: 'bold' as const, fillColor: [240, 239, 233] as [number, number, number], cellWidth: 32 };
  autoTable(doc, {
    startY: y,
    margin: { left: mL, right: mR },
    theme: 'grid',
    styles: { fontSize: 9.5, cellPadding: 2, textColor: [30, 30, 30], lineColor: [150, 150, 150] },
    columnStyles: { 0: labelCol, 2: labelCol },
    body: [
      ['Pratica', pratica.titolo || '—', 'Cliente', pratica.cliente || '—'],
      ['Comune', pratica.comune || '—', 'Località', pratica.localita || '—'],
      ['Data incendio', fmtData(pratica.dataIncendio), 'Data sopralluogo', fmtData(pratica.dataSopralluogo)],
      ['Tecnico', { content: pratica.tecnico || '—', colSpan: 3 } as never]
    ]
  });
  afterTable();

  /* ---------- 1. Premessa ---------- */
  heading('1. Premessa e oggetto');
  const luogo = pratica.comune || pratica.localita || '________';
  paragraph(
    `In data ${fmtData(pratica.dataSopralluogo)} il sottoscritto ${
      pratica.tecnico || 'tecnico incaricato'
    } ha effettuato un sopralluogo presso il fondo sito in ${luogo}${
      pratica.localita ? `, ${pratica.localita}` : ''
    }, al fine di rilevare e classificare i danni subiti dalla vegetazione arborea a seguito dell'incendio${
      pratica.dataIncendio ? ` del ${fmtData(pratica.dataIncendio)}` : ''
    }. Il presente verbale documenta le operazioni di censimento pianta per pianta, la classificazione del livello di danno e la documentazione fotografica raccolta in campo.`
  );
  if (pratica.note) paragraph(`Note: ${pratica.note}`);

  /* ---------- 2. Metodologia ---------- */
  heading('2. Metodologia di rilievo');
  paragraph(
    'Il censimento è stato condotto in campo mediante applicazione dedicata, con classificazione di ciascuna pianta in cinque classi di danno e registrazione, ove disponibile, della posizione GPS e di documentazione fotografica. Le classi adottate sono le seguenti:'
  );
  const classColori = classi.map((c) => ({ rgb: hexToRgb(c.colore), dark: !!c.testoScuro }));
  autoTable(doc, {
    startY: y,
    margin: { left: mL, right: mR },
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2, lineColor: [150, 150, 150], valign: 'middle' },
    headStyles: { fillColor: VERDE, textColor: 255, fontSize: 9 },
    columnStyles: { 0: { cellWidth: 26, halign: 'center', fontStyle: 'bold' }, 2: { cellWidth: 30, halign: 'center' } },
    head: [['Classe', 'Descrizione', 'Danno indic.', 'Esito predefinito']],
    body: classi.map((c) => [c.nome, c.descrizione, `${c.pctMin}–${c.pctMax}%`, esitoLabel(c.esitoDefault)]),
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        const col = classColori[data.row.index];
        data.cell.styles.fillColor = col.rgb;
        data.cell.styles.textColor = col.dark ? [28, 25, 23] : [255, 255, 255];
      }
    }
  });
  afterTable();

  /* ---------- 3. Riepilogo quantitativo ---------- */
  heading('3. Riepilogo quantitativo');
  autoTable(doc, {
    startY: y,
    margin: { left: mL, right: mR },
    theme: 'grid',
    styles: { fontSize: 9.5, cellPadding: 2, lineColor: [150, 150, 150] },
    columnStyles: { 0: labelCol, 2: labelCol },
    body: [
      ['Piante teoriche', String(stats.teoriche || '—'), 'Piante censite', String(stats.censite)],
      ['Sane', String(stats.sane), 'Danneggiate', `${stats.danneggiate} (${stats.pctDanneggiate}%)`],
      ['Gravi', `${stats.gravi} (${stats.pctGravi}%)`, 'Distrutte', `${stats.distrutte} (${stats.pctDistrutte}%)`],
      ['Da monitorare', String(stats.daMonitorare), 'Da sostituire', `${stats.daSostituire} (${stats.pctSostituire}%)`],
      ['Danno medio stimato', { content: `${stats.dannoMedio}%`, colSpan: 3 } as never]
    ]
  });
  afterTable();
  distribuzione(stats);

  /* ---------- 4. Dettaglio per unità ---------- */
  heading('4. Dettaglio del rilievo per unità');
  const pianteByUnita = new Map<number, Pianta[]>();
  for (const p of piante) {
    if (!pianteByUnita.has(p.unitaId)) pianteByUnita.set(p.unitaId, []);
    pianteByUnita.get(p.unitaId)!.push(p);
  }
  const fotoCountByPianta = new Map<number, number>();
  for (const f of foto) if (f.piantaId !== undefined) fotoCountByPianta.set(f.piantaId, (fotoCountByPianta.get(f.piantaId) ?? 0) + 1);

  unitaList.forEach((u, idx) => {
    const tipo = UNITA_TIPI.find((t) => t.value === u.tipo);
    const pu = (pianteByUnita.get(u.id!) ?? []).sort((a, b) => a.numero - b.numero);
    const uStats = computeStats([u], pu, classi);

    ensure(20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text(`4.${idx + 1}  ${u.nome}`, mL, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text(`(${tipo?.label})`, mL + doc.getTextWidth(`4.${idx + 1}  ${u.nome}`) + 3, y);
    y += 5;

    const meta: string[] = [];
    if (u.specie) meta.push(`Specie: ${u.specie}${u.cultivar ? ` (${u.cultivar})` : ''}`);
    if (u.numeroTeorico) meta.push(`N. teorico: ${u.numeroTeorico}`);
    if (u.lunghezza) meta.push(`Lunghezza: ${u.lunghezza} m`);
    meta.push(`Censite: ${uStats.censite}`);
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    for (const line of doc.splitTextToSize(meta.join('  ·  '), cw) as string[]) {
      ensure(lh(9));
      doc.text(line, mL, y);
      y += lh(9);
    }
    y += 2;

    if (u.tipo === 'gruppo' && u.conteggi) {
      const rows = classi
        .map((c, i) => ({ c, i, n: u.conteggi![c.codice] || 0 }))
        .filter((r) => r.n > 0);
      autoTable(doc, {
        startY: y,
        margin: { left: mL, right: mR },
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 1.8, lineColor: [150, 150, 150], valign: 'middle' },
        headStyles: { fillColor: VERDE, textColor: 255 },
        columnStyles: { 0: { cellWidth: 28, halign: 'center', fontStyle: 'bold' }, 1: { cellWidth: 24, halign: 'center' } },
        head: [['Classe', 'N. piante', 'Esito predefinito']],
        body: rows.map((r) => [r.c.nome, String(r.n), esitoLabel(r.c.esitoDefault)]),
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 0) {
            const col = classColori[rows[data.row.index].i];
            data.cell.styles.fillColor = col.rgb;
            data.cell.styles.textColor = col.dark ? [28, 25, 23] : [255, 255, 255];
          }
        }
      });
      afterTable();
    } else if (pu.length > 0) {
      const rowClasse = pu.map((p) => p.classe);
      autoTable(doc, {
        startY: y,
        margin: { left: mL, right: mR },
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.4, lineColor: [170, 170, 170], overflow: 'linebreak', valign: 'middle' },
        headStyles: { fillColor: VERDE, textColor: 255, fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 9, halign: 'center' },
          1: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
          2: { cellWidth: 26 },
          4: { cellWidth: 34, fontSize: 7 },
          5: { cellWidth: 11, halign: 'center' }
        },
        head: [['N.', 'Classe', 'Esito tecnico', 'Dettaglio', 'GPS', 'Foto']],
        body: pu.map((p) => [
          String(p.numero),
          classi[p.classe].nome,
          esitoLabel(esitoEffettivo(p, classi)),
          dettaglioTxt(p),
          p.lat !== undefined ? `${p.lat.toFixed(5)}, ${p.lng!.toFixed(5)}` : '—',
          (fotoCountByPianta.get(p.id!) ?? 0) > 0 ? `Sì (${fotoCountByPianta.get(p.id!)})` : '—'
        ]),
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 1) {
            const col = classColori[rowClasse[data.row.index]];
            data.cell.styles.fillColor = col.rgb;
            data.cell.styles.textColor = col.dark ? [28, 25, 23] : [255, 255, 255];
          }
        }
      });
      afterTable();
    } else {
      paragraph('Nessuna pianta censita in questa unità.', 9);
    }
    if (u.note) paragraph(`Note unità: ${u.note}`, 9);
  });

  /* ---------- 5. Documentazione fotografica ---------- */
  heading('5. Documentazione fotografica');
  if (foto.length === 0) {
    paragraph('Nessuna fotografia associata a questo rilievo.', 9);
  } else {
    await sezioneFoto();
  }

  /* ---------- Firma ---------- */
  const oggi = new Date().toLocaleDateString('it-IT');
  ensure(46);
  y += 4;
  paragraph(
    `Il presente verbale, redatto in ${luogo} il ${oggi}, si compone di quanto sopra riportato e della documentazione fotografica allegata.`,
    9.5
  );
  y += 16;
  ensure(24);
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text(`${luogo}, ${oggi}`, mL, y);
  const fx = mL + cw - 60;
  doc.text('Il tecnico rilevatore', fx + 30, y - 6, { align: 'center' });
  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.3);
  doc.line(fx, y + 4, fx + 60, y + 4);
  doc.text(pratica.tecnico || '', fx + 30, y + 9, { align: 'center' });

  /* ---------- Piè di pagina (numeri) ---------- */
  const totPagine = doc.getNumberOfPages();
  for (let i = 1; i <= totPagine; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(pratica.titolo || 'Verbale di sopralluogo', mL, pageH - 9);
    doc.text(`Pagina ${i} di ${totPagine}`, pageW - mR, pageH - 9, { align: 'right' });
  }

  const nome = `verbale-${(pratica.titolo || 'sopralluogo').replace(/[^\w\-]+/g, '_')}-${new Date()
    .toISOString()
    .slice(0, 10)}.pdf`;
  await sharePdf(doc.output('blob'), nome, pratica.titolo);

  /* ================= helper interni ================= */

  function dettaglioTxt(p: Pianta): string {
    if (!p.dettaglio) return '—';
    return (
      [p.dettaglio.chioma, p.dettaglio.fogliame, p.dettaglio.fusto, p.dettaglio.colletto, p.dettaglio.recupero]
        .filter(Boolean)
        .join(' · ') || '—'
    );
  }

  function distribuzione(s: Stats) {
    const barW = 96;
    const labelW = 30;
    const valX = mL + labelW + barW + 4;
    for (const c of classi) {
      const n = s.perClasse[c.codice];
      const perc = s.censite ? n / s.censite : 0;
      ensure(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(40, 40, 40);
      doc.text(c.nome, mL, y + 3.2);
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(235, 235, 235);
      doc.rect(mL + labelW, y, barW, 4.5, 'FD');
      if (perc > 0) {
        const [r, g, b] = hexToRgb(c.colore);
        doc.setFillColor(r, g, b);
        doc.rect(mL + labelW, y, Math.max(0.6, barW * perc), 4.5, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
      doc.text(`${n} (${(perc * 100).toFixed(1)}%)`, valX, y + 3.4);
      y += 6.2;
    }
    y += 3;
  }

  async function sezioneFoto() {
    const gap = 6;
    const colW = (cw - gap) / 2;
    const maxImgH = 62;

    // prepara tutte le immagini (dataURL + dimensioni + didascalia)
    const items = await Promise.all(
      foto.map(async (f) => {
        const { dataURL, w, h } = await blobToOrientedImage(f.blob);
        const rif =
          f.daNumero !== undefined
            ? f.aNumero !== undefined && f.daNumero !== f.aNumero
              ? `Piante n. ${f.daNumero}–${f.aNumero}`
              : `Pianta n. ${f.daNumero}`
            : f.nota || 'Foto generale';
        const un = f.unitaId !== undefined ? nomeUnita.get(f.unitaId) : undefined;
        return { f, dataURL, w, h, didascalia: [un, rif].filter(Boolean).join(' — ') };
      })
    );

    const dispDim = (w: number, h: number) => {
      let dw = colW;
      let dh = (h / w) * dw;
      if (dh > maxImgH) {
        dh = maxImgH;
        dw = (w / h) * dh;
      }
      return { dw, dh };
    };

    for (let i = 0; i < items.length; i += 2) {
      const pair = items.slice(i, i + 2);
      const cells = pair.map((it, k) => {
        const { dw, dh } = dispDim(it.w, it.h);
        const capLines: string[] = [];
        doc.setFontSize(7.8);
        for (const l of doc.splitTextToSize(`Foto ${i + k + 1}. ${it.didascalia}`, colW) as string[]) capLines.push(l);
        const metaLine =
          (it.f.lat !== undefined ? `GPS ${it.f.lat.toFixed(5)}, ${it.f.lng!.toFixed(5)} · ` : '') +
          new Date(it.f.ts).toLocaleString('it-IT');
        for (const l of doc.splitTextToSize(metaLine, colW) as string[]) capLines.push(l);
        return { it, dw, dh, capLines };
      });
      const rowH = Math.max(...cells.map((c) => c.dh + 2 + c.capLines.length * 3.4)) + 4;
      ensure(rowH);
      cells.forEach((c, k) => {
        const x = mL + k * (colW + gap);
        const imgX = x + (colW - c.dw) / 2;
        try {
          doc.addImage(c.it.dataURL, 'JPEG', imgX, y, c.dw, c.dh);
          doc.setDrawColor(190, 190, 190);
          doc.setLineWidth(0.2);
          doc.rect(imgX, y, c.dw, c.dh);
        } catch {
          /* formato non supportato: salta l'immagine */
        }
        let cy = y + c.dh + 3;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.8);
        doc.setTextColor(40, 40, 40);
        for (const l of c.capLines) {
          doc.text(l, x, cy);
          cy += 3.4;
        }
      });
      y += rowH;
    }
  }
}
