import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getTemplateConfig from '@salesforce/apex/CrafterPdfService.getTemplateConfig';
import getReportPayload from '@salesforce/apex/CrafterPdfService.getReportPayload';
import savePdf from '@salesforce/apex/CrafterPdfService.savePdf';

/**
 * crafterPdfButton
 *
 * Drop this component onto any Lightning page via App Builder.
 * When clicked it:
 *  1. Loads the branding template from Apex.
 *  2. Fetches report data via the Reports API (Apex bridge).
 *  3. Hands the data + config to the client-side render pipeline
 *     (jsPDF + Chart.js static resources — wired in Wave 2).
 *  4. Offers download and optional ContentVersion save.
 */
export default class CrafterPdfButton extends LightningElement {

    // ─── Public properties (configurable in App Builder) ─────────

    /** DeveloperName of the CrafterPdfTemplate__mdt record to use. */
    @api templateDeveloperName = 'Default';

    /** Report ID to export. Accepts 15 or 18-char Salesforce IDs. */
    @api reportId;

    /** Optional SObject record ID to link the saved ContentVersion to. */
    @api linkedRecordId;

    /** Label shown on the button. */
    @api buttonLabel = 'Export PDF';

    /** When true, automatically saves the generated PDF to Salesforce Files. */
    @api saveToFiles = false;

    // ─── Internal state ───────────────────────────────────────────

    @track isLoading = false;
    @track hasError  = false;
    @track errorMessage = '';

    // ─── Wired template config ────────────────────────────────────

    templateConfig;
    templateError;

    @wire(getTemplateConfig, { templateDeveloperName: '$templateDeveloperName' })
    wiredTemplate({ data, error }) {
        if (data)  { this.templateConfig = data; this.templateError = undefined; }
        if (error) { this.templateError  = error; }
    }

    // ─── Computed ─────────────────────────────────────────────────

    get buttonDisabled() {
        return this.isLoading || !this.reportId;
    }

    get buttonIcon() {
        return this.isLoading ? '' : 'utility:download';
    }

    // ─── Handlers ─────────────────────────────────────────────────

    async handleExport() {
        if (!this.reportId) {
            this.showError('No reportId configured. Set the Report ID property in App Builder.');
            return;
        }
        if (!this.templateConfig) {
            this.showError('Template configuration not loaded. Check the Template Developer Name property.');
            return;
        }

        this.isLoading  = true;
        this.hasError   = false;

        try {
            const payload = await getReportPayload({ reportId: this.reportId });
            await this.renderAndDownload(payload, this.templateConfig);
        } catch (err) {
            this.showError(err?.body?.message || err?.message || 'Unknown error during PDF generation.');
        } finally {
            this.isLoading = false;
        }
    }

    // ─── PDF render pipeline (Wave 2 — wires in jsPDF + Chart.js) ─

    /**
     * Placeholder for the full render pipeline.
     * In Wave 2 this will:
     *  - Decode report factMap into Chart.js datasets.
     *  - Render each chart onto an offscreen canvas.
     *  - Assemble pages with jsPDF (cover, header, charts, footer).
     *  - Return a Base64 blob for download or save.
     */
    // eslint-disable-next-line no-unused-vars
    async renderAndDownload(reportPayload, config) {
        // Wave 2 implementation replaces this stub.
        // For now, dispatch a toast showing the report name to confirm wiring.
        this.dispatchEvent(new ShowToastEvent({
            title:   'Crafter PDF — Pipeline wired',
            message: `Report "${reportPayload.reportName}" loaded. Render engine ships in Wave 2.`,
            variant: 'success'
        }));
    }

    // ─── Helpers ──────────────────────────────────────────────────

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
