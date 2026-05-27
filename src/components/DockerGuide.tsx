import React, { useState } from "react";
import { Terminal, Cpu, Database, Command, FileCode, CheckCircle2 } from "lucide-react";

export default function DockerGuide() {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const dockerfileContent = `# ================================================
# Multi-stage production container setup
# ================================================

# --- BUILD STAGE ---
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- RUN STAGE ---
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/src/types.ts ./src/
COPY --from=builder /app/src/dataStore.ts ./src/

# Install build runner dependencies needed for runtime
RUN npm install -g tsx esbuild

# Expose internal router port
EXPOSE 3000

CMD ["node", "dist/server.cjs"]
`;

  const dockerComposeContent = `version: '3.8'

services:
  # 1. Full-stack IT Support Web Application Node.js+Express+WS Backend
  web-app:
    build: .
    container_name: it_support_app
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://support_user:SecureSupportPassword99@db:5432/support_tickets
      - DB_SSL=false
    depends_on:
      db:
        condition: service_healthy
    restart: always

  # 2. Relational Database Instance (PostgreSQL)
  db:
    image: postgres:15-alpine
    container_name: it_support_db
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=support_user
      - POSTGRES_PASSWORD=SecureSupportPassword99
      - POSTGRES_DB=support_tickets
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U support_user -d support_tickets"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: always

  # 3. Web-based Database Administrative Utility (Optional utility)
  pgadmin:
    image: dpage/pgadmin4
    container_name: it_support_pgadmin
    ports:
      - "5050:80"
    environment:
      - PGADMIN_DEFAULT_EMAIL=admin@bagietka.pl
      - PGADMIN_DEFAULT_PASSWORD=AdminPassword_99
    depends_on:
      - db
    restart: always

volumes:
  postgres_data:
`;

  return (
    <div className="bg-white/[0.03] backdrop-blur border border-white/[0.06] rounded-xl p-6 md:p-8 space-y-6">
      <div className="pb-4 border-b border-white/[0.06]">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 tracking-tight">
          <Cpu className="w-4 h-4 text-indigo-400" />
          Wdrożenie Docker + PostgreSQL
        </h2>
        <p className="text-[10px] text-white/30 mt-1.5 tracking-wide">
          Aplikacja jest w pełni skonfigurowana do budowania i wdrażania środowisk wielokontenerowych.
        </p>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { icon: <Database className="w-4 h-4 text-indigo-400" />, title: "Schemat bazy danych", desc: "Relacyjny schemat PostgreSQL obsługujący zgłoszenia, wątki wiadomości i logi powiadomień." },
          { icon: <Terminal className="w-4 h-4 text-amber-400" />, title: "Usługi WebSockets", desc: "Porty automatycznie dostosowane do aktualizacji statusów w czasie rzeczywistym." },
          { icon: <Command className="w-4 h-4 text-emerald-400" />, title: "Gotowy na produkcję", desc: "Wieloetapowe kontenery Alpine Linux redukują rozmiar obrazów i poprawiają bezpieczeństwo." },
        ].map((card) => (
          <div key={card.title} className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-4 flex items-start gap-3">
            <div className="mt-0.5 shrink-0">{card.icon}</div>
            <div>
              <h4 className="text-[10px] font-bold text-white/60">{card.title}</h4>
              <p className="text-[9px] text-white/25 mt-1 leading-relaxed">{card.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Commands */}
      <div className="space-y-3">
        <h3 className="text-[9px] font-bold text-white/25 uppercase tracking-[0.15em]">Polecenia szybkiego startu</h3>
        <div className="bg-[#0d0d14] border border-white/[0.06] rounded-xl p-5 font-mono text-[11px] overflow-x-auto space-y-3 relative">
          <button
            onClick={() => copyToClipboard("docker compose up --build -d", "cmd")}
            className="absolute right-4 top-4 bg-white/[0.05] text-[10px] text-white/40 hover:text-white/70 hover:bg-white/10 px-2.5 py-1 rounded-lg border border-white/[0.06] font-bold cursor-pointer transition-all"
          >
            {copiedText === "cmd" ? "Skopiowano" : "Kopiuj"}
          </button>
          <div className="text-white/20"># 1. Uruchom środowisko (Aplikacja + PostgreSQL + pgAdmin)</div>
          <div className="text-emerald-400 font-bold">docker compose up --build -d</div>
          <div className="text-white/20 pt-1"># 2. Sprawdź logi</div>
          <div className="text-emerald-400 font-bold">docker compose logs -f web-app</div>
          <div className="text-white/20 pt-1.5 font-bold uppercase tracking-wider text-[9px]">Adresy dostępowe:</div>
          <div className="flex flex-col gap-1 pl-2 text-white/40">
            <div><span className="font-bold text-white/60">Portal Wsparcia IT:</span> <a href="http://localhost:3000" className="text-indigo-400 underline" target="_blank" rel="noopener noreferrer">http://localhost:3000</a></div>
            <div><span className="font-bold text-white/60">pgAdmin Panel:</span> <a href="http://localhost:5050" className="text-amber-400 underline" target="_blank" rel="noopener noreferrer">http://localhost:5050</a> <span className="text-white/20 text-xs">(admin@bagietka.pl / AdminPassword_99)</span></div>
          </div>
        </div>
      </div>

      {/* Docker file viewers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {[
          { id: "df", label: "Dockerfile", icon: <FileCode className="w-3 h-3" />, content: dockerfileContent },
          { id: "dc", label: "docker-compose.yml", icon: <Database className="w-3 h-3" />, content: dockerComposeContent },
        ].map((file) => (
          <div key={file.id} className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25 flex items-center gap-1.5">
                {file.icon} {file.label}
              </span>
              <button
                onClick={() => copyToClipboard(file.content, file.id)}
                className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer"
              >
                {copiedText === file.id ? "Skopiowano!" : "Kopiuj kod"}
              </button>
            </div>
            <pre className="p-3.5 bg-[#0d0d14] border border-white/[0.06] rounded-xl text-[9px] font-mono text-white/40 overflow-x-auto max-h-[350px] leading-relaxed">
              {file.content}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
