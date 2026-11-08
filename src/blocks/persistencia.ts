import * as Blockly from 'blockly';

/**
 * C2 — Guardar y cargar el programa de bloques.
 *
 * No inventamos un formato: Blockly ya sabe serializar un workspace entero
 * con `Blockly.serialization.workspaces`. Un formato propio habria que
 * mantenerlo cada vez que agreguemos un bloque nuevo.
 */

/** Prefijo de todo lo que este proyecto guarda en el navegador. */
export const PREFIJO_GUARDADO = 'sumo-sim:programa:';

/**
 * Clave bajo la que se guarda el programa de un editor.
 *
 * Cada editor tiene la suya porque un programa de bloques es la estrategia
 * de UN robot: es lo que se guarda, se descarga y se comparte. Y vive en una
 * funcion, no en literales sueltos por `main.ts`, para que el prefijo este
 * en un solo sitio: un `'sumo-sim:Rojo'` mal escrito no daria error, solo
 * un editor que aparece en blanco.
 *
 * El modulo no sabe cuantos robots hay: `nombre` es cualquier texto.
 */
export function claveDe(nombre: string): string {
  return PREFIJO_GUARDADO + nombre;
}

/**
 * Lo minimo que necesitamos de `localStorage`.
 *
 * Se recibe como parametro en vez de usarlo directo para poder probarlo
 * con un almacen falso: en Node no existe `localStorage`, y aunque
 * existiera, un test no deberia depender del estado del navegador.
 */
export interface Almacen {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
  removeItem(clave: string): void;
}

/** El estado serializado de un workspace. */
export type ProgramaGuardado = ReturnType<typeof Blockly.serialization.workspaces.save>;

/** Convierte el workspace en datos planos, listos para guardar. */
export function serializar(workspace: Blockly.Workspace): ProgramaGuardado {
  return Blockly.serialization.workspaces.save(workspace);
}

/** Reemplaza el contenido del workspace con el programa dado. */
export function deserializar(programa: ProgramaGuardado, workspace: Blockly.Workspace): void {
  Blockly.serialization.workspaces.load(programa, workspace);
}

/** El programa como texto, con sangria, para descargarlo como archivo. */
export function aTexto(workspace: Blockly.Workspace): string {
  return JSON.stringify(serializar(workspace), null, 2);
}

/**
 * Carga un programa desde texto.
 *
 * @returns true si se cargo, false si el texto no era un programa valido.
 *
 * Devuelve un booleano en vez de lanzar porque los dos casos de uso -abrir
 * un archivo que eligio el usuario y leer lo guardado en el navegador- son
 * situaciones donde el dato puede venir roto sin que nadie se haya
 * equivocado programando. Quien llama decide si avisar o seguir callado.
 */
export function desdeTexto(texto: string, workspace: Blockly.Workspace): boolean {
  let programa: unknown;

  try {
    programa = JSON.parse(texto);
  } catch {
    return false;
  }

  // JSON valido no quiere decir programa: `42` o `"hola"` se leen bien, y
  // Blockly los acepta sin quejarse. Un programa guardado es siempre un
  // objeto.
  if (typeof programa !== 'object' || programa === null) return false;

  // Blockly VACIA el workspace antes de cargar. Si lo que viene falla a la
  // mitad -un bloque que no existe, un archivo de otra version- el programa
  // que habia ya no esta. Se guarda una copia para devolverlo: equivocarse
  // de archivo no puede costar el trabajo.
  const anterior = serializar(workspace);

  try {
    deserializar(programa as ProgramaGuardado, workspace);
    return true;
  } catch {
    try {
      deserializar(anterior, workspace);
    } catch {
      // Si ni la copia se puede devolver, no hay mas que hacer.
    }
    return false;
  }
}

/**
 * Guarda el programa en el navegador.
 *
 * @returns true si se guardo.
 *
 * Puede fallar y no es culpa de nadie: en modo incognito algunos
 * navegadores lanzan al escribir, y el almacen tiene un limite de tamaño.
 * Que no se guarde es molesto; que la pagina se caiga por intentarlo, peor.
 */
export function guardar(workspace: Blockly.Workspace, almacen: Almacen, clave: string): boolean {
  try {
    almacen.setItem(clave, aTexto(workspace));
    return true;
  } catch {
    return false;
  }
}

/**
 * Carga en el workspace lo ultimo que se guardo en el navegador.
 *
 * @returns true si habia algo guardado y se pudo cargar.
 *
 * Si lo guardado esta corrupto -editado a mano, o de una version donde un
 * bloque se llamaba distinto- se descarta y se empieza en blanco. Perder un
 * programa es malo, pero una pagina que no abre es peor: lo primero se
 * puede rehacer, lo segundo deja al usuario sin nada.
 */
export function cargar(workspace: Blockly.Workspace, almacen: Almacen, clave: string): boolean {
  let texto: string | null = null;

  try {
    texto = almacen.getItem(clave);
  } catch {
    return false;
  }

  if (!texto) return false;

  if (!desdeTexto(texto, workspace)) {
    // Lo guardado no sirve: lo borramos para no reintentar en cada carga.
    try {
      almacen.removeItem(clave);
    } catch {
      // Si ni borrar se puede, no hay mas que hacer.
    }
    return false;
  }

  return true;
}

/**
 * Lo minimo que necesitamos de los temporizadores del navegador.
 *
 * Se recibe como parametro por la misma razon que el `Almacen`: el test
 * pasa un reloj falso y avanza el tiempo a mano, en vez de esperar de verdad.
 */
export interface Programador {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

/** Los temporizadores reales. */
const relojReal: Programador = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id as ReturnType<typeof setTimeout>),
};

export interface Autoguardado {
  /** Avisa de que hubo un cambio. Guardara cuando pase `retardoMs` sin otro. */
  pedir(): void;
  /** Guarda ya lo que este pendiente. No hace nada si no hay nada pendiente. */
  vaciar(): void;
}

/**
 * Agrupa muchos avisos de cambio en un solo guardado (debounce).
 *
 * Arrastrar un bloque hace que Blockly dispare un evento por cada
 * movimiento del raton. Guardar en cada uno escribiria cientos de veces
 * por segundo; en cambio, esperar a que el usuario pare guarda una vez.
 *
 * Cada aviso REINICIA la espera. Si no, un cambio continuo guardaria cada
 * `retardoMs` en vez de al terminar, que es justo lo que queremos evitar.
 *
 * Recibe la accion como funcion y no un workspace: asi no sabe nada de
 * Blockly y se prueba solo con un contador.
 */
export function crearAutoguardado(
  accion: () => void,
  retardoMs: number,
  programador: Programador = relojReal,
): Autoguardado {
  let pendiente: unknown = null;

  function ejecutar(): void {
    pendiente = null;
    accion();
  }

  return {
    pedir() {
      if (pendiente !== null) programador.clearTimeout(pendiente);
      pendiente = programador.setTimeout(ejecutar, retardoMs);
    },

    vaciar() {
      if (pendiente === null) return;
      programador.clearTimeout(pendiente);
      ejecutar();
    },
  };
}
