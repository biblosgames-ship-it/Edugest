-- =========================================================================
-- SCRIPT PARA CREAR LAS TABLAS DEL MÓDULO DE GESTIÓN DE PLANTEL EN SUPABASE
-- =========================================================================
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase.

-- 1. Tabla de Áreas del Plantel (Aulas, baños, oficinas, pasillos, etc.)
CREATE TABLE IF NOT EXISTS public.facility_areas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  center_id UUID REFERENCES public.centers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  type TEXT NOT NULL, -- 'aula', 'baño', 'oficina', 'patio', 'comedor', etc.
  location TEXT, -- bloque, piso
  priority TEXT DEFAULT 'media', -- 'alta', 'media', 'baja'
  status TEXT DEFAULT 'bueno', -- 'bueno', 'regular', 'critico'
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_name TEXT,
  observations TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla de Tareas Operativas (Limpieza y Mantenimiento)
CREATE TABLE IF NOT EXISTS public.facility_tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  center_id UUID REFERENCES public.centers(id) ON DELETE CASCADE,
  area_id UUID REFERENCES public.facility_areas(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL, -- 'limpieza_diaria', 'limpieza_profunda', 'desinfeccion', 'reparacion', etc.
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_name TEXT,
  frequency TEXT DEFAULT 'diaria', -- 'diaria', 'semanal', 'mensual', 'por_evento'
  due_date TIMESTAMPTZ,
  status TEXT DEFAULT 'pendiente', -- 'pendiente', 'en_proceso', 'completada', 'aprobada', 'rechazada'
  checklist_items JSONB DEFAULT '[]'::jsonb, -- checklist configurable
  comments TEXT,
  evidence_before TEXT, -- URL de foto antes
  evidence_during TEXT, -- URL de foto durante
  evidence_after TEXT, -- URL de foto después
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabla de Reporte de Incidencias (Averías, daños físicos)
CREATE TABLE IF NOT EXISTS public.facility_incidents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  center_id UUID REFERENCES public.centers(id) ON DELETE CASCADE,
  area_id UUID REFERENCES public.facility_areas(id) ON DELETE CASCADE,
  incident_type TEXT NOT NULL, -- 'filtracion', 'electrico', 'plomeria', 'higiene', etc.
  description TEXT NOT NULL,
  urgency TEXT DEFAULT 'media', -- 'critica', 'alta', 'media', 'baja'
  evidence_url TEXT,
  status TEXT DEFAULT 'pendiente', -- 'pendiente', 'en_proceso', 'resuelto'
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabla de Inventario de Limpieza e Insumos
CREATE TABLE IF NOT EXISTS public.facility_inventory (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  center_id UUID REFERENCES public.centers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  min_stock NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL, -- 'galon', 'unidad', 'paquete'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Tabla de Activos y Equipos de Infraestructura
CREATE TABLE IF NOT EXISTS public.facility_assets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  center_id UUID REFERENCES public.centers(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- 'aire_acondicionado', 'bomba_agua', 'inversor', 'extintor'
  serial_code TEXT,
  area_id UUID REFERENCES public.facility_areas(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'operativo', -- 'operativo', 'mantenimiento', 'dañado'
  purchase_date DATE,
  responsible_name TEXT,
  last_maintenance DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS (Seguridad a Nivel de Fila)
ALTER TABLE public.facility_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_assets ENABLE ROW LEVEL SECURITY;

-- Crear Políticas RLS (Asegurar que los usuarios solo accedan a su propio centro educativo)

-- 1. facility_areas
CREATE POLICY "Users can access facility_areas in their center" ON public.facility_areas
  FOR ALL USING (center_id = (SELECT center_id FROM public.profiles WHERE id = auth.uid()));

-- 2. facility_tasks
CREATE POLICY "Users can access facility_tasks in their center" ON public.facility_tasks
  FOR ALL USING (center_id = (SELECT center_id FROM public.profiles WHERE id = auth.uid()));

-- 3. facility_incidents
CREATE POLICY "Users can access facility_incidents in their center" ON public.facility_incidents
  FOR ALL USING (center_id = (SELECT center_id FROM public.profiles WHERE id = auth.uid()));

-- 4. facility_inventory
CREATE POLICY "Users can access facility_inventory in their center" ON public.facility_inventory
  FOR ALL USING (center_id = (SELECT center_id FROM public.profiles WHERE id = auth.uid()));

-- 5. facility_assets
CREATE POLICY "Users can access facility_assets in their center" ON public.facility_assets
  FOR ALL USING (center_id = (SELECT center_id FROM public.profiles WHERE id = auth.uid()));
