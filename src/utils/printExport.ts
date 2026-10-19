/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';

export interface PrintExportOptions {
  elementId: string;
  filename: string;
  defaultOrientation?: 'portrait' | 'landscape' | 'auto';
  columnCount?: number;
  scale?: number;
  marginMm?: number;
}

/**
 * Universal Pixel-Perfect PDF generator for financial statements and data tables.
 * Slices cleanly into A4 pages with zero horizontal cutoff and preserved borders/badges.
 */
export async function exportElementToPdf({
  elementId,
  filename,
  defaultOrientation = 'auto',
  columnCount = 0,
  scale = 2.2,
  marginMm = 10,
}: PrintExportOptions): Promise<boolean> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Export failed: element with id "${elementId}" not found.`);
    return false;
  }

  try {
    // Brief settling delay to allow any pending DOM/font rendering
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Auto-determine orientation:
    // Default to portrait, but switch to landscape if columnCount > 6 or tables exceed 6 columns
    let isLandscape = false;
    if (defaultOrientation === 'landscape') {
      isLandscape = true;
    } else if (defaultOrientation === 'portrait') {
      isLandscape = false;
    } else {
      // 'auto' mode: check columnCount or inspect tables in element
      const maxTableCols = Array.from(element.querySelectorAll('table')).reduce((max, tbl) => {
        const firstRowCols = tbl.querySelector('tr')?.children.length || 0;
        return Math.max(max, firstRowCols);
      }, 0);
      const effectiveCols = Math.max(columnCount, maxTableCols);
      isLandscape = effectiveCols > 6 || element.scrollWidth > element.scrollHeight * 1.15;
    }

    const containerWidthPx = isLandscape ? 1120 : 820;

    // High-resolution raster capture via html2canvas-pro with clone styling for pixel-perfect fitting
    const renderedCanvas = await html2canvas(element, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: containerWidthPx + 100,
      onclone: (clonedDoc) => {
        const clonedEl = clonedDoc.getElementById(elementId);
        if (clonedEl) {
          clonedEl.style.width = `${containerWidthPx}px`;
          clonedEl.style.maxWidth = '100%';
          clonedEl.style.background = '#ffffff';
          clonedEl.style.boxSizing = 'border-box';

          // Force all tables inside cloned element to take full width with auto table-layout
          clonedEl.querySelectorAll('table').forEach((tbl) => {
            (tbl as HTMLElement).style.width = '100%';
            (tbl as HTMLElement).style.maxWidth = '100%';
            (tbl as HTMLElement).style.tableLayout = 'auto';
            (tbl as HTMLElement).style.borderCollapse = 'collapse';
            (tbl as HTMLElement).style.wordBreak = 'break-word';
            // Ensure rows don't break inside tables
            tbl.querySelectorAll('tr').forEach(tr => {
              (tr as HTMLElement).style.pageBreakInside = 'avoid';
              (tr as HTMLElement).style.breakInside = 'avoid';
            });
          });

          // Expand any horizontal scroll wrappers so table columns are never clipped
          clonedEl.querySelectorAll('.overflow-x-auto, .overflow-auto').forEach((box) => {
            (box as HTMLElement).style.overflow = 'visible';
            (box as HTMLElement).style.width = '100%';
          });
        }
      },
      ignoreElements: (el) => {
        // Exclude interactive buttons, dropdowns, and items marked with no-print
        return (
          el.classList.contains('no-print') ||
          el.getAttribute('data-no-print') === 'true'
        );
      },
    });

    const orientation = isLandscape ? 'l' : 'p';
    const pdf = new jsPDF(orientation, 'mm', 'a4');
    const pageWidthMm = pdf.internal.pageSize.getWidth();
    const pageHeightMm = pdf.internal.pageSize.getHeight();

    const printableWidthMm = pageWidthMm - marginMm * 2;
    const printableHeightMm = pageHeightMm - marginMm * 2;

    const canvasWidth = renderedCanvas.width;
    const canvasHeight = renderedCanvas.height;

    // Height of one PDF page's content slice in canvas pixels
    const sliceHeightPx = (printableHeightMm * canvasWidth) / printableWidthMm;

    // Gather all break-avoid elements (table rows, summary cards, verification block, signature lines)
    const containerRect = element.getBoundingClientRect();
    const scaleRatioY = canvasHeight / (element.scrollHeight || containerRect.height);

    const breakAvoidSelectors = 'tr, tbody tr, .card, .summary-card, .summary-cards, .verification-block, .sign-row, .statement-header, .stat-card, [data-break-avoid="true"]';
    const breakAvoidEls = Array.from(element.querySelectorAll<HTMLElement>(breakAvoidSelectors));

    let sourceY = 0;
    let isFirstPage = true;

    while (sourceY < canvasHeight) {
      if (!isFirstPage) {
        pdf.addPage();
      }
      isFirstPage = false;

      let currentSliceHeightPx = Math.min(sliceHeightPx, canvasHeight - sourceY);

      // Smart page break: avoid slicing through table rows, summary cards, or signature blocks
      if (sourceY + currentSliceHeightPx < canvasHeight) {
        const nominalCutoff = sourceY + currentSliceHeightPx;
        let adjustedCutoff: number | null = null;

        for (const el of breakAvoidEls) {
          const r = el.getBoundingClientRect();
          const top = (r.top - containerRect.top + element.scrollTop) * scaleRatioY;
          const bottom = (r.bottom - containerRect.top + element.scrollTop) * scaleRatioY;

          // If element straddles cutoff line and top is at least 30% down the current page
          if (top < nominalCutoff && bottom > nominalCutoff) {
            if (top > sourceY + sliceHeightPx * 0.3) {
              adjustedCutoff = top;
              break;
            }
          }
        }

        if (adjustedCutoff !== null) {
          currentSliceHeightPx = Math.floor(adjustedCutoff - sourceY);
        }
      }

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvasWidth;
      tempCanvas.height = currentSliceHeightPx;
      const tempCtx = tempCanvas.getContext('2d');

      if (tempCtx) {
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, canvasWidth, currentSliceHeightPx);

        tempCtx.drawImage(
          renderedCanvas,
          0,
          sourceY,
          canvasWidth,
          currentSliceHeightPx,
          0,
          0,
          canvasWidth,
          currentSliceHeightPx
        );

        const sliceImgData = tempCanvas.toDataURL('image/png');
        const sliceWidthMm = printableWidthMm;
        const sliceHeightMm = (currentSliceHeightPx * printableWidthMm) / canvasWidth;

        pdf.addImage(
          sliceImgData,
          'PNG',
          marginMm,
          marginMm,
          sliceWidthMm,
          sliceHeightMm,
          undefined,
          'FAST'
        );
      }

      sourceY += currentSliceHeightPx;
    }

    const finalFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(finalFilename);
    return true;
  } catch (err) {
    console.error('Failed to export PDF:', err);
    throw err;
  }
}

/**
 * Triggers native browser print with temporary document title for clean default PDF naming.
 */
export function triggerNativePrint(customTitle?: string): void {
  const originalTitle = document.title;
  if (customTitle) {
    document.title = customTitle.replace(/\.pdf$/i, '');
  }

  window.print();

  // Restore title after print dialog closes
  setTimeout(() => {
    document.title = originalTitle;
  }, 1000);
}
