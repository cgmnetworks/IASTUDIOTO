import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import AdmZip from "adm-zip";
import { spawn } from "child_process";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

const TEMP_UPLOADS = path.join(process.cwd(), ".tmp", "uploads");
const TEMP_JOBS = path.join(process.cwd(), ".tmp", "jobs");
const TEMP_SITES = path.join(process.cwd(), ".tmp", "sites");

const upload = multer({ dest: TEMP_UPLOADS });

if (!existsSync(TEMP_JOBS)) mkdirSync(TEMP_JOBS, { recursive: true });
if (!existsSync(TEMP_UPLOADS)) mkdirSync(TEMP_UPLOADS, { recursive: true });
if (!existsSync(TEMP_SITES)) mkdirSync(TEMP_SITES, { recursive: true });

const aiConfigs = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

// Job tracking
interface Job {
  id: string;
  status: "pending" | "extracting" | "installing" | "building" | "completed" | "error";
  logs: string[];
  outZip?: string;
  error?: string;
}

const jobs = new Map<string, Job>();

function runCommand(cmd: string, args: string[], cwd: string, onData: (data: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, shell: true });
    
    child.stdout.on("data", (data) => onData(data.toString()));
    child.stderr.on("data", (data) => onData(data.toString()));
    
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`El comando falló con el código de salida ${code}`));
    });

    child.on("error", (err) => {
      reject(err);
    });
  });
}

// Extracted AI Sites logic
app.post("/svc/generate-site", upload.single("flyer"), async (req, res) => {
  if (!aiConfigs) {
     return res.status(500).json({ error: "Gemini API no configurada" });
  }

  const prompt = req.body.prompt || "";
  const file = req.file;
  
  if (!prompt && !file) {
     return res.status(400).json({ error: "Se requiere prompt o imagen para generar." });
  }

  try {
     let parts: any[] = [];
     const systemInstruction = `Eres un experto creador web. Devuelve ESTRICTAMENTE SOLO código HTML con Tailwind CSS embebido (vía CDN <script src="https://cdn.tailwindcss.com"></script>). No devuelvas markdown like \`\`\`html ni ninguna otra palabra extra, solo empieza con <!DOCTYPE html>.`;
     
     parts.push({
        text: `Crea una Landing Page moderna y responsiva basada en lo siguiente: ${prompt}. Genera algo bonito y estructurado que pueda vender la idea.`
     });

     if (file) {
        const fileData = await fs.readFile(file.path);
        const mimeType = file.mimetype || "image/jpeg";
        parts.push({
           inlineData: {
              data: fileData.toString("base64"),
              mimeType: mimeType
           }
        });
     }

     const response = await aiConfigs.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts },
        config: {
           systemInstruction,
           temperature: 0.7
        }
     });

     let html = response.text || "<h1>Error generating content</h1>";
     html = html.replace(/^```html\n/g, '').replace(/```$/g, '').trim();

     const siteId = crypto.randomUUID();
     const siteDir = path.join(TEMP_SITES, siteId);
     await fs.mkdir(siteDir, { recursive: true });
     await fs.writeFile(path.join(siteDir, "index.html"), html);

     const zip = new AdmZip();
     zip.addLocalFile(path.join(siteDir, "index.html"));
     const htaccessContent = `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>`;
     zip.addFile(".htaccess", Buffer.from(htaccessContent, "utf8"));
     
     const zipPath = path.join(siteDir, "landing_page.zip");
     zip.writeZip(zipPath);

     if (file) {
        fs.unlink(file.path).catch(() => {});
     }

     res.json({ id: siteId, html });
  } catch (error: any) {
     console.error("Gemini Error:", error);
     res.status(500).json({ error: "Error en la IA generativa." });
  }
});

app.get("/svc/download-site/:siteId", async (req, res) => {
   const siteId = req.params.siteId;
   const zipPath = path.join(TEMP_SITES, siteId, "landing_page.zip");
   try {
     await fs.access(zipPath);
     res.download(zipPath, "landing_page.zip");
   } catch {
     res.status(404).send("Sitio no encontrado o expirado.");
   }
});

// API endpoint to capture the upload and start conversion
app.post("/svc/convert", upload.single("projectZip"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No se proporcionó ningún archivo." });
  }

  const format = req.body.format === "wordpress" ? "wordpress" : "cpanel";
  const jobId = crypto.randomUUID();
  const zipPath = req.file.path;
  const workDir = path.join(TEMP_JOBS, jobId);
  const srcDir = path.join(workDir, "src");
  const outZip = path.join(workDir, format === "wordpress" ? "wordpress_plugin.zip" : "cpanel_ready.zip");

  jobs.set(jobId, { id: jobId, status: "pending", logs: ["Iniciando trabajo de compilación..."] });
  res.json({ jobId });

  // Process the job asynchronously
  (async () => {
    const log = (msg: string) => {
      const job = jobs.get(jobId);
      if (job) {
        job.logs.push(msg.trim());
        jobs.set(jobId, job);
      }
    };

    const updateStatus = (status: Job["status"]) => {
      const job = jobs.get(jobId);
      if (job) {
        job.status = status;
        jobs.set(jobId, job);
      }
    };

    try {
      await fs.mkdir(srcDir, { recursive: true });
      updateStatus("extracting");
      log("Extrayendo archivo ZIP...");

      const zip = new AdmZip(zipPath);
      zip.extractAllTo(srcDir, true);

      // Helper function to recursively find package.json
      async function findPackageJsonDir(dir: string): Promise<string | null> {
        const items = await fs.readdir(dir, { withFileTypes: true });
        for (const item of items) {
          if (item.isFile() && item.name === "package.json") {
            return dir;
          }
        }
        for (const item of items) {
          if (item.isDirectory() && !item.name.startsWith("__MACOSX") && item.name !== "node_modules") {
            const found = await findPackageJsonDir(path.join(dir, item.name));
            if (found) return found;
          }
        }
        return null;
      }

      const projectRoot = await findPackageJsonDir(srcDir);
      
      if (!projectRoot) {
        throw new Error("No se encontró package.json en el archivo comprimido.");
      }
      
      if (projectRoot !== srcDir) {
        log(`Carpeta raíz detectada: ${path.relative(srcDir, projectRoot)}`);
      }

      updateStatus("installing");
      log("Instalando dependencias (npm install)...");
      await runCommand("npm", ["install"], projectRoot, log);

      updateStatus("building");
      log(`Compilando proyecto (Destino: ${format.toUpperCase()})...`);
      
      if (format === "wordpress") {
        await runCommand("npx", ["vite", "build", "--base=./"], projectRoot, log);
      } else {
        await runCommand("npm", ["run", "build"], projectRoot, log);
      }

      const distDir = path.join(projectRoot, "dist");
      try {
        await fs.access(distDir);
      } catch {
        throw new Error("No se generó la carpeta 'dist'. Posible fallo en la compilación.");
      }

      const outZipFile = new AdmZip();

      if (format === "wordpress") {
        log("Generando estructura de Plugin de WordPress...");
        const pluginDirName = "aistudio-app";
        
        let jsFile = "", cssFile = "";
        try {
          const assetsDir = path.join(distDir, "assets");
          const assets = await fs.readdir(assetsDir);
          jsFile = assets.find(f => f.endsWith(".js")) || "";
          cssFile = assets.find(f => f.endsWith(".css")) || "";
        } catch(e) {
          log("Advertencia: No se pudo leer la carpeta de assets generada.");
        }

         const wpPluginCode = `<?php
/**
 * Plugin Name: AI Studio App Integration
 * Description: Proyecto web generado desde Google AI Studio, insertable en WordPress.
 * Version: 1.0.0
 * Author: AI Studio a cPanel
 */

if (!defined('ABSPATH')) exit; // Exit if accessed directly

function aistudio_app_enqueue_assets() {
    $plugin_url = plugin_dir_url(__FILE__);
    wp_enqueue_script('aistudio-app-js', $plugin_url . 'dist/assets/${jsFile}', array(), '1.0', true);
    ${cssFile ? `wp_enqueue_style('aistudio-app-css', $plugin_url . 'dist/assets/${cssFile}', array(), '1.0');` : ''}
}
add_action('wp_enqueue_scripts', 'aistudio_app_enqueue_assets');

// Ensure Vite ES Modules load correctly in the browser
function aistudio_add_type_attribute($tag, $handle, $src) {
    if ('aistudio-app-js' === $handle) {
        $tag = '<script type="module" crossorigin src="' . esc_url($src) . '"></script>';
    }
    return $tag;
}
add_filter('script_loader_tag', 'aistudio_add_type_attribute', 10, 3);

function aistudio_app_shortcode() {
    return '<div id="root">Cargando aplicación...</div>';
}
// Uso: [aistudio_app]
add_shortcode('aistudio_app', 'aistudio_app_shortcode');
`;
        
        const phpPluginPath = path.join(workDir, "aistudio-app.php");
        await fs.writeFile(phpPluginPath, wpPluginCode);

        outZipFile.addLocalFolder(distDir, pluginDirName + "/dist");
        outZipFile.addLocalFile(phpPluginPath, pluginDirName);
        
        log("Plugin empaquetado correctamente. (Usa el shortcode [aistudio_app])");

      } else {
        log("Agregando .htaccess para cPanel/Apache SPA Routing...");
        const htaccessContent = `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>`;
        await fs.writeFile(path.join(distDir, ".htaccess"), htaccessContent);
        
        log("Comprimiendo carpeta dist/... para descarga");
        outZipFile.addLocalFolder(distDir);
      }

      outZipFile.writeZip(outZip);

      const finalJob = jobs.get(jobId)!;
      finalJob.status = "completed";
      finalJob.outZip = outZip;
      log("¡Conversión exitosa! Tu sitio web está listo.");
      jobs.set(jobId, finalJob);

    } catch (err: any) {
      log(`Error: ${err.message}`);
      const failedJob = jobs.get(jobId)!;
      failedJob.status = "error";
      failedJob.error = err.message;
      jobs.set(jobId, failedJob);
    } finally {
        fs.unlink(zipPath).catch(() => {});
    }
  })();
});

// API endpoint to check job status
app.get("/svc/job/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Trabajo no encontrado." });
  }
  res.json(job);
});

// API endpoint to download the compiled cPanel zip
app.get("/svc/download/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || job.status !== "completed" || !job.outZip) {
    return res.status(400).json({ error: "El archivo no está listo para su descarga." });
  }

  res.download(job.outZip, "cpanel_website.zip");
});

// Integrating Vite for the frontend UI
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const staticPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(staticPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(staticPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Servidor en ejecución en http://localhost:${PORT}`);
  });
}

startServer();
