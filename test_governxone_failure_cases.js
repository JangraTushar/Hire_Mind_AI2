const { GovernXOneClient } = require('@governxone/ai-monitor');

async function runFailureCaseTests() {
    console.log('=== GovernXOne SDK Failure & Security Mode Tests ===\n');

    const BASE_ENDPOINT = 'https://test.governxone.com';
    const PROJECT_ID = '9b67af5e';

    // Helper to send HTTP batch directly to capture exact backend status
    async function postBatch(apiKey, projId, endpoint, batch = []) {
        const url = `${endpoint.replace(/\/$/, '')}/api/v1/sdk/monitoring`;
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({ projectId: projId, payloads: batch }),
            });
            const text = await res.text();
            return { status: res.status, statusText: res.statusText, body: text };
        } catch (err) {
            return { error: err.message };
        }
    }

    // Case 1: Missing API Key initialization in SDK
    console.log('[Case 1] SDK Init with Missing API Key:');
    try {
        new GovernXOneClient({ apiKey: '', projectId: PROJECT_ID, baseUrl: BASE_ENDPOINT });
        console.log(' - RESULT: Allowed empty key (or unexpected success)');
    } catch (err) {
        console.log(` - RESULT: Expected Error Thrown -> "${err.message}"`);
    }

    // Case 2: Missing Project ID initialization in SDK
    console.log('\n[Case 2] SDK Init with Missing Project ID:');
    try {
        new GovernXOneClient({ apiKey: 'gx_valid_key', projectId: '', baseUrl: BASE_ENDPOINT });
        console.log(' - RESULT: Allowed empty project ID');
    } catch (err) {
        console.log(` - RESULT: Expected Error Thrown -> "${err.message}"`);
    }

    // Case 3: Invalid GovernXOne API Key sent to backend
    console.log('\n[Case 3] Telemetry Transmission with Invalid API Key:');
    const resInvalidKey = await postBatch('invalid_api_key_12345', PROJECT_ID, BASE_ENDPOINT, [{ id: 'test-1' }]);
    console.log(` - HTTP Status: ${resInvalidKey.status || 'N/A'} ${resInvalidKey.statusText || ''}`);
    console.log(` - Response Body: ${resInvalidKey.body || resInvalidKey.error}`);

    // Case 4: Invalid Project ID sent to backend
    console.log('\n[Case 4] Telemetry Transmission with Invalid Project ID:');
    const resInvalidProj = await postBatch('gx_test_key_9b67af5e', 'invalid_proj_99999999', BASE_ENDPOINT, [{ id: 'test-2' }]);
    console.log(` - HTTP Status: ${resInvalidProj.status || 'N/A'} ${resInvalidProj.statusText || ''}`);
    console.log(` - Response Body: ${resInvalidProj.body || resInvalidProj.error}`);

    // Case 5: Backend Endpoint Unreachable / Invalid Domain
    console.log('\n[Case 5] Telemetry Transmission to Unreachable Domain:');
    const resUnreachable = await postBatch('gx_test_key_9b67af5e', PROJECT_ID, 'https://unreachable-domain-governxone-test.invalid', [{ id: 'test-3' }]);
    console.log(` - Result: ${resUnreachable.error ? ('Network Error: ' + resUnreachable.error) : ('HTTP Status: ' + resUnreachable.status)}`);

    // Case 6: Calling flush() when queue is empty
    console.log('\n[Case 6] Calling flush() on an empty queue:');
    const emptyClient = new GovernXOneClient({ apiKey: 'gx_key', projectId: PROJECT_ID, baseUrl: BASE_ENDPOINT });
    try {
        await emptyClient.flush();
        console.log(' - RESULT: flush() completed cleanly on empty queue without throwing errors.');
    } catch (err) {
        console.log(` - RESULT: flush() threw error -> "${err.message}"`);
    }

    // Case 7: Sending Empty Payload Batch
    console.log('\n[Case 7] Telemetry Transmission with Empty Payloads Array:');
    const resEmptyBatch = await postBatch('gx_test_key_9b67af5e', PROJECT_ID, BASE_ENDPOINT, []);
    console.log(` - HTTP Status: ${resEmptyBatch.status || 'N/A'} ${resEmptyBatch.statusText || ''}`);
    console.log(` - Response Body: ${resEmptyBatch.body || resEmptyBatch.error}`);

    console.log('\n=== Failure & Security Mode Tests Completed ===');
}

runFailureCaseTests().catch(console.error);
