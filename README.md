# IT Support Request & Ticket Management System / System Zgłoszeń i Zarządzania Wsparciem IT

Choose your language:
*   [Polski / Polish](#-wersja-polska)
*   [English](#-english-version)

---

# 🇵🇱 Wersja Polska

## System Zgłoszeń i Zarządzania Wsparciem IT

Przeznaczona dla przedsiębiorstw aplikacja Helpdesk i zarządzania zgłoszeniami IT, oferująca śledzenie stanu w czasie rzeczywistym, kontrolę dostępu opartą na rolach (RBAC), symulowane wysyłanie powiadomień e-mail oraz interaktywne załączniki. Aplikacja jest w pełni skonteneryzowana za pomocą Dockera w celu ułatwienia szybkiego, lokalnego wdrażania.

---

## 🎨 Główne Cechy Architektoniczne

1. **Dwutrybowy silnik bazy danych (Dual DB Engine):** Łączy się bezpośrednio z **bazą danych PostgreSQL** podczas działania w środowisku Docker, a w środowiskach izolowanych lub piaskownicach deweloperskich automatycznie przełącza się na **szybką tekstową bazę danych JSON (`tickets_db.json`)**.
2. **Synchronizacja w czasie rzeczywistym (WebSockets):** Zmiany statusów, przypisywanie techników oraz wiadomości w wątkach czatu są synchronizowane na żywo na ekranach zarówno klientów, jak i inżynierów wsparcia.
3. **Kontrola dostępu oparta na rolach (RBAC):**
   - **Panel Klienta:** Przeglądanie zgłoszonych spraw, rejestrowanie nowych zgłoszeń (z możliwością precyzyjnego wyboru lokalizacji/sklepu z rozwijanej listy), dołączanie plików (logów/zrzutów ekranu) oraz bezpośrednia konwersacja z technikami.
   - **Panel Agenta/Administratora:** Pełna manipulacja stanami zgłoszeń, podnoszenie poziomu pilności priorytetu, przypisywanie zgłoszeń do techników i dodawanie prywatnych notatek serwisowych (niewidocznych dla klientów).
4. **Dynamiczna symulacja poczty SMTP:** Automatycznie wysyła sformatowane powiadomienia e-mail przy kluczowych zdarzeniach (utworzenie zgłoszenia, zmiana statusu, przypisanie technika) wraz z pięknym, interaktywnym podglądem skrzynki pocztowej audytu dostępnym w interfejsie portalu.
5. **Solidne testy jednostkowe:** Zaprojektowany zestaw natywnych testów jednostkowych Node.js weryfikujący spójność zapisu bazy danych, parametry przejść ról oraz dodawanie wątków wiadomości.

---

## 🚀 Szybki Start z Docker Compose (Rekomendowane)

Aby uruchomić całe środowisko lokalnie (Aplikacja + baza danych PostgreSQL + panel administratora pgAdmin) w dedykowanych kontenerach:

### Wymagania wstępne
- Zainstalowany i działający klient [Docker Desktop](https://www.docker.com/products/docker-desktop/).

### Uruchomienie kontenerów
W głównym katalogu projektu uruchom komendę:
```bash
docker compose up --build -d
```

To podniesie trzy zsynchronizowane serwery:
- 🌐 **Portal wsparcia IT:** [http://localhost:3000](http://localhost:3000)
- 🗄️ **Usługa bazy danych PostgreSQL:** Działa na porcie `localhost:5432`
- 🖥️ **Narzędzie pgAdmin:** [http://localhost:5050](http://localhost:5050)
  - *Adres e-mail logowania:* `admin@bagietka.pl`
  - *Hasło logowania:* `AdminPassword_99`

### Zatrzymanie kontenerów
```bash
docker compose down -v
```

---

## 🛠️ Rozwój Lokalny (Ręczna Konfiguracja)

Uruchom serwer backendowy i portal frontendowy bez kontenerów bezpośrednio przy użyciu Node.js:

1. **Instalacja zależności:**
   ```bash
   npm install
   ```
2. **Uruchomienie hybrydowego serwera HTTP + WebSocket:**
   ```bash
   npm run dev
   ```
   *Serwer Express natychmiast uruchomi portal i udostępni aplikację pod adresem [http://localhost:3000](http://localhost:3000).*

3. **Lokalny zapasowy tryb bazy danych:**
   - W przypadku braku aktywnych zmiennych połączeniowych bazy PostgreSQL w pliku `.env`, serwer automatycznie utworzy plik `/tickets_db.json` i natychmiast zasili go przykładowymi zgłoszeniami diagnostycznymi!

---

## 🧪 Uruchamianie Automatycznych Testów Jednostkowych

Wszechstronny pakiet testów jednostkowych został zaprojektowany przy użyciu wbudowanego silnika testowego środowiska Node.js. Aby go uruchomić:

```bash
npm run test
```

Logi wyjściowe weryfikują poprawność walidacji dla:
- Projektowania i zasilania bazy danych.
- Wysyłania nowo rejestrowanych zgłoszeń.
- Logiki przejść stanów w modelu uprawnień RBAC.
- Dodawania wiadomości na czacie wsparcia.
- Rejestrowania powiadomień pocztowych w celach audytu.

---

## 📁 Struktura Projektu i Katalogów

- `/server.ts` - Główny serwer HTTP i WebSocket obsługujący trasy REST oraz komunikację na żywo.
- `/src/types.ts` - Współdzielone interfejsy TypeScript (Ticket, User, Attachment, TicketMessage, NotificationLog).
- `/src/dataStore.ts` - Integracja dwutrybowej bazy danych (PostgreSQL + zapasowy tryb lokalnego pliku JSON).
- `/src/data/stores.ts` - Baza adresowa sklepów firmowych i partnerskich z adresami, e-mailami oraz kodami lokalizacji.
- `/src/components/` - Moduły interfejsu użytkownika:
  - `TicketForm.tsx` - Formularz dodawania zgłoszeń z wyborem lokalizacji/sklepu i załącznikami.
  - `TicketDashboard.tsx` - Siatka zgłoszeń, filtrowanie, szczegóły sklepów, korespondencja czatowa i akcje związane ze zmianą stanu spraw.
  - `NotificationCenter.tsx` - Wizualny podgląd wysłanych symulowanych powiadomień e-mail SMTP.
  - `DockerGuide.tsx` - Interaktywny przewodnik uruchamiania lokalnych kontenerów.
- `/tests/core.test.ts` - Lekki, łatwy do rozbudowy zestaw testów jednostkowych.

---

# 🇬🇧 English Version

## IT Support Request & Ticket Management System

An enterprise-ready IT Helpdesk Support and Ticket Management application featuring real-time state tracking, role-based access control (RBAC), simulated notification dispatches, and responsive attachments. The application is completely dockerized for seamless local deployment.

---

## 🎨 Core Architectural Features

1. **Dual DB Adapter Engine:** Connects natively to a **PostgreSQL Database** when running in Docker, and falls back to a **high-speed JSON File DB (`tickets_db.json`)** in isolated or dev-sandbox environments.
2. **Real-time Synchronization (WebSockets):** Status transitions, operator dispatching, and conversational reply widgets synchronized live across both customers and engineers.
3. **Role-Based Access Control (RBAC):**
   - **Client Panel:** View submitted tickets, register complaints (with precise store location drop-down), attach files (logs/screenshots), and chat with technicians.
   - **Agent/Admin Dashboard:** Manipulate ticket statuses, upgrade impact urgency, allocate cases to technicians, and log private/internal discussion notes.
4. **Dynamic SMTP Email Simulation:** Dispatches formatted HTML/text email content for all critical events (creation, transitions, team dispatches) with a beautiful interactive audit mailbox in the UI.
5. **Robust Testing Scaffold:** Fast Node.js native unit tests testing persistence integrity, RBAC transition parameters, and thread appending.

---

## 🚀 Easy Start with Docker Compose (Recommended)

To run the entire suite locally (App + PostgreSQL database + pgAdmin Admin panel) in isolated containers:

### Prerequisites
- [Docker Client](https://www.docker.com/products/docker-desktop/) installed and running.

### Boot containers
From the project workspace root, run:
```bash
docker compose up --build -d
```

This starts three orchestrated servers:
- 🌐 **IT Helpdesk Web Portal:** [http://localhost:3000](http://localhost:3000)
- 🗄️ **PostgreSQL DB Service:** Runs on `localhost:5432`
- 🖥️ **pgAdmin Panel Utility:** [http://localhost:5050](http://localhost:5050)
  - *Login email:* `admin@bagietka.pl`
  - *Login password:* `AdminPassword_99`

### Stop containers
```bash
docker compose down -v
```

---

## 🛠️ Local Development (Manual Setup)

Run the backend and frontend locally without containers using Node.js:

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Start hybrid HTTP + WebSocket Server:**
   ```bash
   npm run dev
   ```
   *The Express portal will boot and serve the frontend at [http://localhost:3000](http://localhost:3000) immediately.*

3. **Check local database fallback:**
   - Without active PG connection strings in `.env`, the server automatically creates `/tickets_db.json` and seeds mock diagnostic tickets immediately!

---

## 🧪 Running Automated Unit Tests

A comprehensive suite of unit tests has been designed using Node's native built-in testing harness. To execute core test scopes:

```bash
npm run test
```

Standard Output logs trace test validations for:
- Initial database pre-seeding.
- Submitting newly registered tickets.
- Status transition upgrades under simulated RBAC parameters.
- Chat board insertions and message queues.
- Security audit logging of client emails.

---

## 📁 System Blueprint & Directory Layout

- `/server.ts` - Core full-stack HTTP and WebSocket server handling REST routes and WebSockets upgrades.
- `/src/types.ts` - Shared TS interfaces (Ticket, User, Attachment, TicketMessage, NotificationLog).
- `/src/dataStore.ts` - Dual-mode database integration pool (PostgreSQL + local JSON stream fallback).
- `/src/data/stores.ts` - Stores address database containing address, emails, and location short-codes.
- `/src/components/` - Highly structured UI modules:
  - `TicketForm.tsx` - File submits with attachment convertors and store location selectors.
  - `TicketDashboard.tsx` - Ticket grids, filter panels, conversations, store details, and state actions.
  - `NotificationCenter.tsx` - Visual audit logs tracking outgoing simulated SMTP emails.
  - `DockerGuide.tsx` - Interactive local container guides.
- `/tests/core.test.ts` - Lightweight high-reliability core test harness.
