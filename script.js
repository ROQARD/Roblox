const RECENT_KEY = "rostats_history";

document.addEventListener("DOMContentLoaded", () => {
    renderRecents();
    document.getElementById('scanBtn').addEventListener('click', fetchStats);
});

function formatNum(n) {
    if (!n || isNaN(n)) return "0";
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return n.toLocaleString();
}

async function fetchStats() {
    const input = document.getElementById('placeId').value.trim();
    const id = input.match(/\d+/)?.[0];
    const status = document.getElementById('status');
    const results = document.getElementById('results');

    if (!id) {
        status.innerText = "Error: Invalid ID format";
        status.style.color = "var(--error)";
        return;
    }

    status.innerText = "Synchronizing data...";
    status.style.color = "var(--text-dim)";
    results.style.display = 'none';

    try {
        // Using a more reliable bridge to the official Roblox API
        const bridge = "https://corsproxy.io/?";
        
        // Step 1: Get Universe ID
        const uniRes = await fetch(`${bridge}${encodeURIComponent(`https://apis.roblox.com/universes/v1/places/${id}/universe`)}`);
        const uniData = await uniRes.json();
        const uId = uniData.universeId;

        // Step 2: Get Game Data
        const gameRes = await fetch(`${bridge}${encodeURIComponent(`https://games.roblox.com/v1/games?universeIds=${uId}`)}`);
        const gameData = await gameRes.json();
        
        // Step 3: Get Icon
        const iconRes = await fetch(`${bridge}${encodeURIComponent(`https://thumbnails.roblox.com/v1/universes/icons?universeIds=${uId}&size=150x150&format=Png&isCircular=false`)}`);
        const iconData = await iconRes.json();

        const d = gameData.data[0];
        const iconUrl = iconData.data?.[0]?.imageUrl || "";

        // UI Mapping
        document.getElementById('gName').innerText = d.name;
        document.getElementById('gCreator').innerText = "By " + d.creator.name;
        document.getElementById('gPlaying').innerText = formatNum(d.playing);
        document.getElementById('gVisits').innerText = formatNum(d.visits);
        document.getElementById('gUpdated').innerText = new Date(d.updated).toLocaleDateString();
        document.getElementById('gIcon').src = iconUrl;

        saveRecent(id, d.name, iconUrl);
        
        status.innerText = "Data Secure.";
        status.style.color = "var(--accent)";
        results.style.display = 'flex';

    } catch (err) {
        status.innerText = "Error: Network synchronization failed.";
        status.style.color = "var(--error)";
    }
}

function saveRecent(id, name, icon) {
    let recents = JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
    recents = recents.filter(item => item.id !== id);
    recents.unshift({ id, name, icon });
    if (recents.length > 5) recents.pop();
    localStorage.setItem(RECENT_KEY, JSON.stringify(recents));
    renderRecents();
}

function renderRecents() {
    const recents = JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
    const list = document.getElementById('recentList');
    const container = document.getElementById('recentContainer');
    
    if (recents.length === 0) return;
    container.style.display = 'block';
    list.innerHTML = '';

    recents.forEach(game => {
        const el = document.createElement('div');
        el.className = 'recent-item';
        el.innerHTML = `<img src="${game.icon}"><span>${game.name}</span>`;
        el.onclick = () => {
            document.getElementById('placeId').value = game.id;
            fetchStats();
        };
        list.appendChild(el);
    });
}
