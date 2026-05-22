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

export default function TicketForm({
  clientId,
  clientName,
  clientEmail,
  onTicketSubmitted,
}: TicketFormProps) {
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

  // File loading function to Base64
  const processFiles = (files: FileList) => {
    const loadedFiles: Attachment[] = [];

    Array.from(files).forEach((file) => {
      // Keep files reasonably sized
      if (file.size > 2 * 1024 * 1024) {
        setErrorStatus(`Plik "${file.name}" przekracza limit rozmiaru 2MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setAttachments((prev) => [
            ...prev,
            {
              name: file.name,
              type: file.type || "application/octet-stream",
              size: file.size,
              data: reader.result as string,
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFiles(e.target.files);
    }
  };

  const removeAttachment = (indexToRemove: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setErrorStatus(
        "Proszę podać zarówno tytuł podsumowania, jak i szczegółowy opis.",
      );
      return;
    }
    if (!location) {
      setErrorStatus("Proszę wybrać lokalizację / sklep ze zgłoszenia.");
      return;
    }

    setSubmitting(true);
    setErrorStatus(null);
    setSuccessStatus(null);

    try {
      await onTicketSubmitted({
        title,
        description,
        category,
        priority,
        attachments,
        location,
      });

      // Clear state on successful creation
      setTitle("");
      setLocation("");
      setDescription("");
      setCategory("software");
      setPriority("medium");
      setAttachments([]);
      setSuccessStatus(
        "Twoje zgłoszenie wsparcia IT zostało pomyślnie zarejestrowane i jest śledzone!",
      );

      setTimeout(() => {
        setSuccessStatus(null);
      }, 5000);
    } catch (err: any) {
      setErrorStatus(
        err.message || "Wystąpił błąd podczas rejestrowania zgłoszenia.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 max-w-2xl mx-auto shadow-2xs hover:shadow-xs transition-shadow duration-300">
      <div className="mb-6 pb-4 border-b border-slate-100">
        <h2 className="text-xl font-extrabold font-sans text-slate-900 tracking-tight">
          Wyślij zgłoszenie wsparcia IT
        </h2>
        <p className="text-xs text-slate-500 mt-1.5">
          Zarejestruj swoje problemy techniczne. Inżynierowie wsparcia śledzą
          ten kanał w czasie rzeczywistym.
        </p>
      </div>

      {errorStatus && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl p-4 mb-5 shadow-2xs">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{errorStatus}</span>
        </div>
      )}

      {successStatus && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-150 text-emerald-800 text-xs rounded-xl p-4 mb-5 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
          <span>{successStatus}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="ticket-title"
            className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2"
          >
            Tytuł zgłoszenia / Podsumowanie *
          </label>
          <input
            id="ticket-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            type="text"
            placeholder="np. Brak możliwości ustanowienia bezpiecznego połączenia z bramą VPN"
            className="w-full px-4 py-2.5 text-xs bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-505 focus:ring-1 focus:ring-indigo-500 font-sans text-slate-800 shadow-inner"
            required
          />
        </div>

        <div>
          <label
            htmlFor="ticket-location"
            className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"
          >
            <MapPin className="w-3.5 h-3.5 text-indigo-500" /> Lokalizacja /
            Sklep zgłaszający *
          </label>
          <select
            id="ticket-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-505 focus:ring-1 focus:ring-indigo-500 cursor-pointer text-slate-705 font-sans font-medium"
            required
          >
            <option value="">-- Wybierz lokalizację sklepu --</option>
            {STORE_LOCATIONS.map((loc) => (
              <option key={loc.code} value={loc.code}>
                {loc.code} — {loc.name} ({loc.city})
              </option>
            ))}
          </select>

          {/* Dynamic store detail card */}
          {location &&
            (() => {
              const selectedStore = STORE_LOCATIONS.find(
                (s) => s.code === location,
              );
              if (!selectedStore) return null;
              return (
                <div className="mt-2.5 bg-indigo-50/30 border border-indigo-100/50 rounded-xl p-3.5 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-slate-850 text-[11px]">
                      <Home className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>{selectedStore.name}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 leading-normal ml-5">
                      {selectedStore.address} (Miejscowość: {selectedStore.city}
                      )
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white border border-slate-150 px-2.5 py-1.5 rounded-lg text-[10px] text-slate-500 font-mono select-all self-start sm:self-auto shadow-3xs hover:bg-slate-50 transition-colors">
                    <Mail className="w-3 h-3 text-indigo-500 shrink-0" />
                    <span>{selectedStore.email}</span>
                  </div>
                </div>
              );
            })()}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="ticket-category"
              className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2"
            >
              Kategoria
            </label>
            <select
              id="ticket-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as TicketCategory)}
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-505 cursor-pointer text-slate-705 font-sans"
            >
              <option value="software">
                Oprogramowanie / Dostęp do aplikacji
              </option>
              <option value="hardware">Sprzęt / Wyposażenie</option>
              <option value="network">Sieć / VPN / Internet</option>
              <option value="access">Uprawnienia / Konta / Hasła</option>
              <option value="other">Inne zapytanie</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="ticket-priority"
              className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2"
            >
              Wpływ / Priorytet
            </label>
            <select
              id="ticket-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TicketPriority)}
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-505 cursor-pointer text-slate-705 font-sans"
            >
              <option value="low">Niski (Standardowe zapytanie)</option>
              <option value="medium">Średni (Utrudnia pracę)</option>
              <option value="high">Wysoki (Dział zablokowany)</option>
              <option value="urgent">Pilny (System unieruchomiony)</option>
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="ticket-desc"
            className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2"
          >
            Szczegółowy opis *
          </label>
          <textarea
            id="ticket-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Proszę podać szczegóły diagnostyczne, specyfikację systemu operacyjnego, logi błędów oraz jasne kroki do odtworzenia usterki..."
            className="w-full px-4 py-3 text-xs bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-505 focus:ring-1 focus:ring-indigo-500 font-sans text-slate-800 shadow-inner"
            required
          />
        </div>

        {/* Attachment Drag & Drop Area */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            Załączniki (Logi, zrzuty ekranu)
          </label>
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={triggerFileSelect}
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-7 transition-all cursor-pointer ${
              dragActive
                ? "border-indigo-500 bg-indigo-50/20"
                : "border-slate-200 hover:border-slate-350 bg-slate-50/25 hover:bg-slate-50/60"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <Upload className="w-8 h-8 text-slate-400 mb-2.5" />
            <p className="text-xs font-bold text-slate-707">
              Przeciągnij i upuść pliki tutaj, lub{" "}
              <span className="text-indigo-600 underline">
                przeglądaj pliki
              </span>
            </p>
            <p className="text-[10px] text-slate-400 mt-1.5 font-sans">
              Rozmiar pliku do 2MB każdy. Maksymalnie: 5 plików.
            </p>
          </div>

          {/* Current Attachments List */}
          {attachments.length > 0 && (
            <div className="mt-4 space-y-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Załączono ({attachments.length}):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {attachments.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-707"
                  >
                    <div className="flex items-center gap-2 truncate max-w-[80%]">
                      {file.type.startsWith("image/") ? (
                        <FileImage className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      ) : file.type === "application/pdf" ||
                        file.name.endsWith(".pdf") ? (
                        <FileText className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      ) : file.type.startsWith("text/") ||
                        /\.(log|txt|csv)$/i.test(file.name) ? (
                        <FileCode className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <File className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <span
                        className="truncate font-medium text-[11px]"
                        title={file.name}
                      >
                        {file.name}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">
                        ({(file.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAttachment(idx);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200"
                      aria-label="Remove attachment"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Client identity tags informative line */}
        <div className="border-t border-slate-100 pt-4 flex flex-wrap gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
          <div>
            <span>Zgłaszający:</span>{" "}
            <span className="text-slate-550">
              {clientName} ({clientEmail})
            </span>
          </div>
          <div>
            <span>ID Zgłaszającego:</span>{" "}
            <span className="font-mono text-[9px] bg-slate-100 border border-slate-150 px-1.5 py-0.5 rounded text-slate-600">
              {clientId}
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-indigo-950 border border-slate-900 hover:border-indigo-950 text-white font-bold py-2.5 rounded-xl transition-all cursor-pointer text-xs font-sans shadow-xs active:scale-95 disabled:opacity-50 select-none"
        >
          {submitting ? (
            <span className="inline-block animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4"></span>
          ) : (
            <Paperclip className="w-4 h-4" />
          )}
          <span>
            {submitting
              ? "Rejestrowanie zgłoszenia..."
              : "Wyślij zgłoszenie wsparcia"}
          </span>
        </button>
      </form>
    </div>
  );
}
