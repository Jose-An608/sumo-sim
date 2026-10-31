import * as Blockly from 'blockly';

/**
 * C2 — Guardar y cargar el programa de bloques.
 *
 * No inventamos un formato: Blockly ya sabe serializar un workspace entero
 * con `Blockly.serialization.workspaces`. Un formato propio habria que
 * mantenerlo cada vez que agreguemos un bloque nuevo.
 */

/** Clave bajo la que se guarda el programa en el navegador. */
export const CLAVE_GUARDADO = 'sumo-sim:programa';

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
  try {
    const programa = JSON.parse(texto) as ProgramaGuardado;
    deserializar(programa, workspace);
    return true;
  } catch {
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
export function guardar(workspace: Blockly.Workspace, almacen: Almacen): boolean {
  try {
    almacen.setItem(CLAVE_GUARDADO, aTexto(workspace));
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
export function cargar(workspace: Blockly.Workspace, almacen: Almacen): boolean {
  let texto: string | null = null;

  try {
    texto = almacen.getItem(CLAVE_GUARDADO);
  } catch {
    return false;
  }

  if (!texto) return false;

  if (!desdeTexto(texto, workspace)) {
    // Lo guardado no sirve: lo borramos para no reintentar en cada carga.
    try {
      almacen.removeItem(CLAVE_GUARDADO);
    } catch {
      // Si ni borrar se puede, no hay mas que hacer.
    }
    return false;
  }

  return true;
}
