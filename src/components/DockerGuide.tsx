import React, { useState } from 'react';
import { Terminal, Cpu, Database, Command, FileCode, CheckCircle2 } from 'lucide-react';

export default function DockerGuide() {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => {
      setCopiedText(null);
    }, 2000);
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
    <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 space-y-6 shadow-2xs hover:shadow-xs transition-shadow duration-300">
      <div className="pb-4 border-b border-slate-100">
        <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2 leading-none font-sans tracking-tight">
          <Cpu className="w-5 h-5 text-indigo-600" />
          Schemat wdrożenia lokalnego Docker + PostgreSQL
        </h2>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed font-sans">
          Aplikacja jest w pełni wstępnie skonfigurowana do budowania i wdrażania środowisk wielokontenerowych za pomocą Docker Compose i wydajnej bazy danych PostgreSQL.
        </p>
      </div>

      {/* Grid boxes for settings (Bento Blocks) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-start gap-3">
          <Database className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-extrabold text-xs text-slate-800">Schemat bazy danych</h4>
            <p className="text-[10px] text-slate-400 mt-1.5 leading-normal font-sans font-medium">
              Relacyjny schemat bazy PostgreSQL obsługujący stan zgłoszeń IT, wątki wiadomości diagnostycznych oraz logi powiadomień.
            </p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-start gap-3">
          <Terminal className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-extrabold text-xs text-slate-800">Usługi WebSockets</h4>
            <p className="text-[10px] text-slate-400 mt-1.5 leading-normal font-sans font-medium">
              Porty są automatycznie dostosowane do obsługi równoległych aktualizacji statusów w czasie rzeczywistym przechodzących przez jeden wewnętrzny port.
            </p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-start gap-3">
          <Command className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-extrabold text-xs text-slate-800">Gotowy na produkcję</h4>
            <p className="text-[10px] text-slate-400 mt-1.5 leading-normal font-sans font-medium">
              Wieloetapowe kontenery Alpine Linux redukują rozmiar obrazów, poprawiając bezpieczeństwo w trakcie wdrożeń.
            </p>
          </div>
        </div>
      </div>

      {/* Steps list */}
      <div className="space-y-4 pt-2">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Polecenia szybkiego startu</h3>
        <div className="bg-slate-900 text-slate-100 rounded-xl p-5 font-mono text-[11px] overflow-x-auto space-y-3.5 relative shadow-inner select-all">
          <button
            onClick={() => copyToClipboard(`docker compose up --build -d`, 'cmd')}
            className="absolute right-4 top-4 bg-slate-800 text-[10px] text-slate-300 hover:text-white hover:bg-slate-700 px-2.5 py-1 rounded-lg border border-slate-700 font-bold cursor-pointer transition-colors"
          >
            {copiedText === 'cmd' ? '📋 Skopiowano' : 'Kopiuj polecenie'}
          </button>
          <div className="text-slate-500"># 1. Uruchom całe środowisko IT (Aplikacja + PostgreSQL + pgAdmin) w tle</div>
          <div className="text-emerald-400 font-bold">docker compose up --build -d</div>
          
          <div className="text-slate-500 pt-1"># 2. Zweryfikuj, czy usługi działają prawidłowo w logach kontenera</div>
          <div className="text-emerald-400 font-bold">docker compose logs -f web-app</div>

          <div className="text-slate-500 pt-1.5 font-bold uppercase tracking-wider text-[9px]">➜ Adresy dostępowe usług:</div>
          <div className="flex flex-col gap-1 pl-2 text-slate-305 font-sans font-medium">
            <div>🚀 <span className="font-bold text-slate-100">Portal Wsparcia IT:</span> <a href="http://localhost:3000" className="text-indigo-400 underline" target="_blank" rel="noopener noreferrer">http://localhost:3000</a></div>
            <div>📂 <span className="font-bold text-slate-100">Baza pgAdmin Panel:</span> <a href="http://localhost:5050" className="text-amber-400 underline" target="_blank" rel="noopener noreferrer">http://localhost:5050</a> <span className="text-slate-400 text-xs">(admin@bagietka.pl / AdminPassword_99)</span></div>
          </div>
        </div>
      </div>

      {/* Toggle View of docker files */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
        {/* Box-1: Dockerfile code viewer */}
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5" /> Dockerfile
            </span>
            <button
              onClick={() => copyToClipboard(dockerfileContent, 'df')}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-805 cursor-pointer"
            >
              {copiedText === 'df' ? '📋 Skopiowano!' : 'Kopiuj kod'}
            </button>
          </div>
          <pre className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[9px] font-mono text-slate-700 overflow-x-auto max-h-[350px] leading-relaxed shadow-inner">
            {dockerfileContent}
          </pre>
        </div>

        {/* Box-2: Docker Compose code viewer */}
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" /> docker-compose.yml
            </span>
            <button
              onClick={() => copyToClipboard(dockerComposeContent, 'dc')}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-805 cursor-pointer"
            >
              {copiedText === 'dc' ? '📋 Skopiowano!' : 'Kopiuj kod'}
            </button>
          </div>
          <pre className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[9px] font-mono text-slate-700 overflow-x-auto max-h-[350px] leading-relaxed shadow-inner">
            {dockerComposeContent}
          </pre>
        </div>
      </div>
    </div>
  );
}
