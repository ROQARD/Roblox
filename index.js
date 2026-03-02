export default {
  async fetch(request) {
    const url = new URL(request.url);
    const PROXIES = ["rotunnel.com", "roproxy.com", "rbxproxy.com"];

    if (url.pathname.startsWith("/api/")) {
      const apiHeaders = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
      
      // 1. Cloudflare Turnstile Server-Side Verification
      if (url.pathname === "/api/verify-captcha") {
        const token = url.searchParams.get("token");
        const secret = "0x4AAAAAACk-FBhYSFtiH6dRcg_6osS-xLM"; 
        const outcome = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `secret=${secret}&response=${token}`
        }).then(res => res.json());
        return new Response(JSON.stringify(outcome), { headers: apiHeaders });
      }

      // 2. Proxy Fetch Logic
      const tryFetch = async (s, e) => {
        for (let p of PROXIES) {
          try {
            const r = await fetch(`https://${s}.${p}${e}`, { headers: { "User-Agent": "RoStats_Standard" }});
            if (r.status === 403) throw new Error("Private");
            if (r.ok) return await r.json();
          } catch (err) { 
            if (err.message === "Private") throw err;
            continue; 
          }
        }
        throw new Error("NotFound");
      };

      try {
        if (url.pathname === "/api/validate-id") {
          const id = url.searchParams.get("id");
          const d = await tryFetch('apis', `/universes/v1/places/${id}/universe`);
          return new Response(JSON.stringify({ universeId: d.universeId }), { headers: apiHeaders });
        }
        if (url.pathname === "/api/get-stats") {
          const u = url.searchParams.get("uid");
          const [g, v, f] = await Promise.all([
            tryFetch('games', `/v1/games?universeIds=${u}`),
            tryFetch('games', `/v1/games/votes?universeIds=${u}`),
            tryFetch('games', `/v1/games/${u}/favorites/count`)
          ]);
          return new Response(JSON.stringify({ game: g.data[0], votes: v.data[0], favorites: f.favoritesCount }), { headers: apiHeaders });
        }
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: apiHeaders });
      }
    }
    return new Response(html, { headers: { "Content-Type": "text/html" } });
  }
};

const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>RoStats</title>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        :root { --bg: #050505; --card: #0c0c0c; --border: #1a1a1a; --accent: #4ade80; --text: #fff; --dim: #71717a; --warn: #ff4444; }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
        body { background: var(--bg); color: var(--text); padding: 20px; display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
        .container { width: 100%; max-width: 650px; padding-bottom: 80px; }
        
        /* Search UI */
        .search-area { background: var(--card); border: 1px solid var(--border); padding: 30px; border-radius: 24px; text-align: center; margin-bottom: 12px; }
        .input-box { display: flex; gap: 10px; background: #000; padding: 6px; border-radius: 14px; border: 1px solid var(--border); transition: 0.3s; }
        input { flex: 1; background: transparent; border: none; color: white; padding: 10px 15px; font-size: 0.9rem; outline: none; }
        .scan-btn { background: var(--accent); color: #000; border: none; padding: 0 20px; border-radius: 10px; font-weight: 800; cursor: pointer; text-transform: uppercase; font-size: 0.7rem; }
        .scan-btn:disabled { opacity: 0.3; cursor: not-allowed; filter: grayscale(1); }
        .captcha-box { margin: 15px 0; display: flex; justify-content: center; min-height: 65px; }
        
        /* Navigation (Recent/Recommended) */
        .nav-wrapper { width: 100%; display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px; }
        .nav-label { font-size: 0.55rem; color: #444; text-transform: uppercase; font-weight: 900; width: 100%; margin-bottom: 4px; letter-spacing: 1px; }
        .chip-group { display: flex; gap: 6px; flex-wrap: wrap; }
        .nav-chip { background: var(--card); border: 1px solid var(--border); color: var(--dim); padding: 8px 14px; border-radius: 10px; font-size: 0.7rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; }
        .nav-chip:hover { border-color: var(--accent); color: #fff; }
        .del-recent { color: var(--warn); font-size: 1rem; line-height: 1; margin-left: 4px; }

        /* Dashboard */
        .dashboard { display: none; flex-direction: column; gap: 12px; animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .box { background: var(--card); border: 1px solid var(--border); padding: 20px; border-radius: 18px; position: relative; }
        .thumb-wrap { width: 120px; height: 120px; border-radius: 18px; background: #111; margin: 0 auto 15px; overflow: hidden; display: none; border: 1px solid var(--border); }
        .thumb-wrap img { width: 100%; height: 100%; object-fit: cover; }
        .label { font-size: 0.6rem; color: var(--dim); text-transform: uppercase; font-weight: 800; margin-bottom: 6px; }
        .val { font-size: 1.3rem; font-weight: 800; }
        
        .content-card { background: var(--card); border: 1px solid var(--border); padding: 25px; border-radius: 20px; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid var(--border); }
        .meta-item { font-size: 0.75rem; color: var(--dim); }
        .meta-item b { color: #fff; display: block; font-size: 0.85rem; margin-top: 2px; }

        .action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
        .btn { text-decoration: none; text-align: center; padding: 16px; border-radius: 14px; font-weight: 800; text-transform: uppercase; font-size: 0.8rem; cursor: pointer; border: none; transition: 0.2s; }
        .play-btn { background: #fff; color: #000; }
        .copy-btn { background: #111; color: #fff; border: 1px solid var(--border); }
        
        .error-msg { color: var(--warn); font-size: 0.65rem; font-weight: 800; margin-top: 10px; display: none; }
        .footer { position: fixed; bottom: 20px; right: 25px; }
        .footer-link { color: var(--dim); text-decoration: none; font-size: 0.65rem; font-weight: 800; letter-spacing: 1.5px; opacity: 0.4; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
    </style>
</head>
<body>
    <div class="container">
        <div class="search-area">
            <h1 style="font-size: 2rem; margin-bottom:20px; letter-spacing: -1.2px;">Ro<span style="color:var(--accent)">Stats</span></h1>
            <div class="input-box" id="inputWrapper">
                <input type="text" id="placeId" placeholder="Paste Game Link or ID...">
                <button class="scan-btn" id="scanBtn" onclick="run()" disabled>Scan</button>
            </div>
            <div class="captcha-box">
                <div class="cf-turnstile" data-sitekey="0x4AAAAAACk-FIXxhlsidtFU" data-callback="onCaptcha"></div>
            </div>
            <div id="errorBox" class="error-msg">EXPERIENCE NOT FOUND</div>
        </div>

        <div id="navWrapper" class="nav-wrapper">
            <div id="recentBlock" style="display:none">
                <div class="nav-label">Recent</div>
                <div id="recentContainer" class="chip-group"></div>
            </div>
            <div id="recomBlock">
                <div class="nav-label">Recommended</div>
                <div id="recomContainer" class="chip-group">
                    <div class="nav-chip">Loading...</div>
                </div>
            </div>
        </div>

        <div id="results" class="dashboard">
            <div class="box" style="text-align:center">
                <div id="thumbWrap" class="thumb-wrap"><img id="gThumb" src="" onerror="this.parentElement.style.display='none'"></div>
                <h2 id="gTitle" style="font-size: 1.5rem;">-</h2>
                <div id="gGenre" style="font-size:0.6rem; color:var(--dim); text-transform:uppercase; margin-top:5px; font-weight:800">-</div>
                <a id="gOwner" style="color:var(--accent); text-decoration:none; font-size:0.9rem; font-weight:600; margin-top:10px; display:inline-block;" target="_blank">-</a>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                <div class="box"><div class="label">Active</div><div class="val" id="vPlay">-</div></div>
                <div class="box"><div class="label">Rating</div><div class="val" id="vRate">-</div></div>
                <div class="box"><div class="label">Dislikes</div><div class="val" id="vDis" style="color:var(--warn)">-</div></div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                <div class="box"><div class="label">Visits</div><div class="val" id="vVisit">-</div></div>
                <div class="box"><div class="label">Likes</div><div class="val" id="vLike">-</div></div>
                <div class="box"><div class="label">Favorites</div><div class="val" id="vFav">-</div></div>
            </div>

            <div class="content-card">
                <div class="meta-grid">
                    <div class="meta-item">Created<b><span id="dCreate">-</span></b></div>
                    <div class="meta-item">Last Update<b><span id="dUpdate">-</span></b></div>
                    <div class="meta-item">Max Players<b><span id="vMax">-</span></b></div>
                    <div class="meta-item">Avg Growth<b><span id="vGrowth">-</span></b></div>
                </div>
                <div class="label" style="margin-bottom:10px;">Description</div>
                <div id="gDesc" style="font-size: 0.8rem; color: var(--dim); line-height: 1.4; max-height: 150px; overflow-y: auto;"></div>
            </div>

            <div class="action-grid">
                <button class="btn copy-btn" onclick="copyStats()">Copy Summary</button>
                <a id="robloxLink" class="btn play-btn" target="_blank">Open Experience</a>
            </div>
        </div>
    </div>

    <div class="footer"><a href="https://www.roblox.com/users/9461867215/profile" class="footer-link" target="_blank">BY ROQARD</a></div>

    <script>
        let itv, captchaToken = null;
        const fmt = x => x >= 1e6 ? (x/1e6).toFixed(1)+'M' : x >= 1e3 ? (x/1e3).toFixed(1)+'K' : x.toLocaleString();

        function onCaptcha(token) {
            captchaToken = token;
            document.getElementById('scanBtn').disabled = false;
        }

        async function validateGame(id) {
            try {
                const r = await fetch("/api/validate-id?id=" + id);
                if (!r.ok) {
                    const data = await r.json();
                    return { success: false, error: data.error };
                }
                const v = await r.json();
                const d = await fetch("/api/get-stats?uid=" + v.universeId).then(res => res.json());
                return { success: true, name: d.game.name, data: d, id: id };
            } catch (e) {
                return { success: false, error: "NotFound" };
            }
        }

        async function loadRecommended() {
            const id = '109612380137176';
            const res = await validateGame(id);
            if(res.success) {
                document.getElementById('recomContainer').innerHTML = '<div class="nav-chip" onclick="quickScan(\\''+id+'\\')">'+res.name+'</div>';
            }
        }

        function saveRecent(id, name) {
            let recents = JSON.parse(localStorage.getItem('roStats_final') || '[]');
            recents = recents.filter(x => x.id !== id);
            recents.unshift({id, name});
            if (recents.length > 4) recents.pop();
            localStorage.setItem('roStats_final', JSON.stringify(recents));
            renderRecents();
        }

        function renderRecents() {
            const container = document.getElementById('recentContainer');
            const block = document.getElementById('recentBlock');
            const recents = JSON.parse(localStorage.getItem('roStats_final') || '[]');
            if(recents.length === 0) { block.style.display = 'none'; return; }
            block.style.display = 'block';
            container.innerHTML = '';
            recents.forEach(item => {
                const chip = document.createElement('div');
                chip.className = 'nav-chip';
                chip.innerHTML = item.name + '<span class="del-recent" onclick="event.stopPropagation(); removeRecent(\\''+item.id+'\\')">×</span>';
                chip.onclick = () => quickScan(item.id);
                container.appendChild(chip);
            });
        }

        function removeRecent(id) {
            let recents = JSON.parse(localStorage.getItem('roStats_final') || '[]');
            recents = recents.filter(x => x.id !== id);
            localStorage.setItem('roStats_final', JSON.stringify(recents));
            renderRecents();
        }

        function quickScan(id) {
            document.getElementById('placeId').value = id;
            run();
        }

        function copyStats() {
            const t = document.getElementById('gTitle').innerText;
            const p = document.getElementById('vPlay').innerText;
            navigator.clipboard.writeText(t + " Stats\\nActive: " + p + "\\nvia RoStats");
            const b = document.querySelector('.copy-btn'); b.innerText = "COPIED";
            setTimeout(() => { b.innerText = "COPY SUMMARY"; }, 2000);
        }

        async function run() { 
            if(!captchaToken) return;
            const errorBox = document.getElementById('errorBox');
            const scanBtn = document.getElementById('scanBtn');
            const raw = document.getElementById('placeId').value.trim();
            const match = raw.match(/games\\/(\\d+)/);
            const id = match ? match[1] : raw.replace(/\\D/g, '');
            
            errorBox.style.display = 'none';
            scanBtn.innerText = 'WAIT...';

            const res = await validateGame(id);
            if(!res.success) {
                errorBox.style.display = 'block';
                errorBox.innerText = res.error === "Private" ? "EXPERIENCE IS PRIVATE" : "EXPERIENCE NOT FOUND";
                scanBtn.innerText = 'SCAN';
                return;
            }

            document.getElementById('navWrapper').style.display = 'none';
            document.querySelector('.captcha-box').style.display = 'none';
            document.getElementById('results').style.display = 'flex';
            scanBtn.innerText = 'SCAN';
            
            // Security: Reset Turnstile
            turnstile.reset();
            captchaToken = null;
            scanBtn.disabled = true;

            if(itv) clearInterval(itv);
            updateUI(res.data, id);
            itv = setInterval(async () => {
                const refresh = await validateGame(id);
                if(refresh.success) updateUI(refresh.data, id);
            }, 30000);
        }

        function updateUI(d, id) {
            const g = d.game;
            const v = d.votes;
            saveRecent(id, g.name);
            
            document.getElementById('gThumb').src = "https://www.roblox.com/asset-thumbnail/image?assetId=" + id + "&width=420&height=420&format=png";
            document.getElementById('thumbWrap').style.display = 'block';
            document.getElementById('gTitle').innerText = g.name;
            document.getElementById('gGenre').innerText = g.genre || "All Genres";
            document.getElementById('gOwner').innerText = "By " + g.creator.name;
            document.getElementById('gOwner').href = (g.creator.type === "Group" ? "https://www.roblox.com/groups/" : "https://www.roblox.com/users/") + g.creator.id;

            const up = v.upVotes || 0, down = v.downVotes || 0;
            const rate = (up+down) > 0 ? Math.round((up/(up+down))*100) : 0;
            
            document.getElementById('vPlay').innerText = fmt(g.playing);
            document.getElementById('vRate').innerText = rate + "%";
            document.getElementById('vDis').innerText = fmt(down);
            document.getElementById('vVisit').innerText = fmt(g.visits);
            document.getElementById('vLike').innerText = fmt(up);
            document.getElementById('vFav').innerText = fmt(d.favorites);
            
            document.getElementById('dCreate').innerText = new Date(g.created).toLocaleDateString();
            document.getElementById('dUpdate').innerText = new Date(g.updated).toLocaleDateString();
            document.getElementById('vMax').innerText = g.maxPlayers || "--";
            document.getElementById('vGrowth').innerText = fmt(Math.round(g.visits / Math.max(1, (new Date() - new Date(g.created)) / 86400000))) + "/day";
            document.getElementById('gDesc').innerText = g.description || "No description provided.";
            document.getElementById('robloxLink').href = "https://www.roblox.com/games/" + id;
        }

        renderRecents();
        loadRecommended();
    </script>
</body></html>`;
