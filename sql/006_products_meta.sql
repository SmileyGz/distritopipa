-- Migration: Add meta_description_es to products table
-- Run this in the Supabase SQL Editor

ALTER TABLE products 
ADD COLUMN meta_description_es TEXT;
