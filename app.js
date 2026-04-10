const KEYS = {
    GOOGLE: 'YOUR_GEMINI_API_KEY',
    GROQ: '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',
    UNSPLASH: 'YOUR_UNSPLASH_ACCESS_KEY'
};

let mapInstance = null;

document.getElementById('generate-btn').addEventListener('click', async () => {
    const destination = document.getElementById('destination').value.trim();
    const days = document.getElementById('days').value.trim();
    const style = document.getElementById('style').value;

    if (!destination || !days) return alert("Please fill in destination and days! ✈️");

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

    const prompt = `Act as an expert travel guide. Create a detailed ${days}-day itinerary for ${destination} (${style} style). 
    FORMATTING RULES:
    1. For each day, use <h3>📍 Day X: [Name]</h3>.
    2. Wrap every activity in a <li> tag inside a <ul>.
    3. Every <li> must start with a high-quality emoji.
    4. Important: Every <li> must have the CSS class "itinerary-step" applied to it.
    5. Return ONLY RAW HTML. No markdown blocks.`;

    try {
        let aiHTML = "";

        // Try Google Primary
        try {
            loadingText.innerText = "Consulting Google AI...";
            aiHTML = await callAI(prompt, 'google');
        } catch (e) {
            loadingText.innerText = "Google Busy. Switching to Fallback...";
            aiHTML = await callAI(prompt, 'groq');
        }

        // Fetch Graphical Assets
        const [photo, coords] = await Promise.all([
            getPhoto(destination),
            getCoords(destination)
        ]);

        // Render Hero Image
        visual.innerHTML = `
            <img src="${photo}" class="w-full h-80 object-cover rounded-[24px] shadow-lg mb-4" alt="travel">
            <h2 class="text-4xl font-black text-slate-800">Your ${destination} Trip</h2>
        `;

        // Show Container and Render Map
        loading.classList.add('hidden');
        output.classList.remove('hidden');
        renderMap(coords, destination);

        // Inject content and clean markdown
        content.innerHTML = aiHTML.replace(/```html/gi, '').replace(/```/g, '');

    } catch (err) {
        alert("Error: " + err.message);
        loading.classList.add('hidden');
    } finally {
        btn.disabled = false;
    }
});

/** 🛠️ HELPER FUNCTIONS 🛠️ **/

async function callAI(query, provider) {
    if (provider === 'google') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${KEYS.GOOGLE}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: query }] }] })
        });
        const d = await res.json();
        return d?.candidates?.[0]?.content?.parts?.[0]?.text || throwError();
    } else {
        const res = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEYS.GROQ}` },
            body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: query }] })
        });
        const d = await res.json();
        return d?.choices?.[0]?.message?.content || throwError();
    }
}

async function getPhoto(q) {
    try {
        const res = await fetch(`https://api.unsplash.com/search/photos?query=${q}&client_id=${KEYS.UNSPLASH}&per_page=1&orientation=landscape`);
        const d = await res.json();
        return d?.results?.[0]?.urls?.regular || 'https://images.unsplash.com/photo-1503220317375-aaad61436b1b';
    } catch(e) { return 'https://images.unsplash.com/photo-1503220317375-aaad61436b1b'; }
}

async function getCoords(q) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}`);
        const d = await res.json();
        return d.length > 0 ? [parseFloat(d[0].lat), parseFloat(d[0].lon)] : [0,0];
    } catch(e) { return [0,0]; }
}

function renderMap(coords, name) {
    if (mapInstance) mapInstance.remove();
    mapInstance = L.map('map', { scrollWheelZoom: false }).setView(coords, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance);
    L.marker(coords).addTo(mapInstance).bindPopup(name).openPopup();
}

function throwError() { throw new Error("API Limit Reached"); }
