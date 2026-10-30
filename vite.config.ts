import { defineConfig } from 'vite';

export default defineConfig({
  /**
   * GitHub Pages no sirve el sitio en la raíz del dominio, sino en
   * https://jose-an608.github.io/sumo-sim/.
   *
   * Sin esta línea, el HTML generado pediría /assets/index-abc123.js y el
   * navegador lo buscaría en jose-an608.github.io/assets/..., que no existe.
   * El síntoma es una página en blanco con 404 en cada archivo de la consola,
   * y es el error más común al publicar un proyecto de Vite en Pages.
   *
   * En desarrollo (`npm run dev`) esto no molesta: Vite sirve desde la raíz
   * igual.
   */
  base: '/sumo-sim/',
});
