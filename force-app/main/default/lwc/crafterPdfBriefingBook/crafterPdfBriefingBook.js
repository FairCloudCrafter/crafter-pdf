import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { loadScript } from 'lightning/platformResourceLoader';
import getTemplateConfig from '@salesforce/apex/CrafterPdfService.getTemplateConfig';
import getMultipleReportPayloads from '@salesforce/apex/CrafterPdfService.getMultipleReportPayloads';
import savePdf from '@salesforce/apex/CrafterPdfService.savePdf';
import JSPDF_URL from '@salesforce/resourceUrl/CrafterPdfJsPdf';
import CHARTJS_URL from '@salesforce/resourceUrl/CrafterPdfChartJs';

const PAGE_SIZES = {
    Letter: { w: 215.9, h: 279.4 },
    A4:     { w: 210,   h: 297   }
};
const MARGIN     = 15;
const HEADER_H   = 12;
const FOOTER_H   = 10;
const CHART_H    = 70;
const FONT_SIZE_SM = 8;

/**
 * crafterPdfBriefingBook
 *
 * Composes up to 5 Salesforce reports into a single multi-section PDF
 * (one chart + table per report section, with a shared cover page and TOC).
 * Uses the same CrafterPdfTemplate__mdt branding as crafterPdfButton.
 */
export default class CrafterPdfBriefingBook extends LightningElement {

    // ─── App Builder properties ───────────────────────────────────

    /** Comma-separated list of report IDs (max 5). */
    @api reportIds = '';

    /** DeveloperName of the CrafterPdfTemplate__mdt record. */
    @api templateDeveloperName = 'Default';

    /** Book title shown on the cover page and file name. */
    @api bookTitle = 'Briefing Book';

    /** Button label. */
    @api buttonLabel = 'Export Briefing Book';

    /** When true, saves the PDF to Salesforce Files. */
    @api saveToFiles = false;

    /** Optional SObject record ID to link the ContentVersion to. */
    @api linkedRecordId;

    // ─── Internal state ───────────────────────────────────────────

    @track isLoading     = false;
    @track hasError      = false;
    @track errorMessage  = '';
    @track loadingMessage = 'Loading reports…';

    _libsLoaded    = false;
    templateConfig = null;

    // ─── Wired template config ────────────────────────────────────

    @wire(getTemplateConfig, { templateDeveloperName: '$templateDeveloperName' })
    wiredTemplate({ data, error }) {
        if (data)  { this.templateConfig = data; }
        if (error) { console.error('CrafterPDF BriefingBook: template config error', error); }
    }

    // ─── Lifecycle ────────────────────────────────────────────────

    connectedCallback() {
        Promise.all([
            loadScript(this, JSPDF_URL + '/jspdf.umd.min.js'),
            loadScript(this, CHARTJS_URL + '/chart.umd.min.js')
        ])
        .then(() => { this._libsLoaded = true; })
        .catch(err => { console.error('CrafterPDF BriefingBook: library load failed', err); });
    }

    // ─── Computed ─────────────────────────────────────────────────

    get reportList() {
        if (!this.reportIds) return null;
        return this.reportIds.split(',').map(s => s.trim()).filter(Boolean);
    }

    get buttonDisabled() {
        return this.isLoading || !this.reportIds;
    }

    get buttonIcon() {
        return this.isLoading ? '' : 'utility:download';
    }

    // ─── Export handler ───────────────────────────────────────────

    async handleExport() {
        const ids = (this.reportIds || '').split(',').map(s => s.trim()).filter(Boolean);
        if (ids.length === 0) {
            this.showError('No Report IDs configured. Add them in App Builder (comma-separated).');
            return;
        }
        if (ids.length > 5) {
            this.showError('Maximum 5 reports per briefing book.');
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

        this.isLoading    = true;
        this.hasError     = false;
        this.loadingMessage = 'Loading reports…';

        try {
            const payloads = await getMultipleReportPayloads({ reportIds: ids });
            this.loadingMessage = 'Building PDF…';
            const base64 = await this.renderBriefingBook(payloads, this.templateConfig);
            this.triggerDownload(base64, this.bookTitle);

            if (this.saveToFiles) {
                const result = await savePdf({
                    base64Pdf:      base64,
                    fileName:       this.bookTitle,
                    linkedRecordId: this.linkedRecordId || null
                });
                if (!result.success) throw new Error(result.errorMessage);
            }

            this.dispatchEvent(new ShowToastEvent({
                title:   'Briefing Book Ready',
                message: `"${this.bookTitle}" exported (${payloads.length} reports).`,
                variant: 'success'
            }));
        } catch (err) {
            this.showError(err?.body?.message || err?.message || 'Unknown error during PDF generation.');
        } finally {
            this.isLoading = false;
        }
    }

    // ─── Render pipeline ──────────────────────────────────────────

    async renderBriefingBook(payloads, config) {
        // eslint-disable-next-line no-undef
        const { jsPDF } = window.jspdf;
        const pageSize  = PAGE_SIZES[config.pageSize] || PAGE_SIZES.Letter;
        const doc       = new jsPDF({ unit: 'mm', format: [pageSize.w, pageSize.h] });
        const brand     = config.brandColor || '#ff7a3d';
        const contentW  = pageSize.w - MARGIN * 2;

        // ── Cover page ──────────────────────────────────────────
        this.drawCover(doc, this.bookTitle, payloads, brand, pageSize);

        // ── Table of Contents ───────────────────────────────────
        doc.addPage();
        this.drawToc(doc, payloads, brand, pageSize, contentW);

        // ── One section per report ──────────────────────────────
        for (let i = 0; i < payloads.length; i++) {
            doc.addPage();
            this.drawHeader(doc, config.headerText, brand, pageSize, contentW);
            this.drawSectionTitle(doc, payloads[i].reportName, i + 1, brand, contentW);

            const chartDataUrl = await this.buildChartImage(payloads[i], brand, contentW);
            const chartY       = MARGIN + HEADER_H + 12;
            doc.addImage(chartDataUrl, 'PNG', MARGIN, chartY, contentW, CHART_H);

            const tableY = chartY + CHART_H + 6;
            this.drawTable(doc, payloads[i], brand, tableY, contentW, pageSize, config);
        }

        // ── Footer on all pages ─────────────────────────────────
        const total = doc.getNumberOfPages();
        for (let p = 1; p <= total; p++) {
            doc.setPage(p);
            this.drawFooter(doc, config.footerText, brand, pageSize, contentW, p, total);
        }

        return doc.output('datauristring').split(',')[1];
    }

    // ─── Drawing helpers ──────────────────────────────────────────

    drawCover(doc, title, payloads, brand, pageSize) {
        doc.setFillColor(brand);
        doc.rect(0, 0, pageSize.w, 70, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text(title, MARGIN, 38, { maxWidth: pageSize.w - MARGIN * 2 });

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        doc.text(dateStr, MARGIN, 54);
        doc.text(`${payloads.length} report${payloads.length > 1 ? 's' : ''}`, MARGIN, 63);

        doc.setTextColor(40, 40, 40);
    }

    drawToc(doc, payloads, brand, pageSize, contentW) {
        let y = MARGIN + 10;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text('Table of Contents', MARGIN, y);
        y += 10;

        doc.setDrawColor(brand);
        doc.setLineWidth(0.4);
        doc.line(MARGIN, y, pageSize.w - MARGIN, y);
        y += 6;

        payloads.forEach((p, idx) => {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.text(`${idx + 1}.  ${p.reportName}`, MARGIN, y);
            y += 8;
        });
    }

    drawSectionTitle(doc, reportName, index, brand, contentW) {
        const y = MARGIN + HEADER_H + 4;
        doc.setFillColor(brand + '33'); // 20% alpha approximation via hex
        doc.rect(MARGIN, y, contentW, 8, 'F');
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`${index}. ${reportName}`, MARGIN + 2, y + 5.5);
        doc.setFont('helvetica', 'normal');
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
        const rows  = this.extractRows(factMap);
        if (rows.length === 0) return;

        let y       = startY;
        const rowH  = 7;
        const col0W = contentW * 0.6;
        const col1W = contentW * 0.4;
        const maxY  = pageSize.h - FOOTER_H - MARGIN;

        doc.setFillColor(brand);
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(FONT_SIZE_SM);
        doc.setFont('helvetica', 'bold');
        doc.rect(MARGIN, y, contentW, rowH, 'F');
        doc.text('Row',   MARGIN + 2,         y + 5);
        doc.text('Value', MARGIN + col0W + 2, y + 5);
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

    async buildChartImage(reportPayload, brand, contentW) {
        const { labels, values, valueLabel } = this.extractChartData(reportPayload);
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
                animation:  false,
                responsive: false,
                plugins: { legend: { display: true, position: 'top' } },
                scales: {
                    x: { ticks: { maxRotation: 45, font: { size: 9 } } },
                    y: { beginAtZero: true, ticks: { font: { size: 9 } } }
                }
            }
        });
        await Promise.resolve();
        const dataUrl = canvas.toDataURL('image/png');
        chart.destroy();
        return dataUrl;
    }

    extractRows(factMap) {
        const rows = [{ label: 'Row', value: 'Value' }];
        if (!factMap) return rows;
        Object.entries(factMap).forEach(([key, cell]) => {
            if (key === 'T!T') return;
            const cells = cell?.dataCells;
            if (!cells || cells.length === 0) return;
            rows.push({ label: key.replace(/[!_]/g, ' '), value: cells[0]?.label ?? cells[0]?.value ?? '' });
        });
        return rows;
    }

    extractChartData(reportPayload) {
        const factMap   = reportPayload.factMap;
        const labels    = [];
        const values    = [];
        let   valueLabel = '';
        if (!factMap) return { labels, values, valueLabel };
        const meta = reportPayload.reportMetadata;
        if (meta?.aggregates?.length) valueLabel = meta.aggregates[0]?.label || '';
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

    resolveMergeFields(text, currentPage, totalPages) {
        if (!text) return '';
        const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        return text
            .replace(/\{!Date\}/gi,       date)
            .replace(/\{!PageNumber\}/gi, currentPage  != null ? String(currentPage)  : '')
            .replace(/\{!TotalPages\}/gi, totalPages   != null ? String(totalPages)   : '');
    }

    triggerDownload(base64, title) {
        const blob = this.base64ToBlob(base64, 'application/pdf');
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = (title || 'briefing-book').replace(/[^a-zA-Z0-9 _-]/g, '') + '.pdf';
        a.click();
        URL.revokeObjectURL(url);
    }

    base64ToBlob(base64, mimeType) {
        const binary = atob(base64);
        const bytes  = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new Blob([bytes], { type: mimeType });
    }

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
