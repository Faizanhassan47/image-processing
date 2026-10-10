# Pathology Workspace Frontend

React and Vite client for the Digital Pathology Demo.

## Commands

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run test
npm.cmd run lint
npm.cmd run build
```

The application uses protected React Router routes for `/` and `/admin`. Major routes are lazy-loaded, API requests go through `src/api.js`, and state-changing requests automatically include the CSRF token issued by the backend.

Frontend tests use Vitest, jsdom, and React Testing Library. Add component tests next to the component using the `*.test.jsx` naming convention.

Copy `.env.example` to `.env` when local defaults are not suitable. Keep `VITE_API_BASE_URL` empty during proxy-based local development.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
