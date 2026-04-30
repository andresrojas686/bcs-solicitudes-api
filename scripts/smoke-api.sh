#!/usr/bin/env bash
# Smoke test del API completo: toca todos los endpoints en flujo.
# Asume backend en :3000 y core-mock en :4001 (pnpm dev).
set -e

API=${API:-http://localhost:3000}
PASS=0
FAIL=0

check() {
  local name="$1"
  local actual="$2"
  local expected="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  ✓ $name (status $actual)"; PASS=$((PASS+1))
  else
    echo "  ✗ $name (esperado $expected, obtenido $actual)"; FAIL=$((FAIL+1))
  fi
}

echo
echo "=== 1. Probes públicos ==="
check "GET /health"        "$(curl -sS -o /dev/null -w '%{http_code}' -m 5 $API/health)"        "200"
check "GET /health/ready"  "$(curl -sS -o /dev/null -w '%{http_code}' -m 5 $API/health/ready)"  "200"
check "GET /api/docs"      "$(curl -sS -o /dev/null -w '%{http_code}' -m 5 $API/api/docs)"      "200"

echo
echo "=== 2. Sin auth, endpoints protegidos rechazan ==="
check "GET /solicitudes (sin token)"  "$(curl -sS -o /dev/null -w '%{http_code}' -m 5 $API/solicitudes)"  "401"
check "GET /productos (sin token)"    "$(curl -sS -o /dev/null -w '%{http_code}' -m 5 $API/productos)"    "401"

echo
echo "=== 3. Auth ==="
check "POST /auth/login (creds malas)"  "$(curl -sS -o /dev/null -w '%{http_code}' -m 5 -X POST $API/auth/login -H 'content-type: application/json' -d '{"username":"asesor","password":"WRONG-PASSWORD"}')"  "401"

ASESOR=$(curl -sS -X POST $API/auth/login -H 'content-type: application/json' -d '{"username":"asesor","password":"asesor123"}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).accessToken))")
SUPER=$(curl -sS -X POST $API/auth/login -H 'content-type: application/json' -d '{"username":"supervisor","password":"super123"}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).accessToken))")
check "POST /auth/login asesor"      "$([ -n \"$ASESOR\" ] && echo 200 || echo FAIL)"  "200"
check "POST /auth/login supervisor"  "$([ -n \"$SUPER\" ] && echo 200 || echo FAIL)"  "200"

echo
echo "=== 4. Lectura con token ==="
check "GET /productos"                                "$(curl -sS -o /dev/null -w '%{http_code}' -m 5 -H "authorization: Bearer $ASESOR" $API/productos)"  "200"
check "GET /productos/AHO-001"                        "$(curl -sS -o /dev/null -w '%{http_code}' -m 5 -H "authorization: Bearer $ASESOR" $API/productos/AHO-001)"  "200"
check "GET /productos/INEXISTENTE → 404"              "$(curl -sS -o /dev/null -w '%{http_code}' -m 5 -H "authorization: Bearer $ASESOR" $API/productos/INEXISTENTE)"  "404"
check "GET /clientes/CC/1111111111"                   "$(curl -sS -o /dev/null -w '%{http_code}' -m 5 -H "authorization: Bearer $ASESOR" $API/clientes/CC/1111111111)"  "200"
check "GET /clientes/CC/4444444444 → 404"             "$(curl -sS -o /dev/null -w '%{http_code}' -m 5 -H "authorization: Bearer $ASESOR" $API/clientes/CC/4444444444)"  "404"
check "GET productos-elegibles (HU-001)"              "$(curl -sS -o /dev/null -w '%{http_code}' -m 5 -H "authorization: Bearer $ASESOR" $API/clientes/CC/2222222222/productos-elegibles)"  "200"
check "GET /solicitudes (lista, paginada)"            "$(curl -sS -o /dev/null -w '%{http_code}' -m 5 -H "authorization: Bearer $ASESOR" $API/solicitudes)"  "200"
check "GET /solicitudes?estado=FINALIZED (filtro)"    "$(curl -sS -o /dev/null -w '%{http_code}' -m 5 -H "authorization: Bearer $ASESOR" "$API/solicitudes?estado=FINALIZED")"  "200"

echo
echo "=== 5. Flujo de escritura: crear → editar → aprobar → finalizar ==="
KEY="smoke-final-$(date +%s)"
SOL=$(curl -sS -X POST $API/solicitudes \
  -H "authorization: Bearer $ASESOR" -H 'content-type: application/json' -H "idempotency-key: $KEY" \
  -d '{"cliente":{"tipoDoc":"CC","numDoc":"1111111111"},"productoCodigo":"AHO-001","datosFormulario":{"montoInicial":750000}}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).id))")
check "POST /solicitudes (DRAFT)"  "$([ -n \"$SOL\" ] && echo 201 || echo FAIL)"  "201"

check "POST /solicitudes (sin Idempotency-Key) → 400"  "$(curl -sS -o /dev/null -w '%{http_code}' -m 5 -X POST $API/solicitudes -H "authorization: Bearer $ASESOR" -H 'content-type: application/json' -d '{"cliente":{"tipoDoc":"CC","numDoc":"1111111111"},"productoCodigo":"AHO-001"}')"  "400"

check "PATCH /solicitudes/:id (enviarARevision)"  "$(curl -sS -o /dev/null -w '%{http_code}' -m 5 -X PATCH $API/solicitudes/$SOL -H "authorization: Bearer $ASESOR" -H 'content-type: application/json' -d '{"enviarARevision":true}')"  "200"

check "ASESOR intenta /aprobar → 403"  "$(curl -sS -o /dev/null -w '%{http_code}' -m 5 -X POST $API/solicitudes/$SOL/aprobar -H "authorization: Bearer $ASESOR" -H 'content-type: application/json' -d '{}')"  "403"
check "SUPERVISOR /aprobar"            "$(curl -sS -o /dev/null -w '%{http_code}' -m 5 -X POST $API/solicitudes/$SOL/aprobar -H "authorization: Bearer $SUPER" -H 'content-type: application/json' -d '{"motivo":"OK"}')"  "201"
check "SUPERVISOR /finalizar (HU-002)" "$(curl -sS -o /dev/null -w '%{http_code}' -m 5 -X POST $API/solicitudes/$SOL/finalizar -H "authorization: Bearer $SUPER")"  "201"

ESTADO=$(curl -sS -H "authorization: Bearer $ASESOR" $API/solicitudes/$SOL | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s);process.stdout.write(o.estado+'|'+(o.numeroProducto||''));})")
echo "  estado final: $ESTADO"
if [ "${ESTADO%%|*}" = "FINALIZED" ] && [ -n "${ESTADO#*|}" ]; then
  echo "  ✓ Solicitud FINALIZED con numeroProducto"; PASS=$((PASS+1))
else
  echo "  ✗ Estado final inesperado: $ESTADO"; FAIL=$((FAIL+1))
fi

echo
echo "=== 6. Caso de transición inválida ==="
SOL2=$(curl -sS -X POST $API/solicitudes -H "authorization: Bearer $ASESOR" -H 'content-type: application/json' -H "idempotency-key: $(date +%s)-bad" -d '{"cliente":{"tipoDoc":"CC","numDoc":"1111111111"},"productoCodigo":"AHO-001"}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).id))")
check "DRAFT → /aprobar (saltando IN_REVIEW) → 409"  "$(curl -sS -o /dev/null -w '%{http_code}' -m 5 -X POST $API/solicitudes/$SOL2/aprobar -H "authorization: Bearer $SUPER" -H 'content-type: application/json' -d '{}')"  "409"

echo
echo "==============================="
echo "  $PASS passed · $FAIL failed"
echo "==============================="
exit $FAIL
