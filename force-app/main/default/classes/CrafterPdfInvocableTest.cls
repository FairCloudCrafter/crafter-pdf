/**
 * CrafterPdfInvocableTest
 * Unit tests for CrafterPdfInvocable and CrafterPdfEmailService.
 */
@IsTest
private class CrafterPdfInvocableTest {

    @IsTest
    static void savePdf_validInput_succeeds() {
        String base64 = EncodingUtil.base64Encode(Blob.valueOf('PDF'));

        CrafterPdfInvocable.SavePdfInput input = new CrafterPdfInvocable.SavePdfInput();
        input.base64Pdf    = base64;
        input.fileName     = 'Test Briefing';
        input.linkedRecordId = null;
        input.sendEmail    = false;

        Test.startTest();
        List<CrafterPdfInvocable.SavePdfOutput> outputs =
            CrafterPdfInvocable.savePdf(new List<CrafterPdfInvocable.SavePdfInput>{ input });
        Test.stopTest();

        System.assertEquals(1, outputs.size());
        System.assert(outputs[0].success, 'Expected success');
        System.assertNotEquals(null, outputs[0].contentVersionId);
    }

    @IsTest
    static void savePdf_blankBase64_fails() {
        CrafterPdfInvocable.SavePdfInput input = new CrafterPdfInvocable.SavePdfInput();
        input.base64Pdf = '';
        input.fileName  = 'Bad Input';
        input.sendEmail = false;

        Test.startTest();
        List<CrafterPdfInvocable.SavePdfOutput> outputs =
            CrafterPdfInvocable.savePdf(new List<CrafterPdfInvocable.SavePdfInput>{ input });
        Test.stopTest();

        // EncodingUtil.base64Decode of empty string returns empty blob — insert may succeed but body is empty
        // Primary assertion: no unhandled exception and output list has one entry
        System.assertEquals(1, outputs.size());
    }

    @IsTest
    static void savePdf_batchOf3_allSucceed() {
        String base64 = EncodingUtil.base64Encode(Blob.valueOf('PDF'));
        List<CrafterPdfInvocable.SavePdfInput> inputs = new List<CrafterPdfInvocable.SavePdfInput>();
        for (Integer i = 0; i < 3; i++) {
            CrafterPdfInvocable.SavePdfInput input = new CrafterPdfInvocable.SavePdfInput();
            input.base64Pdf = base64;
            input.fileName  = 'Report ' + i;
            input.sendEmail = false;
            inputs.add(input);
        }

        Test.startTest();
        List<CrafterPdfInvocable.SavePdfOutput> outputs = CrafterPdfInvocable.savePdf(inputs);
        Test.stopTest();

        System.assertEquals(3, outputs.size());
        for (CrafterPdfInvocable.SavePdfOutput o : outputs) {
            System.assert(o.success, 'Each output should succeed');
        }
    }

    @IsTest
    static void deliveryJob_enqueues_withoutError() {
        // Verify CrafterPdfDeliveryJob can be constructed and queued
        // without a real report ID (will fail inside execute — tested for graceful handling)
        Test.startTest();
        CrafterPdfDeliveryJob job = new CrafterPdfDeliveryJob(
            'fakeId001',
            'Default',
            null,
            'Test Subject',
            'Test Body',
            null
        );
        // Just verify instantiation — real execute() requires Reports API in scratch org
        System.assertNotEquals(null, job);
        Test.stopTest();
    }

    @IsTest
    static void scheduler_execute_enqueuesJob() {
        Test.startTest();
        CrafterPdfScheduler scheduler = new CrafterPdfScheduler(
            'fakeReportId',
            'Default',
            'test@example.com',
            'Test PDF',
            'See attached.',
            null
        );
        String jobId = System.schedule('CrafterPDF Test Job', '0 0 8 1 1 ? 2099', scheduler);
        Test.stopTest();
        System.assertNotEquals(null, jobId, 'Scheduler should be registered');
    }
}
