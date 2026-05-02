/**
 * CrafterPdfService
 * Core Apex service for the Crafter PDF engine.
 *
 * Responsibilities:
 *  - Load CrafterPdfTemplate__mdt configuration by DeveloperName.
 *  - Fetch report data via the Reports API.
 *  - Return serialised report payloads to the LWC for client-side rendering.
 *  - Accept a rendered PDF blob from the LWC and persist it as a ContentVersion.
 *
 * Architecture note:
 *  All PDF rendering (Chart.js → jsPDF) happens client-side inside the LWC.
 *  This class never calls external services and never handles raw PDF bytes
 *  until the LWC returns a Base64-encoded blob for optional persistence.
 *
 * @namespace fcrft
 */
public with sharing class CrafterPdfService {

    // ─────────────────────────────────────────────────────────────
    // Inner types
    // ─────────────────────────────────────────────────────────────

    /**
     * Lightweight DTO returned to the LWC containing all configuration
     * needed to render a PDF without additional round-trips.
     */
    public class TemplateConfig {
        @AuraEnabled public String brandColor;
        @AuraEnabled public String logoStaticResource;
        @AuraEnabled public String pageSize;
        @AuraEnabled public Boolean coverPage;
        @AuraEnabled public String headerText;
        @AuraEnabled public String footerText;
    }

    /**
     * Wrapper for a single report's data, ready for Chart.js consumption.
     */
    public class ReportPayload {
        @AuraEnabled public String reportId;
        @AuraEnabled public String reportName;
        @AuraEnabled public Object factMap;
        @AuraEnabled public Object reportMetadata;
    }

    /**
     * Result returned after persisting a generated PDF to ContentVersion.
     */
    public class SaveResult {
        @AuraEnabled public String contentVersionId;
        @AuraEnabled public String contentDocumentId;
        @AuraEnabled public Boolean success;
        @AuraEnabled public String errorMessage;
    }

    // ─────────────────────────────────────────────────────────────
    // Template configuration
    // ─────────────────────────────────────────────────────────────

    /**
     * Returns the TemplateConfig for the given Custom Metadata DeveloperName.
     * Defaults to a safe, un-branded configuration if no record is found.
     *
     * @param templateDeveloperName  DeveloperName of the CrafterPdfTemplate__mdt record.
     */
    @AuraEnabled(cacheable=true)
    public static TemplateConfig getTemplateConfig(String templateDeveloperName) {
        TemplateConfig config = new TemplateConfig();
        config.pageSize      = 'Letter';
        config.coverPage     = false;
        config.brandColor    = '#ff7a3d';
        config.headerText    = '';
        config.footerText    = 'Page {!PageNumber}';

        if (String.isBlank(templateDeveloperName)) {
            return config;
        }

        List<CrafterPdfTemplate__mdt> records = [
            SELECT  Brand_Color__c,
                    Logo_Static_Resource__c,
                    Page_Size__c,
                    Cover_Page__c,
                    Header_Text__c,
                    Footer_Text__c
            FROM    CrafterPdfTemplate__mdt
            WHERE   DeveloperName = :templateDeveloperName
            WITH USER_MODE
            LIMIT   1
        ];

        if (records.isEmpty()) {
            return config;
        }

        CrafterPdfTemplate__mdt rec = records[0];
        if (String.isNotBlank(rec.Brand_Color__c))        config.brandColor          = rec.Brand_Color__c;
        if (String.isNotBlank(rec.Logo_Static_Resource__c)) config.logoStaticResource = rec.Logo_Static_Resource__c;
        if (String.isNotBlank(rec.Page_Size__c))           config.pageSize            = rec.Page_Size__c;
        config.coverPage  = rec.Cover_Page__c == true;
        if (String.isNotBlank(rec.Header_Text__c))         config.headerText          = rec.Header_Text__c;
        if (String.isNotBlank(rec.Footer_Text__c))         config.footerText          = rec.Footer_Text__c;

        return config;
    }

    // ─────────────────────────────────────────────────────────────
    // Reports API bridge
    // ─────────────────────────────────────────────────────────────

    /**
     * Executes a Salesforce report synchronously and returns a JSON-serialised
     * Reports.ReportResults payload for client-side chart rendering.
     *
     * Governor-limit note: each call consumes 1 synchronous report execution.
     * Callers should batch requests via getMultipleReportPayloads when possible.
     *
     * @param reportId  15 or 18-character report record ID.
     */
    @AuraEnabled
    public static ReportPayload getReportPayload(String reportId) {
        if (String.isBlank(reportId)) {
            throw new AuraHandledException('reportId is required.');
        }

        Reports.ReportResults results = Reports.ReportManager.runReport(reportId, true);
        ReportPayload payload         = new ReportPayload();
        payload.reportId              = reportId;
        payload.reportName            = results.getReportMetadata().getName();
        payload.factMap               = results.getFactMap();
        payload.reportMetadata        = results.getReportMetadata();

        return payload;
    }

    /**
     * Convenience method for briefing-book use cases: runs up to 5 reports
     * in a single transaction (Salesforce governor limit for synchronous report runs).
     *
     * @param reportIds  List of report IDs to execute.
     */
    @AuraEnabled
    public static List<ReportPayload> getMultipleReportPayloads(List<String> reportIds) {
        if (reportIds == null || reportIds.isEmpty()) {
            throw new AuraHandledException('reportIds list is required.');
        }
        if (reportIds.size() > 5) {
            throw new AuraHandledException('Maximum 5 reports per synchronous call.');
        }

        List<ReportPayload> payloads = new List<ReportPayload>();
        for (String id : reportIds) {
            payloads.add(getReportPayload(id));
        }
        return payloads;
    }

    // ─────────────────────────────────────────────────────────────
    // PDF persistence
    // ─────────────────────────────────────────────────────────────

    /**
     * Accepts a Base64-encoded PDF blob from the LWC and persists it as a
     * ContentVersion linked to the specified record.
     *
     * @param base64Pdf      Base64-encoded PDF bytes produced by jsPDF in the browser.
     * @param fileName       Desired file name, e.g. "Q2 Pipeline - Apr 2026.pdf".
     * @param linkedRecordId Optional SObject record ID to link the file to.
     */
    @AuraEnabled
    public static SaveResult savePdf(String base64Pdf, String fileName, String linkedRecordId) {
        SaveResult result = new SaveResult();
        try {
            // CRUD check — AppExchange security requirement
            if (!Schema.sObjectType.ContentVersion.isCreateable()) {
                throw new AuraHandledException('Insufficient permissions to create files.');
            }

            // Validate linkedRecordId is a well-formed Salesforce ID before use as a DML field
            if (String.isNotBlank(linkedRecordId) &&
                !Pattern.matches('[a-zA-Z0-9]{15}|[a-zA-Z0-9]{18}', linkedRecordId)) {
                throw new AuraHandledException('Invalid linkedRecordId format.');
            }

            ContentVersion cv       = new ContentVersion();
            cv.Title                = String.isNotBlank(fileName) ? fileName : 'Crafter PDF Export';
            cv.PathOnClient         = cv.Title + '.pdf';
            cv.VersionData          = EncodingUtil.base64Decode(base64Pdf);
            cv.IsMajorVersion       = true;
            if (String.isNotBlank(linkedRecordId)) {
                cv.FirstPublishLocationId = linkedRecordId;
            }
            // USER_MODE enforces sharing rules, CRUD, and FLS on DML
            Database.insert(cv, AccessLevel.USER_MODE);

            // Fetch the ContentDocumentId for callers that need it
            ContentVersion inserted = [
                SELECT ContentDocumentId
                FROM   ContentVersion
                WHERE  Id = :cv.Id
                WITH USER_MODE
                LIMIT  1
            ];
            result.contentVersionId   = cv.Id;
            result.contentDocumentId  = inserted.ContentDocumentId;
            result.success            = true;
        } catch (AuraHandledException e) {
            throw e; // re-throw user-facing errors as-is
        } catch (Exception e) {
            result.success      = false;
            result.errorMessage = e.getMessage();
        }
        return result;
    }
}
