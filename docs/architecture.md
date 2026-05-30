# Arquitectura de Edugens

Edugens es una plataforma SaaS (Software as a Service) diseñada para la gestión escolar inteligente, construida con una arquitectura moderna, escalable y segura.

## Stack Tecnológico

- **Frontend:** React + Vite + TypeScript.
- **Estilos:** Tailwind CSS (Vanilla CSS para componentes personalizados).
- **Base de Datos y Autenticación:** Supabase (PostgreSQL).
- **Generación de Reportes:** jsPDF, html2canvas y XLSX.
- **Motor de Horarios:** Algoritmo heurístico (Monte Carlo) ejecutado en el cliente.

## Flujo de Datos e Interacción

1. **Capa de Interfaz (Frontend):** Los componentes de React (en `src/components`) capturan la interacción del usuario. El estado global se gestiona a través de `AppContext.tsx`.
2. **Servicios de Datos:** El frontend se comunica con Supabase a través de servicios especializados en `src/services/` (ej. `scheduleService.ts`, `dataService.ts`).
3. **Seguridad (RLS):** Supabase no permite acceso directo a las tablas. Cada consulta es interceptada por las políticas de **Row Level Security (RLS)** en PostgreSQL. Estas políticas verifican:
    - Que el usuario esté autenticado.
    - Que el `center_id` de la fila coincida con el `center_id` del perfil del usuario.
4. **Persistencia:** Los datos se guardan en tablas relacionales optimizadas para multi-tenancy.

## Seguridad Multi-Centro (SaaS)

El aislamiento de datos se logra mediante la columna `center_id` presente en todas las tablas críticas. Las políticas RLS aseguran que el Administrador del Centro A jamás pueda ver ni modificar los datos del Centro B.

---

## Guía de Puesta en Marcha (Onboarding)

Sigue estos pasos para configurar el entorno de desarrollo localmente:

### 1. Clonar e Instalar Dependencias
```bash
npm install
```

### 2. Configurar Variables de Entorno
Copia el archivo de ejemplo y rellena tus credenciales de Supabase:
```bash
cp .env.example .env
```
*Asegúrate de incluir `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.*

### 3. Configurar la Base de Datos
Si estás usando la CLI de Supabase:
```bash
supabase db reset
# o
supabase migration up
```
*Si usas la consola web, asegúrate de ejecutar los scripts SQL en `supabase/seguridad_saas_pro.sql` para activar las políticas RLS.*

### 4. Lanzar el Servidor de Desarrollo
```bash
npm run dev
```
La aplicación estará disponible en `http://localhost:3000`.

### 5. Calidad de Código
Antes de subir cambios, asegúrate de pasar los controles:
```bash
npm run format  # Limpiar estilo
npm run lint    # Buscar errores
```
