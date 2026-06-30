# Panadería — app móvil (vendedores)

App offline-first en React Native (Expo SDK 56) + expo-sqlite. Toda la operación
funciona sin internet; los cambios se sincronizan solos contra el backend
Laravel cuando hay señal (al abrir, al guardar, al recuperar conexión y cada 5 min).

## Probar en el teléfono (Expo Go)

1. Instala **Expo Go** desde Play Store / App Store.
2. Arranca el backend accesible en la red local:
   ```
   cd ..\backend
   php artisan serve --host=0.0.0.0 --port=8124
   ```
   (si Windows Firewall pregunta, permitir acceso en redes privadas)
3. Arranca la app:
   ```
   npm start
   ```
4. Escanea el QR con Expo Go (el teléfono debe estar en el mismo wifi).
5. En la pestaña **Ajustes**: verifica que el servidor sea `http://<IP-de-tu-PC>:8124`
   (por defecto `http://192.168.1.107:8124`), pulsa **Sincronizar ahora**
   y elige el **vendedor**.

## Pantallas

- **Hoy** — la ruta del día: clientes que tocan hoy, en orden de visita, con
  check y monto de los ya atendidos. Tocar un cliente abre su pedido.
- **Clientes** — búsqueda y filtro por ruta; ficha con llamar, mapa (GPS) e historial.
- **Pedidos** — historial agrupado por día con total diario.
- **Ajustes** — servidor, vendedor activo, sincronización manual y pendientes.

## Sincronización

`src/sync/sync.ts` implementa el protocolo pull/push del backend
(`/api/sync/pull`, `/api/sync/push`). Reglas:

- Todo cambio local marca `_dirty=1`; los borrados marcan `_deleted=1`.
- El push sube lo sucio (el servidor hace upsert idempotente) y al confirmarse
  limpia las marcas.
- El pull aplica los cambios del servidor pero **nunca pisa un registro local
  con `_dirty=1`** (gana el dispositivo hasta que suba).
- `last_pulled_at` se guarda en la tabla `sync_meta`.

## Pendiente

- Login de vendedores (Sanctum) y token en las peticiones de sync.
- Build de producción (EAS) cuando se valide el flujo con la panadería.
- Capturar GPS del cliente desde el teléfono (expo-location).
