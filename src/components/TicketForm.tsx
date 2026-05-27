import React, { useState, useRef } from "react";
import { TicketCategory, TicketPriority, Attachment } from "../types";
import { STORE_LOCATIONS } from "../data/stores";
import {
  Upload,
  X,
  Paperclip,
  FileText,
  FileImage,
  FileCode,
  File,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Mail,
  Home,
  Zap,
} from "lucide-react";

interface TicketFormProps {
  clientId: string;
  clientName: string;
  clientEmail: string;
  onTicketSubmitted: (ticketData: {
    title: string;
    description: string;
    category: TicketCategory;
    priority: TicketPriority;
    attachments: Attachment[];
    location?: string;
  }) => Promise<void>;
}

export default function TicketForm({ clientId, clientName, clientEmail, onTicketSubmitted }: TicketFormProps) {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TicketCategory>("software");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [successStatus, setSuccessStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = (files: FileList) => {
    Array.from(files).forEach((file) => {
      if (file.size > 2 * 1024 * 1024) {
        setErrorStatus(`Plik "${file.name}" przekracza limit rozmiaru 2MB.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setAttachments((prev) => [...prev, { name: file.name, type: file.type || "application/octet-stream", size: file.size, data: reader.result as string }]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) processFiles(e.dataTransfer.files);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) processFiles(e.target.files);
  };

  const removeAttachment = (idx: number) => setAttachments((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) { setErrorStatus("Proszę podać zarówno tytuł, jak i opis."); return; }
    if (!location) { setErrorStatus("Proszę wybrać lokalizację / sklep."); return; }

    setSubmitting(true);
    setErrorStatus(null);
    setSuccessStatus(null);
    try {
      await onTicketSubmitted({ title, description, category, priority, attachments, location });
      setTitle(""); setLocation(""); setDescription(""); setCategory("software"); setPriority("medium"); setAttachments([]);
      setSuccessStatus("Zgłoszenie zostało pomyślnie zarejestrowane!");
      setTimeout(() => setSuccessStatus(null), 5000);
    } catch (err: any) {
      setErrorStatus(err.message || "Wystąpił błąd podczas rejestrowania zgłoszenia.");
    } finally {
      setSubmitting(false);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <FileImage className="w-3.5 h-3.5" />;
    if (type.includes("text") || type.includes("json")) return <FileCode className="w-3.5 h-3.5" />;
    if (type.includes("pdf")) return <FileText className="w-3.5 h-3.5" />;
    return <File className="w-3.5 h-3.5" />;
  };

  return (
    <div className="bg-white/[0.03] backdrop-blur border border-white/[0.06] rounded-xl p-6 md:p-8 max-w-2xl mx-auto">
      <div className="mb-6 pb-4 border-b border-white/[0.06]">
        <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <Zap className="w-4 h-4 text-indigo-400" />
          Wyślij zgłoszenie wsparcia IT
        </h2>
        <p className="text-[10px] text-white/30 mt-1.5 tracking-wide">
          Zarejestruj problemy techniczne. Inżynierowie śledzą ten kanał w czasie rzeczywistym.
        </p>
      </div>

      {errorStatus && (
        <div className="mb-4 flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {errorStatus}
        </div>
      )}
      {successStatus && (
        <div className="mb-4 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {successStatus}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Location */}
        <div>
          <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.15em] mb-2">Lokalizacja / Sklep</label>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full px-3 py-2.5 text-xs bg-white/[0.03] border border-white/[0.06] rounded-lg text-white focus:outline-none focus:border-indigo-500/30 focus:ring-1 focus:ring-indigo-500/20 cursor-pointer appearance-none"
          >
            <option value="" className="bg-[#0d0d14]">Wybierz lokalizację...</option>
            {STORE_LOCATIONS.map((store) => (
              <option key={store.code} value={store.code} className="bg-[#0d0d14]">
                {store.code} — {store.name}
              </option>
            ))}
          </select>
          {location && (() => {
            const sel = STORE_LOCATIONS.find((s) => s.code === location);
            if (!sel) return null;
            return (
              <div className="mt-2 p-2.5 bg-white/[0.02] border border-white/[0.04] rounded-lg">
                <div className="flex items-center gap-3 text-[9px] text-white/30">
                  <span className="flex items-center gap-1"><Home className="w-2.5 h-2.5" />{sel.address}</span>
                  <span className="flex items-center gap-1"><Mail className="w-2.5 h-2.5" />{sel.email}</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Title */}
        <div>
          <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.15em] mb-2">Tytuł zgłoszenia</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Krótki opis problemu..."
            className="w-full px-3 py-2.5 text-xs bg-white/[0.03] border border-white/[0.06] rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/30 focus:ring-1 focus:ring-indigo-500/20"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.15em] mb-2">Szczegółowy opis</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Opisz problem szczegółowo..."
            rows={4}
            className="w-full px-3 py-2.5 text-xs bg-white/[0.03] border border-white/[0.06] rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/30 focus:ring-1 focus:ring-indigo-500/20 resize-none"
          />
        </div>

        {/* Category & Priority */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.15em] mb-2">Kategoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TicketCategory)}
              className="w-full px-3 py-2.5 text-xs bg-white/[0.03] border border-white/[0.06] rounded-lg text-white focus:outline-none focus:border-indigo-500/30 cursor-pointer appearance-none"
            >
              <option value="hardware" className="bg-[#0d0d14]">Sprzęt</option>
              <option value="software" className="bg-[#0d0d14]">Oprogramowanie</option>
              <option value="network" className="bg-[#0d0d14]">Sieć / VPN</option>
              <option value="access" className="bg-[#0d0d14]">Uprawnienia</option>
              <option value="other" className="bg-[#0d0d14]">Inne</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.15em] mb-2">Priorytet</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TicketPriority)}
              className="w-full px-3 py-2.5 text-xs bg-white/[0.03] border border-white/[0.06] rounded-lg text-white focus:outline-none focus:border-indigo-500/30 cursor-pointer appearance-none"
            >
              <option value="low" className="bg-[#0d0d14]">Niski</option>
              <option value="medium" className="bg-[#0d0d14]">Średni</option>
              <option value="high" className="bg-[#0d0d14]">Wysoki</option>
              <option value="urgent" className="bg-[#0d0d14]">Pilny</option>
            </select>
          </div>
        </div>

        {/* File upload */}
        <div>
          <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.15em] mb-2">Załączniki</label>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              dragActive ? "border-indigo-500/50 bg-indigo-500/5" : "border-white/10 hover:border-white/20 bg-white/[0.01]"
            }`}
          >
            <Upload className="w-6 h-6 text-white/20 mx-auto mb-2" />
            <p className="text-[10px] text-white/30">Przeciągnij pliki lub kliknij aby wybrać</p>
            <p className="text-[8px] text-white/15 mt-1">Maks. 2MB na plik</p>
            <input ref={fileInputRef} type="file" multiple onChange={handleFileChange} className="hidden" />
          </div>

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {attachments.map((att, idx) => (
                <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-[10px] text-white/50 group">
                  {getFileIcon(att.type)}
                  <span className="truncate max-w-[120px]">{att.name}</span>
                  <button onClick={() => removeAttachment(idx)} className="text-white/20 hover:text-rose-400 transition-colors cursor-pointer ml-1">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3 rounded-xl transition-all cursor-pointer text-sm shadow-lg shadow-indigo-500/20 active:scale-[0.98] disabled:opacity-50 select-none"
        >
          <Zap className="w-4 h-4" />
          {submitting ? "Rejestrowanie..." : "Zarejestruj zgłoszenie"}
        </button>
      </form>
    </div>
  );
}
