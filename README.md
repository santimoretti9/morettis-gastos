# Sistema Morettis con Google Sheets

Base inicial para conectar el futuro software con la planilla de Google Sheets.

## Estado actual

La conexion fue validada contra la planilla:

```text
Proyeccion Sociedad 2026
```

Pestanas detectadas:

```text
Cash-25 Morettis (2139947525)
Cash-25 Morettis (2) (109024849)
```

## Configuracion

El archivo `.env` apunta a:

```text
GOOGLE_APPLICATION_CREDENTIALS=C:\Users\santi\Downloads\morettis-500522-31d619dca0c4.json
GOOGLE_SHEET_ID=1h5uTfaJ1EXx32hp67XTWuB_bgIJvOTDejBV509rzjWU
```

## Probar conexion

```bash
npm run check:sheets
```

## Cuenta de servicio

```text
google-sheets@morettis-500522.iam.gserviceaccount.com
```

Permiso actual esperado: Editor.
