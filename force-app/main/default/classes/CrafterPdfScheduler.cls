/**
 * CrafterPdfScheduler
 *
 * Schedulable Apex class for automated recurring PDF delivery.
 *
 * Admins configure a CrafterPdfSchedule__mdt record (Wave 3b) to define:
 *  - Which report to run
 *  - Which template to use
 *  - Recipient list
 *  - Linked record for file attachment
 *
 * Until CrafterPdfSchedule__mdt ships, the constructor accepts explicit
 * parameters so admins can schedule via Developer Console or a Setup flow:
 *
 *   System.schedule(
 *     'Weekly Pipeline PDF',
 *     '0 0 7 ? * MON',
 *     new CrafterPdfScheduler('00O000000000001', 'Default', 'jane@example.com, joe@example.com',
 *                              'Weekly Pipeline Report', 'Please find this week\'s pipeline attached.', null)
 *   );
 *
 * @namespace fcrft
 */
public with sharing class CrafterPdfScheduler implements Schedulable {

    private final String reportId;
    private final String templateDeveloperName;
    private final String recipientsCsv;
    private final String emailSubject;
    private final String emailBody;
    private final String linkedRecordId;

    public CrafterPdfScheduler(
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

    /**
     * Called by the Salesforce scheduler. Enqueues a queueable so the Reports API
     * and email callout have their own async context and don't hit sync limits.
     */
    public void execute(SchedulableContext ctx) {
        System.enqueueJob(new CrafterPdfDeliveryJob(
            reportId,
            templateDeveloperName,
            recipientsCsv,
            emailSubject,
            emailBody,
            linkedRecordId
        ));
    }
}
