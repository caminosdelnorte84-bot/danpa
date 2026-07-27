-- Migración: Mejoras al módulo de Clientes
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar columna tipo_cliente a tabla clientes
ALTER TABLE clientes
ADD COLUMN IF NOT EXISTS tipo_cliente TEXT DEFAULT 'general'
CHECK (tipo_cliente IN ('general', 'frecuente', 'nuevo', 'vip', 'moroso', 'inactivo'));

-- 2. Agregar columna activo para soft delete
ALTER TABLE clientes
ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true;

-- 3. Crear tabla de historial de interacciones
CREATE TABLE IF NOT EXISTS cliente_notas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  corredor_id UUID REFERENCES auth.users(id),
  nota TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Habilitar RLS en la nueva tabla
ALTER TABLE cliente_notas ENABLE ROW LEVEL SECURITY;

-- 5. Política para que cada corredor vea sus propias notas
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Corredores ven sus propias notas' AND tablename = 'cliente_notas'
  ) THEN
    CREATE POLICY "Corredores ven sus propias notas"
    ON cliente_notas FOR ALL
    USING (corredor_id = auth.uid());
  END IF;
END $$;

-- 6. Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_clientes_activo ON clientes(activo);
CREATE INDEX IF NOT EXISTS idx_clientes_tipo ON clientes(tipo_cliente);
CREATE INDEX IF NOT EXISTS idx_cliente_notas_cliente ON cliente_notas(cliente_id);

-- 7. Actualizar clientes existentes sin tipo_cliente
UPDATE clientes SET tipo_cliente = 'general' WHERE tipo_cliente IS NULL;

-- 8. Actualizar clientes existentes sin activo
UPDATE clientes SET activo = true WHERE activo IS NULL;