// Carga .env durante la compilación y crea un archivo JavaScript para el navegador.
import dotenv from 'dotenv';
import { copyFile, mkdir } from 'node:fs/promises';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';

dotenv.config();

const variablesFirebase = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
  'FIREBASE_DATABASE_URL',
];

const reemplazos = Object.fromEntries(
  variablesFirebase.map((nombre) => [
    `process.env.${nombre}`,
    JSON.stringify(process.env[nombre] || ''),
  ]),
);

export default {
  input: 'static/js/dashboard.js',
  output: {
    file: 'public/js/dashboard.bundle.js',
    format: 'iife',
    sourcemap: false,
  },
  plugins: [
    replace({ ...reemplazos, preventAssignment: true }),
    nodeResolve({ browser: true }),
    commonjs(),
    {
      name: 'copiar-archivos-de-hosting',
      async writeBundle() {
        await mkdir('public/css', { recursive: true });
        await copyFile('templates/index.html', 'public/index.html');
        await copyFile('static/css/style.css', 'public/css/style.css');
      },
    },
  ],
};
