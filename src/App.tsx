/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  UploadCloud, FileType, Terminal, Loader2, CheckCircle, AlertTriangle, 
  Download, Rocket, FileArchive, LayoutTemplate, Link as LinkIcon, 
  MessageCircle, Server, ShoppingBag, Menu, X, Copy, ArrowRight, Lock, LogOut,
  FolderOpen, FileText, Globe
} from "lucide-react";
import { auth, signIn, signOut, db } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, collection, setDoc } from "firebase/firestore";

type JobStatus = "pending" | "extracting" | "installing" | "building" | "completed" | "error";

interface Job {
  id: string;
  status: JobStatus;
  logs: string[];
  error?: string;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("converter");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthenticated(!!currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

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
  const [isGeneratingWa, setIsGeneratingWa] = useState(false);

  // --- Hosting State ---
  const [showHostingModal, setShowHostingModal] = useState(false);
  const [hPlan, setHPlan] = useState<"Básico" | "Pro" | "Master">("Básico");
  const [hName, setHName] = useState("");
  const [hEmail, setHEmail] = useState("");
  const [hDomainType, setHDomainType] = useState<"own" | "subdomain">("subdomain");
  const [hDomain, setHDomain] = useState("");
  const [hSubdomainExt, setHSubdomainExt] = useState("sitiowebpro.com");

  // --- Landing Generator State ---
  const [lPrompt, setLPrompt] = useState("");
  const [lFlyer, setLFlyer] = useState<File | null>(null);
  const [isGeneratingSite, setIsGeneratingSite] = useState(false);
  const [generatedSiteData, setGeneratedSiteData] = useState<{ id: string, html: string } | null>(null);

  const handleFlyerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setLFlyer(e.target.files[0]);
    }
  };

  const generateLanding = async () => {
    if (!lPrompt && !lFlyer) {
      showToast("Por favor, ingresa una descripción o sube una imagen.");
      return;
    }
    
    setIsGeneratingSite(true);
    setGeneratedSiteData(null);
    try {
      const formData = new FormData();
      formData.append("prompt", lPrompt);
      if (lFlyer) {
        formData.append("flyer", lFlyer);
      }
      
      const res = await fetch("/svc/generate-site", { method: "POST", body: formData });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Error generando el sitio. Revisa la consola o intenta de nuevo.");
      }
      const data = await res.json();
      setGeneratedSiteData({ id: data.id, html: data.html });
      
      if (user) {
        const siteId = data.id || Math.random().toString(36).substring(2, 8);
        const userSitesRef = doc(collection(db, 'users', user.uid, 'websites'), siteId);
        await setDoc(userSitesRef, {
          prompt: lPrompt,
          status: "completed",
          createdAt: new Date().toISOString()
        });
      }
      showToast("¡Tu sitio web fue generado con éxito!");
    } catch(e: any) {
      console.error(e);
      showToast(e.message || "Fallo inesperado al generar el sitio.");
    } finally {
      setIsGeneratingSite(false);
    }
  };

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

  const generateWa = async () => {
    if (!waPhone) {
      showToast("Por favor ingresa un número de teléfono válido.");
      return;
    }
    
    setIsGeneratingWa(true);
    try {
      const cleanPhone = waPhone.replace(/\D/g, '');
      const generatedUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMsg)}`;
      
      if (user) {
        const linkId = Math.random().toString(36).substring(2, 8);
        const userLinksRef = doc(collection(db, 'users', user.uid, 'whatsapp_links'), linkId);
        
        await setDoc(userLinksRef, {
          phone: cleanPhone,
          message: waMsg,
          url: generatedUrl,
          createdAt: new Date().toISOString()
        });
        
        setWaLink(`ekit.link/${linkId}`);
        showToast("¡Enlace generado y guardado en tu cuenta!");
      } else {
        setWaLink(generatedUrl);
      }
    } catch(e) {
      console.error(e);
      showToast("Hubo un problema al guardar el enlace.");
    } finally {
      setIsGeneratingWa(false);
    }
  };

  const SIDEBAR_ITEMS = [
    { id: "my-projects", label: "Mis Proyectos", icon: <FolderOpen className="w-5 h-5"/> },
    { id: "converter", label: "Web IA Converter", icon: <FileArchive className="w-5 h-5"/> },
    { id: "landings", label: "Generador Landings", icon: <LayoutTemplate className="w-5 h-5"/> },
    { id: "sales-page", label: "Páginas de Venta/Pago", icon: <ShoppingBag className="w-5 h-5"/> },
    { id: "forms", label: "Creador Formularios", icon: <FileText className="w-5 h-5"/> },
    { id: "biolinks", label: "Creador Bio-Links", icon: <LinkIcon className="w-5 h-5"/> },
    { id: "whatsapp", label: "Generador WhatsApp", icon: <MessageCircle className="w-5 h-5"/> },
    { id: "community-hosting", label: "Hosting Comunitario", icon: <Globe className="w-5 h-5"/> },
    { id: "hosting", label: "Planes Hosting VIP", icon: <Server className="w-5 h-5"/> },
  ];

  const renderConverter = () => (
    <div className="max-w-xl w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-8 animate-in fade-in">
      <header className="text-center space-y-2">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <FileType className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-600 tracking-tight">Web IA Converter</h1>
        <p className="text-gray-500 text-base max-w-lg mx-auto">
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
            className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 ${
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
    <div className="max-w-3xl bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-in fade-in">
      <header className="mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-3 text-gray-800">
          <LayoutTemplate className="w-7 h-7 text-indigo-500"/> Generador de Sitios con IA
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
              value={lPrompt}
              onChange={(e) => setLPrompt(e.target.value)}
            />
          </div>

          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
             <label className="block text-sm font-bold text-gray-800 mb-2">2. Sube un Flyer (Opcional)</label>
             <p className="text-xs text-gray-500 mb-3">Nuestra IA leerá textos, precios y colores de tu imagen.</p>
             <label className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:bg-gray-100 transition-all flex flex-col items-center relative overflow-hidden">
                <UploadCloud className={`w-8 h-8 mb-2 ${lFlyer ? 'text-indigo-500' : 'text-gray-400'}`} />
                <span className={`text-sm font-bold ${lFlyer ? 'text-indigo-700' : 'text-gray-600'}`}>{lFlyer ? lFlyer.name : "Subir Imagen o PDF"}</span>
                <input type="file" className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" accept="image/*,.pdf" onChange={handleFlyerUpload} />
             </label>
          </div>

          <button onClick={generateLanding} disabled={isGeneratingSite || (!lPrompt && !lFlyer)} className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 disabled:opacity-50 text-white font-black rounded-xl hover:opacity-90 transition-all text-lg shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2">
            {isGeneratingSite ? <Loader2 className="w-5 h-5 animate-spin" /> : <Rocket className="w-5 h-5"/>} 
            {isGeneratingSite ? "Generando con IA..." : "Generar Super Sitio Web"}
          </button>
        </div>

        {/* Preview Panel Mockup */}
        <div className="bg-gray-900 rounded-2xl p-4 border-4 border-gray-800 shadow-2xl flex flex-col h-[500px] relative overflow-hidden">
           <div className="flex items-center gap-2 mb-3 z-10 relative">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <div className="ml-4 text-xs font-mono text-gray-400 bg-gray-800 px-3 py-1 rounded-md">Vista Previa AI</div>
           </div>
           
           <div className="flex-1 bg-white rounded-lg flex flex-col relative overflow-hidden group">
              {!generatedSiteData ? (
                 <div className="flex flex-col items-center justify-center h-full opacity-50 p-6 text-center">
                    <LayoutTemplate className="w-16 h-16 text-gray-300 mb-4" />
                    <p className="text-gray-400 font-medium">El sitio generado aparecerá aquí.</p>
                 </div>
              ) : (
                 <iframe srcDoc={generatedSiteData.html} className="w-full h-full border-none" title="Sitio Generado"></iframe>
              )}
              
              {generatedSiteData && (
                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-gray-900/80 to-transparent flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm">
                   <a href={`/svc/download-site/${generatedSiteData.id}`} className="px-6 py-3 bg-white text-indigo-700 font-bold rounded-xl shadow-xl flex items-center gap-2 hover:bg-gray-50 transition-colors">
                     <Download className="w-5 h-5" /> Descargar ZIP cPanel
                   </a>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );

  const renderWhatsApp = () => (
    <div className="max-w-4xl grid md:grid-cols-5 gap-6 animate-in fade-in">
      <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-fit">
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
            <label className="block text-sm font-semibold text-gray-700 mb-1">Mensaje (Opcional)</label>
            <textarea placeholder="Hola..." className="w-full border border-gray-300 rounded-xl p-3 focus:ring-4 focus:ring-green-500/20 outline-none h-24 resize-none" value={waMsg} onChange={e => setWaMsg(e.target.value)} />
          </div>
          <button onClick={generateWa} className="w-full py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 shadow-md">Generar Enlace</button>

          {waLink && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl text-center">
               <span className="block text-green-700 font-medium text-xs mb-3 break-all px-2">{waLink}</span>
               <button onClick={() => {
                 navigator.clipboard.writeText(waLink);
                 alert("¡Enlace de WhatsApp copiado!");
               }} className="w-full p-2 bg-white border border-green-300 text-green-700 rounded-lg shadow-sm font-bold text-sm hover:bg-green-100 transition-colors">Copiar Enlace</button>
            </div>
          )}
        </div>
      </div>

      <div className="md:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
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
    <div className="max-w-6xl animate-in fade-in pb-16 relative">
       {showHostingModal && (
         <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl relative">
              <button onClick={() => setShowHostingModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 bg-gray-50 rounded-full p-2">
                 <X className="w-5 h-5"/>
              </button>
              
              <h2 className="text-2xl font-black text-gray-900 mb-2">Finaliza tu Plan {hPlan}</h2>
              <p className="text-gray-500 text-sm mb-6 pb-6 border-b border-gray-100">Completa tus datos para asignarte el espacio en nuestros servidores.</p>

              <div className="space-y-4 mb-8">
                 <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">Nombre Completo</label>
                   <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" placeholder="Ej. Carlos Granados" value={hName} onChange={(e) => setHName(e.target.value)} />
                 </div>
                 <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">Correo Electrónico</label>
                   <input type="email" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" placeholder="correo@ejemplo.com" value={hEmail} onChange={(e) => setHEmail(e.target.value)} />
                 </div>
                 
                 <div>
                   <label className="block text-sm font-bold text-gray-700 mb-2 mt-4">¿Dominio Propio o Subdominio?</label>
                   <div className="grid grid-cols-2 gap-3 mb-3">
                     <button onClick={() => setHDomainType('own')} className={`py-3 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-colors ${hDomainType === 'own' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        Mío Propio
                     </button>
                     <button onClick={() => setHDomainType('subdomain')} className={`py-3 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-colors relative ${hDomainType === 'subdomain' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        Subdominio
                     </button>
                   </div>
                 </div>

                 {hDomainType === 'own' && (
                    <div className="animate-in slide-in-from-top-2">
                       <label className="block text-sm font-semibold text-gray-600 mb-1">¿Qué dominio vincularás?</label>
                       <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 mb-2" placeholder="ejemplo.com" value={hDomain} onChange={(e) => setHDomain(e.target.value)} />
                       <div className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <p><b>Nota:</b> No vendemos dominios personalizados. Puedes adquirir el tuyo en nuestro <span className="underline font-bold cursor-pointer" onClick={() => {setShowHostingModal(false); setActiveTab('marketplace')}}>Marketplace de afiliados</span> y luego te ayudamos a conectarlo gratis.</p>
                       </div>
                    </div>
                 )}

                 {hDomainType === 'subdomain' && (
                    <div className="animate-in slide-in-from-top-2 flex items-center gap-2">
                       <input type="text" className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="minegocio" value={hDomain} onChange={(e) => setHDomain(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))} />
                       <span className="text-gray-400 font-black">.</span>
                       <select className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700 font-medium cursor-pointer" value={hSubdomainExt} onChange={(e) => setHSubdomainExt(e.target.value)}>
                          <option value="sitiowebpro.com">sitiowebpro.com</option>
                          <option value="websiteya.com">websiteya.com</option>
                          <option value="hostsyte.com">hostsyte.com</option>
                       </select>
                    </div>
                 )}
              </div>

              <div className="flex flex-col gap-3">
                 <button 
                  disabled={!hName || !hEmail || !hDomain}
                  onClick={() => {
                     const targetPrice = hPlan === "Básico" ? 19.97 : hPlan === "Pro" ? 34.97 : 44.97;
                     const finalDomainStr = hDomainType === "subdomain" ? `${hDomain}.${hSubdomainExt}` : hDomain;
                     const item_name = `Hosting ${hPlan} + ${finalDomainStr}`;
                     
                     // Guarda en BD en paralelo
                     try {
                        const orderRef = doc(collection(db, 'hosting_orders'), Date.now().toString());
                        setDoc(orderRef, {
                           name: hName, email: hEmail, plan: hPlan, domain: finalDomainStr,
                           price: targetPrice, status: "pending_paypal", date: new Date().toISOString()
                        });
                        
                        // Envio silencioso del correo usando FormSubmit AJAX
                        fetch("https://formsubmit.co/ajax/info@emprendekitia.com", {
                            method: "POST",
                            headers: { 
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            },
                            body: JSON.stringify({
                                _subject: `Nuevo Pedido de Hosting: ${hPlan}`,
                                name: hName,
                                email: hEmail,
                                message: `El usuario ${hName} (${hEmail}) quiere adquirir el Plan ${hPlan} con el dominio ${finalDomainStr} via PayPal.`
                            })
                        }).catch(err => console.error("Error email backend", err));
                     } catch(err) {
                        console.error('Failed to save to firestore', err);
                     }

                     showToast("Procesando pago seguro...");
                     window.open(`https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=paypal@emprendekitai.com&item_name=${encodeURIComponent(item_name)}&amount=${targetPrice}&currency_code=USD&custom=${encodeURIComponent(hEmail)}`, '_blank');
                  }}
                  className="w-full bg-[#0070ba] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-[#005ea6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md">
                   Pagar con PayPal
                 </button>

                 <button 
                  disabled={!hName || !hEmail || !hDomain}
                  onClick={() => {
                     const finalDomainStr = hDomainType === "subdomain" ? `${hDomain}.${hSubdomainExt}` : hDomain;
                     const msg = `Hola, estos son los datos para el registro del plan hosting ${hPlan}. Nombre: ${hName}, Correo: ${hEmail}, Dominio: ${finalDomainStr}. En espera de las instrucciones de pago.`;
                     
                     // Guarda la orden también como pendiente vía whatsapp
                     try {
                        const orderRef = doc(collection(db, 'hosting_orders'), "wa_" + Date.now().toString());
                        setDoc(orderRef, {
                           name: hName, email: hEmail, plan: hPlan, domain: finalDomainStr,
                           status: "pending_whatsapp", date: new Date().toISOString()
                        });
                     } catch(err) {}

                     window.open(`https://wa.me/50762417266?text=${encodeURIComponent(msg)}`, '_blank');
                  }}
                  className="w-full border-2 border-green-500 text-green-600 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                   <MessageCircle className="w-5 h-5"/> Acordar Pago por WhatsApp
                 </button>
              </div>
           </div>
         </div>
       )}

       <div className="text-center mb-12">
          <h2 className="text-4xl font-black text-gray-900 mb-4">Elige el plan que se adapta a tu momento actual</h2>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Precios reales, sin sorpresas ocultas. Todos los planes incluyen SSL, cPanel y soporte por WhatsApp desde el primer día.
          </p>
       </div>
       <div className="grid lg:grid-cols-3 gap-8 items-start">
          <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm flex flex-col items-center text-center">
             <h3 className="text-2xl font-bold text-gray-900">Básico</h3>
             <p className="text-sm text-gray-500 mt-2 mb-6 h-10">Perfecto para comenzar tu presencia digital</p>
             <div className="mb-6">
                <span className="text-4xl font-black text-gray-900">$19.97</span>
                <span className="text-gray-500 font-medium">/año</span>
                <p className="text-xs text-green-600 font-bold mt-1">Sin costos adicionales</p>
             </div>
             <ul className="space-y-4 mb-8 text-left w-full">
                <li className="flex gap-3 text-sm text-gray-700"><CheckCircle className="w-5 h-5 text-indigo-500 shrink-0"/> Hasta 10 dominios alojados</li>
                <li className="flex gap-3 text-sm text-gray-700"><CheckCircle className="w-5 h-5 text-indigo-500 shrink-0"/> 1 TB SSD NVMe</li>
                <li className="flex gap-3 text-sm text-gray-700"><CheckCircle className="w-5 h-5 text-indigo-500 shrink-0"/> Ancho de banda ilimitado</li>
                <li className="flex gap-3 text-sm text-gray-700"><CheckCircle className="w-5 h-5 text-indigo-500 shrink-0"/> Hasta 10 correos por dominio</li>
                <li className="flex gap-3 text-sm text-gray-700"><CheckCircle className="w-5 h-5 text-indigo-500 shrink-0"/> cPanel incluido</li>
                <li className="flex gap-3 text-sm text-gray-700"><CheckCircle className="w-5 h-5 text-indigo-500 shrink-0"/> SSL Gratis en dominios</li>
                <li className="flex gap-3 text-sm text-gray-700"><CheckCircle className="w-5 h-5 text-indigo-500 shrink-0"/> Seguridad reforzada</li>
                <li className="flex gap-3 text-sm text-gray-700"><CheckCircle className="w-5 h-5 text-indigo-500 shrink-0"/> Soporte técnico WhatsApp</li>
                <li className="flex gap-3 text-sm text-gray-700"><CheckCircle className="w-5 h-5 text-indigo-500 shrink-0"/> Garantía de 7 días</li>
             </ul>
             <button onClick={() => { setHPlan("Básico"); setShowHostingModal(true); }} className="w-full py-4 rounded-xl font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 mt-auto shadow-sm transition-colors border border-indigo-100">Comenzar con Básico →</button>
          </div>

          <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center relative transform lg:-translate-y-4">
             <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-black px-4 py-1 rounded-full text-sm shadow-lg">⭐ Más popular</div>
             <h3 className="text-2xl font-bold text-white mt-4">Pro</h3>
             <p className="text-sm text-indigo-200 mt-2 mb-6 h-10">El preferido por emprendedores y negocios</p>
             <div className="mb-6">
                <span className="text-4xl font-black text-white">$34.97</span>
                <span className="text-indigo-200 font-medium">/año</span>
                <p className="text-xs text-amber-400 font-bold mt-1">Ahorra vs otros hostings</p>
             </div>
             <ul className="space-y-4 mb-8 text-left w-full text-indigo-100">
                <li className="flex gap-3 text-sm"><CheckCircle className="w-5 h-5 text-amber-400 shrink-0"/> Hasta 100 dominios alojados</li>
                <li className="flex gap-3 text-sm"><CheckCircle className="w-5 h-5 text-amber-400 shrink-0"/> 2 TB SSD NVMe</li>
                <li className="flex gap-3 text-sm"><CheckCircle className="w-5 h-5 text-amber-400 shrink-0"/> Ancho de banda ilimitado</li>
                <li className="flex gap-3 text-sm"><CheckCircle className="w-5 h-5 text-amber-400 shrink-0"/> Hasta 100 correos por dominio</li>
                <li className="flex gap-3 text-sm"><CheckCircle className="w-5 h-5 text-amber-400 shrink-0"/> cPanel incluido</li>
                <li className="flex gap-3 text-sm"><CheckCircle className="w-5 h-5 text-amber-400 shrink-0"/> SSL Gratis en dominios</li>
                <li className="flex gap-3 text-sm"><CheckCircle className="w-5 h-5 text-amber-400 shrink-0"/> Seguridad reforzada avanzada</li>
                <li className="flex gap-3 text-sm"><CheckCircle className="w-5 h-5 text-amber-400 shrink-0"/> Soporte prioritario WhatsApp</li>
                <li className="flex gap-3 text-sm"><CheckCircle className="w-5 h-5 text-amber-400 shrink-0"/> Garantía de 7 días</li>
             </ul>
             <button onClick={() => { setHPlan("Pro"); setShowHostingModal(true); }} className="w-full py-4 rounded-xl font-bold bg-white text-indigo-900 hover:bg-gray-100 shadow-lg mt-auto transition-colors">Activar Plan Pro →</button>
          </div>

          <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm flex flex-col items-center text-center">
             <h3 className="text-2xl font-bold text-gray-900">Master</h3>
             <p className="text-sm text-gray-500 mt-2 mb-6 h-10">Recursos ilimitados para agencias y empresas</p>
             <div className="mb-6">
                <span className="text-4xl font-black text-gray-900">$44.97</span>
                <span className="text-gray-500 font-medium">/año</span>
                <p className="text-xs text-indigo-600 font-bold mt-1">La solución completa</p>
             </div>
             <ul className="space-y-4 mb-8 text-left w-full">
                <li className="flex gap-3 text-sm text-gray-700"><CheckCircle className="w-5 h-5 text-indigo-500 shrink-0"/> Dominios ilimitados alojados</li>
                <li className="flex gap-3 text-sm text-gray-700"><CheckCircle className="w-5 h-5 text-indigo-500 shrink-0"/> Almacenamiento NVMe ilimitado</li>
                <li className="flex gap-3 text-sm text-gray-700"><CheckCircle className="w-5 h-5 text-indigo-500 shrink-0"/> Ancho de banda ilimitado</li>
                <li className="flex gap-3 text-sm text-gray-700"><CheckCircle className="w-5 h-5 text-indigo-500 shrink-0"/> Correos ilimitados</li>
                <li className="flex gap-3 text-sm text-gray-700"><CheckCircle className="w-5 h-5 text-indigo-500 shrink-0"/> cPanel incluido</li>
                <li className="flex gap-3 text-sm text-gray-700"><CheckCircle className="w-5 h-5 text-indigo-500 shrink-0"/> SSL Gratis en dominios</li>
                <li className="flex gap-3 text-sm text-gray-700"><CheckCircle className="w-5 h-5 text-indigo-500 shrink-0"/> Seguridad reforzada premium</li>
                <li className="flex gap-3 text-sm text-gray-700"><CheckCircle className="w-5 h-5 text-indigo-500 shrink-0"/> Soporte VIP WA y llamadas</li>
                <li className="flex gap-3 text-sm text-gray-700"><CheckCircle className="w-5 h-5 text-indigo-500 shrink-0"/> Garantía de 7 días</li>
             </ul>
             <button onClick={() => { setHPlan("Master"); setShowHostingModal(true); }} className="w-full py-4 rounded-xl font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 shadow-sm mt-auto transition-colors border border-indigo-100">Activar Plan Master →</button>
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
          onClick={signIn}
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
          onClick={signIn}
          className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-gray-900 text-white font-bold text-lg rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-xl shadow-gray-900/20 animate-in fade-in slide-in-from-bottom-8"
        >
          <span className="relative z-10">Comenzar Gratis Ahora</span>
          <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </button>

        <div className="mt-24 grid md:grid-cols-3 gap-8 max-w-6xl w-full animate-in fade-in slide-in-from-bottom-10" style={{ animationDelay: '200ms' }}>
           <div className="bg-white p-8 rounded-3xl text-left border border-gray-100 shadow-sm hover:shadow-xl transition-all">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6">
                <FileArchive className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Web IA Converter</h3>
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
      case "my-projects": return renderComingSoon("Mis Proyectos", <FolderOpen className="w-12 h-12"/>);
      case "sales-page": return renderComingSoon("Páginas de Venta/Pago", <ShoppingBag className="w-12 h-12"/>);
      case "forms": return renderComingSoon("Creador de Formularios", <FileText className="w-12 h-12"/>);
      case "community-hosting": return renderComingSoon("Lanza tu Proyecto (Grátis)", <Globe className="w-12 h-12"/>);
      case "biolinks": return renderComingSoon("Creador de Bio-Links", <LinkIcon className="w-12 h-12"/>);
      case "marketplace": return renderComingSoon("Marketplace de Utilidades", <ShoppingBag className="w-12 h-12"/>);
      default: return renderConverter();
    }
  };

  const floatingWhatsAppButton = (
    <a href="https://wa.me/50762417266?text=Hola,%20EmprendekitIa,tengo%20una%20consulta%20mi%20nombre%20es%3A%20" target="_blank" rel="noopener noreferrer" className="fixed bottom-6 right-6 bg-[#25D366] text-white p-4 rounded-full shadow-[0_4px_14px_0_rgba(37,211,102,0.39)] hover:scale-110 transition-transform z-50 flex items-center justify-center animate-bounce" title="Soporte WhatsApp">
      <MessageCircle className="w-8 h-8" />
    </a>
  );

  if (isAuthLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        {renderLandingPage()}
        {floatingWhatsAppButton}
      </>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      {floatingWhatsAppButton}
      
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
        {toastMessage && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="font-bold text-sm tracking-wide">{toastMessage}</span>
          </div>
        )}

        <header className="h-16 bg-white border-b border-gray-100 flex items-center px-4 lg:px-8 justify-between lg:justify-end shrink-0">
           <button className="lg:hidden text-gray-500 p-2 rounded-lg hover:bg-gray-100" onClick={() => setIsMobileMenuOpen(true)}>
             <Menu className="w-6 h-6"/>
           </button>
           
           <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-500 hidden sm:block">Plan Gratuito</span>
              {user?.photoURL ? (
                  <img src={user.photoURL} alt="User profile" className="w-9 h-9 rounded-full ring-2 ring-gray-100 shadow-sm" />
              ) : (
                  <div className="w-9 h-9 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-sm border-2 border-white shadow-sm ring-2 ring-gray-100">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
              )}
              <button onClick={signOut} className="text-gray-500 hover:text-red-500 transition-colors p-2" title="Cerrar sesión">
                <LogOut className="w-5 h-5"/>
              </button>
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
