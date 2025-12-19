# Printer Drivers Plugin

**ID**: `printer-drivers`
**Type**: `printers`

## Purpose
Acts as a central repository for printer drivers in the PrintCon ecosystem.

## API (Events)

This plugin operates via the **Request-Response** event pattern.

### `REQUEST_DRIVERS`
- **Direction**: Inbound (Core -> Plugin)
- **Payload**: `{}` (Empty)
- **Action**: Triggers a fetch of available drivers.

### `RESPONSE_DRIVERS`
- **Direction**: Outbound (Plugin -> Core)
- **Payload**: `{ drivers: PrinterDriver[] }`

## Demo Mode (Rule #10)
If `APP_ENV` or `NODE_ENV` is set to `development`, the plugin returns a static list of mock drivers defined in `mock.ts`.
