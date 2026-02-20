# TaxOS - Intelligent Tax & Bookkeeping for CPAs

TaxOS is a comprehensive, AI-driven platform designed specifically for CPAs and tax professionals to streamline client management, document processing, and bookkeeping workflows.

---

## 🚀 Key Features

- **Client Management**: centralized dashboard for managing client details, entity types, and tax years.
- **AI-Powered Document Processing**: Automated OCR and AI analysis for IRS notices, tax documents, and receipts.
- **Intelligent Bookkeeping**: Real-time transaction tracking, transaction learning, and automated reconciliation.
- **AI Assistant**: A specialized AI chat for tax advice and document analysis.
- **Task & Workflow Management**: Integrated task tracking to keep tax workflows on schedule.
- **Vendor & 1099 Tracking**: Automated 1099 tracking and vendor compliance management.
- **Open Banking Integration**: Secure bank connection for direct transaction syncing.
- **Secure Client Communications**: Integrated email and document sharing.

## 🛠 Tech Stack

### Frontend
- **Framework**: React 18 with [Vite](https://vitejs.dev/)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Lucide React & Tabler Icons

### Backend & Infrastructure
- **BaaS**: [Supabase](https://supabase.com/) (PostgreSQL, Auth, Storage, Edge Functions)
- **AI**: OpenAI (via Supabase Edge Functions)
- **Email**: Resend
- **Reporting**: Sentry for monitoring

### Testing
- **Unit/Integration**: Vitest
- **E2E**: Playwright

## 📂 Project Structure

```text
src/
├── components/     # Atomic design (atoms, molecules, organisms)
├── contexts/       # React contexts for state management
├── hooks/          # Custom hooks for API and logic
├── lib/            # Shared utilities and service definitions
├── pages/          # Application routes and views
└── types/          # TypeScript definitions
supabase/
├── functions/      # AI and backend logic (Edge Functions)
└── migrations/     # Database schema and RLS policies
```

## 🏁 Getting Started

### Prerequisites
- Node.js 18+
- Supabase Account

### Installation
1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd TaxOS-App
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Setup Environment**:
    Create a `.env.local` file with your credentials:
    ```bash
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```
4.  **Run Development Server**:
    ```bash
    npm run dev
    ```

## 🧪 Testing

- **Run Unit Tests**: `npm test`
- **Run E2E Tests**: `npm run e2e`

## 📄 License
MIT License. See [LICENSE](LICENSE) for details.

  Linux packages are provided in [Releases](https://github.com/supabase/cli/releases). To install, download the `.apk`/`.deb`/`.rpm`/`.pkg.tar.zst` file depending on your package manager and run the respective commands.

  ```sh
  sudo apk add --allow-untrusted <...>.apk
  ```

  ```sh
  sudo dpkg -i <...>.deb
  ```

  ```sh
  sudo rpm -i <...>.rpm
  ```

  ```sh
  sudo pacman -U <...>.pkg.tar.zst
  ```
</details>

<details>
  <summary><b>Other Platforms</b></summary>

  You can also install the CLI via [go modules](https://go.dev/ref/mod#go-install) without the help of package managers.

  ```sh
  go install github.com/supabase/cli@latest
  ```

  Add a symlink to the binary in `$PATH` for easier access:

  ```sh
  ln -s "$(go env GOPATH)/bin/cli" /usr/bin/supabase
  ```

  This works on other non-standard Linux distros.
</details>

<details>
  <summary><b>Community Maintained Packages</b></summary>

  Available via [pkgx](https://pkgx.sh/). Package script [here](https://github.com/pkgxdev/pantry/blob/main/projects/supabase.com/cli/package.yml).
  To install in your working directory:

  ```bash
  pkgx install supabase
  ```

  Available via [Nixpkgs](https://nixos.org/). Package script [here](https://github.com/NixOS/nixpkgs/blob/master/pkgs/development/tools/supabase-cli/default.nix).
</details>

### Run the CLI

```bash
supabase bootstrap
```

Or using npx:

```bash
npx supabase bootstrap
```

The bootstrap command will guide you through the process of setting up a Supabase project using one of the [starter](https://github.com/supabase-community/supabase-samples/blob/main/samples.json) templates.

## Docs

Command & config reference can be found [here](https://supabase.com/docs/reference/cli/about).

## Breaking changes

We follow semantic versioning for changes that directly impact CLI commands, flags, and configurations.

However, due to dependencies on other service images, we cannot guarantee that schema migrations, seed.sql, and generated types will always work for the same CLI major version. If you need such guarantees, we encourage you to pin a specific version of CLI in package.json.

## Developing

To run from source:

```sh
# Go >= 1.22
go run . help
```
