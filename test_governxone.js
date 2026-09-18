require('dotenv').config();
const { GovernXOne, loadProvider } = require('@governxone/ai-monitor');

async function runIntegrationTest() {
    console.log('=== GovernXOne SDK Integration Test ===\n');

    // 1. Inspect Environment & Configuration
    const apiKey = process.env.GOVERNXONE_API_KEY;
    const projectId = process.env.GOVERNXONE_PROJECT_ID;
    const endpoint = process.env.GOVERNXONE_ENDPOINT;
    const environment = process.env.GOVERNXONE_ENVIRONMENT;
    const openAiApiKey = process.env.OPENAI_API_KEY;

    console.log('[Step 1] Configuration loaded from .env:');
    console.log(` - GOVERNXONE_API_KEY: ${apiKey ? (apiKey.slice(0, 10) + '...') : 'MISSING'}`);
    console.log(` - GOVERNXONE_PROJECT_ID: ${projectId || 'MISSING'}`);
    console.log(` - GOVERNXONE_ENDPOINT: ${endpoint || 'MISSING'}`);
    console.log(` - GOVERNXONE_ENVIRONMENT: ${environment || 'MISSING'}`);
    console.log(` - OPENAI_API_KEY: ${openAiApiKey ? 'AVAILABLE' : 'NOT AVAILABLE'}\n`);

    // 2. Initialize SDK
    console.log('[Step 2] Initializing GovernXOne SDK...');
    const client = GovernXOne.init({
        debug: true,
        autoInstrument: true,
    });
    console.log(' - Client initialized successfully.');
    console.log(` - Effective sampling rate: ${client.getSampleRate()}%`);
    console.log(` - Base URL resolved: ${client.getConfig().baseUrl}\n`);

    // 3. Load AI Provider via loadProvider()
    console.log('[Step 3] Loading OpenAI provider via loadProvider("openai")...');
    const { OpenAI } = loadProvider('openai');
    console.log(' - OpenAI module loaded and auto-instrumented.\n');

    // 4. Create OpenAI Client & Execute Invocations
    console.log('[Step 4] Instantiating OpenAI client and executing request...');
    const openai = new OpenAI({
        apiKey: openAiApiKey || 'sk-dummy-key-for-sdk-interception-testing',
    });

    let invocationResult = null;
    let invocationError = null;

    try {
        invocationResult = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: 'GovernXOne integration test request.' }],
        });
        console.log(' - OpenAI request completed successfully!');
        console.log(` - Response content snippet: "${invocationResult.choices?.[0]?.message?.content?.slice(0, 50)}"`);
    } catch (err) {
        invocationError = err;
        console.log(` - OpenAI request threw error (Expected if key is dummy/invalid): ${err.message}`);
    }

    // 5. Inspect Telemetry Queue
    console.log('\n[Step 5] Checking SDK Telemetry Queue...');
    const queueLength = client.queue ? client.queue.length : 0;
    console.log(` - Queued telemetry items: ${queueLength}`);
    if (queueLength > 0) {
        console.log(' - Sample queued telemetry item payload:');
        console.log(JSON.stringify(client.queue[0], null, 2));
    }

    // 6. Flush Telemetry Queue to Backend
    console.log('\n[Step 6] Flushing Telemetry to GovernXOne Backend...');
    let flushError = null;
    try {
        await GovernXOne.flush();
        console.log(' - GovernXOne.flush() completed.');
    } catch (err) {
        flushError = err;
        console.log(` - GovernXOne.flush() threw error: ${err.message}`);
    }

    // 7. Directly verify HTTP Endpoint response from backend (https://test.governxone.com/api/v1/sdk/monitoring)
    console.log('\n[Step 7] Testing Direct HTTP POST to https://test.governxone.com/api/v1/sdk/monitoring...');
    const targetUrl = `${(endpoint || 'https://test.governxone.com').replace(/\/$/, '')}/api/v1/sdk/monitoring`;
    
    const samplePayload = {
        projectId: projectId || '9b67af5e',
        payloads: [
            {
                id: 'test-telemetry-id-' + Date.now(),
                timestamp: Date.now(),
                provider: 'openai',
                model: 'gpt-3.5-turbo',
                prompt: 'GovernXOne direct verification test prompt',
                response: 'GovernXOne direct verification test response',
                inputTokens: 10,
                outputTokens: 15,
                latencyMs: 120,
                environment: environment || 'production',
            }
        ]
    };

    try {
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'User-Agent': 'governxone-test-agent/1.0.4',
            },
            body: JSON.stringify(samplePayload),
        });

        const status = response.status;
        const statusText = response.statusText;
        const textBody = await response.text();

        console.log(` - HTTP Response Status: ${status} ${statusText}`);
        console.log(` - Response Body: ${textBody || '(empty body)'}`);
    } catch (netErr) {
        console.log(` - Direct Network Request Error: ${netErr.message}`);
    }

    console.log('\n=== Integration Test Run Completed ===');
}

runIntegrationTest().catch(console.error);
