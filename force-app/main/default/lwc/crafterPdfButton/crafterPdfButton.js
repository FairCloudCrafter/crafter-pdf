import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { loadScript } from 'lightning/platformResourceLoader';
import getTemplateConfig from '@salesforce/apex/CrafterPdfService.getTemplateConfig';
import getReportPayload from '@salesforce/apex/CrafterPdfService.getReportPayload';
import savePdf from '@salesforce/apex/CrafterPdfService.savePdf';
import JSPDF_URL from '@salesforce/resourceUrl/CrafterPdfJsPdf';
import CHARTJS_URL from '@salesforce/resourceUrl/CrafterPdfChartJs';

// Page dimensions in mm
const PAGE_SIZES = {
    Letter: { w: 215.9, h: 279.4 },
    A4:     { w: 210,   h: 297   }
};
const MARGIN       = 15;   // mm
const HEADER_H     = 12;   // mm reserved at top
const FOOTER_H     = 10;   // mm reserved at bottom
const CHART_H      = 80;   // mm per chart block
const FONT_SIZE_SM = 8;
const FONT_SIZE_MD = 10;

/**
 * crafterPdfButton
 *
 * Drop onto any Lightning page via App Builder.
 * Render pipeline:
 *  1. Wire CrafterPdfTemplate__mdt config from Apex (cacheable).
 *  2. On click — fetch report factMap via Reports API (Apex).
 *  3. Decode factMap → Chart.js bar chart on offscreen canvas.
 *  4. Assemble PDF with jsPDF: optional cover, header, chart image, footer.
 *  5. Trigger browser download and optionally save to Salesforce Files.
 */
export default class CrafterPdfButton extends LightningElement {

    // ─── Public properties (App Builder) ─────────────────────────

    @api templateDeveloperName = 'Default';
    @api reportId;
    @api linkedRecordId;
    @api buttonLabel = 'Export PDF';
    @api saveToFiles = false;

    // ─── Internal state ───────────────────────────────────────────

    @track isLoading = false;
    @track hasError  = false;
    @track errorMessage = '';

    _libsLoaded = false;
    templateConfig;

    // ─── Lifecycle ────────────────────────────────────────────────

    connectedCallback() {
        Promise.all([
            loadScript(this, JSPDF_URL + '/jspdf.umd.min.js'),
            loadScript(this, CHARTJS_URL + '/chart.umd.min.js')
        ])
        .then(() => { this._libsLoaded = true; })
        .catch(err => {
            // Non-fatal at connect time; will surface on export attempt.
            console.error('CrafterPDF: library load failed', err);
        });
    }

    // ─── Wired template config ────────────────────────────────────

    @wire(getTemplateConfig, { templateDeveloperName: '$templateDeveloperName' })
    wiredTemplate({ data, error }) {
        if (data)  { this.templateConfig = data; }
        if (error) { console.error('CrafterPDF: template config error', error); }
    }

    // ─── Computed ─────────────────────────────────────────────────

    get buttonDisabled() {
        return this.isLoading || !this.reportId;
    }

    get buttonIcon() {
        return this.isLoading ? '' : 'utility:download';
    }

    // ─── Export handler ───────────────────────────────────────────

    async handleExport() {
        if (!this.reportId) {
            this.showError('No Report ID configured. Set it in App Builder.');
            return;
        }
        if (!this._libsLoaded) {
            this.showError('PDF libraries are still loading. Try again in a moment.');
            return;
        }
        if (!this.templateConfig) {
            this.showError('Template configuration not loaded. Check the Template Developer Name.');
            return;
        }

        this.isLoading = true;
        this.hasError  = false;

        try {
            const payload = await getReportPayload({ reportId: this.reportId });
            const base64  = await this.renderPdf(payload, this.templateConfig);
            this.triggerDownload(base64, payload.reportName);

            if (this.saveToFiles) {
                const fileName = payload.reportName || 'Crafter PDF Export';
                const result   = await savePdf({
                    base64Pdf:      base64,
                    fileName:       fileName,
                    linkedRecordId: this.linkedRecordId || null
                });
                if (!result.success) throw new Error(result.errorMessage);
            }

            this.dispatchEvent(new ShowToastEvent({
                title:   'PDF Generated',
                message: `"${payload.reportName}" exported successfully.`,
                variant: 'success'
            }));
        } catch (err) {
            this.showError(err?.body?.message || err?.message || 'Unknown error during PDF generation.');
        } finally {
            this.isLoading = false;
        }
    }

    // ─── Render pipeline ──────────────────────────────────────────

    async renderPdf(reportPayload, config) {
        // eslint-disable-next-line no-undef
        const { jsPDF } = window.jspdf;
        const pageSize  = PAGE_SIZES[config.pageSize] || PAGE_SIZES.Letter;
        const doc       = new jsPDF({ unit: 'mm', format: [pageSize.w, pageSize.h] });
        const brand     = config.brandColor || '#ff7a3d';
        const contentW  = pageSize.w - MARGIN * 2;

        // ── Cover page ──────────────────────────────────────────
        if (config.coverPage) {
            this.drawCover(doc, reportPayload.reportName, brand, pageSize, config);
            doc.addPage();
        }

        // ── Header ──────────────────────────────────────────────
        this.drawHeader(doc, config.headerText, brand, pageSize, contentW);

        // ── Chart ───────────────────────────────────────────────
        const chartDataUrl = await this.buildChartImage(reportPayload, brand, contentW);
        const chartY       = MARGIN + HEADER_H + 2;
        doc.addImage(chartDataUrl, 'PNG', MARGIN, chartY, contentW, CHART_H);

        // ── Data table ──────────────────────────────────────────
        const tableY = chartY + CHART_H + 6;
        this.drawTable(doc, reportPayload, brand, tableY, contentW, pageSize, config);

        // ── Footer (all pages) ──────────────────────────────────
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            this.drawFooter(doc, config.footerText, brand, pageSize, contentW, i, totalPages);
        }

        return doc.output('datauristring').split(',')[1];
    }

    // ─── Drawing helpers ──────────────────────────────────────────

    drawCover(doc, reportName, brand, pageSize, config) {
        // Brand colour background strip
        doc.setFillColor(brand);
        doc.rect(0, 0, pageSize.w, 60, 'F');

        // Logo (if configured and available as a data URL on window — future enhancement)
        // Org name + report title
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text(reportName || 'Report', MARGIN, 35, { maxWidth: pageSize.w - MARGIN * 2 });

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        doc.text(dateStr, MARGIN, 50);

        // Reset colour
        doc.setTextColor(40, 40, 40);
    }

    drawHeader(doc, headerText, brand, pageSize, contentW) {
        if (!headerText) return;
        const text = this.resolveMergeFields(headerText);
        doc.setFillColor(brand);
        doc.rect(0, 0, pageSize.w, HEADER_H, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(FONT_SIZE_SM);
        doc.setFont('helvetica', 'normal');
        doc.text(text, MARGIN, HEADER_H - 3);
        doc.setTextColor(40, 40, 40);
    }

    drawFooter(doc, footerText, brand, pageSize, contentW, currentPage, totalPages) {
        const y    = pageSize.h - FOOTER_H + 4;
        const text = this.resolveMergeFields(footerText, currentPage, totalPages);
        doc.setDrawColor(brand);
        doc.setLineWidth(0.3);
        doc.line(MARGIN, pageSize.h - FOOTER_H, pageSize.w - MARGIN, pageSize.h - FOOTER_H);
        doc.setFontSize(FONT_SIZE_SM);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120, 120, 120);
        doc.text(text || '', MARGIN, y);
        doc.setTextColor(40, 40, 40);
    }

    drawTable(doc, reportPayload, brand, startY, contentW, pageSize, config) {
        const factMap = reportPayload.factMap;
        if (!factMap) return;

        const rows = this.extractRows(factMap);
        if (rows.length === 0) return;

        let y = startY;
        const rowH    = 7;
        const col0W   = contentW * 0.55;
        const col1W   = contentW * 0.45;
        const maxY    = pageSize.h - FOOTER_H - MARGIN;

        // Header row
        doc.setFillColor(brand);
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(FONT_SIZE_SM);
        doc.setFont('helvetica', 'bold');
        doc.rect(MARGIN, y, contentW, rowH, 'F');
        doc.text(rows[0].label || 'Row',   MARGIN + 2,          y + 5);
        doc.text(rows[0].value || 'Value', MARGIN + col0W + 2,  y + 5);
        y += rowH;

        doc.setFont('helvetica', 'normal');
        rows.slice(1).forEach((row, idx) => {
            if (y + rowH > maxY) {
                doc.addPage();
                this.drawHeader(doc, config.headerText, brand, pageSize, contentW);
                y = MARGIN + HEADER_H + 4;
            }
            doc.setFillColor(idx % 2 === 0 ? 245 : 255, idx % 2 === 0 ? 245 : 255, idx % 2 === 0 ? 245 : 255);
            doc.rect(MARGIN, y, contentW, rowH, 'F');
            doc.setTextColor(40, 40, 40);
            doc.text(String(row.label ?? ''), MARGIN + 2,         y + 5, { maxWidth: col0W - 4 });
            doc.text(String(row.value ?? ''), MARGIN + col0W + 2, y + 5, { maxWidth: col1W - 4 });
            y += rowH;
        });
    }

    // ─── Chart rendering ──────────────────────────────────────────

    async buildChartImage(reportPayload, brand, contentW) {
        const { labels, values, valueLabel } = this.extractChartData(reportPayload);

        // Offscreen canvas — sized proportionally to PDF content width
        const PX_PER_MM = 3.78;
        const canvasW   = Math.round(contentW * PX_PER_MM);
        const canvasH   = Math.round(CHART_H  * PX_PER_MM);
        const canvas    = document.createElement('canvas');
        canvas.width    = canvasW;
        canvas.height   = canvasH;

        // eslint-disable-next-line no-undef
        const chart = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label:           valueLabel || 'Value',
                    data:            values,
                    backgroundColor: brand,
                    borderRadius:    3
                }]
            },
            options: {
                animation:   false,
                responsive:  false,
                plugins: {
                    legend: { display: true, position: 'top' }
                },
                scales: {
                    x: { ticks: { maxRotation: 45, font: { size: 10 } } },
                    y: { beginAtZero: true, ticks: { font: { size: 10 } } }
                }
            }
        });

        // Wait one microtask for Chart.js to finish drawing synchronously
        await Promise.resolve();
        const dataUrl = canvas.toDataURL('image/png');
        chart.destroy();
        return dataUrl;
    }

    // ─── Data extraction helpers ──────────────────────────────────

    /**
     * Extracts flat { label, value } rows from a Reports API factMap.
     * The factMap keys follow the pattern "T!0", "T!1", … for tabular reports
     * and "groupingName!rowIndex" for summary reports.
     */
    extractRows(factMap) {
        const rows  = [{ label: 'Row', value: 'Value' }]; // header sentinel
        if (!factMap) return rows;

        const entries = Object.entries(factMap);
        entries.forEach(([key, cell]) => {
            if (key === 'T!T') return; // Grand total row — skip
            const cells = cell?.dataCells;
            if (!cells || cells.length === 0) return;
            const label = key.replace(/[!_]/g, ' ');
            const value = cells[0]?.label ?? cells[0]?.value ?? '';
            rows.push({ label, value });
        });
        return rows;
    }

    extractChartData(reportPayload) {
        const factMap   = reportPayload.factMap;
        const labels    = [];
        const values    = [];
        let   valueLabel = '';

        if (!factMap) return { labels, values, valueLabel };

        const metadata = reportPayload.reportMetadata;
        if (metadata?.aggregates?.length) {
            valueLabel = metadata.aggregates[0]?.label || '';
        }

        Object.entries(factMap).forEach(([key, cell]) => {
            if (key === 'T!T') return;
            const cells = cell?.dataCells;
            if (!cells || cells.length === 0) return;
            labels.push(key.replace(/[!_]/g, ' '));
            const raw = cells[0]?.value;
            values.push(typeof raw === 'number' ? raw : parseFloat(raw) || 0);
        });

        return { labels, values, valueLabel };
    }

    // ─── Merge field resolver ─────────────────────────────────────

    resolveMergeFields(text, currentPage, totalPages) {
        if (!text) return '';
        const date    = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        return text
            .replace(/\{!Date\}/gi,       date)
            .replace(/\{!PageNumber\}/gi, currentPage  != null ? String(currentPage)  : '')
            .replace(/\{!TotalPages\}/gi, totalPages   != null ? String(totalPages)   : '');
    }

    // ─── Download trigger ─────────────────────────────────────────

    triggerDownload(base64, reportName) {
        const blob = this.base64ToBlob(base64, 'application/pdf');
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = (reportName || 'crafter-pdf-export').replace(/[^a-zA-Z0-9 _-]/g, '') + '.pdf';
        a.click();
        URL.revokeObjectURL(url);
    }

    base64ToBlob(base64, mimeType) {
        const binary = atob(base64);
        const bytes  = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new Blob([bytes], { type: mimeType });
    }

    // ─── Error helper ─────────────────────────────────────────────

    showError(message) {
        this.hasError     = true;
        this.errorMessage = message;
        this.dispatchEvent(new ShowToastEvent({
            title:   'Crafter PDF Error',
            message,
            variant: 'error',
            mode:    'sticky'
        }));
    }
}
