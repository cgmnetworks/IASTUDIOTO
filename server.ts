import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import AdmZip from "adm-zip";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const app = express();
const PORT = 3000;

const TEMP_UPLOADS = path.join(process.cwd(), ".tmp", "uploads");
const TEMP_JOBS = path.join(process.cwd(), ".tmp", "jobs");

const upload = multer({ dest: TEMP_UPLOADS });

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
    // We use shell: true to correctly resolve 'npm' on all platforms and environments
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

import { existsSync, mkdirSync } from "fs";

// Ensure working directory exists on startup synchronously before any request!
if (!existsSync(TEMP_JOBS)) mkdirSync(TEMP_JOBS, { recursive: true });
if (!existsSync(TEMP_UPLOADS)) mkdirSync(TEMP_UPLOADS, { recursive: true });

// API endpoint to capture the upload and start conversion
app.post("/api/convert", upload.single("projectZip"), async (req, res) => {
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
        // WordPress plugins need relative asset paths as they reside in /wp-content/plugins/...
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
        const pluginName = "aistudio-app";
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
        
        // Write PHP entry file
        const phpPluginPath = path.join(workDir, "aistudio-app.php");
        await fs.writeFile(phpPluginPath, wpPluginCode);

        // Add to zip within folder `aistudio-app/`
        outZipFile.addLocalFolder(distDir, `${pluginDirName}/dist`);
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
app.get("/api/job/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Trabajo no encontrado." });
  }
  // Optional: clear standard noise from npm logs, but we want a terminal feel
  res.json(job);
});

// API endpoint to download the compiled cPanel zip
app.get("/api/download/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || job.status !== "completed" || !job.outZip) {
    return res.status(400).json({ error: "El archivo no está listo para su descarga." });
  }

  res.download(job.outZip, "cpanel_website.zip", (err) => {
    if (!err) {
      // Optional: Cleanup outZip after successful download
      // We might have multiple users hitting this server, so keeping it around temporarily is fine.
      // But clearing it avoids filling disk.
    }
  });
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
    // In production, fallback to generated dist if available
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
