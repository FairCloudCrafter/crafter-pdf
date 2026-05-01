import { createElement } from 'lwc';
import CrafterPdfButton from 'c/crafterPdfButton';
import getTemplateConfig from '@salesforce/apex/CrafterPdfService.getTemplateConfig';
import getReportPayload from '@salesforce/apex/CrafterPdfService.getReportPayload';
import savePdf from '@salesforce/apex/CrafterPdfService.savePdf';
import { loadScript } from 'lightning/platformResourceLoader';

// Auto-mock Apex methods
jest.mock('@salesforce/apex/CrafterPdfService.getTemplateConfig',
    () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/CrafterPdfService.getReportPayload',
    () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/CrafterPdfService.savePdf',
    () => ({ default: jest.fn() }), { virtual: true });

// loadScript mock — resolves immediately
jest.mock('lightning/platformResourceLoader', () => ({
    loadScript: jest.fn().mockResolvedValue(undefined)
}), { virtual: true });

// Minimal window.jspdf + Chart stubs
const mockJsPdfInstance = {
    setFillColor:    jest.fn(),
    setTextColor:    jest.fn(),
    setFontSize:     jest.fn(),
    setFont:         jest.fn(),
    setDrawColor:    jest.fn(),
    setLineWidth:    jest.fn(),
    rect:            jest.fn(),
    text:            jest.fn(),
    line:            jest.fn(),
    addImage:        jest.fn(),
    addPage:         jest.fn(),
    setPage:         jest.fn(),
    getNumberOfPages: jest.fn(() => 1),
    output:          jest.fn(() => 'data:application/pdf;base64,AAAA')
};
global.window = global.window || {};
global.window.jspdf = { jsPDF: jest.fn(() => mockJsPdfInstance) };
global.Chart = jest.fn(() => ({
    destroy: jest.fn()
}));

// createObjectURL / revokeObjectURL stubs
global.URL.createObjectURL = jest.fn(() => 'blob:mock');
global.URL.revokeObjectURL = jest.fn();

// ─── Fixtures ────────────────────────────────────────────────────

const MOCK_CONFIG = {
    brandColor:          '#ff7a3d',
    logoStaticResource:  null,
    pageSize:            'Letter',
    coverPage:           false,
    headerText:          '',
    footerText:          'Page {!PageNumber}'
};

const MOCK_REPORT_PAYLOAD = {
    reportId:        '00O000000000001',
    reportName:      'Q2 Pipeline',
    factMap:         {
        'T!0': { dataCells: [{ label: 'Closed Won', value: 250000 }] },
        'T!1': { dataCells: [{ label: 'Prospecting', value: 80000 }] }
    },
    reportMetadata:  { aggregates: [{ label: 'Amount' }], name: 'Q2 Pipeline' }
};

// ─── Tests ────────────────────────────────────────────────────────

describe('c-crafter-pdf-button', () => {

    let element;

    beforeEach(() => {
        element = createElement('c-crafter-pdf-button', { is: CrafterPdfButton });
        element.reportId              = '00O000000000001';
        element.templateDeveloperName = 'Default';
        document.body.appendChild(element);
    });

    afterEach(() => {
        document.body.removeChild(element);
        jest.clearAllMocks();
    });

    // ── Rendering ────────────────────────────────────────────────

    it('renders the export button', () => {
        const btn = element.shadowRoot.querySelector('lightning-button');
        expect(btn).not.toBeNull();
    });

    it('button is disabled when no reportId', async () => {
        element.reportId = null;
        await Promise.resolve();
        const btn = element.shadowRoot.querySelector('lightning-button');
        expect(btn.disabled).toBe(true);
    });

    it('button is enabled when reportId is set', async () => {
        await Promise.resolve();
        const btn = element.shadowRoot.querySelector('lightning-button');
        expect(btn.disabled).toBe(false);
    });

    // ── Library loading ──────────────────────────────────────────

    it('calls loadScript for both static resources on connect', () => {
        expect(loadScript).toHaveBeenCalledTimes(2);
    });

    // ── Export flow ──────────────────────────────────────────────

    it('calls getReportPayload and renders PDF on click', async () => {
        // Simulate wired template
        getTemplateConfig.emit(MOCK_CONFIG);
        await Promise.resolve();

        // Simulate libs loaded
        element._libsLoaded = true;

        getReportPayload.mockResolvedValue(MOCK_REPORT_PAYLOAD);

        const btn = element.shadowRoot.querySelector('lightning-button');
        btn.click();
        await Promise.resolve();

        expect(getReportPayload).toHaveBeenCalledWith({ reportId: '00O000000000001' });
    });

    it('shows error toast when reportId is missing on click', async () => {
        element.reportId     = null;
        element._libsLoaded  = true;
        getTemplateConfig.emit(MOCK_CONFIG);
        await Promise.resolve();

        const toastHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);

        const btn = element.shadowRoot.querySelector('lightning-button');
        btn.click();
        await Promise.resolve();

        expect(element.shadowRoot.querySelector('.slds-notify_alert')).not.toBeNull();
    });

    it('calls savePdf when saveToFiles is true', async () => {
        element.saveToFiles  = true;
        element._libsLoaded  = true;
        getTemplateConfig.emit(MOCK_CONFIG);
        await Promise.resolve();

        getReportPayload.mockResolvedValue(MOCK_REPORT_PAYLOAD);
        savePdf.mockResolvedValue({ success: true, contentVersionId: 'abc', contentDocumentId: 'xyz' });

        // Stub renderPdf to avoid full canvas setup in unit test
        element.renderPdf = jest.fn().mockResolvedValue('AAAA');

        const btn = element.shadowRoot.querySelector('lightning-button');
        btn.click();
        await Promise.resolve();
        await Promise.resolve();

        expect(savePdf).toHaveBeenCalled();
    });

    // ── Merge fields ─────────────────────────────────────────────

    it('resolves {!PageNumber} merge field', () => {
        const result = element.resolveMergeFields('Page {!PageNumber} of {!TotalPages}', 2, 5);
        expect(result).toBe('Page 2 of 5');
    });

    it('resolves {!Date} merge field', () => {
        const result = element.resolveMergeFields('{!Date}', 1, 1);
        expect(result).toMatch(/\d{4}/); // should contain a year
    });

    // ── Row extraction ───────────────────────────────────────────

    it('extractRows returns header + data rows', () => {
        const rows = element.extractRows(MOCK_REPORT_PAYLOAD.factMap);
        // header sentinel + 2 data rows
        expect(rows.length).toBe(3);
    });

    it('extractRows skips T!T grand total key', () => {
        const factMap = {
            'T!0': { dataCells: [{ label: 'Row 1', value: 1 }] },
            'T!T': { dataCells: [{ label: 'Total', value: 9999 }] }
        };
        const rows = element.extractRows(factMap);
        expect(rows.length).toBe(2); // header + 1 data row, not grand total
    });
});
