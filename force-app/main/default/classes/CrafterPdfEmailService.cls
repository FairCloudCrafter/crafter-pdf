/**
 * CrafterPdfEmailService
 *
 * Handles email delivery of generated PDFs as attachments.
 * Called by CrafterPdfInvocable and CrafterPdfScheduler.
 *
 * Uses SingleEmailMessage with a ContentVersion blob as the attachment
 * so admins never need to write Apex to send reports.
 *
 * @namespace fcrft
 */
public with sharing class CrafterPdfEmailService {

    /**
     * Sends an email with the ContentVersion file as an attachment.
     *
     * @param recipientsCsv   Comma-separated email addresses.
     * @param subject         Email subject line.
     * @param body            Plain-text email body.
     * @param contentVersionId  ContentVersion Id of the PDF.
     * @param fileName        File name used for the attachment (without .pdf).
     */
    public static void sendPdfEmail(
        String recipientsCsv,
        String subject,
        String body,
        String contentVersionId,
        String fileName
    ) {
        if (String.isBlank(recipientsCsv) || String.isBlank(contentVersionId)) return;

        // Fetch the blob
        ContentVersion cv = [
            SELECT VersionData, Title
            FROM   ContentVersion
            WHERE  Id = :contentVersionId
            LIMIT  1
        ];

        // Build attachment
        Messaging.EmailFileAttachment attachment = new Messaging.EmailFileAttachment();
        attachment.setFileName((String.isNotBlank(fileName) ? fileName : cv.Title) + '.pdf');
        attachment.setBody(cv.VersionData);
        attachment.setContentType('application/pdf');

        // Build email(s)
        List<Messaging.SingleEmailMessage> emails = new List<Messaging.SingleEmailMessage>();
        for (String addr : recipientsCsv.split(',')) {
            String trimmed = addr.trim();
            if (String.isBlank(trimmed)) continue;

            Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
            email.setToAddresses(new List<String>{ trimmed });
            email.setSubject(String.isNotBlank(subject) ? subject : 'Your Crafter PDF Report');
            email.setPlainTextBody(String.isNotBlank(body) ? body : 'Please find your report attached.');
            email.setFileAttachments(new List<Messaging.EmailFileAttachment>{ attachment });
            email.setSaveAsActivity(false);
            emails.add(email);
        }

        if (!emails.isEmpty()) {
            Messaging.sendEmail(emails, false);
        }
    }
}
