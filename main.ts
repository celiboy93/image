import { Hono } from "jsr:@hono/hono";
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const app = new Hono();

// 🔥 API Configuration
const API_KEY = "0004640d6fb420fbe95d270e65ab0ccb"; 
const API_URL = "https://thumbsnap.com/api/upload";

app.get("/", (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Smart Thumbsnap Uploader</title>
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
            
            <form id="uploadForm" class="space-y-5">
                <div class="border-2 border-dashed border-purple-300 rounded-lg p-6 hover:bg-purple-50 transition text-center cursor-pointer relative group">
                    <input type="file" name="file" accept="image/*" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10">
                    <i class="fa-solid fa-image text-3xl text-purple-400 mb-2 group-hover:text-purple-600 transition"></i>
                    <p class="text-xs font-bold text-slate-500 uppercase group-hover:text-purple-700">Choose Image</p>
                </div>

                <div class="text-center text-slate-300 text-xs font-bold">- OR -</div>

                <div>
                    <input type="url" name="url" placeholder="Paste Image URL..." class="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm">
                </div>

                <button type="submit" class="w-full bg-slate-800 text-white py-3.5 rounded-lg hover:bg-black transition font-bold shadow-lg">
                    UPLOAD (High Quality)
                </button>
            </form>

            <div id="loading" class="hidden mt-8 text-center">
                <div class="animate-spin inline-block w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mb-3"></div>
                <p class="text-xs text-purple-600 animate-pulse font-bold tracking-widest">OPTIMIZING & UPLOADING...</p>
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

                    <div class="mt-3 text-center">
                        <p class="text-[10px] text-gray-400 mb-2">Preview:</p>
                        <img id="previewImg" class="w-full h-40 object-contain rounded bg-white border border-slate-200" />
                    </div>
                </div>
                
                <div class="text-center mt-4">
                    <button onclick="window.location.reload()" class="text-xs text-slate-400 hover:text-purple-500 underline">Upload Another</button>
                </div>
            </div>
        </div>

        <script>
            const form = document.getElementById('uploadForm');
            const resultArea = document.getElementById('resultArea');
            const loading = document.getElementById('loading');
            const errorDiv = document.getElementById('error');

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                resultArea.classList.add('hidden');
                errorDiv.classList.add('hidden');
                loading.classList.remove('hidden');

                const formData = new FormData(form);

                try {
                    const response = await fetch('/process', { method: 'POST', body: formData });
                    const textData = await response.text(); 
                    
                    let data;
                    try { 
                        data = JSON.parse(textData); 
                    } catch(e) { 
                        console.error("Raw:", textData);
                        throw new Error("SERVER ERROR: " + textData.substring(0, 150)); 
                    }

                    if(data.error) throw new Error(data.error);

                    // --- DATE FIX ---
                    const rawLink = data.data.media;
                    const now = new Date();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const day = String(now.getDate()).padStart(2, '0');
                    const suffix = "?" + month + day;
                    const finalLink = rawLink + suffix;

                    document.getElementById('directLink').value = finalLink;
                    document.getElementById('previewImg').src = finalLink;
                    
                    resultArea.classList.remove('hidden');

                } catch (err) {
                    errorDiv.innerText = err.message;
                    errorDiv.classList.remove('hidden');
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

// 2. Backend Logic (SMART RESIZE & COMPRESS)
app.post("/process", async (c) => {
  try {
    const body = await c.req.parseBody();
    let imageBuffer: ArrayBuffer | null = null;
    let originalSize = 0;

    // --- Input Handling ---
    if (body['file'] && body['file'] instanceof File && body['file'].size > 0) {
       imageBuffer = await body['file'].arrayBuffer();
       originalSize = body['file'].size;
    } 
    else if (body['url'] && typeof body['url'] === 'string' && body['url'].trim() !== "") {
       try {
           const resp = await fetch(body['url'], {
               headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36" }
           });
           if (!resp.ok) return c.json({ error: "Invalid URL" }, 400);
           imageBuffer = await resp.arrayBuffer();
           originalSize = imageBuffer.byteLength;
       } catch(e) { return c.json({ error: "Fetch Error" }, 400); }
    } else {
       return c.json({ error: "Please select an image" }, 400);
    }

    // --- 🔥 SMART COMPRESSION LOGIC 🔥 ---
    let processedData = new Uint8Array(imageBuffer);
    const TARGET_SIZE = 60 * 1024; // 60KB

    if (originalSize > 50 * 1024) {
        try {
            const image = await Image.decode(new Uint8Array(imageBuffer));
            
            // Step 1: Resize if too big (This prevents blocky artifacts)
            // A 4000px image at low quality looks bad. A 1000px image at high quality looks good.
            const MAX_WIDTH = 1000;
            if (image.width > MAX_WIDTH) {
                // Calculate new height to maintain aspect ratio
                const ratio = MAX_WIDTH / image.width;
                const newHeight = Math.round(image.height * ratio);
                image.resize(MAX_WIDTH, newHeight);
            }

            // Step 2: Try High Quality first
            let quality = 85;
            let temp = await image.encodeJPEG(quality);

            // Step 3: Loop if still too big
            while (temp.byteLength > TARGET_SIZE && quality > 30) {
                // Reduce quality slightly
                quality -= 10;
                temp = await image.encodeJPEG(quality);
                
                // If quality is getting too low (< 50) and size is still big, 
                // resize dimensions down a bit more instead of ruining quality
                if (quality < 50 && temp.byteLength > TARGET_SIZE) {
                    const newW = Math.round(image.width * 0.8); // Reduce width by 20%
                    const newH = Math.round(image.height * 0.8);
                    image.resize(newW, newH);
                    quality = 80; // Reset quality to high for new smaller size
                    temp = await image.encodeJPEG(quality);
                }
            }
            
            processedData = temp;

        } catch (e) {
            console.error("Smart compress failed, using original:", e);
        }
    }

    // --- UPLOAD TO THUMBSNAP ---
    const formData = new FormData();
    formData.append("key", API_KEY);
    formData.append("content", "1"); 
    formData.append("adult", "1");
    formData.append("media", new Blob([processedData], { type: "image/jpeg" }), "image.jpg");

    const tsResp = await fetch(API_URL, { 
        method: "POST", 
        body: formData,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36" }
    });

    const tsText = await tsResp.text();
    let tsResult;
    try { tsResult = JSON.parse(tsText); } 
    catch(e) { return c.json({ error: "Thumbsnap Error: " + tsText.substring(0, 100) }, 502); }

    if (!tsResult.success) {
        return c.json({ error: tsResult.error?.message || "Upload Failed" }, 400);
    }

    return c.json({ success: true, data: tsResult.data });

  } catch (globalErr) {
    return c.json({ error: globalErr.message }, 500);
  }
});

Deno.serve(app.fetch);
