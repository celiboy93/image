import { Hono } from "jsr:@hono/hono";

const app = new Hono();

// 🔥 API Configuration
const API_KEY = "0004640d6fb420fbe95d270e65ab0ccb"; 
const API_URL = "https://thumbsnap.com/api/upload";

// --- 1. Proxy Helper ---
app.get("/proxy", async (c) => {
  const url = c.req.query("url");
  if (!url) return c.text("Missing URL", 400);
  try {
    const resp = await fetch(url, {
       headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    return new Response(resp.body, { 
        headers: { "Content-Type": resp.headers.get("Content-Type") || "image/jpeg" } 
    });
  } catch (e) { return c.text("Error fetching url", 500); }
});

// --- 2. Main UI ---
app.get("/", (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Thumbsnap 60KB Fix</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" />
    </head>
    <body class="bg-slate-900 min-h-screen flex items-center justify-center p-4">
        <div class="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md border border-slate-700 relative overflow-hidden">
            
            <div class="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg z-10 shadow-md">
                18+ ADULT
            </div>

            <h1 class="text-xl font-bold mb-6 text-center text-slate-800 mt-2">
                <i class="fa-solid fa-compress text-purple-500 mr-2"></i> 60KB Compressor
            </h1>
            
            <div class="space-y-5">
                <!-- File Input -->
                <div class="border-2 border-dashed border-purple-300 rounded-lg p-6 hover:bg-purple-50 transition text-center cursor-pointer relative group" onclick="document.getElementById('fileInput').click()">
                    <input type="file" id="fileInput" accept="image/*" class="hidden">
                    <i class="fa-solid fa-image text-3xl text-purple-400 mb-2 group-hover:text-purple-600 transition"></i>
                    <p class="text-xs font-bold text-slate-500 uppercase group-hover:text-purple-700">Choose Image</p>
                </div>

                <div class="text-center text-slate-300 text-xs font-bold">- OR -</div>

                <!-- URL Input -->
                <div class="flex gap-2">
                    <input type="url" id="urlInput" placeholder="Paste Image URL..." class="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm">
                    <button onclick="fetchUrl()" class="bg-slate-700 text-white px-4 rounded-lg font-bold text-xs">FETCH</button>
                </div>

                <!-- Preview Area -->
                <div id="preUploadPreview" class="hidden text-center bg-slate-100 p-3 rounded-lg">
                    <p id="sizeMsg" class="text-[11px] font-bold text-slate-600 mb-2 leading-relaxed"></p>
                    <img id="imgPreview" class="h-32 mx-auto rounded border border-slate-300 shadow-sm object-contain">
                    <button id="uploadBtn" class="w-full bg-purple-600 text-white py-3 mt-3 rounded-lg hover:bg-purple-700 transition font-bold shadow-lg">
                        UPLOAD TO THUMBSNAP 🚀
                    </button>
                </div>
            </div>

            <!-- Loading -->
            <div id="loading" class="hidden mt-8 text-center">
                <div class="animate-spin inline-block w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mb-3"></div>
                <p id="loadingText" class="text-xs text-purple-600 animate-pulse font-bold tracking-widest">PROCESSING...</p>
            </div>

            <div id="error" class="hidden mt-4 p-3 bg-red-100 text-red-600 text-xs rounded border border-red-200 text-center font-bold"></div>

            <!-- Result -->
            <div id="resultArea" class="hidden mt-6">
                <div class="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Direct Link</label>
                    <div class="flex gap-2">
                        <input id="directLink" readonly class="flex-1 text-sm bg-white border border-slate-300 p-2 rounded text-purple-700 font-mono font-bold select-all focus:border-purple-500 outline-none text-xs" />
                        <button onclick="copyLink()" class="bg-white border border-slate-300 hover:bg-slate-100 px-3 py-2 rounded text-xs font-bold text-slate-700"><i class="fa-regular fa-copy"></i></button>
                    </div>
                </div>
                <div class="text-center mt-4">
                    <button onclick="window.location.reload()" class="text-xs text-slate-400 hover:text-purple-500 underline">Upload Another</button>
                </div>
            </div>
        </div>

        <script>
            let currFile = null;
            const loading = document.getElementById('loading');
            const loadingText = document.getElementById('loadingText');
            const preUploadPreview = document.getElementById('preUploadPreview');
            const sizeMsg = document.getElementById('sizeMsg');

            document.getElementById('fileInput').addEventListener('change', (e) => {
                if(e.target.files[0]) processFile(e.target.files[0]);
            });

            async function fetchUrl() {
                const u = document.getElementById('urlInput').value;
                if(!u) return;
                loading.classList.remove('hidden'); loadingText.innerText = "FETCHING...";
                try {
                    const res = await fetch('/proxy?url='+encodeURIComponent(u));
                    if(!res.ok) throw new Error("Failed");
                    const blob = await res.blob();
                    processFile(new File([blob], "remote.jpg", { type: blob.type }));
                } catch(e) { alert("Error fetching URL"); loading.classList.add('hidden'); }
            }

            // --- 🔥 SMART COMPRESS LOGIC (Modified for ~60KB) 🔥 ---
            async function processFile(f) {
                loading.classList.remove('hidden'); loadingText.innerText = "OPTIMIZING SIZE...";
                preUploadPreview.classList.add('hidden');

                let originalSize = (f.size/1024).toFixed(1);
                
                // Target Threshold: 70KB (Like Supabase check)
                if(f.size > 71680) {
                    try {
                        // 1. First Pass: Supabase Standard (Quality 0.6)
                        let temp = await compress(f, 0.6); 

                        // 2. Safety Check: If still > 80KB, Force Scale Down
                        // (Supabase ကုဒ်က ဒီအဆင့်မပါတော့ ပုံအကြီးကြီးတွေဆို 100KB ကျော်နေတာပါ)
                        if (temp.size > 81920) {
                             // Quality 0.5 + Max Width 1200px (မကြည်မှာမပူနဲ့ ဖုန်းScreenစာလောက်ပဲ ချုံ့တာ)
                             temp = await compress(f, 0.5, 1200);
                        }
                        
                        // 3. Last Resort: If still > 80KB, Go lower
                        if (temp.size > 81920) {
                             temp = await compress(f, 0.4, 1000);
                        }

                        currFile = temp;
                        let newSize = (currFile.size/1024).toFixed(1);
                        sizeMsg.innerHTML = \`Original: \${originalSize} KB <i class="fa-solid fa-arrow-right text-slate-400 mx-1"></i> <span class="text-green-600">\${newSize} KB</span>\`;
                    
                    } catch(e) { console.error(e); currFile = f; }
                } else {
                    currFile = f;
                    sizeMsg.innerHTML = \`Size: <span class="text-green-600">\${originalSize} KB</span> (No compress needed)\`;
                }

                document.getElementById('imgPreview').src = URL.createObjectURL(currFile);
                loading.classList.add('hidden');
                preUploadPreview.classList.remove('hidden');
                document.getElementById('resultArea').classList.add('hidden');
            }

            // The Compressor Helper
            function compress(file, quality, maxWidth = 0) {
                return new Promise((resolve) => {
                    const img = document.createElement('img');
                    img.src = URL.createObjectURL(file);
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let w = img.width;
                        let h = img.height;

                        // Smart Resize: Only if maxWidth is set and image is wider
                        if (maxWidth > 0 && w > maxWidth) {
                            const ratio = maxWidth / w;
                            w = maxWidth;
                            h = h * ratio;
                        }

                        canvas.width = w; canvas.height = h;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, w, h);
                        
                        canvas.toBlob(blob => {
                            resolve(new File([blob], file.name, { type: "image/jpeg" }));
                        }, 'image/jpeg', quality);
                    };
                });
            }

            // --- Upload Logic ---
            document.getElementById('uploadBtn').addEventListener('click', async () => {
                loading.classList.remove('hidden'); loadingText.innerText = "UPLOADING...";
                const fd = new FormData(); fd.append('file', currFile);

                try {
                    const res = await fetch('/process', { method:'POST', body:fd });
                    const d = await res.json();
                    if(d.error) throw new Error(d.error);

                    const now = new Date();
                    const suffix = "?" + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0');
                    document.getElementById('directLink').value = d.data.media + suffix;
                    preUploadPreview.classList.add('hidden');
                    document.getElementById('resultArea').classList.remove('hidden');
                } catch(e) { 
                    alert(e.message); 
                } finally { loading.classList.add('hidden'); }
            });

            function copyLink() {
                const c = document.getElementById("directLink"); c.select();
                navigator.clipboard.writeText(c.value);
            }
        </script>
    </body>
    </html>
  `);
});

// --- 3. Backend Logic ---
app.post("/process", async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body['file'];
    if (!file) return c.json({ error: "No file" }, 400);

    const fd = new FormData();
    fd.append("key", API_KEY);
    fd.append("content", "1"); fd.append("adult", "1");
    fd.append("media", new Blob([await file.arrayBuffer()], { type: "image/jpeg" }), "img.jpg");

    const tsResp = await fetch(API_URL, { method: "POST", body: fd });
    const tsResult = await tsResp.json();

    if (!tsResult.success) return c.json({ error: tsResult.error?.message || "Failed" }, 400);
    return c.json({ success: true, data: tsResult.data });

  } catch (e) { return c.json({ error: e.message }, 500); }
});

Deno.serve(app.fetch);
