/**
 * TRAVEL APP CORE - WIKIPEDIA & MULTI-AI INTEGRATION
 */

const API_KEYS = {
    GOOGLE: 'YOUR_GEMINI_API_KEY',
    GROQ: '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'
};

let mapInstance = null;

document.getElementById('generate-btn').addEventListener('click', async () => {
    const destInput = document.getElementById('destination').value.trim();
    const days = document.getElementById('days').value.trim();
    const style = document.getElementById('style').value;

    if (!destInput || !days) return alert("Please enter both destination and days! 📍");

    // Standardize Capitalization for Wikipedia
    const destination = destInput.charAt(0).toUpperCase() + destInput.slice(1).toLowerCase();

    const btn = document.getElementById('generate-btn');
    const loading = document.getElementById('loading');
    const output = document.getElementById('output-container');
    const content = document.getElementById('itinerary-content');
    const visual = document.getElementById('visual-header');
    const loadingText = document.getElementById('loading-text');

    // UI Reset
    btn.disabled = true;
    output.classList.add('hidden');
    loading.classList.remove('hidden');
    visual.innerHTML = "";

    const prompt = `Act as an expert travel guide. Create a detailed ${days}-day itinerary for ${destination} (${style} trip). 
    STRUCTURE RULES:
    1. Each day must start with <h3>📍 Day X: [Title]</h3>.
    2. Every single activity must be wrapped in a <li> tag inside a <ul>.
    3. Every <li> tag MUST have the class "itinerary-step" to format as a card.
    4. Start every <li> with a unique travel emoji.
    5. Return ONLY RAW HTML. No markdown code blocks.`;

    try {
        let aiHTML = "";

        // 1. AI Failover Logic
        try {
            loadingText.innerText = `Consulting AI about ${destination}...`;
            aiHTML = await callAI(prompt, 'google');
        } catch (e) {
            loadingText.innerText = `Switching to Fallback AI...`;
            aiHTML = await callAI(prompt, 'groq');
        }

        // 2. Fetch Visuals (Wikipedia + Map Coords)
        loadingText.innerText = `Fetching Wikipedia images & Map data...`;
        const [wikiPhoto, coords] = await Promise.all([
            getWikiImage(destination),
            getCoords(destination)
        ]);

        // 3. Render Dashboard
        visual.innerHTML = `
            <img src="${wikiPhoto}" class="wiki-image" alt="${destination}">
            <h2 class="text-5xl font-black text-slate-900 tracking-tighter italic">Explore ${destination}</h2>
        `;

        loading.classList.add('hidden');
        output.classList.remove('hidden');

        // Render Map
        renderMap(coords, destination);

        // Inject Content (Remove AI markdown if any)
        content.innerHTML = aiHTML.replace(/```html/gi, '').replace(/```/g, '');

    } catch (err) {
        showError(err.message);
    } finally {
        btn.disabled = false;
        loadingText.innerText = "Connecting to Satellites...";
    }
});

/** * API FUNCTIONS 
 */

async function getWikiImage(city) {
    try {
        // origin=* is required to prevent CORS errors in browser-side JS
        const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${city}&prop=pageimages&format=json&pithumbsize=800&origin=*`;
        const res = await fetch(url);
        const data = await res.json();
        
        const pages = data.query.pages;
        const pageId = Object.keys(pages)[0]; // Extract the dynamic Page ID
        
        if (pageId !== "-1" && pages[pageId].thumbnail) {
            return pages[pageId].thumbnail.source;
        }
        // Fallback image if Wikipedia has no photo for that title
        return "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800";
    } catch (e) {
        return "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800";
    }
}

async function callAI(query, provider) {
    if (provider === 'google') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEYS.GOOGLE}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: query }] }] })
        });
        const d = await res.json();
        const text = d?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Google AI Offline");
        return text;
    } else {
        const res = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEYS.GROQ}` },
            body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: query }] })
        });
        const d = await res.json();
        const text = d?.choices?.[0]?.message?.content;
        if (!text) throw new Error("AI Offline");
        return text;
    }
}

async function getCoords(q) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}`);
        const data = await res.json();
        if (data && data.length > 0) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        return [0, 0];
    } catch (e) { return [0, 0]; }
}

function renderMap(coords, name) {
    if (mapInstance) mapInstance.remove();
    // Initialize map with scroll wheel disabled for better page scrolling experience
    mapInstance = L.map('map', { scrollWheelZoom: false }).setView(coords, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(mapInstance);
    L.marker(coords).addTo(mapInstance).bindPopup(`<b>${name}</b>`).openPopup();
}

function showError(msg) {
    const loading = document.getElementById('loading');
    const output = document.getElementById('output-container');
    const content = document.getElementById('itinerary-content');
    loading.classList.add('hidden');
    output.classList.remove('hidden');
    content.innerHTML = `
        <div class="bg-red-50 border-l-8 border-red-500 p-8 rounded-2xl animate__animated animate__shakeX">
            <h2 class="text-red-700 font-black text-xl mb-2">System Interruption 🚧</h2>
            <p class="text-red-600 font-medium">${msg}</p>
        </div>`;
}
