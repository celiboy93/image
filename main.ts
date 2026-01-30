import { Hono } from "jsr:@hono/hono";

const app = new Hono();

// 🔥 API Configuration
const API_KEY = "0004640d6fb420fbe95d270e65ab0ccb"; 
const API_URL = "https://thumbsnap.com/api/upload";

// --- 1. Proxy Helper (Remote URL တွေကို Frontend မှာ compress လုပ်နိုင်ဖို့) ---
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
        <title>Smart Thumbsnap Uploader (Canvas Edition)</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" />
    </head>
    <body class="bg-slate-900 min-h-screen flex items-center justify-center p-4">
        <div class="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md border border-slate-700 relative overflow-hidden">
            
            <div class="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg z-10 shadow-md">
                18+ ADULT
            </div>

            <h1 class="text-xl font-bold mb-6 text-center text-slate-800 mt-2">
                <i class="fa-solid fa-wand-magic-sparkles text-purple-500 mr-2"></i> Smart Uploader
            </h1>
            
            <!-- Upload Form -->
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

                <!-- Preview Area (Before Upload) -->
                <div id="preUploadPreview" class="hidden text-center bg-slate-100 p-3 rounded-lg">
                    <p id="sizeMsg" class="text-[10px] font-bold text-slate-500 mb-2"></p>
                    <img id="imgPreview" class="h-32 mx-auto rounded border border-slate-300 shadow-sm object-contain">
                    <button id="uploadBtn" class="w-full bg-purple-600 text-white py-3 mt-3 rounded-lg hover:bg-purple-700 transition font-bold shadow-lg">
                        UPLOAD TO THUMBSNAP 🚀
                    </button>
                </div>
            </div>

            <!-- Loading State -->
            <div id="loading" class="hidden mt-8 text-center">
                <div class="animate-spin inline-block w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mb-3"></div>
                <p class="text-xs text-purple-600 animate-pulse font-bold tracking-widest">UPLOADING...</p>
            </div>

            <div id="error" class="hidden mt-4 p-3 bg-red-100 text-red-600 text-xs rounded border border-red-200 text-center font-bold"></div>

            <!-- Result Section -->
            <div id="resultArea" class="hidden mt-6">
                <div class="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Direct Link (Fixed)
                    </label>
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
            const errorDiv = document.getElementById('error');
            const resultArea = document.getElementById('resultArea');
            const preUploadPreview = document.getElementById('preUploadPreview');
            const uploadBtn = document.getElementById('uploadBtn');

            // --- 1. File Selection Logic ---
            document.getElementById('fileInput').addEventListener('change', (e) => {
                if(e.target.files[0]) processFile(e.target.files[0]);
            });

            async function fetchUrl() {
                const u = document.getElementById('urlInput').value;
                if(!u) return;
                loading.classList.remove('hidden');
                loading.querySelector('p').innerText = "FETCHING IMAGE...";
                try {
                    // Call our Proxy to get the image as a blob
                    const res = await fetch('/proxy?url='+encodeURIComponent(u));
                    if(!res.ok) throw new Error("Failed to fetch image");
                    const blob = await res.blob();
                    processFile(new File([blob], "remote_image.jpg", { type: blob.type }));
                } catch(e) { 
                    alert("Cannot fetch URL. Try downloading it first."); 
                } finally {
                    loading.classList.add('hidden');
                }
            }

            // --- 2. Compression Logic (Matches Supabase Code) ---
            async function processFile(f) {
                loading.classList.remove('hidden');
                loading.querySelector('p').innerText = "OPTIMIZING...";
                
                let msg = \`Original: \${(f.size/1024).toFixed(1)} KB\`;
                
                // Compress if > 70KB (Limit from Supabase code logic)
                if(f.size > 71680) { 
                    try {
                        currFile = await compress(f, 0.6); // Quality 0.6 (Standard Canvas compression)
                        msg += \` ➝ Compressed: \${(currFile.size/1024).toFixed(1)} KB\`;
                    } catch(e) {
                        console.error(e);
                        currFile = f; // Fallback
                    }
                } else {
                    currFile = f;
                }

                document.getElementById('sizeMsg').innerHTML = msg;
                document.getElementById('imgPreview').src = URL.createObjectURL(currFile);
                
                loading.classList.add('hidden');
                preUploadPreview.classList.remove('hidden');
                resultArea.classList.add('hidden');
            }

            // The Canvas Compressor Function
            function compress(file, quality) {
                return new Promise((resolve, reject) => {
                    const img = document.createElement('img');
                    img.src = URL.createObjectURL(file);
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        
                        // Keep original dimensions (prevents pixelation from bad resizing)
                        canvas.width = img.width; 
                        canvas.height = img.height;
                        
                        // Draw with default browser smoothing
                        ctx.drawImage(img, 0, 0, img.width, img.height);
                        
                        // Output as JPEG with defined quality
                        canvas.toBlob(blob => {
                            if(!blob) reject("Compression failed");
                            resolve(new File([blob], file.name, { type: "image/jpeg" }));
                        }, 'image/jpeg', quality); 
                    };
                    img.onerror = reject;
                });
            }

            // --- 3. Upload Logic ---
            uploadBtn.addEventListener('click', async () => {
                if(!currFile) return;

                preUploadPreview.classList.add('hidden');
                loading.classList.remove('hidden');
                loading.querySelector('p').innerText = "UPLOADING TO THUMBSNAP...";
                errorDiv.classList.add('hidden');

                const formData = new FormData();
                formData.append('file', currFile);

                try {
                    const response = await fetch('/process', { method: 'POST', body: formData });
                    const data = await response.json();

                    if(data.error) throw new Error(data.error);

                    // Date fix for link
                    const rawLink = data.data.media;
                    const now = new Date();
                    const suffix = "?" + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
                    
                    document.getElementById('directLink').value = rawLink + suffix;
                    resultArea.classList.remove('hidden');

                } catch (err) {
                    errorDiv.innerText = err.message;
                    errorDiv.classList.remove('hidden');
                    preUploadPreview.classList.remove('hidden');
                } finally {
                    loading.classList.add('hidden');
                }
            });

            function copyLink() {
                const copyText = document.getElementById("directLink");
                copyText.select();
                navigator.clipboard.writeText(copyText.value);
            }
        </script>
    </body>
    </html>
  `);
});

// --- 3. Backend Logic (Simplified - Just Uploads) ---
app.post("/process", async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body['file'];

    if (!file || !(file instanceof File)) {
        return c.json({ error: "No file received" }, 400);
    }

    // Convert File to Blob for FormData
    const fileBlob = new Blob([await file.arrayBuffer()], { type: file.type });

    // Send DIRECTLY to Thumbsnap (File is already compressed by Frontend)
    const formData = new FormData();
    formData.append("key", API_KEY);
    formData.append("content", "1"); 
    formData.append("adult", "1");
    formData.append("media", fileBlob, "image.jpg");

    const tsResp = await fetch(API_URL, { 
        method: "POST", 
        body: formData,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36" }
    });

    const tsResult = await tsResp.json();

    if (!tsResult.success) {
        return c.json({ error: tsResult.error?.message || "Thumbsnap Upload Failed" }, 400);
    }

    return c.json({ success: true, data: tsResult.data });

  } catch (globalErr) {
    return c.json({ error: globalErr.message }, 500);
  }
});

Deno.serve(app.fetch);
