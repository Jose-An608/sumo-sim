# Guía de contribución — Sumo Sim

## Reparto del trabajo

- **José** → `src/engine/`, `src/render/`, infraestructura (CI, despliegue)
- **Chura** → `src/blocks/`, `src/vm/`, interfaz

`src/types.ts` es compartido. **No se modifica sin acuerdo de los dos.**

## Flujo de trabajo (Trunk-Based)

```bash
git checkout main
git pull
git checkout -b feat/nombre-corto
# trabajas
git add .
git commit -m "feat(ambito): descripcion"
git push -u origin feat/nombre-corto
# abres PR, el otro revisa, mergeas, borras la rama
```

Ninguna rama vive más de 2 días. Si la tarea es más larga, se parte en dos issues.

## Convención de commits

`tipo(ámbito): descripción en presente`

Tipos: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`

Ejemplo: `feat(physics): aplica cinematica diferencial`

## Definition of Ready (DoR)

Un issue se puede empezar cuando:

- [ ] Tiene título en forma de acción
- [ ] Tiene criterios de aceptación escritos
- [ ] Tiene responsable y etiqueta de sprint

## Definition of Done (DoD)

Un issue se cierra cuando:

- [ ] `npx tsc --noEmit` no reporta errores
- [ ] Tiene test si contiene lógica (matemática, decisiones, estados)
- [ ] `npm test` pasa en verde
- [ ] Pasó por Pull Request revisado por la otra persona
- [ ] Está mergeado a `main`

**Nadie mergea su propio PR.**

## Ceremonias

- **Lunes:** planificación, mover issues a "En progreso"
- **Mar a Vie:** standup corto por WhatsApp
- **Viernes:** revisión y retrospectiva