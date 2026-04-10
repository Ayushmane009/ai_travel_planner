// 1. SET YOUR API KEYS
const GOOGLE_API_KEY = 'AIzaSyDFKdDZ25opfrTOTgIR7pBIRPGuSYfb5hs';
const GROQ_API_KEY = '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';

document.getElementById('generate-btn').addEventListener('click', async () => {
    const destination = document.getElementById('destination').value.trim();
    const days = document.getElementById('days').value.trim();
    const style = document.getElementById('style').value;

    if (!destination || !days) {
        alert("Please enter both a destination and days.");
        return;
    }

    const generateBtn = document.getElementById('generate-btn');
    const loadingDiv = document.getElementById('loading');
    const outputContainer = document.getElementById('output-container');
    const itineraryContent = document.getElementById('itinerary-content');
    const loadingText = document.getElementById('loading-text') || document.querySelector('#loading p');

    // UI Reset
    generateBtn.disabled = true;
    generateBtn.innerText = "Generating...";
    outputContainer.classList.add('hidden');
    loadingDiv.classList.remove('hidden');
    itineraryContent.innerHTML = "";

    const prompt = `Act as an expert travel planner. Create a highly detailed ${days}-day travel itinerary for ${destination}. Style: ${style}. Format the output cleanly using HTML tags (<h3> for days, <ul>, <li>). Do not use markdown like \`\`\`html.`;

    try {
        // --- STEP 1: TRY GOOGLE GEMINI FIRST ---
        loadingText.innerText = "Connecting to Google AI...";
        try {
            const result = await callGoogle(prompt);
            displayResult(result);
        } catch (googleError) {
            console.warn("Google AI failed or busy, switching to Groq...", googleError);
            
            // --- STEP 2: FALLBACK TO GROQ ---
            loadingText.innerText = "Google busy. Switching to Groq AI...";
            const result = await callGroq(prompt);
            displayResult(result);
        }

    } catch (finalError) {
        console.error("Both AI services failed:", finalError);
        itineraryContent.innerHTML = `
            <div class="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">
                <h3 class="font-bold text-lg mb-2">Service Temporarily Unavailable</h3>
                <p class="text-sm">${finalError.message}</p>
            </div>`;
        outputContainer.classList.remove('hidden');
    } finally {
        loadingDiv.classList.add('hidden');
        generateBtn.disabled = false;
        generateBtn.innerText = "Generate Itinerary";
    }

    // --- HELPER FUNCTIONS ---

    async function callGoogle(query) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: query }] }] })
        });

        if (!response.ok) throw new Error(`Google Error ${response.status}`);
        
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }

    async function callGroq(query) {
        const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}` 
            },
            body: JSON.stringify({ 
                model: "llama-3.3-70b-versatile", 
                messages: [{ role: "user", content: query }]
            })
        });

        if (!response.ok) throw new Error(`Groq Error ${response.status}`);
        
        const data = await response.json();
        return data.choices[0].message.content;
    }

    function displayResult(text) {
        const cleanText = text.replace(/```html/gi, '').replace(/```/g, '');
        itineraryContent.innerHTML = cleanText;
        outputContainer.classList.remove('hidden');
    }
});