-- Migration: Add finance_pin to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS finance_pin text;
