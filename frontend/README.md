# ArsipKita Frontend

Copy `.env.example` to `.env` before starting Vite. For local development, set the API URL to the local backend:

```cmd
copy .env.example .env
```

Set the URLs for the environment where the frontend is opened:

```env
VITE_API_URL=http://localhost:5000/api
VITE_QR_BASE_URL=http://localhost:5173
```

For the deployed frontend, configure `VITE_API_URL=https://dokumen-arsip-deploy-api.vercel.app/api` in the Vercel project environment. `VITE_API_URL` is the single API base URL in every environment; when it is unset during local Vite development, the app falls back to `http://localhost:5000/api`. Production builds require an HTTPS value. Restart Vite after changing `.env` because Vite reads environment variables when it starts.

## Development

```cmd
npm run dev -- --host 0.0.0.0
```

## Original Vite Notes

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
