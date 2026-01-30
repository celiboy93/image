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
        <title>Thumbsnap Direct Uploader</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" />
    </head>
    <body class="bg-gray-900 min-h-screen flex items-center justify-center p-4">
        <div class="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md border border-gray-700 relative overflow-hidden">
            
            <div class="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg z-10 shadow-md">
                18+ ADULT MODE
            </div>

            <h1 class="text-xl font-bold mb-6 text-center text-gray-800 mt-2">
                <i class="fa-solid fa-fire text-red-500 mr-2"></i> Direct Link Fixer
            </h1>
            
            <form id="uploadForm" class="space-y-5">
                <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:bg-gray-50 transition text-center cursor-pointer relative group">
                    <input type="file" name="file" accept="image/*" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10">
                    <i class="fa-solid fa-cloud-arrow-up text-3xl text-gray-400 mb-2 group-hover:text-red-500 transition"></i>
                    <p class="text-xs font-bold text-gray-500 uppercase group-hover:text-red-600">Choose Image</p>
                </div>

                <div class="text-center text-gray-300 text-xs font-bold">- OR -</div>

                <div>
                    <input type="url" name="url" placeholder="Paste Image URL..." class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm">
                </div>

                <button type="submit" class="w-full bg-gray-800 text-white py-3.5 rounded-lg hover:bg-black transition font-bold shadow-lg">
                    UPLOAD & GET DIRECT LINK
                </button>
            </form>

            <div id="loading" class="hidden mt-8 text-center">
                <div class="animate-spin inline-block w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full mb-3"></div>
                <p class="text-xs text-red-600 animate-pulse font-bold tracking-widest">UPLOADING...</p>
            </div>

            <div id="error" class="hidden mt-4 p-3 bg-red-100 text-red-600 text-xs rounded border border-red-200 text-center font-bold"></div>

            <!-- Result Section -->
            <div id="resultArea" class="hidden mt-6">
                <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                        Direct Link (Corrected with Date)
                    </label>
                    <div class="flex gap-2">
                        <input id="directLink" readonly class="flex-1 text-sm bg-white border border-gray-300 p-2 rounded text-red-600 font-mono font-bold select-all focus:border-red-500 outline-none text-xs" />
                        <button onclick="copyLink()" class="bg-white border border-gray-300 hover:bg-gray-100 px-3 py-2 rounded text-xs font-bold text-gray-700"><i class="fa-regular fa-copy"></i></button>
                    </div>

                    <div class="mt-3 text-center">
                        <p class="text-[10px] text-gray-400 mb-2">Preview:</p>
                        <img id="previewImg" class="w-full h-40 object-contain rounded bg-white border border-gray-200" />
                    </div>
                </div>
                
                <div class="text-center mt-4">
                    <button onclick="window.location.reload()" class="text-xs text-gray-400 hover:text-red-500 underline">Upload Another</button>
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
                    try { data = JSON.parse(textData); } 
                    catch(e) { throw new Error("Server Error: " + textData.substring(0, 100)); }

                    if(data.error) throw new Error(data.error);

                    // --- 🔥 DATE FIX LOGIC HERE 🔥 ---
                    const rawLink = data.data.media; // Ex: https://thumbsnap.com/i/xyz.jpg
                    
                    // Get Today's Date (MMDD)
                    const now = new Date();
                    const month = String(now.getMonth() + 1).padStart(2, '0'); // 01
                    const day = String(now.getDate()).padStart(2, '0');        // 30
                    const suffix = "?" + month + day; // ?0130

                    // Combine Link + Suffix
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

// 2. Backend Logic (No changes needed, but included for completeness)
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
           const resp = await fetch(body['url']);
           if (!resp.ok) return c.json({ error: "Invalid URL" }, 400);
           imageBuffer = await resp.arrayBuffer();
           originalSize = imageBuffer.byteLength;
       } catch(e) {
           return c.json({ error: "Fetch Error" }, 400);
       }
    } else {
       return c.json({ error: "Please select an image" }, 400);
    }

    // --- Compression ---
    let processedData = new Uint8Array(imageBuffer);
    if (originalSize > 50 * 1024) {
        try {
            const image = await Image.decode(new Uint8Array(imageBuffer));
            let quality = 80;
            const TARGET_MAX = 60 * 1024;
            
            while (quality >= 10) {
                const temp = await image.encodeJPEG(quality);
                if (temp.byteLength <= TARGET_MAX) { processedData = temp; break; }
                processedData = temp;
                quality -= 10;
            }
        } catch (e) {
            console.error("Compression skipped"); 
        }
    }

    // --- UPLOAD (ADULT MODE) ---
    const formData = new FormData();
    formData.append("key", API_KEY);
    formData.append("content", "1"); // Adult
    formData.append("adult", "1");
    formData.append("media", new Blob([processedData], { type: "image/jpeg" }), "upload.jpg");

    const tsResp = await fetch(API_URL, { method: "POST", body: formData });
    const tsText = await tsResp.text();
    let tsResult;
    try { tsResult = JSON.parse(tsText); } 
    catch(e) { return c.json({ error: "Thumbsnap API Error" }, 502); }

    if (!tsResult.success) {
        return c.json({ error: tsResult.error?.message || "Upload Failed" }, 400);
    }

    return c.json({
        success: true,
        data: tsResult.data
    });

  } catch (globalErr) {
    return c.json({ error: globalErr.message }, 500);
  }
});

Deno.serve(app.fetch);
