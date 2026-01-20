# Script para iniciar el backend de Conambiente en DESARROLLO
# Este script NO requiere configurar variables de entorno manualmente
# Ya que las lee del archivo .env

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   Iniciando Backend Conambiente (DESARROLLO)" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que existe el archivo .env
if (-Not (Test-Path ".env")) {
    Write-Host "[ERROR] No se encontró el archivo .env" -ForegroundColor Red
    Write-Host "Por favor crea un archivo .env basado en .env.example" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Archivo .env encontrado" -ForegroundColor Green
Write-Host ""
Write-Host "Ejecutando: npm run dev" -ForegroundColor Yellow
Write-Host ""

# Ejecutar en modo desarrollo (con nodemon para hot-reload)
npm run dev
