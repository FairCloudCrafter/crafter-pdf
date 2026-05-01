/**
 * CrafterPdfInvocable
 *
 * Flow / Process Builder invocable action that saves a pre-rendered PDF
 * (Base64 string produced by the LWC or an external process) to Salesforce Files
 * and optionally sends it via email.
 *
 * Designed for admin-driven automation:
 *  - Record-triggered flows (e.g. "When Opportunity closes, generate & attach PDF")
 *  - Scheduled flows (e.g. "Every Monday, email the pipeline report PDF")
 *  - Screen flows (e.g. "Let user click Generate PDF, then route for approval")
 *
 * @namespace fcrft
 */
public with sharing class CrafterPdfInvocable {

    // ─────────────────────────────────────────────────────────────
    // Input / Output types
    // ─────────────────────────────────────────────────────────────

    public class SavePdfInput {
        @InvocableVariable(label='Base64 PDF' description='Base64-encoded PDF string produced by the LWC or another process.' required=true)
        public String base64Pdf;

        @InvocableVariable(label='File Name' description='Desired file name without extension, e.g. "Q2 Pipeline Report".')
        public String fileName;

        @InvocableVariable(label='Linked Record ID' description='SObject record ID to attach the PDF to (e.g. Opportunity, Account).')
        public String linkedRecordId;

        @InvocableVariable(label='Send Email' description='Set to true to email the PDF to the recipient list.')
        public Boolean sendEmail;

        @InvocableVariable(label='Email Recipients' description='Comma-separated list of email addresses to receive the PDF.')
        public String emailRecipients;

        @InvocableVariable(label='Email Subject' description='Subject line for the outbound email.')
        public String emailSubject;

        @InvocableVariable(label='Email Body' description='Plain-text body of the outbound email.')
        public String emailBody;
    }

    public class SavePdfOutput {
        @InvocableVariable(label='Content Version ID')
        public String contentVersionId;

        @InvocableVariable(label='Content Document ID')
        public String contentDocumentId;

        @InvocableVariable(label='Success')
        public Boolean success;

        @InvocableVariable(label='Error Message')
        public String errorMessage;
    }

    // ─────────────────────────────────────────────────────────────
    // Invocable method
    // ─────────────────────────────────────────────────────────────

    @InvocableMethod(
        label='Crafter PDF: Save & Deliver PDF'
        description='Saves a Base64-encoded PDF as a Salesforce File and optionally emails it to a recipient list.'
        category='Crafter PDF'
    )
    public static List<SavePdfOutput> savePdf(List<SavePdfInput> inputs) {
        List<SavePdfOutput> outputs = new List<SavePdfOutput>();

        for (SavePdfInput input : inputs) {
            SavePdfOutput output = new SavePdfOutput();
            try {
                // Persist to ContentVersion
                CrafterPdfService.SaveResult saved = CrafterPdfService.savePdf(
                    input.base64Pdf,
                    input.fileName,
                    input.linkedRecordId
                );

                output.success           = saved.success;
                output.contentVersionId  = saved.contentVersionId;
                output.contentDocumentId = saved.contentDocumentId;
                output.errorMessage      = saved.errorMessage;

                // Email delivery
                if (saved.success && input.sendEmail == true && String.isNotBlank(input.emailRecipients)) {
                    CrafterPdfEmailService.sendPdfEmail(
                        input.emailRecipients,
                        input.emailSubject,
                        input.emailBody,
                        saved.contentVersionId,
                        input.fileName
                    );
                }
            } catch (Exception e) {
                output.success      = false;
                output.errorMessage = e.getMessage();
            }
            outputs.add(output);
        }

        return outputs;
    }
}
