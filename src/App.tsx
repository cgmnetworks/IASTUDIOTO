/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { UploadCloud, FileType, Terminal, Loader2, CheckCircle, AlertTriangle, Download } from "lucide-react";

type JobStatus = "pending" | "extracting" | "installing" | "building" | "completed" | "error";

interface Job {
  id: string;
  status: JobStatus;
  logs: string[];
  error?: string;
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<"cpanel" | "wordpress">("cpanel");
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Poll for job status
  useEffect(() => {
    if (!jobId) return;
    
    // Check if we are done polling
    if (job?.status === "completed" || job?.status === "error") {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/job/${jobId}`);
        if (res.ok) {
          const data = await res.json();
          setJob(data);
        }
      } catch (err) {
        console.error("Fallo obteniendo estado", err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [jobId, job?.status]);

  // Scroll terminal automatically
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [job?.logs]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setUploadError(null);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      if (selectedFile.name.endsWith(".zip")) {
        setFile(selectedFile);
        resetState();
      } else {
        setUploadError("Por favor sube un archivo con extensión .zip");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.endsWith(".zip")) {
        setFile(selectedFile);
        resetState();
      } else {
        setUploadError("El archivo debe ser un .zip");
      }
    }
  };

  const resetState = () => {
    setJobId(null);
    setJob(null);
    setUploadError(null);
  };

  const startConversion = async () => {
    if (!file) return;

    setUploadError(null);
    const formData = new FormData();
    formData.append("projectZip", file);
    formData.append("format", format);

    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `Error del servidor: ${res.status}` }));
        throw new Error(errData.error || "No se pudo iniciar el proceso");
      }

      const data = await res.json();
      setJobId(data.jobId);
    } catch (err: any) {
      setUploadError(err.message || "Uh oh! Hubo un problema al subir el archivo.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 p-8 space-y-8">
        
        <header className="text-center space-y-2">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 scale-110">
            <FileType className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-600 tracking-tight">IASTUDIOTO</h1>
          <p className="text-gray-500 text-lg max-w-lg mx-auto">
            Convierte los archivos <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded-md text-sm">.zip</span> de tus proyectos creados con AI Studio en sitios HTML puros o Plugins de WordPress en segundos.
          </p>
        </header>

        {/* Upload Zone */}
        {!jobId && (
          <div className="space-y-6">
            
            {uploadError && (
              <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="font-medium text-sm">{uploadError}</p>
              </div>
            )}

            <label
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 ${
                isDragging ? "bg-blue-50 border-blue-400" : "bg-gray-50 border-gray-300 hover:bg-gray-100"
              }`}
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                <UploadCloud className={`w-12 h-12 mb-4 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
                <p className="mb-2 text-sm text-gray-500 font-medium">
                  {file ? (
                    <span className="text-blue-600 font-semibold">{file.name}</span>
                  ) : (
                    <span className="font-semibold">Haz clic para subir</span>
                  )}
                  {!file && " o arrastra y suelta el archivo aquí"}
                </p>
                <p className="text-xs text-gray-400 mt-2">Formatos aceptados: .zip</p>
              </div>
              <input type="file" className="hidden" accept=".zip" onChange={handleFileChange} />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setFormat("cpanel")}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                  format === "cpanel" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300 text-gray-500"
                }`}
              >
                <span className="font-bold text-lg">cPanel / Host HTML</span>
                <span className="text-xs mt-1 text-center opacity-80">Ideal para Hostinger, cPanel o Vercel</span>
              </button>
              
              <button
                onClick={() => setFormat("wordpress")}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                  format === "wordpress" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300 text-gray-500"
                }`}
              >
                <span className="font-bold text-lg">Plugin WordPress</span>
                <span className="text-xs mt-1 text-center opacity-80">Incluirlo vía Shortcode en WP</span>
              </button>
            </div>

            <button
              onClick={startConversion}
              disabled={!file}
              className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-xl font-bold transition-all flex justify-center items-center gap-2"
            >
              {file ? "Comenzar Compilación" : "Selecciona un archivo primero"}
            </button>
          </div>
        )}

        {/* Output & Progress */}
        {jobId && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between bg-white px-5 py-4 rounded-t-xl border border-b-0 border-gray-200">
              <div className="flex items-center gap-3 text-gray-800">
                {job?.status === "error" && <AlertTriangle className="w-6 h-6 text-red-500" />}
                {job?.status === "completed" && <CheckCircle className="w-6 h-6 text-green-500" />}
                {(job?.status !== "error" && job?.status !== "completed") && (
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                )}
                <span className="text-base font-bold">
                  {job?.status === "completed" 
                    ? "¡Todo listo! Tu sitio ha sido empaquetado exitosamente." 
                    : job?.status === "error" 
                    ? "Hubo un error al compilar el proyecto."
                    : "Procesando tu archivo, por favor espera un momento..."}
                </span>
              </div>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-b-xl p-6 shadow-sm space-y-6">
              
              {/* YouTube Embedding */}
              <div className="mx-auto max-w-lg mb-6">
                <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-lg border border-gray-100 bg-black">
                  <iframe
                    className="absolute top-0 left-0 w-full h-full"
                    src="https://www.youtube.com/embed/WFyIzu-L0aM?autoplay=1"
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  ></iframe>
                </div>
              </div>

              {/* Referral Ad Block */}
              <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 rounded-2xl text-center shadow-inner">
                <h3 className="text-blue-900 font-extrabold text-xl mb-2">🔥 ¿Aún no tienes dónde alojar tu sitio?</h3>
                <p className="text-blue-700 text-sm mb-5 font-medium max-w-sm mx-auto">
                  Aprovecha nuestra alianza estratégica y obtén un increíble descuento para tu plan de Hosting y Dominio. 
                </p>
                <a 
                  href="https://www.hostinger.es/?referido=prueba-ia-converter" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-flex py-3 px-8 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-lg rounded-xl shadow-lg transition-transform transform hover:scale-105 hover:-translate-y-1"
                >
                  Obtener Descuento Exclusivo
                </a>
              </div>

              {job?.status === "error" && (
                <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 font-mono text-sm leading-relaxed overflow-x-auto">
                  <span className="font-bold">Detalles del Error:</span><br/>
                  {job.error || "Error desconocido o fallo en la instalación de paquetes. Revisa la integridad del .zip"}
                </div>
              )}
            </div>

            {/* Actions for Complete/Error */}
            <div className="pt-4 space-y-3">
              {job?.status === "completed" && (
                <a
                  href={`/api/download/${jobId}`}
                  className="w-full py-4 px-6 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-all flex justify-center items-center gap-2 outline-none focus:ring-4 focus:ring-green-500/20 shadow-lg shadow-green-500/20"
                >
                  <Download className="w-5 h-5" />
                  Descargar sitio web (.zip)
                </a>
              )}

              {(job?.status === "completed" || job?.status === "error") && (
                <button
                  onClick={() => window.location.reload()}
                  className="w-full py-3 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-all"
                >
                  Convertir otro proyecto
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
