/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  UploadCloud, FileType, Terminal, Loader2, CheckCircle, AlertTriangle, 
  Download, Rocket, FileArchive, LayoutTemplate, Link as LinkIcon, 
  MessageCircle, Server, ShoppingBag, Menu, X, Copy, ArrowRight, Lock 
} from "lucide-react";

type JobStatus = "pending" | "extracting" | "installing" | "building" | "completed" | "error";

interface Job {
  id: string;
  status: JobStatus;
  logs: string[];
  error?: string;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState("converter");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // --- Converter State ---
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<"cpanel" | "wordpress">("cpanel");
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // --- WhatsApp State ---
  const [waPhone, setWaPhone] = useState("");
  const [waMsg, setWaMsg] = useState("");
  const [waLink, setWaLink] = useState("");

  // Poll for job status for the converter
  useEffect(() => {
    if (!jobId) return;
    if (job?.status === "completed" || job?.status === "error") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/svc/job/${jobId}`);
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

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [job?.logs]);

  // Converter Handlers
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
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
      const res = await fetch("/svc/convert", { method: "POST", body: formData });
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

  const generateWa = () => {
    const cleanPhone = waPhone.replace(/\D/g,'');
    setWaLink(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMsg)}`);
  };

  const SIDEBAR_ITEMS = [
    { id: "converter", label: "Convertidor de ZIP", icon: <FileArchive className="w-5 h-5"/> },
    { id: "landings", label: "Generador Landings", icon: <LayoutTemplate className="w-5 h-5"/> },
    { id: "biolinks", label: "Creador Bio-Links", icon: <LinkIcon className="w-5 h-5"/> },
    { id: "whatsapp", label: "Generador WhatsApp", icon: <MessageCircle className="w-5 h-5"/> },
    { id: "hosting", label: "Planes Hosting", icon: <Server className="w-5 h-5"/> },
    { id: "marketplace", label: "Marketplace / Recursos", icon: <ShoppingBag className="w-5 h-5"/> },
  ];

  const renderConverter = () => (
    <div className="max-w-2xl w-full bg-white rounded-3xl shadow-sm border border-gray-100 p-8 space-y-8 animate-in fade-in">
      <header className="text-center space-y-2">
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 scale-110">
          <FileType className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-600 tracking-tight">Convertidor IA</h1>
        <p className="text-gray-500 text-lg max-w-lg mx-auto">
          Convierte archivos <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded-md text-sm">.zip</span> de IA Studio a sitios HTML o Plugins de WP.
        </p>
      </header>

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
                {file ? <span className="text-blue-600 font-semibold">{file.name}</span> : <span className="font-semibold">Haz clic para subir</span>}
                {!file && " o arrastra y suelta el archivo aquí"}
              </p>
              <p className="text-xs text-gray-400 mt-2">Formatos aceptados: .zip</p>
            </div>
            <input type="file" className="hidden" accept=".zip" onChange={handleFileChange} />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setFormat("cpanel")} className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${format === "cpanel" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300 text-gray-500"}`}>
              <span className="font-bold text-lg">Hacia cPanel / HTML</span>
              <span className="text-xs mt-1 text-center opacity-80">Ideal Hostinger o Vercel</span>
            </button>
            <button onClick={() => setFormat("wordpress")} className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${format === "wordpress" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300 text-gray-500"}`}>
              <span className="font-bold text-lg">Plugin WordPress</span>
              <span className="text-xs mt-1 text-center opacity-80">Incluirlo vía Shortcode</span>
            </button>
          </div>

          <button onClick={startConversion} disabled={!file} className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-xl font-bold transition-all flex justify-center items-center gap-2">
            {file ? "Comenzar Compilación" : "Selecciona un archivo primero"}
          </button>
        </div>
      )}

      {jobId && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between bg-white px-5 py-4 rounded-t-xl border border-b-0 border-gray-200">
            <div className="flex items-center gap-3 text-gray-800">
              {job?.status === "error" && <AlertTriangle className="w-6 h-6 text-red-500" />}
              {job?.status === "completed" && <CheckCircle className="w-6 h-6 text-green-500" />}
              {(job?.status !== "error" && job?.status !== "completed") && <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />}
              <span className="text-base font-bold">
                {job?.status === "completed" ? "¡Todo listo! Tu sitio ha sido empaquetado exitosamente." : job?.status === "error" ? "Hubo un error al compilar." : "Procesando, por favor espera..."}
              </span>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-b-xl p-6 shadow-sm space-y-6">
            <div className="mx-auto max-w-lg mb-6">
              <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-lg border border-gray-100 bg-black">
                <iframe className="absolute top-0 left-0 w-full h-full" src="https://www.youtube.com/embed/WFyIzu-L0aM?autoplay=1" title="YouTube" frameBorder="0" allowFullScreen></iframe>
              </div>
            </div>

            <div className="p-6 bg-gradient-to-br from-indigo-50 to-blue-100 border border-indigo-200 rounded-2xl text-center shadow-inner cursor-pointer" onClick={() => setActiveTab('hosting')}>
              <h3 className="text-indigo-900 font-extrabold text-xl mb-2">🔥 ¿Aún no tienes dónde alojar tu web?</h3>
              <p className="text-indigo-700 text-sm mb-5 font-medium max-w-sm mx-auto">Descubre nuestros planes de hosting asociados optimizados para lo que construyes con EmprendeKit IA.</p>
              <span className="inline-flex py-3 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-lg rounded-xl shadow-md transition-transform transform hover:scale-105">Ver Ofertas Exclusivas</span>
            </div>

            {job?.status === "error" && (
              <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 font-mono text-sm leading-relaxed overflow-x-auto">
                <span className="font-bold">Detalles:</span><br/>{job.error || "Fallo desconocido."}
              </div>
            )}
          </div>

          <div className="pt-4 space-y-3">
            {job?.status === "completed" && (
              <a href={`/svc/download/${jobId}`} className="w-full py-4 px-6 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold transition-all flex justify-center items-center gap-2 shadow-lg shadow-green-500/20">
                <Download className="w-5 h-5" /> Descargar sitio web (.zip)
              </a>
            )}
            {(job?.status === "completed" || job?.status === "error") && (
              <button onClick={() => window.location.reload()} className="w-full py-3 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-all">Convertir otro archivo</button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderLandings = () => (
    <div className="max-w-4xl bg-white rounded-3xl shadow-sm border border-gray-100 p-8 animate-in fade-in">
      <header className="mb-8">
        <h2 className="text-3xl font-bold flex items-center gap-3 text-gray-800">
          <LayoutTemplate className="w-8 h-8 text-indigo-500"/> Generador de Sitios con IA
        </h2>
        <p className="text-gray-500 mt-2">
          Convierte una idea, los datos de un negocio en Google Maps, o hasta un <span className="font-bold text-indigo-500">Flyer de imagen</span> en un sitio web completo, funcional y listo para cPanel.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
            <label className="block text-sm font-bold text-indigo-900 mb-2">1. ¿De qué trata el negocio?</label>
            <p className="text-xs text-indigo-700 mb-3">Pega la descripción, idea, o los datos copiados de Google Maps.</p>
            <textarea 
              placeholder="Ej: Es una pizzería llamada 'Don Luigi' en Ciudad de México, abierta de 9 a 9..." 
              className="w-full border-none rounded-xl p-4 ring-2 ring-indigo-200 focus:ring-indigo-500 outline-none h-32 transition-all resize-none bg-white"
            />
          </div>

          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
             <label className="block text-sm font-bold text-gray-800 mb-2">2. Sube un Flyer (Opcional)</label>
             <p className="text-xs text-gray-500 mb-3">Nuestra IA leerá textos, precios y colores de tu imagen.</p>
             <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:bg-gray-100 transition-all flex flex-col items-center">
                <UploadCloud className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm font-bold text-gray-600">Subir Imagen o PDF</span>
             </div>
          </div>

          <button className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black rounded-xl hover:opacity-90 transition-all text-lg shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2">
            <Rocket className="w-5 h-5"/> Generar Super Sitio Web
          </button>
        </div>

        {/* Preview Panel Mockup */}
        <div className="bg-gray-900 rounded-2xl p-4 border-4 border-gray-800 shadow-2xl flex flex-col h-[500px]">
           <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <div className="ml-4 text-xs font-mono text-gray-400 bg-gray-800 px-3 py-1 rounded-md">Vista Previa - pizza-don-luigi.html</div>
           </div>
           
           <div className="flex-1 bg-white rounded-lg flex flex-col items-center justify-center text-center p-6 opacity-50 relative overflow-hidden group">
              <LayoutTemplate className="w-16 h-16 text-gray-300 mb-4" />
              <p className="text-gray-400 font-medium">El sitio generado aparecerá aquí.</p>
              
              <div className="absolute inset-0 bg-indigo-900/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm">
                 <button className="px-6 py-3 bg-white text-indigo-700 font-bold rounded-xl shadow-xl flex items-center gap-2">
                   <Download className="w-5 h-5" /> Descargar ZIP cPanel
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );

  const renderWhatsApp = () => (
    <div className="max-w-4xl grid md:grid-cols-5 gap-6 animate-in fade-in">
      <div className="md:col-span-2 bg-white rounded-3xl shadow-sm border border-gray-100 p-8 h-fit">
        <header className="mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-3 text-gray-800"><MessageCircle className="w-6 h-6 text-green-500"/> Enlaces WA</h2>
          <p className="text-gray-500 mt-2 text-sm">Crea tu link e intercepta las analíticas.</p>
        </header>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Teléfono</label>
            <input type="text" placeholder="5215555555555" className="w-full border border-gray-300 rounded-xl p-3 focus:ring-4 focus:ring-green-500/20 outline-none" value={waPhone} onChange={e => setWaPhone(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Mensaje</label>
            <textarea placeholder="Hola..." className="w-full border border-gray-300 rounded-xl p-3 focus:ring-4 focus:ring-green-500/20 outline-none h-24 resize-none" value={waMsg} onChange={e => setWaMsg(e.target.value)} />
          </div>
          <button onClick={generateWa} className="w-full py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 shadow-md">Acortar y Rastrear</button>

          {waLink && (
            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-xl text-center">
               <span className="block text-indigo-600 font-bold text-sm mb-2">ekit.link/pizza-luigi</span>
               <button className="w-full p-2 bg-white border border-gray-300 rounded-lg shadow-sm font-bold text-sm">Copiar Enlace</button>
            </div>
          )}
        </div>
      </div>

      <div className="md:col-span-3 bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
         <h3 className="text-lg font-bold text-gray-800 mb-6 border-b pb-4">Panel de Estadísticas (Demo)</h3>
         
         <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="p-5 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border border-gray-200">
               <div className="text-gray-500 text-sm font-bold mb-1">Total Clics (Este mes)</div>
               <div className="text-4xl font-black text-gray-900">1,204</div>
               <div className="text-green-500 text-xs font-bold mt-2">↑ +14% vs mes anterior</div>
            </div>
            <div className="p-5 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border border-gray-200">
               <div className="text-gray-500 text-sm font-bold mb-1">Dispositivo Movil</div>
               <div className="text-4xl font-black text-gray-900">89%</div>
               <div className="text-gray-400 text-xs font-bold mt-2">Smartphones</div>
            </div>
         </div>

         <div className="space-y-4">
            <h4 className="font-bold text-sm text-gray-500 uppercase tracking-wider">Top Países</h4>
            <div className="space-y-3">
               <div className="flex items-center gap-3">
                  <span className="text-xl">🇲🇽</span>
                  <div className="flex-1 bg-gray-100 h-2 rounded-full overflow-hidden">
                     <div className="bg-green-500 h-full w-[65%] rounded-full"></div>
                  </div>
                  <span className="font-bold text-sm text-gray-700">65%</span>
               </div>
               <div className="flex items-center gap-3">
                  <span className="text-xl">🇨🇴</span>
                  <div className="flex-1 bg-gray-100 h-2 rounded-full overflow-hidden">
                     <div className="bg-green-400 h-full w-[20%] rounded-full"></div>
                  </div>
                  <span className="font-bold text-sm text-gray-700">20%</span>
               </div>
               <div className="flex items-center gap-3">
                  <span className="text-xl">🇪🇸</span>
                  <div className="flex-1 bg-gray-100 h-2 rounded-full overflow-hidden">
                     <div className="bg-green-300 h-full w-[10%] rounded-full"></div>
                  </div>
                  <span className="font-bold text-sm text-gray-700">10%</span>
               </div>
            </div>
         </div>
      </div>
    </div>
  );

  const renderHosting = () => (
    <div className="max-w-4xl animate-in fade-in pt-4">
       <div className="bg-gradient-to-br from-indigo-700 to-purple-800 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl"></div>
          
          <span className="inline-flex items-center gap-2 bg-indigo-900/50 text-indigo-200 text-sm font-bold px-4 py-2 rounded-full mb-6 relative z-10 backdrop-blur-sm border border-indigo-500/30">
            <Rocket className="w-4 h-4" /> Alianza Exclusiva EmprendeKit IA
          </span>
          <h2 className="text-4xl lg:text-5xl font-black mb-6 leading-tight relative z-10">Lanza Tu Proyecto <br/>a las Ligas Mayores</h2>
          <p className="text-indigo-200 mb-10 max-w-xl text-lg relative z-10 leading-relaxed">
            Hemos negociado los mejores planes de alojamiento para las webs que extraes desde nuestra herramienta. Servidores ultra-rápidos optimizados para negocios digitales.
          </p>
          
          <div className="grid md:grid-cols-2 gap-6 text-gray-900 relative z-10">
             <div className="bg-white rounded-3xl p-8 shadow-xl transform transition-transform hover:-translate-y-2">
                <div className="flex justify-between items-start mb-4">
                  <div className="text-xl font-bold text-gray-800">Plan Starter Web</div>
                  <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-md uppercase">Oferta</span>
                </div>
                <div className="text-4xl font-black text-indigo-600 mb-2">$2.99<span className="text-lg font-medium text-gray-500">/mes</span></div>
                <p className="text-gray-500 text-sm mb-6 border-b pb-6">Perfecto para tu primer proyecto web o landing page.</p>
                
                <ul className="space-y-4 mb-8">
                   <li className="flex gap-3 items-center font-medium text-gray-700"><CheckCircle className="w-5 h-5 text-green-500"/> Dominio Gratuito 1 año</li>
                   <li className="flex gap-3 items-center font-medium text-gray-700"><CheckCircle className="w-5 h-5 text-green-500"/> SSL Integrado Siempre</li>
                   <li className="flex gap-3 items-center font-medium text-gray-700"><CheckCircle className="w-5 h-5 text-green-500"/> cPanel Fácil de Usar</li>
                   <li className="flex gap-3 items-center font-medium text-gray-700"><CheckCircle className="w-5 h-5 text-green-500"/> Correos Profesionales</li>
                </ul>
                <a href="https://www.hostinger.es/?referido=prueba-ia-converter" target="_blank" rel="noreferrer" className="block text-center w-full bg-indigo-600 text-white font-bold text-lg py-4 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">Reclamar Descuento</a>
             </div>
             
             <div className="bg-indigo-50 border-2 border-indigo-200 rounded-3xl p-8 shadow-xl transform transition-transform hover:-translate-y-2 opacity-90">
                <div className="flex justify-between items-start mb-4">
                  <div className="text-xl font-bold text-gray-800">Negocios Pro</div>
                </div>
                <div className="text-4xl font-black text-gray-800 mb-2">$5.99<span className="text-lg font-medium text-gray-500">/mes</span></div>
                <p className="text-gray-600 text-sm mb-6 border-b border-indigo-200 pb-6">Para agencias, WordPress y tiendas en línea con más tráfico.</p>
                
                <ul className="space-y-4 mb-8">
                   <li className="flex gap-3 items-center font-medium text-gray-700"><CheckCircle className="w-5 h-5 text-indigo-500"/> 100 Sitios Web Incluidos</li>
                   <li className="flex gap-3 items-center font-medium text-gray-700"><CheckCircle className="w-5 h-5 text-indigo-500"/> Rendimiento Mejorado</li>
                   <li className="flex gap-3 items-center font-medium text-gray-700"><CheckCircle className="w-5 h-5 text-indigo-500"/> Backups Diarios Automáticos</li>
                   <li className="flex gap-3 items-center font-medium text-gray-700"><CheckCircle className="w-5 h-5 text-indigo-500"/> CDN para Velocidad Global</li>
                </ul>
                <a href="https://www.hostinger.es/?referido=prueba-ia-converter" target="_blank" rel="noreferrer" className="block text-center w-full bg-white text-indigo-700 border-2 border-indigo-200 font-bold text-lg py-4 rounded-xl hover:bg-indigo-100 transition-colors">Ver Detalles del Plan</a>
             </div>
          </div>
       </div>
    </div>
  );

  const renderComingSoon = (title: string, icon: any) => (
    <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-gray-100 shadow-sm text-center min-h-[500px] animate-in fade-in max-w-2xl">
       <div className="w-24 h-24 bg-indigo-50 text-indigo-400 rounded-full flex items-center justify-center mb-6">
          {icon}
       </div>
       <h2 className="text-3xl font-bold text-gray-800 mt-2 mb-4">{title}</h2>
       <p className="text-gray-500 max-w-md mx-auto text-lg leading-relaxed">
         Esta herramienta es el siguiente paso en nuestra hoja de ruta. Estamos trabajando duro para habilitarla en la próxima gran actualización de EmprendeKit IA.
       </p>
       <div className="mt-8 px-6 py-2.5 bg-indigo-100 text-indigo-700 font-bold rounded-full text-sm inline-flex items-center gap-2">
         <Rocket className="w-4 h-4"/> ¡Muy Pronto Disponible!
       </div>
    </div>
  );

  const renderLandingPage = () => (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans selection:bg-indigo-200">
      <nav className="flex items-center justify-between p-6 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-md">
            E<span className="text-indigo-200">K</span>
          </div>
          <span className="text-xl font-black text-gray-800 tracking-tight">EmprendeKit <span className="text-indigo-600 font-bold">IA</span></span>
        </div>
        <button 
          onClick={() => setIsAuthenticated(true)}
          className="flex items-center gap-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 px-5 py-2.5 rounded-full font-bold transition-all shadow-sm"
        >
          <Lock className="w-4 h-4" /> Entrar al Panel
        </button>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-700 font-bold text-sm mb-8 animate-in fade-in slide-in-from-bottom-4">
           <Rocket className="w-4 h-4" /> La revolución de las herramientas indie
        </div>
        
        <h1 className="text-5xl md:text-7xl font-black text-gray-900 tracking-tight max-w-4xl leading-tight mb-6 animate-in fade-in slide-in-from-bottom-5">
          Tu Negocio Digital, <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
            Lanzado en Minutos.
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-gray-500 max-w-2xl mb-10 animate-in fade-in slide-in-from-bottom-6">
          Olvídate de la barrera técnica. Convierte proyectos de Inteligencia Artificial en webs reales, genera links de WhatsApp con analíticas y administra tu ecosistema desde un solo lugar.
        </p>
        
        <button 
          onClick={() => setIsAuthenticated(true)}
          className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-gray-900 text-white font-bold text-lg rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-xl shadow-gray-900/20 animate-in fade-in slide-in-from-bottom-8"
        >
          <span className="relative z-10">Comenzar Gratis Ahora</span>
          <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </button>

        <div className="mt-24 grid md:grid-cols-3 gap-8 max-w-6xl w-full animate-in fade-in slide-in-from-bottom-10" style={{ animationDelay: '200ms' }}>
           <div className="bg-white p-8 rounded-3xl text-left border border-gray-100 shadow-sm hover:shadow-xl transition-all">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                <FileArchive className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Convertidor IA a Web</h3>
              <p className="text-gray-500 leading-relaxed">Sube el ZIP que te generó Google AI Studio o ChatGPT y obten los archivos para cPanel o un Plugin de WordPress instantáneamente.</p>
           </div>

           <div className="bg-white p-8 rounded-3xl text-left border border-gray-100 shadow-sm hover:shadow-xl transition-all">
              <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-6">
                <MessageCircle className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Links Rastreables WA</h3>
              <p className="text-gray-500 leading-relaxed">Genera links limpios para tu WhatsApp con mensajes pre-escritos e intercepta estadísticas reales de clicks y ubicaciones geográficas.</p>
           </div>

           <div className="bg-white p-8 rounded-3xl text-left border border-gray-100 shadow-sm hover:shadow-xl transition-all relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4">
                 <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-md">PRO PRONTO</span>
              </div>
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-6">
                <LayoutTemplate className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Constructor desde Imagen</h3>
              <p className="text-gray-500 leading-relaxed">Sube el volante (Flyer) de un negocio y deja que la Inteligencia Artificial analice los datos y construya una "Landing Page" profesional.</p>
           </div>
        </div>
      </main>
    </div>
  );

  const renderContent = () => {
    switch(activeTab) {
      case "converter": return renderConverter();
      case "whatsapp": return renderWhatsApp();
      case "hosting": return renderHosting();
      case "landings": return renderLandings();
      case "biolinks": return renderComingSoon("Creador de Bio-Links", <LinkIcon className="w-12 h-12"/>);
      case "marketplace": return renderComingSoon("Marketplace de Utilidades", <ShoppingBag className="w-12 h-12"/>);
      default: return renderConverter();
    }
  };

  if (!isAuthenticated) {
    return renderLandingPage();
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed inset-y-0 left-0 bg-white border-r border-gray-100 w-72 z-50 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 flex flex-col ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-md">
                E<span className="text-indigo-200">K</span>
             </div>
             <div>
               <h1 className="text-lg font-black text-gray-800 tracking-tight">EmprendeKit</h1>
               <span className="text-xs font-bold text-indigo-600 tracking-wider">PLATAFORMA IA</span>
             </div>
          </div>
          <button className="lg:hidden text-gray-500 hover:bg-gray-100 p-2 rounded-lg" onClick={() => setIsMobileMenuOpen(false)}>
             <X className="w-5 h-5"/>
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
           {SIDEBAR_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                 <button
                    key={item.id}
                    onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-medium transition-all text-left ${
                       isActive 
                          ? "bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/50" 
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                 >
                    <div className={isActive ? "text-indigo-600" : "text-gray-400"}>
                       {item.icon}
                    </div>
                    {item.label}
                 </button>
              )
           })}

           <div className="mt-8 pt-8 border-t border-gray-100 p-4">
              <div className="bg-gradient-to-b from-indigo-50 to-purple-50 rounded-2xl p-5 border border-indigo-100 text-center">
                 <Rocket className="w-8 h-8 text-indigo-500 mx-auto mb-3" />
                 <h4 className="font-bold text-indigo-900 mb-1 text-sm">Actualiza a PRO</h4>
                 <p className="text-xs text-indigo-700 mb-4 px-2">Desbloquea exportaciones ilimitadas y marca blanca.</p>
                 <button className="w-full bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white border border-indigo-200 font-bold text-sm py-2 rounded-lg transition-colors">Ver Planes</button>
              </div>
           </div>
        </nav>
      </aside>

      {/* Main Content Dashboard */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-gray-50/50 relative">
        <header className="h-16 bg-white border-b border-gray-100 flex items-center px-4 lg:px-8 justify-between lg:justify-end shrink-0">
           <button className="lg:hidden text-gray-500 p-2 rounded-lg hover:bg-gray-100" onClick={() => setIsMobileMenuOpen(true)}>
             <Menu className="w-6 h-6"/>
           </button>
           
           <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-500 hidden sm:block">Plan Gratuito</span>
              <div className="w-9 h-9 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-sm border-2 border-white shadow-sm ring-2 ring-gray-100 cursor-pointer">
                US
              </div>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
           <div className="max-w-6xl mx-auto">
             {renderContent()}
           </div>
        </div>
      </main>

    </div>
  );
}
