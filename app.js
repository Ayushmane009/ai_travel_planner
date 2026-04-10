/**
 * MASTER TRAVEL APP - 2026 EDITION
 * Logic: Google Gemini (Primary) -> Groq Llama (Fallback)
 */

const API_KEYS = {
    GOOGLE: 'YOUR_GEMINI_API_KEY',
    GROQ: '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',
    UNSPLASH: 'YOUR_UNSPLASH_ACCESS_KEY'
};

let mapInstance = null;

document.getElementById('generate-btn').addEventListener('click', async () => {
    const destination = document.getElementById('destination').value.trim();
    const days = document.getElementById('days').value.trim();
    const style = document.getElementById('style').value;

    if (!destination || !days) return alert("Please enter a destination and duration! 🌍");

    // UI Elements
    const btn = document.getElementById('generate-btn');
    const loading = document.getElementById('loading');
    const output = document.getElementById('output-container');
    const loadingText = document.getElementById('loading-text');
    const content = document.getElementById('itinerary-content');
    const visual = document.getElementById('visual-header');

    // UI Reset State
    btn.disabled = true;
    output.classList.add('hidden');
    loading.classList.remove('hidden');
    visual.innerHTML = "";

    const prompt = `Act as an expert travel guide. Create a detailed ${days}-day itinerary for ${destination} (${style} style). 
    REQUIREMENTS:
    1. For each day, use <h3>📍 Day X: [Name]</h3>.
    2. For activities, use a <ul> with <li> tags.
    3. Each activity must start with a relevant emoji.
    4. Keep the style pictorial, concise, and step-by-step.
    5. Return RAW HTML ONLY. No markdown backticks.`;

    try {
        let finalHTML = "";

        // 🛡️ STEP 1: Attempt Google (Primary)
        try {
            loadingText.innerText = "Consulting Google Gemini... 💎";
            finalHTML = await retryWrapper(() => callGoogle(prompt));
        } catch (error) {
            console.error("Google failed:", error);
            // 🛡️ STEP 2: Fallback to Groq
            loadingText.innerText = "Gemini Busy. Awakening Groq... 🌪️";
            finalHTML = await retryWrapper(() => callGroq(prompt));
        }

        // 🛡️ STEP 3: Parallel Assets (Map + Photo)
        loadingText.innerText = "Finalizing Visuals... 📸";
        const [photo, coords] = await Promise.all([
            getPhoto(destination),
            getCoords(destination)
        ]);

        // 🛡️ STEP 4: Render All
        visual.innerHTML = `<img src="${photo}" class="hero-img" alt="destination">`;
        renderMap(coords, destination);
        
        // Clean any residual markdown tags the AI might have added
        content.innerHTML = finalHTML.replace(/```html/gi, '').replace(/```/g, '');

        loading.classList.add('hidden');
        output.classList.remove('hidden');

    } catch (criticalError) {
        showErrorUI(criticalError.message);
    } finally {
        btn.disabled = false;
        loadingText.innerText = "Summoning the AI...";
    }
});

/** 🧱 API IMPLEMENTATION WITH DEFENSIVE CHECKS **/

async function callGoogle(query) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEYS.GOOGLE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: query }] }] })
    });
    
    const data = await res.json();
    
    // SAFE ACCESS: Optional Chaining ?. prevents "reading undefined" crashes
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Google response malformed");
    return text;
}

async function callGroq(query) {
    const res = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEYS.GROQ}`
        },
        body: JSON.stringify({ 
            model: "llama-3.3-70b-versatile", 
            messages: [{ role: "user", content: query }] 
        })
    });
    
    const data = await res.json();
    
    // SAFE ACCESS
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error("Groq response malformed");
    return text;
}

async function getPhoto(city) {
    try {
        const res = await fetch(`https://api.unsplash.com/search/photos?query=${city}&client_id=${API_KEYS.UNSPLASH}&per_page=1&orientation=landscape`);
        const data = await res.json();
        return data?.results?.[0]?.urls?.regular || 'https://images.unsplash.com/photo-1503220317375-aaad61436b1b';
    } catch (e) { return 'https://images.unsplash.com/photo-1503220317375-aaad61436b1b'; }
}

async function getCoords(city) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${city}`);
        const data = await res.json();
        // SAFE ACCESS: Check array length
        if (data && data.length > 0) {
            return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        }
        return [0, 0];
    } catch (e) { return [0, 0]; }
}

function renderMap(coords, cityName) {
    if (mapInstance) mapInstance.remove();
    mapInstance = L.map('map').setView(coords, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance);
    L.marker(coords).addTo(mapInstance).bindPopup(`<b>${cityName}</b>`).openPopup();
}

/** 🛡️ SYSTEM ERROR RECOVERY **/

async function retryWrapper(fn) {
    let delay = 1000;
    for (let i = 0; i < 3; i++) {
        try { return await fn(); }
        catch (e) {
            console.warn(`Retry attempt ${i + 1}...`);
            await new Promise(r => setTimeout(r, delay));
            delay *= 2;
        }
    }
    throw new Error("AI services currently unavailable. Try again in 60s.");
}

function showErrorUI(msg) {
    const content = document.getElementById('itinerary-content');
    const loading = document.getElementById('loading');
    const output = document.getElementById('output-container');
    loading.classList.add('hidden');
    output.classList.remove('hidden');
    content.innerHTML = `
        <div class="bg-red-50 border-l-8 border-red-500 p-8 rounded-2xl animate__animated animate__shakeX">
            <h2 class="text-red-700 font-black text-2xl mb-2">Technical Block 🚧</h2>
            <p class="text-red-600 font-medium">${msg}</p>
        </div>`;
}
