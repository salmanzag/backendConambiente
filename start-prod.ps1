# Script para iniciar el backend de Conambiente en PRODUCCIÓN
# Este script NO requiere configurar variables de entorno manualmente
# Ya que las lee del archivo .env

Write-Host "==================================================" -ForegroundColor Green
Write-Host "   Iniciando Backend Conambiente (PRODUCCIÓN)" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""

# Verificar que existe el archivo .env
if (-Not (Test-Path ".env")) {
    Write-Host "[ERROR] No se encontró el archivo .env" -ForegroundColor Red
    Write-Host "Por favor crea un archivo .env basado en .env.example" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Archivo .env encontrado" -ForegroundColor Green
Write-Host ""
Write-Host "[INFO] Ejecutando: npm start" -ForegroundColor Yellow
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "   El servidor estará disponible en:" -ForegroundColor Green
Write-Host "   http://localhost:3000" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

# Ejecutar en modo producción (sin nodemon)
npm start
