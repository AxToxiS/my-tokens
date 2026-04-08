# My Tokens - Plan de Desarrollo

## Resumen del Proyecto

Aplicación de escritorio multiplataforma (Windows, Linux, Mac) que muestra una ventana flotante siempre visible (always-on-top) con el consumo de cuotas/tokens de varios servicios de IA.

---

## Datos a Mostrar

| Servicio         | Métrica                                    | Fuente de datos                        |
|------------------|--------------------------------------------|----------------------------------------|
| **OpenAI**       | Cuota consumida en 5 horas                 | Web scraping / API usage dashboard     |
| **OpenAI**       | Cuota consumida en 1 semana                | Web scraping / API usage dashboard     |
| **Claude**       | Cuota consumida en 5 horas                 | Web scraping / dashboard               |
| **Claude**       | Cuota consumida en 1 semana                | Web scraping / dashboard               |
| **Claude**       | Indicador de horas punta (peak hours)      | Basado en horario conocido             |
| **GitHub Copilot** | Premium requests usados                  | GitHub API / billing page scraping     |
| **Windsurf**     | Tokens/créditos usados                     | Windsurf settings / API                |

---

## Arquitectura y Tech Stack

### Opción elegida: **Electron + React + TypeScript**

**Justificación:**
- Electron permite ventanas nativas en Win/Linux/Mac con `alwaysOnTop`
- React + TailwindCSS para UI moderna y compacta
- TypeScript para seguridad de tipos
- Buen ecosistema para empaquetado multiplataforma (`electron-builder`)

### Estructura del Proyecto

```
my-tokens/
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── electron/
│   ├── main.ts              # Proceso principal de Electron
│   ├── preload.ts           # Bridge seguro entre main y renderer
│   └── services/
│       ├── openai.ts        # Obtener datos de OpenAI
│       ├── claude.ts        # Obtener datos de Claude
│       ├── copilot.ts       # Obtener datos de GitHub Copilot
│       ├── windsurf.ts      # Obtener datos de Windsurf
│       └── peak-hours.ts    # Lógica de horas punta de Claude
├── src/
│   ├── App.tsx              # Componente raíz
│   ├── main.tsx             # Entry point del renderer
│   ├── index.html
│   ├── components/
│   │   ├── ServiceCard.tsx  # Card reutilizable para cada servicio
│   │   ├── PeakIndicator.tsx# Indicador de horas punta
│   │   ├── TitleBar.tsx     # Barra de título personalizada (drag)
│   │   └── ProgressBar.tsx  # Barra de progreso de consumo
│   ├── hooks/
│   │   └── useServiceData.ts
│   └── styles/
│       └── globals.css
├── .env                     # API keys y configuración
└── electron-builder.yml     # Config de empaquetado
```

---

## Fases de Desarrollo

### Fase 1: Setup del Proyecto (Prioridad: ALTA)
- [x] Investigación de APIs y fuentes de datos
- [ ] Inicializar proyecto con Electron + React + Vite + TypeScript
- [ ] Configurar TailwindCSS
- [ ] Crear ventana flotante básica always-on-top, draggable, frameless

### Fase 2: Obtención de Datos (Prioridad: ALTA)

#### Estrategia unificada: Cookie Scraping del navegador

Todos los servicios muestran el consumo en sus dashboards web. La app extraerá
las cookies de sesión del navegador local y replicará las peticiones internas.

**Paso 1: Extraer cookies del navegador**
- Chrome: `%LOCALAPPDATA%\Google\Chrome\User Data\Default\Cookies` (SQLite + DPAPI)
- Edge: `%LOCALAPPDATA%\Microsoft\Edge\User Data\Default\Cookies` (SQLite + DPAPI)
- Firefox: `%APPDATA%\Mozilla\Firefox\Profiles\*.default\cookies.sqlite`
- Mac: Keychain para descifrar; Linux: GNOME Keyring / kwallet
- Librería: `chrome-cookies-secure` o similar para descifrado multiplataforma

**Paso 2: Replicar peticiones internas por servicio**

| Servicio | Dashboard | Cookie | Endpoint interno (a descubrir/confirmar) |
|---|---|---|---|
| **OpenAI** | `chatgpt.com` | `__Secure-next-auth.session-token` | `chatgpt.com/backend-api/...` |
| **Claude** | `claude.ai/settings/usage` | `sessionKey` | `claude.ai/api/organizations/{id}/usage` |
| **GitHub Copilot** | `github.com/settings/billing` | `user_session` o PAT | `api.github.com/users/{user}/settings/billing/premium_request/usage` |
| **Windsurf** | `windsurf.com/profile` | Cookie sesión Codeium | Endpoint interno (a descubrir via DevTools) |

**GitHub Copilot** tiene API oficial REST → se puede usar un PAT (gratis) como alternativa más robusta.

**NOTA:** Los endpoints internos pueden cambiar sin aviso. Se necesitará que el
usuario abra DevTools (F12 → Network) en cada dashboard para confirmar las URLs
exactas. La app incluirá configuración para actualizar estos endpoints fácilmente.

### Fase 3: Horas Punta de Claude (Prioridad: ALTA)

**Horario de peak hours confirmado:**
- **Peak:** 05:00 - 11:00 PT (13:00 - 19:00 GMT / 15:00 - 21:00 CEST)
- **Off-peak:** 11:00 - 05:00 PT (19:00 - 13:00 GMT del día siguiente)

**Comportamiento durante peak:**
- Los tokens cuestan más (se consumen más rápido)
- La cuota de 5 horas se agota antes

**Implementación:**
- Calcular en tiempo real si estamos en horario peak basándose en la hora actual vs PT timezone
- Mostrar indicador visual claro (verde = off-peak/barato, rojo = peak/caro)
- Mostrar countdown hasta el próximo cambio de estado

### Fase 4: UI del Widget (Prioridad: MEDIA)
- Ventana compacta (~350x500px), frameless, draggable
- Barra de título personalizada con botón de cerrar/minimizar
- Cards para cada servicio con:
  - Logo del servicio
  - Barra de progreso de consumo (5h)
  - Barra de progreso de consumo (semanal)
  - Porcentaje usado
- Indicador de horas punta prominente para Claude
- Tema oscuro por defecto
- Auto-refresh cada 5 minutos

### Fase 5: Configuración (Prioridad: MEDIA)
- Pantalla de settings para:
  - API keys / tokens de autenticación
  - Intervalo de refresco
  - Plan de cada servicio (para calcular límites)
- Persistencia en archivo local (`electron-store`)

### Fase 6: Empaquetado (Prioridad: BAJA)
- Configurar `electron-builder` para Win/Linux/Mac
- Instalador para cada plataforma
- Auto-start con el sistema (opcional)

---

## Consideraciones Importantes

### Autenticación
La mayor complejidad es la **autenticación** para obtener datos de uso. Hay varias estrategias:

1. **API Keys directas** - El usuario proporciona API keys (funciona para OpenAI API y GitHub)
2. **Sesión del navegador** - Extraer cookies de sesión del navegador local (complejo, frágil)
3. **Entrada manual** - El usuario actualiza los valores manualmente (simple pero tedioso)
4. **Hybrid** - Combinación: API donde sea posible + manual donde no

**Recomendación inicial:** Empezar con un enfoque **híbrido**:
- GitHub Copilot → GitHub Personal Access Token (PAT)
- OpenAI → API key de organización si disponible, sino manual
- Claude → Manual (no hay API pública de cuota)
- Windsurf → Lectura de config local o manual

### Horas punta Claude - Valor para el usuario
Durante peak hours (15:00-21:00 hora España), cada interacción consume más cuota. El indicador ayudará a:
- Saber cuándo hacer tareas pesadas (off-peak)
- Planificar el uso diario
- Entender por qué la cuota se agotó antes de lo esperado

---

## Próximos Pasos

1. **Confirmar con el usuario** las preferencias de autenticación
2. Comenzar implementación Fase 1 (setup)
3. Iterar incrementalmente
