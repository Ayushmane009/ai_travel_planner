const API_KEYS = {
    GOOGLE: 'YOUR_GEMINI_KEY',
    GROQ: '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'
};

let mapInstance = null;

document.getElementById('generate-btn').addEventListener('click', async () => {
    const destInput = document.getElementById('destination').value.trim();
    const days = document.getElementById('days').value.trim();
    const style = document.getElementById('style').value;

    if (!destInput || !days) return alert("Details please! ✈️");

    const destination = destInput.charAt(0).toUpperCase() + destInput.slice(1).toLowerCase();
    const btn = document.getElementById('generate-btn');
    const loading = document.getElementById('loading');
    const output = document.getElementById('output-container');
    const content = document.getElementById('itinerary-content');
    const visual = document.getElementById('visual-header');
    const loadingText = document.getElementById('loading-text');

    btn.disabled = true;
    output.classList.add('hidden');
    loading.classList.remove('hidden');

    const prompt = `Act as an expert travel guide. Create a detailed ${days}-day itinerary for ${destination} (${style} trip). 
    STRUCTURE:
    1. Days start with <h3>📍 Day X: [Title]</h3>.
    2. Activities in <li class="itinerary-step" data-location="[Landmark Name]"> with emojis.
    3. Return ONLY RAW HTML. No markdown code blocks.`;

    try {
        let aiHTML = "";
        let errorLog = [];

        // --- PHASE 1: TRY GOOGLE ---
        try {
            loadingText.innerText = "Attempting Google Gemini... 🤖";
            aiHTML = await callAI(prompt, 'google');
        } catch (e) {
            errorLog.push(`Gemini Error: ${e.message}`);
            
            // --- PHASE 2: FALLBACK TO GROQ ---
            try {
                loadingText.innerText = "Gemini failed. Waking up Groq AI... 🌪️";
                aiHTML = await callAI(prompt, 'groq');
            } catch (e2) {
                errorLog.push(`Groq Error: ${e2.message}`);
                throw new Error(errorLog.join(" | "));
            }
        }

        // --- FINAL CONTENT VALIDATION ---
        if (!aiHTML || aiHTML.length < 50) {
            throw new Error("AI returned a response that was too short or empty. This usually happens due to safety filters.");
        }

        const cleanHTML = aiHTML.replace(/```html/gi, '').replace(/```/g, '').trim();
        content.innerHTML = cleanHTML;

        // Fetch Graphics
        loadingText.innerText = "Capturing the Vibe... 📸";
        const wikiPhoto = await getWikiImage(destination);
        visual.innerHTML = `
            <img src="${wikiPhoto}" class="wiki-image" alt="dest">
            <h2 class="text-5xl font-black text-slate-900 italic tracking-tighter">Explore ${destination}</h2>
        `;

        loading.classList.add('hidden');
        output.classList.remove('hidden');

        // Multi-Pin Map Rendering
        await renderMultiMap(destination);

    } catch (err) {
        showError(err.message);
    } finally {
        btn.disabled = false;
    }
});

/** 📍 MULTI-PIN & MAP LOGIC **/
async function renderMultiMap(city) {
    const cityCoords = await getCoords(city);
    if (mapInstance) mapInstance.remove();
    mapInstance = L.map('map', { scrollWheelZoom: false }).setView(cityCoords, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance);
    
    const steps = document.querySelectorAll('.itinerary-step');
    const bounds = L.latLngBounds();
    bounds.extend(cityCoords);

    for (const step of steps) {
        const locName = step.getAttribute('data-location');
        if (locName) {
            const coords = await getCoords(`${locName}, ${city}`);
            if (coords[0] !== 0) {
                L.marker(coords).addTo(mapInstance).bindPopup(`<b>${locName}</b>`);
                bounds.extend(coords);
            }
        }
    }
    mapInstance.fitBounds(bounds, { padding: [50, 50] });
}

/** 🛠️ DETAILED AI API HANDLER **/
async function callAI(query, provider) {
    const isGoogle = provider === 'google';
    const url = isGoogle 
        ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEYS.GOOGLE}`
        : `https://api.groq.com/openai/v1/chat/completions`;

    const body = isGoogle 
        ? { contents: [{ parts: [{ text: query }] }] }
        : { model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: query }] };

    const headers = { 'Content-Type': 'application/json' };
    if (!isGoogle) headers['Authorization'] = `Bearer ${API_KEYS.GROQ}`;

    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    
    if (!res.ok) {
        const errData = await res.json();
        throw new Error(`${provider.toUpperCase()} API Status ${res.status}: ${errData?.error?.message || 'Unknown'}`);
    }

    const data = await res.json();

    // Specific structure checking for each provider
    let result = "";
    if (isGoogle) {
        if (!data.candidates || data.candidates.length === 0) throw new Error("Google Safety Filter blocked this response.");
        result = data.candidates[0]?.content?.parts?.[0]?.text;
    } else {
        if (!data.choices || data.choices.length === 0) throw new Error("Groq returned no message choices.");
        result = data.choices[0]?.message?.content;
    }

    if (!result) throw new Error(`${provider} returned empty text.`);
    return result;
}

/** 🌍 GEOGRAPHICAL & IMAGE HELPERS **/
async function getWikiImage(city) {
    try {
        const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${city}&prop=pageimages&format=json&pithumbsize=800&origin=*`);
        const data = await res.json();
        const pages = data.query.pages;
        const pageId = Object.keys(pages)[0];
        return pages[pageId]?.thumbnail?.source || "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800";
    } catch (e) { return "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800"; }
}

async function getCoords(q) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);
        const d = await res.json();
        return d.length > 0 ? [parseFloat(d[0].lat), parseFloat(d[0].lon)] : [0,0];
    } catch (e) { return [0,0]; }
}

function showError(msg) {
    const loading = document.getElementById('loading');
    const output = document.getElementById('output-container');
    const content = document.getElementById('itinerary-content');
    loading.classList.add('hidden');
    output.classList.remove('hidden');
    content.innerHTML = `
        <div class="bg-red-50 border-l-8 border-red-500 p-8 rounded-2xl animate__animated animate__shakeX">
            <h2 class="text-red-700 font-black text-xl mb-2">Technical Block 🚧</h2>
            <p class="text-red-600 font-medium">${msg}</p>
            <p class="text-red-400 text-xs mt-4">Try checking your API keys or using a different destination.</p>
        </div>`;
}
