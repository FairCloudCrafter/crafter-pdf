/**
 * CrafterPdfDeliveryJob
 *
 * Queueable that runs a report, saves it as a ContentVersion, and emails
 * it to recipients — all within an async context so governor limits
 * (synchronous report runs, email sends) are maximised.
 *
 * This class intentionally does NOT render the PDF itself. Rendering is
 * client-side (jsPDF in the browser). For scheduled/server-side delivery
 * we persist a data-only ContentNote or wait for a future LWC-rendered blob
 * to be handed back via a Platform Event (Wave 4 target).
 *
 * For now, execute() saves the report's JSON fact map as a JSON ContentVersion
 * so recipients receive an auditable snapshot. The PDF render path will be
 * plugged in once the server-side render capability ships.
 *
 * @namespace fcrft
 */
public with sharing class CrafterPdfDeliveryJob implements Queueable {

    private final String reportId;
    private final String templateDeveloperName;
    private final String recipientsCsv;
    private final String emailSubject;
    private final String emailBody;
    private final String linkedRecordId;

    public CrafterPdfDeliveryJob(
        String reportId,
        String templateDeveloperName,
        String recipientsCsv,
        String emailSubject,
        String emailBody,
        String linkedRecordId
    ) {
        this.reportId               = reportId;
        this.templateDeveloperName  = templateDeveloperName;
        this.recipientsCsv          = recipientsCsv;
        this.emailSubject           = emailSubject;
        this.emailBody              = emailBody;
        this.linkedRecordId         = linkedRecordId;
    }

    public void execute(QueueableContext ctx) {
        // 1. Run report and capture fact map snapshot
        CrafterPdfService.ReportPayload payload;
        try {
            payload = CrafterPdfService.getReportPayload(reportId);
        } catch (Exception e) {
            // Log and exit — don't let a bad report crash the job silently
            System.debug(LoggingLevel.ERROR, 'CrafterPdfDeliveryJob: report fetch failed — ' + e.getMessage());
            return;
        }

        // 2. Persist JSON snapshot as a ContentVersion (PDF render is client-side;
        //    full server-side PDF ships in Wave 4 via Platform Events)
        String jsonSnapshot = JSON.serialize(payload);
        String base64       = EncodingUtil.base64Encode(Blob.valueOf(jsonSnapshot));
        String fileName     = (payload.reportName ?? 'Report') + ' — ' +
                              System.today().format() + ' (data snapshot)';

        CrafterPdfService.SaveResult saved = CrafterPdfService.savePdf(
            base64,
            fileName,
            linkedRecordId
        );

        if (!saved.success) {
            System.debug(LoggingLevel.ERROR, 'CrafterPdfDeliveryJob: save failed — ' + saved.errorMessage);
            return;
        }

        // 3. Email delivery
        if (String.isNotBlank(recipientsCsv)) {
            String body = String.isNotBlank(emailBody)
                ? emailBody
                : 'Your scheduled report "' + payload.reportName + '" data snapshot is attached.';
            CrafterPdfEmailService.sendPdfEmail(
                recipientsCsv,
                emailSubject,
                body,
                saved.contentVersionId,
                fileName
            );
        }
    }
}
