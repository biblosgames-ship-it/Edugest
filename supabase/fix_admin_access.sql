-- =========================================================
-- PARCHE DE SEGURIDAD 2: HABILITAR ESCRITURA PARA ADMINISTRADORES
-- =========================================================
-- Problema: La base de datos estaba completamente cerrada
-- por defecto, impidiendo que el administrador genere códigos,
-- o guarde datos de otros módulos.
-- =========================================================

-- Desbloquear todas las tablas principales para el administrador
create policy "Admins can manage invitation_codes" on public.invitation_codes for all using (public.is_admin());
create policy "Admins can manage centers" on public.centers for all using (public.is_admin());
create policy "Admins can manage courses" on public.courses for all using (public.is_admin());
create policy "Admins can manage subjects" on public.subjects for all using (public.is_admin());
create policy "Admins can manage teachers" on public.teachers for all using (public.is_admin());
create policy "Admins can manage students" on public.students for all using (public.is_admin());
create policy "Admins can manage parents" on public.parents for all using (public.is_admin());
create policy "Admins can manage assignments" on public.assignments for all using (public.is_admin());
create policy "Admins can manage rooms" on public.rooms for all using (public.is_admin());
create policy "Admins can manage time_blocks" on public.time_blocks for all using (public.is_admin());
create policy "Admins can manage schedule_entries" on public.schedule_entries for all using (public.is_admin());
create policy "Admins can manage attendance_records" on public.attendance_records for all using (public.is_admin());
create policy "Admins can manage performance_alerts" on public.performance_alerts for all using (public.is_admin());
create policy "Admins can manage grade_records" on public.grade_records for all using (public.is_admin());
create policy "Admins can manage excuses" on public.excuses for all using (public.is_admin());
create policy "Admins can manage tasks" on public.tasks for all using (public.is_admin());
create policy "Admins can manage announcements" on public.announcements for all using (public.is_admin());
create policy "Admins can manage academic_requirements" on public.academic_requirements for all using (public.is_admin());
