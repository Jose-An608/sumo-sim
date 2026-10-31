import { defineConfig } from 'vite';

/**
 * GitHub Pages no sirve el sitio en la raíz del dominio, sino en
 * https://jose-an608.github.io/sumo-sim/.
 *
 * Sin `base`, el HTML construido pediría /assets/index-abc123.js y el
 * navegador lo buscaría en jose-an608.github.io/assets/..., que no existe.
 * El síntoma es una página en blanco con 404 en cada archivo.
 *
 * Pero `base` NO es solo de producción: la documentación de Vite lo define
 * como "base public path when served in development or production". Si lo
 * dejáramos puesto siempre, `npm run dev` serviría el simulador en
 * localhost:5173/sumo-sim/ y entrar a la raíz mostraría un aviso de Vite en
 * vez de la página.
 *
 * Por eso la configuración es una función: Vite le pasa cómo fue invocado y
 * decidimos según eso.
 *
 *   dev (`vite`)         -> command 'serve', isPreview falso -> base '/'
 *   build (`vite build`) -> command 'build'                  -> base '/sumo-sim/'
 *   preview              -> command 'serve', isPreview TRUE  -> base '/sumo-sim/'
 *
 * El caso de preview es el que se escapa fácil: `vite preview` también es un
 * 'serve', pero sirve lo que ya se construyó con /sumo-sim/ dentro del HTML.
 * Si ahí devolviéramos '/', el preview rompería exactamente igual que lo que
 * estamos arreglando.
 *
 * La comparación con `=== true` es a propósito: la documentación avisa que
 * algunas herramientas que cargan la configuración pasan estas banderas como
 * undefined.
 */
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview === true ? '/sumo-sim/' : '/',
}));
